from __future__ import annotations

import hashlib
import warnings

import numpy as np
import pydicom
from PIL import Image
try:
    from pydicom.pixels import apply_modality_lut, apply_voi_lut
except ImportError:
    from pydicom.pixel_data_handlers.util import apply_modality_lut, apply_voi_lut

from contract import IMAGENET_MEAN, IMAGENET_STD, PAD_HEIGHT, REGION_INPUT_SIZE, region_from_size

warnings.filterwarnings("ignore", message="Invalid value for VR UI")


def read_dicom(path):
    return pydicom.dcmread(str(path))


def pixel_hash(ds) -> str:
    return hashlib.md5(ds.PixelData).hexdigest()


def to_unit_range(ds) -> np.ndarray:
    arr = apply_modality_lut(ds.pixel_array, ds)
    try:
        arr = apply_voi_lut(arr, ds)
    except Exception:
        pass
    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = arr.max() - arr
    if arr.ndim == 3:
        arr = arr[0]
    arr = arr.astype(np.float32)
    lo, hi = float(arr.min()), float(arr.max())
    return (arr - lo) / (hi - lo) if hi > lo else np.zeros_like(arr)


def pad_to_height(arr: np.ndarray, height: int = PAD_HEIGHT) -> np.ndarray:
    h, w = arr.shape
    if h >= height:
        return arr[:height]
    out = np.zeros((height, w), dtype=arr.dtype)
    out[:h] = arr
    return out


def normalize_3ch(x: np.ndarray) -> np.ndarray:
    x = np.repeat(x[None], 3, axis=0)
    mean = np.array(IMAGENET_MEAN, dtype=np.float32)[:, None, None]
    std = np.array(IMAGENET_STD, dtype=np.float32)[:, None, None]
    return ((x - mean) / std).astype(np.float32)


def to_model_input(arr01: np.ndarray) -> np.ndarray:
    return normalize_3ch(pad_to_height(arr01))


def to_region_input(arr01: np.ndarray) -> np.ndarray:
    img = Image.fromarray(np.ascontiguousarray(arr01, dtype=np.float32))
    img = img.resize((REGION_INPUT_SIZE, REGION_INPUT_SIZE), Image.Resampling.BILINEAR)
    return normalize_3ch(np.asarray(img, dtype=np.float32))


def prepare(path):
    ds = read_dicom(path)
    return ds, region_from_size(int(ds.Columns)), to_unit_range(ds)
