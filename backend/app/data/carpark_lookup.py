"""
Carpark static lookup table.

Merges two CSV files on startup to produce a fast in-memory dict:
  car_park_no -> { lat, lng, address, is_sheltered, parking_system, night_parking }

The HDBCarparkInformation.csv supplies address and feature flags.
The hdb_clean_coords.csv supplies WGS84 coordinates.
"""
from __future__ import annotations

import csv
from pathlib import Path

_DATA_DIR = Path(__file__).parent


def _load() -> dict[str, dict]:
    # --- lat/lng lookup ---
    coords: dict[str, dict] = {}
    with open(_DATA_DIR / "hdb_clean_coords.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            coords[row["carpark_id"]] = {
                "lat": float(row["latitude"]),
                "lng": float(row["longitude"]),
            }

    # --- merge with info CSV ---
    lookup: dict[str, dict] = {}
    with open(_DATA_DIR / "HDBCarparkInformation.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cp_no = row["car_park_no"]
            if cp_no not in coords:
                continue  # skip if no coordinates available

            cp_type = row.get("car_park_type", "")
            basement = row.get("car_park_basement", "N")
            is_sheltered = (
                basement == "Y"
                or cp_type in ("BASEMENT CAR PARK", "COVERED CAR PARK", "MECHANISED CAR PARK")
            )

            lookup[cp_no] = {
                **coords[cp_no],
                # Title-case the ALL-CAPS HDB address
                "address": row["address"].title(),
                "is_sheltered": is_sheltered,
                "parking_system": row.get("type_of_parking_system", ""),
                "night_parking": row.get("night_parking", "NO") == "YES",
                "car_park_type": cp_type,
            }

    return lookup


# Loaded once at import time — fast O(1) lookups at request time
CARPARK_LOOKUP: dict[str, dict] = _load()
