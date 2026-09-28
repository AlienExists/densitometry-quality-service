import numpy as np
import pydicom
from dicom.normalizer import (
    apply_rescale, fix_monochrome1, normalize_minmax, normalize,
)


def test_rescale():
    ds = pydicom.Dataset()
    ds.RescaleSlope = 2.0
    ds.RescaleIntercept = 10.0
    pixels = np.array([[0, 1], [2, 3]], dtype=np.float32)
    result = apply_rescale(ds, pixels)
    expected = np.array([[10, 12], [14, 16]], dtype=np.float32)
    np.testing.assert_array_equal(result, expected)


def test_monochrome1():
    ds = pydicom.Dataset()
    ds.PhotometricInterpretation = "MONOCHROME1"
    pixels = np.array([[0, 5], [10, 15]], dtype=np.float32)
    result = fix_monochrome1(ds, pixels)
    expected = np.array([[15, 10], [5, 0]], dtype=np.float32)
    np.testing.assert_array_equal(result, expected)


def test_minmax():
    pixels = np.array([[0, 50], [100, 200]], dtype=np.float32)
    result = normalize_minmax(pixels)
    assert result.min() == 0.0
    assert result.max() == 1.0
    assert result.dtype == np.float32


def test_uniform_image():
    pixels = np.full((10, 10), 42, dtype=np.float32)
    result = normalize_minmax(pixels)
    assert np.all(result == 0)