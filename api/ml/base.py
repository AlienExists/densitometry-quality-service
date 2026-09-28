"""
Базовый интерфейс ML-модели.
Все модели (mock, torch, onnx) реализуют его.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict
import numpy as np


@dataclass
class ModelPrediction:
    """Результат предсказания одной модели."""
    quality_class: int                          # 0 или 1 (производный)
    violation_types: List[str] = field(default_factory=list)
    confidences: List[float] = field(default_factory=list)
    raw_scores: Dict[str, float] = field(default_factory=dict)
    error: str = None

    @property
    def success(self) -> bool:
        return self.error is None


class BaseModel(ABC):
    """Базовый интерфейс ML-модели."""

    VIOLATION_CLASSES: List[str] = []
    THRESHOLDS: List[float] = []
    INPUT_SIZE: tuple = (384, 384)
    REGION: str = "unknown"

    @abstractmethod
    def predict(self, image: np.ndarray) -> ModelPrediction:
        """
        Args:
            image: np.ndarray, shape (H, W), dtype float32, range [0, 1]

        Returns:
            ModelPrediction
        """
        ...

    @abstractmethod
    def is_ready(self) -> bool:
        ...