import React, { useState, useEffect, useMemo } from 'react';
import {
    BookOpen,
    BadgeCheck,
    Plus,
    Trash2,
    ChevronLeft,
    ChevronRight,
    X,
    ShieldAlert,
    Loader2,
    Search,
    Zap,
    Maximize2,
    ZoomIn,
    ZoomOut,
    Pin,
    Edit2,
    Users,
    Globe,
    Briefcase,
    type LucideIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CodexEntry, Role } from '../../types';
import Swal from 'sweetalert2';
import { isManagerRole } from '../../lib/access';
import { BackToModulesButton } from '../shared';

interface CorporateCodexProps {
    userRole: Role;
    onBack: () => void;
}

type CodexFilterType = 'all' | 'circular' | 'policy';

const codexTypeOptions: Array<{ id: CodexFilterType; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'circular', label: 'Circulars' },
    { id: 'policy', label: 'Policies' }
];

const departmentOptions: Array<{ id: string; label: string; icon: LucideIcon }> = [
    { id: 'all', label: 'All Files', icon: Briefcase },
    { id: 'HR', label: 'Human Resources', icon: Users },
    { id: 'Operations', label: 'Operations', icon: Zap },
    { id: 'IT', label: 'Info Tech', icon: Globe },
    { id: 'Finance', label: 'Finance', icon: ShieldAlert }
];

const priorityStyles: Record<CodexEntry['priority'], string> = {
    critical: 'border-rose-200 bg-rose-50 text-rose-700',
    urgent: 'border-amber-200 bg-amber-50 text-amber-700',
    normal: 'border-slate-200 bg-slate-50 text-slate-600'
};

const typeStyles: Record<CodexEntry['type'], string> = {
    circular: 'border-blue-100 bg-blue-50 text-blue-700',
    policy: 'border-brand/10 bg-brand/5 text-brand'
};

const formatCodexDate = (value?: string) => {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CodexMetricCard = ({
    icon: Icon,
    label,
    value,
    hint,
    tone = 'slate'
}: {
    icon: LucideIcon;
    label: string;
    value: number | string;
    hint: string;
    tone?: 'brand' | 'amber' | 'emerald' | 'slate';
}) => {
    const toneClass = tone === 'brand'
        ? 'border-brand/10 bg-brand/5 text-brand'
        : tone === 'amber'
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : tone === 'emerald'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600';

    return (
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClass}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black tabular-nums tracking-tight text-slate-950">{value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                </div>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-slate-500">{hint}</p>
        </article>
    );
};

