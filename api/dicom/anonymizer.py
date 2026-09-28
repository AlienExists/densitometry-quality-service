"""
Анонимизация DICOM: удаление всех персональных данных пациента.
Требование ТЗ: решение не должно зависеть от наличия ПДн.
"""

import logging
from typing import List
import pydicom

logger = logging.getLogger(__name__)


# Теги, которые ОБЯЗАТЕЛЬНО удалить (ПДн)
PHI_TAGS: List[str] = [
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientBirthTime",
    "PatientSex",
    "PatientAge",
    "PatientAddress",
    "PatientTelephoneNumbers",
    "PatientMotherBirthName",
    "OtherPatientIDs",
    "OtherPatientNames",
    "InstitutionName",
    "InstitutionAddress",
    "InstitutionalDepartmentName",
    "ReferringPhysicianName",
    "ReferringPhysicianAddress",
    "ReferringPhysicianTelephoneNumbers",
    "PerformingPhysicianName",
    "OperatorsName",
    "PhysiciansOfRecord",
    "RequestingPhysician",
    "AccessionNumber",
    "StudyID",
    "DeviceSerialNumber",
]


def anonymize(ds: pydicom.Dataset) -> pydicom.Dataset:
    """
    Удаляет ПДн-теги из DICOM-датасета.
    Возвращает тот же объект (in-place).
    """
    removed = []
    for tag in PHI_TAGS:
        if hasattr(ds, tag):
            try:
                delattr(ds, tag)
                removed.append(tag)
            except Exception as e:
                logger.warning(f"Не удалось удалить тег {tag}: {e}")

    if removed:
        logger.debug(f"Удалены ПДн-теги: {removed}")

    return ds


def verify_anonymized(ds: pydicom.Dataset) -> List[str]:
    """
    Проверяет, что все ПДн-теги удалены.
    Возвращает список оставшихся ПДн-тегов (должен быть пустым).
    """
    remaining = []
    for tag in PHI_TAGS:
        if hasattr(ds, tag):
            remaining.append(tag)
    return remaining