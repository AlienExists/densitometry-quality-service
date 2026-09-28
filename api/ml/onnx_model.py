"""
Загрузка ONNX-модели и инференс.
Быстрее PyTorch, не требует torch в runtime.
"""

import os
import json
import logging
import numpy as np

from ml.base import BaseModel, ModelPrediction
from ml.preprocessing import prepare_for_model

logger = logging.getLogger(__name__)


class OnnxModel(BaseModel):
    """
    ONNX-модель.

    Рядом с .onnx ожидается .json:
        {
          "classes": [...],
          "thresholds": [...],
          "input_size": [384, 384],
          "region": "spine",
          "arch": "resnet50"
        }
    """

    def __init__(self, onnx_path: str):
        self.onnx_path = onnx_path
        self.session = None
        self._loaded = False
        self._load()

    def _load(self):
        if not os.path.exists(self.onnx_path):
            logger.error(f"ONNX не найден: {self.onnx_path}")
            return

        try:
            import onnxruntime as ort

            meta_path = self.onnx_path.replace(".onnx", ".json")
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                self.VIOLATION_CLASSES = meta.get("classes", [])
                self.THRESHOLDS = meta.get("thresholds", [0.5] * len(self.VIOLATION_CLASSES))
                self.INPUT_SIZE = tuple(meta.get("input_size", [384, 384]))
                self.REGION = meta.get("region", "unknown")

            self.session = ort.InferenceSession(
                self.onnx_path,
                providers=["CPUExecutionProvider"],
            )
            self._loaded = True
            logger.info(f"OnnxModel загружена: {self.onnx_path}")

        except ImportError:
            logger.error("onnxruntime не установлен")
        except Exception as e:
            logger.exception(f"Ошибка загрузки OnnxModel: {e}")

    def is_ready(self) -> bool:
        return self._loaded

    def predict(self, image: np.ndarray) -> ModelPrediction:
        if not self._loaded:
            return ModelPrediction(quality_class=0, error="Model not loaded")

        try:
            # 1. Preprocessing
            tensor = prepare_for_model(image, self.INPUT_SIZE)
            tensor = np.expand_dims(tensor, axis=0).astype(np.float32)

            # 2. Инференс
            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: tensor})
            logits = outputs[0][0]

            # 3. Sigmoid
            probs = 1 / (1 + np.exp(-logits))

            # 4. Постобработка
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
            logger.exception(f"Ошибка инференса OnnxModel: {e}")
            return ModelPrediction(quality_class=0, error=str(e))