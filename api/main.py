from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import predict, batch

app = FastAPI(
    title="",
    description="",
    version="",
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
    return {"status": "ok"}
