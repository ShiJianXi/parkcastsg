import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]   # backend/
APP_DIR = BASE_DIR / "app"

# Load environment variables from .env file in development environments
environment = os.getenv("ENVIRONMENT", "development")
if environment != "production":
    load_dotenv()


class Settings:
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database
    DB_HOST: str = os.getenv("DB_HOST", "")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "")
    DB_USER: str = os.getenv("DB_USER", "")
    DB_PASS: str = os.getenv("DB_PASS", "")
    DB_SSL_MODE: str = os.getenv("DB_SSL_MODE", "verify-full")
    DB_SSL_ROOT_CERT: str = os.getenv(
        "DB_SSL_ROOT_CERT",
        str(BASE_DIR / "global-bundle.pem")
    )

    # CORS
    CORS_ALLOW_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
        if origin.strip()
    ]

    # Paths
    MODEL_DIR: Path = APP_DIR / "models"
    DATA_DIR: Path = APP_DIR / "data"

    FEATURE_COLS_FILE: Path = MODEL_DIR / "feature_cols.pkl"
    CATEGORICAL_COLS_FILE: Path = MODEL_DIR / "categorical_cols.pkl"
    STATIC_CARPARK_MAPPING_FILE: Path = DATA_DIR / "static_carpark_mapping.csv"

    # Multi-horizon models
    MODEL_FILES: dict[int, Path] = {
        15: MODEL_DIR / "lgbm_lots_available_15m.pkl",
        30: MODEL_DIR / "lgbm_lots_available_30m.pkl",
        60: MODEL_DIR / "lgbm_lots_available_60m.pkl",
    }

    @property
    def db_config(self) -> dict:
        config = {
            "host": self.DB_HOST,
            "port": self.DB_PORT,
            "database": self.DB_NAME,
            "user": self.DB_USER,
            "password": self.DB_PASS,
            "sslmode": self.DB_SSL_MODE,
        }

        if self.DB_SSL_MODE and self.DB_SSL_MODE != "disable":
            config["sslrootcert"] = self.DB_SSL_ROOT_CERT

        return config


settings = Settings()