import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowUpRight, Plus, ShieldAlert } from 'lucide-react';
import { LostSale } from '../../types';
import { formatCurrency } from '../../utils/calculations';

interface DailyPerformanceCalendarProps {
  sales: LostSale[];
}

export const DailyPerformanceCalendar: React.FC<DailyPerformanceCalendarProps> = ({ sales }) => {
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

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sales.forEach(sale => {
      const date = new Date(sale.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      totals[key] = (totals[key] || 0) + sale.totalValue;
    });
    return totals;
  }, [sales]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand/[0.015] rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>

      <div className="flex flex-col gap-8 mb-12 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-brand border border-slate-100">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{monthName}</h3>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-3">Fiscal Year: {year}</p>
            </div>
          </div>
          <div className="flex items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-white hover:text-brand hover:shadow-xl rounded-xl transition-all text-slate-400" title="Previous Month">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-3"></div>
            <button onClick={() => changeMonth(1)} className="p-3 hover:bg-white hover:text-brand hover:shadow-xl rounded-xl transition-all text-slate-400" title="Next Month">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="flex items-center px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em]">
            <ShieldAlert className="w-4 h-4 mr-2.5 text-brand" />
            Operational Risk Monitoring Active
          </span>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-[450px]">
        <div className="grid grid-cols-7 mb-6">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] py-3">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[2rem] overflow-hidden flex-1 shadow-inner">
          {daysInMonth.map((dateObj, idx) => {
            const key = `${dateObj.year}-${dateObj.month}-${dateObj.day}`;
            const total = dailyTotals[key] || 0;
            const isToday = new Date().toDateString() === new Date(dateObj.year, dateObj.month, dateObj.day).toDateString();
            const intensity = total > 50 ? 'bg-brand/[0.04]' : total > 0 ? 'bg-brand/[0.015]' : 'bg-white';

            return (
              <div
                key={idx}
                className={`p-5 transition-all duration-300 group flex flex-col justify-between hover:z-10 hover:shadow-2xl relative transform-gpu backface-hidden ${!dateObj.isCurrentMonth ? 'opacity-10 pointer-events-none' : intensity}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-black transition-all ${isToday ? 'bg-brand text-white w-9 h-9 flex items-center justify-center rounded-xl shadow-2xl shadow-brand/20' : 'text-slate-400 group-hover:text-slate-900'}`}>
                    {dateObj.day}
                  </span>
                </div>

                <div className="mt-auto pt-4">
                  {total > 0 ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <p className="text-base font-black text-brand tracking-tight leading-none mb-1.5">
                        {total.toFixed(3)}
                      </p>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] leading-none" style={{ color: '#1f161b' }}>BHD VALUE</p>
                    </div>
                  ) : (
                    <div className="h-4 w-4 rounded-lg bg-slate-50 border border-slate-100/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Plus className="w-2.5 h-2.5 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-12 pt-10 border-t border-slate-50 flex items-center justify-center gap-10">
        <div className="flex items-center space-x-3">
          <div className="w-3.5 h-3.5 bg-brand rounded-md shadow-sm shadow-brand/20"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-40">IDENTIFIED LOSS</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-3.5 h-3.5 bg-slate-50 rounded-md border border-slate-200"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-40">Base State</span>
        </div>
      </div>
    </div>
  );
};
