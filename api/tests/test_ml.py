import numpy as np
import pytest

from ml.registry import ModelRegistry, SPINE_VIOLATIONS, HIP_VIOLATIONS
from ml.mock import MockModel
from ml.preprocessing import prepare_for_model, letterbox, to_rgb


def test_letterbox():
    img = np.random.rand(256, 126).astype(np.float32)
    out = letterbox(img, target_size=(384, 384))
    assert out.shape == (384, 384)


def test_to_rgb():
    img = np.random.rand(384, 384).astype(np.float32)
    out = to_rgb(img)
    assert out.shape == (384, 384, 3)


def test_prepare_for_model():
    img = np.random.rand(256, 126).astype(np.float32)
    out = prepare_for_model(img, input_size=(384, 384))
    assert out.shape == (3, 384, 384)
    assert out.dtype == np.float32


def test_mock_model():
    model = MockModel(violation_classes=SPINE_VIOLATIONS, region="spine")
    img = np.random.rand(256, 126).astype(np.float32)
    pred = model.predict(img)
    assert pred.success
    assert pred.quality_class in (0, 1)


def test_registry_mock(tmp_path):
    registry = ModelRegistry(weights_dir=str(tmp_path), use_mock=True)
    img = np.random.rand(256, 126).astype(np.float32)
    pred = registry.predict(img, region="spine")
    assert pred.success


def test_registry_region_detection(tmp_path):
    registry = ModelRegistry(weights_dir=str(tmp_path), use_mock=True)
    img = np.random.rand(256, 126).astype(np.float32)
    region = registry.predict_region(img)
    assert region in ("spine", "hip", "other")