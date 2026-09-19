"""
POST /predict/batch — ZIP-архив с DICOM-файлами → xlsx с N строками результатов.
"""
import os
import zipfile
import tempfile
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

from api.services.preprocessor import process
from api.services.model_client import run_inference
from api.services.export import to_xlsx
from api.schemas.prediction import PredictionResult

router = APIRouter(tags=["batch"])


@router.post("/predict/batch", summary="ZIP-архив с DICOM-файлами")
async def predict_batch(file: UploadFile = File(..., description="ZIP-архив с .dcm файлами")):
    with tempfile.TemporaryDirectory() as tmpdir:

        # 1. Сохраняем zip
        zip_path = os.path.join(tmpdir, "upload.zip")
        with open(zip_path, "wb") as f:
            f.write(await file.read())

        # 2. Распаковываем
        try:
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(tmpdir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Невалидный zip-архив")

        # 3. Находим все .dcm файлы
        dcm_files = [
            os.path.join(root, f)
            for root, _, files in os.walk(tmpdir)
            for f in files
            if f.endswith(".dcm")
        ]

        if not dcm_files:
            raise HTTPException(status_code=422, detail="В архиве не найдено .dcm файлов")

        # 4. Для каждого файла: предобработка → модель
        results: List[PredictionResult] = []
        for dcm_path in dcm_files:
            processed_path = process(dcm_path)
            result = await run_inference(processed_path, original_filename=os.path.basename(dcm_path))
            results.append(result)

        # 5. Собираем xlsx и возвращаем
        xlsx = to_xlsx(results)

    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=results.xlsx"},
    )
