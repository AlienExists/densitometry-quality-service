from __future__ import annotations

import numpy as np

from contract import PIXEL_SPACING_MM

EDGE_FRACTION = 0.05
BRIGHT_PERCENTILE = 75
MIN_ROW_STRENGTH = 0.2


def smooth(arr: np.ndarray, radius: int = 3) -> np.ndarray:
    k = np.ones(2 * radius + 1, dtype=np.float32) / (2 * radius + 1)
    out = np.apply_along_axis(lambda v: np.convolve(v, k, mode="same"), 1, arr)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="same"), 0, out)


def fix_polarity(img: np.ndarray) -> tuple[np.ndarray, bool]:
    w = img.shape[1]
    center = img[:, w // 3: 2 * w // 3].mean()
    sides = np.concatenate([img[:, : w // 6], img[:, -w // 6:]], axis=1).mean()
    if center < sides:
        return 1.0 - img, True
    return img, False


def row_centers(img: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    h, w = img.shape
    cols = np.arange(w, dtype=np.float32)
    rows, centers, strength = [], [], []
    for r in range(int(h * EDGE_FRACTION), int(h * (1 - EDGE_FRACTION))):
        line = img[r]
        weight = np.clip(line - np.percentile(line, BRIGHT_PERCENTILE), 0, None)
        total = weight.sum()
        if total <= 0:
            continue
        rows.append(r)
        centers.append(float((weight * cols).sum() / total))
        strength.append(float(total))
    strength = np.array(strength)
    keep = strength >= MIN_ROW_STRENGTH * strength.max() if len(strength) else strength.astype(bool)
    return np.array(rows)[keep], np.array(centers)[keep], strength[keep]


def theil_sen(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    i, j = np.triu_indices(len(x), k=1)
    dx = x[j] - x[i]
    ok = dx != 0
    slope = float(np.median((y[j] - y[i])[ok] / dx[ok]))
    intercept = float(np.median(y - slope * x))
    return slope, intercept


def segment_fit(y_mm: np.ndarray, x_mm: np.ndarray, mask: np.ndarray) -> tuple[float, float, float]:
    if mask.sum() < 10:
        return float("nan"), float("nan"), float("nan")
    slope, intercept = theil_sen(y_mm[mask], x_mm[mask])
    return float(np.degrees(np.arctan(slope))), slope, intercept


def estimate_axis(arr01: np.ndarray) -> dict:
    img, inverted = fix_polarity(smooth(arr01.astype(np.float32)))
    rows, centers, _ = row_centers(img)
    if len(rows) < 20:
        return {"angle_deg": float("nan"), "ok": False, "inverted": inverted, "rows_used": int(len(rows))}

    y_mm = rows * PIXEL_SPACING_MM["row"]
    x_mm = centers * PIXEL_SPACING_MM["col"]
    slope, intercept = theil_sen(y_mm, x_mm)
    residual = x_mm - (slope * y_mm + intercept)

    top = rows <= np.median(rows)
    angle_top, slope_top, icpt_top = segment_fit(y_mm, x_mm, top)
    angle_bottom, slope_bottom, icpt_bottom = segment_fit(y_mm, x_mm, ~top)
    same_direction = bool(np.sign(angle_top) == np.sign(angle_bottom))

    return {
        "angle_deg": float(np.degrees(np.arctan(slope))),
        "slope": slope,
        "intercept_mm": intercept,
        "residual_mad_mm": float(np.median(np.abs(residual))),
        "angle_top_deg": angle_top,
        "angle_bottom_deg": angle_bottom,
        "same_direction": same_direction,
        "consistent_tilt_deg": min(abs(angle_top), abs(angle_bottom)) if same_direction else 0.0,
        "bend_deg": abs(angle_top - angle_bottom),
        "segments": ((slope_top, icpt_top, rows[top]), (slope_bottom, icpt_bottom, rows[~top])),
        "rows_used": int(len(rows)),
        "rows": rows,
        "centers": centers,
        "inverted": inverted,
        "ok": True,
    }
