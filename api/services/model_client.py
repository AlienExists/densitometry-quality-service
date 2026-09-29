"""
Связка бэкенда с ML-частью (папка qc в корне репозитория).

Весь анализ снимка — чтение DICOM, препроцессинг, определение зоны, модели,
геометрия оси, пороги и сборка строки отчёта — делает qc.analyzer.QualityAnalyzer.
Бэкенд передаёт ему путь к папке с DICOM и получает готовые строки.
Препроцессинг здесь намеренно не делается: он должен совпадать с тем,
на котором обучались модели, поэтому живёт в одном месте — qc/preprocessing.py.

Настройки через переменные окружения:
    QC_WEIGHTS_DIR  папка с spine.pt, femur.pt, region.pt (по умолчанию qc/weights)
    QC_DUMMY=1      режим заглушки: без весов, все вероятности нулевые
"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path
from typing import List, Optional

from api.schemas.prediction import PredictionResult

ROOT = Path(__file__).resolve().parents[2]
QC_DIR = ROOT / "qc"
if str(QC_DIR) not in sys.path:
    sys.path.insert(0, str(QC_DIR))

from analyzer import QualityAnalyzer  # noqa: E402
from contract import REPORT_COLUMNS  # noqa: E402

_analyzer: Optional[QualityAnalyzer] = None
_lock = threading.Lock()


def get_analyzer() -> QualityAnalyzer:
    global _analyzer
    with _lock:
        if _analyzer is None:
            dummy = os.getenv("QC_DUMMY", "0") == "1"
            weights = Path(os.getenv("QC_WEIGHTS_DIR", QC_DIR / "weights"))
            _analyzer = QualityAnalyzer(None if dummy else weights, dummy=dummy)
        return _analyzer


def model_status() -> dict:
    a = get_analyzer()
    return {"dummy": a.dummy, "region_classifier": a.region_model is not None}


def _relative(path: str, base: Path) -> str:
    try:
        return Path(path).resolve().relative_to(base.resolve()).as_posix()
    except ValueError:
        return Path(path).name


def _to_results(rows: List[dict], base: Path) -> List[PredictionResult]:
    results = []
    for row in rows:
        data = {k: row.get(k) for k in REPORT_COLUMNS}
        data["path_to_study"] = _relative(row["path_to_study"], base)
        results.append(PredictionResult(**data))
    return results


def analyze_folder(folder: str | Path, visual_dir: str | Path | None = None) -> tuple[List[PredictionResult], List[dict]]:
    folder = Path(folder)
    analyzer = get_analyzer()
    with _lock:
        rows = analyzer.analyze_batch(folder, visual_dir=visual_dir)
        if not rows:
            rows = analyzer.analyze_study(folder, visual_dir=visual_dir)
        warnings = list(analyzer.warnings)
    for w in warnings:
        w["path_to_study"] = _relative(w["path_to_study"], folder)
    return _to_results(rows, folder), warnings
