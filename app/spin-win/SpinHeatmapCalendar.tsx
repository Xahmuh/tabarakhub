import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Zap } from 'lucide-react';

interface SpinHeatmapCalendarProps {
    spins: any[];
}

export const SpinHeatmapCalendar: React.FC<SpinHeatmapCalendarProps> = ({ spins }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];

        const firstDayIndex = date.getDay();
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, month: month - 1, year, isCurrentMonth: false });
        }

        const lastDay = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= lastDay; i++) {
            days.push({ day: i, month, year, isCurrentMonth: true });
        }

        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ day: i, month: month + 1, year, isCurrentMonth: false });
        }

        return days;
    }, [currentDate]);

    const dailyStats = useMemo(() => {
        const stats: Record<string, { created: number, redeemed: number }> = {};
        spins.forEach(spin => {
            const cDate = new Date(spin.created_at);
            const cKey = `${cDate.getFullYear()}-${cDate.getMonth()}-${cDate.getDate()}`;
            if (!stats[cKey]) stats[cKey] = { created: 0, redeemed: 0 };
            stats[cKey].created += 1;

            if (spin.redeemed_at) {
                const rDate = new Date(spin.redeemed_at);
                const rKey = `${rDate.getFullYear()}-${rDate.getMonth()}-${rDate.getDate()}`;
                if (!stats[rKey]) stats[rKey] = { created: 0, redeemed: 0 };
                stats[rKey].redeemed += 1;
            }
        });
        return stats;
    }, [spins]);

    const maxActivity = useMemo(() => {
        const values = Object.values(dailyStats).map((s: { created: number, redeemed: number }) => s.created + s.redeemed);
        return values.length > 0 ? Math.max(...values) : 0;
    }, [dailyStats]);

    const getIntensityClass = (total: number) => {
        if (total === 0) return 'bg-slate-50';
        const ratio = total / Math.max(maxActivity, 1);
        if (ratio <= 0.25) return 'bg-red-100';
        if (ratio <= 0.5) return 'bg-red-200';
        if (ratio <= 0.75) return 'bg-red-300';
        return 'bg-red-500';
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-100 shadow-sm relative overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">{monthName} {year}</h3>
                        <p className="text-xs text-slate-400 font-medium">Engagement Heatmap</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white hover:text-red-600 rounded-md transition-all text-slate-400">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white hover:text-red-600 rounded-md transition-all text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Week headers */}
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">{day}</div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 flex-1">
                {daysInMonth.map((dateObj, idx) => {
                    const key = `${dateObj.year}-${dateObj.month}-${dateObj.day}`;
                    const stat = dailyStats[key] || { created: 0, redeemed: 0 };
                    const isToday = new Date().toDateString() === new Date(dateObj.year, dateObj.month, dateObj.day).toDateString();
                    const total = stat.created + stat.redeemed;

                    return (
                        <div
                            key={idx}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-start p-1.5 transition-all duration-300 group relative ${!dateObj.isCurrentMonth ? 'opacity-0 pointer-events-none' : getIntensityClass(total)} ${isToday ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
                            title={total > 0 ? `${stat.created} spins, ${stat.redeemed} redeemed` : ''}
                        >
                            <span className={`text-[10px] font-bold ${total > 0 && (total / Math.max(maxActivity, 1)) > 0.5 ? 'text-white' : 'text-slate-700'}`}>
                                {dateObj.day}
                            </span>

                            {stat.created > 0 && (
                                <div className="flex flex-col items-center gap-0 mt-0.5">
                                    <span className={`text-[11px] font-black leading-none ${total > 0 && (total / Math.max(maxActivity, 1)) > 0.5 ? 'text-white' : 'text-red-600'}`}>
                                        {stat.created}
                                    </span>
                                    {stat.redeemed > 0 && (
                                        <span className={`text-[9px] font-bold leading-none ${total > 0 && (total / Math.max(maxActivity, 1)) > 0.5 ? 'text-white/70' : 'text-amber-600'}`}>
                                            +{stat.redeemed}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-red-600" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Density</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400 mr-1">Low</span>
                    {['bg-slate-50', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-500'].map((c, i) => (
                        <div key={i} className={`w-3 h-3 rounded ${c} border border-slate-200/50`}></div>
                    ))}
                    <span className="text-[9px] text-slate-400 ml-1">High</span>
                </div>
            </div>
        </div>
    );
};
