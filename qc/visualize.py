from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from contract import (PIXEL_SPACING_MM, VIOLATION_AXIS_MISALIGNMENT, VIOLATION_FOREIGN_OBJECT,
                      VIOLATION_INCORRECT_POSITIONING, VIOLATION_INCORRECT_ROI)

FONT_CANDIDATES = [
    "DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
ASCII_NAMES = {
    VIOLATION_INCORRECT_POSITIONING: "positioning",
    VIOLATION_AXIS_MISALIGNMENT: "axis",
    VIOLATION_FOREIGN_OBJECT: "foreign object",
    VIOLATION_INCORRECT_ROI: "ROI",
}
SCALE = 2


def get_font(size: int = 14):
    for name in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(name, size), True
        except OSError:
            continue
    return ImageFont.load_default(), False


def label(text: str, cyrillic_ok: bool) -> str:
    if cyrillic_ok:
        return text
    for ru, en in ASCII_NAMES.items():
        text = text.replace(ru, en)
    return text.encode("ascii", "replace").decode()


def gray_rgb(arr01: np.ndarray) -> np.ndarray:
    g = (np.clip(arr01, 0, 1) * 255).astype(np.uint8)
    return np.stack([g, g, g], axis=-1)


def jet(v: np.ndarray) -> np.ndarray:
    r = np.clip(1.5 - np.abs(4 * v - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * v - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * v - 1), 0, 1)
    return np.stack([r, g, b], axis=-1)


def overlay_heatmap(arr01: np.ndarray, cam: np.ndarray, alpha: float = 0.6) -> np.ndarray:
    base = gray_rgb(arr01).astype(np.float32) / 255.0
    weight = (alpha * np.clip(cam, 0, 1))[..., None]
    out = base * (1 - weight) + jet(cam) * weight
    return (out * 255).astype(np.uint8)


def draw_axis(arr01: np.ndarray, axis: dict) -> np.ndarray:
    img = Image.fromarray(gray_rgb(arr01))
    draw = ImageDraw.Draw(img)
    if axis.get("ok"):
        for r, c in zip(axis["rows"][::3], axis["centers"][::3]):
            draw.ellipse([c - 1, r - 1, c + 1, r + 1], fill=(255, 60, 60))
        h = arr01.shape[0]
        xs = [(axis["slope"] * r * PIXEL_SPACING_MM["row"] + axis["intercept_mm"]) / PIXEL_SPACING_MM["col"] for r in (0, h - 1)]
        draw.line([(xs[0], 0), (xs[1], h - 1)], fill=(60, 220, 60), width=1)
    return np.array(img)


def save_panels(panels: list[tuple[str, np.ndarray]], path: str | Path) -> None:
    font, cyrillic_ok = get_font(13)
    tiles = [Image.fromarray(rgb).resize((rgb.shape[1] * SCALE, rgb.shape[0] * SCALE), Image.Resampling.NEAREST)
             for _, rgb in panels]
    header = 40
    width = sum(t.width for t in tiles) + 10 * (len(tiles) + 1)
    height = max(t.height for t in tiles) + header + 10
    sheet = Image.new("RGB", (width, height), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    x = 10
    for (title, _), tile in zip(panels, tiles):
        for i, line in enumerate(title.split("\n")[:2]):
            draw.text((x, 4 + i * 17), label(line, cyrillic_ok), fill=(255, 255, 255), font=font)
        sheet.paste(tile, (x, header))
        x += tile.width + 10
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
