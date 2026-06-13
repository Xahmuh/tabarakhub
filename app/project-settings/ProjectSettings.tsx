import React, { useState, useEffect } from 'react';
import {
    Settings,
    Plus,
    Trash2,
    Edit2,
    Store,
    Users,
    MessageCircle,
    Save,
    X,
    Search,
    ChevronRight,
    CheckCircle2,
    Lock,
    Zap,
    Briefcase,
    Activity,
    ShoppingCart,
    FileText,
    Wallet,
    BookOpen,
    AlertTriangle,
    Power,
    Wrench,
    Building2,
    UserCheck,
    SlidersHorizontal,
    RadioTower,
    RotateCcw,
    Hash
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Branch, Pharmacist, FeaturePermission, MaintenanceSettings, Role } from '../../types';
import Swal from 'sweetalert2';
import { AccessControlSection } from './AccessControlSection';
import { AccessFeatureId, getEnabledAccessFeatures } from '../../lib/moduleRegistry';

const FEATURE_ICON_MAP: Partial<Record<AccessFeatureId, React.ElementType>> = {
    command_center: RadioTower,
    lost_sales: Activity,
    shortages: ShoppingCart,
    spin_win: Zap,
    hr_requests: FileText,
    workforce: Users,
    cash_flow: Wallet,
    cash_tracker: Briefcase,
    corporate_codex: BookOpen,
    quality_feedback: MessageCircle,
    employee_contributions: Activity,
    delivery: ShoppingCart,
    products: Store,
    block_analyzer: SlidersHorizontal,
    settings: Settings
};

const FEATURES = getEnabledAccessFeatures().map(feature => ({
    ...feature,
    icon: FEATURE_ICON_MAP[feature.id as AccessFeatureId] || Lock
}));

const ROLES: Role[] = ['manager', 'owner', 'supervisor', 'warehouse', 'branch'];
type SettingsTab = 'branches' | 'pharmacists' | 'permissions' | 'access-control' | 'system';

const TAB_META: Record<SettingsTab, {
    label: string;
    description: string;
    icon: React.ElementType;
}> = {
    branches: {
        label: 'Identities',
        description: 'Branches, managers, admins, and account users',
        icon: Building2
    },
    pharmacists: {
        label: 'People',
        description: 'Specialist profiles and branch assignments',
        icon: UserCheck
    },
    permissions: {
        label: 'Access',
        description: 'Module permissions per identity',
        icon: SlidersHorizontal
    },
    'access-control': {
        label: 'Users & Roles',
        description: 'Login roles, supervisor scopes, and role defaults',
        icon: Lock
    },
    system: {
        label: 'System',
        description: 'Domain maintenance and public status',
        icon: RadioTower
    }
};

