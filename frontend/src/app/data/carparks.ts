export type AvailabilityLevel = 'high' | 'moderate' | 'low' | 'full';

export interface Carpark {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    availableLots: number;
    totalLots: number;
    lotTypes?: {
        lotType: string;
        availableLots: number;
        totalLots: number;
    }[];
    availabilityLevel: AvailabilityLevel;
    walkingMinutes: number;
    hourlyRate: number;
    weekendRate?: number;
    isSheltered: boolean;
    carparkType?: string;
    isRecommended?: boolean;
    distance: number; // in meters
    nightParking?: boolean;
    prediction?: {
        hour1: number;
        hour2: number;
        confidence: 'high' | 'medium' | 'low';
    };
}

export interface WeatherForecast {
    time: string;
    type: 'sun' | 'cloud' | 'rain';
}

// Mock carpark data centered around Marina Bay, Singapore
export const mockCarparks: Carpark[] = [
    {
        id: '1',
        name: 'Marina Bay Financial Centre',
        address: '8 Marina Boulevard',
        lat: 1.2816,
        lng: 103.8544,
        availableLots: 45,
        totalLots: 100,
        availabilityLevel: 'high',
        walkingMinutes: 4,
        hourlyRate: 1.2,
        weekendRate: 1.5,
        isSheltered: true,
        isRecommended: true,
        distance: 300,
        prediction: {
            hour1: 40,
            hour2: 35,
            confidence: 'high',
        },
    },
    {
        id: '2',
        name: 'One Raffles Quay',
        address: '1 Raffles Quay',
        lat: 1.2814,
        lng: 103.8520,
        availableLots: 12,
        totalLots: 80,
        availabilityLevel: 'low',
        walkingMinutes: 6,
        hourlyRate: 1.5,
        weekendRate: 1.8,
        isSheltered: true,
        distance: 450,
        prediction: {
            hour1: 8,
            hour2: 5,
            confidence: 'medium',
        },
    },
    {
        id: '3',
        name: 'Suntec City Mall',
        address: '3 Temasek Boulevard',
        lat: 1.2950,
        lng: 103.8583,
        availableLots: 32,
        totalLots: 150,
        availabilityLevel: 'moderate',
        walkingMinutes: 8,
        hourlyRate: 1.8,
        weekendRate: 2.0,
        isSheltered: true,
        distance: 600,
        prediction: {
            hour1: 28,
            hour2: 25,
            confidence: 'high',
        },
    },
    {
        id: '4',
        name: 'The Arcade @ Raffles Place',
        address: '11 Collyer Quay',
        lat: 1.2838,
        lng: 103.8525,
        availableLots: 0,
        totalLots: 60,
        availabilityLevel: 'full',
        walkingMinutes: 5,
        hourlyRate: 2.0,
        weekendRate: 2.5,
        isSheltered: false,
        distance: 380,
        prediction: {
            hour1: 0,
            hour2: 3,
            confidence: 'low',
        },
    },
    {
        id: '5',
        name: 'Clifford Centre',
        address: '24 Raffles Place',
        lat: 1.2843,
        lng: 103.8510,
        availableLots: 8,
        totalLots: 50,
        availabilityLevel: 'low',
        walkingMinutes: 7,
        hourlyRate: 1.4,
        weekendRate: 1.6,
        isSheltered: true,
        distance: 520,
        prediction: {
            hour1: 6,
            hour2: 10,
            confidence: 'medium',
        },
    },
    {
        id: '6',
        name: 'Marina Square',
        address: '6 Raffles Boulevard',
        lat: 1.2912,
        lng: 103.8577,
        availableLots: 67,
        totalLots: 200,
        availabilityLevel: 'high',
        walkingMinutes: 10,
        hourlyRate: 1.6,
        weekendRate: 2.2,
        isSheltered: true,
        distance: 750,
        prediction: {
            hour1: 65,
            hour2: 60,
            confidence: 'high',
        },
    },
    {
        id: '7',
        name: 'OUE Bayfront',
        address: '50 Collyer Quay',
        lat: 1.2827,
        lng: 103.8542,
        availableLots: 18,
        totalLots: 90,
        availabilityLevel: 'moderate',
        walkingMinutes: 5,
        hourlyRate: 1.7,
        weekendRate: 2.0,
        isSheltered: false,
        distance: 400,
        prediction: {
            hour1: 15,
            hour2: 12,
            confidence: 'medium',
        },
    },
    {
        id: '8',
        name: 'Millenia Walk',
        address: '9 Raffles Boulevard',
        lat: 1.2928,
        lng: 103.8601,
        availableLots: 25,
        totalLots: 120,
        availabilityLevel: 'moderate',
        walkingMinutes: 12,
        hourlyRate: 1.3,
        weekendRate: 1.8,
        isSheltered: true,
        distance: 900,
        prediction: {
            hour1: 22,
            hour2: 20,
            confidence: 'high',
        },
    },
];

