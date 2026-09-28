"""
Чтение DICOM-файлов и извлечение метаданных.
"""

import os
import time
import logging
from typing import Optional, Dict, Any, List

import numpy as np
import pydicom
from pydicom.errors import InvalidDicomError

from dicom.models import DicomImage
from dicom.anonymizer import anonymize
from dicom.normalizer import normalize

logger = logging.getLogger(__name__)


# Допустимые модальности для денситометрии
ALLOWED_MODALITIES = {"DX", "DXA", "CR", "DR"}


# Маппинг BodyPartExamined → anatomical_region
BODY_PART_MAP = {
    "SPINE": "lumbar_spine",
    "LSPINE": "lumbar_spine",
    "LUMBAR": "lumbar_spine",
    "HIP": "hip",
    "FEMUR": "hip",
    "PELVIS": "hip",
}


def _extract_metadata(ds: pydicom.Dataset) -> Dict[str, Any]:
    """Извлекает обезличенные метаданные."""
    return {
        # Идентификаторы
        "study_uid": getattr(ds, "StudyInstanceUID", ""),
        "image_uid": getattr(ds, "SOPInstanceUID", ""),
        "series_uid": getattr(ds, "SeriesInstanceUID", ""),
        # Модальность и область
        "modality": getattr(ds, "Modality", None),
        "body_part": getattr(ds, "BodyPartExamined", None),
        "study_description": getattr(ds, "StudyDescription", None),
        "view_position": getattr(ds, "ViewPosition", None),
        "laterality": getattr(ds, "ImageLaterality", None),
        # Параметры съемки
        "kvp": getattr(ds, "KVP", None),
        "exposure": getattr(ds, "Exposure", None),
        "exposure_time": getattr(ds, "ExposureTime", None),
        "xray_tube_current": getattr(ds, "XRayTubeCurrent", None),
        # Параметры изображения
        "rows": int(ds.Rows) if hasattr(ds, "Rows") else None,
        "columns": int(ds.Columns) if hasattr(ds, "Columns") else None,
        "bits_allocated": getattr(ds, "BitsAllocated", None),
        "bits_stored": getattr(ds, "BitsStored", None),
        "photometric": getattr(ds, "PhotometricInterpretation", None),
        "rescale_slope": getattr(ds, "RescaleSlope", None),
        "rescale_intercept": getattr(ds, "RescaleIntercept", None),
        # Производитель
        "manufacturer": getattr(ds, "Manufacturer", None),
        "model": getattr(ds, "ManufacturerModelName", None),
    }


def _detect_anatomical_region(ds: pydicom.Dataset) -> str:
    """Определяет анатомическую область."""
    body_part = (getattr(ds, "BodyPartExamined", "") or "").upper()
    if body_part in BODY_PART_MAP:
        return BODY_PART_MAP[body_part]

    # Fallback: по StudyDescription
    desc = (getattr(ds, "StudyDescription", "") or "").upper()
    if "SPINE" in desc or "ПОЗВОНОЧ" in desc:
        return "lumbar_spine"
    if "HIP" in desc or "БЕДР" in desc or "FEMUR" in desc:
        return "hip"

    return "unknown"


def _check_quality_flags(ds: pydicom.Dataset, pixels: np.ndarray) -> List[str]:
    """Простые эвристики качества."""
    flags = []

    if pixels.shape[0] < 256 or pixels.shape[1] < 256:
        flags.append("low_resolution")

    if pixels.std() < 0.05:
        flags.append("low_contrast")

    if pixels.mean() > 0.95:
        flags.append("overexposed")
    elif pixels.mean() < 0.05:
        flags.append("underexposed")

    if not getattr(ds, "KVP", None):
        flags.append("missing_kvp")

    return flags


def process_single(
    file_path: str,
    normalize_method: str = "minmax",
) -> DicomImage:
    """
    Обрабатывает один DICOM-файл.
    Возвращает DicomImage (даже при ошибке — с полем error).
    """
    start = time.perf_counter()
    file_path = str(file_path)

    # 1. Проверка существования
    if not os.path.exists(file_path):
        return DicomImage(
            study_uid="", image_uid="", image=None,
            file_path=file_path, error="File not found",
            time_of_processing=time.perf_counter() - start,
        )

    # 2. Чтение
    try:
        ds = pydicom.dcmread(file_path, force=False)
    except InvalidDicomError:
        return DicomImage(
            study_uid="", image_uid="", image=None,
            file_path=file_path, error="Not a valid DICOM file",
            time_of_processing=time.perf_counter() - start,
        )
    except Exception as e:
        return DicomImage(
            study_uid="", image_uid="", image=None,
            file_path=file_path, error=f"Read error: {e}",
            time_of_processing=time.perf_counter() - start,
        )

    # 3. Валидация модальности
    modality = (getattr(ds, "Modality", "") or "").upper()
    if modality and modality not in ALLOWED_MODALITIES:
        return DicomImage(
            study_uid=getattr(ds, "StudyInstanceUID", ""),
            image_uid=getattr(ds, "SOPInstanceUID", ""),
            image=None, file_path=file_path,
            error=f"Invalid modality: {modality}",
            time_of_processing=time.perf_counter() - start,
        )

    # 4. Извлечение пикселей
    try:
        pixels = ds.pixel_array.astype(np.float32)
    except Exception as e:
        return DicomImage(
            study_uid=getattr(ds, "StudyInstanceUID", ""),
            image_uid=getattr(ds, "SOPInstanceUID", ""),
            image=None, file_path=file_path,
            error=f"Pixel decoding error: {e}",
            time_of_processing=time.perf_counter() - start,
        )

    # 5. Multi-frame → первый кадр
    if pixels.ndim == 3:
        logger.warning(f"{file_path}: multi-frame, берём первый кадр")
        pixels = pixels[0]

    # 6. Метаданные (до анонимизации — нужны UID)
    metadata = _extract_metadata(ds)

    # 7. Анонимизация (ПДн вырезаем)
    anonymize(ds)

    # 8. Нормализация
    image_original = pixels.copy()
    try:
        image = normalize(ds, pixels, method=normalize_method)
    except Exception as e:
        return DicomImage(
            study_uid=metadata["study_uid"],
            image_uid=metadata["image_uid"],
            image=None, file_path=file_path,
            error=f"Normalization error: {e}",
            time_of_processing=time.perf_counter() - start,
        )

    # 9. Определение области и флагов
    anatomical_region = _detect_anatomical_region(ds)
    flags = _check_quality_flags(ds, image)

    return DicomImage(
        study_uid=metadata["study_uid"],
        image_uid=metadata["image_uid"],
        image=image,
        image_original=image_original,
        metadata=metadata,
        anatomical_region=anatomical_region,
        flags=flags,
        file_path=file_path,
        time_of_processing=time.perf_counter() - start,
    )