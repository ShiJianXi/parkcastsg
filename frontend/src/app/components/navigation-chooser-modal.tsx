import React from 'react';
import { Dialog, DialogContent } from './ui/dialog';

interface NavigationChooserModalProps {
    isOpen: boolean;
    onClose: () => void;
    lat: number;
    lng: number;
    address?: string;
}

interface NavOption {
    name: string;
    icon: React.ReactNode;
    getUrl: (lat: number, lng: number) => string;
    bgColor: string;
    textColor: string;
    /** When true, only shown on Apple platforms (iOS / iPadOS / macOS). */
    appleOnly?: boolean;
}

function AppleMapsIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#1C1C1E" />
            <path d="M14 5L9.5 15h3.5v8l6-10.5H20L14 5z" fill="white" />
            <circle cx="8" cy="21" r="1.8" fill="#34C759" />
            <circle cx="20" cy="21" r="1.8" fill="#FF3B30" />
            <line x1="8" y1="21" x2="20" y2="21" stroke="#8E8E93" strokeWidth="1.2" />
        </svg>
    );
}

function WazeIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#33CCFF" />
            <ellipse cx="14" cy="13" rx="7.5" ry="7" fill="white" />
            <circle cx="11.5" cy="11.5" r="1.2" fill="#1A1A1A" />
            <circle cx="16.5" cy="11.5" r="1.2" fill="#1A1A1A" />
            <path d="M11 15.5c.8 1.2 5.2 1.2 6 0" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="18.5" cy="20.5" r="2.5" fill="#FF9500" />
            <circle cx="18.5" cy="20.5" r="1" fill="white" />
        </svg>
    );
}

function GoogleMapsIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="white" />
            <path d="M14 4C10.134 4 7 7.134 7 11c0 5.5 7 15 7 15s7-9.5 7-15c0-3.866-3.134-7-7-7z" fill="#EA4335" />
            <path d="M14 4c1.93 0 3.68.782 4.95 2.05L14 11l-4.95-4.95A6.965 6.965 0 0114 4z" fill="#1A73E8" />
            <path d="M7 11c0-1.93.782-3.68 2.05-4.95L14 11H7z" fill="#34A853" />
            <path d="M14 11l4.95-4.95C20.218 7.32 21 9.07 21 11h-7z" fill="#FBBC04" />
            <circle cx="14" cy="11" r="3" fill="white" />
        </svg>
    );
}

const NAV_OPTIONS: NavOption[] = [
    {
        name: 'Apple Maps',
        icon: <AppleMapsIcon />,
        getUrl: (lat, lng) =>
            `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        textColor: 'text-gray-900',
        appleOnly: true,
    },
    {
        name: 'Waze',
        icon: <WazeIcon />,
        getUrl: (lat, lng) =>
            `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
        bgColor: 'bg-cyan-50 hover:bg-cyan-100',
        textColor: 'text-cyan-900',
    },
    {
        name: 'Google Maps',
        icon: <GoogleMapsIcon />,
        getUrl: (lat, lng) =>
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        bgColor: 'bg-blue-50 hover:bg-blue-100',
        textColor: 'text-blue-900',
    },
];

/** Returns true when running on an Apple platform (iOS, iPadOS, or macOS).
 *
 * Detection strategy:
 *  - iPhone / iPod / iPad  – iOS 12 and below, and non-desktop iPad modes
 *  - Macintosh in UA       – macOS and iPadOS 13+ desktop-mode browsers
 *
 * We intentionally treat both cases as Apple platforms so that Apple Maps is
 * available wherever it is actually useful.
 */
function isApplePlatform(): boolean {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS 13+ desktop-mode browsers report "Macintosh"; plain macOS does too —
    // Apple Maps is useful on both.
    if (/Macintosh/i.test(ua)) return true;
    return false;
}

export function NavigationChooserModal({
    isOpen,
    onClose,
    lat,
    lng,
    address,
}: NavigationChooserModalProps) {
    const visibleOptions = NAV_OPTIONS.filter(
        (opt) => !opt.appleOnly || isApplePlatform(),
    );

    const handleSelect = (option: NavOption) => {
        window.open(option.getUrl(lat, lng), '_blank', 'noopener,noreferrer');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm mx-auto bg-white rounded-[12px] p-0 overflow-hidden border-none">
                <div className="p-6">
                    {/* Header — no extra X button; DialogContent provides one */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Navigate with&hellip;</h2>

                    {address && (
                        <p className="text-sm text-gray-500 mb-4 truncate">{address}</p>
                    )}

                    {/* Options */}
                    <div className="space-y-3">
                        {visibleOptions.map((option) => (
                            <button
                                key={option.name}
                                onClick={() => handleSelect(option)}
                                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 transition-colors ${option.bgColor}`}
                            >
                                {option.icon}
                                <span className={`text-base font-medium ${option.textColor}`}>
                                    {option.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 font-medium py-2"
                    >
                        Cancel
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
