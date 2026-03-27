import { CloudRain, X } from 'lucide-react';

interface WeatherBannerProps {
    onDismiss: () => void;
}

export function WeatherBanner({ onDismiss }: WeatherBannerProps) {
    return (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="flex items-center gap-3">
                <CloudRain className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="flex-1 text-sm text-blue-900">
                    <span className="font-medium">Rain expected in 30 min</span> — Rain Mode active
                </p>
                <button
                    onClick={onDismiss}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                >
                    <X className="w-4 h-4 text-blue-600" />
                </button>
            </div>
        </div>
    );
}
