import math
from dataclasses import dataclass
from typing import cast

import cv2
import numpy as np

from app.schemas.notebook_analysis import NotebookRegion, NotebookRelationship

MIN_ARROW_LENGTH_RATIO = 0.12
MAX_ENDPOINT_DISTANCE_RATIO = 0.18


@dataclass(frozen=True)
class LineSegment:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def length(self) -> float:
        return math.dist((self.x1, self.y1), (self.x2, self.y2))


def detect_arrow_relationships(
    image_array: np.ndarray,
    regions: list[NotebookRegion],
) -> list[NotebookRelationship]:
    if len(regions) < 2:
        return []

    grayscale = to_grayscale(image_array)
    edges = cv2.Canny(grayscale, 50, 150, apertureSize=3)
    raw_lines = cast(
        np.ndarray | None,
        cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=35,
            minLineLength=35,
            maxLineGap=12,
        ),
    )
    if raw_lines is None:
        return []

    image_height, image_width = grayscale.shape[:2]
    min_length = max(image_width, image_height) * MIN_ARROW_LENGTH_RATIO
    max_endpoint_distance = max(image_width, image_height) * MAX_ENDPOINT_DISTANCE_RATIO

    relationships: list[NotebookRelationship] = []
    seen_pairs: set[tuple[str, str]] = set()

    for raw_line in raw_lines:
        line = LineSegment(*[int(value) for value in raw_line[0]])
        if line.length < min_length:
            continue

        source_point, target_point = orient_line_left_to_right(line)
        source_region = nearest_region(source_point, regions, image_width, image_height)
        target_region = nearest_region(target_point, regions, image_width, image_height)

        if source_region is None or target_region is None:
            continue

        source_distance = point_to_region_center_distance(
            source_point,
            source_region,
            image_width,
            image_height,
        )
        target_distance = point_to_region_center_distance(
            target_point,
            target_region,
            image_width,
            image_height,
        )

        if source_distance > max_endpoint_distance or target_distance > max_endpoint_distance:
            continue

        if source_region.id == target_region.id:
            continue

        pair = (source_region.id, target_region.id)
        if pair in seen_pairs:
            continue

        seen_pairs.add(pair)
        relationships.append(
            NotebookRelationship(
                id=f"edge_{len(relationships) + 1}",
                source_region_id=source_region.id,
                target_region_id=target_region.id,
                label=None,
                type="arrow",
                confidence=0.45,
                uncertainty_note="Heuristic OpenCV arrow detection; user confirmation required.",
            )
        )

    return relationships


def to_grayscale(image_array: np.ndarray) -> np.ndarray:
    if len(image_array.shape) == 2:
        return image_array

    return cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)


def orient_line_left_to_right(
    line: LineSegment,
) -> tuple[tuple[int, int], tuple[int, int]]:
    if line.x1 < line.x2:
        return (line.x1, line.y1), (line.x2, line.y2)

    if line.x2 < line.x1:
        return (line.x2, line.y2), (line.x1, line.y1)

    if line.y1 <= line.y2:
        return (line.x1, line.y1), (line.x2, line.y2)

    return (line.x2, line.y2), (line.x1, line.y1)


def nearest_region(
    point: tuple[int, int],
    regions: list[NotebookRegion],
    image_width: int,
    image_height: int,
) -> NotebookRegion | None:
    if not regions:
        return None

    return min(
        regions,
        key=lambda region: point_to_region_center_distance(
            point, region, image_width, image_height
        ),
    )


def point_to_region_center_distance(
    point: tuple[int, int],
    region: NotebookRegion,
    image_width: int,
    image_height: int,
) -> float:
    center_x = (region.bbox.x + region.bbox.width / 2) * image_width
    center_y = (region.bbox.y + region.bbox.height / 2) * image_height
    return math.dist(point, (center_x, center_y))
