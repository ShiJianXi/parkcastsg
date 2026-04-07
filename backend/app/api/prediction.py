from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import joblib
import pandas as pd
import psycopg2
from fastapi import APIRouter, HTTPException

from app.core.config import settings


router = APIRouter(tags=["prediction"])


# ----------------------------
# Startup-time resources
# ----------------------------
models_by_horizon: dict[int, Any] = {
    horizon: joblib.load(path) for horizon, path in settings.MODEL_FILES.items()
}

feature_cols = joblib.load(settings.FEATURE_COLS_FILE)
categorical_cols = joblib.load(settings.CATEGORICAL_COLS_FILE)

static_mapping_df = pd.read_csv(settings.STATIC_CARPARK_MAPPING_FILE)
static_mapping_df["carpark_number"] = static_mapping_df["carpark_number"].astype(str)

STATIC_CARPARK_MAP: dict[str, dict[str, Any]] = {
    row["carpark_number"]: {
        "area": row["area"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
    }
    for _, row in static_mapping_df.iterrows()
}


# ----------------------------
# Helper functions
# ----------------------------
def api_error(
    status_code: int, error_code: str, message: str, carpark_number: str | None = None
):
    detail = {
        "error_code": error_code,
        "message": message,
    }
    if carpark_number is not None:
        detail["carpark_number"] = carpark_number

    raise HTTPException(status_code=status_code, detail=detail)


def get_db_connection():
    return psycopg2.connect(**settings.db_config)


def get_time_period(hour: int) -> str:
    if 6 <= hour < 12:
        return "morning"
    elif 12 <= hour < 18:
        return "afternoon"
    elif 18 <= hour < 24:
        return "evening"
    else:
        return "night"


def preprocess_one_record(record: dict) -> pd.DataFrame:
    df = pd.DataFrame([record]).copy()

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["is_weekend"] = (df["timestamp"].dt.dayofweek >= 5).astype(int)
    df["time_period"] = df["timestamp"].dt.hour.apply(get_time_period)

    numeric_fill_values = {
        "lots_available": 0,
        "total_lots": 0,
        "latitude": -1,
        "longitude": -1,
        "is_weekend": 0,
    }

    for col, default_val in numeric_fill_values.items():
        if col in df.columns:
            df[col] = df[col].fillna(default_val)

    for col in feature_cols:
        if col not in df.columns:
            if col in categorical_cols:
                df[col] = "Unknown"
            else:
                df[col] = 0

    for col in categorical_cols:
        if col in df.columns:
            df[col] = df[col].astype("category")

    df = df[feature_cols]
    return df


def predict_one(record: dict, model: Any) -> dict:
    X = preprocess_one_record(record)
    pred_lots = float(model.predict(X)[0])

    total_lots = record.get("total_lots", 0) or 0

    if pred_lots < 0:
        pred_lots = 0.0

    if total_lots > 0 and pred_lots > total_lots:
        pred_lots = float(total_lots)

    if total_lots <= 0:
        pred_occ = 0.0
    else:
        pred_occ = 1.0 - (pred_lots / total_lots)
        pred_occ = max(0.0, min(1.0, pred_occ))

    return {
        "predicted_available_lots": pred_lots,
        "predicted_occupancy_rate": pred_occ,
    }


def get_static_mapping(carpark_number: str) -> dict[str, Any]:
    mapping = STATIC_CARPARK_MAP.get(carpark_number)
    if not mapping:
        api_error(
            status_code=404,
            error_code="MAPPING_NOT_FOUND",
            message="Static mapping not found for this carpark.",
            carpark_number=carpark_number,
        )
    return mapping


def get_latest_carpark_rows(carpark_number: str) -> list[dict[str, Any]]:
    query = """
        SELECT query_datetime, carpark_number, lot_type, total_lots, lots_available
        FROM hdb_availability_dynamic
        WHERE carpark_number = %s
          AND query_datetime = (
              SELECT MAX(query_datetime)
              FROM hdb_availability_dynamic
              WHERE carpark_number = %s
          )
        ORDER BY lot_type;
    """

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, (carpark_number, carpark_number))
        rows = cur.fetchall()
        cur.close()

        if not rows:
            api_error(
                status_code=404,
                error_code="AVAILABILITY_NOT_FOUND",
                message="No availability data found for this carpark.",
                carpark_number=carpark_number,
            )

        results = []
        for row in rows:
            results.append(
                {
                    "timestamp": row[0],
                    "carpark_number": row[1],
                    "lot_type": row[2],
                    "total_lots": row[3],
                    "lots_available": row[4],
                }
            )
        return results
    finally:
        if conn:
            conn.close()


