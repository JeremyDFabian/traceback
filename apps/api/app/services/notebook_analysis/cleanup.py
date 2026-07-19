from app.schemas.notebook_analysis import (
    NotebookAnalysisResult,
    NotebookRegion,
)


def clean_analysis_result(result: NotebookAnalysisResult) -> NotebookAnalysisResult:
    regions = sorted(result.regions, key=lambda region: (region.bbox.y, region.bbox.x, region.id))
    retained_regions: list[NotebookRegion] = []
    for region in regions:
        if not any(regions_are_duplicates(region, retained) for retained in retained_regions):
            retained_regions.append(region)

    region_ids = {region.id for region in retained_regions}
    relationships = []
    seen_relationships: set[tuple[str, str, str | None]] = set()
    for relationship in result.relationships:
        relationship_key = (
            relationship.source_region_id,
            relationship.target_region_id,
            relationship.label,
        )
        if (
            relationship.source_region_id not in region_ids
            or relationship.target_region_id not in region_ids
            or relationship.source_region_id == relationship.target_region_id
            or relationship_key in seen_relationships
        ):
            continue
        seen_relationships.add(relationship_key)
        relationships.append(relationship)

    markers = [
        marker
        for marker in result.markers
        if marker.region_id is None or marker.region_id in region_ids
    ]
    return result.model_copy(
        update={
            "regions": retained_regions,
            "relationships": relationships,
            "markers": markers,
        }
    )


def regions_are_duplicates(first: NotebookRegion, second: NotebookRegion) -> bool:
    overlap = bounding_box_iou(first, second)
    same_label = first.label.strip().casefold() == second.label.strip().casefold()
    return overlap >= 0.8 or (same_label and overlap >= 0.45)


def bounding_box_iou(first: NotebookRegion, second: NotebookRegion) -> float:
    first_right = first.bbox.x + first.bbox.width
    first_bottom = first.bbox.y + first.bbox.height
    second_right = second.bbox.x + second.bbox.width
    second_bottom = second.bbox.y + second.bbox.height

    intersection_width = max(0.0, min(first_right, second_right) - max(first.bbox.x, second.bbox.x))
    intersection_height = max(
        0.0,
        min(first_bottom, second_bottom) - max(first.bbox.y, second.bbox.y),
    )
    intersection = intersection_width * intersection_height
    union = (
        first.bbox.width * first.bbox.height + second.bbox.width * second.bbox.height - intersection
    )
    return intersection / union if union else 0.0
