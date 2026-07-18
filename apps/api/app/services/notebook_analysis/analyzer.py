from app.core.config import Settings, get_settings
from app.schemas.notebook_analysis import (
    BoundingBox,
    NotebookAnalysisRequest,
    NotebookAnalysisResult,
    NotebookMarker,
    NotebookRegion,
    NotebookRelationship,
)
from app.services.image_processing.preprocess import (
    ProcessedNotebookImage,
    decode_base64_image,
    preprocess_notebook_image,
)
from app.services.notebook_analysis.arrows import detect_arrow_relationships
from app.services.notebook_analysis.markers import detect_markers
from app.services.notebook_analysis.ocr import analyze_regions_with_ocr


class NotebookAnalysisError(ValueError):
    pass


async def analyze_notebook_page(
    request: NotebookAnalysisRequest,
    settings: Settings | None = None,
) -> NotebookAnalysisResult:
    """Analyze notebook input and return overlay-ready structured data."""
    active_settings = settings or get_settings()
    processed_image = preprocess_request_image(request)
    warnings = list(processed_image.warnings) if processed_image is not None else []

    detected_markers: list[NotebookMarker] = []
    if processed_image is not None:
        detected_markers = detect_markers(processed_image.analysis_image_array)

    if active_settings.ocr_analysis_enabled:
        if processed_image is None:
            warnings.append("ocr_requires_image_base64_using_fallback_json")
            return build_mock_analysis_result(warnings=warnings)

        ocr_analysis = analyze_regions_with_ocr(
            processed_image.analysis_image_array,
            active_settings,
        )
        warnings.extend(ocr_analysis.warnings)

        if ocr_analysis.regions:
            detected_relationships = detect_arrow_relationships(
                processed_image.analysis_image_array,
                ocr_analysis.regions,
            )
            return NotebookAnalysisResult(
                page_summary="OCR notebook analysis result",
                regions=ocr_analysis.regions,
                relationships=detected_relationships,
                markers=detected_markers,
                warnings=warnings,
                confidence=average_region_confidence(ocr_analysis.regions),
            )

        warnings.append("ocr_returned_no_regions_using_fallback_json")

    mock_result = build_mock_analysis_result(
        warnings=warnings,
        detected_markers=detected_markers,
        include_mock_relationships=processed_image is None,
    )
    if processed_image is not None:
        mock_result.relationships = detect_arrow_relationships(
            processed_image.analysis_image_array,
            mock_result.regions,
        )
    return mock_result


def preprocess_request_image(request: NotebookAnalysisRequest) -> ProcessedNotebookImage | None:
    if request.image_base64 is not None:
        try:
            image_bytes = decode_base64_image(request.image_base64)
            return preprocess_notebook_image(
                image_bytes,
                manual_crop_bbox=request.manual_crop_bbox,
            )
        except ValueError as exc:
            raise NotebookAnalysisError(str(exc)) from exc

    if request.image_url is None:
        raise NotebookAnalysisError("Provide either image_base64 or image_url.")

    return None


def average_region_confidence(regions: list[NotebookRegion]) -> float:
    if not regions:
        return 0.0

    return round(sum(region.confidence for region in regions) / len(regions), 3)


def build_mock_analysis_result(
    warnings: list[str] | None = None,
    detected_markers: list[NotebookMarker] | None = None,
    include_mock_relationships: bool = True,
) -> NotebookAnalysisResult:
    markers = detected_markers or []
    relationships = [
        NotebookRelationship(
            id="edge_1",
            source_region_id="region_1",
            target_region_id="region_2",
            label="produces",
            type="arrow",
            confidence=0.78,
        )
    ] if include_mock_relationships else []

    return NotebookAnalysisResult(
        page_summary="Mock notebook analysis result",
        regions=[
            NotebookRegion(
                id="region_1",
                label="Mitochondria",
                transcription="Mitochondria",
                type="concept",
                bbox=BoundingBox(x=0.18, y=0.3, width=0.24, height=0.08),
                markers=[],
                confidence=0.94,
            ),
            NotebookRegion(
                id="region_2",
                label="ATP",
                transcription="ATP",
                type="concept",
                bbox=BoundingBox(x=0.62, y=0.31, width=0.12, height=0.07),
                markers=["star"],
                confidence=0.91,
            ),
        ],
        relationships=relationships,
        markers=markers,
        warnings=warnings or [],
        confidence=0.89,
    )