def get_weather_for_area(
    area: str, timestamp: datetime, carpark_number: str | None = None
) -> str:
    query = """
        SELECT forecast
        FROM weather_dynamic_full
        WHERE area = %s
          AND update_timestamp <= %s
        ORDER BY update_timestamp DESC
        LIMIT 1;
    """

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, (area, timestamp))
        row = cur.fetchone()
        cur.close()

        if not row:
            api_error(
                status_code=404,
                error_code="WEATHER_NOT_FOUND",
                message="No weather data found for this carpark area.",
                carpark_number=carpark_number,
            )

        return row[0]
    finally:
        if conn:
            conn.close()


def is_invalid_lot_row(row: dict[str, Any]) -> bool:
    total_lots = row.get("total_lots")
    lots_available = row.get("lots_available")

    if total_lots is None or lots_available is None:
        return True
    if total_lots <= 1:
        return True
    if lots_available < 0:
        return True
    if lots_available > total_lots:
        return True
    return False


def build_prediction_record(
    row: dict[str, Any],
    mapping: dict[str, Any],
    weather_used: str,
    timestamp_used: datetime,
) -> dict[str, Any]:
    return {
        "carpark_number": row["carpark_number"],
        "lot_type": row["lot_type"],
        "timestamp": timestamp_used,
        "area": mapping["area"],
        "weather": weather_used,
        "lots_available": row["lots_available"],
        "total_lots": row["total_lots"],
        "latitude": mapping["latitude"],
        "longitude": mapping["longitude"],
    }


def predict_for_horizon(
    horizon_minutes: int,
    model: Any,
    valid_rows: list[dict[str, Any]],
    mapping: dict[str, Any],
    weather_used: str,
    timestamp_used: datetime,
) -> dict[str, Any]:
    by_lot_type = []

    for row in valid_rows:
        record = build_prediction_record(
            row=row,
            mapping=mapping,
            weather_used=weather_used,
            timestamp_used=timestamp_used,
        )
        pred = predict_one(record, model)

        by_lot_type.append(
            {
                "lot_type": row["lot_type"],
                "predicted_available_lots": pred["predicted_available_lots"],
                "predicted_occupancy_rate": pred["predicted_occupancy_rate"],
            }
        )

    return {
        "horizon_minutes": horizon_minutes,
        "by_lot_type": by_lot_type,
    }


# ----------------------------
# Route
# ----------------------------
@router.get("/carparks/{carpark_number}/prediction")
def predict_carpark(carpark_number: str):
    try:
        generated_at = datetime.now(ZoneInfo("Asia/Singapore"))

        mapping = get_static_mapping(carpark_number)
        carpark_rows = get_latest_carpark_rows(carpark_number)
        weather_used = get_weather_for_area(
            mapping["area"], generated_at, carpark_number=carpark_number
        )

        valid_rows = [row for row in carpark_rows if not is_invalid_lot_row(row)]

        if not valid_rows:
            api_error(
                status_code=422,
                error_code="INSUFFICIENT_LOTS_INFO",
                message="Lot information is insufficient for prediction.",
                carpark_number=carpark_number,
            )

        predictions = []
        for horizon_minutes in sorted(models_by_horizon.keys()):
            model = models_by_horizon[horizon_minutes]
            prediction_item = predict_for_horizon(
                horizon_minutes=horizon_minutes,
                model=model,
                valid_rows=valid_rows,
                mapping=mapping,
                weather_used=weather_used,
                timestamp_used=generated_at,
            )
            predictions.append(prediction_item)

        return {
            "carpark_number": carpark_number,
            "generated_at": generated_at,
            "predictions": predictions,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        api_error(
            status_code=500,
            error_code="INTERNAL_PREDICTION_ERROR",
            message=f"An internal error occurred during prediction: {str(e)}",
            carpark_number=carpark_number,
        )
