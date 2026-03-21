import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Filter, X } from 'lucide-react';
import { CarparkCard } from '../components/carpark-card';
import { CarparkMap } from '../components/carpark-map';
import { FilterChips } from '../components/filter-chips';
import { WeatherBanner } from '../components/weather-banner';
import { LoadingSkeleton } from '../components/loading-skeleton';
import {
    mockCarparks,
    sortCarparks,
    filterShelteredCarparks,
    type Carpark,
} from '../data/carparks';

export function ResultsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [carparks, setCarparks] = useState<Carpark[]>([]);
    const [selectedCarpark, setSelectedCarpark] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'recommended' | 'cheapest' | 'closest' | 'available'>(
        'recommended'
    );
    const [rainMode, setRainMode] = useState(false);
    const [showWeatherBanner, setShowWeatherBanner] = useState(true);

    const destination = searchParams.get('q') || 'Marina Bay';
    const radius = searchParams.get('radius') || '500';

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            let results = [...mockCarparks];

            // Apply rain mode filter
            if (rainMode) {
                results = filterShelteredCarparks(results);
            }

            // Apply sorting
            results = sortCarparks(results, sortBy);

            setCarparks(results);
            setIsLoading(false);
        }, 800);
    }, [sortBy, rainMode]);

    const handleCarparkClick = (id: string) => {
        navigate(`/carpark/${id}`);
    };

    const handleMapPinClick = (id: string) => {
        setSelectedCarpark(id);
        // Scroll to card on mobile
        const element = document.getElementById(`carpark-${id}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    return (
        <div className="h-screen flex flex-col bg-[#F9FAFB]">
            {/* Sticky Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-gray-900 truncate">
                            {destination}
                        </h2>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Filter className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                {/* Radius Pills */}
                <div className="flex gap-2 mt-3">
                    {['300m', '500m', '1km'].map((r, idx) => (
                        <button
                            key={r}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium ${radius === [300, 500, 1000][idx].toString()
                                ? 'bg-[#1A56DB] text-white'
                                : 'bg-gray-100 text-gray-600'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Weather Banner */}
            {showWeatherBanner && (
                <WeatherBanner onDismiss={() => setShowWeatherBanner(false)} />
            )}

            {/* Filter Chips */}
            <div className="bg-white px-4 py-3 border-b border-gray-200 sticky top-[120px] z-10">
                <FilterChips
                    selectedFilter={sortBy}
                    rainMode={rainMode}
                    onFilterChange={setSortBy}
                    onRainModeToggle={() => setRainMode(!rainMode)}
                />
            </div>

            {/* Main Content - Mobile: Vertical Stack, Desktop: Side by Side */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Carpark List */}
                <div className="lg:w-2/5 bg-white border-r border-gray-200 overflow-y-auto max-h-[40vh] lg:max-h-none">
                    <div className="p-4 space-y-3">
                        {isLoading ? (
                            <LoadingSkeleton count={5} />
                        ) : carparks.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Filter className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    No carparks found
                                </h3>
                                <p className="text-gray-600 mb-4">Try a wider radius</p>
                                <button
                                    onClick={() => setRainMode(false)}
                                    className="text-[#1A56DB] font-medium hover:underline"
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <>
                                {carparks.map((carpark) => (
                                    <CarparkCard
                                        key={carpark.id}
                                        carpark={carpark}
                                        isSelected={selectedCarpark === carpark.id}
                                        showRainIcon={rainMode}
                                        onClick={() => handleCarparkClick(carpark.id)}
                                    />
                                ))}
                            </>
                        )}
                    </div>

                    {/* Last Updated Timestamp */}
                    {!isLoading && carparks.length > 0 && (
                        <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
                            Last updated: 2 mins ago
                        </div>
                    )}
                </div>

                {/* Map */}
                <div className="lg:w-3/5 h-64 lg:h-auto">
                    <CarparkMap
                        carparks={carparks}
                        selectedCarparkId={selectedCarpark}
                        onPinClick={handleMapPinClick}
                    />
                </div>
            </div>
        </div>
    );
}