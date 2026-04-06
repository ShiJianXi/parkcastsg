from __future__ import annotations

import asyncio
import logging
import os
from math import atan2, cos, radians, sin, sqrt

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from app.data.carpark_lookup import CARPARK_LOOKUP
from app.data.lta_rates_lookup import lookup_rate

router = APIRouter()

HDB_AVAILABILITY_URL = "https://api.data.gov.sg/v1/transport/carpark-availability"
LTA_AVAILABILITY_URL = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2"

load_dotenv()
LTA_API_KEY = os.getenv("LTA_API_KEY") or ""  # empty string is treated as "not configured"

# Prefix used to distinguish LTA carpark IDs from HDB carpark numbers
LTA_ID_PREFIX = "LTA_"

# Agencies already covered by the HDB dataset — skip to avoid duplicates
_HDB_AGENCIES: frozenset[str] = frozenset({"HDB"})


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class CarparkAvailability(BaseModel):
    id: str
    name: str
    address: str
    lat: float
    lng: float
    available_lots: int
    total_lots: int
    crowd_level: str  # "low" | "medium" | "high" | "full"
    is_sheltered: bool
    distance: int  # metres from the query point
    night_parking: bool
    car_park_type: str  # e.g. "MULTI-STOREY CAR PARK", "SURFACE CAR PARK"
    source: str  # "hdb" | "lta"
    # Rate fields — populated for LTA carparks when CarparkRates.csv has a match;
    # None means "no data available" (will render as "see operator" in the UI).
    weekdays_rate_1: str | None = None
    weekdays_rate_2: str | None = None
    saturday_rate: str | None = None
    sunday_ph_rate: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two WGS84 points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _crowd_level(available: int, total: int) -> str:
    if total == 0:
        return "full"
    ratio = available / total
    if available == 0:
        return "full"
    if ratio > 0.5:
        return "low"
    if ratio > 0.2:
        return "medium"
    return "high"


def _crowd_level_absolute(available: int) -> str:
    """Crowd level based on absolute lot count (used when total lots are unknown)."""
    if available == 0:
        return "full"
    if available > 50:
        return "low"
    if available > 20:
        return "medium"
    return "high"


def _parse_lta_location(location: str) -> tuple[float, float] | None:
    """Parse an LTA 'lat lng' space-separated location string."""
    parts = location.strip().split()
    if len(parts) != 2:
        return None
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        return None


def _rate_field(value: str) -> str | None:
    """Return the rate string, or None if the field contains no useful data."""
    v = value.strip()
    return None if v in ("-", "") else v


# ---------------------------------------------------------------------------
# Data-source helpers
# ---------------------------------------------------------------------------


