import React from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingDown, HelpCircle } from 'lucide-react';

interface Props {
  data?: any[];
  isLoading?: boolean;
}

export const CorrelationCharts: React.FC<Props> = ({ data, isLoading }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Business Correlation</h3>
        </div>
        <div className="flex items-center gap-1 group relative">
          <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" />
          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Comparing Staff Satisfaction vs. Monthly Branch Revenue & Employee Turnover.
          </div>
        </div>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900, fontSize: '11px' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, paddingBottom: '20px' }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (k)" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="satisfaction" name="Staff Score" stroke="#0F172A" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="turnover" name="Turnover %" stroke="#F43F5E" strokeWidth={2} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
        <TrendingDown className="w-4 h-4 text-rose-500" />
        <p className="text-[10px] font-bold text-slate-600">
          Inverse Correlation: High turnover months align with &lt;3.2 satisfaction scores.
        </p>
      </div>
    </div>
  );
};
