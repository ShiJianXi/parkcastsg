import type { Carpark, AvailabilityLevel } from '../app/data/carparks'
import sampleCarparkPredictionResponse from '../app/data/sample-carpark-prediction-response.json'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Raw shape returned by the backend
// ---------------------------------------------------------------------------
export interface LotTypeAvailability {
  lot_type: string
  available_lots: number
  total_lots: number
}

export interface NearbyCarpark {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  available_lots: number
  total_lots: number
  lot_types: LotTypeAvailability[]
  crowd_level: 'low' | 'medium' | 'high' | 'full'
  is_sheltered: boolean
  distance: number // metres
  night_parking: boolean
}

export interface PredictionLotTypeValue {
  lot_type: string
  predicted_available_lots: number
  predicted_occupancy_rate: number
}

export interface PredictionSnapshot {
  horizon_minutes: 15 | 30 | 60
  by_lot_type: PredictionLotTypeValue[]
}

export interface CarparkPredictionResponse {
  carpark_number: string
  generated_at: string
  predictions: PredictionSnapshot[]
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getNearbyCarparks(
  lat: number,
  lng: number,
  radius: number,
): Promise<NearbyCarpark[]> {
  const url = `${API_BASE}/api/v1/carparks/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Carpark API error ${res.status}`)
  }
  return res.json()
}

export async function getCarparkById(
  id: string,
  lat?: number,
  lng?: number,
): Promise<NearbyCarpark> {
  let url = `${API_BASE}/api/v1/carparks/${id}`
  if (lat !== undefined && lng !== undefined) {
    url += `?lat=${lat}&lng=${lng}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Carpark API error ${res.status}`)
  }
  return res.json()
}

export async function getCarparkPrediction(
  carparkNumber: string,
): Promise<CarparkPredictionResponse> {
  // const url = `${API_BASE}/api/v1/carparks/${carparkNumber}/prediction`;
  // const res = await fetch(url);
  // if (!res.ok) {
  //     throw new Error(`Prediction API error ${res.status}`);
  // }
  // return res.json();

  // Temporary mock response for UI development until the backend prediction
  // endpoint is finalized with the agreed response shape
  return {
    ...sampleCarparkPredictionResponse,
    carpark_number: carparkNumber,
  } as CarparkPredictionResponse
}

// ---------------------------------------------------------------------------
// Transform backend shape → frontend Carpark type
// ---------------------------------------------------------------------------

function crowdToAvailability(crowd: string): AvailabilityLevel {
  switch (crowd) {
    case 'low':
      return 'high'
    case 'medium':
      return 'moderate'
    case 'high':
      return 'low'
    case 'full':
      return 'full'
    default:
      return 'moderate'
  }
}

function distanceToWalkingMinutes(distanceMetres: number): number {
  // Average walking speed ~80 m/min
  return Math.max(1, Math.round(distanceMetres / 80))
}

export function transformCarpark(raw: NearbyCarpark): Carpark {
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address,
    lat: raw.lat,
    lng: raw.lng,
    availableLots: raw.available_lots,
    totalLots: raw.total_lots,
    lotTypes: raw.lot_types.map((lot) => ({
      lotType: lot.lot_type,
      availableLots: lot.available_lots,
      totalLots: lot.total_lots,
    })),
    availabilityLevel: crowdToAvailability(raw.crowd_level),
    walkingMinutes: distanceToWalkingMinutes(raw.distance),
    hourlyRate: 0.6, // HDB standard rate — can be enriched later TODO: will change this to dynamic if needed in the future
    isSheltered: raw.is_sheltered,
    distance: raw.distance,
    nightParking: raw.night_parking,
    isRecommended: raw.available_lots > 10 && raw.is_sheltered,
  }
}
