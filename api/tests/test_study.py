import os
import pytest
from dicom.study import process_study, process_folder


SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")


@pytest.mark.skipif(not os.path.exists(SAMPLES_DIR), reason="Нет samples/")
def test_process_study():
    study = process_study(SAMPLES_DIR)
    if study.error:
        pytest.skip(f"Нет данных: {study.error}")
    assert study.study_uid != ""
    assert len(study.images) > 0
    assert all(img.image is not None for img in study.images if img.success)