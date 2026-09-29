"""
POST /predict/batch          — ZIP-архив с исследованиями → xlsx (строка на каждый уникальный снимок).
POST /predict/batch/archive  — то же, но ответ — ZIP: report.xlsx, warnings.xlsx и картинки нарушений.
"""
import io
import os
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from api.batch.security import ZipSecurityError, validate_zip
from api.services.export import to_xlsx, warnings_to_xlsx
from api.services.model_client import analyze_folder

router = APIRouter(tags=["batch"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _extract(upload: UploadFile, tmpdir: str) -> Path:
    zip_path = os.path.join(tmpdir, "upload.zip")
    with open(zip_path, "wb") as f:
        f.write(await upload.read())
    data_dir = Path(tmpdir) / "data"
    try:
        validate_zip(zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(data_dir)
    except ZipSecurityError as e:
        raise HTTPException(status_code=400, detail=f"Архив отклонён: {e}")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Невалидный zip-архив")
    if not any(p.is_file() for p in data_dir.rglob("*")):
        raise HTTPException(status_code=422, detail="Архив пустой")
    return data_dir


@router.post("/predict/batch", summary="ZIP-архив с исследованиями → xlsx")
async def predict_batch(file: UploadFile = File(..., description="ZIP-архив с DICOM-исследованиями")):
    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = await _extract(file, tmpdir)
        results, _ = await run_in_threadpool(analyze_folder, data_dir)

    return Response(
        content=to_xlsx(results),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=results.xlsx"},
    )


@router.post("/predict/batch/archive", summary="ZIP-архив → ZIP с отчётом, предупреждениями и визуализациями")
async def predict_batch_archive(file: UploadFile = File(..., description="ZIP-архив с DICOM-исследованиями")):
    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = await _extract(file, tmpdir)
        visual_dir = Path(tmpdir) / "visual"
        results, warnings = await run_in_threadpool(analyze_folder, data_dir, visual_dir)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("report.xlsx", to_xlsx(results))
            zf.writestr("warnings.xlsx", warnings_to_xlsx(warnings))
            for png in sorted(visual_dir.glob("*.png")):
                zf.write(png, f"visual/{png.name}")

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=results.zip"},
    )
