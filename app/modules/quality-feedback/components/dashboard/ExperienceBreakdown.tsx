import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data?: any[];
  isLoading?: boolean;
}

const COLORS = ['#0F172A', '#334155', '#64748B', '#94A3B8'];

export const ExperienceBreakdown: React.FC<Props> = ({ data, isLoading }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px] flex flex-col">
      <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">By Experience</h3>
      <div className="flex-1">
        {isLoading ? (
          <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {data?.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 900 }} />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
