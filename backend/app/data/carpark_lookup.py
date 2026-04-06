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

# ---------------------------------------------------------------------------
# Shelter-determination helpers — one per dataset source
#
# Each helper encapsulates the shelter logic for a specific dataset so that
# adding a new source (e.g. LTA DataMall) only requires adding a new function
# here, without touching the rest of the lookup pipeline.
# ---------------------------------------------------------------------------

# HDB: only pure surface carparks are unsheltered; every other type (multi-
# storey, basement, covered, mechanised, surface/multi-storey) has a roof.
_HDB_UNSHELTERED_TYPES: frozenset[str] = frozenset({"SURFACE CAR PARK"})


# HDB Pricing Rule Sets
_CENTRAL_CARPARKS: frozenset[str] = frozenset({
    "ACB", "BBB", "BRB1", "CY", "DUXM", "HLM", "KAB", "KAM", 
    "KAS", "PRM", "SLS", "SR1", "SR2", "TPM", "UCS", "WCB"
})

_PEAK_CARPARKS: frozenset[str] = frozenset({
    "ACB", "CY", "SE21", "SE22", "SE24", "MP14", "MP15", 
    "MP16", "HG9", "HG9T", "HG15", "HG16"
})

def _is_sheltered_hdb(cp_type: str, basement: str) -> bool:
    """Return True if this HDB carpark type is covered/sheltered.

    The basement flag overrides the type check — a carpark flagged as
    basement is always sheltered regardless of its declared type.

    When LTA DataMall or another dataset is added, create a parallel
    ``_is_sheltered_<source>`` function using that dataset's own type
    vocabulary, then call it from the relevant loader.
    """
    if basement == "Y":
        return True
    return cp_type not in _HDB_UNSHELTERED_TYPES


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

            lookup[cp_no] = {
                **coords[cp_no],
                # Title-case the ALL-CAPS HDB address
                "address": row["address"].title(),
                "is_sheltered": _is_sheltered_hdb(cp_type, basement),
                "parking_system": row.get("type_of_parking_system", ""),
                "night_parking": row.get("night_parking", "NO") == "YES",
                "car_park_type": cp_type,
                "free_parking": row.get("free_parking", "NO"),
                "short_term_parking": row.get("short_term_parking", "NO"),
                "is_central": cp_no in _CENTRAL_CARPARKS,
                "is_peak": cp_no in _PEAK_CARPARKS,
            }

    return lookup


# Loaded once at import time — fast O(1) lookups at request time
CARPARK_LOOKUP: dict[str, dict] = _load()
