"""
Валидация ZIP-архивов: защита от zip-bomb и path traversal.
"""

import zipfile
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


MAX_FILES = 20000
MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024  # 5 GB
MAX_SINGLE_SIZE = 500 * 1024 * 1024      # 500 MB
MAX_COMPRESSION_RATIO = 100              # zip-bomb защита


class ZipSecurityError(Exception):
    pass


def validate_zip(zip_path: str) -> None:
    """
    Проверяет ZIP на безопасность.
    Бросает ZipSecurityError при нарушении.
    """
    if not Path(zip_path).exists():
        raise ZipSecurityError("ZIP не найден")

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            infos = zf.infolist()

            # 1. Количество файлов
            if len(infos) > MAX_FILES:
                raise ZipSecurityError(
                    f"Слишком много файлов: {len(infos)} > {MAX_FILES}"
                )

            # 2. Общий размер
            total_size = sum(i.file_size for i in infos)
            if total_size > MAX_TOTAL_SIZE:
                raise ZipSecurityError(
                    f"Слишком большой архив: {total_size} > {MAX_TOTAL_SIZE}"
                )

            # 3. Каждый файл
            for info in infos:
                # Path traversal
                if info.filename.startswith("/") or ".." in info.filename:
                    raise ZipSecurityError(
                        f"Path traversal: {info.filename}"
                    )

                # Размер одного файла
                if info.file_size > MAX_SINGLE_SIZE:
                    raise ZipSecurityError(
                        f"Файл слишком большой: {info.filename}"
                    )

                # Zip-bomb: коэффициент сжатия
                if info.compress_size > 0:
                    ratio = info.file_size / info.compress_size
                    if ratio > MAX_COMPRESSION_RATIO:
                        raise ZipSecurityError(
                            f"Подозрительное сжатие: {info.filename}"
                        )

    except zipfile.BadZipFile:
        raise ZipSecurityError("Повреждённый ZIP")