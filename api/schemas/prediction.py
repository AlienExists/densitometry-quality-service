from typing import Optional

from pydantic import BaseModel


class PredictionResult(BaseModel):
    path_to_study: str
    study_uid: str
    image_uid: str
    anatomical_region: str               # "Поясничный отдел позвоночника" | "Проксимальный отдел бедра" | "" при Failure
    quality_class: Optional[int] = None  # 0 — норма, 1 — нарушение; пусто при Failure
    quality_prob: Optional[float] = None # 0..1, согласован с quality_class (>= 0.5 <=> 1); пусто при Failure
    violation_type: Optional[str] = None # официальные названия через ";" или пусто
    processing_status: str               # "Success" | "Failure"
    time_of_processing: float            # секунды на снимок

    model_config = {"extra": "ignore"}
