import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { HRRequest } from '../../types';
import {
    Search,
    CheckCircle2,
    XCircle,
    FileText as FileTextIcon,
    Clock,
    Loader2,
    Filter,
    CalendarDays,
    Download,
    RefreshCw,
    ChevronDown,
    Eye
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { generateDocumentBlob } from '../lib/docGenerator';

type FilterStatus = 'all' | 'Pending' | 'Approved' | 'Rejected' | 'Completed';
type FilterType = 'all' | 'Document' | 'Vacation Request';

export const HRRequestsSection: React.FC = () => {
    const [requests, setRequests] = useState<HRRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [typeFilter, setTypeFilter] = useState<FilterType>('all');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setIsLoading(true);
        const data = await supabase.hrRequests.list();
        setRequests(data);
        setIsLoading(false);
    };

    const updateStatus = async (id: string, status: 'Approved' | 'Rejected' | 'Completed') => {
        try {
            await supabase.hrRequests.updateStatus(id, status);
            setNotice({ type: 'success', message: `Request marked ${status}.` });
            await loadRequests();
        } catch (error) {
            console.error('HR status update failed:', error);
            setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update HR request status.' });
        }
    };

    const generateWordDocument = async (req: HRRequest) => {
        try {
            const typesToGenerate: string[] = [];

            if (req.docTypes.some(t => t.toLowerCase().includes('experience'))) typesToGenerate.push('Experience Certificate');
            if (req.docTypes.some(t => t.toLowerCase().includes('employment'))) typesToGenerate.push('Employment Certificate');
            if (req.docTypes.some(t => t.toLowerCase().includes('salary'))) typesToGenerate.push('Salary Certificate');

            if (typesToGenerate.length === 0) {
                const blob = await generateDocumentBlob(req);
                saveAs(blob, `HR_Request_${req.refNum}_Generic.docx`);
            } else {
                for (const type of typesToGenerate) {
                    const blob = await generateDocumentBlob(req, type);
                    const simpleType = type.split(' ')[0];
                    saveAs(blob, `HR_Request_${req.refNum}_${simpleType}.docx`);
                }
            }
        } catch (error) {
            console.error("Error generating document:", error);
            setNotice({ type: 'error', message: 'Failed to generate document. Please try again.' });
        }
    };

    const filteredRequests = requests.filter(r => {
        const matchesSearch =
            r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.refNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.cpr.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesType = typeFilter === 'all' || r.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    // Stats
    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'Pending').length,
        approved: requests.filter(r => r.status === 'Approved').length,
        completed: requests.filter(r => r.status === 'Completed').length,
        vacations: requests.filter(r => r.type === 'Vacation Request').length,
        documents: requests.filter(r => r.type !== 'Vacation Request').length,
    };

    const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
        Pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
        Approved: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
        Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
        Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {notice && (
                <div className={`rounded-lg border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                    {notice.message}
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Requests" value={stats.total} color="slate" />
                <StatCard label="Pending" value={stats.pending} color="amber" />
                <StatCard label="Approved" value={stats.approved} color="blue" />
                <StatCard label="Completed" value={stats.completed} color="emerald" />
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search by name, ref, or CPR..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="border-none outline-none text-sm font-medium text-slate-700 w-full placeholder:text-slate-400"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as FilterStatus)}
                            className="h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                            aria-label="Filter by Status"
                        >
                            <option value="all">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Completed">Completed</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as FilterType)}
                            className="h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none appearance-none cursor-pointer"
                            aria-label="Filter by Type"
                        >
                            <option value="all">All Types</option>
                            <option value="Document">Documents</option>
                            <option value="Vacation Request">Vacation</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    <button
                        onClick={loadRequests}
                        className="h-9 w-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:border-brand/30 hover:bg-brand/5 hover:text-brand transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="operational-panel overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference</th>
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee</th>
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</th>
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Details</th>
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredRequests.length > 0 ? (
                                    filteredRequests.map((req) => {
                                        const sc = statusColors[req.status] || statusColors.Pending;
                                        const isExpanded = expandedRow === req.id;
                                        return (
                                            <React.Fragment key={req.id}>
                                                <tr className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{req.refNum}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">
                                                                {req.employeeName.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-slate-900">{req.employeeName}</div>
                                                                <div className="text-[11px] text-slate-400">CPR: {req.cpr}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {req.type === 'Vacation Request' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                                                <CalendarDays className="w-3 h-3" />
                                                                {req.leaveType || 'Vacation'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                                                <FileTextIcon className="w-3 h-3" />
                                                                Document
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {req.type === 'Vacation Request' ? (
                                                            <div className="space-y-1">
                                                                <div className="text-xs font-semibold text-slate-700">
                                                                    {req.holidayFrom} → {req.holidayTo}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{req.daysCount} days</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                {req.docTypes.slice(0, 2).map((type, idx) => (
                                                                    <span key={idx} className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                                        {type === 'Others' && req.otherDocType ? req.otherDocType : type}
                                                                    </span>
                                                                ))}
                                                                {req.docTypes.length > 2 && (
                                                                    <span className="text-[11px] font-medium text-slate-400">+{req.docTypes.length - 2}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></div>
                                                            {req.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {/* Expand/Details */}
                                                            <button
                                                                onClick={() => setExpandedRow(isExpanded ? null : req.id)}
                                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>

                                                            {/* Download doc */}
                                                            {req.type !== 'Vacation Request' && (
                                                                <button
                                                                    onClick={() => generateWordDocument(req)}
                                                                    className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-600 transition-all"
                                                                    title="Download Word"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            {/* Approve/Reject */}
                                                            {req.status === 'Pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => updateStatus(req.id, 'Approved')}
                                                                        className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-500 hover:text-emerald-600 transition-all"
                                                                        title="Approve"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updateStatus(req.id, 'Rejected')}
                                                                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600 transition-all"
                                                                        title="Reject"
                                                                    >
                                                                        <XCircle className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Details Row */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={6} className="px-5 py-4 bg-slate-50/80 border-t border-slate-100">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                                {req.type === 'Vacation Request' ? (
                                                                    <>
                                                                        <DetailItem label="Last Vacation" value={req.lastVacationDate} />
                                                                        <DetailItem label="Job Title" value={req.jobTitle} />
                                                                        <DetailItem label="Department" value={req.department} />
                                                                        <DetailItem label="Location" value={req.location} />
                                                                        {req.notes && <DetailItem label="Notes" value={req.notes} span />}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <DetailItem label="Passport Name" value={req.passportName} />
                                                                        <DetailItem label="Passport No" value={req.passport} />
                                                                        <DetailItem label="NHRA License" value={req.license} />
                                                                        <DetailItem label="Sponsor" value={req.sponsor} />
                                                                        <DetailItem label="Join Date" value={req.joinDate} />
                                                                        <DetailItem label="Delivery" value={req.deliveryMethod} />
                                                                        <DetailItem label="Needed By" value={req.reqDate} />
                                                                        <DetailItem label="Email" value={req.email} />
                                                                        {req.salary && <DetailItem label="Salary" value={`${req.salary} BHD`} />}
                                                                        {req.docReason && <DetailItem label="Purpose" value={req.docReason} span />}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-16 text-center">
                                            <div className="text-slate-400">
                                                <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
                                                <p className="text-sm font-medium">No requests found</p>
                                                <p className="text-xs mt-1">Try adjusting your search or filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                {!isLoading && filteredRequests.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">
                            Showing {filteredRequests.length} of {requests.length} requests
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Helper Components ---

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => {
    const colorMap: Record<string, string> = {
        slate: 'bg-slate-50 border-slate-200 text-slate-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
    return (
        <div className={`px-4 py-3 rounded-lg border ${colorMap[color] || colorMap.slate}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</div>
        </div>
    );
};

const DetailItem = ({ label, value, span }: { label: string; value?: string; span?: boolean }) => (
    <div className={span ? 'col-span-2 md:col-span-4' : ''}>
        <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-0.5">{label}</span>
        <span className="text-sm font-medium text-slate-700">{value || '—'}</span>
    </div>
);
