import type { Coordinates } from './geocode';

export type GeolocationErrorCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';

export class GeolocationError extends Error {
    constructor(
        public readonly code: GeolocationErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'GeolocationError';
    }
}

export interface UserLocation extends Coordinates {
    accuracy: number; // metres
}

/**
 * Request the device's current position using the browser Geolocation API.
 * Returns WGS84 { lat, lng, accuracy } on success, or throws a GeolocationError on failure.
 */
export function getUserLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(
                new GeolocationError(
                    'UNSUPPORTED',
                    'Your browser does not support location services.',
                ),
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            (err) => {
                switch (err.code) {
                    case GeolocationPositionError.PERMISSION_DENIED:
                        reject(
                            new GeolocationError(
                                'PERMISSION_DENIED',
                                'Location permission was denied. Please allow location access in your browser settings.',
                            ),
                        );
                        break;
                    case GeolocationPositionError.POSITION_UNAVAILABLE:
                        reject(
                            new GeolocationError(
                                'POSITION_UNAVAILABLE',
                                'Your location could not be determined. Please try again.',
                            ),
                        );
                        break;
                    case GeolocationPositionError.TIMEOUT:
                        reject(
                            new GeolocationError(
                                'TIMEOUT',
                                'Location request timed out. Please try again.',
                            ),
                        );
                        break;
                    default:
                        reject(
                            new GeolocationError(
                                'POSITION_UNAVAILABLE',
                                'An unknown error occurred while retrieving your location.',
                            ),
                        );
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    });
}
