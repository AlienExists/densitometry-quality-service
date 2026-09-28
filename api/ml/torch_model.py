"""
Загрузка PyTorch-модели (.pt) и инференс.

Checkpoint ожидается в формате:
    torch.save({
        "model_state_dict": model.state_dict(),
        "arch": "resnet50",              # или "efficientnet_v2_s", "convnext_tiny"
        "classes": [...],                # упорядоченный список
        "thresholds": [...],             # по одному на класс
        "input_size": (384, 384),
        "normalization": {"mean": [...], "std": [...]},
        "region": "spine",               # или "hip"
        "version": "v1.0",
        "metrics": {...},
    }, "spine_model.pt")
"""

import os
import logging
from typing import List
import numpy as np

from ml.base import BaseModel, ModelPrediction
from ml.preprocessing import prepare_for_model

logger = logging.getLogger(__name__)


def _build_model(arch: str, n_classes: int):
    """Создаёт модель по имени архитектуры."""
    import torch.nn as nn
    from torchvision import models

    if arch == "resnet50":
        model = models.resnet50(weights=None)
        model.fc = nn.Linear(model.fc.in_features, n_classes)
    elif arch == "efficientnet_v2_s":
        model = models.efficientnet_v2_s(weights=None)
        model.classifier[1] = nn.Linear(
            model.classifier[1].in_features, n_classes
        )
    elif arch == "convnext_tiny":
        model = models.convnext_tiny(weights=None)
        model.classifier[2] = nn.Linear(
            model.classifier[2].in_features, n_classes
        )
    else:
        raise ValueError(f"Неизвестная архитектура: {arch}")

    return model


class TorchModel(BaseModel):
    """PyTorch-модель для мульти-лейбл классификации."""

    def __init__(self, weights_path: str, device: str = "cpu"):
        self.weights_path = weights_path
        self.device = device
        self.model = None
        self._loaded = False

        self._load()

    def _load(self):
        if not os.path.exists(self.weights_path):
            logger.error(f"Веса не найдены: {self.weights_path}")
            return

        try:
            import torch

            ckpt = torch.load(
                self.weights_path,
                map_location=self.device,
                weights_only=False,
            )

            # Метаданные
            arch = ckpt.get("arch", "resnet50")
            self.VIOLATION_CLASSES = ckpt.get("classes", [])
            self.THRESHOLDS = ckpt.get("thresholds", [0.5] * len(self.VIOLATION_CLASSES))
            self.INPUT_SIZE = tuple(ckpt.get("input_size", (384, 384)))
            self.REGION = ckpt.get("region", "unknown")

            n_classes = len(self.VIOLATION_CLASSES)
            if n_classes == 0:
                logger.error("В checkpoint нет classes")
                return

            # Сборка модели
            model = _build_model(arch, n_classes)
            model.load_state_dict(ckpt["model_state_dict"])
            model.to(self.device)
            model.eval()

            self.model = model
            self._loaded = True
            logger.info(
                f"TorchModel загружена: {self.weights_path}, "
                f"arch={arch}, region={self.REGION}, "
                f"classes={self.VIOLATION_CLASSES}"
            )

        except ImportError:
            logger.error("torch не установлен")
        except Exception as e:
            logger.exception(f"Ошибка загрузки TorchModel: {e}")

    def is_ready(self) -> bool:
        return self._loaded

    def predict(self, image: np.ndarray) -> ModelPrediction:
        if not self._loaded:
            return ModelPrediction(quality_class=0, error="Model not loaded")

        try:
            import torch

            # 1. Preprocessing
            tensor = prepare_for_model(image, self.INPUT_SIZE)
            tensor = torch.from_numpy(tensor).unsqueeze(0).to(self.device)

            # 2. Инференс (логиты)
            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.sigmoid(logits).cpu().numpy()[0]

            # 3. Постобработка: порог по каждому классу
            violation_types = []
            confidences = []
            raw_scores = {}

            for i, cls in enumerate(self.VIOLATION_CLASSES):
                score = float(probs[i])
                threshold = self.THRESHOLDS[i]
                raw_scores[cls] = score
                if score >= threshold:
                    violation_types.append(cls)
                    confidences.append(round(score, 3))

            quality_class = 1 if violation_types else 0

            return ModelPrediction(
                quality_class=quality_class,
                violation_types=violation_types,
                confidences=confidences,
                raw_scores=raw_scores,
            )

        except Exception as e:
            logger.exception(f"Ошибка инференса TorchModel: {e}")
            return ModelPrediction(quality_class=0, error=str(e))