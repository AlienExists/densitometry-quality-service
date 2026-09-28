from typing import Optional
from pydantic import BaseModel
 
 
class PredictionResult(BaseModel):
    path_to_study: str
    study_uid: str
    image_uid: str
    anatomical_region: str
    quality_class: int
    violation_type: Optional[str] = None
    processing_status: str
    time_of_processing: float
 
    model_config = {"extra": "ignore"}
 