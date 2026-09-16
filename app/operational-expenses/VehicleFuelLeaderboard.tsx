import React, { useEffect, useState, useMemo } from 'react';
import {
  Trophy, Gauge, TrendingUp, Search, Calendar, RefreshCw, Truck, Sparkles, Filter
} from 'lucide-react';
import { ExpenseFilters, VehicleOwnershipType } from '../../types';
import { expenseService } from '../../services/expenseService';
import { formatBhdAmount } from '../../utils/money';
import { BahrainLicensePlate } from './components/BahrainLicensePlate';

export interface VehicleLeaderboardItem {
  vehicleId: string;
  vehicleCode: string;
  plateNumber?: string;
  vehicleType?: string;
  ownershipType: VehicleOwnershipType;
  driverName?: string;
  fuelTotal: number;
  servicesTotal: number;
  totalExpense: number;
  totalLiters: number;
  totalDistanceKm: number;
  avgConsumptionPer100Km: number;
  kmPerLiter: number;
  costPerKm: number;
  efficiencyRating: 'excellent' | 'good' | 'average' | 'high';
}

type SortField = 'kmPerLiter' | 'avgConsumptionPer100Km' | 'costPerKm' | 'totalExpense' | 'totalDistanceKm';

export const VehicleFuelLeaderboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState<VehicleLeaderboardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'Internal' | 'External'>('all');
  const [sortField, setSortField] = useState<SortField>('kmPerLiter');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<ExpenseFilters>({
    branchId: 'all',
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const expenses = await expenseService.expenses.list(filters);

      const vehicleMap: Record<string, {
        vehicleId: string;
        vehicleCode: string;
        plateNumber?: string;
        vehicleType?: string;
        ownershipType: VehicleOwnershipType;
        driverName?: string;
        fuelTotal: number;
        servicesTotal: number;
        totalLiters: number;
        totalDistanceKm: number;
      }> = {};

      expenses.forEach(e => {
        if (!e.vehicleId && !e.plateNumber && !e.vehicleCode) return;
        const vKey = e.vehicleId || e.plateNumber || e.vehicleCode || 'unknown';

        if (!vehicleMap[vKey]) {
          vehicleMap[vKey] = {
            vehicleId: e.vehicleId || vKey,
            vehicleCode: e.vehicleCode || 'V-???',
            plateNumber: e.plateNumber,
            ownershipType: e.ownershipType || 'Internal',
            driverName: e.driverName,
            fuelTotal: 0,
            servicesTotal: 0,
            totalLiters: 0,
            totalDistanceKm: 0
          };
        }

        if (e.driverName && (!vehicleMap[vKey].driverName || vehicleMap[vKey].driverName === '—')) {
          vehicleMap[vKey].driverName = e.driverName;
        }

        if (e.categorySlug === 'fuel') {
          vehicleMap[vKey].fuelTotal += e.amount;
          if (e.fuelDetails) {
            const dist = Number(e.fuelDetails.distanceSincePrevious || 0);
            const ltrs = Number(e.fuelDetails.liters || 0);
            if (dist > 0) vehicleMap[vKey].totalDistanceKm += dist;
            if (ltrs > 0) vehicleMap[vKey].totalLiters += ltrs;
          }
        } else if (e.categorySlug === 'vehicle_services') {
          vehicleMap[vKey].servicesTotal += e.amount;
        }
      });

      const items: VehicleLeaderboardItem[] = Object.values(vehicleMap).map(v => {
        const totalExpense = v.fuelTotal + v.servicesTotal;
        const avgConsumptionPer100Km = v.totalDistanceKm > 0 ? (v.totalLiters / v.totalDistanceKm) * 100 : 0;
        const kmPerLiter = v.totalLiters > 0 ? v.totalDistanceKm / v.totalLiters : 0;
        const costPerKm = v.totalDistanceKm > 0 ? totalExpense / v.totalDistanceKm : 0;

        let efficiencyRating: 'excellent' | 'good' | 'average' | 'high' = 'good';
        if (avgConsumptionPer100Km === 0) {
          efficiencyRating = 'average';
        } else if (avgConsumptionPer100Km <= 4.0) {
          efficiencyRating = 'excellent';
        } else if (avgConsumptionPer100Km <= 7.5) {
          efficiencyRating = 'good';
        } else if (avgConsumptionPer100Km <= 10.0) {
          efficiencyRating = 'average';
        } else {
          efficiencyRating = 'high';
        }

        return {
          ...v,
          totalExpense,
          avgConsumptionPer100Km,
          kmPerLiter,
          costPerKm,
          efficiencyRating
        };
      });

      setLeaderboardData(items);
    } catch (err) {
      console.error('Error fetching fuel leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [filters]);

  const sortedLeaderboard = useMemo(() => {
    return leaderboardData
      .filter(item => {
        const matchQuery =
          (item.plateNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.vehicleCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.driverName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchOwnership = ownershipFilter === 'all' || item.ownershipType === ownershipFilter;
        return matchQuery && matchOwnership;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [leaderboardData, searchQuery, ownershipFilter, sortField, sortOrder]);

  const fleetStats = useMemo(() => {
    const totalKm = leaderboardData.reduce((acc, i) => acc + i.totalDistanceKm, 0);
    const totalLtrs = leaderboardData.reduce((acc, i) => acc + i.totalLiters, 0);
    const totalExp = leaderboardData.reduce((acc, i) => acc + i.totalExpense, 0);
    const avgKmL = totalLtrs > 0 ? totalKm / totalLtrs : 0;
    const avgCostKm = totalKm > 0 ? totalExp / totalKm : 0;
    return { totalKm, totalExp, avgKmL, avgCostKm, count: leaderboardData.length };
  }, [leaderboardData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'avgConsumptionPer100Km' || field === 'costPerKm' || field === 'totalExpense' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-5">
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
              <Trophy className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Fuel Efficiency Leaderboard</h3>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            ترتيب الأسطول حسب كفاءة استهلاك الوقود (كم / لتر) وتكلفة التشغيل لكل كيلو.
          </p>
        </div>

        <button
          onClick={fetchLeaderboard}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Fleet Summary Pills (Minimal Stats Bar) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fleet Efficiency</span>
            <span className="text-base font-black text-slate-900">{fleetStats.avgKmL > 0 ? `${fleetStats.avgKmL.toFixed(1)} KM/L` : '—'}</span>
          </div>
          <Gauge className="w-4 h-4 text-brand" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Avg. Cost / KM</span>
            <span className="text-base font-black text-slate-900">{fleetStats.avgCostKm > 0 ? `${fleetStats.avgCostKm.toFixed(3)} BHD` : '—'}</span>
          </div>
          <TrendingUp className="w-4 h-4 text-emerald-600" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fleet Distance</span>
            <span className="text-base font-black text-slate-900">{fleetStats.totalKm > 0 ? `${fleetStats.totalKm.toLocaleString()} KM` : '0'}</span>
          </div>
          <Truck className="w-4 h-4 text-slate-500" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tracked Vehicles</span>
            <span className="text-base font-black text-slate-900">{fleetStats.count} Vehicles</span>
          </div>
          <Sparkles className="w-4 h-4 text-amber-500" />
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plate number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-brand focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Ownership Segment */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setOwnershipFilter('all')}
              className={`px-3 py-1 font-bold rounded-md transition-all ${
                ownershipFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setOwnershipFilter('Internal')}
              className={`px-3 py-1 font-bold rounded-md transition-all ${
                ownershipFilter === 'Internal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Internal
            </button>
            <button
              onClick={() => setOwnershipFilter('External')}
              className={`px-3 py-1 font-bold rounded-md transition-all ${
                ownershipFilter === 'External' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Flexi
            </button>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Modern Minimal Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-xs font-medium">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
            Loading Leaderboard...
          </div>
        ) : sortedLeaderboard.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs font-medium">
            No vehicle logs found for selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-4">Vehicle Plate</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Distance</th>
                  <th className="py-3 px-3 text-right">Liters</th>
                  <th className="py-3 px-3 text-right">Expense</th>
                  <th className="py-3 px-3 text-right">
                    <button onClick={() => toggleSort('kmPerLiter')} className="hover:text-slate-900 inline-flex items-center gap-1 font-bold">
                      KM / Liter {sortField === 'kmPerLiter' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button onClick={() => toggleSort('costPerKm')} className="hover:text-slate-900 inline-flex items-center gap-1 font-bold">
                      Cost / KM {sortField === 'costPerKm' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedLeaderboard.map((v, idx) => {
                  const rank = idx + 1;
                  return (
                    <tr key={v.vehicleId} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-3 px-3 text-center font-black text-slate-400 text-[11px]">
                        {rank === 1 ? (
                          <span className="text-amber-500 font-black">#1</span>
                        ) : rank === 2 ? (
                          <span className="text-slate-500 font-black">#2</span>
                        ) : rank === 3 ? (
                          <span className="text-amber-800 font-black">#3</span>
                        ) : (
                          `#${rank}`
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <BahrainLicensePlate plateNumber={v.plateNumber || v.vehicleCode} size="sm" />
                      </td>

                      <td className="py-3 px-3">
                        {v.ownershipType === 'External' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            ⚡ Flexi
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                            Internal
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {v.totalDistanceKm > 0 ? `${v.totalDistanceKm.toLocaleString()} km` : '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {v.totalLiters > 0 ? `${v.totalLiters.toFixed(1)} L` : '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatBhdAmount(v.fuelTotal)} BHD
                      </td>

                      <td className="py-3 px-3 text-right font-black text-brand text-xs">
                        {v.kmPerLiter > 0 ? `${v.kmPerLiter.toFixed(1)}` : '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {v.costPerKm > 0 ? `${v.costPerKm.toFixed(3)} BHD` : '—'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {v.efficiencyRating === 'excellent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Excellent
                          </span>
                        ) : v.efficiencyRating === 'good' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Good
                          </span>
                        ) : v.efficiencyRating === 'average' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Normal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> High Fuel
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
