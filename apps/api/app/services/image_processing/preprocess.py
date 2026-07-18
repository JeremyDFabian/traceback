import base64
import binascii
from dataclasses import dataclass
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

from app.schemas.notebook_analysis import BoundingBox

MAX_PROCESSED_DIMENSION = 2500
JPEG_QUALITY = 92


@dataclass(frozen=True)
class ProcessedNotebookImage:
    width: int
    height: int
    display_image_base64: str
    analysis_image_base64: str
    analysis_image_array: np.ndarray
    warnings: list[str]


def preprocess_notebook_image(
    image_bytes: bytes,
    manual_crop_bbox: BoundingBox | None = None,
    max_dimension: int = MAX_PROCESSED_DIMENSION,
) -> ProcessedNotebookImage:
    image = load_notebook_image(image_bytes)
    warnings: list[str] = []

    if manual_crop_bbox is not None:
        image = apply_manual_crop(image, manual_crop_bbox)
        warnings.append("manual_crop_applied")

    image = resize_to_max_dimension(image, max_dimension)
    display_image = image.convert("RGB")
    analysis_image = enhance_for_analysis(display_image)

    return ProcessedNotebookImage(
        width=display_image.width,
        height=display_image.height,
        display_image_base64=encode_jpeg_base64(display_image),
        analysis_image_base64=encode_jpeg_base64(analysis_image),
        analysis_image_array=np.array(analysis_image),
        warnings=warnings,
    )


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


def encode_jpeg_base64(image: Image.Image) -> str:
    output = BytesIO()
    image.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


def decode_base64_image(image_base64: str) -> bytes:
    try:
        return base64.b64decode(image_base64, validate=True)
    except binascii.Error as exc:
        raise ValueError("Invalid base64 notebook image.") from exc

