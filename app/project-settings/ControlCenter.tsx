import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Hash,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  MapPinned,
  MessageCircle,
  PieChart,
  Plus,
  Power,
  RadioTower,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabase';
import {
  AppUser,
  Branch,
  BranchClassification,
  BranchStaffAssignment,
  BranchZone,
  DeliveryDriver,
  MaintenanceSettings,
  Pharmacist,
  Role,
  RolePermission,
  SupervisorScopeMode
} from '../../types';
import { ALL_ROLES, ROLE_LABELS, isAdminRole } from '../../lib/access';
import { getEnabledAccessFeatures, getSubToolsForModule } from '../../lib/moduleRegistry';
import { getSystemSettingsErrorMessage, type SystemBrandingAssetSlot } from '../../services/systemSettingsService';
import { branchService, deliveryService, permissionService, pharmacistService } from '../../services';
import { clientConfig } from '../../config/clientConfig';
import { BackToModulesButton } from '../shared';
import { useControlCenter } from './useControlCenter';
import { SubToolPermissionModal } from './SubToolPermissionModal';
import { BranchLoginApprovalsSection } from './BranchLoginApprovalsSection';
import { DeliveryZonesSection } from './DeliveryZonesSection';
import { ModuleDisplaySettingsSection } from './ModuleDisplaySettingsSection';
import { BahrainLicensePlate, FleetVehiclePlate, FleetVehiclesBar } from '../delivery/components/BahrainLicensePlate';
import {
  EmployeeRoleAvatar,
  EmployeeRoleFilterBar,
  EmployeeRoleBadge,
  type EmployeeRoleCategory,
  AllStaffAvatar,
  PharmacistAvatar,
  DriverAvatar,
  WorkerAvatar,
  ManagementAvatar
} from '../shared';

export type ControlCenterPillar = 'identity' | 'operations' | 'experience' | 'maintenance';

export type ControlCenterTab =
  | 'users'
  | 'role-matrix'
  | 'supervisor-scopes'
  | 'login-approvals'
  | 'branches'
  | 'delivery-zones'
  | 'module-layout'
  | 'branding'
  | 'system-maintenance'
  | 'supabase-health';

export interface ControlCenterProps {
  onBack: () => void;
  onSettingsChange?: (settings: MaintenanceSettings) => void;
  currentRole?: Role;
  mode?: 'combined' | 'system' | 'access';
  initialTab?: ControlCenterTab;
}

interface PillarConfig {
  id: ControlCenterPillar;
  title: string;
  titleAr: string;
  description: string;
  icon: React.ElementType;
  tone: 'brand' | 'emerald' | 'amber' | 'blue';
  tabs: {
    id: ControlCenterTab;
    label: string;
    labelAr: string;
    description: string;
    icon: React.ElementType;
  }[];
}

const PILLARS: PillarConfig[] = [
  {
    id: 'identity',
    title: 'Identity & Access',
    titleAr: 'الهوية والوصول',
    description: 'Manage users, role matrix, supervisor branch zones, and branch login approvals.',
    icon: ShieldCheck,
    tone: 'brand',
    tabs: [
      {
        id: 'users',
        label: 'Users & Permissions',
        labelAr: 'المستخدمون والصلاحيات',
        description: 'Active accounts, login roles, and granular sub-tool permissions',
        icon: Users
      },
      {
        id: 'role-matrix',
        label: 'Role Matrix & Defaults',
        labelAr: 'مصفوفة الأدوار والافتراضيات',
        description: 'Standard role permission matrix across all modules',
        icon: Shield
      },
      {
        id: 'supervisor-scopes',
        label: 'Supervisor Scopes',
        labelAr: 'نطاقات المشرفين',
        description: 'Zone assignments and operational branch mapping',
        icon: MapPinned
      },
      {
        id: 'login-approvals',
        label: 'Login Approvals',
        labelAr: 'اعتمادات تسجيل الدخول',
        description: 'Approve or revoke branch device access requests',
        icon: KeyRound
      }
    ]
  },
  {
    id: 'operations',
    title: 'Operational Infrastructure',
    titleAr: 'الهيكل التشغيلي',
    description: 'Workforce directory, GPS geofenced boundaries, and delivery service rings.',
    icon: Building2,
    tone: 'emerald',
    tabs: [
      {
        id: 'branches',
        label: 'Workforce & Geofenced Directory',
        labelAr: 'دليل المواقع والكوادر',
        description: 'Workforce roster, GPS geofenced radii, and staff fleet',
        icon: Store
      },
      {
        id: 'delivery-zones',
        label: 'Delivery & Service Rings',
        labelAr: 'مناطق التوصيل والدوائر',
        description: 'Origin blocks, delivery bands, and coverage radius',
        icon: MapPinned
      }
    ]
  },
  {
    id: 'experience',
    title: 'System Experience',
    titleAr: 'واجهة وتخصيص النظام',
    description: 'Module launcher order, alert badges, and pharmacy branding assets.',
    icon: LayoutGrid,
    tone: 'blue',
    tabs: [
      {
        id: 'module-layout',
        label: 'Module Layout & Badges',
        labelAr: 'ترتيب الوحدات والشارات',
        description: 'Drag launcher cards and configure notification badges',
        icon: LayoutGrid
      },
      {
        id: 'branding',
        label: 'Branding & Logos',
        labelAr: 'الهوية والشعارات',
        description: 'Pharmacy logos, headers, spinners, and footer credits',
        icon: ImageIcon
      }
    ]
  },
  {
    id: 'maintenance',
    title: 'Domain & Maintenance',
    titleAr: 'الصيانة والخدمة',
    description: 'System maintenance mode, public emergency notices, and Supabase health checks.',
    icon: RadioTower,
    tone: 'amber',
    tabs: [
      {
        id: 'system-maintenance',
        label: 'System Maintenance & Flags',
        labelAr: 'صيانة النظام والتعليمات',
        description: 'Global maintenance mode, notices, and POS guideline box',
        icon: Wrench
      },
      {
        id: 'supabase-health',
        label: 'Supabase Health & Audit',
        labelAr: 'صحة النظام وسجل التدقيق',
        description: 'Database connection status, latency, and system health',
        icon: Activity
      }
    ]
  }
];

const DEFAULT_BRANCH_DUTY_RADIUS_M = 50;

const escapeHtml = (value: string | null | undefined) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const roleBadgeClass = (role: Role) =>
  role === 'admin' || role === 'manager'
    ? 'border-brand/15 bg-brand/5 text-brand'
    : role === 'owner'
    ? 'border-violet-200 bg-violet-50 text-violet-700'
    : role === 'supervisor'
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : role === 'warehouse'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : role === 'accounts'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : role === 'driver'
    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
    : 'border-slate-200 bg-slate-50 text-slate-700';

const accessBadgeClass = (level: 'none' | 'read' | 'edit') =>
  level === 'edit'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : level === 'read'
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : 'border-slate-200 bg-slate-50 text-slate-400';

