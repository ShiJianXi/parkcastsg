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
    iconSrc: string;
    getUrl: (lat: number, lng: number) => string;
    bgColor: string;
    textColor: string;
    /** When true, only shown on Apple platforms (iOS / iPadOS / macOS). */
    appleOnly?: boolean;
}

const NAV_OPTIONS: NavOption[] = [
    {
        name: 'Apple Maps',
        iconSrc: '/icons/apple-maps.svg',
        getUrl: (lat, lng) =>
            `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        textColor: 'text-gray-900',
        appleOnly: true,
    },
    {
        name: 'Waze',
        iconSrc: '/icons/waze.svg',
        getUrl: (lat, lng) =>
            `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
        bgColor: 'bg-cyan-50 hover:bg-cyan-100',
        textColor: 'text-cyan-900',
    },
    {
        name: 'Google Maps',
        iconSrc: '/icons/google-maps.svg',
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
                                <img
                                    src={option.iconSrc}
                                    alt={option.name}
                                    width={28}
                                    height={28}
                                    className="rounded-[6px] shrink-0"
                                />
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
