import React, { useState, useEffect } from 'react';
import {
    Settings,
    Plus,
    Trash2,
    Edit2,
    Store,
    Users,
    Globe,
    MessageCircle,
    Shield,
    Save,
    X,
    Search,
    ChevronRight,
    MapPin,
    CheckCircle2,
    Lock,
    Eye,
    Zap,
    Briefcase,
    Activity,
    ShoppingCart,
    FileText,
    Wallet,
    BookOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Branch, Pharmacist, FeaturePermission, Role } from '../../types';
import Swal from 'sweetalert2';

const FEATURES = [
    { id: 'lost_sales', label: 'Lost Sales Tracker', icon: Activity },
    { id: 'shortages', label: 'Shortages Tracker', icon: ShoppingCart },
    { id: 'spin_win', label: 'Spin & Win Dashboard', icon: Zap },
    { id: 'hr_requests', label: 'HR Portal', icon: FileText },
    { id: 'cash_flow', label: 'Cash Flow Planner', icon: Wallet },
    { id: 'cash_tracker', label: 'Branch Cash Tracker', icon: Briefcase },
    { id: 'corporate_codex', label: 'Corporate Codex', icon: BookOpen },
    { id: 'settings', label: 'Project Settings', icon: Settings }
];

const ROLES: Role[] = ['admin', 'manager', 'branch', 'accounts'];

