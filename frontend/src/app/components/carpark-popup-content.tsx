import { type Carpark, getAvailabilityText } from '../data/carparks';
import { calculateLiveRates } from '../utils/pricingEngine';

interface CarparkPopupContentProps {
    carpark: Carpark;
}

export function CarparkPopupContent({ carpark }: CarparkPopupContentProps) {
    const livePricing = calculateLiveRates(carpark);
    const isUnknown = carpark.availabilityLevel === 'unknown';

    return (
        <div className="text-sm">
            <p className="font-semibold mb-1 text-gray-900">{carpark.name}</p>
            <p className={`mb-2 ${isUnknown ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                {getAvailabilityText(carpark)}
            </p>
            <div className="space-y-1">
                <p className="text-gray-700 font-medium flex items-center gap-2">
                    <span>🚗</span> {livePricing.car}
                </p>
                <p className="text-gray-700 font-medium flex items-center gap-2">
                    <span>🏍️</span> {livePricing.motorcycle}
                </p>
                <p className="text-gray-700 font-medium flex items-center gap-2">
                    <span>🚚</span> {livePricing.heavy}
                </p>
            </div>
        </div>
    );
}
