from collections.abc import Sequence
from math import sqrt
from typing import Protocol


class EmbeddingProvider(Protocol):
    """A component that turns text into a numeric vector."""

    def embed(self, text: str) -> Sequence[float]: ...


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    """Return semantic-vector similarity, or zero for unusable vectors."""
    if len(left) != len(right) or not left or not right:
        return 0.0
    left_length = sqrt(sum(value * value for value in left))
    right_length = sqrt(sum(value * value for value in right))
    if left_length == 0 or right_length == 0:
        return 0.0
    return max(
        0.0,
        min(
            1.0, sum(a * b for a, b in zip(left, right, strict=True)) / (left_length * right_length)
        ),
    )
