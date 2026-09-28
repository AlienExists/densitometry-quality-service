"""
Batch-обработка: очередь задач, прогресс, результат в XLSX.
"""

import os
import uuid
import time
import shutil
import zipfile
import logging
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from dicom.study import process_folder
from dicom.models import DicomStudy

logger = logging.getLogger(__name__)


@dataclass
class BatchJob:
    """Задача batch-обработки."""
    job_id: str
    status: str = "pending"  # pending | running | done | failed
    total: int = 0
    processed: int = 0
    result_path: Optional[str] = None
    error: Optional[str] = None
    started_at: float = 0.0
    finished_at: float = 0.0

    @property
    def progress(self) -> float:
        return self.processed / self.total if self.total > 0 else 0.0


# In-memory хранилище задач
_jobs: Dict[str, BatchJob] = {}
_jobs_lock = threading.Lock()


def get_job(job_id: str) -> Optional[BatchJob]:
    with _jobs_lock:
        return _jobs.get(job_id)


def _update_job(job_id: str, **kwargs):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)


def create_job() -> BatchJob:
    """Создаёт новую задачу."""
    job_id = str(uuid.uuid4())
    job = BatchJob(job_id=job_id)
    with _jobs_lock:
        _jobs[job_id] = job
    return job


def run_batch(
    job_id: str,
    zip_path: str,
    extract_dir: str,
    output_dir: str,
    max_workers: int = 4,
) -> None:
    """
    Запускает batch-обработку в фоне.
    Вызывается из BackgroundTasks FastAPI.
    """
    _update_job(job_id, status="running", started_at=time.time())

    try:
        # 1. Распаковка ZIP
        extract_path = Path(extract_dir) / job_id
        extract_path.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_path)

        # 2. Поиск исследований (папок с DICOM)
        studies = process_folder(str(extract_path))

        # 3. Обновляем total
        total_images = sum(len(s.images) for s in studies)
        _update_job(job_id, total=total_images)

        # 4. Формируем строки для XLSX
        from api.xlsx import ReportRow, write_xlsx
        rows: List[ReportRow] = []
        processed = 0

        for study in studies:
            for img in study.images:
                row = ReportRow(
                    path_to_study=img.file_path,
                    study_uid=img.study_uid,
                    image_uid=img.image_uid,
                    anatomical_region=img.anatomical_region,
                    quality_class=0,  # TODO: заменить на ML-предсказание
                    violation_type="",  # TODO
                    processing_status="Success" if img.success else "Failure",
                    time_of_processing=img.time_of_processing,
                )
                rows.append(row)
                processed += 1
                _update_job(job_id, processed=processed)

        # 5. Генерация XLSX
        output_path = Path(output_dir) / f"{job_id}.xlsx"
        write_xlsx(rows, str(output_path))

        _update_job(
            job_id,
            status="done",
            result_path=str(output_path),
            finished_at=time.time(),
        )

    except Exception as e:
        logger.exception(f"Batch job {job_id} failed")
        _update_job(
            job_id,
            status="failed",
            error=str(e),
            finished_at=time.time(),
        )
    finally:
        # Очистка временной папки
        try:
            shutil.rmtree(extract_path, ignore_errors=True)
        except Exception:
            pass