import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api import analysis, matches
from app.api.flashcards import get_flashcard_generator
from app.db import get_connection
from app.main import app
from app.schemas.flashcards import FlashcardSourceInput, GeneratedFlashcard

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "sample-data" / "mitochondria-atp"
EXPECTED = json.loads((FIXTURE_DIR / "expected.json").read_text(encoding="utf-8"))


class FixtureFlashcardGenerator:
    def generate(
        self,
        source: FlashcardSourceInput,
        count: int,
    ) -> list[GeneratedFlashcard]:
        assert count == EXPECTED["flashcard_count"]
        return [
            GeneratedFlashcard.model_validate(
                {
                    "question": card["question"],
                    "answer": card["answer"],
                    "difficulty": card["difficulty"],
                }
            )
            for card in EXPECTED["generated_flashcards"]
        ]


def test_confirmed_region_matches_real_pdf_and_generates_grounded_cards(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_id = EXPECTED["session_id"]
    lecture_name = "lecture-deck.pdf"
    shutil.copyfile(FIXTURE_DIR / lecture_name, tmp_path / lecture_name)

    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(session_id,), (lecture_name,)]
    connection.execute.return_value = cursor
    settings = SimpleNamespace(storage_dir=tmp_path)
    monkeypatch.setattr(analysis, "get_settings", lambda: settings)
    monkeypatch.setattr(matches, "get_settings", lambda: settings)
    app.dependency_overrides[get_connection] = lambda: connection
    app.dependency_overrides[get_flashcard_generator] = lambda: FixtureFlashcardGenerator()

    try:
        client = TestClient(app)
        confirm_response = client.post(
            f"/api/sessions/{session_id}/confirm",
            json=EXPECTED["approved_analysis"],
        )
        match_response = client.post(
            f"/api/sessions/{session_id}/regions/"
            f"{EXPECTED['expected_match']['region_id']}/match"
        )
        match = match_response.json()
        region = EXPECTED["approved_analysis"]["regions"][0]
        flashcard_response = client.post(
            "/api/flashcards/generate",
            json={
                "source": {
                    "session_id": session_id,
                    "region_id": region["id"],
                    "slide_number": match["slide_number"],
                    "note_text": region["transcription"],
                    "slide_text": match["passage"],
                    "highlight_boxes": match["highlight_boxes"],
                },
                "count": EXPECTED["flashcard_count"],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert confirm_response.status_code == 200
    assert match_response.status_code == 200
    assert match["status"] == EXPECTED["expected_match"]["status"]
    assert match["slide_number"] == EXPECTED["expected_match"]["slide_number"]
    assert match["passage"] == EXPECTED["expected_match"]["passage"]
    assert match["similarity_score"] >= EXPECTED["expected_match"]["minimum_similarity_score"]
    assert len(match["highlight_boxes"]) == len(EXPECTED["expected_match"]["highlight_boxes"])
    for actual, expected in zip(
        match["highlight_boxes"],
        EXPECTED["expected_match"]["highlight_boxes"],
        strict=True,
    ):
        assert actual == pytest.approx(expected, abs=0.002)

    assert flashcard_response.status_code == 200
    cards = flashcard_response.json()["flashcards"]
    assert [card["question"] for card in cards] == [
        card["question"] for card in EXPECTED["generated_flashcards"]
    ]
    assert all(card["source"]["slide_text"] == match["passage"] for card in cards)
    assert all(card["source"]["highlight_boxes"] == match["highlight_boxes"] for card in cards)
