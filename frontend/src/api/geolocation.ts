export interface UserLocation {
    lat: number;
    lng: number;
    accuracy: number; // metres
}

/**
 * Requests the device's current position via the browser Geolocation API.
 * Returns coordinates and accuracy on success, or throws a user-friendly error.
 */
export function getUserLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser.'));
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
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied. Please allow location access and try again.'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location information is unavailable. Please try again later.'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out. Please try again.'));
                        break;
                    default:
                        reject(new Error('An unknown error occurred while retrieving your location.'));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            }
        );
    });
}
