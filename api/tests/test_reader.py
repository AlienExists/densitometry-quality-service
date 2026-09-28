import os
import pytest
from dicom.reader import process_single


SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")


@pytest.mark.skipif(
    not os.path.exists(SAMPLES_DIR) or not os.listdir(SAMPLES_DIR),
    reason="Нет тестовых DICOM в samples/",
)
def test_process_single_real():
    files = [f for f in os.listdir(SAMPLES_DIR) if f.endswith(".dcm")]
    if not files:
        pytest.skip("Нет .dcm файлов")

    path = os.path.join(SAMPLES_DIR, files[0])
    result = process_single(path)

    assert result.success, f"Ошибка: {result.error}"
    assert result.image is not None
    assert result.image.min() >= 0.0
    assert result.image.max() <= 1.0
    assert result.study_uid != ""
    assert result.image_uid != ""
    assert result.time_of_processing > 0


def test_process_single_not_found():
    result = process_single("/nonexistent/file.dcm")
    assert not result.success
    assert "not found" in result.error.lower()