import React, { useState, useEffect, useMemo } from 'react';
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
    Hash,
    KeyRound,
    MapPinned,
    LayoutGrid,
    UploadCloud,
    Image as ImageIcon,
    PieChart
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Branch, BranchClassification, Pharmacist, FeaturePermission, MaintenanceSettings, Role, RolePermission } from '../../types';
import Swal from 'sweetalert2';
import { AccessControlSection } from './AccessControlSection';
import { AccessFeatureId, getEnabledAccessFeatures } from '../../lib/moduleRegistry';
import { getSystemSettingsErrorMessage, type SystemBrandingAssetSlot } from '../../services/systemSettingsService';
import { BranchLoginApprovalsSection } from './BranchLoginApprovalsSection';
import { DeliveryZonesSection } from './DeliveryZonesSection';
import { ModuleDisplaySettingsSection } from './ModuleDisplaySettingsSection';
import { BackToModulesButton } from '../shared';
import { clientConfig } from '../../config/clientConfig';

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
    feedback_admin: PieChart,
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

const DEFAULT_HUB_LOGO_URL = '/tabarak-logo.svg';
const DEFAULT_PHARMACY_LOGO_URL = clientConfig.logoUrl;
const DEFAULT_LOADING_SPINNER_URL = '/spinner.svg';

type SettingsTab = 'branches' | 'module-layout' | 'delivery-zones' | 'pharmacists' | 'permissions' | 'access-control' | 'login-approvals' | 'system';
type SettingsMode = 'combined' | 'system' | 'access';
type BrandingLogoSettingKey = 'pharmacyLogoUrl' | 'hubLogoUrl' | 'browserIconUrl' | 'loadingSpinnerUrl' | 'footerLogoUrl';

const BRANDING_ASSET_FIELD_BY_SLOT: Record<SystemBrandingAssetSlot, BrandingLogoSettingKey> = {
    pharmacy: 'pharmacyLogoUrl',
    hub: 'hubLogoUrl',
    'browser-icon': 'browserIconUrl',
    spinner: 'loadingSpinnerUrl',
    footer: 'footerLogoUrl'
};

const SETTINGS_MODE_TABS: Record<SettingsMode, SettingsTab[]> = {
    combined: ['branches', 'module-layout', 'delivery-zones', 'pharmacists', 'permissions', 'access-control', 'login-approvals', 'system'],
    system: ['system', 'module-layout', 'delivery-zones', 'branches'],
    access: ['access-control', 'pharmacists', 'permissions', 'login-approvals']
};

const SETTINGS_MODE_META: Record<SettingsMode, {
    title: string;
    eyebrow: string;
    description: string;
    icon: React.ElementType;
}> = {
    combined: {
        title: 'Admin Control',
        eyebrow: 'Control center',
        description: 'Manage system setup, staff access, login roles, module layout, and operational defaults.',
        icon: Settings
    },
    system: {
        title: 'System Settings',
        eyebrow: 'System control',
        description: 'Control maintenance mode, branding, module layout, delivery zones, and branch operating records.',
        icon: Settings
    },
    access: {
        title: 'Access Control',
        eyebrow: 'Identity control',
        description: 'Manage people, users, role defaults, branch permissions, and trusted login approvals.',
        icon: Lock
    }
};

const getVisibleTabsForMode = (
    mode: SettingsMode,
    canManageSettings: boolean,
    canManageDeliveryZones: boolean,
    canApproveLoginRequests: boolean
) => SETTINGS_MODE_TABS[mode].filter(tab =>
    canManageSettings || (tab === 'delivery-zones' && canManageDeliveryZones) || (tab === 'login-approvals' && canApproveLoginRequests)
);

