import { MapPin, CloudRain } from 'lucide-react';
import { type Carpark, type VehicleType, getAvailabilityColor, getAvailabilityText } from '../data/carparks';

// HDB standard short-term rates (approximate)
const CAR_HOURLY_RATE = 0.60;      // $0.60 per 30 min ≈ $0.60/hr display
const MOTORCYCLE_DAILY_RATE = 0.65; // $0.65 per entry/day

interface CarparkCardProps {
    carpark: Carpark;
    isSelected: boolean;
    showRainIcon: boolean;
    vehicleType: VehicleType;
    onClick: () => void;
    onViewDetails?: () => void;
}

export function CarparkCard({ carpark, isSelected, showRainIcon, vehicleType, onClick, onViewDetails }: CarparkCardProps) {
    const availabilityColor = getAvailabilityColor(carpark.availabilityLevel);
    const availabilityText = getAvailabilityText(carpark);

    const carLots = carpark.carLotsAvailable ?? 0;
    const motoLots = carpark.motorcycleLotsAvailable ?? 0;

    const priceLabel =
        vehicleType === 'motorcycle'
            ? `~$${MOTORCYCLE_DAILY_RATE.toFixed(2)}/entry`
            : `~$${CAR_HOURLY_RATE.toFixed(2)}/hr`;

    return (
        <div
            id={`carpark-${carpark.id}`}
            onClick={onClick}
            className={`bg-white rounded-[12px] p-4 border-2 cursor-pointer transition-all ${isSelected
                ? 'border-[#1A56DB] shadow-md'
                : carpark.availabilityLevel === 'full'
                    ? 'border-gray-200 opacity-60'
                    : 'border-gray-200 hover:border-[#1A56DB] hover:shadow-md'
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-base flex-1 truncate">
                            {carpark.name}
                        </h3>
                        {carpark.isRecommended && (
                            <span className="px-2 py-0.5 bg-[#10B981] text-white text-xs font-medium rounded-full whitespace-nowrap">
                                Recommended
                            </span>
                        )}
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{carpark.address}</span>
                    </div>

                    {/* Split Lot Availability */}
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`text-sm font-medium ${vehicleType === 'car' ? 'text-gray-900' : 'text-gray-500'}`}>
                            🚗 {carLots} lots
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className={`text-sm font-medium ${vehicleType === 'motorcycle' ? 'text-gray-900' : 'text-gray-500'}`}>
                            🏍️ {motoLots} lots
                        </span>
                    </div>

                    {/* Info Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Crowd Level for selected type */}
                        <div className="flex items-center gap-1.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: availabilityColor }}
                            />
                            <span className="text-sm font-medium text-gray-900">{availabilityText}</span>
                        </div>

                        {/* Walking Distance */}
                        <span className="text-sm text-gray-600">{carpark.walkingMinutes} min walk</span>

                        {/* Price (varies by vehicle type) */}
                        <span className="text-sm font-medium text-gray-900">
                            {priceLabel} <span className="text-xs text-gray-400">(est.)</span>
                        </span>

                        {/* Rain Icon */}
                        {showRainIcon && carpark.isSheltered && (
                            <div className="flex items-center gap-1 text-blue-600">
                                <CloudRain className="w-4 h-4" />
                            </div>
                        )}
                    </div>

                    {/* Recommendation Reason */}
                    {carpark.isRecommended && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-600">
                                High availability · {carpark.isSheltered ? 'Sheltered' : 'Open-air'} · {priceLabel}
                            </p>
                        </div>
                    )}
                    
                    {/* View Details Button (visible when selected) */}
                    {isSelected && (
                        <div className="mt-4 border-t border-gray-100 pt-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // prevent triggering the card's onClick
                                    if (onViewDetails) onViewDetails();
                                }}
                                className="w-full bg-[#1A56DB] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1444b8] transition-colors"
                            >
                                View full details
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
