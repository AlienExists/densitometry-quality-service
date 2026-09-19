"""
POST /predict — один DICOM-файл → xlsx с одной строкой результата.
"""
import os
import tempfile

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response

from api.services.preprocessor import process
from api.services.model_client import run_inference
from api.services.export import to_xlsx

router = APIRouter(tags=["predict"])


@router.post("/predict", summary="Один DICOM-файл → xlsx")
async def predict(file: UploadFile = File(..., description="DICOM-файл (.dcm)")):
    with tempfile.NamedTemporaryFile(suffix=".dcm", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        processed_path = process(tmp_path)                              # предобработка
        result = await run_inference(processed_path, file.filename)     # модель
    finally:
        os.unlink(tmp_path)

    xlsx = to_xlsx([result])                                            # таблица из 1 строки

    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=result.xlsx"},
    )
