
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Brush, ComposedChart, Line, ReferenceLine
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
    const uniquePayload = payload.filter((entry: any, index: number, items: any[]) => {
      const entryKey = entry.dataKey ?? entry.name;
      return items.findIndex((item: any) => (item.dataKey ?? item.name) === entryKey) === index;
    });

    return (
      <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</p>
        <div className="space-y-3">
          {uniquePayload.map((entry: any, index: number) => {
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
      <div className="flex min-h-[380px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">No trend data available</p>
      </div>
    );
  }

  const firstValue = Number(data[0]?.value) || 0;
  const lastValue = Number(data[data.length - 1]?.value) || 0;
  const trendColor = lastValue > firstValue ? '#ef4444' : lastValue < firstValue ? '#22c55e' : '#38bdf8';
  const averageValue = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0) / Math.max(1, data.length);

  return (
    <ChartWrapper height={430}>
      <ComposedChart data={data} margin={{ top: 22, right: 20, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="stockImpactGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity={0.22} />
            <stop offset="72%" stopColor={trendColor} stopOpacity={0.04} />
            <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="stockVolumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={true} strokeDasharray="3 8" stroke="rgba(148,163,184,0.14)" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
          dy={12}
          minTickGap={24}
        />
        <YAxis
          yAxisId="impact"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
          tickFormatter={(val) => `${Number(val).toFixed(1)}`}
          width={62}
        />
        <YAxis
          yAxisId="customers"
          orientation="right"
          hide
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: trendColor, strokeWidth: 1.5, strokeDasharray: '4 6' }}
        />
        {averageValue > 0 && (
          <ReferenceLine
            yAxisId="impact"
            y={averageValue}
            stroke="#64748b"
            strokeDasharray="7 7"
            strokeOpacity={0.55}
          />
        )}
        <Bar
          yAxisId="customers"
          dataKey="count"
          name="count"
          fill="url(#stockVolumeGradient)"
          radius={[5, 5, 0, 0]}
          barSize={18}
          opacity={0.8}
          animationDuration={900}
        />
        <Area
          yAxisId="impact"
          type="monotone"
          dataKey="value"
          name="value"
          stroke={trendColor}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#stockImpactGradient)"
          dot={false}
          activeDot={{ r: 6, fill: trendColor, stroke: '#ffffff', strokeWidth: 3 }}
          animationDuration={1200}
        />
        <Line
          yAxisId="impact"
          type="monotone"
          dataKey="value"
          stroke={trendColor}
          strokeWidth={4}
          dot={false}
          activeDot={false}
          animationDuration={1400}
        />
        {data.length > 8 && (
          <Brush
            dataKey="name"
            height={30}
            stroke="#334155"
            fill="#020617"
            travellerWidth={10}
          />
        )}
      </ComposedChart>
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
