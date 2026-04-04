from __future__ import annotations

from datetime import datetime
from typing import Any

import joblib
import pandas as pd
import psycopg2
from fastapi import APIRouter, HTTPException

from app.core.config import settings


router = APIRouter(tags=["prediction"])


# ----------------------------
# Startup-time resources
# ----------------------------
model = joblib.load(settings.MODEL_FILE)
feature_cols = joblib.load(settings.FEATURE_COLS_FILE)
categorical_cols = joblib.load(settings.CATEGORICAL_COLS_FILE)

static_mapping_df = pd.read_csv(settings.STATIC_CARPARK_MAPPING_FILE)
static_mapping_df["carpark_number"] = static_mapping_df["carpark_number"].astype(str)

# 转成 dict，查找更方便
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


def predict_one(record: dict) -> dict:
    X = preprocess_one_record(record)
    pred_lots = float(model.predict(X)[0])

    total_lots = record.get("total_lots", 0) or 0
    if total_lots <= 0:
        pred_occ = 0.0
    else:
        pred_occ = pred_lots / total_lots
        pred_occ = max(0.0, min(1.0, pred_occ))

    return {
        "predicted_available_lots": pred_lots,
        "predicted_occupancy_rate": pred_occ,
    }


def get_static_mapping(carpark_number: str) -> dict[str, Any]:
    mapping = STATIC_CARPARK_MAP.get(carpark_number)
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail=f"Static mapping not found for carpark_number={carpark_number}",
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
            raise HTTPException(
                status_code=404,
                detail=f"No availability data found for carpark_number={carpark_number}",
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


def get_weather_for_area(area: str, timestamp: datetime) -> str:
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
            raise HTTPException(
                status_code=404,
                detail=f"No weather data found for area={area} before timestamp={timestamp}",
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


# ----------------------------
# Route
# ----------------------------
@router.get("/carparks/{carpark_number}/prediction")
def predict_carpark(carpark_number: str):
    mapping = get_static_mapping(carpark_number)
    carpark_rows = get_latest_carpark_rows(carpark_number)

    if not carpark_rows:
        raise HTTPException(status_code=404, detail="No carpark rows found.")

    timestamp_used = carpark_rows[0]["timestamp"]
    weather_used = get_weather_for_area(mapping["area"], timestamp_used)

    by_lot_type = []
    total_predicted_available_lots = 0.0
    total_total_lots = 0

    for row in carpark_rows:
        if is_invalid_lot_row(row):
            by_lot_type.append(
                {
                    "lot_type": row["lot_type"],
                    "status": "skipped",
                    "reason": "invalid lot data",
                    "current_total_lots": row["total_lots"],
                    "current_lots_available": row["lots_available"],
                }
            )
            continue

        record = {
            "carpark_number": row["carpark_number"],
            "lot_type": row["lot_type"],
            "timestamp": row["timestamp"],
            "area": mapping["area"],
            "weather": weather_used,
            "lots_available": row["lots_available"],
            "total_lots": row["total_lots"],
            "latitude": mapping["latitude"],
            "longitude": mapping["longitude"],
        }

        pred = predict_one(record)

        total_predicted_available_lots += pred["predicted_available_lots"]
        total_total_lots += row["total_lots"]

        by_lot_type.append(
            {
                "lot_type": row["lot_type"],
                "status": "predicted",
                "current_total_lots": row["total_lots"],
                "current_lots_available": row["lots_available"],
                "predicted_available_lots": pred["predicted_available_lots"],
                "predicted_occupancy_rate": pred["predicted_occupancy_rate"],
            }
        )

    if total_total_lots > 0:
        predicted_occupancy_rate_total = total_predicted_available_lots / total_total_lots
        predicted_occupancy_rate_total = max(0.0, min(1.0, predicted_occupancy_rate_total))
    else:
        predicted_occupancy_rate_total = 0.0

    return {
        "carpark_number": carpark_number,
        "area": mapping["area"],
        "latitude": mapping["latitude"],
        "longitude": mapping["longitude"],
        "timestamp_used": timestamp_used,
        "weather_used": weather_used,
        "predicted_available_lots_total": total_predicted_available_lots,
        "predicted_occupancy_rate_total": predicted_occupancy_rate_total,
        "by_lot_type": by_lot_type,
    }