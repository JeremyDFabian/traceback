import pytest

from app.embedding import cosine_similarity


def test_cosine_similarity_is_one_for_identical_vectors() -> None:
    assert cosine_similarity([1.0, 2.0], [1.0, 2.0]) == pytest.approx(1.0)


def test_cosine_similarity_is_zero_for_empty_or_zero_vectors() -> None:
    assert cosine_similarity([], [1.0]) == 0.0
    assert cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


def test_cosine_similarity_rejects_different_dimensions() -> None:
    assert cosine_similarity([1.0], [1.0, 2.0]) == 0.0
