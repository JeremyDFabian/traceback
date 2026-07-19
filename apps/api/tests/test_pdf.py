import fitz
import pytest
from pydantic import ValidationError

from app.pdf import extract_pdf
from app.schemas.deck import ExtractedSlide


def test_extract_pdf_returns_text_spans(tmp_path) -> None:
    pdf_path = tmp_path / "lecture.pdf"
    document = fitz.open()
    page = document.new_page(width=200, height=100)
    page.insert_text((20, 40), "Mitochondria produce ATP")
    document.save(pdf_path)
    document.close()

    slides = extract_pdf(pdf_path)

    assert len(slides) == 1
    assert slides[0].slide_number == 1
    assert slides[0].width == 200
    assert slides[0].height == 100
    assert slides[0].spans[0].text == "Mitochondria produce ATP"
    assert slides[0].spans[0].x == 20


@pytest.mark.parametrize(("width", "height"), [(0, 100), (100, 0), (-1, 100), (100, -1)])
def test_extracted_slide_requires_positive_dimensions(width: float, height: float) -> None:
    with pytest.raises(ValidationError):
        ExtractedSlide(slide_number=1, width=width, height=height, spans=[])
