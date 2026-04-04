import { CloudRain } from 'lucide-react';
import type { VehicleType } from '../data/carparks';

interface FilterChipsProps {
    selectedFilter: 'recommended' | 'cheapest' | 'closest' | 'available';
    rainMode: boolean;
    vehicleType: VehicleType;
    onFilterChange: (filter: 'recommended' | 'cheapest' | 'closest' | 'available') => void;
    onRainModeToggle: () => void;
    onVehicleTypeChange: (type: VehicleType) => void;
}

export function FilterChips({
    selectedFilter,
    rainMode,
    vehicleType,
    onFilterChange,
    onRainModeToggle,
    onVehicleTypeChange,
}: FilterChipsProps) {
    const filters: Array<{
        id: 'recommended' | 'cheapest' | 'closest' | 'available';
        label: string;
    }> = [
            { id: 'recommended', label: 'Recommended' },
            { id: 'cheapest', label: 'Cheapest' },
            { id: 'closest', label: 'Closest' },
            { id: 'available', label: 'Most Available' },
        ];

    const vehicleOptions: Array<{ id: VehicleType; label: string; emoji: string }> = [
        { id: 'car', label: 'Car', emoji: '🚗' },
        { id: 'motorcycle', label: 'Motorcycle', emoji: '🏍️' },
    ];

    return (
        <div className="flex flex-col gap-2">
            {/* Vehicle Type Selector */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium shrink-0">Vehicle</span>
                <div className="flex gap-1.5">
                    {vehicleOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => onVehicleTypeChange(option.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                                vehicleType === option.id
                                    ? 'bg-[#1A56DB] text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span>{option.emoji}</span>
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort & Other Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {filters.map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => onFilterChange(filter.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedFilter === filter.id
                            ? 'bg-[#1A56DB] text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}

                <button
                    onClick={onRainModeToggle}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${rainMode
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    <CloudRain className="w-4 h-4" />
                    Rain Mode
                </button>
            </div>
        </div>
    );
}
