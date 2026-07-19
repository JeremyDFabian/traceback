import json
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal

import numpy as np

from app.core.config import Settings
from app.schemas.notebook_analysis import BoundingBox, NotebookRegion

OCREngine = Literal["easyocr", "paddleocr"]


@dataclass(frozen=True)
class OCRTextBlock:
    text: str
    bbox: BoundingBox
    confidence: float


@dataclass(frozen=True)
class OCRAnalysis:
    regions: list[NotebookRegion]
    warnings: list[str]


def analyze_regions_with_ocr(
    image_array: np.ndarray,
    settings: Settings,
) -> OCRAnalysis:
    if settings.ocr_engine == "easyocr":
        return analyze_with_easyocr(image_array)

    if settings.ocr_engine == "paddleocr":
        return analyze_with_paddleocr(image_array)

    return OCRAnalysis(regions=[], warnings=["ocr_engine_mock_using_fallback_json"])


def analyze_with_easyocr(image_array: np.ndarray) -> OCRAnalysis:
    try:
        reader = get_easyocr_reader()
    except ImportError:
        return OCRAnalysis(regions=[], warnings=["easyocr_not_installed_using_fallback_json"])
    except Exception:
        return OCRAnalysis(
            regions=[],
            warnings=["easyocr_initialization_failed_using_fallback_json"],
        )

    raw_results = reader.readtext(image_array)
    blocks = [easyocr_result_to_block(result, image_array.shape) for result in raw_results]
    return OCRAnalysis(
        regions=text_blocks_to_regions(blocks),
        warnings=["easyocr_analysis_used"],
    )


@lru_cache
def get_easyocr_reader() -> Any:
    import easyocr

    return easyocr.Reader(["en"], gpu=False, verbose=False)


def analyze_with_paddleocr(image_array: np.ndarray) -> OCRAnalysis:
    try:
        ocr = get_paddleocr_reader()
    except ImportError:
        return OCRAnalysis(regions=[], warnings=["paddleocr_not_installed_using_fallback_json"])
    except Exception:
        return OCRAnalysis(
            regions=[],
            warnings=["paddleocr_initialization_failed_using_fallback_json"],
        )

    raw_results = ocr.predict(image_array)
    blocks = paddleocr_results_to_blocks(raw_results, image_array.shape)
    return OCRAnalysis(
        regions=text_blocks_to_regions(blocks),
        warnings=["paddleocr_analysis_used"],
    )


@lru_cache
def get_paddleocr_reader() -> Any:
    os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")

    from paddleocr import PaddleOCR

    return PaddleOCR(
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="en_PP-OCRv5_mobile_rec",
        text_det_limit_side_len=640,
        text_det_limit_type="max",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def easyocr_result_to_block(result: Any, image_shape: tuple[int, ...]) -> OCRTextBlock:
    points, text, confidence = result
    return OCRTextBlock(
        text=str(text).strip(),
        bbox=points_to_normalized_bbox(points, image_shape),
        confidence=float(confidence),
    )


def paddleocr_results_to_blocks(
    raw_results: Any,
    image_shape: tuple[int, ...],
) -> list[OCRTextBlock]:
    blocks: list[OCRTextBlock] = []
    for page_result in raw_results or []:
        payload = getattr(page_result, "json", page_result)
        if isinstance(payload, str):
            payload = json.loads(payload)
        if not isinstance(payload, dict):
            continue

        result = payload.get("res", payload)
        polygons = result.get("rec_polys", result.get("dt_polys", []))
        texts = result.get("rec_texts", [])
        confidences = result.get("rec_scores", [])

        for points, text, confidence in zip(polygons, texts, confidences):
            blocks.append(
                OCRTextBlock(
                    text=str(text).strip(),
                    bbox=points_to_normalized_bbox(points, image_shape),
                    confidence=float(confidence),
                )
            )
    return blocks


def points_to_normalized_bbox(points: Any, image_shape: tuple[int, ...]) -> BoundingBox:
    image_height = max(float(image_shape[0]), 1.0)
    image_width = max(float(image_shape[1]), 1.0)
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]

    left = min(xs) / image_width
    top = min(ys) / image_height
    right = max(xs) / image_width
    bottom = max(ys) / image_height

    return BoundingBox(
        x=max(0.0, min(left, 1.0)),
        y=max(0.0, min(top, 1.0)),
        width=max(0.01, min(right - left, 1.0)),
        height=max(0.01, min(bottom - top, 1.0)),
    )


def text_blocks_to_regions(blocks: list[OCRTextBlock]) -> list[NotebookRegion]:
    regions: list[NotebookRegion] = []
    for index, block in enumerate(blocks, start=1):
        if not block.text:
            continue

        regions.append(
            NotebookRegion(
                id=f"region_{index}",
                label=block.text[:80],
                transcription=block.text,
                type="concept",
                bbox=block.bbox,
                markers=[],
                confidence=max(0.0, min(block.confidence, 1.0)),
            )
        )
    return regions