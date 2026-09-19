from pydantic import BaseModel
from typing import Optional


class PredictionResult(BaseModel):
    path_to_study: str
    study_uid: str
    image_uid: str
    anatomical_region: str          # "lumbar_spine" | "proximal_femur" | "unknown"
    quality_class: int              # 0 — норма, 1 — нарушение
    violation_type: Optional[str]   # строка через точку с запятой или пусто
    processing_status: str          # "Success" | "Failure"
    time_of_processing: float       # секунды
