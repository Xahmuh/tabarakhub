import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface POSGuidelineModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const POSGuidelineModal: React.FC<POSGuidelineModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-guideline-title"
            aria-describedby="pos-guideline-description"
        >
            {/* Modal Container - Increased max-width to be wider */}
            <div className="w-full max-w-5xl max-h-[90vh] bg-white shadow-[0_35px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col font-sans border border-white/20">

                {/* Red Header & Content Section */}
                <div className="bg-[#b81c1d] p-8 md:p-12 relative overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                    {/* Background Watermark - Warning Sign */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-10 pointer-events-none">
                        <AlertTriangle size={400} className="text-white rotate-12" strokeWidth={3} />
                    </div>

                    {/* Header Title & Close */}
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <h3 id="pos-guideline-title" className="text-3xl md:text-4xl font-bold text-white tracking-tight">Attention / تنبيه</h3>
                        <button
                            onClick={onClose}
                            className="bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-lg"
                        >
                            <X size={32} />
                        </button>
                    </div>

                    {/* Illustrative Toggle Switch (based on user image) */}
                    <div className="flex justify-center mb-10 relative z-10">
                        <div className="bg-slate-100/10 backdrop-blur-md p-1.5 rounded-[2rem] flex items-center shadow-inner border border-white/10">
                            <div className="bg-white px-8 py-3 rounded-[1.5rem] shadow-xl flex items-center justify-center">
                                <span className="text-[#b81c1d] font-black text-sm tracking-widest uppercase">Lost Sales</span>
                            </div>
                            <div className="px-8 py-3 flex items-center justify-center opacity-60">
                                <span className="text-white font-black text-sm tracking-widest uppercase">Shortage</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Section (Optimized for Landscape Layout) */}
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                        {/* Arabic Section (Right Side on Wide Screens) */}
                        <div className="text-right space-y-6 lg:order-2">
                            <h4 className="text-2xl font-bold text-white leading-tight">عزيزي الصيدلي</h4>
                            <p id="pos-guideline-description" className="text-xl font-bold leading-relaxed text-white" dir="rtl">
                                برجاء الانتباه جيدًا إلى الفرق بين تسجيل الأصناف كـ Lost Sales وتسجيلها كـ Shortage، وذلك لتجنب تسجيل بيانات غير دقيقة.
                            </p>

                            <div className="space-y-4 pt-2" dir="rtl">
                                <p className="text-lg font-bold text-white border-r-4 border-white/30 pr-4">
                                    • يتم تسجيل Lost Sales فقط في حالة وجود طلب فعلي من عميل على صنف غير متوفر داخل الفرع.
                                </p>
                                <p className="text-lg font-bold text-white border-r-4 border-white/30 pr-4">
                                    • يتم تسجيل Shortage عند تسجيل النواقص اليومية داخل الفرع، سواء وُجد طلب من عميل أم لا.
                                </p>
                            </div>

                            <div className="pt-4">
                                <p className="text-lg font-bold text-white/90" dir="rtl">
                                    الالتزام بالتسجيل الصحيح يساعد على دقة التقارير وتحسين إدارة المخزون.
                                </p>
                                <p className="text-xl font-bold text-white mt-2" dir="rtl">شاكرين تعاونكم.</p>
                            </div>
                        </div>

                        {/* Middle Vertical Divider (Only visible on Large Screens) */}
                        <div className="hidden lg:block absolute left-1/2 top-10 bottom-10 w-px bg-white/20 -translate-x-1/2"></div>

                        {/* English Section (Left Side on Wide Screens) */}
                        <div className="text-left space-y-6 lg:order-1">
                            <h4 className="text-xl font-bold text-white leading-tight">Dear Pharmacist</h4>
                            <p className="text-lg font-bold leading-relaxed text-white">
                                Please pay close attention to the difference between recording items as Lost Sales and recording them as Shortages, in order to avoid inaccurate data entry.
                            </p>

                            <div className="space-y-4 pt-2">
                                <p className="text-base font-bold text-white border-l-4 border-white/30 pl-4">
                                    • Lost Sales should be recorded only when there is an actual customer request for an item that is not available in the branch.
                                </p>
                                <p className="text-base font-bold text-white border-l-4 border-white/30 pl-4">
                                    • Shortage should be recorded for daily missing or out-of-stock items in the branch, regardless of customer demand.
                                </p>
                            </div>

                            <div className="pt-4">
                                <p className="text-base font-bold text-white/90">
                                    Proper classification ensures accurate reporting and effective inventory management.
                                </p>
                                <p className="text-lg font-bold text-white mt-2">Thank you for your cooperation.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="bg-white p-8 px-10 md:px-14 flex flex-col md:flex-row justify-between items-center gap-6 flex-shrink-0">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tabarak Hub © 2026</p>
                    <div className="flex items-center">
                        <button
                            onClick={onClose}
                            className="px-16 py-4 bg-[#b81c1d] hover:bg-[#8b1516] text-white font-bold text-2xl transition-all rounded-md active:scale-95 shadow-lg min-w-[240px]"
                        >
                            Acknowledged / تم الإطلاع علي التنبيه
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
