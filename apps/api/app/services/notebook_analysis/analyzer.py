from app.core.config import Settings, get_settings
from app.schemas.notebook_analysis import (
    BoundingBox,
    NotebookAnalysisRequest,
    NotebookAnalysisResult,
    NotebookRegion,
    NotebookRelationship,
)
from app.services.image_processing.preprocess import (
    ProcessedNotebookImage,
    decode_base64_image,
    get_analysis_image_array,
    preprocess_notebook_image,
)
from app.services.notebook_analysis.arrows import detect_arrow_relationships
from app.services.notebook_analysis.cleanup import clean_analysis_result
from app.services.notebook_analysis.gemini import analyze_notebook_with_gemini
from app.services.notebook_analysis.markers import detect_markers
from app.services.notebook_analysis.ocr import analyze_regions_with_ocr
from app.services.notebook_analysis.openai import analyze_notebook_with_openai


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

    ocr_regions: list[NotebookRegion] = []
    analysis_image = None
    if processed_image is not None:
        analysis_image = get_analysis_image_array(processed_image)

    if active_settings.ocr_analysis_enabled:
        if processed_image is None or analysis_image is None:
            warnings.append("ocr_requires_image_base64_using_fallback_json")
        else:
            ocr_analysis = analyze_regions_with_ocr(analysis_image, active_settings)
            ocr_regions = ocr_analysis.regions
            warnings.extend(ocr_analysis.warnings)

    if active_settings.openai_analysis_enabled:
        if processed_image is None:
            warnings.append("openai_requires_image_base64_using_local_fallback")
        else:
            openai_analysis = analyze_notebook_with_openai(
                decode_base64_image(processed_image.gemini_image_base64),
                active_settings,
                ocr_regions,
            )
            warnings.extend(openai_analysis.warnings)
            if openai_analysis.result is not None:
                return finalize_remote_result(
                    openai_analysis.result,
                    processed_image,
                    warnings,
                )
    elif active_settings.gemini_analysis_enabled:
        if processed_image is None:
            warnings.append("gemini_requires_image_base64_using_local_fallback")
        else:
            gemini_analysis = analyze_notebook_with_gemini(
                decode_base64_image(processed_image.gemini_image_base64),
                active_settings,
            )
            warnings.extend(gemini_analysis.warnings)
            if gemini_analysis.result is not None:
                return finalize_remote_result(
                    gemini_analysis.result,
                    processed_image,
                    warnings,
                )

    if ocr_regions and analysis_image is not None:
        detected_relationships = detect_arrow_relationships(
            analysis_image,
            ocr_regions,
        )
        return NotebookAnalysisResult(
            page_summary="OCR notebook analysis result",
            typed_text=typed_text_from_regions(ocr_regions),
            regions=ocr_regions,
            relationships=detected_relationships,
            markers=detect_markers(analysis_image),
            warnings=warnings,
            confidence=average_region_confidence(ocr_regions),
        )

    if active_settings.ocr_analysis_enabled:
        warnings.append("ocr_returned_no_regions_using_fallback_json")

    mock_result = build_mock_analysis_result(
        warnings=warnings,
        include_mock_relationships=processed_image is None,
    )
    if processed_image is not None and analysis_image is not None:
        mock_result.relationships = detect_arrow_relationships(
            analysis_image,
            mock_result.regions,
        )
        mock_result.markers = detect_markers(analysis_image)
    return mock_result


def typed_text_from_regions(regions: list[NotebookRegion]) -> str:
    return "\n".join(
        region.transcription.strip() for region in regions if region.transcription.strip()
    )


def finalize_remote_result(
    result: NotebookAnalysisResult,
    processed_image: ProcessedNotebookImage,
    warnings: list[str],
) -> NotebookAnalysisResult:
    relationships = result.relationships
    if not relationships:
        analysis_image = get_analysis_image_array(processed_image)
        relationships = detect_arrow_relationships(analysis_image, result.regions)

    typed_text = result.typed_text or typed_text_from_regions(result.regions)
    return clean_analysis_result(
        result.model_copy(
            update={
                "typed_text": typed_text,
                "relationships": relationships,
                "markers": result.markers,
                "warnings": [*warnings, *result.warnings],
            }
        )
    )


def preprocess_request_image(
    request: NotebookAnalysisRequest,
    include_local_analysis: bool = True,
) -> ProcessedNotebookImage | None:
    if request.image_base64 is not None:
        try:
            image_bytes = decode_base64_image(request.image_base64)
            return preprocess_notebook_image(
                image_bytes,
                manual_crop_bbox=request.manual_crop_bbox,
                include_local_analysis=include_local_analysis,
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
    include_mock_relationships: bool = True,
) -> NotebookAnalysisResult:
    relationships = (
        [
            NotebookRelationship(
                id="edge_1",
                source_region_id="region_1",
                target_region_id="region_2",
                label="produces",
                type="arrow",
                confidence=0.78,
            )
        ]
        if include_mock_relationships
        else []
    )

    return NotebookAnalysisResult(
        page_summary="Mock notebook analysis result",
        typed_text="Mitochondria produce ATP during cellular respiration.",
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
        markers=[],
        warnings=warnings or [],
        confidence=0.89,
    )
