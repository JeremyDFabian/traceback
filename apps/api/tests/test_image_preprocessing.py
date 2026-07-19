import base64
from io import BytesIO

import pytest
from PIL import Image, ImageDraw

from app.schemas.notebook_analysis import BoundingBox
from app.services.image_processing.preprocess import (
    GEMINI_MAX_DIMENSION,
    decode_base64_image,
    preprocess_notebook_image,
)


def make_test_image(width: int = 400, height: int = 200) -> bytes:
    image = Image.new("RGB", (width, height), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def make_perspective_page_image() -> bytes:
    image = Image.new("RGB", (600, 600), "#555555")
    draw = ImageDraw.Draw(image)
    draw.polygon([(90, 130), (490, 80), (530, 460), (130, 510)], fill="white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_preprocess_resizes_and_returns_analysis_images() -> None:
    result = preprocess_notebook_image(make_test_image(), max_dimension=100)

    assert result.width == 100
    assert result.height == 50
    assert decode_base64_image(result.display_image_base64)
    assert decode_base64_image(result.analysis_image_base64)
    assert result.warnings == []


def test_preprocess_creates_smaller_gemini_image_without_local_analysis() -> None:
    result = preprocess_notebook_image(
        make_test_image(width=3200, height=1600),
        include_local_analysis=False,
    )
    gemini_image = Image.open(BytesIO(decode_base64_image(result.gemini_image_base64)))

    assert max(gemini_image.size) == GEMINI_MAX_DIMENSION
    assert result.analysis_image_base64 is None
    assert result.analysis_image_array is None


def test_preprocess_applies_manual_crop_before_resize() -> None:
    result = preprocess_notebook_image(
        make_test_image(),
        manual_crop_bbox=BoundingBox(x=0.25, y=0.0, width=0.5, height=1.0),
        max_dimension=100,
    )

    assert result.width == 100
    assert result.height == 100
    assert result.warnings == ["manual_crop_applied"]


def test_preprocess_corrects_clear_document_perspective() -> None:
    result = preprocess_notebook_image(
        make_perspective_page_image(),
        include_local_analysis=False,
    )

    assert "perspective_correction_applied" in result.warnings
    assert result.width > 300
    assert result.height > 300


def test_decode_base64_image_rejects_invalid_input() -> None:
    with pytest.raises(ValueError, match="Invalid base64 notebook image"):
        decode_base64_image("not valid")


def test_decode_base64_image_accepts_valid_input() -> None:
    encoded = base64.b64encode(b"image-bytes").decode("ascii")

    assert decode_base64_image(encoded) == b"image-bytes"
