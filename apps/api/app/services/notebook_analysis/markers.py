import cv2
import numpy as np

from app.schemas.notebook_analysis import BoundingBox, NotebookMarker

MIN_MARKER_AREA = 250
MAX_MARKER_AREA_RATIO = 0.08


def detect_markers(image_array: np.ndarray) -> list[NotebookMarker]:
    grayscale = to_grayscale(image_array)
    threshold = threshold_dark_marks(grayscale)
    contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    markers: list[NotebookMarker] = []
    marker_index = 1

    image_height, image_width = grayscale.shape[:2]
    max_area = image_width * image_height * MAX_MARKER_AREA_RATIO

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < MIN_MARKER_AREA or area > max_area:
            continue

        x, y, width, height = cv2.boundingRect(contour)
        aspect_ratio = width / max(height, 1)
        perimeter = cv2.arcLength(contour, True)
        contour_complexity = len(cv2.approxPolyDP(contour, 0.03 * perimeter, True))

        marker_type = classify_marker(aspect_ratio, contour_complexity)
        if marker_type is None:
            continue

        markers.append(
            NotebookMarker(
                id=f"marker_{marker_index}",
                type=marker_type,
                bbox=BoundingBox(
                    x=x / image_width,
                    y=y / image_height,
                    width=width / image_width,
                    height=height / image_height,
                ),
                region_id=None,
                confidence=marker_confidence(marker_type, contour_complexity),
                uncertainty_note="Heuristic OpenCV marker detection; user confirmation required.",
            )
        )
        marker_index += 1

    return markers


def to_grayscale(image_array: np.ndarray) -> np.ndarray:
    if len(image_array.shape) == 2:
        return image_array

    return cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)


def threshold_dark_marks(grayscale: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(grayscale, (3, 3), 0)
    return cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        12,
    )


def classify_marker(
    aspect_ratio: float,
    contour_complexity: int,
) -> str | None:
    if 0.6 <= aspect_ratio <= 1.4 and contour_complexity >= 10:
        return "star"

    if 0.35 <= aspect_ratio <= 1.3 and 4 <= contour_complexity <= 9:
        return "question"

    return None


def marker_confidence(marker_type: str, contour_complexity: int) -> float:
    if marker_type == "star":
        return min(0.65, 0.35 + contour_complexity * 0.03)

    if marker_type == "question":
        return min(0.55, 0.30 + contour_complexity * 0.025)

    return 0.3
