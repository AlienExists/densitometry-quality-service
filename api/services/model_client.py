"""
Отправляет обработанный файл в модель, возвращает PredictionResult.
"""
import asyncio
from api.schemas.prediction import PredictionResult


async def run_inference(file_path: str, original_filename: str) -> PredictionResult:
    
    await asyncio.sleep(0.1)
    return PredictionResult(
        path_to_study=original_filename,
        study_uid="stub-study-uid",
        image_uid="stub-image-uid",
        anatomical_region="lumbar_spine",
        quality_class=0,
        violation_type=None,
        processing_status="Success",
        time_of_processing=0.1,
    )

