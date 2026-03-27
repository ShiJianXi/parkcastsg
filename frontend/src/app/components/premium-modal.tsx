import { Bell, TrendingUp, DollarSign, X } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';

interface PremiumModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md mx-auto bg-white rounded-[12px] p-0 overflow-hidden border-none">
                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#1A56DB] to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">✨</span>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            Unlock Premium Features
                        </h2>
                        <p className="text-gray-600">
                            Get the most out of ParkCastSG
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bell className="w-5 h-5 text-[#1A56DB]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">
                                    Parking alerts for saved locations
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Get notified when parking becomes available at your favorite spots
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-5 h-5 text-[#10B981]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">
                                    6-hour availability forecast
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Plan ahead with extended predictions for better parking decisions
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <DollarSign className="w-5 h-5 text-[#F59E0B]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">
                                    Priority ranking by cost savings
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Find the best deals and save money on every parking session
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 text-center border border-blue-100">
                        <p className="text-sm text-gray-600 mb-2">Premium Subscription</p>
                        <p className="text-4xl font-semibold text-gray-900 mb-1">
                            S$2.99
                            <span className="text-lg text-gray-600 font-normal"> / month</span>
                        </p>
                        <p className="text-xs text-gray-500">Cancel anytime</p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Button
                            onClick={() => {
                                // Handle upgrade
                                alert('Premium upgrade coming soon!');
                                onClose();
                            }}
                            className="w-full py-6 bg-[#1A56DB] hover:bg-[#1444b8] text-white rounded-lg"
                        >
                            Upgrade Now
                        </Button>
                        <button
                            onClick={onClose}
                            className="w-full text-sm text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}