const TAB_META: Record<SettingsTab, {
    label: string;
    description: string;
    icon: React.ElementType;
}> = {
    branches: {
        label: 'Branches',
        description: 'Operational pharmacy branches only',
        icon: Building2
    },
    'module-layout': {
        label: 'Module Layout',
        description: 'Order launcher cards and module badges',
        icon: LayoutGrid
    },
    'delivery-zones': {
        label: 'Delivery Zones',
        description: 'Branch origin blocks, service rings, and delivery radius settings',
        icon: MapPinned
    },
    pharmacists: {
        label: 'People',
        description: 'Specialist profiles and branch assignments',
        icon: UserCheck
    },
    permissions: {
        label: 'Access',
        description: 'Module permission overrides per branch',
        icon: SlidersHorizontal
    },
    'access-control': {
        label: 'Users & Roles',
        description: 'Login roles, supervisor scopes, and role defaults',
        icon: Lock
    },
    'login-approvals': {
        label: 'Login Approvals',
        description: 'Approve or reject pending branch sign-ins',
        icon: KeyRound
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

const BranchInfoItem: React.FC<{
    label: string;
    value?: string | null;
    icon: React.ElementType;
}> = ({ label, value, icon: Icon }) => (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <Icon size={13} className="shrink-0" />
            <span className="break-words">{label}</span>
        </div>
        <p className="mt-1 break-words text-xs font-black leading-5 text-slate-800">{value || 'Not assigned'}</p>
    </div>
);

const ACCESS_LEVELS: Array<{
    level: 'default' | 'none' | 'read' | 'edit';
    title: string;
    description: string;
    icon: React.ElementType;
    className: string;
}> = [
    {
        level: 'default',
        title: 'Default',
        description: 'Inherit the Branch role default from Users & Roles.',
        icon: RotateCcw,
        className: 'border-slate-200 bg-slate-50 text-slate-600'
    },
    {
        level: 'none',
        title: 'No access',
        description: 'Explicitly hide or block this module for this branch.',
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
    currentRole?: Role;
    mode?: SettingsMode;
}> = ({ onBack, onSettingsChange, currentRole = 'admin', mode: requestedMode = 'combined' }) => {
    const settingsMode = requestedMode as SettingsMode;
    const canManageSettings = currentRole === 'admin' || currentRole === 'manager';
    const canManageDeliveryZones = currentRole === 'admin' || currentRole === 'manager' || currentRole === 'owner';
    const canApproveLoginRequests = currentRole === 'admin' || currentRole === 'manager' || currentRole === 'owner';
    const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
        getVisibleTabsForMode(settingsMode, canManageSettings, canManageDeliveryZones, canApproveLoginRequests)[0] || 'login-approvals'
    );
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchClassifications, setBranchClassifications] = useState<BranchClassification[]>([]);
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [pharmacistAssignmentsByBranch, setPharmacistAssignmentsByBranch] = useState<Record<string, string[]>>({});
    const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings | null>(null);
    const [maintenanceSettingsError, setMaintenanceSettingsError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
    const [isSavingGuideline, setIsSavingGuideline] = useState(false);
    const [isSavingFooter, setIsSavingFooter] = useState(false);
    const [isSavingLoginBadges, setIsSavingLoginBadges] = useState(false);
    const [uploadingBrandingSlot, setUploadingBrandingSlot] = useState<SystemBrandingAssetSlot | null>(null);
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
    const [branchRoleDefaults, setBranchRoleDefaults] = useState<RolePermission[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const visibleSettingsTabs = useMemo(
        () => getVisibleTabsForMode(settingsMode, canManageSettings, canManageDeliveryZones, canApproveLoginRequests),
        [canApproveLoginRequests, canManageDeliveryZones, canManageSettings, settingsMode]
    );

    useEffect(() => {
        if (!visibleSettingsTabs.includes(activeTab)) {
            setActiveTab(visibleSettingsTabs[0] || 'login-approvals');
        }
    }, [activeTab, visibleSettingsTabs]);

    const loadData = async () => {
        setIsLoading(true);
        setMaintenanceSettingsError(null);
        try {
            const [b, p, c, assignmentResult, branchDefaults] = await Promise.all([
                supabase.branches.list(),
                supabase.pharmacists.listAll(),
                supabase.delivery.classifications.list(),
                supabase.client.from('pharmacist_branches').select('branch_id, pharmacist_id'),
                supabase.permissions.listRoleDefaults('branch')
            ]);
            setBranches(b);
            setPharmacists(p);
            setBranchClassifications(c);
            setBranchRoleDefaults(branchDefaults);
            if (assignmentResult.error) {
                setPharmacistAssignmentsByBranch({});
            } else {
                const assignmentMap = (assignmentResult.data || []).reduce<Record<string, string[]>>((map, assignment) => {
                    if (!assignment.branch_id || !assignment.pharmacist_id) return map;
                    map[assignment.branch_id] = [...(map[assignment.branch_id] || []), assignment.pharmacist_id];
                    return map;
                }, {});
                setPharmacistAssignmentsByBranch(assignmentMap);
            }
            try {
                const settings = await supabase.systemSettings.getMaintenanceSettings();
                setMaintenanceSettings(settings);
            } catch (settingsError) {
                setMaintenanceSettings(null);
                setMaintenanceSettingsError(getSystemSettingsErrorMessage(settingsError));
            }
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
                pharmacyLogoUrl: maintenanceSettings.pharmacyLogoUrl,
                hubLogoUrl: maintenanceSettings.hubLogoUrl,
                browserIconUrl: maintenanceSettings.browserIconUrl,
                loadingSpinnerUrl: maintenanceSettings.loadingSpinnerUrl,
                footerLogoUrl: maintenanceSettings.footerLogoUrl,
                footerText: maintenanceSettings.footerText
            });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Branding updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to save branding settings', 'error');
        } finally {
            setIsSavingFooter(false);
        }
    };

    const handleUploadBrandingAsset = async (slot: SystemBrandingAssetSlot, file?: File | null) => {
        if (!file || !maintenanceSettings || uploadingBrandingSlot) return;

        const fieldName = BRANDING_ASSET_FIELD_BY_SLOT[slot];
        setUploadingBrandingSlot(slot);
        try {
            const uploadedUrl = await supabase.systemSettings.uploadBrandingAsset(file, slot);
            const updated = await supabase.systemSettings.updateMaintenanceSettings({ [fieldName]: uploadedUrl });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Logo uploaded',
                text: 'Branding asset was uploaded and saved to system settings.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2200
            });
        } catch (err: any) {
            Swal.fire('Upload failed', err?.message || 'Could not upload branding asset.', 'error');
        } finally {
            setUploadingBrandingSlot(null);
        }
    };

    const handleSaveLoginBadges = async () => {
        if (!maintenanceSettings || isSavingLoginBadges) return;

        const loginBadges = maintenanceSettings.loginBadges
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 6);

        setIsSavingLoginBadges(true);
        try {
            const updated = await supabase.systemSettings.updateMaintenanceSettings({ loginBadges });
            setMaintenanceSettings(updated);
            onSettingsChange?.(updated);
            Swal.fire({
                icon: 'success',
                title: 'Login badges updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to save login badges', 'error');
        } finally {
            setIsSavingLoginBadges(false);
        }
    };

    const handleSaveBranch = async () => {
        if (!branchForm.code || !branchForm.name) {
            Swal.fire('Error', 'Code and Name are required', 'error');
            return;
        }
        const branchManagerName = branchForm.branchManagerName?.trim() || '';
        if (branchManagerName && !pharmacists.some(pharmacist => pharmacist.isActive && pharmacist.name === branchManagerName)) {
            Swal.fire('Select registered pharmacist', 'Branch Manager Name must be selected from active registered pharmacists.', 'warning');
            return;
        }
        try {
            await supabase.branches.upsert({ ...branchForm, branchManagerName, role: 'branch' });
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
            title: 'Remove branch?',
            text: 'This will permanently remove the branch record. Historical records or foreign keys may block the delete.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove branch'
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

    const handleClearPermission = async (featureName: string) => {
        if (!selectedBranchForPerms) return;
        try {
            await supabase.permissions.deleteForBranch(selectedBranchForPerms, featureName);
            setPermissions(prev => prev.filter(permission => permission.featureName !== featureName));
        } catch (err) {
            Swal.fire('Error', 'Failed to clear permission override', 'error');
        }
    };

    const getBranchRoleDefaultAccess = (featureName: string): 'read' | 'edit' | 'none' =>
        branchRoleDefaults.find(permission => permission.featureName === featureName)?.accessLevel || 'none';

    const getEffectiveBranchAccess = (featureName: string): 'read' | 'edit' | 'none' =>
        permissions.find(permission => permission.featureName === featureName)?.accessLevel || getBranchRoleDefaultAccess(featureName);

    const branchClassificationMap = useMemo(() => {
        const map = new Map<string, BranchClassification>();
        branchClassifications.forEach(classification => map.set(classification.branchId, classification));
        return map;
    }, [branchClassifications]);

    const filteredBranches = branches.filter(b => {
        const q = searchTerm.toLowerCase();
        const classification = branchClassificationMap.get(b.id);
        return (
            b.name.toLowerCase().includes(q) ||
            b.code.toLowerCase().includes(q) ||
            (classification?.area || '').toLowerCase().includes(q) ||
            (classification?.supervisorName || '').toLowerCase().includes(q) ||
            (b.branchManagerName || '').toLowerCase().includes(q) ||
            (b.nhraLicenseNo || '').toLowerCase().includes(q) ||
            (b.crNumber || '').toLowerCase().includes(q)
        );
    });

    const filteredPharmacists = pharmacists.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedBranchAssignedPharmacistIds = useMemo(
        () => new Set(branchForm.id ? (pharmacistAssignmentsByBranch[branchForm.id] || []) : []),
        [branchForm.id, pharmacistAssignmentsByBranch]
    );

    const branchManagerOptions = useMemo(() => {
        return pharmacists
            .filter(pharmacist => pharmacist.isActive)
            .slice()
            .sort((a, b) => {
                const assignmentRank = Number(selectedBranchAssignedPharmacistIds.has(b.id)) - Number(selectedBranchAssignedPharmacistIds.has(a.id));
                if (assignmentRank !== 0) return assignmentRank;
                return (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name);
            });
    }, [pharmacists, selectedBranchAssignedPharmacistIds]);

    const currentBranchManagerName = branchForm.branchManagerName?.trim() || '';
    const selectedBranchManagerOption = branchManagerOptions.find(pharmacist => pharmacist.name === currentBranchManagerName);
    const selectedBranchManagerOptionValue = selectedBranchManagerOption?.id || currentBranchManagerName;
    const assignedBranchManagerOptionCount = branchManagerOptions.filter(pharmacist => selectedBranchAssignedPharmacistIds.has(pharmacist.id)).length;

    const selectedBranch = branches.find(branch => branch.id === selectedBranchForPerms);
    const modeMeta = SETTINGS_MODE_META[settingsMode];
    const ModeIcon = modeMeta.icon;
    const activeTabMeta = TAB_META[activeTab];
    const ActiveTabIcon = activeTabMeta.icon;
    const branchCount = branches.length;
    const classifiedBranchCount = branchClassifications.filter(classification => classification.governorate).length;
    const activePharmacistCount = pharmacists.filter(pharmacist => pharmacist.isActive).length;
    const maintenanceEnabled = maintenanceSettings?.isMaintenanceModeEnabled === true;
    const pharmacyPreviewLogoUrl = maintenanceSettings?.pharmacyLogoUrl?.trim() || DEFAULT_PHARMACY_LOGO_URL;
    const hubPreviewLogoUrl = maintenanceSettings?.hubLogoUrl?.trim() || DEFAULT_HUB_LOGO_URL;
    const browserPreviewIconUrl = maintenanceSettings?.browserIconUrl?.trim() || pharmacyPreviewLogoUrl;
    const loadingSpinnerPreviewUrl = maintenanceSettings?.loadingSpinnerUrl?.trim() || DEFAULT_LOADING_SPINNER_URL;
    const configuredFooterLogoUrl = maintenanceSettings?.footerLogoUrl?.trim() ?? '';
    const footerPreviewLogoUrl = configuredFooterLogoUrl || hubPreviewLogoUrl;
    const footerPreviewText = maintenanceSettings?.footerText?.trim() ?? 'HUB';
    const showFooterPreviewText = Boolean(footerPreviewText) && footerPreviewText.toLowerCase() !== 'hub';
    const brandingAssets = maintenanceSettings
        ? [
            {
                slot: 'pharmacy' as const,
                keyName: 'pharmacyLogoUrl' as const,
                title: 'Pharmacy logo',
                helper: 'Login, header, loading screen, HR print, and public flows.',
                recommended: 'Best: 512 x 512 PNG/WebP or SVG, transparent background.',
                value: maintenanceSettings.pharmacyLogoUrl,
                placeholder: 'Upload pharmacy logo'
            },
            {
                slot: 'hub' as const,
                keyName: 'hubLogoUrl' as const,
                title: 'HUB login logo',
                helper: 'Large animated HUB/logo artwork on the login page.',
                recommended: 'Best: 1200 x 360 SVG/PNG, transparent background.',
                value: maintenanceSettings.hubLogoUrl,
                placeholder: 'Upload HUB logo'
            },
            {
                slot: 'browser-icon' as const,
                keyName: 'browserIconUrl' as const,
                title: 'Browser icon',
                helper: 'Favicon shown in the browser tab.',
                recommended: 'Best: 512 x 512 PNG/SVG, simple mark, transparent background.',
                value: maintenanceSettings.browserIconUrl,
                placeholder: 'Upload favicon'
            },
            {
                slot: 'spinner' as const,
                keyName: 'loadingSpinnerUrl' as const,
                title: 'Loading spinner',
                helper: 'Shown while the app connects and inside public verification flows.',
                recommended: 'Best: 512 x 512 SVG/PNG/WebP, centered mark, transparent background.',
                value: maintenanceSettings.loadingSpinnerUrl,
                placeholder: 'Upload spinner'
            },
            {
                slot: 'footer' as const,
                keyName: 'footerLogoUrl' as const,
                title: 'Footer logo',
                helper: 'Optional footer override. Empty uses the HUB login logo.',
                recommended: 'Best: 900 x 300 SVG/PNG, dark/colored logo; footer renders it white.',
                value: maintenanceSettings.footerLogoUrl,
                placeholder: 'Upload footer logo'
            }
        ]
        : [];
    const visibleRecordCount = activeTab === 'branches'
        ? filteredBranches.length
        : activeTab === 'pharmacists'
            ? filteredPharmacists.length
            : activeTab === 'permissions'
                ? branches.length
                : 0;
    const selectedBranchPermissionCount = FEATURES.filter(feature => {
        return getEffectiveBranchAccess(feature.id) !== 'none';
    }).length;

    return (
        <div className="min-h-screen bg-[#f6f8fb] p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
            <div className="mx-auto max-w-[1500px] space-y-6">
                <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-5 md:p-7">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 items-start gap-4 md:gap-5">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/15">
                                    <ModeIcon className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand">{modeMeta.eyebrow}</p>
                                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${maintenanceEnabled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {maintenanceEnabled ? 'Maintenance on' : 'Live'}
                                        </span>
                                    </div>
                                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{modeMeta.title}</h1>
                                    <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500 md:text-base">
                                        {modeMeta.description}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center">
                                <button
                                    onClick={loadData}
                                    disabled={isLoading}
                                    className="btn-secondary rounded-xl text-[10px] uppercase tracking-widest"
                                >
                                    <RotateCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <BackToModulesButton onClick={onBack} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 bg-slate-50/60 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatTile label="Branches" value={branchCount} icon={Store} tone="brand" />
                        <StatTile label="Classified branches" value={`${classifiedBranchCount}/${branchCount}`} icon={Building2} />
                        <StatTile label="Active people" value={activePharmacistCount} icon={UserCheck} tone="emerald" />
                        <StatTile label="Domain status" value={maintenanceEnabled ? 'Paused' : 'Live'} icon={maintenanceEnabled ? Wrench : CheckCircle2} tone={maintenanceEnabled ? 'amber' : 'emerald'} />
                    </div>
                </header>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-brand/15">
                                <ActiveTabIcon size={19} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Control areas</p>
                                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">{settingsMode === 'access' ? 'Access map' : settingsMode === 'system' ? 'System map' : 'Operations map'}</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">{visibleSettingsTabs.length} areas</span>
                            {maintenanceEnabled && (
                                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Maintenance on</span>
                            )}
                        </div>
                    </div>

                    <nav className="custom-scrollbar flex gap-2 overflow-x-auto p-3" aria-label="Settings sections">
                        {visibleSettingsTabs.map(tab => {
                            const meta = TAB_META[tab];
                            const Icon = meta.icon;
                            const isActive = activeTab === tab;

                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(tab);
                                        if (tab === 'permissions') setSearchTerm('');
                                    }}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`group flex min-w-[190px] flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all focus-ring ${
                                        isActive
                                            ? 'border-brand bg-brand text-white shadow-sm shadow-brand/20'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-brand/25 hover:bg-brand/5 hover:text-slate-950'
                                    }`}
                                >
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                                        isActive ? 'border-white/15 bg-white/15 text-white' : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:border-brand/20 group-hover:text-brand'
                                    }`}>
                                        <Icon size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-black tracking-tight">{meta.label}</span>
                                            {tab === 'system' && maintenanceEnabled && (
                                                <span className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>On</span>
                                            )}
                                        </span>
                                        <span className={`mt-0.5 block truncate text-xs font-semibold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{meta.description}</span>
                                    </span>
                                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isActive ? 'text-white/80' : 'text-slate-300 group-hover:text-brand'}`} />
                                </button>
                            );
                        })}
                    </nav>
                </section>

                <section className="min-w-0 space-y-5">
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                        <ActiveTabIcon size={19} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                                        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{activeTabMeta.label}</h2>
                                        <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{activeTabMeta.description}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                    {activeTab !== 'system' && activeTab !== 'access-control' && activeTab !== 'login-approvals' && activeTab !== 'delivery-zones' && activeTab !== 'module-layout' && (
                                        <div className="relative min-w-0 md:w-80">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder={activeTab === 'permissions' ? 'Find branch...' : activeTab === 'pharmacists' ? 'Search name or code...' : 'Search records...'}
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 shadow-sm">
                                                {visibleRecordCount}
                                            </span>
                                        </div>
                                    )}

                                    {canManageSettings && (activeTab === 'branches' || activeTab === 'pharmacists') && (
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
                                            className="btn-primary whitespace-nowrap rounded-xl text-[10px] uppercase tracking-widest"
                                        >
                                            <Plus size={18} />
                                            Add {activeTab === 'branches' ? 'Branch' : 'Person'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>

                        <div className="operational-panel min-h-[560px] overflow-visible rounded-2xl">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-[560px] space-y-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-brand rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading settings...</span>
                        </div>
                    ) : (
                        <div className="p-5 md:p-6">
                            {activeTab === 'login-approvals' && (
                                <BranchLoginApprovalsSection
                                    settings={maintenanceSettings}
                                    settingsError={maintenanceSettingsError}
                                    onSettingsChange={updatedSettings => {
                                        setMaintenanceSettings(updatedSettings);
                                        onSettingsChange?.(updatedSettings);
                                    }}
                                />
                            )}

                            {activeTab === 'module-layout' && (
                                <ModuleDisplaySettingsSection
                                    settings={maintenanceSettings}
                                    settingsError={maintenanceSettingsError}
                                    onSettingsChange={updatedSettings => {
                                        setMaintenanceSettings(updatedSettings);
                                        onSettingsChange?.(updatedSettings);
                                    }}
                                />
                            )}

                            {activeTab === 'branches' && (
                                filteredBranches.length === 0 ? (
                                    <EmptyState
                                        icon={Store}
                                        title="No branches found"
                                        description="Try another search term or add a new operational branch."
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {filteredBranches.map(branch => {
                                            const classification = branchClassificationMap.get(branch.id);
                                            const enabledModules = [
                                                branch.isItemsEntryEnabled && 'Items',
                                                branch.isKPIDashboardEnabled && 'KPI',
                                                branch.isSpinEnabled && 'Spin'
                                            ].filter(Boolean);
                                            const moduleStates = [
                                                { label: 'Items Entry', enabled: Boolean(branch.isItemsEntryEnabled) },
                                                { label: 'KPI Dashboard', enabled: Boolean(branch.isKPIDashboardEnabled) },
                                                { label: 'Spin & Win', enabled: Boolean(branch.isSpinEnabled) }
                                            ];
                                            const areaName = classification?.area
                                                ? `${classification.area}${classification.governorate ? ` / ${classification.governorate}` : ''}`
                                                : undefined;

                                            return (
                                                <article key={branch.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/10">
                                                    <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                                                        <div className="p-5 md:p-6">
                                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="flex min-w-0 flex-1 items-start gap-4">
                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-brand/5 text-brand">
                                                                        <Store size={22} />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{branch.code || 'No code'}</span>
                                                                            <span className="rounded-md bg-brand/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-brand">Operational branch</span>
                                                                        </div>
                                                                        <h3 className="mt-2 break-words text-2xl font-black leading-8 tracking-tight text-slate-950">{branch.name}</h3>
                                                                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                                                            {areaName || 'Area not assigned'}{classification?.supervisorName ? ` - ${classification.supervisorName}` : ''}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex shrink-0 gap-2">
                                                                    <button
                                                                        onClick={() => { setBranchForm(branch); setIsBranchModalOpen(true); }}
                                                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                                                                        title="Edit branch"
                                                                        aria-label={`Edit ${branch.name}`}
                                                                    >
                                                                        <Edit2 size={17} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteBranch(branch.id)}
                                                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                                                        title="Delete branch"
                                                                        aria-label={`Delete ${branch.name}`}
                                                                    >
                                                                        <Trash2 size={17} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                                <BranchInfoItem label="Area" value={areaName} icon={Building2} />
                                                                <BranchInfoItem label="Supervisor" value={classification?.supervisorName} icon={UserCheck} />
                                                                <BranchInfoItem label="Branch Manager" value={branch.branchManagerName} icon={Users} />
                                                                <BranchInfoItem label="CR No." value={branch.crNumber} icon={Hash} />
                                                                <BranchInfoItem label="NHRA No." value={branch.nhraLicenseNo} icon={FileText} />
                                                            </div>
                                                        </div>

                                                        <aside className="border-t border-slate-100 bg-slate-50/70 p-5 md:p-6 xl:border-l xl:border-t-0">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Module availability</p>
                                                                    <p className="mt-1 text-sm font-black text-slate-900">{enabledModules.length}/3 active</p>
                                                                </div>
                                                                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${enabledModules.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                    {enabledModules.length > 0 ? 'Enabled' : 'Paused'}
                                                                </span>
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                                                {moduleStates.map(module => {
                                                                    return (
                                                                        <div key={module.label} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs font-black ${
                                                                            module.enabled ? 'border-brand/10 bg-white text-brand' : 'border-slate-200 bg-white/70 text-slate-400'
                                                                        }`}>
                                                                            <span className="break-words">{module.label}</span>
                                                                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${module.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                                                                Use edit to update branch identity, licenses, module flags, and branch manager assignment.
                                                            </p>
                                                        </aside>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {activeTab === 'delivery-zones' && (
                                <DeliveryZonesSection branches={branches} canEdit={canManageDeliveryZones} />
                            )}

                            {activeTab === 'pharmacists' && (
                                filteredPharmacists.length === 0 ? (
                                    <EmptyState
                                        icon={Users}
                                        title="No people found"
                                        description="Try another search term or add a new specialist profile."
                                    />
                                ) : (
                                    <section className="min-w-0 space-y-4">
                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">People roster</p>
                                                <h4 className="mt-1 text-base font-black tracking-tight text-slate-950">Specialist profiles</h4>
                                            </div>
                                            <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:w-fit">
                                                {filteredPharmacists.length} profile{filteredPharmacists.length === 1 ? '' : 's'}
                                            </span>
                                        </div>

                                        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                                            {filteredPharmacists.map(phar => {
                                                const assignedBranches = branches
                                                    .filter(branch => (pharmacistAssignmentsByBranch[branch.id] || []).includes(phar.id))
                                                    .sort((a, b) => a.name.localeCompare(b.name));
                                                const visibleAssignedBranches = assignedBranches.slice(0, 3);
                                                const hiddenBranchCount = Math.max(0, assignedBranches.length - visibleAssignedBranches.length);

                                                return (
                                                    <article key={phar.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/5">
                                                        <div className="border-b border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-white text-brand shadow-sm sm:h-11 sm:w-11">
                                                                    <Users size={19} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className="break-words text-sm font-black leading-5 tracking-tight text-slate-950 sm:text-base sm:leading-6">{phar.name}</h3>
                                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                        <span className="rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                                                            {phar.code || 'No code'}
                                                                        </span>
                                                                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                                            phar.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
                                                                        }`}>
                                                                            {phar.isActive ? 'Active' : 'Inactive'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid min-w-0 gap-4 p-3 sm:p-4">
                                                            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                                                                <div className="flex min-w-0 items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch assignments</p>
                                                                        <p className="mt-1 text-sm font-black text-slate-800">
                                                                            {assignedBranches.length} branch{assignedBranches.length === 1 ? '' : 'es'}
                                                                        </p>
                                                                    </div>
                                                                    <Building2 className="h-4 w-4 shrink-0 text-brand" />
                                                                </div>

                                                                {assignedBranches.length === 0 ? (
                                                                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">
                                                                        No branch assigned
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                                        {visibleAssignedBranches.map(branch => (
                                                                            <span key={branch.id} className="max-w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                                {branch.code || branch.name}
                                                                            </span>
                                                                        ))}
                                                                        {hiddenBranchCount > 0 && (
                                                                            <span className="rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                                                                +{hiddenBranchCount} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2">
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
                                                                    className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                                                                    title="Edit profile"
                                                                >
                                                                    <Edit2 size={15} />
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeletePharmacist(phar)}
                                                                    className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100"
                                                                    title="Remove pharmacist"
                                                                >
                                                                    <Trash2 size={15} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )
                            )}

                            {activeTab === 'access-control' && (
                                <AccessControlSection currentUserId={currentUserId} settings={maintenanceSettings} />
                            )}

                            {activeTab === 'permissions' && (
                                <div className="space-y-5">
                                    <AccessGuide />
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                                        <aside className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                                            <div className="mb-3 px-2">
                                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Target branch</h2>
                                                <p className="mt-1 text-xs font-medium text-slate-500">Pick one branch, then adjust overrides on top of the Branch role defaults.</p>
                                            </div>
                                            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                                                {filteredBranches.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-400">
                                                        No matching branches
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
                                                                <p className="break-words text-[11px] font-black uppercase tracking-wider leading-5">{branch.name}</p>
                                                                    <p className={`mt-1 text-[8px] font-bold uppercase tracking-widest ${selected ? 'text-white/60' : 'text-slate-400'}`}>Branch / {branch.code}</p>
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
                                                    title="Select a branch"
                                                    description="Choose an operational branch to review effective module access and manage branch-specific overrides."
                                                />
                                            ) : (
                                                <div className="space-y-5">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Permission target</p>
                                                                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{selectedBranch.name}</h3>
                                                                <p className="mt-1 text-sm font-medium text-slate-500">BRANCH / {selectedBranch.code}</p>
                                                            </div>
                                                            <div className="rounded-lg border border-brand/10 bg-brand/5 px-4 py-3 text-right">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Effective access</p>
                                                                <p className="mt-1 text-2xl font-black text-slate-950">{selectedBranchPermissionCount}/{FEATURES.length}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                        {FEATURES.map(feature => {
                                                            const explicitPermission = permissions.find(p => p.featureName === feature.id);
                                                            const defaultPerm = getBranchRoleDefaultAccess(feature.id);
                                                            const currentPerm = explicitPermission?.accessLevel || defaultPerm;
                                                            const isExplicitOverride = Boolean(explicitPermission);
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
                                                                            {feature.description && (
                                                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{feature.description}</p>
                                                                            )}
                                                                            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                                {isExplicitOverride ? 'Branch override active' : `Inherited branch default: ${defaultPerm}`}
                                                                            </p>
                                                                            <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                                                                <button
                                                                                    onClick={() => handleClearPermission(feature.id)}
                                                                                    className={`rounded-md px-2 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                                                                                        !isExplicitOverride
                                                                                            ? 'bg-slate-900 text-white shadow-sm'
                                                                                            : 'text-slate-400 hover:bg-white hover:text-slate-700'
                                                                                    }`}
                                                                                >
                                                                                    Default
                                                                                </button>
                                                                                {(['none', 'read', 'edit'] as const).map(level => (
                                                                                    <button
                                                                                        key={level}
                                                                                        onClick={() => handleUpdatePermission(feature.id, level)}
                                                                                        className={`rounded-md px-2 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                                                                                            isExplicitOverride && currentPerm === level
                                                                                                ? 'bg-brand text-white shadow-sm'
                                                                                                : 'text-slate-400 hover:bg-white hover:text-slate-700'
                                                                                        }`}
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

                            {activeTab === 'system' && maintenanceSettingsError && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                                            <AlertTriangle size={22} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">System settings blocked</p>
                                            <h2 className="mt-1 text-xl font-black tracking-tight text-amber-950">Settings could not be loaded from Supabase</h2>
                                            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-amber-800">
                                                The app is not treating defaults as saved settings. Resolve migrations, RLS, or connectivity before changing maintenance mode, footer branding, or POS instruction copy.
                                            </p>
                                            <p className="mt-3 break-words rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                                                {maintenanceSettingsError}
                                            </p>
                                            <button onClick={loadData} className="mt-4 btn-secondary text-[10px] uppercase tracking-widest">
                                                <RotateCcw size={15} /> Retry settings load
                                            </button>
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
                                                <h3 className="text-sm font-black tracking-tight text-slate-900">Branding & logos</h3>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Control the logos used in login, header, loading, footer, and the browser tab.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
                                            <div className="space-y-4">
                                                <div className="rounded-lg border border-brand/10 bg-brand/5 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Recommended upload format</p>
                                                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                                                        Use SVG when available. For raster files, use PNG/WebP with transparent background. Maximum file size is 5MB.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                                                    {brandingAssets.map(item => (
                                                        <div key={item.slot} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="mb-3 flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">{item.title}</p>
                                                                    <p className="mt-1 text-[11px] font-bold leading-5 text-slate-400">{item.helper}</p>
                                                                </div>
                                                                <ImageIcon className="h-4 w-4 shrink-0 text-brand" />
                                                            </div>
                                                            <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                                                                {item.value?.trim() ? (
                                                                    <img src={item.value} alt={`${item.title} preview`} className="max-h-full max-w-full object-contain" />
                                                                ) : (
                                                                    <div className="text-center">
                                                                        <ImageIcon className="mx-auto h-6 w-6 text-slate-300" />
                                                                        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">No uploaded logo</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold leading-5 text-slate-500">
                                                                {item.recommended}
                                                            </p>
                                                            <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/15 bg-brand/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition hover:bg-brand/10">
                                                                <UploadCloud className="h-3.5 w-3.5" />
                                                                {uploadingBrandingSlot === item.slot ? 'Uploading...' : item.placeholder}
                                                                <input
                                                                    type="file"
                                                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                                    className="hidden"
                                                                    disabled={!!uploadingBrandingSlot || isSavingFooter}
                                                                    onChange={event => {
                                                                        const file = event.target.files?.[0];
                                                                        event.currentTarget.value = '';
                                                                        handleUploadBrandingAsset(item.slot, file);
                                                                    }}
                                                                />
                                                            </label>
                                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced URL</label>
                                                            <input
                                                                type="text"
                                                                value={item.value}
                                                                onChange={event => setMaintenanceSettings({ ...maintenanceSettings, [item.keyName]: event.target.value })}
                                                                maxLength={500}
                                                                placeholder="Upload an image or paste a public image URL"
                                                                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                            />
                                                        </div>
                                                    ))}
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
                                                        disabled={isSavingFooter || !!uploadingBrandingSlot}
                                                        className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <Save size={18} />
                                                        Save branding
                                                    </button>
                                                    <button
                                                        onClick={() => setMaintenanceSettings({
                                                            ...maintenanceSettings,
                                                            pharmacyLogoUrl: '',
                                                            hubLogoUrl: '',
                                                            browserIconUrl: '',
                                                            loadingSpinnerUrl: '',
                                                            footerLogoUrl: '',
                                                            footerText: 'HUB'
                                                        })}
                                                        disabled={!!uploadingBrandingSlot}
                                                        className="btn-secondary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <RotateCcw size={16} />
                                                        Clear logo URLs
                                                    </button>
                                                </div>
                                            </div>

                                            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</p>
                                                <div className="mt-3 grid grid-cols-1 gap-3">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Login / Header</p>
                                                        <div className="mt-3 flex items-center gap-3">
                                                            <img
                                                                src={pharmacyPreviewLogoUrl}
                                                                alt="Pharmacy logo preview"
                                                                className="h-11 w-11 rounded-lg object-cover"
                                                            />
                                                            <p className="text-lg font-black text-slate-950">Tabarak Pharmacy</p>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-200 px-4 py-5" style={{ backgroundColor: '#0f172a' }}>
                                                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">HUB hero</p>
                                                        <img
                                                            src={hubPreviewLogoUrl}
                                                            alt="HUB logo preview"
                                                            className="h-20 w-full object-contain"
                                                        />
                                                        <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white">Developed by Ahmed Elsherbini</p>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Browser icon</p>
                                                        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                            <img
                                                                src={browserPreviewIconUrl}
                                                                alt="Browser icon preview"
                                                                className="h-6 w-6 rounded object-cover"
                                                            />
                                                            <span className="text-xs font-black text-slate-700">hub | Tabarak Pharmacy</span>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading spinner</p>
                                                        <div className="mt-3 flex items-center gap-3">
                                                            <img
                                                                src={loadingSpinnerPreviewUrl}
                                                                alt="Loading spinner preview"
                                                                className="h-14 w-14 object-contain"
                                                            />
                                                            <span className="text-xs font-bold leading-5 text-slate-500">Used while the app connects.</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 rounded-lg border border-slate-200 px-4 py-4" style={{ backgroundColor: '#0f172a' }}>
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={footerPreviewLogoUrl}
                                                            alt="HUB logo preview"
                                                            className="h-12 w-32 object-contain object-left brightness-0 invert"
                                                        />
                                                        {showFooterPreviewText && (
                                                            <p className="text-2xl font-black leading-none text-white">{footerPreviewText}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </aside>
                                        </div>
                                    </section>

                                    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-5 flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand shadow-sm">
                                                <Lock size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black tracking-tight text-slate-900">Login page badges</h3>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Control the small badges shown on the login page. Leave empty to show no badges.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Badges, one per line</label>
                                                    <textarea
                                                        value={(maintenanceSettings.loginBadges || []).join('\n')}
                                                        onChange={e => setMaintenanceSettings({
                                                            ...maintenanceSettings,
                                                            loginBadges: e.target.value
                                                                .split('\n')
                                                                .map(item => item.trim())
                                                                .slice(0, 6)
                                                        })}
                                                        maxLength={480}
                                                        rows={5}
                                                        placeholder="Example: Manager Approved Access"
                                                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                                                    />
                                                    <p className="text-xs font-semibold text-slate-400">Maximum 6 badges. Blank lines are ignored.</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={handleSaveLoginBadges}
                                                        disabled={isSavingLoginBadges}
                                                        className="btn-primary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <Save size={18} />
                                                        Save badges
                                                    </button>
                                                    <button
                                                        onClick={() => setMaintenanceSettings({ ...maintenanceSettings, loginBadges: [] })}
                                                        className="btn-secondary text-[10px] uppercase tracking-widest"
                                                    >
                                                        <RotateCcw size={16} />
                                                        Clear badges
                                                    </button>
                                                </div>
                                            </div>

                                            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</p>
                                                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-5">
                                                    {(maintenanceSettings.loginBadges || []).filter(Boolean).length > 0 ? (
                                                        <div className="flex flex-col items-center gap-3">
                                                            {maintenanceSettings.loginBadges.filter(Boolean).map((badge, index) => (
                                                                <span key={`${badge}-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-300">
                                                                    {badge}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-xs font-bold text-slate-500">No login badges will be shown.</p>
                                                    )}
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
                    </section>
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
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-xl animate-in zoom-in-95 duration-300">
                        <span id="branch-modal-description" className="sr-only">Configuration form for operational pharmacy branches.</span>
                        <div className="shrink-0 border-b bg-slate-50 p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h3 id="branch-modal-title" className="text-xl font-black text-slate-900 uppercase tracking-tight">Branch</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure an operational pharmacy branch</p>
                            </div>
                            <button onClick={() => setIsBranchModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors hover:bg-slate-100"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                                <section className="rounded-lg border border-slate-100 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch Details</p>
                                            <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">Identity & contacts</h4>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Code</label>
                                            <input
                                                type="text"
                                                value={branchForm.code}
                                                onChange={e => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase(), role: 'branch' })}
                                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                                                placeholder="e.g. T001"
                                            />
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
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Manager Name</label>
                                            <select
                                                value={selectedBranchManagerOptionValue}
                                                onChange={e => {
                                                    const selectedPharmacist = branchManagerOptions.find(pharmacist => pharmacist.id === e.target.value);
                                                    setBranchForm({ ...branchForm, branchManagerName: selectedPharmacist?.name || '' });
                                                }}
                                                disabled={branchManagerOptions.length === 0}
                                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none text-sm font-bold focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all disabled:cursor-not-allowed disabled:text-slate-400"
                                            >
                                                <option value="">{branchManagerOptions.length === 0 ? 'Register active pharmacists first' : 'Select registered pharmacist'}</option>
                                                {currentBranchManagerName && !selectedBranchManagerOption && (
                                                    <option value={currentBranchManagerName}>
                                                        Current: {currentBranchManagerName} (not in active registered pharmacists)
                                                    </option>
                                                )}
                                                {branchManagerOptions.map(pharmacist => {
                                                    const isAssignedToBranch = selectedBranchAssignedPharmacistIds.has(pharmacist.id);
                                                    return (
                                                        <option key={pharmacist.id} value={pharmacist.id}>
                                                            {pharmacist.code ? `${pharmacist.code} - ` : ''}{pharmacist.name}{isAssignedToBranch ? ' - assigned to this branch' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <p className="text-[10px] font-bold text-slate-400">
                                                {branchManagerOptions.length === 0
                                                    ? 'Add active pharmacist profiles before assigning a branch manager.'
                                                    : `${assignedBranchManagerOptionCount} assigned pharmacist${assignedBranchManagerOptionCount === 1 ? '' : 's'} listed first for this branch.`}
                                            </p>
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
                                        <div className="space-y-2 md:col-span-2">
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
                                </section>

                                <section className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div className="border-b border-slate-200 pb-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Module Access</p>
                                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">Branch capabilities</h4>
                                    </div>
                                    <div className="mt-4 grid gap-3">
                                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                                        <Zap size={18} className="text-amber-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-900">Spin & Win Capability</span>
                                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle customer incentive module</p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" checked={branchForm.isSpinEnabled} onChange={e => setBranchForm({ ...branchForm, isSpinEnabled: e.target.checked })} className="sr-only peer" />
                                                    <div className="h-6 w-11 rounded-full bg-slate-200 peer peer-checked:bg-brand peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                                                        <ShoppingCart size={18} className="text-blue-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-900">Items Entry System</span>
                                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle item logging in POS</p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" checked={branchForm.isItemsEntryEnabled} onChange={e => setBranchForm({ ...branchForm, isItemsEntryEnabled: e.target.checked })} className="sr-only peer" />
                                                    <div className="h-6 w-11 rounded-full bg-slate-200 peer peer-checked:bg-brand peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                                        <Activity size={18} className="text-emerald-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-900">Dashboard & KPI Analytics</span>
                                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Toggle charts and performance logs</p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" checked={branchForm.isKPIDashboardEnabled} onChange={e => setBranchForm({ ...branchForm, isKPIDashboardEnabled: e.target.checked })} className="sr-only peer" />
                                                    <div className="h-6 w-11 rounded-full bg-slate-200 peer peer-checked:bg-brand peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 sm:p-5 flex gap-4">
                            <button onClick={handleSaveBranch} className="btn-primary flex-1 text-[10px] uppercase tracking-widest"><Save size={18} /> Save Branch</button>
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
