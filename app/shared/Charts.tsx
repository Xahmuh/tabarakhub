
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Brush
} from 'recharts';

const COLORS = ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444'];

const ChartWrapper: React.FC<{
  children: React.ReactNode;
  height?: number | string;
  aspect?: number
}> = ({
  children,
  height = 400,
  aspect
}) => (
    <div className="w-full relative" style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}>
      <ResponsiveContainer
        width="100%"
        height={aspect ? undefined : (height as any)}
        aspect={aspect}
        debounce={0}
      >
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</p>
        <div className="space-y-3">
          {payload.map((entry: any, index: number) => {
            let displayName = entry.name;
            if (displayName === 'value') displayName = 'BHD LOSS';
            else if (displayName === 'count') displayName = 'LOST CUSTOMERS';
            else if (displayName === 'total') displayName = 'TOTAL SHORTAGES';
            else if (displayName === 'low') displayName = 'LOW STOCK';
            else if (displayName === 'critical') displayName = 'CRITICAL';
            else if (displayName === 'oos') displayName = 'OUT OF STOCK';

            return (
              <div key={index} className="flex items-center justify-between gap-8">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{displayName}</p>
                </div>
                <p className="text-sm font-black text-white tabular-nums tracking-tighter">
                  {entry.name === 'value' ? entry.value.toFixed(3) : entry.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export const ShortageTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
  <ChartWrapper height={350}>
    <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="colorOOS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eab308" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={true} strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" />
      <XAxis
        dataKey="name"
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
        dy={10}
      />
      <YAxis hide />
      <Tooltip content={<CustomTooltip />} />
      <Area
        type="monotone"
        dataKey="oos"
        name="oos"
        stroke="#ef4444"
        strokeWidth={3}
        fillOpacity={1}
        fill="url(#colorOOS)"
        animationDuration={1500}
      />
      <Area
        type="monotone"
        dataKey="critical"
        name="critical"
        stroke="#f59e0b"
        strokeWidth={2}
        fillOpacity={1}
        fill="url(#colorCritical)"
        animationDuration={2000}
      />
      <Area
        type="monotone"
        dataKey="low"
        name="low"
        stroke="#eab308"
        strokeWidth={1.5}
        strokeDasharray="5 5"
        fillOpacity={1}
        fill="url(#colorLow)"
        animationDuration={2500}
      />
      {data.length > 5 && (
        <Brush
          dataKey="name"
          height={30}
          stroke="#cbd5e1"
          fill="#f8fafc"
          className="opacity-50"
          travellerWidth={10}
        />
      )}
    </AreaChart>
  </ChartWrapper>
);

export const OperationalTrendChart: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data.length) {
    return (
      <div className="flex min-h-[340px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">No trend data available</p>
      </div>
    );
  }

  return (
    <ChartWrapper height={380}>
      <AreaChart data={data} margin={{ top: 18, right: 18, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="6 6" stroke="rgba(15,23,42,0.06)" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
          dy={12}
          minTickGap={24}
        />
        <YAxis
          yAxisId="impact"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
          tickFormatter={(val) => Number(val).toFixed(1)}
          width={56}
        />
        <YAxis
          yAxisId="customers"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#f59e0b', fontSize: 10, fontWeight: 800 }}
          tickFormatter={(val) => Math.round(Number(val)).toString()}
          width={42}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: '#0f172a', strokeWidth: 1.5, strokeDasharray: '5 5' }}
        />
        <Area
          yAxisId="impact"
          type="monotone"
          dataKey="value"
          name="value"
          stroke="#16a34a"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorValue)"
          activeDot={{ r: 5, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 3 }}
          animationDuration={1200}
        />
        <Area
          yAxisId="customers"
          type="monotone"
          dataKey="count"
          name="count"
          stroke="#f59e0b"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorCount)"
          activeDot={{ r: 4, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
          animationDuration={1600}
        />
        {data.length > 5 && (
          <Brush
            dataKey="name"
            height={28}
            stroke="#cbd5e1"
            fill="#f8fafc"
            className="opacity-70"
            travellerWidth={10}
          />
        )}
      </AreaChart>
    </ChartWrapper>
  );
};

export const RevenueChart: React.FC<{ data: any[] }> = ({ data }) => (
  <ChartWrapper height={400}>
    <AreaChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
      <defs>
        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#991b1b" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#991b1b" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" strokeDasharray="8 8" />
      <XAxis
        dataKey="name"
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900, fontFamily: 'Inter' }}
        dy={15}
        minTickGap={30}
      />
      <YAxis
        orientation="left"
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 800, fontFamily: 'Inter' }}
        tickFormatter={(val) => Number(val).toFixed(2)}
        width={60}
      />
      <Tooltip
        content={<CustomTooltip />}
        cursor={{ stroke: '#991b1b', strokeWidth: 2, strokeDasharray: '6 6' }}
      />
      <Area
        type="monotone"
        dataKey="value"
        stroke="#991b1b"
        strokeWidth={4}
        fillOpacity={1}
        fill="url(#colorValue)"
        activeDot={{
          r: 8,
          fill: '#991b1b',
          stroke: '#fff',
          strokeWidth: 4,
          style: { filter: 'drop-shadow(0 0 8px rgba(153,27,27,0.6))' }
        }}
        animationDuration={2500}
      />
    </AreaChart>
  </ChartWrapper>
);

export const TopProductsChart: React.FC<{ data: any[] }> = ({ data }) => (
  <ChartWrapper aspect={1.77} height="auto">
    <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40 }}>
      <XAxis type="number" hide />
      <YAxis
        dataKey="name"
        type="category"
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#475569', fontSize: 11, fontWeight: 700, fontFamily: 'Roboto' }}
        width={100}
      />
      <Tooltip
        cursor={{ fill: 'rgba(139, 0, 0, 0.05)' }}
        contentStyle={{
          borderRadius: '16px',
          border: 'none',
          fontFamily: 'Roboto'
        }}
      />
      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
        {data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ChartWrapper>
);
