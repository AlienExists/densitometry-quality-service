from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import batch, predict
from api.services.model_client import get_analyzer, model_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_analyzer()
    yield


app = FastAPI(
    title="Контроль качества денситометрии",
    description="Определение анатомической области, качества снимка и типа нарушения по DICOM",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(batch.router)


@app.get("/health")
async def health():
    return {"status": "ok", "model": model_status()}
