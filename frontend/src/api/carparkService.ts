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
    crowd_level: 'low' | 'medium' | 'high' | 'full' | 'unknown';
    is_sheltered: boolean;
    distance: number; // metres
    night_parking: boolean;
    car_park_type: string;
    source: 'hdb' | 'lta' | 'supplemental';
    // Rate strings from CarparkRates.csv (null = no match found)
    weekdays_rate_1: string | null;
    weekdays_rate_2: string | null;
    saturday_rate: string | null;
    sunday_ph_rate: string | null;
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
        case 'unknown':
            return 'unknown';
        default:
            return 'moderate';
    }
}

function distanceToWalkingMinutes(distanceMetres: number): number {
    // Average walking speed ~80 m/min
    return Math.max(1, Math.round(distanceMetres / 80));
}

export function transformCarpark(raw: NearbyCarpark): Carpark {
    const isLta = raw.source === 'lta';
    const isSupplemental = raw.source === 'supplemental';
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
      
        // LTA/supplemental rates vary per carpark; use Infinity so they never
        // float to the top of a "cheapest" sort. HDB uses the standard $1.20/hr.
        hourlyRate: (isLta || isSupplemental) ? Number.POSITIVE_INFINITY : 1.2,

        isSheltered: raw.is_sheltered,
        carparkType: raw.car_park_type,
        distance: raw.distance,
        nightParking: raw.night_parking,
        source: raw.source,
        weekdaysRate1: raw.weekdays_rate_1 ?? undefined,
        weekdaysRate2: raw.weekdays_rate_2 ?? undefined,
        saturdayRate: raw.saturday_rate ?? undefined,
        sundayPhRate: raw.sunday_ph_rate ?? undefined,
        // Supplemental and LTA carparks are not marked recommended (unknown availability)
        isRecommended: !isLta && !isSupplemental && raw.available_lots > 10 && raw.is_sheltered,
    };
}
