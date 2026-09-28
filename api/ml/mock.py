"""
Mock-модель для отладки API и пайплайна.
Возвращает случайные предсказания.
"""

import random
import logging
import numpy as np

from ml.base import BaseModel, ModelPrediction

logger = logging.getLogger(__name__)


class MockModel(BaseModel):
    """Заглушка: случайные предсказания."""

    def __init__(
        self,
        violation_classes: list,
        region: str = "unknown",
        seed: int = 42,
    ):
        self.VIOLATION_CLASSES = violation_classes
        self.THRESHOLDS = [0.5] * len(violation_classes)
        self.REGION = region
        self._rng = random.Random(seed)

    def is_ready(self) -> bool:
        return True

    def predict(self, image: np.ndarray) -> ModelPrediction:
        if image is None or image.size == 0:
            return ModelPrediction(quality_class=0, error="Empty image")

        # Случайные нарушения
        n = self._rng.randint(0, len(self.VIOLATION_CLASSES))
        violation_types = self._rng.sample(self.VIOLATION_CLASSES, n) if n else []

        confidences = [round(self._rng.uniform(0.5, 1.0), 3) for _ in violation_types]
        raw_scores = {c: self._rng.random() for c in self.VIOLATION_CLASSES}

        quality_class = 1 if violation_types else 0

        return ModelPrediction(
            quality_class=quality_class,
            violation_types=violation_types,
            confidences=confidences,
            raw_scores=raw_scores,
        )