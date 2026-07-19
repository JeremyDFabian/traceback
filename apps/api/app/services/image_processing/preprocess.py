import base64
import binascii
from dataclasses import dataclass
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

from app.schemas.notebook_analysis import BoundingBox

MAX_PROCESSED_DIMENSION = 2500
GEMINI_MAX_DIMENSION = 1600
DISPLAY_JPEG_QUALITY = 92
GEMINI_JPEG_QUALITY = 84
PERSPECTIVE_DETECTION_DIMENSION = 900


@dataclass(frozen=True)
class ProcessedNotebookImage:
    width: int
    height: int
    display_image_base64: str
    gemini_image_base64: str
    display_image_array: np.ndarray
    analysis_image_base64: str | None
    analysis_image_array: np.ndarray | None
    warnings: list[str]


def preprocess_notebook_image(
    image_bytes: bytes,
    manual_crop_bbox: BoundingBox | None = None,
    max_dimension: int = MAX_PROCESSED_DIMENSION,
    include_local_analysis: bool = True,
) -> ProcessedNotebookImage:
    image = load_notebook_image(image_bytes)
    warnings: list[str] = []

    if manual_crop_bbox is not None:
        image = apply_manual_crop(image, manual_crop_bbox)
        warnings.append("manual_crop_applied")

    image, perspective_applied = correct_perspective(image)
    if perspective_applied:
        warnings.append("perspective_correction_applied")

    display_image = resize_to_max_dimension(image, max_dimension).convert("RGB")
    gemini_image = resize_to_max_dimension(display_image, GEMINI_MAX_DIMENSION)
    analysis_image = enhance_for_analysis(display_image) if include_local_analysis else None

    return ProcessedNotebookImage(
        width=display_image.width,
        height=display_image.height,
        display_image_base64=encode_jpeg_base64(display_image, DISPLAY_JPEG_QUALITY),
        gemini_image_base64=encode_jpeg_base64(gemini_image, GEMINI_JPEG_QUALITY),
        display_image_array=np.array(display_image),
        analysis_image_base64=(
            encode_jpeg_base64(analysis_image, DISPLAY_JPEG_QUALITY)
            if analysis_image is not None
            else None
        ),
        analysis_image_array=np.array(analysis_image) if analysis_image is not None else None,
        warnings=warnings,
    )


def get_analysis_image_array(processed_image: ProcessedNotebookImage) -> np.ndarray:
    if processed_image.analysis_image_array is not None:
        return processed_image.analysis_image_array

    display_image = Image.fromarray(processed_image.display_image_array)
    return np.array(enhance_for_analysis(display_image))


def load_notebook_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError("Unsupported or invalid notebook image.") from exc

    return ImageOps.exif_transpose(image).convert("RGB")


def apply_manual_crop(image: Image.Image, bbox: BoundingBox) -> Image.Image:
    left = round(bbox.x * image.width)
    top = round(bbox.y * image.height)
    right = round((bbox.x + bbox.width) * image.width)
    bottom = round((bbox.y + bbox.height) * image.height)

    left = max(0, min(left, image.width - 1))
    top = max(0, min(top, image.height - 1))
    right = max(left + 1, min(right, image.width))
    bottom = max(top + 1, min(bottom, image.height))

    return image.crop((left, top, right, bottom))


def correct_perspective(image: Image.Image) -> tuple[Image.Image, bool]:
    image_array = np.array(image)
    corners = find_document_corners(image_array)
    if corners is None:
        return image, False

    warped = warp_document(image_array, corners)
    if warped is None:
        return image, False
    return Image.fromarray(warped), True


def find_document_corners(image_array: np.ndarray) -> np.ndarray | None:
    height, width = image_array.shape[:2]
    scale = min(1.0, PERSPECTIVE_DETECTION_DIMENSION / max(width, height))
    resized = cv2.resize(image_array, None, fx=scale, fy=scale) if scale < 1 else image_array
    gray = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 60, 180)
    edges = cv2.dilate(edges, np.ones((3, 3), dtype=np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    minimum_area = resized.shape[0] * resized.shape[1] * 0.2

    candidates: list[tuple[float, np.ndarray]] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < minimum_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(polygon) != 4:
            continue
        points = polygon.reshape(4, 2).astype(np.float32)
        if touches_full_image_boundary(points, resized.shape[1], resized.shape[0]):
            continue
        candidates.append((area, points))

    if not candidates:
        return None

    _, points = max(candidates, key=lambda candidate: candidate[0])
    return points / scale


def touches_full_image_boundary(points: np.ndarray, width: int, height: int) -> bool:
    margin = max(3, round(min(width, height) * 0.01))
    touches = [
        point[0] <= margin
        or point[0] >= width - margin
        or point[1] <= margin
        or point[1] >= height - margin
        for point in points
    ]
    return sum(touches) >= 3


def warp_document(image_array: np.ndarray, points: np.ndarray) -> np.ndarray | None:
    ordered = order_corners(points)
    top_left, top_right, bottom_right, bottom_left = ordered
    target_width = round(
        max(np.linalg.norm(bottom_right - bottom_left), np.linalg.norm(top_right - top_left))
    )
    target_height = round(
        max(np.linalg.norm(top_right - bottom_right), np.linalg.norm(top_left - bottom_left))
    )
    if target_width < 50 or target_height < 50:
        return None

    destination = np.array(
        [
            [0, 0],
            [target_width - 1, 0],
            [target_width - 1, target_height - 1],
            [0, target_height - 1],
        ],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(ordered.astype(np.float32), destination)
    return cv2.warpPerspective(image_array, transform, (target_width, target_height))


def order_corners(points: np.ndarray) -> np.ndarray:
    ordered = np.zeros((4, 2), dtype=np.float32)
    point_sums = points.sum(axis=1)
    point_differences = np.diff(points, axis=1).reshape(-1)
    ordered[0] = points[np.argmin(point_sums)]
    ordered[2] = points[np.argmax(point_sums)]
    ordered[1] = points[np.argmin(point_differences)]
    ordered[3] = points[np.argmax(point_differences)]
    return ordered


def resize_to_max_dimension(image: Image.Image, max_dimension: int) -> Image.Image:
    largest_dimension = max(image.width, image.height)
    if largest_dimension <= max_dimension:
        return image

    scale = max_dimension / largest_dimension
    new_size = (round(image.width * scale), round(image.height * scale))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def enhance_for_analysis(image: Image.Image) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    contrast_boosted = ImageEnhance.Contrast(grayscale).enhance(1.8)
    brightness_boosted = ImageEnhance.Brightness(contrast_boosted).enhance(1.05)
    return denoise_image(brightness_boosted).convert("RGB")


def denoise_image(image: Image.Image) -> Image.Image:
    image_array = np.array(image)
    denoised = cv2.fastNlMeansDenoising(
        image_array,
        None,
        h=10,
        templateWindowSize=7,
        searchWindowSize=21,
    )
    return Image.fromarray(denoised)


def encode_jpeg_base64(image: Image.Image, quality: int = DISPLAY_JPEG_QUALITY) -> str:
    output = BytesIO()
    image.save(output, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


def decode_base64_image(image_base64: str) -> bytes:
    try:
        return base64.b64decode(image_base64, validate=True)
    except binascii.Error as exc:
        raise ValueError("Invalid base64 notebook image.") from exc
