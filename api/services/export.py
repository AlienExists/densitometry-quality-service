"""
Собирает xlsx из списка результатов. Колонки берутся из qc/contract.py,
чтобы порядок и названия всегда совпадали с тем, что выдаёт анализатор.
"""
import io
from typing import List

from api.services.model_client import REPORT_COLUMNS
from api.schemas.prediction import PredictionResult


def _rows_to_xlsx(header: List[str], rows: List[list]) -> bytes:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Results"
    ws.append(header)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_xlsx(results: List[PredictionResult]) -> bytes:
    rows = []
    for r in results:
        d = r.model_dump()
        d["violation_type"] = d["violation_type"] or ""
        rows.append([d[c] for c in REPORT_COLUMNS])
    return _rows_to_xlsx(list(REPORT_COLUMNS), rows)


def warnings_to_xlsx(warnings: List[dict]) -> bytes:
    if not warnings:
        return _rows_to_xlsx(["event"], [])
    header = list(warnings[0].keys())
    return _rows_to_xlsx(header, [[w.get(k) for k in header] for w in warnings])
