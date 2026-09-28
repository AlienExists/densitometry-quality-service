import pydicom
import pytest
from dicom.anonymizer import anonymize, verify_anonymized, PHI_TAGS


def test_anonymize_removes_phi():
    ds = pydicom.Dataset()
    ds.PatientName = "Иванов Иван"
    ds.PatientID = "12345"
    ds.Modality = "DX"  # это НЕ ПДн, должно остаться

    anonymize(ds)

    assert not hasattr(ds, "PatientName")
    assert not hasattr(ds, "PatientID")
    assert hasattr(ds, "Modality")
    assert verify_anonymized(ds) == []