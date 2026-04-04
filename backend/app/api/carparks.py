from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.data.carpark_lookup import CARPARK_LOOKUP

router = APIRouter()

HDB_AVAILABILITY_URL = "https://api.data.gov.sg/v1/transport/carpark-availability"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class CarparkAvailability(BaseModel):
    id: str
    name: str
    address: str
    lat: float
    lng: float
    available_lots: int       # lots for the requested vehicle type
    total_lots: int           # total lots for the requested vehicle type
    car_lots_available: int
    car_lots_total: int
    motorcycle_lots_available: int
    motorcycle_lots_total: int
    crowd_level: str  # "low" | "medium" | "high" | "full"
    is_sheltered: bool
    distance: int  # metres from the query point
    night_parking: bool


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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def _lot_type_for(vehicle_type: str) -> str:
    """Map vehicle_type ('car' | 'motorcycle') to HDB lot_type code."""
    return "Y" if vehicle_type == "motorcycle" else "C"


@router.get("/carparks/nearby", response_model=list[CarparkAvailability])
async def get_nearby_carparks(
    lat: float,
    lng: float,
    radius: int = 500,
    vehicle_type: Literal["car", "motorcycle"] = "car",
):
    """
    Return HDB carparks within `radius` metres of (lat, lng) with live
    availability from data.gov.sg.

    Both car (lot type **C**) and motorcycle (lot type **Y**) lot counts are
    always returned.  ``vehicle_type`` determines which type's counts are used
    for ``available_lots``/``total_lots`` and the ``crowd_level`` calculation.
    """
    # 1. Fetch live availability snapshot
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(HDB_AVAILABILITY_URL)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HDB API error: {exc}") from exc

    # Validate response shape from HDB API
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
    # 2. Filter by distance and enrich with static info
    lot_type = _lot_type_for(vehicle_type)
    results: list[CarparkAvailability] = []
    for cp in carpark_data:
        cp_no: str = cp.get("carpark_number", "")
        info = CARPARK_LOOKUP.get(cp_no)
        if info is None:
            continue  # not in our HDB info dataset

        dist = _haversine(lat, lng, info["lat"], info["lng"])
        if dist > radius:
            continue

        # Compute lot counts by vehicle type
        all_lots: list[dict] = cp.get("carpark_info", [])
        car_lots = [x for x in all_lots if x.get("lot_type") == "C"]
        moto_lots = [x for x in all_lots if x.get("lot_type") == "Y"]

        car_available = sum(int(x.get("lots_available", 0)) for x in car_lots)
        car_total = sum(int(x.get("total_lots", 0)) for x in car_lots)
        moto_available = sum(int(x.get("lots_available", 0)) for x in moto_lots)
        moto_total = sum(int(x.get("total_lots", 0)) for x in moto_lots)

        # Skip carparks with no lot data at all
        if car_total == 0 and moto_total == 0:
            continue

        # available_lots / total_lots reflect the selected vehicle type
        if lot_type == "Y":
            available, total = moto_available, moto_total
        else:
            available, total = car_available, car_total

        results.append(
            CarparkAvailability(
                id=cp_no,
                name=f"HDB {cp_no}",
                address=info["address"],
                lat=info["lat"],
                lng=info["lng"],
                available_lots=available,
                total_lots=total,
                car_lots_available=car_available,
                car_lots_total=car_total,
                motorcycle_lots_available=moto_available,
                motorcycle_lots_total=moto_total,
                crowd_level=_crowd_level(available, total),
                is_sheltered=info["is_sheltered"],
                distance=round(dist),
                night_parking=info["night_parking"],
            )
        )

    # Sort nearest first
    results.sort(key=lambda x: x.distance)
    return results


@router.get("/carparks/{carpark_id}", response_model=CarparkAvailability)
async def get_carpark(
    carpark_id: str,
    lat: float | None = None,
    lng: float | None = None,
    vehicle_type: Literal["car", "motorcycle"] = "car",
):
    """
    Return a single carpark's live availability by HDB carpark number.

    Both car and motorcycle lot counts are always returned.  ``vehicle_type``
    determines which type's counts populate ``available_lots``/``total_lots``
    and the ``crowd_level`` calculation.
    """
    info = CARPARK_LOOKUP.get(carpark_id.upper())
    if info is None:
        raise HTTPException(status_code=404, detail=f"Carpark '{carpark_id}' not found")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(HDB_AVAILABILITY_URL)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"HDB API error: {exc}") from exc

    carpark_data: list[dict] = resp.json()["items"][0]["carpark_data"]
    cp = next((c for c in carpark_data if c.get("carpark_number") == carpark_id.upper()), None)
    if cp is None:
        # The carpark exists in our lookup but is missing from the live HDB snapshot.
        # Treat this as an upstream data issue rather than "0 available lots".
        raise HTTPException(
            status_code=502,
            detail=f"HDB API did not return availability for carpark '{carpark_id.upper()}'",
        )

    car_available = 0
    car_total = 0
    moto_available = 0
    moto_total = 0
    for lot in cp.get("carpark_info", []):
        lot_type = lot.get("lot_type")
        if lot_type == "C":
            car_available += int(lot.get("lots_available", 0))
            car_total += int(lot.get("total_lots", 0))
        elif lot_type == "Y":
            moto_available += int(lot.get("lots_available", 0))
            moto_total += int(lot.get("total_lots", 0))

    if vehicle_type == "motorcycle":
        available, total = moto_available, moto_total
    else:
        available, total = car_available, car_total

    dist = 0
    if lat is not None and lng is not None:
        dist = _haversine(lat, lng, info["lat"], info["lng"])

    return CarparkAvailability(
        id=carpark_id.upper(),
        name=f"HDB {carpark_id.upper()}",
        address=info["address"],
        lat=info["lat"],
        lng=info["lng"],
        available_lots=available,
        total_lots=total,
        car_lots_available=car_available,
        car_lots_total=car_total,
        motorcycle_lots_available=moto_available,
        motorcycle_lots_total=moto_total,
        crowd_level=_crowd_level(available, total),
        is_sheltered=info["is_sheltered"],
        distance=round(dist),
        night_parking=info["night_parking"],
    )
