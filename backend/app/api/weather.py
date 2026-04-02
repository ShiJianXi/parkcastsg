import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from math import atan2, cos, radians, sin, sqrt
import time

router = APIRouter()
WEATHER_FORECAST_URL = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast"

_WEATHER_CACHE = {
    "payload": None,
    "timestamp": 0
}
CACHE_TTL = 300  # 5 minutes

class WeatherResponse(BaseModel):
    area: str
    forecast: str
    is_raining: bool
    valid_period: str

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two WGS84 points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    a = min(1.0, max(0.0, a))
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

def _is_raining(forecast_str: str) -> bool:
    f = forecast_str.lower()
    return "rain" in f or "shower" in f or "thundery" in f

@router.get("/weather", response_model=WeatherResponse)
async def get_weather(lat: float, lng: float):
    """
    Given coordinates, find the closest weather area in Singapore and return
    the 2-hour forecast for that area.
    """
    current_time = time.time()
    if _WEATHER_CACHE["payload"] and (current_time - _WEATHER_CACHE["timestamp"] < CACHE_TTL):
        payload = _WEATHER_CACHE["payload"]
    else:
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                resp = await client.get(WEATHER_FORECAST_URL)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"NEA API error: {exc}") from exc

        payload = resp.json()
        _WEATHER_CACHE["payload"] = payload
        _WEATHER_CACHE["timestamp"] = current_time

    try:
        data = payload["data"]
        area_metadata = data["area_metadata"]
        forecast_item = data["items"][0]
        forecasts = forecast_item["forecasts"]
        valid_period_text = forecast_item["valid_period"]["text"]
    except (KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail="Unexpected NEA API structure") from exc

    closest_area = None
    min_dist = float('inf')

    # Find the nearest designated forecast area
    for area in area_metadata:
        area_lat = area["label_location"]["latitude"]
        area_lng = area["label_location"]["longitude"]
        dist = _haversine(lat, lng, area_lat, area_lng)
        
        if dist < min_dist:
            min_dist = dist
            closest_area = area["name"]

    if not closest_area:
        raise HTTPException(status_code=500, detail="Could not determine nearest weather area")

    # Retrieve that area's forecast
    forecast_text = "Unknown"
    for item in forecasts:
        if item["area"] == closest_area:
            forecast_text = item["forecast"]
            break

    return WeatherResponse(
        area=closest_area,
        forecast=forecast_text,
        is_raining=_is_raining(forecast_text),
        valid_period=valid_period_text
    )
