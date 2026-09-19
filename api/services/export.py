"""
Собирает xlsx из списка результатов.

"""
import io
from typing import List
from api.schemas.prediction import PredictionResult

COLUMNS = [
    "path_to_study",
    "study_uid",
    "image_uid",
    "anatomical_region",
    "quality_class",
    "violation_type",
    "processing_status",
    "time_of_processing",
]


def to_xlsx(results: List[PredictionResult]) -> bytes:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Results"
    ws.append(COLUMNS)
    for r in results:
        ws.append([
            r.path_to_study,
            r.study_uid,
            r.image_uid,
            r.anatomical_region,
            r.quality_class,
            r.violation_type or "",
            r.processing_status,
            round(r.time_of_processing, 4),
        ])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
