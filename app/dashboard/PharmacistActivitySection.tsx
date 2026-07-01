import React, { useState, useEffect, useMemo } from 'react';
import { LostSale, Branch } from '../../types';
import { supabase } from '../../lib/supabase';
import { ChevronDown, ChevronRight, User, AlertCircle, TrendingUp, Users, ShoppingBag, ChevronLeft } from 'lucide-react';

const formatLostSalesTrackerValue = (value: number) =>
    (Math.round((Number(value) || 0) * 10) / 10).toFixed(1);

interface PharmacistActivityProps {
    sales: LostSale[];
    branches: Branch[];
}

export const PharmacistActivitySection: React.FC<PharmacistActivityProps> = ({ sales, branches }) => {
    const [pharmacistsMap, setPharmacistsMap] = useState<Record<string, string>>({});
    const [assignments, setAssignments] = useState<Record<string, Set<string>>>({});
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
    const [expandedInactiveBranches, setExpandedInactiveBranches] = useState<Set<string>>(new Set());
    const [expandedPharmacists, setExpandedPharmacists] = useState<Set<string>>(new Set());
    const [pharmacistPages, setPharmacistPages] = useState<Record<string, number>>({});
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch pharmacists names
            const { data: phData } = await supabase.client.from('pharmacists').select('id, name');
            if (phData) {
                const map: Record<string, string> = {};
                phData.forEach((p: any) => map[p.id] = p.name);
                setPharmacistsMap(map);
            }

            // 2. Fetch branch assignments to prevent "wrong branch" display
            const { data: assignData } = await supabase.client.from('pharmacist_branches').select('pharmacist_id, branch_id');
            if (assignData) {
                const map: Record<string, Set<string>> = {};
                assignData.forEach((a: any) => {
                    if (!map[a.pharmacist_id]) map[a.pharmacist_id] = new Set();
                    map[a.pharmacist_id].add(a.branch_id);
                });
                setAssignments(map);
            }
        };
        fetchData();
    }, []);

    // Initialize expanded branches to include all branches initially
    useEffect(() => {
        if (branches.length > 0 && expandedBranches.size === 0) {
            const populated = branches.filter(b => sales.some(s => s.branchId === b.id)).map(b => b.id);
            setExpandedBranches(new Set(populated));
        }
    }, [branches, sales]);

    const toggleBranch = (branchId: string) => {
        const newSet = new Set(expandedBranches);
        if (newSet.has(branchId)) {
            newSet.delete(branchId);
        } else {
            newSet.add(branchId);
        }
        setExpandedBranches(newSet);
    };

    const toggleInactiveBranch = (branchId: string) => {
        const newSet = new Set(expandedInactiveBranches);
        if (newSet.has(branchId)) {
            newSet.delete(branchId);
        } else {
            newSet.add(branchId);
        }
        setExpandedInactiveBranches(newSet);
    };

    const togglePharmacist = (pharmaId: string, branchId: string) => {
        const key = `${branchId}_${pharmaId}`;
        const newSet = new Set(expandedPharmacists);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
            // Reset to page 1 when expanding
            setPharmacistPages(prev => ({ ...prev, [key]: 1 }));
        }
        setExpandedPharmacists(newSet);
    };

    const changePharmaPage = (pharmaId: string, branchId: string, delta: number, maxPages: number) => {
        const key = `${branchId}_${pharmaId}`;
        setPharmacistPages(prev => {
            const currentPage = prev[key] || 1;
            const newPage = Math.min(Math.max(1, currentPage + delta), maxPages);
            return { ...prev, [key]: newPage };
        });
    };

    const activityData = useMemo(() => {
        const grouped: Record<string, { branchName: string; pharmacists: any[]; totalLoss: number }> = {};

        branches.forEach(branch => {
            // 1. Filter sales for this branch
            const branchSales = sales.filter(s => s.branchId === branch.id);

            // 2. Group by Pharmacist ID
            const pharmaStats: Record<string, { id: string; name: string; totalRevenue: number; customers: Set<string>; incidents: number, products: any[] }> = {};

            branchSales.forEach(s => {
                if (!pharmaStats[s.pharmacistId]) {
                    pharmaStats[s.pharmacistId] = {
                        id: s.pharmacistId,
                        name: s.pharmacistName || pharmacistsMap[s.pharmacistId] || 'Unknown Pharmacist',
                        totalRevenue: 0,
                        customers: new Set(),
                        incidents: 0,
                        products: []
                    };
                }
                pharmaStats[s.pharmacistId].totalRevenue += Number(s.totalValue || 0);
                const custId = s.sessionId || `${s.branchId}_${s.lostDate}_${s.lostHour}_${Math.floor(new Date(s.timestamp).getTime() / 1000)}`;
                pharmaStats[s.pharmacistId].customers.add(custId);
                pharmaStats[s.pharmacistId].incidents += 1;

                // Track products
                pharmaStats[s.pharmacistId].products.push({
                    name: s.productName,
                    qty: s.quantity,
                    value: s.totalValue,
                    timestamp: s.timestamp
                });
            });

            // 3. Convert to array and filter
            let pharmacistsList = Object.values(pharmaStats).map(p => ({
                ...p,
                uniqueCustomers: p.customers.size
            }));

            if (searchTerm) {
                pharmacistsList = pharmacistsList.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
            }

            pharmacistsList = pharmacistsList.filter(p => p.incidents > 0);
            pharmacistsList.sort((a, b) => b.totalRevenue - a.totalRevenue);

            if (pharmacistsList.length > 0) {
                const branchTotalLoss = pharmacistsList.reduce((sum, p) => sum + p.totalRevenue, 0);
                grouped[branch.id] = {
                    branchName: branch.name,
                    pharmacists: pharmacistsList,
                    totalLoss: branchTotalLoss
                };
            }
        });

        // Convert to array, sort by total loss, and return as sorted object entries or array
        return Object.entries(grouped)
            .sort((a, b) => b[1].totalLoss - a[1].totalLoss);
    }, [sales, branches, pharmacistsMap, assignments, searchTerm]);

    const inactiveData = useMemo(() => {
        const grouped: Record<string, { branchName: string; pharmacists: any[] }> = {};
        const pharmaIds = Object.keys(pharmacistsMap);

        branches.forEach(branch => {
            const inactiveInBranch: any[] = [];

            pharmaIds.forEach(pId => {
                // If pharmacist is assigned here BUT has NO sales in the current filtered period
                if (assignments[pId]?.has(branch.id)) {
                    const hasSales = sales.some(s => s.pharmacistId === pId && s.branchId === branch.id);
                    if (!hasSales) {
                        const name = pharmacistsMap[pId];
                        if (!searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase())) {
                            inactiveInBranch.push({ id: pId, name });
                        }
                    }
                }
            });

            if (inactiveInBranch.length > 0) {
                grouped[branch.id] = {
                    branchName: branch.name,
                    pharmacists: inactiveInBranch
                };
            }
        });

        return Object.entries(grouped).sort((a, b) => a[1].branchName.localeCompare(b[1].branchName));
    }, [sales, branches, pharmacistsMap, assignments, searchTerm]);

    if (Object.keys(activityData).length === 0) return null;

    return (
        <div className="bg-white rounded-[2.8rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col mt-6">
            <div className="px-10 py-8 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/50">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center">
                        <Users className="w-6 h-6 mr-3 text-brand" />
                        Pharmacist Activity per Branch
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">Performance breakdown by personnel</p>
                </div>
                <div className="relative group w-full max-w-xs">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <User size={14} />
                    </div>
                    <input
                        type="text"
                        placeholder="FILTER BY PHARMACIST NAME..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:border-brand focus:shadow-sm transition-all shadow-inner"
                    />
                </div>
            </div>

            <div className="p-6 md:p-10 space-y-6 bg-slate-50/20">
                {activityData.map(([branchId, data]: [string, any], branchIdx: number) => (
                    <div key={branchId} className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                        <button
                            onClick={() => toggleBranch(branchId)}
                            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">
                                    {branchIdx + 1}
                                </div>
                                <div className={`p-2 rounded-lg transition-transform duration-300 ${expandedBranches.has(branchId) ? 'bg-brand text-white rotate-90' : 'bg-slate-100 text-slate-400'}`}>
                                    <ChevronRight size={18} />
                                </div>
                                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{data.branchName}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        {data.pharmacists.length} Active Staff
                                    </span>
                                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100">
                                        {data.totalLoss.toFixed(2)} BHD Total
                                    </span>
                                </div>
                            </div>
                        </button>

                        {expandedBranches.has(branchId) && (
                            <div className="border-t border-slate-50 p-2 animate-in slide-in-from-top-2">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px]">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 first:rounded-tl-xl">Pharmacist Name</th>
                                                <th title="Total financial loss recorded by this pharmacist" className="text-center p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 cursor-help group">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <TrendingUp size={12} className="text-slate-300 group-hover:text-brand" />
                                                        <span>Total Loss (BHD)</span>
                                                    </div>
                                                </th>
                                                <th title="Number of unique customer visits grouped by session" className="text-center p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 cursor-help group">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <Users size={12} className="text-slate-300 group-hover:text-brand" />
                                                        <span>Lost Customers</span>
                                                    </div>
                                                </th>
                                                <th title="Total count of lost items recorded" className="text-center p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 last:rounded-tr-xl cursor-help group">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <ShoppingBag size={12} className="text-slate-300 group-hover:text-brand" />
                                                        <span>Total Incidents</span>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.pharmacists.map((p, idx) => {
                                                const isExpanded = expandedPharmacists.has(`${branchId}_${p.id}`);
                                                return (
                                                    <React.Fragment key={idx}>
                                                        <tr
                                                            onClick={() => togglePharmacist(p.id, branchId)}
                                                            className={`group hover:bg-slate-50/80 transition-colors border-b last:border-0 border-slate-50 cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                                                        >
                                                            <td className="p-5 pl-6">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className={`p-1 rounded transition-transform duration-300 ${isExpanded ? 'rotate-90 text-brand' : 'text-slate-300'}`}>
                                                                        <ChevronRight size={14} />
                                                                    </div>
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs ring-4 ring-white shadow-sm group-hover:bg-brand group-hover:text-white transition-all">
                                                                        {p.name.charAt(0)}
                                                                    </div>
                                                                    <span className="font-black text-slate-700 text-xs uppercase tracking-wide">{p.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <span className="font-black text-slate-900 text-sm bg-red-50 px-3 py-1 rounded-lg border border-red-100 group-hover:border-red-200 transition-colors">
                                                                    {formatLostSalesTrackerValue(p.totalRevenue)} BHD
                                                                </span>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <span className="font-bold text-slate-600 text-xs bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                                                                    {p.uniqueCustomers} Visits
                                                                </span>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <span className="font-bold text-slate-500 text-xs">
                                                                    {p.incidents} Item(s)
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-slate-50/30">
                                                                <td colSpan={4} className="p-0">
                                                                    <div className="p-6 pl-16 animate-in slide-in-from-top-2">
                                                                        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                                                            <table className="w-full text-left">
                                                                                <thead className="bg-slate-50/50">
                                                                                    <tr>
                                                                                        <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest pl-5">Product Details</th>
                                                                                        <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                                                                                        <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right pr-5">Value (BHD)</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-50">
                                                                                    {(() => {
                                                                                        const sortedProducts = p.products.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                                                                                        const currentPage = pharmacistPages[`${branchId}_${p.id}`] || 1;
                                                                                        const maxPages = Math.ceil(sortedProducts.length / 10);
                                                                                        const displayedProducts = sortedProducts.slice((currentPage - 1) * 10, currentPage * 10);

                                                                                        return displayedProducts.map((prod: any, pIdx: number) => (
                                                                                            <tr key={pIdx} className="hover:bg-slate-50/50 transition-colors">
                                                                                                <td className="p-3 pl-5">
                                                                                                    <p className="text-[10px] font-black text-slate-700 uppercase">{prod.name}</p>
                                                                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                                                                                                        {new Date(prod.timestamp).toLocaleString()}
                                                                                                    </p>
                                                                                                </td>
                                                                                                <td className="p-3 text-center text-[10px] font-black text-slate-500 tabular-nums">
                                                                                                    {prod.qty}
                                                                                                </td>
                                                                                                <td className="p-3 text-right pr-5 text-[10px] font-black text-slate-900 tabular-nums">
                                                                                                    {formatLostSalesTrackerValue(prod.value)}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ));
                                                                                    })()}
                                                                                </tbody>
                                                                            </table>

                                                                            {p.products.length > 10 && (
                                                                                <div className="p-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const maxPages = Math.ceil(p.products.length / 10);
                                                                                            changePharmaPage(p.id, branchId, -1, maxPages);
                                                                                        }}
                                                                                        disabled={(pharmacistPages[`${branchId}_${p.id}`] || 1) === 1}
                                                                                        className="p-2 bg-white text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-20"
                                                                                    >
                                                                                        <ChevronLeft size={14} />
                                                                                    </button>
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                                        PAGE {pharmacistPages[`${branchId}_${p.id}`] || 1} OF {Math.ceil(p.products.length / 10)}
                                                                                    </span>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const maxPages = Math.ceil(p.products.length / 10);
                                                                                            changePharmaPage(p.id, branchId, 1, maxPages);
                                                                                        }}
                                                                                        disabled={(pharmacistPages[`${branchId}_${p.id}`] || 1) === Math.ceil(p.products.length / 10)}
                                                                                        className="p-2 bg-white text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-20"
                                                                                    >
                                                                                        <ChevronRight size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
