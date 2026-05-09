import React, { useState, useEffect, useMemo } from 'react';
import {
    BookOpen,
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
    Briefcase
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CodexEntry, Role } from '../../types';
import Swal from 'sweetalert2';

interface CorporateCodexProps {
    userRole: Role;
    onBack: () => void;
}

export const CorporateCodex: React.FC<CorporateCodexProps> = ({ userRole, onBack }) => {
    const [entries, setEntries] = useState<CodexEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'circular' | 'policy'>('all');
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

    const isManager = userRole === 'admin' || userRole === 'manager';

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
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
                (window as any).pdfjsLib = pdfjsLib;
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(pdfjsLib);
            };
            document.head.appendChild(script);
        });
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
        return entries
            .filter(entry => {
                const matchesSearch = entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entry.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchesType = filterType === 'all' || entry.type === filterType;
                const matchesDept = filterDept === 'all' || entry.department === filterDept;
                return matchesSearch && matchesType && matchesDept;
            })
            .sort((a, b) => {
                const priorities = { critical: 0, urgent: 1, normal: 2 };
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                return priorities[a.priority as keyof typeof priorities] - priorities[b.priority as keyof typeof priorities];
            });
    }, [entries, searchTerm, filterType, filterDept]);

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
                            <img src={activeEntry.pages[currentPage]} alt="Page" className="w-full h-full object-contain pointer-events-none" />
                            <div className="absolute bottom-3 left-3 text-[10px] font-medium text-slate-400 bg-white/80 px-2 py-0.5 rounded">{currentPage + 1}</div>
                        </div>
                        <div className="flex-1 relative bg-slate-50 hidden md:block border-l border-slate-100">
                            {currentPage + 1 < totalPages ? (
                                <>
                                    <img src={activeEntry.pages[currentPage + 1]} alt="Page" className="w-full h-full object-contain pointer-events-none" />
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
                    <button disabled={currentPage === 0 || isFlipping} onClick={() => changePage(-2)} className="flex items-center gap-2 px-4 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-20 text-xs font-medium"><ChevronLeft size={16} />Previous</button>
                    <div className="px-4 h-9 bg-white/5 border border-white/10 rounded-lg flex items-center">
                        <span className="text-white text-sm font-semibold">{Math.floor(currentPage / 2) + 1} <span className="text-white/30 mx-0.5">/</span> {Math.ceil(totalPages / 2)}</span>
                    </div>
                    <button disabled={currentPage >= totalPages - 2 || isFlipping} onClick={() => changePage(2)} className="flex items-center gap-2 px-4 h-9 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-20 text-xs font-medium">Next<ChevronRight size={16} /></button>
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
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden">
                <div id="codex-editor-description" className="sr-only">Form to create or update corporate documents, policies, and circulars.</div>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 id="codex-editor-title" className="text-base font-bold text-slate-900">{editorData.id ? 'Edit Document' : 'New Document'}</h3>
                    <button onClick={() => setIsEditorOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Title</label>
                            <input type="text" value={editorData.title} onChange={e => setEditorData(prev => ({ ...prev, title: e.target.value }))} className="w-full bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Department</label>
                            <select title="Dept" value={editorData.department} onChange={e => setEditorData(prev => ({ ...prev, department: e.target.value }))} className="w-full bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors">
                                <option value="all">All Departments</option>
                                <option value="HR">Human Resources</option>
                                <option value="Operations">Operations</option>
                                <option value="IT">Information Tech</option>
                                <option value="Finance">Finance</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Type & Priority</label>
                            <div className="flex gap-2">
                                <select title="Type" value={editorData.type} onChange={e => setEditorData(prev => ({ ...prev, type: e.target.value as any }))} className="flex-1 bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors">
                                    <option value="circular">Circular</option>
                                    <option value="policy">Policy</option>
                                </select>
                                <select title="Priority" value={editorData.priority} onChange={e => setEditorData(prev => ({ ...prev, priority: e.target.value as any }))} className="flex-1 bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors">
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Publish Date</label>
                            <input type="date" value={editorData.publishDate} onChange={e => setEditorData(prev => ({ ...prev, publishDate: e.target.value }))} className="w-full bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Tags (comma separated)</label>
                            <input type="text" value={editorData.tags?.join(', ')} onChange={e => setEditorData(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()) }))} className="w-full bg-white border border-slate-200 h-10 px-3 rounded-lg outline-none text-sm focus:border-slate-400 transition-colors" placeholder="HR, Update, 2024" />
                        </div>
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="flex items-center gap-2.5 h-10 px-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                                <input type="checkbox" checked={editorData.isPublished} onChange={e => setEditorData(prev => ({ ...prev, isPublished: e.target.checked }))} className="w-4 h-4 rounded accent-slate-900" />
                                <span className="text-xs font-medium text-slate-600">Published</span>
                            </label>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-slate-500">Assets (PDF / Images)</label>
                        <label className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors">
                            {isProcessingPdf ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            <span className="text-xs font-medium mt-1">Upload files</span>
                            <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" disabled={isProcessingPdf} />
                        </label>
                        {editorData.pages && editorData.pages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {editorData.pages.map((page, idx) => (
                                    <div key={idx} className="relative w-14 h-18 rounded-md border border-slate-200 overflow-hidden group">
                                        <img src={page} className="w-full h-full object-cover" alt="page" />
                                        <button onClick={() => setEditorData(prev => ({ ...prev, pages: prev.pages?.filter((_, i) => i !== idx) }))} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={() => setIsEditorOpen(false)} className="px-4 h-9 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 h-9 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors">Save Document</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/80 p-4 md:p-8">
            <div className="max-w-[1400px] mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                                <BookOpen size={16} className="text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900">Corporate Codex</h1>
                        </div>
                        <p className="text-xs text-slate-400 ml-12">Circulars, policies & company documents</p>
                    </div>
                    <div className="flex gap-2">
                        {isManager && (
                            <button
                                onClick={() => { setEditorData({ title: '', description: '', type: 'circular', priority: 'normal', publishDate: new Date().toISOString().split('T')[0], pages: [], isPublished: true, department: 'all', tags: [] }); setIsEditorOpen(true); }}
                                className="flex items-center gap-2 px-4 h-9 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                            >
                                <Plus size={15} /> New Document
                            </button>
                        )}
                        <button onClick={onBack} className="px-4 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Back</button>
                    </div>
                </header>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by title, description or #tags..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 h-10 pl-10 pr-4 rounded-lg text-sm outline-none focus:border-slate-400 transition-colors"
                        />
                    </div>
                    <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
                        {(['all', 'circular', 'policy'] as const).map(type => (
                            <button key={type} onClick={() => setFilterType(type)} className={`px-4 h-8 rounded-md text-xs font-semibold capitalize transition-all ${filterType === type ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar */}
                    <aside className="w-full md:w-56 flex-shrink-0 space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Departments</p>
                        {[
                            { id: 'all', label: 'All Files', icon: Briefcase },
                            { id: 'HR', label: 'Human Resources', icon: Users },
                            { id: 'Operations', icon: Zap, label: 'Operations' },
                            { id: 'IT', icon: Globe, label: 'Info Tech' },
                            { id: 'Finance', icon: ShieldAlert, label: 'Finance' }
                        ].map(dept => (
                            <button
                                key={dept.id}
                                onClick={() => setFilterDept(dept.id)}
                                className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg transition-all text-left ${filterDept === dept.id ? 'bg-slate-900 text-white' : 'hover:bg-white text-slate-500 hover:text-slate-900'}`}
                            >
                                <dept.icon size={16} className={filterDept === dept.id ? 'text-white/70' : 'text-slate-400'} />
                                <span className="text-xs font-semibold">{dept.label}</span>
                            </button>
                        ))}
                    </aside>

                    {/* Grid */}
                    <div className="flex-1">
                        {isLoading ? (
                            <div className="flex justify-center py-32"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                                <BookOpen size={32} className="mb-3 text-slate-300" />
                                <p className="text-sm font-medium">No documents found</p>
                                <p className="text-xs mt-1">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredEntries.map(entry => (
                                    <div key={entry.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-md hover:border-slate-300 transition-all">
                                        {/* Cover Image */}
                                        <div className="h-44 bg-slate-100 relative group cursor-pointer" onClick={() => { setActiveEntry(entry); setCurrentPage(0); }}>
                                            <img src={entry.pages[0]} className="w-full h-full object-cover" alt="cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                            <div className="absolute top-3 left-3 flex gap-1.5">
                                                {!entry.isPublished && <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white rounded text-[10px] font-semibold">Draft</span>}
                                                {entry.department && entry.department !== 'all' && (
                                                    <span className="px-2 py-0.5 bg-blue-500/20 backdrop-blur-sm text-blue-100 rounded text-[10px] font-semibold flex items-center gap-1">
                                                        <Briefcase size={9} />{entry.department}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="absolute top-3 right-3 flex gap-1.5">
                                                {entry.isPinned && <div className="w-6 h-6 bg-amber-500 text-white rounded-md flex items-center justify-center"><Pin size={12} fill="currentColor" /></div>}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${entry.priority === 'critical' ? 'bg-red-500 text-white' : entry.priority === 'urgent' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'}`}>{entry.priority}</span>
                                            </div>
                                            {/* Hover overlay */}
                                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold bg-slate-900/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">Open Document</span>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{entry.title}</h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{entry.publishDate} &middot; {entry.pages.length} pages</p>
                                            {entry.tags && entry.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {entry.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {isManager && (
                                                <div className="mt-auto pt-3 flex justify-end gap-1 border-t border-slate-100">
                                                    <button onClick={() => handleTogglePin(entry)} className={`p-1.5 rounded-md transition-all ${entry.isPinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'}`}><Pin size={14} fill={entry.isPinned ? "currentColor" : "none"} /></button>
                                                    <button onClick={() => { setEditorData(entry); setIsEditorOpen(true); }} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-slate-50 rounded-md transition-all"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-50 rounded-md transition-all"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
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