export const CorporateCodex: React.FC<CorporateCodexProps> = ({ userRole, onBack }) => {
    const [entries, setEntries] = useState<CodexEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<CodexFilterType>('all');
    const [isFlipping, setIsFlipping] = useState(false);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [panning, setPanning] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [filterDept, setFilterDept] = useState('all');

    const [editorData, setEditorData] = useState<Partial<CodexEntry>>({
        title: '',
        description: '',
        type: 'circular',
        priority: 'normal',
        publishDate: new Date().toISOString().split('T')[0],
        pages: [],
        isPublished: true,
        department: 'all',
        tags: []
    });

    const isManager = isManagerRole(userRole);

    useEffect(() => {
        fetchEntries();
        loadPdfJs();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeEntry || isEditorOpen) return;
            if (e.key === 'Escape') setActiveEntry(null);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeEntry, isEditorOpen]);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const data = await supabase.codex.list();
            const visibleData = isManager ? data : data.filter(e => e.isPublished);
            setEntries(visibleData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPdfJs = async () => {
        if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
        const [pdfjsLib, worker] = await Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.mjs?url')
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
        (window as any).pdfjsLib = pdfjsLib;
        return pdfjsLib;
    };

    const processPdf = async (file: File) => {
        setIsProcessingPdf(true);
        try {
            const pdfjsLib = await loadPdfJs() as any;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pageImages: string[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context!, viewport }).promise;
                pageImages.push(canvas.toDataURL('image/jpeg', 0.8));
            }
            setEditorData(prev => ({ ...prev, pages: [...(prev.pages || []), ...pageImages] }));
        } catch (err) {
            Swal.fire('Error', 'Failed to process PDF.', 'error');
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const filteredEntries = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return entries
            .filter(entry => {
                const matchesSearch = !normalizedSearch ||
                    entry.title.toLowerCase().includes(normalizedSearch) ||
                    Boolean(entry.description?.toLowerCase().includes(normalizedSearch)) ||
                    Boolean(entry.tags?.some(tag => tag.toLowerCase().includes(normalizedSearch)));
                const matchesType = filterType === 'all' || entry.type === filterType;
                const matchesDept = filterDept === 'all' || (entry.department || 'all') === filterDept;
                return matchesSearch && matchesType && matchesDept;
            })
            .sort((a, b) => {
                const priorities = { critical: 0, urgent: 1, normal: 2 };
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                return priorities[a.priority as keyof typeof priorities] - priorities[b.priority as keyof typeof priorities];
            });
    }, [entries, searchTerm, filterType, filterDept]);

    const codexStats = useMemo(() => ({
        total: entries.length,
        published: entries.filter(entry => entry.isPublished).length,
        drafts: entries.filter(entry => !entry.isPublished).length,
        pinned: entries.filter(entry => entry.isPinned).length,
        actionItems: entries.filter(entry => entry.priority === 'critical' || entry.priority === 'urgent').length
    }), [entries]);

    const departmentCounts = useMemo(() => {
        return departmentOptions.reduce<Record<string, number>>((acc, dept) => {
            acc[dept.id] = dept.id === 'all'
                ? entries.length
                : entries.filter(entry => entry.department === dept.id).length;
            return acc;
        }, {});
    }, [entries]);

    const activeDepartmentLabel = departmentOptions.find(dept => dept.id === filterDept)?.label || 'All Files';
    const activeTypeLabel = codexTypeOptions.find(type => type.id === filterType)?.label || 'All';
    const hasActiveFilters = Boolean(searchTerm.trim()) || filterType !== 'all' || filterDept !== 'all';

    const openNewDocumentEditor = () => {
        setEditorData({
            title: '',
            description: '',
            type: 'circular',
            priority: 'normal',
            publishDate: new Date().toISOString().split('T')[0],
            pages: [],
            isPublished: true,
            department: 'all',
            tags: []
        });
        setIsEditorOpen(true);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setFilterType('all');
        setFilterDept('all');
    };

    const handleTogglePin = async (entry: CodexEntry) => {
        const targetId = entry.id;
        const newPinState = !entry.isPinned;
        setEntries(prev => prev.map(e => e.id === targetId ? { ...e, isPinned: newPinState } : e));
        try {
            await supabase.codex.upsert({ ...entry, isPinned: newPinState });
        } catch (err) {
            setEntries(prev => prev.map(e => e.id === targetId ? { ...e, isPinned: !newPinState } : e));
            Swal.fire('Error', 'Failed to update pin status', 'error');
        }
    };

    const handleSave = async () => {
        if (!editorData.title || editorData.pages?.length === 0) {
            Swal.fire('Error', 'Please provide a title and at least one page.', 'error');
            return;
        }
        try {
            await supabase.codex.upsert(editorData);
            Swal.fire('Success', 'Codex updated successfully', 'success');
            setIsEditorOpen(false);
            fetchEntries();
        } catch (err) {
            Swal.fire('Error', 'Failed to save entry', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This document will be permanently removed.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await supabase.codex.delete(id);
                fetchEntries();
                Swal.fire('Deleted!', 'Entry removed.', 'success');
            } catch (err) {
                Swal.fire('Error', 'Failed to delete', 'error');
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach((f: any) => {
            const file = f as File;
            if (file.type === 'application/pdf') {
                processPdf(file);
            } else if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setEditorData(prev => ({ ...prev, pages: [...(prev.pages || []), reader.result as string] }));
                };
                reader.readAsDataURL(file as Blob);
            }
        });
    };

    const changePage = (delta: number) => {
        setIsFlipping(true);
        setTimeout(() => {
            setCurrentPage(p => {
                const next = p + delta;
                return Math.max(0, Math.min(activeEntry!.pages.length - 1, next));
            });
            setIsFlipping(false);
        }, 300);
    };

    const renderMagazine = () => {
        if (!activeEntry) return null;
        const totalPages = activeEntry.pages.length;
        const totalSpreads = Math.max(1, Math.ceil(totalPages / 2));
        const currentPageImage = activeEntry.pages[currentPage];
        const nextPageImage = activeEntry.pages[currentPage + 1];

        return (
            <div
                className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-4 md:p-6 select-none overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="codex-viewer-title"
                aria-describedby="codex-viewer-description"
            >
                <div id="codex-viewer-description" className="sr-only">Document viewer for {activeEntry.title}. Consists of {totalPages} pages.</div>
                <h3 id="codex-viewer-title" className="sr-only">{activeEntry.title}</h3>
                <button
                    onClick={() => { setActiveEntry(null); setZoom(1); setPanning({ x: 0, y: 0 }); }}
                    className="fixed top-5 right-5 z-[260] w-9 h-9 bg-white/10 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors"
                    title="Close"
                >
                    <X size={18} />
                </button>

                <div className="relative flex-1 w-full flex items-center justify-center z-[220] overflow-hidden p-4">
                    <div
                        onMouseDown={() => zoom > 0.5 && setIsDragging(true)}
                        onMouseMove={(e) => {
                            if (isDragging && zoom > 0.5) {
                                setPanning(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                        style={{
                            transform: `translate(${panning.x}px, ${panning.y}px) scale(${zoom})`,
                            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                        }}
                        className={`relative w-full max-w-6xl h-auto max-h-[80vh] aspect-[1/1.41] md:aspect-[1.41/1] bg-white rounded-lg shadow-2xl overflow-hidden flex transition-all duration-500 origin-center ${isFlipping ? 'scale-[0.98] opacity-80 blur-[1px]' : ''}`}
                    >
                        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200/30 z-20 hidden md:block"></div>
                        <div className="flex-1 relative bg-slate-50 overflow-hidden">
                            {currentPageImage ? (
                                <img src={currentPageImage} alt="Page" className="w-full h-full object-contain pointer-events-none" />
                            ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center text-slate-300">
                                    <BookOpen size={40} />
                                    <span className="mt-3 text-xs font-black uppercase tracking-widest">No pages uploaded</span>
                                </div>
                            )}
                            <div className="absolute bottom-3 left-3 text-[10px] font-medium text-slate-400 bg-white/80 px-2 py-0.5 rounded">{totalPages ? currentPage + 1 : 0}</div>
                        </div>
                        <div className="flex-1 relative bg-slate-50 hidden md:block border-l border-slate-100">
                            {nextPageImage ? (
                                <>
                                    <img src={nextPageImage} alt="Page" className="w-full h-full object-contain pointer-events-none" />
                                    <div className="absolute bottom-3 right-3 text-[10px] font-medium text-slate-400 bg-white/80 px-2 py-0.5 rounded">{currentPage + 2}</div>
                                </>
                            ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center opacity-20"><BookOpen size={40} /></div>
                            )}
                        </div>
                    </div>

                    {/* Zoom controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-slate-800/80 backdrop-blur-md border border-white/10 p-1 rounded-lg gap-1 z-[240]">
                        <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"><ZoomOut size={16} /></button>
                        <div className="px-2 text-xs font-medium text-white/60 min-w-[48px] text-center">{Math.round(zoom * 100)}%</div>
                        <button onClick={() => setZoom(prev => Math.min(3, prev + 0.25))} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"><ZoomIn size={16} /></button>
                        <div className="w-px h-5 bg-white/10"></div>
                        <button onClick={() => { setZoom(1); setPanning({ x: 0, y: 0 }); }} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"><Maximize2 size={14} /></button>
                    </div>
                </div>

                {/* Page navigation */}
                <div className="z-[250] flex items-center gap-3 mt-4">
                    <button disabled={currentPage === 0 || totalPages < 2 || isFlipping} onClick={() => changePage(-2)} className="flex items-center gap-2 px-4 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-20 text-xs font-medium"><ChevronLeft size={16} />Previous</button>
                    <div className="px-4 h-9 bg-white/5 border border-white/10 rounded-lg flex items-center">
                        <span className="text-white text-sm font-semibold">{Math.floor(currentPage / 2) + 1} <span className="text-white/30 mx-0.5">/</span> {totalSpreads}</span>
                    </div>
                    <button disabled={totalPages < 2 || currentPage >= totalPages - 2 || isFlipping} onClick={() => changePage(2)} className="flex items-center gap-2 px-4 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-20 text-xs font-medium">Next<ChevronRight size={16} /></button>
                </div>
            </div>
        );
    };

    const renderEditor = () => (
        <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[250] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="codex-editor-title"
            aria-describedby="codex-editor-description"
        >
            <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <div id="codex-editor-description" className="sr-only">Form to create or update corporate documents, policies, and circulars.</div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Document editor</p>
                            <h3 id="codex-editor-title" className="mt-1 text-lg font-black tracking-tight text-slate-950">{editorData.id ? 'Edit Document' : 'New Document'}</h3>
                            <p className="mt-1 text-xs font-medium text-slate-500">Upload pages, set visibility, and classify the policy for faster retrieval.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsEditorOpen(false)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Title</label>
                            <input type="text" value={editorData.title} onChange={e => setEditorData(prev => ({ ...prev, title: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Department</label>
                            <select title="Dept" value={editorData.department} onChange={e => setEditorData(prev => ({ ...prev, department: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10">
                                {departmentOptions.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Type & Priority</label>
                            <div className="flex gap-2">
                                <select title="Type" value={editorData.type} onChange={e => setEditorData(prev => ({ ...prev, type: e.target.value as any }))} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10">
                                    <option value="circular">Circular</option>
                                    <option value="policy">Policy</option>
                                </select>
                                <select title="Priority" value={editorData.priority} onChange={e => setEditorData(prev => ({ ...prev, priority: e.target.value as any }))} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10">
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Publish Date</label>
                            <input type="date" value={editorData.publishDate} onChange={e => setEditorData(prev => ({ ...prev, publishDate: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10" />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-600">Tags (comma separated)</label>
                            <input type="text" value={editorData.tags?.join(', ')} onChange={e => setEditorData(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10" placeholder="HR, Update, 2026" />
                        </div>
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 transition-colors hover:border-brand/30 hover:bg-brand/5">
                                <input type="checkbox" checked={editorData.isPublished} onChange={e => setEditorData(prev => ({ ...prev, isPublished: e.target.checked }))} className="h-4 w-4 rounded accent-brand" />
                                <span className="text-xs font-bold text-slate-600">Published</span>
                            </label>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600">Assets (PDF / Images)</label>
                        <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-slate-400 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand">
                            {isProcessingPdf ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            <span className="mt-1 text-xs font-black uppercase tracking-widest">Upload files</span>
                            <span className="mt-0.5 text-[10px] font-medium text-slate-400">PDF, PNG, JPG</span>
                            <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" disabled={isProcessingPdf} />
                        </label>
                        {editorData.pages && editorData.pages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {editorData.pages.map((page, idx) => (
                                    <div key={idx} className="group relative h-20 w-14 overflow-hidden rounded-md border border-slate-200">
                                        <img src={page} className="w-full h-full object-cover" alt="page" />
                                        <button type="button" onClick={() => setEditorData(prev => ({ ...prev, pages: prev.pages?.filter((_, i) => i !== idx) }))} className="absolute inset-0 flex items-center justify-center bg-rose-600/80 text-white opacity-0 transition-opacity group-hover:opacity-100"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button type="button" onClick={() => setIsEditorOpen(false)} className="btn-secondary h-10 text-[10px] uppercase tracking-widest">Cancel</button>
                    <button type="button" onClick={handleSave} className="btn-primary h-10 text-[10px] uppercase tracking-widest">Save Document</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
                <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Knowledge module</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Corporate Codex</h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Publish, search, and review company policies, circulars, and operating documents.
                        </p>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                        {isManager && (
                            <button
                                type="button"
                                onClick={openNewDocumentEditor}
                                className="btn-primary h-10 text-[10px] uppercase tracking-widest"
                            >
                                <Plus className="h-4 w-4" />
                                New Document
                            </button>
                        )}
                        <BackToModulesButton onClick={onBack} />
                    </div>
                </header>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <CodexMetricCard icon={BookOpen} label="Total docs" value={codexStats.total} hint="Visible documents in this library." tone="brand" />
                    <CodexMetricCard icon={BadgeCheck} label="Published" value={codexStats.published} hint="Available to non-manager roles." tone="emerald" />
                    <CodexMetricCard icon={Pin} label="Pinned" value={codexStats.pinned} hint="Forced to the top of the library." tone="amber" />
                    <CodexMetricCard icon={ShieldAlert} label="Urgent" value={codexStats.actionItems} hint="Critical or urgent documents." />
                </div>

                <section className="operational-panel mb-6 p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Library control</p>
                            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Find the right document fast</h2>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {activeDepartmentLabel}
                                </span>
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {activeTypeLabel}
                                </span>
                                <span className="rounded-md border border-brand/10 bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                    {filteredEntries.length} visible
                                </span>
                                {isManager && (
                                    <span className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                        {codexStats.drafts} drafts
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid w-full gap-3 xl:w-auto xl:min-w-[760px] xl:grid-cols-[minmax(260px,1fr)_auto_auto]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search title, description, or tags..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                />
                            </div>
                            <div className="tab-nav overflow-x-auto">
                                {codexTypeOptions.map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFilterType(type.id)}
                                        className={`tab-item whitespace-nowrap ${filterType === type.id ? 'tab-item-brand' : ''}`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="btn-secondary h-10 justify-center text-[10px] uppercase tracking-widest"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="space-y-4">
                        <section className="operational-panel p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Departments</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">Scope the library by team.</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
                                    <Briefcase className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                {departmentOptions.map(dept => (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => setFilterDept(dept.id)}
                                        className={`flex h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left transition-all ${
                                            filterDept === dept.id
                                                ? 'border-brand/20 bg-brand/5 text-brand shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:bg-brand/5 hover:text-brand'
                                        }`}
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <dept.icon className="h-4 w-4 shrink-0" />
                                            <span className="truncate text-xs font-black">{dept.label}</span>
                                        </span>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-500">
                                            {departmentCounts[dept.id] || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="operational-panel p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Library mix</p>
                            <div className="mt-4 space-y-3">
                                {codexTypeOptions.filter(type => type.id !== 'all').map(type => {
                                    const value = entries.filter(entry => entry.type === type.id).length;
                                    const percentage = codexStats.total ? Math.round((value / codexStats.total) * 100) : 0;
                                    return (
                                        <div key={type.id}>
                                            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600">
                                                <span>{type.label}</span>
                                                <span>{value}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-100">
                                                <div className="h-2 rounded-full bg-brand" style={{ width: `${percentage}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </aside>

                    <main className="min-w-0">
                        {isLoading ? (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div key={index} className="operational-panel overflow-hidden">
                                        <div className="skeleton h-52 rounded-none" />
                                        <div className="space-y-3 p-4">
                                            <div className="skeleton-text h-4 w-3/4" />
                                            <div className="skeleton-text h-3 w-1/2" />
                                            <div className="skeleton-text h-3 w-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="operational-panel empty-state min-h-[420px] px-4">
                                <div className="empty-state-icon">
                                    <BookOpen className="h-8 w-8" />
                                </div>
                                <p className="empty-state-title">No documents found</p>
                                <p className="empty-state-desc">Try a different search, type, or department filter.</p>
                                {hasActiveFilters && (
                                    <button type="button" onClick={resetFilters} className="btn-secondary mt-5 text-[10px] uppercase tracking-widest">
                                        Reset filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                {filteredEntries.map(entry => {
                                    const cover = entry.pages?.[0];
                                    const tags = (entry.tags || []).filter(Boolean).slice(0, 3);
                                    const departmentLabel = entry.department && entry.department !== 'all' ? entry.department : 'All departments';
                                    return (
                                        <article key={entry.id} className="group flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md hover:shadow-brand/10">
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveEntry(entry); setCurrentPage(0); setZoom(1); setPanning({ x: 0, y: 0 }); }}
                                                    className="relative h-52 w-full overflow-hidden bg-slate-100 text-left focus-ring"
                                                >
                                                    {cover ? (
                                                        <img src={cover} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" alt={`${entry.title} cover`} />
                                                    ) : (
                                                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-300">
                                                            <BookOpen className="h-10 w-10" />
                                                            <span className="mt-2 text-[10px] font-black uppercase tracking-widest">No preview</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                                                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                                                        {!entry.isPublished && (
                                                            <span className="rounded-md border border-white/20 bg-white/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                                                                Draft
                                                            </span>
                                                        )}
                                                        <span className="rounded-md border border-white/15 bg-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                                                            {entry.pages?.length || 0} pages
                                                        </span>
                                                    </div>
                                                    <div className="absolute right-3 top-3 flex gap-1.5">
                                                        {entry.isPinned && (
                                                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm" title="Pinned">
                                                                <Pin className="h-3.5 w-3.5" fill="currentColor" />
                                                            </span>
                                                        )}
                                                        <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${priorityStyles[entry.priority]}`}>
                                                            {entry.priority}
                                                        </span>
                                                    </div>
                                                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                                                        <span className="rounded-md bg-slate-950/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                                                            Open Document
                                                        </span>
                                                        <span className={`ml-auto rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${typeStyles[entry.type]}`}>
                                                            {entry.type}
                                                        </span>
                                                    </div>
                                                </button>

                                                <div className="flex flex-1 flex-col p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h3 className="line-clamp-1 text-sm font-black tracking-tight text-slate-950">{entry.title}</h3>
                                                            <p className="mt-1 text-[11px] font-bold text-slate-400">{formatCodexDate(entry.publishDate)} · {departmentLabel}</p>
                                                        </div>
                                                        <BookOpen className="h-4 w-4 shrink-0 text-slate-300" />
                                                    </div>

                                                    {entry.description && (
                                                        <p className="mt-3 line-clamp-2 min-h-[40px] text-xs font-medium leading-5 text-slate-500">{entry.description}</p>
                                                    )}

                                                    {tags.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                                            {tags.map(tag => (
                                                                <span key={tag} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isManager && (
                                                        <div className="mt-auto flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                                                            <button
                                                                type="button"
                                                                title={entry.isPinned ? 'Unpin document' : 'Pin document'}
                                                                onClick={() => handleTogglePin(entry)}
                                                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                                                                    entry.isPinned
                                                                        ? 'bg-amber-50 text-amber-600'
                                                                        : 'text-slate-300 hover:bg-amber-50 hover:text-amber-600'
                                                                }`}
                                                            >
                                                                <Pin className="h-3.5 w-3.5" fill={entry.isPinned ? 'currentColor' : 'none'} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Edit document"
                                                                onClick={() => { setEditorData(entry); setIsEditorOpen(true); }}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-all hover:bg-brand/5 hover:text-brand"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Delete document"
                                                                onClick={() => handleDelete(entry.id)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-600"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            {activeEntry && renderMagazine()}
            {isEditorOpen && renderEditor()}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};
