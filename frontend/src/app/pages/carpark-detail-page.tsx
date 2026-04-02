import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Navigation, Heart, Bell, Cloud, Sun, CloudRain } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PremiumModal } from '../components/premium-modal';
import { mockWeatherForecast, getAvailabilityColor, type Carpark } from '../data/carparks';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { getCarparkById, transformCarpark } from '../../api/carparkService';
import { LoadingSkeleton } from '../components/loading-skeleton';

export function CarparkDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Dynamic states
    const [carpark, setCarpark] = useState<Carpark | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        let isMounted = true;
        const fetchCarparkDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const queryLat = searchParams.get('lat');
                const queryLng = searchParams.get('lng');
                const lat = queryLat ? parseFloat(queryLat) : undefined;
                const lng = queryLng ? parseFloat(queryLng) : undefined;
                
                const rawData = await getCarparkById(id, lat, lng);
                if (isMounted) {
                    setCarpark(transformCarpark(rawData));
                }
            } catch (err) {
                if (isMounted) {
                    setError('Failed to fetch carpark details. Please try again.');
                    console.error(err);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchCarparkDetails();

        return () => {
            isMounted = false;
        };
    }, [id, searchParams]);

    if (isLoading) {
        return (
            <div className="h-screen bg-[#F9FAFB] flex flex-col p-4">
                <LoadingSkeleton count={1} />
                <div className="mt-4"><LoadingSkeleton count={3} /></div>
            </div>
        );
    }

    if (error || !carpark) {
        return (
            <div className="h-screen flex flex-col bg-[#F9FAFB]">
                <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 flex-1 truncate">Back</h1>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">😕</span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            {error ? 'Something went wrong' : 'Carpark not found'}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {error || "We couldn't find details for this carpark. It might not be under HDB management."}
                        </p>
                        <Button onClick={() => navigate('/')}>Go Home</Button>
                    </div>
                </div>
            </div>
        );
    }

    // Mock predictions based on current availability slightly jittered
    // TO DO: Integrated with ML model
    const predictionData = [
        { time: 'Now', value: carpark.availableLots },
        { time: '+1h', value: carpark.prediction?.hour1 || 0 },
        { time: '+2h', value: carpark.prediction?.hour2 || 0 },
    ];

    const getWeatherIcon = (type: string) => {
        switch (type) {
            case 'sun':
                return <Sun className="w-5 h-5 text-yellow-500" />;
            case 'cloud':
                return <Cloud className="w-5 h-5 text-gray-400" />;
            case 'rain':
                return <CloudRain className="w-5 h-5 text-blue-500" />;
        }
    };

    const crowdLevel =
        carpark.availableLots / carpark.totalLots > 0.5
            ? 'low'
            : carpark.availableLots / carpark.totalLots > 0.2
                ? 'moderate'
                : 'high';

    return (
        <>
            <div className="min-h-screen bg-[#F9FAFB] pb-24">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <h1 className="text-lg font-semibold text-gray-900 flex-1 truncate">
                            {carpark.name}
                        </h1>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                    {/* Map Thumbnail */}
                    <div className="bg-white rounded-[12px] overflow-hidden shadow-sm border border-gray-200">
                        <div className="h-48 bg-gradient-to-br from-blue-50 to-blue-100 relative flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-[#1A56DB] rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Navigation className="w-6 h-6 text-white" />
                                </div>
                                {carpark.walkingMinutes ? (
                                    <p className="text-sm text-gray-600">{carpark.walkingMinutes} min walk</p>
                                ) : null}
                                <p className="text-xs text-gray-500 mt-1">{carpark.address}</p>
                            </div>
                        </div>
                    </div>

                    {/* Availability Section */}
                    <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">
                            Current Availability
                        </h2>
                        <div className="text-center mb-4">
                            <div className="text-4xl font-semibold text-gray-900 mb-2">
                                {carpark.availableLots} <span className="text-2xl text-gray-400">/ {carpark.totalLots}</span>
                            </div>
                            <p className="text-gray-600">lots available</p>
                        </div>

                        {/* Crowd Level Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Crowd level</span>
                                <span
                                    className="font-medium capitalize"
                                    style={{ color: getAvailabilityColor(carpark.availabilityLevel) }}
                                >
                                    {carpark.availabilityLevel === 'high' ? 'Low Crowd' : carpark.availabilityLevel === 'moderate' ? 'Moderate' : 'High Crowd'}
                                </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all rounded-full"
                                    style={{
                                        width: `${((carpark.totalLots - carpark.availableLots) / (carpark.totalLots || 1)) * 100}%`,
                                        backgroundColor: getAvailabilityColor(carpark.availabilityLevel),
                                    }}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-3">Live API from data.gov.sg</p>
                    </div>

                    {/* Prediction Section */}
                    <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-gray-900">
                                Predicted availability (next 2 hours) (Currently mocked, to be integrated with ML model)
                            </h2>
                            <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium ${predictionData[2].value > 10
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                    }`}
                            >
                                {predictionData[2].value > 10 ? 'Likely available' : 'Likely full'}
                            </span>
                        </div>

                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={predictionData}>
                                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                        {predictionData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.value > 20 ? '#10B981' : entry.value > 10 ? '#F59E0B' : '#EF4444'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                            Confidence: medium (Estimated model)
                        </p>
                    </div>

                    {/* Pricing Section */}
                    <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">Pricing</h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Weekday</p>
                                <p className="text-xl font-semibold text-gray-900">
                                    ${carpark.hourlyRate.toFixed(2)}/hr
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Night Parking</p>
                                <p className="text-lg font-medium text-gray-900">
                                    {carpark.nightParking ? 'Available' : 'No'}
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4 space-y-2">
                            <p className="text-sm text-gray-600">Estimated cost</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">1 hour</span>
                                <span className="font-medium text-gray-900">
                                    ~${carpark.hourlyRate.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">2 hours</span>
                                <span className="font-medium text-gray-900">
                                    ~${(carpark.hourlyRate * 2).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">4 hours</span>
                                <span className="font-medium text-gray-900">
                                    ~${(carpark.hourlyRate * 4).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Weather Section */}
                    <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                        <h2 className="text-base font-semibold text-gray-900 mb-4">Weather & Shelter</h2>

                        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${carpark.isSheltered ? 'bg-green-100' : 'bg-gray-200'
                                    }`}
                            >
                                <span className="text-lg">{carpark.isSheltered ? '✓' : '✗'}</span>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">
                                    Sheltered parking: {carpark.isSheltered ? 'Yes' : 'No'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {carpark.isSheltered
                                        ? 'Protected from rain and sun'
                                        : 'Open-air parking'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm text-gray-600 mb-3">Next 2-hour forecast (Mocked to be integrated with Weather API)</p>
                            <div className="flex gap-4">
                                {mockWeatherForecast.map((forecast, index) => (
                                    <div key={index} className="flex-1 text-center">
                                        <div className="flex justify-center mb-2">{getWeatherIcon(forecast.type)}</div>
                                        <p className="text-xs text-gray-600">{forecast.time}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <Button
                        onClick={() => window.open(`https://maps.google.com/?q=${carpark.lat},${carpark.lng}`, '_blank')}
                        className="flex-1 bg-[#1A56DB] hover:bg-[#1444b8] text-white rounded-lg py-6"
                    >
                        <Navigation className="w-4 h-4 mr-2" />
                        Navigate Here
                    </Button>
                    <Button
                        onClick={() => setIsSaved(!isSaved)}
                        variant="outline"
                        className={`px-6 py-6 rounded-lg ${isSaved ? 'bg-pink-50 border-pink-300 text-pink-600' : ''
                            }`}
                    >
                        <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                        onClick={() => setShowPremiumModal(true)}
                        variant="outline"
                        className="px-6 py-6 rounded-lg border-amber-300 text-amber-600 hover:bg-amber-50"
                    >
                        <Bell className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Premium Modal */}
            <PremiumModal
                isOpen={showPremiumModal}
                onClose={() => setShowPremiumModal(false)}
            />
        </>
    );
}
