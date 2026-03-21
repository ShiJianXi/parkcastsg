import { MapPin, CloudRain } from 'lucide-react';
import { type Carpark, getAvailabilityColor, getAvailabilityText } from '../data/carparks';

interface CarparkCardProps {
    carpark: Carpark;
    isSelected: boolean;
    showRainIcon: boolean;
    onClick: () => void;
}

export function CarparkCard({ carpark, isSelected, showRainIcon, onClick }: CarparkCardProps) {
    const availabilityColor = getAvailabilityColor(carpark.availabilityLevel);
    const availabilityText = getAvailabilityText(carpark);

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

                    {/* Info Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Availability */}
                        <div className="flex items-center gap-1.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: availabilityColor }}
                            />
                            <span className="text-sm font-medium text-gray-900">{availabilityText}</span>
                        </div>

                        {/* Walking Distance */}
                        <span className="text-sm text-gray-600">{carpark.walkingMinutes} min walk</span>

                        {/* Price */}
                        <span className="text-sm font-medium text-gray-900">
                            ~${carpark.hourlyRate.toFixed(2)}/hr
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
                                High availability · {carpark.isSheltered ? 'Sheltered' : 'Open-air'} · $
                                {carpark.hourlyRate.toFixed(2)}/hr
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