export const ControlCenter: React.FC<ControlCenterProps> = ({
  onBack,
  onSettingsChange,
  currentRole = 'admin',
  mode = 'combined',
  initialTab
}) => {
  const {
    users,
    branches,
    zones,
    drivers,
    pharmacists,
    branchStaffAssignments,
    roleDefaults,
    supervisorAssignments,
    maintenanceSettings,
    setMaintenanceSettings,
    maintenanceSettingsError,
    isLoading,
    savingKey,
    setSavingKey,
    error,
    currentUserId,
    healthState,
    checkHealth,
    reload,
    handleOptimisticRoleChange,
    handleOptimisticActiveToggle,
    handleOptimisticCycleRoleDefault
  } = useControlCenter();

  const [activeTab, setActiveTab] = useState<ControlCenterTab>(() => {
    if (initialTab) return initialTab;
    if (mode === 'system') return 'system-maintenance';
    if (mode === 'access') return 'users';
    return 'users';
  });

  const [activeSubToolUser, setActiveSubToolUser] = useState<AppUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState<SystemBrandingAssetSlot | null>(null);

  // Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<Partial<Branch>>({
    role: 'branch',
    lat: null,
    lng: null,
    dutyRadiusM: DEFAULT_BRANCH_DUTY_RADIUS_M,
    isSpinEnabled: false,
    isItemsEntryEnabled: true,
    isKPIDashboardEnabled: true
  });

  // Pharmacist Modal State
  const [isPharModalOpen, setIsPharModalOpen] = useState(false);
  const [pharForm, setPharForm] = useState<{ code: string; name: string; isActive: boolean; branchIds: string[]; id?: string }>({
    code: '',
    name: '',
    isActive: true,
    branchIds: []
  });

  const [userRoleFilter, setUserRoleFilter] = useState<EmployeeRoleCategory>('all');

  const activePillar = useMemo(() => {
    return PILLARS.find(p => p.tabs.some(t => t.id === activeTab)) || PILLARS[0];
  }, [activeTab]);

  const enabledFeatures = useMemo(() => getEnabledAccessFeatures(), []);

  const branchOptions = useMemo(
    () => branches.filter(b => b.role === 'branch').sort((a, b) => a.name.localeCompare(b.name)),
    [branches]
  );
  const zoneOptions = useMemo(
    () => zones.filter(zone => zone.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [zones]
  );
  const driverOptions = useMemo(
    () => drivers.filter(driver => driver.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [drivers]
  );
  const pharmacistOptions = useMemo(
    () =>
      pharmacists
        .filter(pharmacist => pharmacist.isActive)
        .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name)),
    [pharmacists]
  );

  const branchStaffByBranchId = useMemo(() => {
    const map = new Map<string, BranchStaffAssignment>();
    branchStaffAssignments.forEach(assignment => map.set(assignment.branchId, assignment));
    return map;
  }, [branchStaffAssignments]);

  const userRoleCounts = useMemo<Partial<Record<EmployeeRoleCategory, number>>>(() => ({
    all: users.length,
    pharmacist: users.filter(u => u.role === 'branch').length,
    driver: users.filter(u => u.role === 'driver').length,
    worker: users.filter(u => u.role === 'warehouse' || u.role === 'accounts').length,
    management: users.filter(u => u.role === 'admin' || u.role === 'manager' || u.role === 'owner' || u.role === 'supervisor').length
  }), [users]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userRoleFilter === 'pharmacist') {
      list = list.filter(u => u.role === 'branch');
    } else if (userRoleFilter === 'driver') {
      list = list.filter(u => u.role === 'driver');
    } else if (userRoleFilter === 'worker') {
      list = list.filter(u => u.role === 'warehouse' || u.role === 'accounts');
    } else if (userRoleFilter === 'management') {
      list = list.filter(u => u.role === 'admin' || u.role === 'manager' || u.role === 'owner' || u.role === 'supervisor');
    }

    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        (u.branchName && u.branchName.toLowerCase().includes(q)) ||
        (u.branchCode && u.branchCode.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [searchTerm, userRoleFilter, users]);

  const [branchStaffFilter, setBranchStaffFilter] = useState<EmployeeRoleCategory>('all');

  const branchWorkersByBranchId = useMemo(() => {
    const map = new Map<string, AppUser[]>();
    users.forEach(u => {
      if ((u.role === 'warehouse' || u.role === 'accounts') && u.branchId) {
        const list = map.get(u.branchId) || [];
        list.push(u);
        map.set(u.branchId, list);
      }
    });
    return map;
  }, [users]);

  const branchStaffCounts = useMemo<Partial<Record<EmployeeRoleCategory, number>>>(() => {
    let totalPhar = 0;
    let totalDrivers = 0;
    let totalMgr = 0;
    let totalWorkers = 0;

    branchOptions.forEach(b => {
      const assignment = branchStaffByBranchId.get(b.id);
      if (assignment) {
        totalPhar += assignment.pharmacistIds.length;
        totalDrivers += assignment.driverIds.length;
      }
      if (b.branchManagerName) {
        totalMgr += 1;
      }
      const workers = branchWorkersByBranchId.get(b.id);
      if (workers) {
        totalWorkers += workers.length;
      }
    });

    const unassignedWorkers = users.filter(u => u.role === 'warehouse' || u.role === 'accounts').length;
    const workerCount = Math.max(totalWorkers, unassignedWorkers);

    return {
      all: totalPhar + totalDrivers + totalMgr + workerCount,
      pharmacist: totalPhar,
      driver: totalDrivers,
      worker: workerCount,
      management: totalMgr
    };
  }, [branchOptions, branchStaffByBranchId, branchWorkersByBranchId, users]);

  const filteredBranches = useMemo(() => {
    let list = branchOptions;

    if (branchStaffFilter === 'pharmacist') {
      list = list.filter(b => {
        const assignment = branchStaffByBranchId.get(b.id);
        return assignment && assignment.pharmacistIds.length > 0;
      });
    } else if (branchStaffFilter === 'driver') {
      list = list.filter(b => {
        const assignment = branchStaffByBranchId.get(b.id);
        return assignment && assignment.driverIds.length > 0;
      });
    } else if (branchStaffFilter === 'worker') {
      list = list.filter(b => {
        const workers = branchWorkersByBranchId.get(b.id);
        return workers && workers.length > 0;
      });
    } else if (branchStaffFilter === 'management') {
      list = list.filter(b => Boolean(b.branchManagerName));
    }

    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      b =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.branchManagerName && b.branchManagerName.toLowerCase().includes(q))
    );
  }, [branchOptions, branchStaffByBranchId, branchWorkersByBranchId, branchStaffFilter, searchTerm]);

  // --- Handlers ---

  const handleCreateUser = async () => {
    const branchOptionsHtml = branchOptions
      .map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.code)})</option>`)
      .join('');
    const driverOptionsHtml = driverOptions
      .map(
        driver =>
          `<option value="${escapeHtml(driver.id)}">${escapeHtml(
            driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name
          )}${driver.authUserId ? ' (linked)' : ''}</option>`
      )
      .join('');
    const supervisorOptionsHtml = zoneOptions
      .map(
        zone => `
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
            <input type="checkbox" value="${escapeHtml(zone.id)}" class="swal-new-supervisor-zone h-4 w-4 accent-[#B91c1c]">
            ${escapeHtml(zone.code)} - ${escapeHtml(zone.name)} <span class="text-slate-400 font-medium">(${zone.branchIds.length} branches)</span>
        </label>`
      )
      .join('');

    const { value } = await Swal.fire({
      title: '<span class="text-xl font-black tracking-tight">Add Login Account</span>',
      html: `
        <div class="space-y-4 text-left">
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                <input id="swal-new-email" type="email" placeholder="user@example.com" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Temporary Password</label>
                <input id="swal-new-password" type="password" placeholder="Minimum 8 characters" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Role</label>
                <select id="swal-new-role" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    ${ALL_ROLES.map(role => `<option value="${role}">${escapeHtml(ROLE_LABELS[role] || role)}</option>`).join('')}
                </select>
            </div>
            <div id="swal-new-branch-wrap" class="hidden">
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Linked Branch</label>
                <select id="swal-new-branch" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    <option value="">Select branch...</option>
                    ${branchOptionsHtml}
                </select>
            </div>
            <div id="swal-new-driver-wrap" class="hidden">
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Linked Driver</label>
                <select id="swal-new-driver" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    <option value="">Select driver...</option>
                    ${driverOptionsHtml}
                </select>
            </div>
            <div id="swal-new-supervisor-wrap" class="hidden">
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor Zones</label>
                <div class="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    ${supervisorOptionsHtml || '<p class="p-2 text-xs font-bold text-slate-400">No zones created yet.</p>'}
                </div>
            </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Account',
      confirmButtonColor: '#B91c1c',
      width: 540,
      didOpen: () => {
        const roleInput = document.getElementById('swal-new-role') as HTMLSelectElement | null;
        const branchWrap = document.getElementById('swal-new-branch-wrap');
        const driverWrap = document.getElementById('swal-new-driver-wrap');
        const supervisorWrap = document.getElementById('swal-new-supervisor-wrap');
        const sync = () => {
          const role = roleInput?.value;
          branchWrap?.classList.toggle('hidden', role !== 'branch');
          driverWrap?.classList.toggle('hidden', role !== 'driver');
          supervisorWrap?.classList.toggle('hidden', role !== 'supervisor');
        };
        roleInput?.addEventListener('change', sync);
        sync();
      },
      preConfirm: () => {
        const email = (document.getElementById('swal-new-email') as HTMLInputElement).value.trim().toLowerCase();
        const password = (document.getElementById('swal-new-password') as HTMLInputElement).value;
        const role = (document.getElementById('swal-new-role') as HTMLSelectElement).value as Role;
        const branchId = (document.getElementById('swal-new-branch') as HTMLSelectElement).value || null;
        const driverId = (document.getElementById('swal-new-driver') as HTMLSelectElement).value || null;
        const supervisorZoneIds = Array.from(
          document.querySelectorAll<HTMLInputElement>('.swal-new-supervisor-zone:checked')
        ).map(i => i.value);

        if (!email || !email.includes('@')) {
          Swal.showValidationMessage('Enter a valid email.');
          return false;
        }
        if (password.length < 8) {
          Swal.showValidationMessage('Password must be at least 8 characters.');
          return false;
        }
        if (role === 'branch' && !branchId) {
          Swal.showValidationMessage('Branch role requires a linked branch.');
          return false;
        }
        if (role === 'driver' && !driverId) {
          Swal.showValidationMessage('Driver role requires a linked driver profile.');
          return false;
        }

        return { email, password, role, branchId, driverId, supervisorZoneIds, isActive: true };
      }
    });

    if (!value) return;

    try {
      await permissionService.adminCreateUser(value);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Account Created',
        text: `Login account ${value.email} created successfully.`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'Failed to create user.', 'error');
    }
  };

  const handleRoleChange = async (user: AppUser, newRole: Role) => {
    let branchId: string | null = newRole === 'branch' ? user.branchId || null : null;
    let driverId: string | null = null;

    if (newRole === 'branch' && !branchId) {
      const { value } = await Swal.fire({
        title: 'Link Branch',
        html: `
          <select id="swal-branch" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
            <option value="">Select branch…</option>
            ${branchOptions.map(b => `<option value="${b.id}">${b.name} (${b.code})</option>`).join('')}
          </select>`,
        showCancelButton: true,
        confirmButtonColor: '#B91c1c',
        preConfirm: () => (document.getElementById('swal-branch') as HTMLSelectElement).value
      });
      if (!value) return;
      branchId = value;
    }

    if (newRole === 'driver') {
      const { value } = await Swal.fire({
        title: 'Link Driver Profile',
        html: `
          <select id="swal-driver" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
            <option value="">Select driver...</option>
            ${driverOptions.map(driver => `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name)}</option>`).join('')}
          </select>`,
        showCancelButton: true,
        confirmButtonColor: '#B91c1c',
        preConfirm: () => (document.getElementById('swal-driver') as HTMLSelectElement).value
      });
      if (!value) return;
      driverId = value;
    }

    try {
      await handleOptimisticRoleChange(user, newRole, branchId, driverId);
      Swal.fire({
        icon: 'success',
        title: 'Role Updated',
        text: `${user.email} is now assigned as ${ROLE_LABELS[newRole]}.`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Update Failed', e?.message || 'Could not change user role.', 'error');
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    const result = await Swal.fire({
      title: 'Delete Account?',
      html: `
        <div class="text-left text-sm font-semibold leading-6 text-slate-600">
          <p>Permanently remove <strong>${escapeHtml(user.email)}</strong> from Supabase Auth and remove the app profile.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete Account',
      confirmButtonColor: '#B91c1c'
    });

    if (!result.isConfirmed) return;

    try {
      await permissionService.adminDeleteUser(user.userId);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Account Deleted',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Delete Failed', e?.message || 'Could not delete user.', 'error');
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    const { value } = await Swal.fire({
      title: '<span class="text-xl font-black tracking-tight">Assign New Password</span>',
      html: `
        <div class="space-y-4 text-left">
          <p class="text-xs text-slate-500 font-semibold">Updating password for <strong>${escapeHtml(user.email)}</strong></p>
          <div>
            <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">New Password</label>
            <input id="swal-reset-pwd" type="password" placeholder="Minimum 8 characters" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
          </div>
          <div>
            <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm Password</label>
            <input id="swal-reset-pwd-conf" type="password" placeholder="Re-enter password" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Update Password',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => {
        const p1 = (document.getElementById('swal-reset-pwd') as HTMLInputElement).value;
        const p2 = (document.getElementById('swal-reset-pwd-conf') as HTMLInputElement).value;
        if (p1.length < 8) {
          Swal.showValidationMessage('Password must be at least 8 characters.');
          return false;
        }
        if (p1 !== p2) {
          Swal.showValidationMessage('Passwords do not match.');
          return false;
        }
        return p1;
      }
    });

    if (!value) return;

    try {
      await permissionService.adminResetUserPassword(user.userId, value);
      Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Password Error', e?.message || 'Could not update password.', 'error');
    }
  };

  const handleSupervisorZones = async (user: AppUser) => {
    const current = supervisorAssignments[user.userId] || [];
    const currentScopeMode: SupervisorScopeMode = user.supervisorScopeMode === 'all_zones' ? 'all_zones' : 'assigned_zones';

    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">Zones for ${user.email}</span>`,
      html: `
        <div class="space-y-4 text-left">
          <div>
            <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Scope Mode</label>
            <select id="swal-scope-mode" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
              <option value="assigned_zones" ${currentScopeMode === 'assigned_zones' ? 'selected' : ''}>Assigned Zones Only</option>
              <option value="all_zones" ${currentScopeMode === 'all_zones' ? 'selected' : ''}>All Zones (Global)</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Zones</label>
            <div class="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
              ${zoneOptions
                .map(
                  zone => `
                <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700 bg-white">
                  <input type="checkbox" value="${zone.id}" ${current.includes(zone.id) ? 'checked' : ''} class="swal-sup-zone h-4 w-4 accent-[#B91c1c]">
                  ${escapeHtml(zone.code)} - ${escapeHtml(zone.name)} <span class="text-slate-400 font-medium">(${zone.branchIds.length} branches)</span>
                </label>`
                )
                .join('')}
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Scopes',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => ({
        scopeMode: (document.getElementById('swal-scope-mode') as HTMLSelectElement).value as SupervisorScopeMode,
        zoneIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-sup-zone:checked')).map(i => i.value)
      })
    });

    if (!value) return;

    try {
      await permissionService.adminSetSupervisorScopeMode(user.userId, value.scopeMode);
      await permissionService.setSupervisorZones(user.userId, value.zoneIds);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Supervisor Scopes Saved',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'Could not save supervisor scopes.', 'error');
    }
  };

  const handleZoneEditor = async (zone?: BranchZone) => {
    const activeSupervisorUsers = users.filter(user => user.role === 'supervisor' && user.isActive);
    const supervisorOptionsHtml = activeSupervisorUsers
      .map(
        user => `
        <option value="${escapeHtml(user.userId)}" ${zone?.supervisorUserId === user.userId ? 'selected' : ''}>
            ${escapeHtml(user.email)}
        </option>
      `
      )
      .join('');

    const branchOptionsHtml = branchOptions
      .map(branch => {
        const ownerZone = zones.find(item => item.id !== zone?.id && item.branchIds.includes(branch.id));
        return `
          <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700 bg-white">
              <input type="checkbox" value="${escapeHtml(branch.id)}" ${zone?.branchIds.includes(branch.id) ? 'checked' : ''} class="swal-zone-branch h-4 w-4 accent-[#B91c1c]">
              <span class="min-w-0">
                  <span class="block">${escapeHtml(branch.name)} <span class="text-slate-400 font-medium">(${escapeHtml(branch.code)})</span></span>
                  ${ownerZone ? `<span class="block text-[10px] font-bold uppercase tracking-widest text-amber-600">Currently in ${escapeHtml(ownerZone.name)}</span>` : ''}
              </span>
          </label>`;
      })
      .join('');

    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">${zone ? 'Edit' : 'Create'} Branch Zone</span>`,
      html: `
        <div class="space-y-4 text-left">
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Zone Code</label>
                <input id="swal-zone-code" value="${escapeHtml(zone?.code)}" placeholder="ZONE_1" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold uppercase outline-none">
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Zone Name</label>
                <input id="swal-zone-name" value="${escapeHtml(zone?.name)}" placeholder="Capital Zone 1" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Supervisor</label>
                <select id="swal-zone-sup" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    <option value="">No supervisor assigned</option>
                    ${supervisorOptionsHtml}
                </select>
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Branches in Zone</label>
                <div class="max-h-60 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    ${branchOptionsHtml || '<p class="p-2 text-xs font-bold text-slate-400">No branches found.</p>'}
                </div>
            </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Zone',
      confirmButtonColor: '#B91c1c',
      width: 620,
      preConfirm: () => {
        const code = (document.getElementById('swal-zone-code') as HTMLInputElement).value.trim().toUpperCase();
        const name = (document.getElementById('swal-zone-name') as HTMLInputElement).value.trim();
        const supervisorUserId = (document.getElementById('swal-zone-sup') as HTMLSelectElement).value || null;
        const branchIds = Array.from(document.querySelectorAll<HTMLInputElement>('.swal-zone-branch:checked')).map(i => i.value);

        if (!code || !name) {
          Swal.showValidationMessage('Zone code and name are required.');
          return false;
        }

        return { code, name, supervisorUserId, branchIds, isActive: true };
      }
    });

    if (!value) return;

    try {
      const saved = await permissionService.upsertBranchZone({
        id: zone?.id,
        code: value.code,
        name: value.name,
        supervisorUserId: value.supervisorUserId,
        isActive: value.isActive,
        branchIds: value.branchIds
      });
      await permissionService.replaceBranchZoneBranches(saved.id, value.branchIds);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Zone Saved',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Zone Error', e?.message || 'Could not save zone.', 'error');
    }
  };

  const handleBranchStaffEditor = async (branch: Branch) => {
    const current = branchStaffByBranchId.get(branch.id) || { branchId: branch.id, pharmacistIds: [], driverIds: [] };

    const pharHtml = pharmacistOptions
      .map(
        p => `
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700 bg-white">
            <input type="checkbox" value="${escapeHtml(p.id)}" ${current.pharmacistIds.includes(p.id) ? 'checked' : ''} class="swal-staff-phar h-4 w-4 accent-[#B91c1c]">
            <span>${escapeHtml(p.code ? `${p.code} - ${p.name}` : p.name)}</span>
        </label>`
      )
      .join('');

    const driverHtml = driverOptions
      .map(
        d => `
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700 bg-white">
            <input type="checkbox" value="${escapeHtml(d.id)}" ${current.driverIds.includes(d.id) ? 'checked' : ''} class="swal-staff-driver h-4 w-4 accent-[#B91c1c]">
            <span>${escapeHtml(d.driverCode ? `${d.driverCode} - ${d.name}` : d.name)}</span>
        </label>`
      )
      .join('');

    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">Staff for ${escapeHtml(branch.code || branch.name)}</span>`,
      html: `
        <div class="space-y-4 text-left">
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Pharmacists</label>
                <div class="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    ${pharHtml || '<p class="p-2 text-xs font-bold text-slate-400">No active pharmacists.</p>'}
                </div>
            </div>
            <div>
                <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Drivers</label>
                <div class="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    ${driverHtml || '<p class="p-2 text-xs font-bold text-slate-400">No active drivers.</p>'}
                </div>
            </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Staff Assignment',
      confirmButtonColor: '#B91c1c',
      width: 640,
      preConfirm: () => ({
        pharmacistIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-staff-phar:checked')).map(i => i.value),
        driverIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-staff-driver:checked')).map(i => i.value)
      })
    });

    if (!value) return;

    try {
      await permissionService.replaceBranchStaffAssignments(branch.id, value.pharmacistIds, value.driverIds);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Staff Assignment Saved',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Staff Error', e?.message || 'Could not save staff assignments.', 'error');
    }
  };

  const handleSaveBranch = async () => {
    if (!branchForm.code || !branchForm.name) {
      Swal.fire('Required', 'Branch code and name are required.', 'warning');
      return;
    }

    try {
      await branchService.upsert({
        ...branchForm,
        role: 'branch',
        dutyRadiusM: branchForm.dutyRadiusM ?? DEFAULT_BRANCH_DUTY_RADIUS_M
      });
      setIsBranchModalOpen(false);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Branch Saved',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Branch Error', e?.message || 'Could not save branch.', 'error');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    const result = await Swal.fire({
      title: 'Remove Branch?',
      text: 'Permanently remove this branch record. Historical dependencies may block deletion.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove Branch',
      confirmButtonColor: '#B91c1c'
    });

    if (!result.isConfirmed) return;

    try {
      await branchService.delete(branchId);
      await reload();
      Swal.fire({
        icon: 'success',
        title: 'Branch Removed',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Delete Failed', e?.message || 'Could not remove branch.', 'error');
    }
  };

  const handleToggleMaintenanceMode = async () => {
    if (!maintenanceSettings) return;
    const nextEnabled = !maintenanceSettings.isMaintenanceModeEnabled;

    if (nextEnabled) {
      const confirm = await Swal.fire({
        title: 'Enable Maintenance Mode?',
        text: 'Branch and guest users will see the maintenance screen until turned off.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Enable Maintenance',
        confirmButtonColor: '#B91c1c'
      });
      if (!confirm.isConfirmed) return;
    }

    try {
      const updated = await supabase.systemSettings.updateMaintenanceSettings({
        isMaintenanceModeEnabled: nextEnabled
      });
      setMaintenanceSettings(updated);
      onSettingsChange?.(updated);
      Swal.fire({
        icon: 'success',
        title: nextEnabled ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Maintenance Error', e?.message || 'Could not update maintenance mode.', 'error');
    }
  };

  const handleUploadBrandingAsset = async (slot: SystemBrandingAssetSlot, file?: File | null) => {
    if (!file || !maintenanceSettings || uploadingSlot) return;

    setUploadingSlot(slot);
    try {
      const uploadedUrl = await supabase.systemSettings.uploadBrandingAsset(file, slot);
      const fieldMap: Record<SystemBrandingAssetSlot, string> = {
        pharmacy: 'pharmacyLogoUrl',
        hub: 'hubLogoUrl',
        'browser-icon': 'browserIconUrl',
        spinner: 'loadingSpinnerUrl',
        footer: 'footerLogoUrl'
      };
      const field = fieldMap[slot];
      const updated = await supabase.systemSettings.updateMaintenanceSettings({ [field]: uploadedUrl });
      setMaintenanceSettings(updated);
      onSettingsChange?.(updated);
      Swal.fire({
        icon: 'success',
        title: 'Asset Uploaded',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (e: any) {
      Swal.fire('Upload Failed', e?.message || 'Could not upload branding asset.', 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Top Controller Header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-brand/5 text-brand shadow-sm">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Consolidated Admin Suite
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                  Zero Conflict
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Unified Control Center
              </h1>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Central command for system configuration, role matrix, branch infrastructure, and granular sub-tool permissions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => reload()}
              disabled={isLoading}
              className="btn-secondary text-[10px] uppercase tracking-widest"
              title="Refresh all data"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <BackToModulesButton onClick={onBack} label="Exit Control Center" />
          </div>
        </div>

        {/* 4 Pillars Navigation Bar */}
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(pillar => {
            const Icon = pillar.icon;
            const isPillarActive = activePillar.id === pillar.id;

            return (
              <div
                key={pillar.id}
                className={`flex flex-col rounded-xl border p-3 transition-all ${
                  isPillarActive
                    ? 'border-brand/30 bg-brand/5 shadow-sm'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isPillarActive ? 'text-brand' : 'text-slate-400'}`} />
                  <span className="text-xs font-black text-slate-900">{pillar.title}</span>
                  <span className="text-[10px] font-bold text-slate-400">({pillar.titleAr})</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {pillar.tabs.map(tab => {
                    const isTabActive = activeTab === tab.id;
                    const TabIcon = tab.icon;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                          isTabActive
                            ? 'bg-brand text-white shadow-sm ring-1 ring-brand/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <TabIcon className="h-3 w-3" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Overlay or Active Tab Content */}
      {isLoading ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Loading Control Center Records...
          </p>
        </div>
      ) : (
        <main className="space-y-6">
          {/* ========================================================================= */}
          {/* PILLAR 1: IDENTITY & ACCESS                                                */}
          {/* ========================================================================= */}

          {/* TAB 1.1: USERS & PERMISSIONS */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900">
                    Active Accounts & Granular Sub-Tools
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    Manage login users, assign roles, and configure precision sub-tool access overrides.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search email or branch..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs font-bold outline-none focus:border-brand/40"
                    />
                  </div>
                  <button
                    onClick={handleCreateUser}
                    className="btn-primary text-[10px] uppercase tracking-widest"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Account
                  </button>
                </div>
              </section>

              {/* Employee Role Categories Filter: All, E Pharmacist, D Driver (with Helmet), W Worker, M Management */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Staff Role Category:
                  </span>
                </div>
                <EmployeeRoleFilterBar
                  activeRole={userRoleFilter}
                  onSelectRole={setUserRoleFilter}
                  counts={userRoleCounts}
                  size="sm"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">Account Email</th>
                      <th className="px-4 py-3">Login Role</th>
                      <th className="px-4 py-3">Branch / Scopes</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions & Granular Sub-Tools</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {filteredUsers.map(user => {
                      const isSelf = user.userId === currentUserId;
                      const isSaving = savingKey === user.userId;
                      const isProtectedAdmin = user.role === 'admin' || user.role === 'manager';

                      return (
                        <tr key={user.userId} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <EmployeeRoleAvatar role={user.role} size="sm" showBadge />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate">{user.email}</span>
                                  {isSelf && (
                                    <span className="rounded-md border border-brand/20 bg-brand/5 px-1.5 py-0.5 text-[9px] font-black text-brand">
                                      You
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={user.role}
                              disabled={isSelf || isProtectedAdmin || isSaving}
                              onChange={e => handleRoleChange(user, e.target.value as Role)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-brand/40 disabled:opacity-60"
                            >
                              {ALL_ROLES.map(r => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r] || r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {user.role === 'branch' ? (
                              <span className="font-bold text-slate-700">
                                {user.branchName || user.branchCode || 'Unlinked'}
                              </span>
                            ) : user.role === 'supervisor' ? (
                              <button
                                onClick={() => handleSupervisorZones(user)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                              >
                                <MapPinned className="h-3 w-3" />
                                {supervisorAssignments[user.userId]?.length || 0} Zones Configured
                              </button>
                            ) : user.role === 'driver' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-700 font-bold">Driver</span>
                                <BahrainLicensePlate plateNumber="39717" size="xs" />
                              </div>
                            ) : (
                              <span className="text-slate-400">All Branches (Global)</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${
                                user.isActive
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-400'
                              }`}
                            >
                              {user.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setActiveSubToolUser(user)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-bold text-brand transition hover:bg-brand/10"
                                title="Open Sub-Tool Permissions Modal"
                              >
                                <Shield className="h-3.5 w-3.5" />
                                Sub-Tools
                              </button>

                              {user.role === 'branch' && (
                                <button
                                  onClick={() => handleResetPassword(user)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                                  title="Reset Password"
                                >
                                  <KeyRound className="h-3 w-3" />
                                  Password
                                </button>
                              )}

                              <button
                                onClick={() => handleOptimisticActiveToggle(user)}
                                disabled={isSelf || isProtectedAdmin || isSaving}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                                title={user.isActive ? 'Suspend User' : 'Activate User'}
                              >
                                {user.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(user)}
                                disabled={isSelf || isProtectedAdmin || isSaving}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                                title="Delete Account"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 1.2: ROLE MATRIX & DEFAULTS */}
          {activeTab === 'role-matrix' && (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-black tracking-tight text-slate-900">
                  Global Role Permission Matrix
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Click any access badge to cycle: <span className="font-bold text-slate-700">None → Read → Edit</span>.
                  Admins always have Edit access. Per-user or per-branch overrides win over these role defaults.
                </p>
              </section>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3 text-left">Module / Feature</th>
                      {ALL_ROLES.map(role => (
                        <th key={role} className="px-3 py-3 text-center">
                          {ROLE_LABELS[role] || role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {enabledFeatures.map(feature => (
                      <tr key={feature.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-left">
                          <p className="font-bold text-slate-900">{feature.label}</p>
                          <p className="text-[10px] font-medium text-slate-400">{feature.id}</p>
                        </td>
                        {ALL_ROLES.map(role => {
                          const isRoleAdmin = role === 'admin' || role === 'manager';
                          const defaultPerm =
                            roleDefaults.find(p => p.role === role && p.featureName === feature.id)?.accessLevel ||
                            (isRoleAdmin ? 'edit' : 'none');
                          const key = `${role}:${feature.id}`;
                          const isSavingCell = savingKey === key;

                          return (
                            <td key={role} className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleOptimisticCycleRoleDefault(role, feature.id)}
                                disabled={isRoleAdmin || isSavingCell}
                                className={`w-16 rounded-md border px-2 py-1 text-[10px] font-black uppercase transition-all ${accessBadgeClass(
                                  defaultPerm as any
                                )} ${isRoleAdmin ? 'cursor-not-allowed opacity-60' : 'hover:border-brand/40'}`}
                              >
                                {isSavingCell ? '…' : defaultPerm}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 1.3: SUPERVISOR SCOPES */}
          {activeTab === 'supervisor-scopes' && (
            <div className="space-y-5">
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900">
                    Supervisor Scopes & Branch Zones
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Group operational branches into zones and link each zone to designated supervisors.
                  </p>
                </div>
                <button
                  onClick={() => handleZoneEditor()}
                  className="btn-primary text-[10px] uppercase tracking-widest"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Zone
                </button>
              </section>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {zones.map(zone => {
                  const supervisor = users.find(u => u.userId === zone.supervisorUserId);
                  const assignedBranches = branchOptions.filter(b => zone.branchIds.includes(b.id));

                  return (
                    <article key={zone.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-black text-slate-950">{zone.name}</h4>
                          <p className="text-[11px] font-bold text-slate-400">
                            Code: {zone.code} • {assignedBranches.length} Branches
                          </p>
                          <p className="mt-1 text-xs font-bold text-emerald-700">
                            {supervisor ? `Supervisor: ${supervisor.email}` : 'No supervisor linked'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleZoneEditor(zone)}
                          className="btn-secondary text-[10px] uppercase tracking-widest"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {assignedBranches.map(b => (
                          <span
                            key={b.id}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                          >
                            {b.name} ({b.code})
                          </span>
                        ))}
                        {assignedBranches.length === 0 && (
                          <span className="text-xs text-slate-400">No branches assigned to this zone yet.</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1.4: LOGIN APPROVALS */}
          {activeTab === 'login-approvals' && (
            <BranchLoginApprovalsSection
              settings={maintenanceSettings}
              settingsError={maintenanceSettingsError}
              onSettingsChange={setMaintenanceSettings}
            />
          )}

          {/* ========================================================================= */}
          {/* PILLAR 2: OPERATIONAL INFRASTRUCTURE                                       */}
          {/* ========================================================================= */}

          {/* TAB 2.1: WORKFORCE & GEOFENCED LOCATION DIRECTORY */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                      Geofenced Location Intelligence
                    </span>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                      Bahrain Network
                    </span>
                  </div>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                    Workforce & Geofenced Location Directory
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Directory of registered pharmacy branches, GPS geofenced radii, clinical pharmacists, delivery fleet vehicles, and on-site staff.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search branch name or code..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold outline-none focus:border-brand/40"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setBranchForm({
                        role: 'branch',
                        lat: null,
                        lng: null,
                        dutyRadiusM: DEFAULT_BRANCH_DUTY_RADIUS_M,
                        isSpinEnabled: false,
                        isItemsEntryEnabled: true,
                        isKPIDashboardEnabled: true
                      });
                      setIsBranchModalOpen(true);
                    }}
                    className="btn-primary text-[10px] uppercase tracking-widest"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Branch
                  </button>
                </div>
              </section>

              {/* Executive Overview & Interactive 5-Role Directory Deck */}
              <div className="space-y-4">
                {/* 2 Infrastructure Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Branches</span>
                      <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{branchOptions.length}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">Registered Bahrain Pharmacy Locations</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">GPS Geofenced Coverage</span>
                      <p className="mt-1 text-2xl font-black tabular-nums text-emerald-700">
                        {branchOptions.filter(b => b.lat && b.lng).length} / {branchOptions.length}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                        {branchOptions.length ? Math.round((branchOptions.filter(b => b.lat && b.lng).length / branchOptions.length) * 100) : 0}% Active Radar Coverage
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <RadioTower className="h-5 w-5 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* 5-Role Executive Deck (ALL, E, D, W, M) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-900">
                          Workforce Role Directory Filter
                        </h4>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                          Flat-2 Vector
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        Click any role card to highlight branch rosters and geofenced personnel
                      </p>
                    </div>
                    {branchStaffFilter !== 'all' && (
                      <button
                        onClick={() => setBranchStaffFilter('all')}
                        className="self-start sm:self-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 hover:bg-slate-100 transition"
                      >
                        Reset Filter (Show All)
                      </button>
                    )}
                  </div>

                  <EmployeeRoleFilterBar
                    activeRole={branchStaffFilter}
                    onSelectRole={setBranchStaffFilter}
                    counts={branchStaffCounts}
                    variant="deck"
                  />

                  {/* Filter Status Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      {branchStaffFilter === 'all' && `Showing all ${filteredBranches.length} branch locations across Bahrain.`}
                      {branchStaffFilter === 'pharmacist' && `Showing ${filteredBranches.length} branches with on-duty Clinical Pharmacists (E).`}
                      {branchStaffFilter === 'driver' && `Showing ${filteredBranches.length} branches with active Fleet Vehicles (D) & Safety Helmets.`}
                      {branchStaffFilter === 'worker' && `Showing ${filteredBranches.length} branches with assigned Support Workers (W).`}
                      {branchStaffFilter === 'management' && `Showing ${filteredBranches.length} branches with active Branch Management (M).`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Active: <strong className="text-slate-800 uppercase">{branchStaffFilter}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch Directory Cards Grid */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {filteredBranches.map(branch => {
                  const assignment = branchStaffByBranchId.get(branch.id) || {
                    branchId: branch.id,
                    pharmacistIds: [],
                    driverIds: []
                  };
                  const assignedDrivers = drivers.filter(driver => assignment.driverIds.includes(driver.id));
                  const assignedPharmacists = pharmacists.filter(p => assignment.pharmacistIds.includes(p.id));
                  const assignedWorkers = branchWorkersByBranchId.get(branch.id) || [];
                  const isGeofenced = Boolean(branch.lat && branch.lng);
                  const radius = branch.dutyRadiusM || DEFAULT_BRANCH_DUTY_RADIUS_M;
                  const totalPersonnel = assignedPharmacists.length + assignedDrivers.length + assignedWorkers.length;

                  return (
                    <article
                      key={branch.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-brand/30 hover:shadow-md"
                    >
                      <div className="space-y-4">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black tracking-tight text-slate-950">{branch.name}</h4>
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                                {branch.code}
                              </span>
                              {isGeofenced ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                  <RadioTower className="h-3 w-3 text-emerald-600 animate-pulse" />
                                  Geofenced ({radius}m)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  GPS Pending
                                </span>
                              )}
                            </div>

                            {/* Manager & Geofence Coordinates */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <ManagementAvatar size="xs" className="shrink-0" />
                                <span>
                                  Manager: <strong className="text-slate-900">{branch.branchManagerName || 'Not assigned'}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <MapPinned className="h-3.5 w-3.5 text-slate-400" />
                                <span>
                                  {isGeofenced ? `${branch.lat?.toFixed(4)}, ${branch.lng?.toFixed(4)}` : 'Coordinates not set'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleBranchStaffEditor(branch)}
                              className="btn-secondary text-[10px] uppercase tracking-widest"
                              title="Assign Pharmacists & Delivery Drivers"
                            >
                              <Users className="h-3.5 w-3.5" />
                              Staff ({totalPersonnel})
                            </button>
                            <button
                              onClick={() => {
                                setBranchForm({ ...branch });
                                setIsBranchModalOpen(true);
                              }}
                              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition"
                              title="Edit Branch Geofence & Details"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBranch(branch.id)}
                              className="rounded-lg border border-red-100 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition"
                              title="Remove Branch"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Workforce Roster: Drivers (D) & Pharmacists (E) & Workers (W) */}
                        <div className="space-y-3 pt-1">
                          {/* 1. Fleet Vehicles & Delivery Drivers (D with Helmet) */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <DriverAvatar size="xs" className="shrink-0" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                  FLEET VEHICLES (D):
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">
                                {assignedDrivers.length} {assignedDrivers.length === 1 ? 'vehicle' : 'vehicles'}
                              </span>
                            </div>

                            {assignedDrivers.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {assignedDrivers.map(driver => (
                                  <div
                                    key={driver.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-2xs"
                                  >
                                    <FleetVehiclePlate
                                      plateNumber={driver.notes?.trim() || '39717'}
                                      size="xs"
                                    />
                                    <span className="text-[11px] font-bold text-slate-800">
                                      {driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400">
                                No delivery vehicles assigned to this geofenced location.
                              </p>
                            )}
                          </div>

                          {/* 2. Clinical Pharmacists (E) */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <PharmacistAvatar size="xs" className="shrink-0" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                  PHARMACISTS (E):
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">
                                {assignedPharmacists.length} on duty
                              </span>
                            </div>

                            {assignedPharmacists.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {assignedPharmacists.map(p => (
                                  <div
                                    key={p.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                    <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-black text-emerald-700">E</span>
                                    <span>{p.code ? `${p.code} - ${p.name}` : p.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400">
                                No active pharmacists assigned to this branch.
                              </p>
                            )}
                          </div>

                          {/* 3. Branch Workers & Logistics (W) */}
                          {(assignedWorkers.length > 0 || branchStaffFilter === 'worker') && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <WorkerAvatar size="xs" className="shrink-0" />
                                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                    WORKERS & LOGISTICS (W):
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {assignedWorkers.length} {assignedWorkers.length === 1 ? 'worker' : 'workers'}
                                </span>
                              </div>

                              {assignedWorkers.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {assignedWorkers.map(w => (
                                    <div
                                      key={w.id}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                      <span className="rounded bg-blue-50 px-1 py-0.2 text-[9px] font-black text-blue-700">W</span>
                                      <span>{w.email.split('@')[0]}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs font-semibold text-slate-400">
                                  No warehouse or logistics workers linked to this branch.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Quick Prompt */}
                      {totalPersonnel === 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-400">Workforce roster unassigned</span>
                          <button
                            onClick={() => handleBranchStaffEditor(branch)}
                            className="text-[11px] font-black uppercase tracking-wider text-brand hover:underline"
                          >
                            + Assign Personnel
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}

                {filteredBranches.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
                    <Store className="mx-auto h-10 w-10 text-slate-300" />
                    <h4 className="mt-3 text-base font-black text-slate-900">No matching branch locations found</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Try adjusting your role filter or search term to view registered branches.
                    </p>
                    <button
                      onClick={() => {
                        setBranchStaffFilter('all');
                        setSearchTerm('');
                      }}
                      className="mt-4 btn-secondary text-xs font-bold"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2.2: DELIVERY ZONES */}
          {activeTab === 'delivery-zones' && (
            <DeliveryZonesSection branches={branches} canEdit={isAdminRole(currentRole)} />
          )}

          {/* ========================================================================= */}
          {/* PILLAR 3: SYSTEM EXPERIENCE & LAUNCHER                                     */}
          {/* ========================================================================= */}

          {/* TAB 3.1: MODULE LAYOUT */}
          {activeTab === 'module-layout' && (
            <ModuleDisplaySettingsSection
              settings={maintenanceSettings}
              settingsError={maintenanceSettingsError}
              onSettingsChange={setMaintenanceSettings}
            />
          )}

          {/* TAB 3.2: BRANDING & LOGOS */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-black tracking-tight text-slate-950">
                  Pharmacy Branding & Visual Assets
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Upload official logos and visual identities rendered throughout Tabarak Hub.
                </p>
              </section>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    slot: 'pharmacy' as SystemBrandingAssetSlot,
                    label: 'Pharmacy Header Logo',
                    currentUrl: maintenanceSettings?.pharmacyLogoUrl || clientConfig.logoUrl,
                    desc: 'Shown in the top navigation bar and reports.'
                  },
                  {
                    slot: 'hub' as SystemBrandingAssetSlot,
                    label: 'Hub Identity Logo',
                    currentUrl: maintenanceSettings?.hubLogoUrl || '/tabarak-logo.svg',
                    desc: 'Shown on launcher cards and login page.'
                  },
                  {
                    slot: 'spinner' as SystemBrandingAssetSlot,
                    label: 'Loading Animation Spinner',
                    currentUrl: maintenanceSettings?.loadingSpinnerUrl || '/spinner.svg',
                    desc: 'Displayed during asynchronous page loads.'
                  }
                ].map(asset => (
                  <article key={asset.slot} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-sm font-black text-slate-900">{asset.label}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-400">{asset.desc}</p>

                    <div className="mt-4 flex h-28 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <img src={asset.currentUrl} alt={asset.label} className="max-h-20 max-w-full object-contain" />
                    </div>

                    <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:border-brand/40 hover:bg-brand/5">
                      <UploadCloud className="h-4 w-4 text-brand" />
                      <span>{uploadingSlot === asset.slot ? 'Uploading...' : 'Replace Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingSlot === asset.slot}
                        onChange={e => handleUploadBrandingAsset(asset.slot, e.target.files?.[0])}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PILLAR 4: DOMAIN & MAINTENANCE                                             */}
          {/* ========================================================================= */}

          {/* TAB 4.1: SYSTEM MAINTENANCE */}
          {activeTab === 'system-maintenance' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        maintenanceSettings?.isMaintenanceModeEnabled
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      <Power className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        System Maintenance Mode:{' '}
                        {maintenanceSettings?.isMaintenanceModeEnabled ? 'ACTIVE (Locked)' : 'INACTIVE (Live)'}
                      </h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        When enabled, non-admin users will see an operational maintenance page.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleMaintenanceMode}
                    className={`btn-primary text-xs font-black uppercase tracking-wider ${
                      maintenanceSettings?.isMaintenanceModeEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                    }`}
                  >
                    {maintenanceSettings?.isMaintenanceModeEnabled ? 'Disable Maintenance' : 'Enable Maintenance'}
                  </button>
                </div>
              </section>

              {/* Maintenance Copy Configuration */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">Public Maintenance Notice Copy</h4>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Custom message displayed when maintenance mode is engaged.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Title
                    </label>
                    <input
                      type="text"
                      value={maintenanceSettings?.maintenanceTitle || ''}
                      onChange={e =>
                        setMaintenanceSettings(prev => (prev ? { ...prev, maintenanceTitle: e.target.value } : null))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-brand/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Message
                    </label>
                    <textarea
                      value={maintenanceSettings?.maintenanceMessage || ''}
                      onChange={e =>
                        setMaintenanceSettings(prev => (prev ? { ...prev, maintenanceMessage: e.target.value } : null))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-brand/40"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!maintenanceSettings) return;
                      try {
                        const updated = await supabase.systemSettings.updateMaintenanceSettings({
                          maintenanceTitle: maintenanceSettings.maintenanceTitle,
                          maintenanceMessage: maintenanceSettings.maintenanceMessage
                        });
                        setMaintenanceSettings(updated);
                        onSettingsChange?.(updated);
                        Swal.fire({
                          icon: 'success',
                          title: 'Notice Saved',
                          timer: 1800,
                          showConfirmButton: false,
                          toast: true,
                          position: 'top-end'
                        });
                      } catch (e: any) {
                        Swal.fire('Error', e?.message || 'Could not save notice.', 'error');
                      }
                    }}
                    className="btn-secondary text-[10px] uppercase tracking-widest"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Notice
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4.2: SUPABASE HEALTH */}
          {activeTab === 'supabase-health' && (
            <div className="space-y-6">
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900">
                    Supabase Infrastructure & Database Health
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Real-time connectivity monitoring, probe latency, and table integrity status.
                  </p>
                </div>
                <button
                  onClick={checkHealth}
                  disabled={healthState.isChecking}
                  className="btn-primary text-[10px] uppercase tracking-widest"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${healthState.isChecking ? 'animate-spin' : ''}`} />
                  Run Diagnostics
                </button>
              </section>

              {/* Health Metrics Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      Connection Status
                    </span>
                    <Server className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-emerald-950">
                    {healthState.isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-800">
                      Probe Latency
                    </span>
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-blue-950">
                    {healthState.latencyMs !== null ? `${healthState.latencyMs} ms` : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Auth State
                    </span>
                    <ShieldCheck className="h-4 w-4 text-brand" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {healthState.authStatus.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Tables Status Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Core Tables Status ({healthState.tables.length})
                  </h4>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-2.5 text-left">Database Table</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-right">Row Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {healthState.tables.map(tbl => (
                      <tr key={tbl.table} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{tbl.table}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${
                              tbl.status === 'healthy'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : tbl.status === 'empty'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {tbl.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                          {tbl.count !== undefined ? tbl.count : '—'}
                        </td>
                      </tr>
                    ))}
                    {healthState.tables.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                          Click &quot;Run Diagnostics&quot; to probe core Supabase tables.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Sub-Tool Permissions Modal */}
      <SubToolPermissionModal
        isOpen={Boolean(activeSubToolUser)}
        onClose={() => setActiveSubToolUser(null)}
        user={activeSubToolUser}
        roleDefaults={roleDefaults}
        onSaveSuccess={reload}
      />

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">
                {branchForm.id ? 'Edit Branch' : 'Add New Branch'}
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-left">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Branch Code
                </label>
                <input
                  type="text"
                  value={branchForm.code || ''}
                  onChange={e => setBranchForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="BR01"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold uppercase outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branchForm.name || ''}
                  onChange={e => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Manama Main Branch"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Branch Manager Pharmacist
                </label>
                <select
                  value={branchForm.branchManagerName || ''}
                  onChange={e => setBranchForm(prev => ({ ...prev, branchManagerName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none"
                >
                  <option value="">Select registered pharmacist...</option>
                  {pharmacistOptions.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={branchForm.lat ?? ''}
                    onChange={e => setBranchForm(prev => ({ ...prev, lat: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="26.2235"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={branchForm.lng ?? ''}
                    onChange={e => setBranchForm(prev => ({ ...prev, lng: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="50.5876"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="btn-secondary text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBranch}
                className="btn-primary text-xs uppercase tracking-wider"
              >
                Save Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
