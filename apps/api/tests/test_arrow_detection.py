import cv2
import numpy as np

from app.schemas.notebook_analysis import BoundingBox, NotebookRegion
from app.services.notebook_analysis.arrows import detect_arrow_relationships


def blank_image() -> np.ndarray:
    return np.full((200, 200, 3), 255, dtype=np.uint8)


def sample_regions() -> list[NotebookRegion]:
    return [
        NotebookRegion(
            id="region_1",
            label="A",
            type="concept",
            bbox=BoundingBox(x=0.18, y=0.30, width=0.24, height=0.08),
            confidence=0.9,
        ),
        NotebookRegion(
            id="region_2",
            label="B",
            type="concept",
            bbox=BoundingBox(x=0.62, y=0.31, width=0.12, height=0.07),
            confidence=0.9,
        ),
    ]


def test_blank_image_returns_no_arrow_relationships() -> None:
    assert detect_arrow_relationships(blank_image(), sample_regions()) == []


def test_arrow_between_regions_returns_relationship_candidate() -> None:
    image = blank_image()
    cv2.arrowedLine(image, (62, 68), (132, 68), (0, 0, 0), 4, tipLength=0.25)

    relationships = detect_arrow_relationships(image, sample_regions())

    assert len(relationships) == 1
    assert relationships[0].source_region_id == "region_1"
    assert relationships[0].target_region_id == "region_2"
    assert relationships[0].type == "arrow"
    assert relationships[0].confidence <= 0.5


def test_arrow_detection_requires_two_regions() -> None:
    image = blank_image()
    cv2.arrowedLine(image, (62, 68), (132, 68), (0, 0, 0), 4, tipLength=0.25)

    assert detect_arrow_relationships(image, sample_regions()[:1]) == []
