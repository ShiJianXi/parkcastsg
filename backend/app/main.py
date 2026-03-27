from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import carparks

app = FastAPI(title="ParkCast SG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(carparks.router, prefix="/api/v1")