export const mockWeatherForecast: WeatherForecast[] = [
    { time: '2:00 PM', type: 'sun' },
    { time: '2:30 PM', type: 'cloud' },
    { time: '3:00 PM', type: 'rain' },
    { time: '3:30 PM', type: 'rain' },
];

export function getAvailabilityColor(level: AvailabilityLevel): string {
    switch (level) {
        case 'high':
            return '#10B981'; // Emerald green
        case 'moderate':
            return '#F59E0B'; // Amber
        case 'low':
            return '#F59E0B'; // Amber
        case 'full':
            return '#EF4444'; // Red
    }
}

const CARPARK_TYPE_LABELS: Record<string, string> = {
    'SURFACE CAR PARK': 'Surface Carpark',
    'MULTI-STOREY CAR PARK': 'Multi-Storey Carpark',
    'BASEMENT CAR PARK': 'Basement Carpark',
    'COVERED CAR PARK': 'Covered Carpark',
    'MECHANISED CAR PARK': 'Mechanised Carpark',
    'MECHANISED AND SURFACE CAR PARK': 'Mechanised & Surface Carpark',
    'SURFACE/MULTI-STOREY CAR PARK': 'Surface / Multi-Storey Carpark',
};

export function formatCarparkType(raw?: string): string {
    if (!raw) return 'Carpark';
    return CARPARK_TYPE_LABELS[raw.toUpperCase()] ?? raw;
}

export function getAvailabilityText(carpark: Carpark): string {
    if (carpark.availabilityLevel === 'full') {
        return 'Full';
    }
    return `${carpark.availabilityLevel.charAt(0).toUpperCase() + carpark.availabilityLevel.slice(1)} — ${carpark.availableLots} lots`;
}

export function sortCarparks(
    carparks: Carpark[],
    sortBy: 'recommended' | 'cheapest' | 'closest' | 'available'
): Carpark[] {
    const sorted = [...carparks];

    switch (sortBy) {
        case 'cheapest':
            return sorted.sort((a, b) => a.hourlyRate - b.hourlyRate);
        case 'closest':
            return sorted.sort((a, b) => a.walkingMinutes - b.walkingMinutes);
        case 'available':
            return sorted.sort((a, b) => b.availableLots - a.availableLots);
        case 'recommended':
        default:
            // Sort by: recommended first, then availability, then distance
            return sorted.sort((a, b) => {
                if (a.isRecommended && !b.isRecommended) return -1;
                if (!a.isRecommended && b.isRecommended) return 1;
                if (a.availabilityLevel === 'full' && b.availabilityLevel !== 'full')
                    return 1;
                if (a.availabilityLevel !== 'full' && b.availabilityLevel === 'full')
                    return -1;
                return a.walkingMinutes - b.walkingMinutes;
            });
    }
}

export function filterShelteredCarparks(carparks: Carpark[]): Carpark[] {
    return carparks.filter((cp) => cp.isSheltered);
}