export const ProjectSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'branches' | 'pharmacists' | 'permissions'>('branches');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form States
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isPharModalOpen, setIsPharModalOpen] = useState(false);
    const [branchForm, setBranchForm] = useState<Partial<Branch>>({ role: 'branch', isSpinEnabled: false, isItemsEntryEnabled: true, isKPIDashboardEnabled: true });
    const [pharForm, setPharForm] = useState<{ name: string; isActive: boolean; branchIds: string[]; id?: string }>({
        name: '',
        isActive: true,
        branchIds: []
    });

    // Permission States
    const [selectedBranchForPerms, setSelectedBranchForPerms] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<FeaturePermission[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [b, p] = await Promise.all([
                supabase.branches.list(),
                supabase.pharmacists.listAll()
            ]);
            setBranches(b);
            setPharmacists(p);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveBranch = async () => {
        if (!branchForm.code || !branchForm.name) {
            Swal.fire('Error', 'Code and Name are required', 'error');
            return;
        }
        try {
            await supabase.branches.upsert(branchForm);
            Swal.fire('Success', 'Branch saved successfully', 'success');
            setIsBranchModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error('Save Branch Error:', err);
            Swal.fire('Error', `Failed to save branch: ${err.message || 'Unknown error'}`, 'error');
        }
    };

    const handleDeleteBranch = async (id: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will permanently remove the branch/user.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await supabase.branches.delete(id);
                loadData();
                Swal.fire('Deleted!', 'Branch removed.', 'success');
            } catch (err) {
                Swal.fire('Error', 'Failed to delete', 'error');
            }
        }
    };

    const handleSavePharmacist = async () => {
        if (!pharForm.name) {
            Swal.fire('Error', 'Pharmacist name is required', 'error');
            return;
        }
        try {
            await supabase.pharmacists.upsert({ id: pharForm.id, name: pharForm.name, isActive: pharForm.isActive }, pharForm.branchIds);
            Swal.fire('Success', 'Pharmacist saved successfully', 'success');
            setIsPharModalOpen(false);
            loadData();
        } catch (err: any) {
            console.error('Save Pharmacist Error:', err);
            Swal.fire('Error', `Failed to save pharmacist: ${err.message || 'Unknown error'}`, 'error');
        }
    };

    const loadPermissions = async (branchId: string) => {
        setSelectedBranchForPerms(branchId);
        const perms = await supabase.permissions.listForBranch(branchId);
        setPermissions(perms);
    };

    const handleUpdatePermission = async (featureName: string, accessLevel: 'read' | 'edit' | 'none') => {
        if (!selectedBranchForPerms) return;
        try {
            await supabase.permissions.upsert({
                branchId: selectedBranchForPerms,
                featureName,
                accessLevel
            });
            // Update local state
            setPermissions(prev => {
                const existingIdx = prev.findIndex(p => p.featureName === featureName);
                if (existingIdx >= 0) {
                    const newPerms = [...prev];
                    newPerms[existingIdx].accessLevel = accessLevel;
                    return newPerms;
                }
                return [...prev, { id: '', branchId: selectedBranchForPerms, featureName, accessLevel }];
            });
        } catch (err) {
            Swal.fire('Error', 'Failed to update permission', 'error');
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPharmacists = pharmacists.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12 animate-in fade-in duration-700">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-slate-200">
                            <Settings className="text-white w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Project <span className="text-slate-400">Settings</span></h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Core Infrastructure Management</p>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        Return to Dashboard
                    </button>
                </header>

                {/* Tabs */}
                <div className="flex bg-white p-2 rounded-[2.5rem] border shadow-sm w-fit">
                    {(['branches', 'pharmacists', 'permissions'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Search & Action Bar */}
                {activeTab !== 'permissions' && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Filter records..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 p-6 pl-16 rounded-[2rem] text-sm font-bold shadow-sm outline-none focus:border-slate-900 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (activeTab === 'branches') {
                                    setBranchForm({ role: 'branch', isSpinEnabled: false, isItemsEntryEnabled: true, isKPIDashboardEnabled: true });
                                    setIsBranchModalOpen(true);
                                } else {
                                    setPharForm({ name: '', isActive: true, branchIds: [] });
                                    setIsPharModalOpen(true);
                                }
                            }}
                            className="px-10 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                        >
                            <Plus size={18} /> Add {activeTab === 'branches' ? 'Branch / User' : 'Pharmacist'}
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden min-h-[600px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Infrastructure...</span>
                        </div>
                    ) : (
                        <div className="p-8">
                            {activeTab === 'branches' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredBranches.map(branch => (
                                        <div key={branch.id} className="group bg-[#fcfcfc] border border-slate-100 p-8 rounded-[2.5rem] hover:bg-white hover:shadow-2xl transition-all duration-500">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                    <Store size={24} />
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => { setBranchForm(branch); setIsBranchModalOpen(true); }} className="w-10 h-10 bg-white border rounded-full flex items-center justify-center hover:text-blue-600 shadow-sm"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteBranch(branch.id)} className="w-10 h-10 bg-white border rounded-full flex items-center justify-center hover:text-red-600 shadow-sm"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{branch.name}</h3>
                                                    <span className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-500 tracking-widest">{branch.code}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest">{branch.role}</span>
                                                    {branch.isSpinEnabled && <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Zap size={8} /> Spin Active</span>}
                                                </div>
                                                {branch.whatsappNumber && (
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                        <MessageCircle size={14} /> {branch.whatsappNumber}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'pharmacists' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredPharmacists.map(phar => (
                                        <div key={phar.id} className="group bg-[#fcfcfc] border border-slate-100 p-8 rounded-[2.5rem] hover:bg-white hover:shadow-2xl transition-all duration-500">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                    <Users size={24} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={async () => {
                                                        const { data } = await supabase.client.from('pharmacist_branches').select('branch_id').eq('pharmacist_id', phar.id);
                                                        setPharForm({
                                                            id: phar.id,
                                                            name: phar.name,
                                                            isActive: phar.isActive,
                                                            branchIds: data?.map(d => d.branch_id) || []
                                                        });
                                                        setIsPharModalOpen(true);
                                                    }} className="w-10 h-10 bg-white border rounded-full flex items-center justify-center hover:text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={16} /></button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{phar.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${phar.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{phar.isActive ? 'Active Duty' : 'Inactive'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'permissions' && (
                                <div className="flex flex-col lg:flex-row gap-8">
                                    <aside className="w-full lg:w-80 space-y-2 border-r pr-8">
                                        <div className="p-4 mb-4">
                                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">Target Identity</h2>
                                        </div>
                                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                            {branches.map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => loadPermissions(b.id)}
                                                    className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all group ${selectedBranchForPerms === b.id ? 'bg-slate-900 text-white shadow-lg translate-x-1' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
                                                >
                                                    <div className="flex flex-col items-start translate-x-2">
                                                        <span className="text-[11px] font-black uppercase tracking-wider">{b.name}</span>
                                                        <span className={`text-[8px] font-bold uppercase tracking-widest ${selectedBranchForPerms === b.id ? 'text-white/40' : 'text-slate-400'}`}>{b.role}</span>
                                                    </div>
                                                    <ChevronRight size={16} className={selectedBranchForPerms === b.id ? 'text-white' : 'text-transparent group-hover:text-slate-300'} />
                                                </button>
                                            ))}
                                        </div>
                                    </aside>

                                    <div className="flex-1">
                                        {!selectedBranchForPerms ? (
                                            <div className="flex flex-col items-center justify-center h-[500px] text-slate-300 space-y-4">
                                                <Lock size={48} className="opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Select an identity to manage access</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {FEATURES.map(feature => {
                                                        const currentPerm = permissions.find(p => p.featureName === feature.id)?.accessLevel || 'edit';
                                                        return (
                                                            <div key={feature.id} className="bg-[#fcfcfc] border border-slate-100 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                                        <feature.icon size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{feature.label}</h4>
                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{currentPerm} Access</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                                                    {(['none', 'read', 'edit'] as const).map(level => (
                                                                        <button
                                                                            key={level}
                                                                            onClick={() => handleUpdatePermission(feature.id, level)}
                                                                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${currentPerm === level ? 'bg-slate-900 text-white shadow-md' : 'text-slate-300 hover:text-slate-500'}`}
                                                                        >
                                                                            {level}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Branch Modal */}
            {isBranchModalOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="branch-modal-title"
                    aria-describedby="branch-modal-description"
                >
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <span id="branch-modal-description" className="sr-only">Configuration form for branch or admin system identities.</span>
                        <div className="p-10 border-b flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 id="branch-modal-title" className="text-2xl font-black text-slate-900 uppercase tracking-tight">System Identity</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure Branch or Admin access</p>
                            </div>
                            <button onClick={() => setIsBranchModalOpen(false)} className="w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Internal ID / Code</label>
                                    <input
                                        type="text"
                                        value={branchForm.code}
                                        onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                                        className="w-full bg-slate-50 border p-5 rounded-2xl outline-none text-sm font-bold focus:border-slate-900 transition-all"
                                        placeholder="e.g. T001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Role</label>
                                    <select
                                        title="User Role"
                                        value={branchForm.role}
                                        onChange={e => setBranchForm({ ...branchForm, role: e.target.value as Role })}
                                        className="w-full bg-slate-50 border p-5 rounded-2xl outline-none text-sm focus:border-slate-900 transition-all font-black"
                                    >
                                        {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                                <input
                                    type="text"
                                    value={branchForm.name}
                                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                                    className="w-full bg-slate-50 border p-5 rounded-2xl outline-none text-sm font-bold focus:border-slate-900 transition-all"
                                    placeholder="e.g. Tabarak Jerdab Branch"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Support WhatsApp Number</label>
                                <input
                                    type="text"
                                    value={branchForm.whatsappNumber}
                                    onChange={e => setBranchForm({ ...branchForm, whatsappNumber: e.target.value })}
                                    className="w-full bg-slate-50 border p-5 rounded-2xl outline-none text-sm font-bold focus:border-slate-900 transition-all"
                                    placeholder="+973 1234 5678"
                                />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <Zap size={18} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Spin & Win Capability</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle customer incentive module</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isSpinEnabled} onChange={e => setBranchForm({ ...branchForm, isSpinEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <ShoppingCart size={18} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Items Entry System</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle item logging in POS</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isItemsEntryEnabled} onChange={e => setBranchForm({ ...branchForm, isItemsEntryEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <Activity size={18} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard & KPI Analytics</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle charts and performance logs</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isKPIDashboardEnabled} onChange={e => setBranchForm({ ...branchForm, isKPIDashboardEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>
                        </div>
                        <div className="p-10 bg-slate-50 flex gap-4">
                            <button onClick={handleSaveBranch} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={18} /> Provision Identity</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pharmacist Modal */}
            {isPharModalOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pharmacist-modal-title"
                    aria-describedby="pharmacist-modal-description"
                >
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <span id="pharmacist-modal-description" className="sr-only">Form to manage personnel profiles and specialist credentials.</span>
                        <div className="p-10 border-b flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 id="pharmacist-modal-title" className="text-2xl font-black text-slate-900 uppercase tracking-tight">Personnel Profile</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage Specialist Credentials</p>
                            </div>
                            <button onClick={() => setIsPharModalOpen(false)} className="w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Full Name</label>
                                <input
                                    type="text"
                                    value={pharForm.name}
                                    onChange={e => setPharForm({ ...pharForm, name: e.target.value })}
                                    className="w-full bg-slate-50 border p-5 rounded-2xl outline-none text-sm focus:border-slate-900 transition-all font-black uppercase"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignments (Multi-Select)</label>
                                <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-2xl border">
                                    {branches.filter(b => b.role === 'branch').map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => {
                                                const current = pharForm.branchIds || [];
                                                const next = current.includes(b.id) ? current.filter(id => id !== b.id) : [...current, b.id];
                                                setPharForm({ ...pharForm, branchIds: next });
                                            }}
                                            className={`p-3 rounded-xl text-[9px] font-black uppercase tracking-tight text-left transition-all border ${pharForm.branchIds?.includes(b.id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                                        >
                                            {b.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <input
                                    type="checkbox"
                                    checked={pharForm.isActive}
                                    onChange={e => setPharForm({ ...pharForm, isActive: e.target.checked })}
                                    className="w-5 h-5 accent-slate-900 rounded"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest">Active Duty Status</span>
                            </div>
                        </div>
                        <div className="p-10 bg-slate-50 flex gap-4">
                            <button onClick={handleSavePharmacist} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={18} /> Update specialist credentials</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};
