import pytest

from app.services.notebook_analysis.ocr import paddleocr_results_to_blocks


def test_paddleocr_results_to_blocks_parses_v3_result() -> None:
    blocks = paddleocr_results_to_blocks(
        [
            {
                "res": {
                    "rec_texts": ["ATP"],
                    "rec_scores": [0.95],
                    "rec_polys": [[[10, 20], [110, 20], [110, 60], [10, 60]]],
                }
            }
        ],
        image_shape=(100, 200, 3),
    )

    assert len(blocks) == 1
    assert blocks[0].text == "ATP"
    assert blocks[0].confidence == 0.95
    assert blocks[0].bbox.x == 0.05
    assert blocks[0].bbox.y == 0.2
    assert blocks[0].bbox.width == 0.5
    assert blocks[0].bbox.height == pytest.approx(0.4)


def test_paddleocr_results_to_blocks_ignores_unknown_results() -> None:
    blocks = paddleocr_results_to_blocks([object()], image_shape=(100, 200, 3))

    assert blocks == []