async def _fetch_hdb_carparks(lat: float, lng: float, radius: int) -> list[CarparkAvailability]:
    """Fetch HDB carparks within radius from data.gov.sg."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(HDB_AVAILABILITY_URL)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HDB API error: {exc}") from exc

    try:
        data = resp.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected HDB API response: invalid JSON ({exc})",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="Unexpected HDB API response: top-level JSON is not an object",
        )

    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise HTTPException(
            status_code=502,
            detail="Unexpected HDB API response: 'items' list is missing or empty",
        )

    first_item = items[0]
    if not isinstance(first_item, dict) or "carpark_data" not in first_item:
        raise HTTPException(
            status_code=502,
            detail="Unexpected HDB API response: 'carpark_data' is missing",
        )

    carpark_data = first_item["carpark_data"]
    if not isinstance(carpark_data, list):
        raise HTTPException(
            status_code=502,
            detail="Unexpected HDB API response: 'carpark_data' is not a list",
        )

    results: list[CarparkAvailability] = []
    for cp in carpark_data:
        cp_no: str = cp.get("carpark_number", "")
        info = CARPARK_LOOKUP.get(cp_no)
        if info is None:
            continue  # not in our HDB info dataset

        dist = _haversine(lat, lng, info["lat"], info["lng"])
        if dist > radius:
            continue

        # Sum across all lot types (C = Car, Y = Motorcycle, H = Heavy)
        cp_info_list: list[dict] = cp.get("carpark_info", [])
        available = sum(int(x.get("lots_available", 0)) for x in cp_info_list)
        total = sum(int(x.get("total_lots", 0)) for x in cp_info_list)

        results.append(
            CarparkAvailability(
                id=cp_no,
                name=f"HDB {cp_no}",
                address=info["address"],
                lat=info["lat"],
                lng=info["lng"],
                available_lots=available,
                total_lots=total,
                crowd_level=_crowd_level(available, total),
                is_sheltered=info["is_sheltered"],
                distance=round(dist),
                night_parking=info["night_parking"],
                car_park_type=info.get("car_park_type", ""),
                source="hdb",
            )
        )

    return results


async def _fetch_lta_carparks(lat: float, lng: float, radius: int) -> list[CarparkAvailability]:
    """Fetch non-HDB carparks from LTA DataMall within radius.

    Returns an empty list if LTA_API_KEY is unset or if the upstream request
    fails, so the calling endpoint degrades gracefully to HDB-only results.
    """
    if not LTA_API_KEY:
        logging.warning("LTA_API_KEY not configured; skipping LTA carparks")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                LTA_AVAILABILITY_URL,
                headers={"AccountKey": LTA_API_KEY, "accept": "application/json"},
            )
            resp.raise_for_status()
    except httpx.HTTPError:
        return []  # degrade gracefully

    try:
        data = resp.json()
    except ValueError:
        return []

    if not isinstance(data, dict) or not isinstance(data.get("value"), list):
        return []

    # Group by CarParkID, summing car lots only (LotType "C").
    # The LTA API returns one row per LotType per carpark, so grouping is needed.
    groups: dict[str, dict] = {}

    for entry in data["value"]:
        if not isinstance(entry, dict):
            continue
        if entry.get("Agency", "") in _HDB_AGENCIES:
            continue  # already covered by the HDB dataset
        if entry.get("LotType", "") != "C":
            continue  # only count car lots

        cp_id = str(entry.get("CarParkID", "")).strip()
        if not cp_id:
            continue

        coords = _parse_lta_location(entry.get("Location", ""))
        if coords is None:
            continue

        cp_lat, cp_lng = coords
        dist = _haversine(lat, lng, cp_lat, cp_lng)
        if dist > radius:
            continue

        available = int(entry.get("AvailableLots", 0))
        development = entry.get("Development", "").strip()
        prefixed_id = f"{LTA_ID_PREFIX}{cp_id}"

        if prefixed_id in groups:
            groups[prefixed_id]["available_lots"] += available
        else:
            rates = lookup_rate(development) or {}
            groups[prefixed_id] = {
                "id": prefixed_id,
                "name": development or f"Carpark {cp_id}",
                "address": development or f"Carpark {cp_id}",
                "lat": cp_lat,
                "lng": cp_lng,
                "available_lots": available,
                "total_lots": 0,  # LTA API does not provide total lots
                "is_sheltered": True,  # LTA API does not expose shelter info; default to True (commercial carparks are typically covered)
                "distance": round(dist),
                "night_parking": True,  # LTA API does not expose night-parking info; default to True to avoid hiding options
                "car_park_type": "CAR PARK",
                "source": "lta",
                "weekdays_rate_1": _rate_field(rates.get("weekdays_rate_1", "")),
                "weekdays_rate_2": _rate_field(rates.get("weekdays_rate_2", "")),
                "saturday_rate": _rate_field(rates.get("saturday_rate", "")),
                "sunday_ph_rate": _rate_field(rates.get("sunday_ph_rate", "")),
            }

    return [
        CarparkAvailability(**g, crowd_level=_crowd_level_absolute(g["available_lots"]))
        for g in groups.values()
    ]


async def _get_hdb_carpark(
    carpark_id: str, lat: float | None, lng: float | None
) -> CarparkAvailability:
    info = CARPARK_LOOKUP.get(carpark_id)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Carpark '{carpark_id}' not found")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(HDB_AVAILABILITY_URL)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HDB API error: {exc}") from exc

    carpark_data: list[dict] = resp.json()["items"][0]["carpark_data"]
    cp = next((c for c in carpark_data if c.get("carpark_number") == carpark_id), None)
    if cp is None:
        raise HTTPException(
            status_code=502,
            detail=f"HDB API did not return availability for carpark '{carpark_id}'",
        )

    available = 0
    total = 0
    for lot in cp.get("carpark_info", []):
        available += int(lot.get("lots_available", 0))
        total += int(lot.get("total_lots", 0))

    dist = 0
    if lat is not None and lng is not None:
        dist = _haversine(lat, lng, info["lat"], info["lng"])

    return CarparkAvailability(
        id=carpark_id,
        name=f"HDB {carpark_id}",
        address=info["address"],
        lat=info["lat"],
        lng=info["lng"],
        available_lots=available,
        total_lots=total,
        crowd_level=_crowd_level(available, total),
        is_sheltered=info["is_sheltered"],
        distance=round(dist),
        night_parking=info["night_parking"],
        car_park_type=info.get("car_park_type", ""),
        source="hdb",
    )


async def _get_lta_carpark(
    carpark_id: str, lat: float | None, lng: float | None
) -> CarparkAvailability:
    """Fetch a single LTA carpark by its prefixed ID (e.g. 'LTA_B0020')."""
    if not LTA_API_KEY:
        raise HTTPException(
            status_code=404,
            detail=f"LTA carpark '{carpark_id}' not found (LTA_API_KEY not configured)",
        )

    raw_id = carpark_id[len(LTA_ID_PREFIX):]  # strip the LTA_ prefix

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                LTA_AVAILABILITY_URL,
                headers={"AccountKey": LTA_API_KEY, "accept": "application/json"},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"LTA API error: {exc}") from exc

    try:
        data = resp.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"LTA API returned invalid JSON: {exc}") from exc

    if not isinstance(data, dict) or not isinstance(data.get("value"), list):
        raise HTTPException(status_code=502, detail="Unexpected LTA API response shape")

    # Collect all car-lot entries for this carpark ID
    entries = [
        e for e in data["value"]
        if isinstance(e, dict)
        and str(e.get("CarParkID", "")).strip() == raw_id
        and e.get("LotType") == "C"
    ]
    if not entries:
        raise HTTPException(
            status_code=404,
            detail=f"LTA carpark '{carpark_id}' not found in availability data",
        )

    entry = entries[0]
    coords = _parse_lta_location(entry.get("Location", ""))
    if coords is None:
        raise HTTPException(status_code=502, detail="LTA API returned invalid location data")

    cp_lat, cp_lng = coords
    development = entry.get("Development", "").strip()
    available = sum(int(e.get("AvailableLots", 0)) for e in entries)

    dist = 0
    if lat is not None and lng is not None:
        dist = _haversine(lat, lng, cp_lat, cp_lng)

    rates = lookup_rate(development) or {}

    return CarparkAvailability(
        id=carpark_id,
        name=development or f"Carpark {raw_id}",
        address=development or f"Carpark {raw_id}",
        lat=cp_lat,
        lng=cp_lng,
        available_lots=available,
        total_lots=0,  # LTA API does not provide total lots
        crowd_level=_crowd_level_absolute(available),
        is_sheltered=True,  # LTA API does not expose shelter info; default to True
        distance=round(dist),
        night_parking=True,  # LTA API does not expose night-parking info; default to True
        car_park_type="CAR PARK",
        source="lta",
        weekdays_rate_1=_rate_field(rates.get("weekdays_rate_1", "")),
        weekdays_rate_2=_rate_field(rates.get("weekdays_rate_2", "")),
        saturday_rate=_rate_field(rates.get("saturday_rate", "")),
        sunday_ph_rate=_rate_field(rates.get("sunday_ph_rate", "")),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/carparks/nearby", response_model=list[CarparkAvailability])
async def get_nearby_carparks(lat: float, lng: float, radius: int = 500):
    """
    Return HDB and LTA carparks within `radius` metres of (lat, lng) with live
    availability. LTA results require LTA_API_KEY to be configured; if it is
    absent the endpoint returns HDB-only results.
    """
    hdb_results, lta_results = await asyncio.gather(
        _fetch_hdb_carparks(lat, lng, radius),
        _fetch_lta_carparks(lat, lng, radius),
    )
    results = hdb_results + lta_results
    results.sort(key=lambda x: x.distance)
    return results


@router.get("/carparks/{carpark_id}", response_model=CarparkAvailability)
async def get_carpark(carpark_id: str, lat: float | None = None, lng: float | None = None):
    """
    Return a single carpark's live availability by ID.
    HDB carparks use their carpark number (e.g. 'ACB').
    LTA carparks use the 'LTA_' prefix (e.g. 'LTA_B0020').
    """
    normalised = carpark_id.upper()
    if normalised.startswith(LTA_ID_PREFIX):
        return await _get_lta_carpark(normalised, lat, lng)
    return await _get_hdb_carpark(normalised, lat, lng)
