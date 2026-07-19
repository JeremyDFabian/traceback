import cv2
import numpy as np

from app.services.notebook_analysis.markers import detect_markers


def blank_image() -> np.ndarray:
    return np.full((200, 200, 3), 255, dtype=np.uint8)


def test_blank_image_returns_no_markers() -> None:
    assert detect_markers(blank_image()) == []


def test_question_mark_image_returns_question_candidate() -> None:
    image = blank_image()
    cv2.putText(
        image,
        "?",
        (70, 140),
        cv2.FONT_HERSHEY_SIMPLEX,
        4,
        (0, 0, 0),
        8,
        cv2.LINE_AA,
    )

    markers = detect_markers(image)

    assert any(marker.type == "question" for marker in markers)
    assert all(marker.region_id is None for marker in markers)
    assert all(marker.confidence <= 0.65 for marker in markers)


def test_star_image_returns_star_candidate() -> None:
    image = blank_image()
    points = np.array(
        [
            [100, 60],
            [108, 86],
            [136, 86],
            [114, 102],
            [123, 130],
            [100, 112],
            [77, 130],
            [86, 102],
            [64, 86],
            [92, 86],
        ],
        np.int32,
    )
    cv2.polylines(image, [points], True, (0, 0, 0), 5, cv2.LINE_AA)

    markers = detect_markers(image)

    assert any(marker.type == "star" for marker in markers)
    assert all(marker.region_id is None for marker in markers)
    assert all(marker.confidence <= 0.65 for marker in markers)
