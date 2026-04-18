from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import os
import joblib
import pandas as pd
import psycopg2
import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.data.lta_carpark_lookup import LTA_CARPARK_LOOKUP


router = APIRouter(tags=["prediction"])

LTA_AVAILABILITY_URL = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2"
LTA_API_KEY = os.getenv("LTA_API_KEY") or ""
LTA_ID_PREFIX = "LTA_"


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
    norm_id = carpark_number.strip().upper()

    # LTA Carparks
    if norm_id.startswith(LTA_ID_PREFIX):
        raw_id = norm_id[len("LTA_"):]
        info = LTA_CARPARK_LOOKUP.get(raw_id)
        if not info:
             api_error(
                status_code=404,
                error_code="LTA_MAPPING_NOT_FOUND",
                message="LTA static mapping not found for this carpark.",
                carpark_number=norm_id,
            )
        return {
            "area": info.get("area", "Central"),
            "latitude": info["lat"],
            "longitude": info["lng"],
        }
    
    # HDB Carparks
    mapping = STATIC_CARPARK_MAP.get(norm_id)
    if not mapping:
        api_error(
            status_code=404,
            error_code="MAPPING_NOT_FOUND",
            message=f"Static mapping not found for '{norm_id}'.",
            carpark_number=norm_id,
        )
    return mapping


def get_lta_latest_rows(carpark_number: str) -> list[dict[str, Any]]:
    """Fetch live availability from LTA DataMall for prediction input."""
    raw_id = carpark_number[len(LTA_ID_PREFIX):]
    
    if not LTA_API_KEY:
        api_error(
            status_code=503,
            error_code="LTA_SERVICE_UNAVAILABLE",
            message="LTA API Key not configured.",
            carpark_number=carpark_number,
        )

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                LTA_AVAILABILITY_URL,
                headers={"AccountKey": LTA_API_KEY, "accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
         api_error(
            status_code=502,
            error_code="LTA_API_ERROR",
            message=f"LTA API error: {str(exc)}",
            carpark_number=carpark_number,
        )

    if not isinstance(data, dict) or not isinstance(data.get("value"), list):
        api_error(
            status_code=502,
            error_code="LTA_RESPONSE_INVALID",
            message="Unexpected LTA API response shape",
            carpark_number=carpark_number,
        )

    # Filter for this carpark
    relevant_entries = [
        e for e in data["value"]
        if str(e.get("CarParkID", "")).strip() == raw_id
    ]

    if not relevant_entries:
         api_error(
            status_code=404,
            error_code="LTA_AVAILABILITY_NOT_FOUND",
            message="No live availability data found for this LTA carpark.",
            carpark_number=carpark_number,
        )

    results = []
    generated_at = datetime.now(ZoneInfo("Asia/Singapore"))
    for e in relevant_entries:
        lot_type = e.get("LotType", "C")
        # LTA doesn't always provide total lots, but ML model needs it.
        # We can try to use a reasonable default or 0.
        results.append({
            "timestamp": generated_at,
            "carpark_number": carpark_number,
            "lot_type": lot_type,
            "total_lots": 0, # Note: inference logic handles 0 total lots
            "lots_available": int(e.get("AvailableLots", 0)),
        })
    return results


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
    cp_num = str(row.get("carpark_number", ""))

    if total_lots is None or lots_available is None:
        return True
    
    # HDB always provides total_lots > 1. 
    # LTA (live API) only provides available_lots (total_lots is set to 0).
    if not cp_num.startswith(LTA_ID_PREFIX):
        if total_lots <= 1:
            return True
        if lots_available > total_lots:
            return True
            
    if lots_available < 0:
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
    carpark_number = carpark_number.strip().upper()
    if carpark_number.startswith("LTA_") or carpark_number.startswith("SUPP_"):
        api_error(
            status_code=422,
            error_code="PREDICTION_NOT_SUPPORTED_FOR_NON_HDB",
            message="Predictions are currently available for HDB carparks only.",
            carpark_number=carpark_number,
        )

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