const StatTile: React.FC<{
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone?: 'brand' | 'emerald' | 'amber' | 'slate';
}> = ({ label, value, icon: Icon, tone = 'slate' }) => {
    const toneClasses = {
        brand: 'bg-brand/10 text-brand border-brand/10',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        slate: 'bg-slate-50 text-slate-500 border-slate-100'
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses[tone]}`}>
                    <Icon size={19} />
                </div>
            </div>
        </div>
    );
};

const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
}> = ({ icon: Icon, title, description }) => (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-300 shadow-sm">
            <Icon size={24} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</h3>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-400">{description}</p>
    </div>
);

const ACCESS_LEVELS: Array<{
    level: 'none' | 'read' | 'edit';
    title: string;
    description: string;
    icon: React.ElementType;
    className: string;
}> = [
    {
        level: 'none',
        title: 'No access',
        description: 'Hide or block this module for the selected identity.',
        icon: Lock,
        className: 'border-red-100 bg-red-50 text-red-600'
    },
    {
        level: 'read',
        title: 'Read',
        description: 'View/review access where the module supports read-only behavior.',
        icon: CheckCircle2,
        className: 'border-blue-100 bg-blue-50 text-blue-600'
    },
    {
        level: 'edit',
        title: 'Edit',
        description: 'Full operational access where the module supports write actions.',
        icon: Edit2,
        className: 'border-emerald-100 bg-emerald-50 text-emerald-600'
    }
];

const AccessGuide: React.FC = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ACCESS_LEVELS.map(item => {
            const Icon = item.icon;
            return (
                <div key={item.level} className={`rounded-lg border p-3 ${item.className}`}>
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
                            <Icon size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest">{item.title}</p>
                            <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{item.description}</p>
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
);

export const ProjectSettings: React.FC<{
    onBack: () => void;
    onSettingsChange?: (settings: MaintenanceSettings) => void;
}> = ({ onBack, onSettingsChange }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('branches');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
    const [isSavingGuideline, setIsSavingGuideline] = useState(false);
    const [isSavingFooter, setIsSavingFooter] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

    useEffect(() => {
        supabase.client.auth.getSession().then(({ data }) => {
            setCurrentUserId(data.session?.user?.id);
        });
    }, []);

    // Form States
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isPharModalOpen, setIsPharModalOpen] = useState(false);
    const [branchForm, setBranchForm] = useState<Partial<Branch>>({ role: 'branch', isSpinEnabled: false, isItemsEntryEnabled: true, isKPIDashboardEnabled: true });
    const [pharForm, setPharForm] = useState<{ code: string; name: string; isActive: boolean; branchIds: string[]; id?: string }>({
        code: '',
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
            const [b, p, settings] = await Promise.all([
                supabase.branches.list(),
                supabase.pharmacists.listAll(),
                supabase.systemSettings.getMaintenanceSettings()
            ]);
            setBranches(b);
            setPharmacists(p);
            setMaintenanceSettings(settings);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleMaintenance = async () => {
        if (!maintenanceSettings || isSavingMaintenance) return;

        const nextEnabled = !maintenanceSettings.isMaintenanceModeEnabled;
        if (nextEnabled) {
            const result = await Swal.fire({
                title: 'Enable maintenance mode?',
                text: 'Visitors and branch users will see the maintenance page until you turn it off.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Enable maintenance',
                cancelButtonText: 'Cancel'
            });
            if (!result.isConfirmed) return;
        }

        setIsSavingMaintenance(true);
        try {
            const updated = await supabase.systemSettings.updateMaintenanceSettings({
                isMaintenanceModeEnabled: nextEnabled,
                maintenanceTitle: maintenanceSettings.maintenanceTitle,
                maintenanceMessage: maintenanceSettings.maintenanceMessage
            });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: nextEnabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to update maintenance mode', 'error');
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    const handleSaveMaintenanceCopy = async () => {
        if (!maintenanceSettings || isSavingMaintenance) return;
        if (!maintenanceSettings.maintenanceTitle.trim() || !maintenanceSettings.maintenanceMessage.trim()) {
            Swal.fire('Error', 'Maintenance title and message are required', 'error');
            return;
        }

        setIsSavingMaintenance(true);
        try {
            const updated = await supabase.systemSettings.updateMaintenanceSettings({
                maintenanceTitle: maintenanceSettings.maintenanceTitle,
                maintenanceMessage: maintenanceSettings.maintenanceMessage,
                isMaintenanceModeEnabled: maintenanceSettings.isMaintenanceModeEnabled
            });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Maintenance page updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to save maintenance page', 'error');
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    const handleSavePOSGuideline = async () => {
        if (!maintenanceSettings || isSavingGuideline) return;
        const requiredFields = [
            maintenanceSettings.posGuidelineTitle,
            maintenanceSettings.posGuidelineIntro,
            maintenanceSettings.posGuidelineLostSalesEn,
            maintenanceSettings.posGuidelineShortageEn,
            maintenanceSettings.posGuidelineLostSalesAr,
            maintenanceSettings.posGuidelineShortageAr
        ];

        if (requiredFields.some(value => !value.trim())) {
            Swal.fire('Error', 'All instruction box fields are required', 'error');
            return;
        }

        setIsSavingGuideline(true);
        try {
            const updated = await supabase.systemSettings.updateMaintenanceSettings({
                posGuidelineEnabled: maintenanceSettings.posGuidelineEnabled,
                posGuidelineTitle: maintenanceSettings.posGuidelineTitle,
                posGuidelineIntro: maintenanceSettings.posGuidelineIntro,
                posGuidelineLostSalesEn: maintenanceSettings.posGuidelineLostSalesEn,
                posGuidelineShortageEn: maintenanceSettings.posGuidelineShortageEn,
                posGuidelineLostSalesAr: maintenanceSettings.posGuidelineLostSalesAr,
                posGuidelineShortageAr: maintenanceSettings.posGuidelineShortageAr
            });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Instruction box updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to save instruction box', 'error');
        } finally {
            setIsSavingGuideline(false);
        }
    };

    const handleSaveFooterSettings = async () => {
        if (!maintenanceSettings || isSavingFooter) return;

        setIsSavingFooter(true);
        try {
            const updated = await supabase.systemSettings.updateMaintenanceSettings({
                footerLogoUrl: maintenanceSettings.footerLogoUrl,
                footerText: maintenanceSettings.footerText
            });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Footer updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to save footer settings', 'error');
        } finally {
            setIsSavingFooter(false);
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

    const handleDeletePharmacist = async (pharmacist: Pharmacist) => {
        const result = await Swal.fire({
            title: 'Remove pharmacist?',
            text: `${pharmacist.name} will be hidden from selection lists. Historical records will stay intact.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await supabase.pharmacists.delete(pharmacist.id);
                loadData();
                Swal.fire('Removed', 'Pharmacist has been removed from active lists.', 'success');
            } catch (err: any) {
                Swal.fire('Error', err.message || 'Failed to remove pharmacist', 'error');
            }
        }
    };

    const handleSavePharmacist = async () => {
        const normalizedCode = pharForm.code.trim().toUpperCase();
        if (!normalizedCode) {
            Swal.fire('Error', 'Pharmacist code is required', 'error');
            return;
        }
        if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
            Swal.fire('Error', 'Pharmacist code can only contain letters, numbers, underscore, or dash', 'error');
            return;
        }
        if (!pharForm.name) {
            Swal.fire('Error', 'Pharmacist name is required', 'error');
            return;
        }
        try {
            await supabase.pharmacists.upsert({ id: pharForm.id, code: normalizedCode, name: pharForm.name, isActive: pharForm.isActive }, pharForm.branchIds);
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
        b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.nhraLicenseNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.crNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPharmacists = pharmacists.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedBranch = branches.find(branch => branch.id === selectedBranchForPerms);
    const activeTabMeta = TAB_META[activeTab];
    const ActiveTabIcon = activeTabMeta.icon;
    const branchCount = branches.filter(branch => branch.role === 'branch').length;
    const adminIdentityCount = branches.filter(branch => branch.role !== 'branch').length;
    const activePharmacistCount = pharmacists.filter(pharmacist => pharmacist.isActive).length;
    const maintenanceEnabled = maintenanceSettings?.isMaintenanceModeEnabled === true;
    const visibleRecordCount = activeTab === 'branches'
        ? filteredBranches.length
        : activeTab === 'pharmacists'
            ? filteredPharmacists.length
            : branches.length;
    const selectedBranchPermissionCount = FEATURES.filter(feature => {
        if (selectedBranch?.role === 'manager') return true;
        const explicitPermission = permissions.find(permission => permission.featureName === feature.id);
        return (explicitPermission?.accessLevel || 'none') !== 'none';
    }).length;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/10">
                                <Settings className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand">Control center</p>
                                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Settings & Permissions</h1>
                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                    Manage identities, staff records, module access, and domain maintenance from one operational surface.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                                onClick={loadData}
                                disabled={isLoading}
                                className="btn-secondary text-[10px] uppercase tracking-widest"
                            >
                                <RotateCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                            <button
                                onClick={onBack}
                                className="btn-secondary text-[10px] uppercase tracking-widest"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatTile label="Branch identities" value={branchCount} icon={Store} tone="brand" />
                    <StatTile label="Admin identities" value={adminIdentityCount} icon={Lock} />
                    <StatTile label="Active people" value={activePharmacistCount} icon={UserCheck} tone="emerald" />
                    <StatTile label="Domain status" value={maintenanceEnabled ? 'Paused' : 'Live'} icon={maintenanceEnabled ? Wrench : CheckCircle2} tone={maintenanceEnabled ? 'amber' : 'emerald'} />
                </section>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                    {(['branches', 'pharmacists', 'permissions', 'access-control', 'system'] as const).map(tab => {
                        const meta = TAB_META[tab];
                        const Icon = meta.icon;
                        const isActive = activeTab === tab;

                        return (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    if (tab === 'permissions') setSearchTerm('');
                                }}
                                className={`rounded-lg border p-4 text-left shadow-sm transition-all focus-ring ${
                                    isActive
                                        ? 'border-brand/30 bg-white shadow-brand/10'
                                        : 'border-slate-200 bg-white hover:border-brand/20 hover:bg-brand/5'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                                        isActive ? 'border-brand/10 bg-brand text-white' : 'border-slate-200 bg-slate-50 text-slate-400'
                                    }`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-black tracking-tight ${isActive ? 'text-brand' : 'text-slate-900'}`}>{meta.label}</span>
                                            {tab === 'system' && maintenanceEnabled && (
                                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700">On</span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{meta.description}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                <ActiveTabIcon size={18} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-black tracking-tight text-slate-950">{activeTabMeta.label}</h2>
                                <p className="text-sm font-medium leading-6 text-slate-500">{activeTabMeta.description}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            {activeTab !== 'system' && activeTab !== 'access-control' && (
                                <div className="relative min-w-0 md:w-80">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={activeTab === 'permissions' ? 'Find identity...' : activeTab === 'pharmacists' ? 'Search name or code...' : 'Search records...'}
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                                    />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 shadow-sm">
                                        {visibleRecordCount}
                                    </span>
                                </div>
                            )}

                            {(activeTab === 'branches' || activeTab === 'pharmacists') && (
                                <button
                                    onClick={() => {
                                        if (activeTab === 'branches') {
                                            setBranchForm({ role: 'branch', isSpinEnabled: false, isItemsEntryEnabled: true, isKPIDashboardEnabled: true });
                                            setIsBranchModalOpen(true);
                                        } else {
                                            setPharForm({ code: '', name: '', isActive: true, branchIds: [] });
                                            setIsPharModalOpen(true);
                                        }
                                    }}
                                    className="btn-primary whitespace-nowrap text-[10px] uppercase tracking-widest"
                                >
                                    <Plus size={18} />
                                    Add {activeTab === 'branches' ? 'Identity' : 'Person'}
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                <div className="operational-panel overflow-hidden min-h-[560px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-[560px] space-y-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-brand rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading settings...</span>
                        </div>
                    ) : (
                        <div className="p-5 md:p-6">
                            {activeTab === 'branches' && (
                                filteredBranches.length === 0 ? (
                                    <EmptyState
                                        icon={Store}
                                        title="No identities found"
                                        description="Try another search term or add a new branch, manager, admin, or accounts identity."
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredBranches.map(branch => {
                                            const enabledModules = [
                                                branch.isItemsEntryEnabled && 'Items',
                                                branch.isKPIDashboardEnabled && 'KPI',
                                                branch.isSpinEnabled && 'Spin'
                                            ].filter(Boolean);

                                            return (
                                                <article key={branch.id} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md hover:shadow-brand/10">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex min-w-0 items-start gap-3">
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand">
                                                                <Store size={20} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="truncate text-lg font-black tracking-tight text-slate-950">{branch.name}</h3>
                                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{branch.code}</span>
                                                                    <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                                                                        branch.role === 'branch' ? 'bg-brand/10 text-brand' : 'bg-slate-900 text-white'
                                                                    }`}>{branch.role}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 gap-2">
                                                            <button
                                                                onClick={() => { setBranchForm(branch); setIsBranchModalOpen(true); }}
                                                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                                                                title="Edit identity"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBranch(branch.id)}
                                                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                                                title="Delete identity"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 space-y-4">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {['Items', 'KPI', 'Spin'].map(module => {
                                                                const enabled = enabledModules.includes(module);
                                                                return (
                                                                    <div key={module} className={`rounded-lg border px-2 py-2 text-center text-[9px] font-black uppercase tracking-widest ${
                                                                        enabled ? 'border-brand/10 bg-brand/5 text-brand' : 'border-slate-100 bg-slate-50 text-slate-300'
                                                                    }`}>
                                                                        {module}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500">
                                                            <MessageCircle size={14} className="shrink-0 text-slate-300" />
                                                            <span className="truncate">{branch.whatsappNumber || 'No support number saved'}</span>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                    <FileText size={13} className="shrink-0" />
                                                                    NHRA Lic No.
                                                                </div>
                                                                <p className="mt-1 truncate text-xs font-black text-slate-700">{branch.nhraLicenseNo || 'Not saved'}</p>
                                                            </div>
                                                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                    <Hash size={13} className="shrink-0" />
                                                                    CR Number
                                                                </div>
                                                                <p className="mt-1 truncate text-xs font-black text-slate-700">{branch.crNumber || 'Not saved'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {activeTab === 'pharmacists' && (
                                filteredPharmacists.length === 0 ? (
                                    <EmptyState
                                        icon={Users}
                                        title="No people found"
                                        description="Try another search term or add a new specialist profile."
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredPharmacists.map(phar => (
                                            <article key={phar.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md hover:shadow-brand/10">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand">
                                                            <Users size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-lg font-black tracking-tight text-slate-950">{phar.name}</h3>
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className="rounded-md bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-brand">
                                                                    {phar.code || 'No code'}
                                                                </span>
                                                                <span className={`h-2 w-2 rounded-full ${phar.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                                <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                                                                    phar.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                    {phar.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const { data } = await supabase.client.from('pharmacist_branches').select('branch_id').eq('pharmacist_id', phar.id);
                                                                setPharForm({
                                                                    id: phar.id,
                                                                    code: phar.code || '',
                                                                    name: phar.name,
                                                                    isActive: phar.isActive,
                                                                    branchIds: data?.map(d => d.branch_id) || []
                                                                });
                                                                setIsPharModalOpen(true);
                                                            }}
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                                                            title="Edit profile"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePharmacist(phar)}
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                                            title="Remove pharmacist"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )
                            )}

                            {activeTab === 'access-control' && (
                                <AccessControlSection currentUserId={currentUserId} />
                            )}

                            {activeTab === 'permissions' && (
                                <div className="space-y-5">
                                    <AccessGuide />
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                                        <aside className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                                            <div className="mb-3 px-2">
                                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Target identity</h2>
                                                <p className="mt-1 text-xs font-medium text-slate-500">Pick one identity, then adjust module access.</p>
                                            </div>
                                            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                                                {filteredBranches.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-400">
                                                        No matching identities
                                                    </div>
                                                ) : filteredBranches.map(branch => {
                                                    const selected = selectedBranchForPerms === branch.id;
                                                    return (
                                                        <button
                                                            key={branch.id}
                                                            onClick={() => loadPermissions(branch.id)}
                                                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                                                selected
                                                                    ? 'border-brand bg-brand text-white shadow-sm shadow-brand/10'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand/20 hover:bg-brand/5'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-[11px] font-black uppercase tracking-wider">{branch.name}</p>
                                                                    <p className={`mt-1 text-[8px] font-bold uppercase tracking-widest ${selected ? 'text-white/60' : 'text-slate-400'}`}>{branch.role} / {branch.code}</p>
                                                                </div>
                                                                <ChevronRight size={16} className={selected ? 'text-white' : 'text-slate-300'} />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </aside>

                                        <div className="min-w-0">
                                            {!selectedBranch ? (
                                                <EmptyState
                                                    icon={Lock}
                                                    title="Select an identity"
                                                    description="Choose a branch, manager, admin, or accounts identity to manage feature access."
                                                />
                                            ) : (
                                                <div className="space-y-5">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Permission target</p>
                                                                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{selectedBranch.name}</h3>
                                                                <p className="mt-1 text-sm font-medium text-slate-500">{selectedBranch.role.toUpperCase()} / {selectedBranch.code}</p>
                                                            </div>
                                                            <div className="rounded-lg border border-brand/10 bg-brand/5 px-4 py-3 text-right">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Enabled features</p>
                                                                <p className="mt-1 text-2xl font-black text-slate-950">{selectedBranchPermissionCount}/{FEATURES.length}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                        {FEATURES.map(feature => {
                                                            const isManagerTarget = selectedBranch.role === 'manager';
                                                            const currentPerm = isManagerTarget ? 'edit' : permissions.find(p => p.featureName === feature.id)?.accessLevel || 'none';
                                                            const accessTone = currentPerm === 'none'
                                                                ? 'text-red-600 bg-red-50 border-red-100'
                                                                : currentPerm === 'read'
                                                                    ? 'text-blue-600 bg-blue-50 border-blue-100'
                                                                    : 'text-emerald-600 bg-emerald-50 border-emerald-100';

                                                            return (
                                                                <article key={feature.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand/30">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand">
                                                                            <feature.icon size={18} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                <h4 className="text-sm font-black tracking-tight text-slate-950">{feature.label}</h4>
                                                                                <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${accessTone}`}>{currentPerm}</span>
                                                                            </div>
                                                                            <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                                                                {(['none', 'read', 'edit'] as const).map(level => (
                                                                                    <button
                                                                                        key={level}
                                                                                        onClick={() => handleUpdatePermission(feature.id, level)}
                                                                                        disabled={isManagerTarget}
                                                                                        className={`rounded-md px-2 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                                                                                            currentPerm === level
                                                                                                ? 'bg-brand text-white shadow-sm'
                                                                                                : 'text-slate-400 hover:bg-white hover:text-slate-700'
                                                                                        } ${isManagerTarget ? 'cursor-not-allowed opacity-60' : ''}`}
                                                                                    >
                                                                                        {level}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'system' && maintenanceSettings && (
                                <div className="space-y-6">
                                    <div className={`rounded-lg border p-5 shadow-sm ${maintenanceSettings.isMaintenanceModeEnabled ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-sm ${maintenanceSettings.isMaintenanceModeEnabled ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    {maintenanceSettings.isMaintenanceModeEnabled ? <Wrench size={24} /> : <CheckCircle2 size={24} />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Domain maintenance control</p>
                                                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                                                        {maintenanceSettings.isMaintenanceModeEnabled ? 'Maintenance mode is active' : 'Application is online'}
                                                    </h2>
                                                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                                                        When enabled, visitors and branch users will see the maintenance page before entering the app. Admin and manager accounts can still sign in to turn it off.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <span className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                                                    maintenanceSettings.isMaintenanceModeEnabled
                                                        ? 'border-amber-200 bg-white text-amber-700'
                                                        : 'border-emerald-200 bg-white text-emerald-700'
                                                }`}>
                                                    {maintenanceSettings.isMaintenanceModeEnabled ? 'Public paused' : 'Public live'}
                                                </span>
                                                <button
                                                    onClick={handleToggleMaintenance}
                                                    disabled={isSavingMaintenance}
                                                    className={`btn-primary min-w-[190px] justify-center text-[10px] uppercase tracking-widest ${maintenanceSettings.isMaintenanceModeEnabled ? '!border-slate-900 !bg-slate-900 hover:!bg-slate-800' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
                                                >
                                                    <Power size={18} />
                                                    {maintenanceSettings.isMaintenanceModeEnabled ? 'Turn off' : 'Turn on'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
                                        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="mb-5 flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand shadow-sm">
                                                    <AlertTriangle size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black tracking-tight text-slate-900">Maintenance page message</h3>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Public copy shown on the domain</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Title</label>
                                                    <input
                                                        type="text"
                                                        value={maintenanceSettings.maintenanceTitle}
                                                        onChange={e => setMaintenanceSettings({ ...maintenanceSettings, maintenanceTitle: e.target.value })}
                                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Message</label>
                                                    <textarea
                                                        value={maintenanceSettings.maintenanceMessage}
                                                        onChange={e => setMaintenanceSettings({ ...maintenanceSettings, maintenanceMessage: e.target.value })}
                                                        rows={5}
                                                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-6 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleSaveMaintenanceCopy}
                                                    disabled={isSavingMaintenance}
                                                    className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Save size={18} />
                                                    Save message
                                                </button>
                                            </div>
                                        </section>

                                        <aside className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm">
                                            <div className="border-b border-white/10 p-5">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Preview</p>
                                                <h3 className="mt-1 text-sm font-black text-white">What visitors will see</h3>
                                            </div>
                                            <div className="p-5">
                                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-white">
                                                        <Wrench size={24} />
                                                    </div>
                                                    <h3 className="text-2xl font-black tracking-tight">{maintenanceSettings.maintenanceTitle || 'Maintenance title'}</h3>
                                                    <p className="mt-3 text-sm font-medium leading-7 text-white/60">{maintenanceSettings.maintenanceMessage || 'Maintenance message'}</p>
                                                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                                                        <div className="h-full w-2/3 rounded-full bg-brand"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </aside>
                                    </div>

                                    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-5 flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand shadow-sm">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black tracking-tight text-slate-900">Footer branding</h3>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Control the logo and text shown in the application footer.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Logo URL / path</label>
                                                    <input
                                                        type="text"
                                                        value={maintenanceSettings.footerLogoUrl}
                                                        onChange={e => setMaintenanceSettings({ ...maintenanceSettings, footerLogoUrl: e.target.value })}
                                                        maxLength={500}
                                                        placeholder="/logo.jpg"
                                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Footer text</label>
                                                    <input
                                                        type="text"
                                                        value={maintenanceSettings.footerText}
                                                        onChange={e => setMaintenanceSettings({ ...maintenanceSettings, footerText: e.target.value })}
                                                        maxLength={120}
                                                        placeholder="HUB"
                                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-black outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                    />
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={handleSaveFooterSettings}
                                                        disabled={isSavingFooter}
                                                        className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <Save size={18} />
                                                        Save footer
                                                    </button>
                                                    <button
                                                        onClick={() => setMaintenanceSettings({ ...maintenanceSettings, footerLogoUrl: '', footerText: 'HUB' })}
                                                        className="btn-secondary text-[10px] uppercase tracking-widest"
                                                    >
                                                        <RotateCcw size={16} />
                                                        Reset footer
                                                    </button>
                                                </div>
                                            </div>

                                            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</p>
                                                <div className="mt-3 rounded-lg border border-slate-200 px-4 py-4" style={{ backgroundColor: '#0f172a' }}>
                                                    <div className="flex items-center gap-3">
                                                        {maintenanceSettings.footerLogoUrl && (
                                                            <div className="h-9 w-9 overflow-hidden rounded-lg bg-brand shadow-sm">
                                                                <img src={maintenanceSettings.footerLogoUrl} alt="Footer logo preview" className="h-full w-full object-cover" />
                                                            </div>
                                                        )}
                                                        <p className="text-2xl font-black leading-none text-white">{maintenanceSettings.footerText || 'HUB'}</p>
                                                    </div>
                                                </div>
                                            </aside>
                                        </div>
                                    </section>

                                    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand shadow-sm">
                                                    <ShoppingCart size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black tracking-tight text-slate-900">Lost Sales & Shortage instruction box</h3>
                                                    <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">
                                                        Control the Attention / تنبيه message shown before branch users submit Lost Sales or Shortage records.
                                                    </p>
                                                </div>
                                            </div>
                                            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    {maintenanceSettings.posGuidelineEnabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={maintenanceSettings.posGuidelineEnabled}
                                                    onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineEnabled: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <span className="relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-brand after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Title</label>
                                                        <input
                                                            type="text"
                                                            value={maintenanceSettings.posGuidelineTitle}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineTitle: e.target.value })}
                                                            maxLength={60}
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intro message</label>
                                                        <input
                                                            type="text"
                                                            value={maintenanceSettings.posGuidelineIntro}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineIntro: e.target.value })}
                                                            maxLength={110}
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lost Sales rule - English</label>
                                                        <textarea
                                                            value={maintenanceSettings.posGuidelineLostSalesEn}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineLostSalesEn: e.target.value })}
                                                            maxLength={120}
                                                            rows={2}
                                                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-5 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shortage rule - English</label>
                                                        <textarea
                                                            value={maintenanceSettings.posGuidelineShortageEn}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineShortageEn: e.target.value })}
                                                            maxLength={120}
                                                            rows={2}
                                                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-5 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lost Sales rule - Arabic</label>
                                                        <textarea
                                                            dir="rtl"
                                                            value={maintenanceSettings.posGuidelineLostSalesAr}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineLostSalesAr: e.target.value })}
                                                            maxLength={120}
                                                            rows={2}
                                                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-right text-sm font-bold leading-5 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shortage rule - Arabic</label>
                                                        <textarea
                                                            dir="rtl"
                                                            value={maintenanceSettings.posGuidelineShortageAr}
                                                            onChange={e => setMaintenanceSettings({ ...maintenanceSettings, posGuidelineShortageAr: e.target.value })}
                                                            maxLength={120}
                                                            rows={2}
                                                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-right text-sm font-bold leading-5 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleSavePOSGuideline}
                                                    disabled={isSavingGuideline}
                                                    className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Save size={18} />
                                                    Save instruction box
                                                </button>
                                            </div>

                                            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</p>
                                                <div className="mt-3 overflow-hidden rounded-lg border border-brand/10 bg-white shadow-sm">
                                                    <div className="border-b border-brand/10 bg-brand/5 px-4 py-3">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Before logging records</p>
                                                        <h4 className="mt-1 text-xl font-black text-slate-950">{maintenanceSettings.posGuidelineTitle}</h4>
                                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{maintenanceSettings.posGuidelineIntro}</p>
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="mb-3 flex justify-center">
                                                            <div className="flex items-center rounded-full border border-brand/10 bg-slate-50 p-1">
                                                                <span className="rounded-full bg-brand px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">Lost Sales</span>
                                                                <span className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Shortage</span>
                                                            </div>
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <div className="rounded-lg border border-slate-200 p-3">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">English</p>
                                                                <p className="mt-2 text-xs font-bold text-slate-700"><span className="text-brand">Lost Sales:</span> {maintenanceSettings.posGuidelineLostSalesEn}</p>
                                                                <p className="mt-2 text-xs font-bold text-slate-700"><span className="text-brand">Shortage:</span> {maintenanceSettings.posGuidelineShortageEn}</p>
                                                            </div>
                                                            <div className="rounded-lg border border-slate-200 p-3 text-right" dir="rtl">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">عربي</p>
                                                                <p className="mt-2 text-xs font-bold text-slate-700"><span className="text-brand">Lost Sales:</span> {maintenanceSettings.posGuidelineLostSalesAr}</p>
                                                                <p className="mt-2 text-xs font-bold text-slate-700"><span className="text-brand">Shortage:</span> {maintenanceSettings.posGuidelineShortageAr}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </aside>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Branch Modal */}
            {isBranchModalOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="branch-modal-title"
                    aria-describedby="branch-modal-description"
                >
                    <div className="bg-white w-full max-w-xl rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                        <span id="branch-modal-description" className="sr-only">Configuration form for branch or admin system identities.</span>
                        <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 id="branch-modal-title" className="text-xl font-black text-slate-900 uppercase tracking-tight">System Identity</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure Branch or Admin access</p>
                            </div>
                            <button onClick={() => setIsBranchModalOpen(false)} className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center justify-center transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Internal ID / Code</label>
                                    <input
                                        type="text"
                                        value={branchForm.code}
                                        onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                        placeholder="e.g. T001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Role</label>
                                    <select
                                        title="User Role"
                                        value={branchForm.role}
                                        onChange={e => setBranchForm({ ...branchForm, role: e.target.value as Role })}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all font-black"
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
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                    placeholder="e.g. Tabarak Jerdab Branch"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Support WhatsApp Number</label>
                                <input
                                    type="text"
                                    value={branchForm.whatsappNumber}
                                    onChange={e => setBranchForm({ ...branchForm, whatsappNumber: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                    placeholder="+973 1234 5678"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">NHRA Lic No.</label>
                                    <input
                                        type="text"
                                        value={branchForm.nhraLicenseNo || ''}
                                        onChange={e => setBranchForm({ ...branchForm, nhraLicenseNo: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                        placeholder="Branch NHRA license"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CR Number</label>
                                    <input
                                        type="text"
                                        value={branchForm.crNumber || ''}
                                        onChange={e => setBranchForm({ ...branchForm, crNumber: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                        placeholder="Branch commercial registration"
                                    />
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Zap size={18} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Spin & Win Capability</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle customer incentive module</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isSpinEnabled} onChange={e => setBranchForm({ ...branchForm, isSpinEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                                </label>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <ShoppingCart size={18} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Items Entry System</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle item logging in POS</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isItemsEntryEnabled} onChange={e => setBranchForm({ ...branchForm, isItemsEntryEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                                </label>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Activity size={18} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard & KPI Analytics</span>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle charts and performance logs</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={branchForm.isKPIDashboardEnabled} onChange={e => setBranchForm({ ...branchForm, isKPIDashboardEnabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-4">
                            <button onClick={handleSaveBranch} className="btn-primary flex-1 text-[10px] uppercase tracking-widest"><Save size={18} /> Provision Identity</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pharmacist Modal */}
            {isPharModalOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pharmacist-modal-title"
                    aria-describedby="pharmacist-modal-description"
                >
                    <div className="bg-white w-full max-w-xl rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                        <span id="pharmacist-modal-description" className="sr-only">Form to manage personnel profiles and specialist credentials.</span>
                        <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 id="pharmacist-modal-title" className="text-xl font-black text-slate-900 uppercase tracking-tight">Personnel Profile</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage Specialist Credentials</p>
                            </div>
                            <button onClick={() => setIsPharModalOpen(false)} className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center justify-center transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pharmacist Code</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" />
                                    <input
                                        type="text"
                                        maxLength={32}
                                        value={pharForm.code}
                                        onChange={e => setPharForm({ ...pharForm, code: e.target.value.trim().toUpperCase() })}
                                        placeholder="P001"
                                        className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-lg outline-none text-sm focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all font-black uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Full Name</label>
                                <input
                                    type="text"
                                    value={pharForm.name}
                                    onChange={e => setPharForm({ ...pharForm, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all font-black uppercase"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Assignments (Multi-Select)</label>
                                <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-lg border border-slate-200">
                                    {branches.filter(b => b.role === 'branch').map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => {
                                                const current = pharForm.branchIds || [];
                                                const next = current.includes(b.id) ? current.filter(id => id !== b.id) : [...current, b.id];
                                                setPharForm({ ...pharForm, branchIds: next });
                                            }}
                                            className={`p-3 rounded-lg text-[9px] font-black uppercase tracking-tight text-left transition-colors border ${pharForm.branchIds?.includes(b.id) ? 'bg-brand text-white border-brand' : 'bg-white text-slate-400 border-slate-200 hover:border-brand/40'}`}
                                        >
                                            {b.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <input
                                    type="checkbox"
                                    checked={pharForm.isActive}
                                    onChange={e => setPharForm({ ...pharForm, isActive: e.target.checked })}
                                    className="w-5 h-5 accent-brand rounded"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest">Active Duty Status</span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-4">
                            <button onClick={handleSavePharmacist} className="btn-primary flex-1 text-[10px] uppercase tracking-widest"><Save size={18} /> Update specialist credentials</button>
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
