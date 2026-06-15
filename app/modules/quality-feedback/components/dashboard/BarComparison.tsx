import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data?: any[];
  isLoading?: boolean;
}

const COLORS = ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B'];

export const BarComparison: React.FC<Props> = ({ data, isLoading }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px] flex flex-col">
      <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">By Governorate</h3>
      <div className="flex-1">
        {isLoading ? (
          <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 5]} hide />
              <YAxis dataKey="cluster" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} width={100} />
              <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900 }} />
              <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={24}>
                {data?.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
