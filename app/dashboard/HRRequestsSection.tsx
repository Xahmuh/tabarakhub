import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { HRRequest } from '../../types';
import {
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    Eye,
    FileCheck,
    FileText as FileTextIcon,
    Filter,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    XCircle
} from 'lucide-react';
import { generateDocumentBlob } from '../lib/docGenerator';

type FilterStatus = 'all' | 'Pending' | 'Approved' | 'Rejected' | 'Completed';
type FilterType = 'all' | 'Document' | 'Vacation Request';
type RequestActionStatus = 'Approved' | 'Rejected' | 'Completed';

const getNormalizedType = (request: HRRequest): Exclude<FilterType, 'all'> =>
    request.type === 'Vacation Request' ? 'Vacation Request' : 'Document';

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const getRequestSummary = (request: HRRequest) => {
    if (getNormalizedType(request) === 'Vacation Request') {
        return `${formatDate(request.holidayFrom)} -> ${formatDate(request.holidayTo)}`;
    }

    const documentNames = (request.docTypes || [])
        .slice(0, 2)
        .map(type => (type === 'Others' && request.otherDocType ? request.otherDocType : type));

    return documentNames.length > 0 ? documentNames.join(', ') : 'Document request';
};

const statusStyles: Record<HRRequest['status'], { bg: string; text: string; border: string; dot: string; icon: React.ElementType }> = {
    Pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500', icon: Clock },
    Approved: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500', icon: ShieldCheck },
    Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-500', icon: XCircle },
    Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500', icon: CheckCircle2 }
};

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

    const updateStatus = async (id: string, status: RequestActionStatus) => {
        try {
            await supabase.hrRequests.updateStatus(id, status);
            setNotice({ type: 'success', message: `Request marked ${status}.` });
            await loadRequests();
        } catch (error) {
            console.error('HR status update failed:', error);
            setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update HR request status.' });
        }
    };

    const generateWordDocument = async (request: HRRequest) => {
        try {
            const { saveAs } = await import('file-saver');
            const typesToGenerate: string[] = [];

            if (request.docTypes.some(type => type.toLowerCase().includes('experience'))) typesToGenerate.push('Experience Certificate');
            if (request.docTypes.some(type => type.toLowerCase().includes('employment'))) typesToGenerate.push('Employment Certificate');
            if (request.docTypes.some(type => type.toLowerCase().includes('salary'))) typesToGenerate.push('Salary Certificate');

            if (typesToGenerate.length === 0) {
                const blob = await generateDocumentBlob(request);
                saveAs(blob, `HR_Request_${request.refNum}_Generic.docx`);
            } else {
                for (const type of typesToGenerate) {
                    const blob = await generateDocumentBlob(request, type);
                    const simpleType = type.split(' ')[0];
                    saveAs(blob, `HR_Request_${request.refNum}_${simpleType}.docx`);
                }
            }
        } catch (error) {
            console.error('Error generating document:', error);
            setNotice({ type: 'error', message: 'Failed to generate document. Please try again.' });
        }
    };

    const filteredRequests = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return requests.filter(request => {
            const normalizedType = getNormalizedType(request);
            const matchesSearch =
                !query ||
                request.employeeName.toLowerCase().includes(query) ||
                request.refNum.toLowerCase().includes(query) ||
                request.cpr.includes(query) ||
                (request.email || '').toLowerCase().includes(query);
            const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
            const matchesType = typeFilter === 'all' || normalizedType === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [requests, searchTerm, statusFilter, typeFilter]);

    const stats = useMemo(() => {
        const pending = requests.filter(request => request.status === 'Pending').length;
        const approved = requests.filter(request => request.status === 'Approved').length;
        const completed = requests.filter(request => request.status === 'Completed').length;
        const rejected = requests.filter(request => request.status === 'Rejected').length;
        const vacations = requests.filter(request => getNormalizedType(request) === 'Vacation Request').length;
        const documents = requests.filter(request => getNormalizedType(request) === 'Document').length;

        return {
            total: requests.length,
            pending,
            approved,
            completed,
            rejected,
            vacations,
            documents,
            open: pending + approved
        };
    }, [requests]);

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {notice && (
                <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                    <span>{notice.message}</span>
                    <button onClick={() => setNotice(null)} className="shrink-0 opacity-70 transition hover:opacity-100" aria-label="Dismiss notice">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="p-5 sm:p-6">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-700">
                                    <FileCheck className="h-3.5 w-3.5" />
                                    HR Admin Portal
                                </div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-950">Request Operations</h2>
                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                    Review employee documents and vacation requests, approve or reject pending work, and generate ready-to-share HR files.
                                </p>
                            </div>
                            <button
                                onClick={loadRequests}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/80 p-4 sm:p-5 lg:border-l lg:border-t-0">
                        <div className="grid grid-cols-2 gap-3">
                            <MetricTile label="Open Queue" value={stats.open} icon={Clock} tone="amber" />
                            <MetricTile label="Completed" value={stats.completed} icon={CheckCircle2} tone="emerald" />
                            <MetricTile label="Documents" value={stats.documents} icon={FileTextIcon} tone="blue" />
                            <MetricTile label="Vacation" value={stats.vacations} icon={CalendarDays} tone="red" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total Requests" value={stats.total} helper={`${filteredRequests.length} visible`} />
                <StatCard label="Pending Review" value={stats.pending} helper="Needs decision" tone="amber" />
                <StatCard label="Approved" value={stats.approved} helper="Ready to complete" tone="blue" />
                <StatCard label="Rejected" value={stats.rejected} helper="Declined requests" tone="rose" />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employee, reference, CPR, or email..."
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 pl-10 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <FilterSelect
                            icon={Filter}
                            value={statusFilter}
                            onChange={value => setStatusFilter(value as FilterStatus)}
                            label="Status"
                            options={[
                                ['all', 'All Status'],
                                ['Pending', 'Pending'],
                                ['Approved', 'Approved'],
                                ['Rejected', 'Rejected'],
                                ['Completed', 'Completed']
                            ]}
                        />
                        <FilterSelect
                            icon={FileTextIcon}
                            value={typeFilter}
                            onChange={value => setTypeFilter(value as FilterType)}
                            label="Type"
                            options={[
                                ['all', 'All Types'],
                                ['Document', 'Documents'],
                                ['Vacation Request', 'Vacation']
                            ]}
                        />
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Request Queue</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Sorted by newest request first.</p>
                        </div>
                        <span className="rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                            Showing {filteredRequests.length} / {requests.length}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading HR requests</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-5 py-3.5">Request</th>
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="px-5 py-3.5">Timeline</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRequests.map(request => (
                                        <React.Fragment key={request.id}>
                                            <RequestRows
                                                request={request}
                                                expandedRow={expandedRow}
                                                setExpandedRow={setExpandedRow}
                                                onGenerateDocument={generateWordDocument}
                                                onUpdateStatus={updateStatus}
                                            />
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 lg:hidden">
                            {filteredRequests.map(request => (
                                <React.Fragment key={request.id}>
                                    <MobileRequestCard
                                        request={request}
                                        expandedRow={expandedRow}
                                        setExpandedRow={setExpandedRow}
                                        onGenerateDocument={generateWordDocument}
                                        onUpdateStatus={updateStatus}
                                    />
                                </React.Fragment>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

const MetricTile = ({
    label,
    value,
    icon: Icon,
    tone
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    tone: 'red' | 'emerald' | 'blue' | 'amber';
}) => {
    const tones = {
        red: 'border-red-100 bg-red-50 text-red-700',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        blue: 'border-blue-100 bg-blue-50 text-blue-700',
        amber: 'border-amber-100 bg-amber-50 text-amber-700'
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone]}`}>
                <Icon className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{value}</p>
        </div>
    );
};

const StatCard = ({
    label,
    value,
    helper,
    tone = 'slate'
}: {
    label: string;
    value: number;
    helper: string;
    tone?: 'slate' | 'amber' | 'blue' | 'rose';
}) => {
    const tones = {
        slate: 'border-slate-200 bg-white text-slate-950',
        amber: 'border-amber-100 bg-amber-50 text-amber-800',
        blue: 'border-blue-100 bg-blue-50 text-blue-800',
        rose: 'border-rose-100 bg-rose-50 text-rose-800'
    };

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-bold opacity-60">{helper}</p>
        </div>
    );
};

const FilterSelect = ({
    icon: Icon,
    value,
    onChange,
    label,
    options
}: {
    icon: React.ElementType;
    value: string;
    onChange: (value: string) => void;
    label: string;
    options: Array<[string, string]>;
}) => (
    <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
            value={value}
            onChange={event => onChange(event.target.value)}
            className="h-11 w-full min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-black uppercase tracking-widest text-slate-600 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
            aria-label={`Filter by ${label}`}
        >
            {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>{optionLabel}</option>
            ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
);

const StatusBadge = ({ status }: { status: HRRequest['status'] }) => {
    const style = statusStyles[status] || statusStyles.Pending;
    const StatusIcon = style.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${style.bg} ${style.text} ${style.border}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status}
        </span>
    );
};

const TypeBadge = ({ request }: { request: HRRequest }) => (
    getNormalizedType(request) === 'Vacation Request' ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
            <CalendarDays className="h-3.5 w-3.5" />
            {request.leaveType || 'Vacation'}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
            <FileTextIcon className="h-3.5 w-3.5" />
            Document
        </span>
    )
);

const RequestRows = ({
    request,
    expandedRow,
    setExpandedRow,
    onGenerateDocument,
    onUpdateStatus
}: {
    request: HRRequest;
    expandedRow: string | null;
    setExpandedRow: (id: string | null) => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
}) => {
    const isExpanded = expandedRow === request.id;

    return (
        <React.Fragment>
            <tr className="group bg-white transition-colors hover:bg-slate-50/80">
                <td className="px-5 py-4">
                    <div className="space-y-1">
                        <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{request.refNum}</code>
                        <p className="text-[11px] font-bold text-slate-400">{formatDate(request.timestamp)}</p>
                    </div>
                </td>
                <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
                            {request.employeeName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{request.employeeName}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-400">CPR {request.cpr}</p>
                        </div>
                    </div>
                </td>
                <td className="px-5 py-4">
                    <TypeBadge request={request} />
                </td>
                <td className="px-5 py-4">
                    <p className="max-w-[260px] truncate text-sm font-bold text-slate-700">{getRequestSummary(request)}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                        {getNormalizedType(request) === 'Vacation Request' ? `${request.daysCount || 0} days` : request.deliveryMethod || 'Delivery not set'}
                    </p>
                </td>
                <td className="px-5 py-4">
                    <StatusBadge status={request.status} />
                </td>
                <td className="px-5 py-4">
                    <RequestActions
                        request={request}
                        isExpanded={isExpanded}
                        onToggleDetails={() => setExpandedRow(isExpanded ? null : request.id)}
                        onGenerateDocument={onGenerateDocument}
                        onUpdateStatus={onUpdateStatus}
                    />
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan={6} className="border-t border-slate-100 bg-slate-50/80 px-5 py-5">
                        <DetailsGrid request={request} />
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

const MobileRequestCard = ({
    request,
    expandedRow,
    setExpandedRow,
    onGenerateDocument,
    onUpdateStatus
}: {
    request: HRRequest;
    expandedRow: string | null;
    setExpandedRow: (id: string | null) => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
}) => {
    const isExpanded = expandedRow === request.id;

    return (
        <article className="bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{request.refNum}</code>
                    <h4 className="mt-3 truncate text-base font-black text-slate-950">{request.employeeName}</h4>
                    <p className="mt-1 text-xs font-bold text-slate-400">CPR {request.cpr}</p>
                </div>
                <StatusBadge status={request.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Type</p>
                    <div className="mt-2"><TypeBadge request={request} /></div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Submitted</p>
                    <p className="mt-2 text-xs font-black text-slate-700">{formatDate(request.timestamp)}</p>
                </div>
            </div>

            <p className="mt-4 text-sm font-bold text-slate-700">{getRequestSummary(request)}</p>

            <div className="mt-4">
                <RequestActions
                    request={request}
                    isExpanded={isExpanded}
                    onToggleDetails={() => setExpandedRow(isExpanded ? null : request.id)}
                    onGenerateDocument={onGenerateDocument}
                    onUpdateStatus={onUpdateStatus}
                    mobile
                />
            </div>

            {isExpanded && (
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <DetailsGrid request={request} />
                </div>
            )}
        </article>
    );
};

const RequestActions = ({
    request,
    isExpanded,
    onToggleDetails,
    onGenerateDocument,
    onUpdateStatus,
    mobile
}: {
    request: HRRequest;
    isExpanded: boolean;
    onToggleDetails: () => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
    mobile?: boolean;
}) => (
    <div className={`flex flex-wrap items-center ${mobile ? 'gap-2' : 'justify-end gap-1.5'}`}>
        <button
            onClick={onToggleDetails}
            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50`}
            title="View details"
        >
            <Eye className="h-3.5 w-3.5" />
            {isExpanded ? 'Hide' : 'Details'}
        </button>

        {getNormalizedType(request) === 'Document' && (
            <button
                onClick={() => onGenerateDocument(request)}
                className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700 transition-all hover:bg-blue-100`}
                title="Download Word"
            >
                <Download className="h-3.5 w-3.5" />
                Word
            </button>
        )}

        {request.status === 'Pending' && (
            <>
                <button
                    onClick={() => onUpdateStatus(request.id, 'Approved')}
                    className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-100`}
                    title="Approve"
                >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                </button>
                <button
                    onClick={() => onUpdateStatus(request.id, 'Rejected')}
                    className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-700 transition-all hover:bg-rose-100`}
                    title="Reject"
                >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                </button>
            </>
        )}

        {request.status === 'Approved' && (
            <button
                onClick={() => onUpdateStatus(request.id, 'Completed')}
                className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-brand`}
                title="Mark completed"
            >
                <FileCheck className="h-3.5 w-3.5" />
                Complete
            </button>
        )}
    </div>
);

const DetailsGrid = ({ request }: { request: HRRequest }) => (
    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
        {getNormalizedType(request) === 'Vacation Request' ? (
            <>
                <DetailItem label="Last Vacation" value={request.lastVacationDate} />
                <DetailItem label="Job Title" value={request.jobTitle} />
                <DetailItem label="Department" value={request.department} />
                <DetailItem label="Location" value={request.location} />
                <DetailItem label="Flight Out" value={request.flightOut} />
                <DetailItem label="Flight Return" value={request.flightReturn} />
                <DetailItem label="Mobile" value={request.mobile} />
                <DetailItem label="Notes" value={request.notes} span />
            </>
        ) : (
            <>
                <DetailItem label="Passport Name" value={request.passportName} />
                <DetailItem label="Passport No" value={request.passport} />
                <DetailItem label="NHRA License" value={request.license} />
                <DetailItem label="Sponsor" value={request.sponsor} />
                <DetailItem label="Join Date" value={request.joinDate} />
                <DetailItem label="Delivery" value={request.deliveryMethod} />
                <DetailItem label="Needed By" value={request.reqDate} />
                <DetailItem label="Email" value={request.email} />
                <DetailItem label="Salary" value={request.salary ? `${request.salary} BHD` : undefined} />
                <DetailItem label="Purpose" value={request.docReason} span />
            </>
        )}
    </div>
);

const DetailItem = ({ label, value, span }: { label: string; value?: string; span?: boolean }) => (
    <div className={span ? 'sm:col-span-2 xl:col-span-4' : ''}>
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="font-bold text-slate-700">{value || '-'}</span>
    </div>
);

const EmptyState = () => (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
            <Search className="h-6 w-6" />
        </div>
        <h4 className="mt-5 text-lg font-black tracking-tight text-slate-950">No HR requests found</h4>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
            Try adjusting the search, status filter, or request type.
        </p>
    </div>
);
