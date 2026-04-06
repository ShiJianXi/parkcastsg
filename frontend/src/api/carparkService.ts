import type { Carpark, AvailabilityLevel } from '../app/data/carparks';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Raw shape returned by the backend
// ---------------------------------------------------------------------------
export interface NearbyCarpark {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    available_lots: number;
    total_lots: number;
    crowd_level: 'low' | 'medium' | 'high' | 'full';
    is_sheltered: boolean;
    distance: number; // metres
    night_parking: boolean;
    car_park_type: string;
    free_parking: string;
    short_term_parking: string;
    is_central: boolean;
    is_peak: boolean;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getNearbyCarparks(
    lat: number,
    lng: number,
    radius: number
): Promise<NearbyCarpark[]> {
    const url = `${API_BASE}/api/v1/carparks/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Carpark API error ${res.status}`);
    }
    return res.json();
}

export async function getCarparkById(id: string, lat?: number, lng?: number): Promise<NearbyCarpark> {
    let url = `${API_BASE}/api/v1/carparks/${id}`;
    if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
    }
    
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Carpark API error ${res.status}`);
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Transform backend shape → frontend Carpark type
// ---------------------------------------------------------------------------

function crowdToAvailability(crowd: string): AvailabilityLevel {
    switch (crowd) {
        case 'low':
            return 'high';
        case 'medium':
            return 'moderate';
        case 'high':
            return 'low';
        case 'full':
            return 'full';
        default:
            return 'moderate';
    }
}

function distanceToWalkingMinutes(distanceMetres: number): number {
    // Average walking speed ~80 m/min
    return Math.max(1, Math.round(distanceMetres / 80));
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
        availabilityLevel: crowdToAvailability(raw.crowd_level),
        walkingMinutes: distanceToWalkingMinutes(raw.distance),
        hourlyRate: 1.20, // HDB standard rate: $0.60 per 30 min = $1.20/hr — can be enriched later TODO: will change this to dynamic if needed in the future
        isSheltered: raw.is_sheltered,
        carparkType: raw.car_park_type,
        distance: raw.distance,
        nightParking: raw.night_parking,
        freeParking: raw.free_parking,
        shortTermParking: raw.short_term_parking,
        isCentral: raw.is_central,
        isPeak: raw.is_peak,
        isRecommended: raw.available_lots > 10 && raw.is_sheltered,
    };
}
