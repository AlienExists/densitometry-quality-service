"""
Нормализация DICOM-изображений для ML.
Пайплайн: Rescale → инверсия MONOCHROME1 → Min-Max [0, 1].
"""

import logging
import numpy as np
import pydicom

logger = logging.getLogger(__name__)


def apply_rescale(ds: pydicom.Dataset, pixels: np.ndarray) -> np.ndarray:
    """Применяет Rescale Slope/Intercept."""
    slope = float(getattr(ds, "RescaleSlope", 1.0))
    intercept = float(getattr(ds, "RescaleIntercept", 0.0))

    if slope == 0:
        logger.warning("RescaleSlope = 0, пропускаем rescale")
        return pixels

    return pixels * slope + intercept


def fix_monochrome1(ds: pydicom.Dataset, pixels: np.ndarray) -> np.ndarray:
    """Инвертирует изображение для MONOCHROME1."""
    photometric = getattr(ds, "PhotometricInterpretation", "MONOCHROME2")
    if photometric == "MONOCHROME1":
        logger.debug("MONOCHROME1 → инверсия")
        pixels = pixels.max() - pixels
    return pixels


def normalize_minmax(pixels: np.ndarray) -> np.ndarray:
    """Min-Max нормализация в [0, 1]."""
    pmin, pmax = pixels.min(), pixels.max()
    if pmax - pmin < 1e-8:
        logger.warning("Однородное изображение, возвращаем нули")
        return np.zeros_like(pixels, dtype=np.float32)
    return ((pixels - pmin) / (pmax - pmin)).astype(np.float32)


def normalize_percentile(
    pixels: np.ndarray, low: float = 1.0, high: float = 99.0
) -> np.ndarray:
    """Percentile-нормализация (устойчива к выбросам)."""
    p_low = np.percentile(pixels, low)
    p_high = np.percentile(pixels, high)
    pixels = np.clip(pixels, p_low, p_high)
    if p_high - p_low < 1e-8:
        return np.zeros_like(pixels, dtype=np.float32)
    return ((pixels - p_low) / (p_high - p_low)).astype(np.float32)


def normalize(
    ds: pydicom.Dataset,
    pixels: np.ndarray,
    method: str = "minmax",
) -> np.ndarray:
    """
    Полный пайплайн нормализации.
    """
    pixels = pixels.astype(np.float32)
    pixels = apply_rescale(ds, pixels)
    pixels = fix_monochrome1(ds, pixels)

    if method == "minmax":
        return normalize_minmax(pixels)
    elif method == "percentile":
        return normalize_percentile(pixels)
    else:
        raise ValueError(f"Unknown normalize method: {method}")