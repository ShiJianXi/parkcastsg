from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api import carparks, weather, prediction

cors_allow_origins_env = os.getenv("CORS_ALLOW_ORIGINS")
if cors_allow_origins_env:
    allowed_origins = [
        origin.strip()
        for origin in cors_allow_origins_env.split(",")
        if origin.strip()
    ]
else:
    allowed_origins = ["http://localhost:5173"]

app = FastAPI(title="ParkCast SG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(carparks.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(prediction.router, prefix="/api/v1")
