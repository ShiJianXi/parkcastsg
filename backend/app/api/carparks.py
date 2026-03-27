from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CarparkLocation(BaseModel):
    lat: float
    lng: float


class CarparkAvailability(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    available_lots: int
    crowd_level: str


_MOCK_CARPARKS = [
    CarparkAvailability(
        id="CP001",
        name="Suntec City Carpark",
        lat=1.2936,
        lng=103.8574,
        available_lots=120,
        crowd_level="low",
    ),
    CarparkAvailability(
        id="CP002",
        name="Marina Square Carpark",
        lat=1.2909,
        lng=103.8597,
        available_lots=45,
        crowd_level="medium",
    ),
    CarparkAvailability(
        id="CP003",
        name="Esplanade Carpark",
        lat=1.2896,
        lng=103.8554,
        available_lots=5,
        crowd_level="high",
    ),
]


@router.get("/carparks/nearby", response_model=list[CarparkAvailability])
def get_nearby_carparks(lat: float, lng: float, radius: int = 500):
    # TODO: filter by distance once real data is wired up
    return _MOCK_CARPARKS


@router.get("/availability/live", response_model=CarparkAvailability)
def get_live_availability(carpark_id: str):
    # TODO: fetch real-time availability from DB/external API
    return CarparkAvailability(
        id=carpark_id,
        name="Mock Carpark",
        lat=1.2936,
        lng=103.8574,
        available_lots=88,
        crowd_level="low",
    )
