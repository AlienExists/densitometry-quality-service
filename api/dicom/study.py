"""
Группировка DICOM-файлов по StudyInstanceUID.
"""

import os
import time
import logging
from pathlib import Path
from typing import List, Dict
from collections import defaultdict

import pydicom

from dicom.models import DicomImage, DicomStudy
from dicom.reader import process_single

logger = logging.getLogger(__name__)


def _quick_read_uid(file_path: str) -> str:
    """Быстро читает StudyInstanceUID без декодирования пикселей."""
    try:
        ds = pydicom.dcmread(
            file_path,
            stop_before_pixels=True,
            force=False,
        )
        return getattr(ds, "StudyInstanceUID", "")
    except Exception:
        return ""


def process_study(
    folder: str,
    normalize_method: str = "minmax",
    max_images: int = 3,
) -> DicomStudy:
    """
    Обрабатывает папку с DICOM-файлами одного исследования.
    Группирует по StudyInstanceUID, обрабатывает до max_images.
    """
    start = time.perf_counter()
    folder = Path(folder)

    if not folder.exists() or not folder.is_dir():
        return DicomStudy(
            study_uid="", error=f"Folder not found: {folder}",
            total_time=time.perf_counter() - start,
        )

    # 1. Собираем все файлы
    files = [f for f in folder.rglob("*") if f.is_file()]
    if not files:
        return DicomStudy(
            study_uid="", error="No files in folder",
            total_time=time.perf_counter() - start,
        )

    # 2. Группируем по StudyInstanceUID
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in files:
        uid = _quick_read_uid(str(f))
        if uid:
            groups[uid].append(str(f))

    if not groups:
        # Fallback: если UID не читается — обрабатываем всё как одно исследование
        logger.warning("Не удалось прочитать StudyInstanceUID, обрабатываем всё подряд")
        groups["unknown"] = [str(f) for f in files]

    # 3. Берём первое исследование (или объединяем)
    study_uid, file_list = next(iter(groups.items()))
    file_list = file_list[:max_images]

    logger.info(f"Study {study_uid}: {len(file_list)} файлов")

    # 4. Обрабатываем каждое изображение
    images: List[DicomImage] = []
    for f in file_list:
        img = process_single(f, normalize_method=normalize_method)
        images.append(img)

    return DicomStudy(
        study_uid=study_uid,
        images=images,
        total_time=time.perf_counter() - start,
    )


def process_folder(
    folder: str,
    normalize_method: str = "minmax",
) -> List[DicomStudy]:
    """
    Обрабатывает папку со множеством исследований.
    Возвращает список DicomStudy.
    """
    folder = Path(folder)
    files = [f for f in folder.rglob("*") if f.is_file()]

    # Группируем все файлы по StudyInstanceUID
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in files:
        uid = _quick_read_uid(str(f))
        groups[uid or "unknown"].append(str(f))

    studies = []
    for study_uid, file_list in groups.items():
        images = [process_single(f, normalize_method=normalize_method)
                  for f in file_list[:3]]
        studies.append(DicomStudy(
            study_uid=study_uid,
            images=images,
            total_time=sum(i.time_of_processing for i in images),
        ))

    return studies