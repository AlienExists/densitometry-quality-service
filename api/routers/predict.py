"""
POST /predict — один DICOM-файл → xlsx с одной строкой результата.
"""
import os
import tempfile

from fastapi import APIRouter, File, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from api.services.export import to_xlsx
from api.services.model_client import analyze_folder

router = APIRouter(tags=["predict"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/predict", summary="Один DICOM-файл → xlsx")
async def predict(file: UploadFile = File(..., description="DICOM-файл (.dcm)")):
    with tempfile.TemporaryDirectory() as tmpdir:
        name = os.path.basename(file.filename or "upload.dcm") or "upload.dcm"
        with open(os.path.join(tmpdir, name), "wb") as f:
            f.write(await file.read())
        results, _ = await run_in_threadpool(analyze_folder, tmpdir)

    return Response(
        content=to_xlsx(results),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=result.xlsx"},
    )
