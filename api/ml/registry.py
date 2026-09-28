"""
Реестр моделей: 3 модели — классификатор области + spine + hip.
"""

import os
import logging
from typing import Dict, Optional
import numpy as np

from ml.base import BaseModel, ModelPrediction
from ml.mock import MockModel

logger = logging.getLogger(__name__)


# Классы нарушений (с префиксами — по требованию Участника 3)
SPINE_VIOLATIONS = [
    "spine_incorrect_field_of_view",
    "spine_axis_misalignment",
    "spine_foreign_object",
]

HIP_VIOLATIONS = [
    "femur_incorrect_positioning",
    "femur_excessive_rotation",
    "femur_insufficient_rotation",
]

# Для классификатора области
REGION_CLASSES = ["spine", "hip", "other"]


class ModelRegistry:
    """Хранит 3 модели: region + spine + hip."""

    def __init__(
        self,
        weights_dir: str = "ml/weights",
        use_mock: bool = True,
    ):
        self.weights_dir = weights_dir
        self.use_mock = use_mock
        self.region_model: Optional[BaseModel] = None
        self.models: Dict[str, BaseModel] = {}

        self._init_models()

    def _load_model(self, name: str, region: str, classes: list) -> BaseModel:
        """Пытается загрузить .onnx или .pt, иначе mock."""
        # ONNX
        onnx_path = os.path.join(self.weights_dir, f"{name}.onnx")
        if os.path.exists(onnx_path):
            try:
                from ml.onnx_model import OnnxModel
                m = OnnxModel(onnx_path)
                if m.is_ready():
                    return m
            except Exception as e:
                logger.warning(f"ONNX {name}: {e}")

        # PyTorch
        pt_path = os.path.join(self.weights_dir, f"{name}.pt")
        if os.path.exists(pt_path):
            try:
                from ml.torch_model import TorchModel
                m = TorchModel(pt_path)
                if m.is_ready():
                    return m
            except Exception as e:
                logger.warning(f"Torch {name}: {e}")

        # Mock
        if self.use_mock:
            logger.warning(f"Веса {name} не найдены — MockModel")
            return MockModel(violation_classes=classes, region=region)

        raise FileNotFoundError(f"Модель {name} не найдена")

    def _init_models(self):
        # Классификатор области
        self.region_model = self._load_model(
            name="region_model",
            region="region",
            classes=REGION_CLASSES,
        )

        # Модель позвоночника
        self.models["spine"] = self._load_model(
            name="spine_model",
            region="spine",
            classes=SPINE_VIOLATIONS,
        )

        # Модель бедра
        self.models["hip"] = self._load_model(
            name="hip_model",
            region="hip",
            classes=HIP_VIOLATIONS,
        )

    def predict_region(self, image: np.ndarray) -> str:
        """Определяет анатомическую область."""
        pred = self.region_model.predict(image)
        if not pred.success:
            return "other"
        # Берём класс с максимальным score
        if not pred.raw_scores:
            return "other"
        best = max(pred.raw_scores, key=pred.raw_scores.get)
        return best

    def predict(
        self,
        image: np.ndarray,
        region: Optional[str] = None,
    ) -> ModelPrediction:
        """
        Предсказание для изображения.
        Если region не задан — определяется классификатором.
        """
        if region is None or region in ("unknown", "other"):
            region = self.predict_region(image)

        model = self.models.get(region)
        if model is None:
            # Для "other" — возвращаем пустое предсказание
            return ModelPrediction(
                quality_class=0,
                violation_types=[],
                confidences=[],
                raw_scores={},
            )

        if not model.is_ready():
            return ModelPrediction(
                quality_class=0,
                error=f"Model for {region} not ready",
            )

        return model.predict(image)


# Singleton
_registry: Optional[ModelRegistry] = None


def get_registry(
    weights_dir: str = "ml/weights",
    use_mock: bool = True,
) -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry(weights_dir=weights_dir, use_mock=use_mock)
    return _registry