"""
Модели данных для DICOM-модуля.
КОНТРАКТ: не менять без согласования с Backend 1 и Участником 3.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np


@dataclass
class DicomImage:
    """Одно изображение из DICOM-исследования."""
    # Идентификаторы (обязательно для XLSX)
    study_uid: str
    image_uid: str

    # Изображение (нормализованное [0,1], float32)
    image: np.ndarray

    # Оригинал до нормализации (для превью и отладки)
    image_original: Optional[np.ndarray] = None

    # Обезличенные метаданные
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Анатомическая область
    anatomical_region: str = "unknown"  # "lumbar_spine" | "hip" | "unknown"

    # Флаги качества (эвристики)
    flags: List[str] = field(default_factory=list)

    # Обработка
    file_path: str = ""
    time_of_processing: float = 0.0
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.error is None and self.image is not None


@dataclass
class DicomStudy:
    """Исследование (может содержать до 3 изображений)."""
    study_uid: str
    images: List[DicomImage] = field(default_factory=list)
    total_time: float = 0.0
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.error is None and len(self.images) > 0