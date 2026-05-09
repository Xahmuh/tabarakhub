import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface RangeDatePickerProps {
    startDate: string;
    endDate: string;
    onSelect: (start: string, end: string) => void;
    onClose: () => void;
}

export const RangeDatePicker: React.FC<RangeDatePickerProps> = ({ startDate, endDate, onSelect, onClose }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectingStart, setSelectingStart] = useState(true);

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const daysInMonth = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        // Previous month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, month: month - 1, year, current: false });
        }

        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, month: month, year, current: true });
        }

        // Next month padding
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, month: month + 1, year, current: false });
        }

        return days;
    }, [viewDate]);

    const handleDateClick = (d: number, m: number, y: number) => {
        const clickedDate = new Date(y, m, d);
        clickedDate.setHours(0, 0, 0, 0);

        if (selectingStart || !start) {
            onSelect(clickedDate.toISOString().split('T')[0], '');
            setSelectingStart(false);
        } else {
            if (clickedDate < start) {
                onSelect(clickedDate.toISOString().split('T')[0], '');
                setSelectingStart(false);
            } else {
                onSelect(startDate, clickedDate.toISOString().split('T')[0]);
                setSelectingStart(true);
            }
        }
    };

    const isInRange = (d: number, m: number, y: number) => {
        if (!start || !end) return false;
        const date = new Date(y, m, d);
        date.setHours(0, 0, 0, 0);
        return date > start && date < end;
    };

    const isSelected = (d: number, m: number, y: number) => {
        const date = new Date(y, m, d);
        date.setHours(0, 0, 0, 0);
        return (start && date.getTime() === start.getTime()) || (end && date.getTime() === end.getTime());
    };

    const isToday = (d: number, m: number, y: number) => {
        const date = new Date(y, m, d);
        return date.toDateString() === new Date().toDateString();
    };

    const monthName = viewDate.toLocaleString('default', { month: 'long' });
    const year = viewDate.getFullYear();

    return (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 w-[340px] animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center text-brand">
                        <CalendarIcon size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">{monthName} {year}</span>
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => setViewDate(new Date(year, viewDate.getMonth() - 1))} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"><ChevronLeft size={16} /></button>
                    <button onClick={() => setViewDate(new Date(year, viewDate.getMonth() + 1))} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"><ChevronRight size={16} /></button>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-brand rounded-lg transition-colors text-slate-300 ml-2"><X size={16} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[8px] font-black text-slate-300 uppercase py-2">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
                {daysInMonth.map((d, i) => {
                    const selected = isSelected(d.day, d.month, d.year);
                    const inRange = isInRange(d.day, d.month, d.year);
                    const today = isToday(d.day, d.month, d.year);

                    return (
                        <div key={i} className="relative flex items-center justify-center py-1">
                            {inRange && <div className="absolute inset-y-1 inset-x-0 bg-brand/5"></div>}
                            {selected && (
                                <div className={`absolute inset-y-1 w-full bg-brand/5 ${start && new Date(d.year, d.month, d.day).getTime() === start.getTime() && end ? 'rounded-l-full' : ''} ${end && new Date(d.year, d.month, d.day).getTime() === end.getTime() ? 'rounded-r-full' : ''}`}></div>
                            )}
                            <button
                                onClick={() => handleDateClick(d.day, d.month, d.year)}
                                className={`
                  relative z-10 w-9 h-9 text-[10px] font-black rounded-full transition-all flex items-center justify-center
                  ${!d.current ? 'text-slate-200' : 'text-slate-600 hover:bg-slate-50'}
                  ${selected ? 'bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand hover:scale-110' : ''}
                  ${today && !selected ? 'border border-brand/30 text-brand' : ''}
                `}
                            >
                                {d.day}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Check-In</span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">{startDate || '---'}</span>
                    </div>
                    <div className="w-8 h-px bg-slate-100"></div>
                    <div className="flex flex-col text-right">
                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Check-Out</span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">{endDate || '---'}</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={!startDate || !endDate}
                    className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-brand transition-all disabled:opacity-20 disabled:bg-slate-100"
                >
                    Confirm Period
                </button>
            </div>
        </div>
    );
};
