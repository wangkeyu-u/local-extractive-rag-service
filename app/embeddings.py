from __future__ import annotations

import hashlib
import math
import re


class DeterministicHashEmbedding:
    """Offline, deterministic feature-hashing embeddings for ChromaDB.

    This is deliberately not TF-IDF: vectors are produced per document without
    fitting corpus statistics. Word and character n-grams give useful local demo
    behavior while keeping tests free of model downloads.
    """

    def __init__(self, dimensions: int = 384) -> None:
        self.dimensions = dimensions

    def name(self) -> str:
        return f"deterministic-hash-v1-{self.dimensions}"

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [self.embed(text) for text in input]

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        words = re.findall(r"[\w]+", text.casefold(), flags=re.UNICODE)
        features = list(words)
        features.extend(f"w:{words[i]}_{words[i + 1]}" for i in range(len(words) - 1))
        compact = " ".join(words)
        features.extend(f"c:{compact[i:i + 3]}" for i in range(max(0, len(compact) - 2)))
        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            raw = int.from_bytes(digest, "big")
            index = raw % self.dimensions
            vector[index] += -1.0 if raw & (1 << 63) else 1.0
        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector] if norm else vector
