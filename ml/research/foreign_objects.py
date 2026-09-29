from __future__ import annotations

import numpy as np

from contract import PIXEL_SPACING_MM
from spine_axis import estimate_axis

BAND_HALF_WIDTH_MM = 25.0
BORDER_FRACTION = 0.03
HOT_LEVEL = 0.5


def spine_band_mask(shape, axis: dict) -> np.ndarray:
    h, w = shape
    rows = np.arange(h)[:, None]
    cols = np.arange(w)[None, :]
    if not axis.get("ok"):
        return np.abs(cols - w / 2) <= BAND_HALF_WIDTH_MM / PIXEL_SPACING_MM["col"]
    x_line = (axis["slope"] * rows * PIXEL_SPACING_MM["row"] + axis["intercept_mm"]) / PIXEL_SPACING_MM["col"]
    return np.abs(cols - x_line) <= BAND_HALF_WIDTH_MM / PIXEL_SPACING_MM["col"]


def inner_mask(shape) -> np.ndarray:
    h, w = shape
    bh, bw = max(1, int(h * BORDER_FRACTION)), max(1, int(w * BORDER_FRACTION))
    mask = np.zeros(shape, dtype=bool)
    mask[bh:h - bh, bw:w - bw] = True
    return mask


def foreign_object_scores(arr01: np.ndarray, axis: dict | None = None) -> dict:
    img = arr01.astype(np.float32)
    axis = axis if axis is not None else estimate_axis(img)
    band = spine_band_mask(img.shape, axis)
    inner = inner_mask(img.shape)

    bone_ref = float(np.percentile(img[band & inner], 90))
    hot_level = bone_ref + HOT_LEVEL * (1.0 - bone_ref)
    hot = (img > hot_level) & inner

    gy, gx = np.gradient(img)
    edges = np.hypot(gx, gy)[inner]

    pixel_area_mm2 = PIXEL_SPACING_MM["row"] * PIXEL_SPACING_MM["col"]
    return {
        "bone_ref": bone_ref,
        "hot_area_mm2": float(hot.sum() * pixel_area_mm2),
        "offspine_hot_area_mm2": float((hot & ~band).sum() * pixel_area_mm2),
        "peak_excess": float(np.percentile(img[inner], 99.95) - bone_ref),
        "edge_peak": float(np.percentile(edges, 99.9)),
        "hot_mask": hot,
        "band_mask": band,
    }
