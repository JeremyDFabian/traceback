from pathlib import Path
from typing import Any

import fitz  # type: ignore[import-untyped]

from app.schemas.deck import ExtractedSlide, TextSpan


def extract_pdf(path: Path) -> list[ExtractedSlide]:
    slides: list[ExtractedSlide] = []

    with fitz.open(path) as document:
        document: Any
        for page_index in range(len(document)):
            page: Any = document[page_index]
            spans: list[TextSpan] = []
            page_data: dict[str, Any] = page.get_text("dict")

            for block in page_data["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not text:
                            continue
                        x0, y0, x1, y1 = span["bbox"]
                        spans.append(
                            TextSpan(
                                text=text,
                                x=x0,
                                y=y0,
                                width=x1 - x0,
                                height=y1 - y0,
                            )
                        )

            slides.append(
                ExtractedSlide(
                    slide_number=page_index + 1,
                    width=page.rect.width,
                    height=page.rect.height,
                    spans=spans,
                )
            )

    return slides
