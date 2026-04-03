import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { type Carpark, getAvailabilityColor } from '../data/carparks';
import { type Coordinates } from '../../api/geocode';
import 'leaflet/dist/leaflet.css';

interface CarparkMapProps {
    carparks: Carpark[];
    selectedCarparkId: string | null;
    onPinClick: (id: string) => void;
    userLocation?: Coordinates | null;
    userAccuracy?: number; // metres
}

// Custom marker icon component
function createCustomIcon(color: string, isSelected: boolean) {
    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div style="
        width: ${isSelected ? '32px' : '24px'};
        height: ${isSelected ? '32px' : '24px'};
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      "></div>
    `,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
    });
}

// Blue marker icon for user location
function createUserLocationIcon() {
    return L.divIcon({
        className: 'user-location-marker',
        html: `
      <div style="
        width: 20px;
        height: 20px;
        background-color: #1A56DB;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(26,86,219,0.5);
      "></div>
    `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

// Component to handle map bounds and selected marker
function MapController({
    carparks,
    selectedCarparkId,
    userLocation,
}: {
    carparks: Carpark[];
    selectedCarparkId: string | null;
    userLocation?: Coordinates | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (selectedCarparkId) {
            const selected = carparks.find((cp) => cp.id === selectedCarparkId);
            if (selected) {
                map.setView([selected.lat, selected.lng], 16, { animate: true });
                return;
            }
        }

        if (carparks.length > 0) {
            // Fit bounds to show all markers (include user location if present)
            const points: [number, number][] = carparks.map((cp) => [cp.lat, cp.lng]);
            if (userLocation) {
                points.push([userLocation.lat, userLocation.lng]);
            }
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (userLocation) {
            map.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
        }
    }, [carparks, selectedCarparkId, userLocation, map]);

    return null;
}

// Component to render individual markers and manage their popup state
function CarparkMarker({ carpark, isSelected, onPinClick }: { carpark: Carpark; isSelected: boolean; onPinClick: (id: string) => void }) {
    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        if (isSelected && markerRef.current) {
            // Slight delay ensures the map panning finishes or is in progress before opening the popup
            setTimeout(() => {
                markerRef.current?.openPopup();
            }, 100);
        }
    }, [isSelected]);

    const color = getAvailabilityColor(carpark.availabilityLevel);

    return (
        <Marker
            position={[carpark.lat, carpark.lng]}
            icon={createCustomIcon(color, isSelected)}
            ref={markerRef}
            eventHandlers={{
                click: () => onPinClick(carpark.id),
            }}
        >
            <Popup>
                <div className="text-sm">
                    <p className="font-semibold mb-1">{carpark.name}</p>
                    <p className="text-gray-600 mb-1">{carpark.availableLots} / {carpark.totalLots} lots available</p>
                    <p className="text-gray-600">~${carpark.hourlyRate.toFixed(2)}/hr</p>
                </div>
            </Popup>
        </Marker>
    );
}

// Separate component for map content to avoid context issues
function MapContent({
    carparks,
    selectedCarparkId,
    onPinClick,
    userLocation,
    userAccuracy,
    showAccuracyCircle,
}: CarparkMapProps & { showAccuracyCircle: boolean }) {
    return (
        <>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController
                carparks={carparks}
                selectedCarparkId={selectedCarparkId}
                userLocation={userLocation}
            />

            {/* User location accuracy circle */}
            {userLocation && Number.isFinite(userAccuracy) && (userAccuracy as number) > 0 && showAccuracyCircle && (
                <Circle
                    center={[userLocation.lat, userLocation.lng]}
                    radius={userAccuracy}
                    pathOptions={{
                        color: '#1A56DB',
                        fillColor: '#1A56DB',
                        fillOpacity: 0.15,
                        weight: 1.5,
                    }}
                />
            )}

            {/* User location marker */}
            {userLocation && (
                <Marker
                    position={[userLocation.lat, userLocation.lng]}
                    icon={createUserLocationIcon()}
                >
                    <Popup>
                        <div className="text-sm">
                            <p className="font-semibold mb-1">Your location</p>
                            {userAccuracy && (
                                <p className="text-gray-600">±{Math.round(userAccuracy)}m accuracy</p>
                            )}
                        </div>
                    </Popup>
                </Marker>
            )}

            {carparks.map((carpark) => {
                const isSelected = selectedCarparkId === carpark.id;

                return (
                    <CarparkMarker
                        key={carpark.id}
                        carpark={carpark}
                        isSelected={isSelected}
                        onPinClick={onPinClick}
                    />
                );
            })}
        </>
    );
}

export function CarparkMap(props: CarparkMapProps) {
    // Default center (Marina Bay, Singapore)
    const defaultCenter: [number, number] = [1.2816, 103.8544];

    return (
        <div className="h-full w-full relative">
            <MapContainer
                center={defaultCenter}
                zoom={14}
                className="h-full w-full"
                zoomControl={true}
            >
                <MapContent {...props} showAccuracyCircle={true} />
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] text-xs">
                <p className="font-semibold mb-2 text-gray-900">Availability</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                        <span className="text-gray-700">High</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                        <span className="text-gray-700">Moderate/Low</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                        <span className="text-gray-700">Full</span>
                    </div>

                </div>
            </div>
        </div>
    );
}