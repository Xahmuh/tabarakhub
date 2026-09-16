import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Bike, Building2, Clock, Copy, Download, Eye, EyeOff, Filter, GitFork, KeyRound, LayoutGrid, Loader2, Plus, RefreshCcw, Search, Shield, Sparkles, Trash2, Upload, UserCog, UserPlus, Users, Zap } from 'lucide-react';
import { permissionService, branchService, deliveryService, pharmacistService } from '../../services';
import { AppUser, Branch, BranchStaffAssignment, BranchZone, DeliveryDriver, FeaturePermission, MaintenanceSettings, Pharmacist, Role, RolePermission, SupervisorScopeMode } from '../../types';
import { ROLE_LABELS } from '../../lib/access';
import { getAllRoleDefinitions, getCustomRoles, saveCustomRoles, CustomRoleDefinition } from '../../lib/roleRegistry';
import { getEnabledAccessFeatures } from '../../lib/moduleRegistry';
import { MODULE_DISPLAY_LABELS, normalizeModuleDisplaySettings } from '../../lib/moduleDisplay';
import { isModuleEnabled } from '../../config/clientConfig';


const FEATURE_LABELS = getEnabledAccessFeatures().map(({ id, label }) => ({ id, label }));

const ACCESS_CYCLE: Array<'none' | 'read' | 'edit'> = ['none', 'read', 'edit'];

const accessBadgeClass = (level: 'none' | 'read' | 'edit') =>
    level === 'edit'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : level === 'read'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-400';

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

const escapeHtml = (value: string | null | undefined) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const getSupervisorScopeMode = (user: AppUser): SupervisorScopeMode =>
    user.supervisorScopeMode === 'all_zones' ? 'all_zones' : 'assigned_zones';

type RoleModuleLayoutItem = {
    key: string;
    title: string;
    visible: boolean;
    access?: 'none' | 'read' | 'edit';
    reason: string;
};

export const AccessControlSection: React.FC<{
    currentUserId?: string;
    settings?: MaintenanceSettings | null;
}> = ({ currentUserId, settings }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [zones, setZones] = useState<BranchZone[]>([]);
    const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [branchStaffAssignments, setBranchStaffAssignments] = useState<BranchStaffAssignment[]>([]);
    const [roleDefaults, setRoleDefaults] = useState<RolePermission[]>([]);
    const [supervisorAssignments, setSupervisorAssignments] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [view, setView] = useState<'users' | 'zones' | 'staff' | 'matrix' | 'simulator' | 'branch_overrides'>('users');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
    const [userBranchFilter, setUserBranchFilter] = useState<string>('all');
    const [previewRoleFilter, setPreviewRoleFilter] = useState<string>('all');
    const [expandedHiddenRoles, setExpandedHiddenRoles] = useState<Record<string, boolean>>({});
    const [matrixSearchTerm, setMatrixSearchTerm] = useState('');
    const [expandedMatrixModules, setExpandedMatrixModules] = useState<Record<string, boolean>>({});
    const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>(getCustomRoles());

    // Branch Overrides State
    const [selectedOverrideBranchId, setSelectedOverrideBranchId] = useState<string>('');
    const [branchOverrides, setBranchOverrides] = useState<FeaturePermission[]>([]);
    const [isLoadingBranchOverrides, setIsLoadingBranchOverrides] = useState<boolean>(false);

    const ASSIGNABLE_ROLES = useMemo(() => {
        return getAllRoleDefinitions().map(r => r.id as Role);
    }, [customRoles]);

    const handleCreateCustomRole = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Add New Custom Role',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role Identifier (Key)</label>
                        <input id="swal-role-id" class="swal2-input !m-0 !w-full text-xs font-bold" placeholder="e.g. auditor, callcenter, hr" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role Display Name</label>
                        <input id="swal-role-label" class="swal2-input !m-0 !w-full text-xs font-bold" placeholder="e.g. Internal Auditor" />
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Create Role',
            confirmButtonColor: '#0f172a',
            preConfirm: () => {
                const idInput = (document.getElementById('swal-role-id') as HTMLInputElement)?.value.trim().toLowerCase().replace(/\s+/g, '_');
                const labelInput = (document.getElementById('swal-role-label') as HTMLInputElement)?.value.trim();

                if (!idInput) {
                    Swal.showValidationMessage('Role Identifier is required');
                    return false;
                }
                if (!labelInput) {
                    Swal.showValidationMessage('Role Display Name is required');
                    return false;
                }
                if (ASSIGNABLE_ROLES.includes(idInput as Role)) {
                    Swal.showValidationMessage('This Role ID already exists!');
                    return false;
                }
                return { id: idInput, label: labelInput };
            }
        });

        if (formValues) {
            const newRole: CustomRoleDefinition = {
                id: formValues.id,
                label: formValues.label,
                isSystem: false,
                badgeClass: 'border-purple-200 bg-purple-50 text-purple-700'
            };
            const updated = [...customRoles, newRole];
            setCustomRoles(updated);
            saveCustomRoles(updated);
            Swal.fire({
                icon: 'success',
                title: 'Role Created!',
                text: `Role "${formValues.label}" is now active in matrix, simulator, and user forms.`,
                timer: 2000,
                showConfirmButton: false
            });
        }
    };

    // 1. Clone Role Permissions Handler
    const handleCloneRolePermissions = async () => {
        const roleOptions = ASSIGNABLE_ROLES.map(r => `<option value="${r}">${ROLE_LABELS[r] || r}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Copy & Clone Role Permissions',
            html: `
                <div class="space-y-4 text-left">
                    <p class="text-xs text-slate-500 font-medium leading-relaxed">
                        Copy all module and sub-tool access levels from a source role to a target role instantly.
                    </p>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Source Role (Copy From)</label>
                        <select id="swal-source-role" class="swal2-select !m-0 !w-full text-xs font-bold">${roleOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Target Role (Apply To)</label>
                        <select id="swal-target-role" class="swal2-select !m-0 !w-full text-xs font-bold">${roleOptions}</select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Clone Permissions',
            confirmButtonColor: '#0f172a',
            preConfirm: () => {
                const source = (document.getElementById('swal-source-role') as HTMLSelectElement)?.value;
                const target = (document.getElementById('swal-target-role') as HTMLSelectElement)?.value;

                if (source === target) {
                    Swal.showValidationMessage('Source and Target roles must be different!');
                    return false;
                }
                return { source, target };
            }
        });

        if (formValues) {
            const { source, target } = formValues;
            const sourcePerms = roleDefaults.filter(p => p.role === source);
            const targetPayload: RolePermission[] = FEATURE_LABELS.map(({ id }) => {
                const match = sourcePerms.find(p => p.featureName === id);
                return {
                    role: target as Role,
                    featureName: id,
                    accessLevel: match ? match.accessLevel : 'none'
                };
            });

            try {
                await permissionService.batchUpsertRoleDefaults(targetPayload);
                await load();
                Swal.fire({
                    icon: 'success',
                    title: 'Permissions Cloned!',
                    text: `All permissions from "${ROLE_LABELS[source as Role]}" were copied to "${ROLE_LABELS[target as Role]}".`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (err: any) {
                Swal.fire('Error', err.message || 'Failed to clone permissions', 'error');
            }
        }
    };

    // 2. Export & Import Matrix Handlers
    const handleExportMatrix = () => {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            customRoles: getCustomRoles(),
            roleDefaults: roleDefaults
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabarak_access_matrix_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportMatrix = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = JSON.parse(event.target?.result as string);
                    if (!parsed || !Array.isArray(parsed.roleDefaults)) {
                        throw new Error('Invalid JSON format: missing roleDefaults array');
                    }
                    if (Array.isArray(parsed.customRoles)) {
                        saveCustomRoles(parsed.customRoles);
                        setCustomRoles(parsed.customRoles);
                    }
                    await permissionService.batchUpsertRoleDefaults(parsed.roleDefaults);
                    await load();
                    Swal.fire({
                        icon: 'success',
                        title: 'Access Matrix Imported!',
                        text: `Successfully updated role permissions and custom roles from file.`,
                        timer: 2500,
                        showConfirmButton: false
                    });
                } catch (err: any) {
                    Swal.fire('Import Error', err.message || 'Could not parse JSON file.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // 3. Bulk Permission Action Handler
    const handleBulkPermissionAction = async () => {
        const roleOptions = [
            '<option value="all">⚡ ALL ROLES</option>',
            ...ASSIGNABLE_ROLES.map(r => `<option value="${r}">${ROLE_LABELS[r] || r}</option>`)
        ].join('');

        const { value: formValues } = await Swal.fire({
            title: 'Bulk Permission Action ⚡',
            html: `
                <div class="space-y-4 text-left">
                    <p class="text-xs text-slate-500 font-medium leading-relaxed">
                        Apply a single permission level across all modules for a selected role or all roles.
                    </p>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Target Role(s)</label>
                        <select id="swal-bulk-role" class="swal2-select !m-0 !w-full text-xs font-bold">${roleOptions}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Action to Apply</label>
                        <select id="swal-bulk-level" class="swal2-select !m-0 !w-full text-xs font-bold">
                            <option value="read">📖 Set All Read-Only (Read Access)</option>
                            <option value="edit">✏️ Set All Edit Access (Full Edit)</option>
                            <option value="none">🚫 Clear All Access (Set None)</option>
                        </select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Apply Bulk Action',
            confirmButtonColor: '#0f172a',
            preConfirm: () => {
                const targetRole = (document.getElementById('swal-bulk-role') as HTMLSelectElement)?.value;
                const accessLevel = (document.getElementById('swal-bulk-level') as HTMLSelectElement)?.value as 'read' | 'edit' | 'none';
                return { targetRole, accessLevel };
            }
        });

        if (formValues) {
            const { targetRole, accessLevel } = formValues;
            const targetRoles = targetRole === 'all' ? ASSIGNABLE_ROLES : [targetRole as Role];
            const payload: RolePermission[] = [];

            for (const r of targetRoles) {
                for (const feat of FEATURE_LABELS) {
                    payload.push({
                        role: r,
                        featureName: feat.id,
                        accessLevel: accessLevel
                    });
                }
            }

            try {
                await permissionService.batchUpsertRoleDefaults(payload);
                await load();
                Swal.fire({
                    icon: 'success',
                    title: 'Bulk Action Applied!',
                    text: `All permissions updated to "${accessLevel.toUpperCase()}" for target role(s).`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (err: any) {
                Swal.fire('Error', err.message || 'Failed to apply bulk permissions', 'error');
            }
        }
    };

    // 4. Branch Overrides Handlers
    const loadBranchOverrides = async (branchId: string) => {
        if (!branchId) {
            setBranchOverrides([]);
            return;
        }
        setIsLoadingBranchOverrides(true);
        try {
            const perms = await permissionService.listForBranch(branchId);
            setBranchOverrides(perms);
        } catch {
            setBranchOverrides([]);
        } finally {
            setIsLoadingBranchOverrides(false);
        }
    };

    const handleBranchOverrideToggle = async (branchId: string, featureName: string, currentLevel: 'inherit' | 'none' | 'read' | 'edit') => {
        const nextCycle: Record<string, 'inherit' | 'none' | 'read' | 'edit'> = {
            inherit: 'read',
            read: 'edit',
            edit: 'none',
            none: 'inherit'
        };
        const nextLevel = nextCycle[currentLevel];
        setSavingKey(`branch-override:${branchId}:${featureName}`);

        try {
            if (nextLevel === 'inherit') {
                await permissionService.deleteForBranch(branchId, featureName);
            } else {
                await permissionService.upsert({
                    branchId,
                    featureName,
                    accessLevel: nextLevel
                });
            }
            await loadBranchOverrides(branchId);
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Failed to update branch override', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const query = userSearchTerm.toLowerCase().trim();
            const matchesSearch = !query ||
                user.email.toLowerCase().includes(query) ||
                (user.branchName && user.branchName.toLowerCase().includes(query)) ||
                (user.branchCode && user.branchCode.toLowerCase().includes(query));
            const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
            const matchesBranch = userBranchFilter === 'all' || user.branchId === userBranchFilter;
            return matchesSearch && matchesRole && matchesBranch;
        });
    }, [users, userSearchTerm, userRoleFilter, userBranchFilter]);

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
        () => pharmacists.filter(pharmacist => pharmacist.isActive).sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name)),
        [pharmacists]
    );
    const branchStaffByBranchId = useMemo(() => {
        const map = new Map<string, BranchStaffAssignment>();
        branchStaffAssignments.forEach(assignment => map.set(assignment.branchId, assignment));
        return map;
    }, [branchStaffAssignments]);

    const load = async () => {
        setIsLoading(true);
        try {
            const [userList, branchList, defaults, driverList, zoneList, pharmacistList, staffAssignments] = await Promise.all([
                permissionService.adminListUsers(),
                branchService.list(),
                permissionService.listAllRoleDefaults(),
                deliveryService.drivers.list(true),
                permissionService.listBranchZones(),
                pharmacistService.listAll(),
                permissionService.listBranchStaffAssignments()
            ]);
            setUsers(userList);
            setBranches(branchList);
            setRoleDefaults(defaults);
            setDrivers(driverList);
            setZones(zoneList);
            setPharmacists(pharmacistList);
            setBranchStaffAssignments(staffAssignments);

            const supervisors = userList.filter(u => u.role === 'supervisor');
            const assignments: Record<string, string[]> = {};
            supervisors.forEach(s => {
                assignments[s.userId] = zoneList
                    .filter(zone => zone.supervisorUserId === s.userId)
                    .map(zone => zone.id);
            });
            setSupervisorAssignments(assignments);
        } catch (e: any) {
            Swal.fire('Access Control', e?.message || 'Failed to load users. Only admins can open this panel.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreateUser = async () => {
        const branchOptionsHtml = branchOptions.map(b =>
            `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.code)})</option>`
        ).join('');
        const driverOptionsHtml = driverOptions.map(driver =>
            `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name)}${driver.authUserId ? ' (linked)' : ''}</option>`
        ).join('');
        const supervisorOptionsHtml = zoneOptions.map(zone => `
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                <input type="checkbox" value="${escapeHtml(zone.id)}" class="swal-new-supervisor-zone h-4 w-4 accent-[#B91c1c]">
                ${escapeHtml(zone.code)} - ${escapeHtml(zone.name)} <span class="text-slate-400 font-medium">(${zone.branchIds.length} branches)</span>
            </label>`
        ).join('');

        const { value } = await Swal.fire({
            title: '<span class="text-xl font-black tracking-tight">Add login user</span>',
            html: `
                <div class="space-y-4 text-left">
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                        <input id="swal-new-email" type="email" placeholder="user@example.com" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Temporary password</label>
                        <input id="swal-new-password" type="password" placeholder="Minimum 8 characters" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                        <p class="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">Share this password outside the app, then ask the user to change it.</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Role</label>
                        <select id="swal-new-role" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                            ${ASSIGNABLE_ROLES.map(role => `<option value="${role}">${escapeHtml(ROLE_LABELS[role] || role)}</option>`).join('')}
                        </select>
                    </div>
                    <div id="swal-new-branch-wrap" class="hidden">
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Linked branch</label>
                        <select id="swal-new-branch" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                            <option value="">Select branch...</option>
                            ${branchOptionsHtml}
                        </select>
                    </div>
                    <div id="swal-new-driver-wrap" class="hidden">
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Linked delivery driver</label>
                        <select id="swal-new-driver" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                            <option value="">Select driver...</option>
                            ${driverOptionsHtml}
                        </select>
                        <p class="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">The mobile app uses this link to show the driver's assigned delivery orders.</p>
                    </div>
                    <div id="swal-new-supervisor-wrap" class="hidden">
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor zones</label>
                        <div class="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                            ${supervisorOptionsHtml || '<p class="p-3 text-xs font-bold text-slate-400">No zones found. Create zones first, then assign them here.</p>'}
                        </div>
                    </div>
                    <label class="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-600">
                        <input id="swal-new-active" type="checkbox" checked class="h-4 w-4 accent-[#B91c1c]">
                        Active immediately
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Create user',
            confirmButtonColor: '#B91c1c',
            width: 560,
            didOpen: () => {
                const roleInput = document.getElementById('swal-new-role') as HTMLSelectElement | null;
                const branchWrap = document.getElementById('swal-new-branch-wrap');
                const driverWrap = document.getElementById('swal-new-driver-wrap');
                const supervisorWrap = document.getElementById('swal-new-supervisor-wrap');
                const activeInput = document.getElementById('swal-new-active') as HTMLInputElement | null;
                const syncRoleFields = () => {
                    const role = roleInput?.value;
                    branchWrap?.classList.toggle('hidden', role !== 'branch');
                    driverWrap?.classList.toggle('hidden', role !== 'driver');
                    supervisorWrap?.classList.toggle('hidden', role !== 'supervisor');
                    if (activeInput) {
                        activeInput.checked = role === 'admin' ? true : activeInput.checked;
                        activeInput.disabled = role === 'admin';
                    }
                };
                roleInput?.addEventListener('change', syncRoleFields);
                syncRoleFields();
            },
            preConfirm: () => {
                const email = (document.getElementById('swal-new-email') as HTMLInputElement).value.trim().toLowerCase();
                const password = (document.getElementById('swal-new-password') as HTMLInputElement).value;
                const role = (document.getElementById('swal-new-role') as HTMLSelectElement).value as Role;
                const branchId = (document.getElementById('swal-new-branch') as HTMLSelectElement).value || null;
                const driverId = (document.getElementById('swal-new-driver') as HTMLSelectElement).value || null;
                const isActive = role === 'admin' ? true : (document.getElementById('swal-new-active') as HTMLInputElement).checked;
                const supervisorZoneIds = Array.from(document.querySelectorAll<HTMLInputElement>('.swal-new-supervisor-zone:checked')).map(i => i.value);

                if (!email || !email.includes('@')) {
                    Swal.showValidationMessage('Enter a valid email.');
                    return false;
                }
                if (password.length < 8) {
                    Swal.showValidationMessage('Temporary password must be at least 8 characters.');
                    return false;
                }
                if (role === 'branch' && !branchId) {
                    Swal.showValidationMessage('Branch users must be linked to a branch.');
                    return false;
                }
                if (role === 'driver' && !driverId) {
                    Swal.showValidationMessage('Driver users must be linked to a delivery driver.');
                    return false;
                }

                return { email, password, role, branchId, driverId, supervisorZoneIds, isActive };
            }
        });

        if (!value) return;

        setSavingKey('create-user');
        try {
            await permissionService.adminCreateUser(value);
            await load();
            Swal.fire('User created', 'The login user was created and linked to the selected role.', 'success');
        } catch (e: any) {
            Swal.fire('Create user failed', e?.message || 'Could not create the user.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleRoleChange = async (user: AppUser, newRole: Role) => {
        let branchId: string | null = newRole === 'branch' ? user.branchId || null : null;
        let driverId: string | null = null;

        if (newRole === 'branch' && !branchId) {
            const { value } = await Swal.fire({
                title: 'Link a branch',
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
                title: 'Link a delivery driver',
                html: `
                  <select id="swal-driver" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
                    <option value="">Select driver...</option>
                    ${driverOptions.map(driver => `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name)}${driver.authUserId ? ' (linked)' : ''}</option>`).join('')}
                  </select>`,
                showCancelButton: true,
                confirmButtonColor: '#B91c1c',
                preConfirm: () => (document.getElementById('swal-driver') as HTMLSelectElement).value
            });
            if (!value) return;
            driverId = value;
        }

        setSavingKey(user.userId);
        try {
            await permissionService.adminSetUserRole(user.userId, newRole, branchId, user.isActive);
            if (newRole === 'driver' && driverId) {
                await permissionService.adminLinkDriverUser(user.userId, driverId);
            }
            const selectedBranch = branchOptions.find(branch => branch.id === branchId);
            setUsers(prev => prev.map(u => u.userId === user.userId ? {
                ...u,
                role: newRole,
                branchId,
                branchCode: selectedBranch?.code,
                branchName: selectedBranch?.name
            } : u));
        } catch (e: any) {
            Swal.fire('Role update failed', e?.message || 'Could not update role.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleActiveToggle = async (user: AppUser) => {
        setSavingKey(user.userId);
        try {
            await permissionService.adminSetUserRole(user.userId, user.role, user.role === 'branch' ? user.branchId || null : null, !user.isActive);
            setUsers(prev => prev.map(u => u.userId === user.userId ? { ...u, isActive: !u.isActive } : u));
        } catch (e: any) {
            Swal.fire('Update failed', e?.message || 'Could not update user state.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleDeleteUser = async (user: AppUser) => {
        const result = await Swal.fire({
            title: 'Delete login user?',
            html: `
              <div class="text-left text-sm font-semibold leading-6 text-slate-600">
                <p>This permanently deletes <strong>${escapeHtml(user.email)}</strong> from Auth and removes the app profile.</p>
                <p class="mt-2 text-amber-700">Use Suspend when you only want to block access temporarily.</p>
              </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete user',
            confirmButtonColor: '#B91c1c'
        });

        if (!result.isConfirmed) return;

        setSavingKey(user.userId);
        try {
            await permissionService.adminDeleteUser(user.userId);
            setUsers(prev => prev.filter(u => u.userId !== user.userId));
            setSupervisorAssignments(prev => {
                const next = { ...prev };
                delete next[user.userId];
                return next;
            });
            Swal.fire('User deleted', 'The login user has been removed.', 'success');
        } catch (e: any) {
            Swal.fire('Delete failed', e?.message || 'Could not delete the user.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleResetPassword = async (user: AppUser) => {
        if (user.role !== 'branch') {
            Swal.fire('Branch users only', 'Password assignment from this panel is limited to linked branch accounts.', 'info');
            return;
        }

        const { value } = await Swal.fire({
            title: '<span class="text-xl font-black tracking-tight">Assign new branch password</span>',
            html: `
              <div class="space-y-4 text-left">
                <div class="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                  This updates the Supabase Auth password for <strong>${escapeHtml(user.email)}</strong>. Share it outside the app.
                </div>
                <div>
                  <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">New password</label>
                  <input id="swal-reset-password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                </div>
                <div>
                  <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm password</label>
                  <input id="swal-reset-password-confirm" type="password" autocomplete="new-password" placeholder="Re-enter password" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                </div>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Update password',
            confirmButtonColor: '#B91c1c',
            width: 520,
            preConfirm: () => {
                const password = (document.getElementById('swal-reset-password') as HTMLInputElement).value;
                const confirmation = (document.getElementById('swal-reset-password-confirm') as HTMLInputElement).value;

                if (password.length < 8) {
                    Swal.showValidationMessage('New password must be at least 8 characters.');
                    return false;
                }
                if (password !== confirmation) {
                    Swal.showValidationMessage('Password confirmation does not match.');
                    return false;
                }

                return { password };
            }
        });

        if (!value) return;

        setSavingKey(user.userId);
        try {
            await permissionService.adminResetUserPassword(user.userId, value.password);
            Swal.fire('Password updated', 'The branch login password was updated in Supabase Auth.', 'success');
        } catch (e: any) {
            Swal.fire('Password update failed', e?.message || 'Could not update this branch password.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleSupervisorZones = async (user: AppUser) => {
        const current = supervisorAssignments[user.userId] || [];
        const currentScopeMode = getSupervisorScopeMode(user);
        const { value } = await Swal.fire({
            title: `<span class="text-xl font-black tracking-tight">Zones for ${user.email}</span>`,
            html: `
              <div class="space-y-4 text-left">
                <div>
                  <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Scope mode</label>
                  <select id="swal-supervisor-scope-mode" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    <option value="assigned_zones" ${currentScopeMode === 'assigned_zones' ? 'selected' : ''}>Assigned zones only</option>
                    <option value="all_zones" ${currentScopeMode === 'all_zones' ? 'selected' : ''}>All zones</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned zones</label>
                  <div class="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                    ${zoneOptions.map(zone => `
                      <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                        <input type="checkbox" value="${zone.id}" ${current.includes(zone.id) ? 'checked' : ''} class="swal-supervisor-zone h-4 w-4 accent-[#B91c1c]">
                        ${escapeHtml(zone.code)} - ${escapeHtml(zone.name)} <span class="text-slate-400 font-medium">(${zone.branchIds.length} branches)</span>
                      </label>`).join('')}
                  </div>
                </div>
              </div>`,
            showCancelButton: true,
            confirmButtonText: 'Save assignment',
            confirmButtonColor: '#B91c1c',
            preConfirm: () => ({
                scopeMode: (document.getElementById('swal-supervisor-scope-mode') as HTMLSelectElement).value as SupervisorScopeMode,
                zoneIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-supervisor-zone:checked')).map(i => i.value)
            })
        });
        if (!value) return;

        setSavingKey(user.userId);
        try {
            await permissionService.adminSetSupervisorScopeMode(user.userId, value.scopeMode);
            await permissionService.setSupervisorZones(user.userId, value.zoneIds);
            await load();
        } catch (e: any) {
            Swal.fire('Assignment failed', e?.message || 'Could not save supervisor zones.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleZoneEditor = async (zone?: BranchZone) => {
        const activeSupervisorUsers = users.filter(user => user.role === 'supervisor' && user.isActive);
        const supervisorOptionsHtml = activeSupervisorUsers.map(user => `
            <option value="${escapeHtml(user.userId)}" ${zone?.supervisorUserId === user.userId ? 'selected' : ''}>
                ${escapeHtml(user.email)}
            </option>
        `).join('');
        const branchOptionsHtml = branchOptions.map(branch => {
            const ownerZone = zones.find(item => item.id !== zone?.id && item.branchIds.includes(branch.id));
            return `
                <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" value="${escapeHtml(branch.id)}" ${zone?.branchIds.includes(branch.id) ? 'checked' : ''} class="swal-zone-branch h-4 w-4 accent-[#B91c1c]">
                    <span class="min-w-0">
                        <span class="block">${escapeHtml(branch.name)} <span class="text-slate-400 font-medium">(${escapeHtml(branch.code)})</span></span>
                        ${ownerZone ? `<span class="block text-[10px] font-bold uppercase tracking-widest text-amber-600">Currently in ${escapeHtml(ownerZone.name)}</span>` : ''}
                    </span>
                </label>`;
        }).join('');

        const { value } = await Swal.fire({
            title: `<span class="text-xl font-black tracking-tight">${zone ? 'Edit' : 'Create'} zone</span>`,
            html: `
                <div class="space-y-4 text-left">
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Zone code</label>
                        <input id="swal-zone-code" value="${escapeHtml(zone?.code)}" placeholder="ZONE_1" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold uppercase outline-none">
                        <p class="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">Letters, numbers, underscore, or dash. Keep it stable for reporting.</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Zone name</label>
                        <input id="swal-zone-name" value="${escapeHtml(zone?.name)}" placeholder="Zone 1" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor</label>
                        <select id="swal-zone-supervisor" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">
                            <option value="">No supervisor assigned</option>
                            ${supervisorOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Branches in this zone</label>
                        <div class="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                            ${branchOptionsHtml || '<p class="p-3 text-xs font-bold text-slate-400">No operational branches found.</p>'}
                        </div>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</label>
                        <textarea id="swal-zone-notes" class="min-h-[72px] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none">${escapeHtml(zone?.notes)}</textarea>
                    </div>
                    <label class="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-600">
                        <input id="swal-zone-active" type="checkbox" ${zone?.isActive === false ? '' : 'checked'} class="h-4 w-4 accent-[#B91c1c]">
                        Active zone
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Save zone',
            confirmButtonColor: '#B91c1c',
            width: 680,
            preConfirm: () => {
                const code = (document.getElementById('swal-zone-code') as HTMLInputElement).value.trim().toUpperCase();
                const name = (document.getElementById('swal-zone-name') as HTMLInputElement).value.trim();
                const supervisorUserId = (document.getElementById('swal-zone-supervisor') as HTMLSelectElement).value || null;
                const notes = (document.getElementById('swal-zone-notes') as HTMLTextAreaElement).value.trim();
                const isActive = (document.getElementById('swal-zone-active') as HTMLInputElement).checked;
                const branchIds = Array.from(document.querySelectorAll<HTMLInputElement>('.swal-zone-branch:checked')).map(input => input.value);
                if (!code) {
                    Swal.showValidationMessage('Zone code is required.');
                    return false;
                }
                if (!/^[A-Z0-9_-]{1,32}$/.test(code)) {
                    Swal.showValidationMessage('Zone code can only contain letters, numbers, underscore, or dash.');
                    return false;
                }
                if (!name) {
                    Swal.showValidationMessage('Zone name is required.');
                    return false;
                }
                return { code, name, supervisorUserId, notes, isActive, branchIds };
            }
        });

        if (!value) return;

        setSavingKey(zone?.id || 'create-zone');
        try {
            const saved = await permissionService.upsertBranchZone({
                id: zone?.id,
                code: value.code,
                name: value.name,
                supervisorUserId: value.supervisorUserId,
                notes: value.notes || undefined,
                isActive: value.isActive,
                branchIds: value.branchIds
            });
            await permissionService.replaceBranchZoneBranches(saved.id, value.branchIds);
            await load();
            Swal.fire('Zone saved', 'The zone, branches, and supervisor access were updated.', 'success');
        } catch (e: any) {
            Swal.fire('Zone save failed', e?.message || 'Could not save this zone.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleBranchStaffEditor = async (branch: Branch) => {
        const current = branchStaffByBranchId.get(branch.id) || { branchId: branch.id, pharmacistIds: [], driverIds: [] };
        const pharmacistOptionsHtml = pharmacistOptions.map(pharmacist => `
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                <input type="checkbox" value="${escapeHtml(pharmacist.id)}" ${current.pharmacistIds.includes(pharmacist.id) ? 'checked' : ''} class="swal-staff-pharmacist h-4 w-4 accent-[#B91c1c]">
                <span class="min-w-0">
                    <span class="block">${escapeHtml(pharmacist.code ? `${pharmacist.code} - ${pharmacist.name}` : pharmacist.name)}</span>
                    <span class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Pharmacist</span>
                </span>
            </label>
        `).join('');
        const driverOptionsHtml = driverOptions.map(driver => `
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                <input type="checkbox" value="${escapeHtml(driver.id)}" ${current.driverIds.includes(driver.id) ? 'checked' : ''} class="swal-staff-driver h-4 w-4 accent-[#B91c1c]">
                <span class="min-w-0">
                    <span class="block">${escapeHtml(driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name)}</span>
                    <span class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver</span>
                </span>
            </label>
        `).join('');

        const { value } = await Swal.fire({
            title: `<span class="text-xl font-black tracking-tight">Branch staff - ${escapeHtml(branch.code || branch.name)}</span>`,
            html: `
                <div class="space-y-4 text-left">
                    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p class="text-sm font-black text-slate-900">${escapeHtml(branch.name)}</p>
                        <p class="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">${escapeHtml(branch.code || 'No branch code')}</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned pharmacists</label>
                        <div class="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                            ${pharmacistOptionsHtml || '<p class="p-3 text-xs font-bold text-slate-400">No active pharmacists found. Create pharmacist profiles first.</p>'}
                        </div>
                    </div>
                    <div>
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned drivers</label>
                        <div class="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                            ${driverOptionsHtml || '<p class="p-3 text-xs font-bold text-slate-400">No active drivers found. Create driver profiles first.</p>'}
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Save staff',
            confirmButtonColor: '#B91c1c',
            width: 760,
            preConfirm: () => ({
                pharmacistIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-staff-pharmacist:checked')).map(input => input.value),
                driverIds: Array.from(document.querySelectorAll<HTMLInputElement>('.swal-staff-driver:checked')).map(input => input.value)
            })
        });

        if (!value) return;

        setSavingKey(`staff:${branch.id}`);
        try {
            await permissionService.replaceBranchStaffAssignments(branch.id, value.pharmacistIds, value.driverIds);
            await load();
            Swal.fire('Branch staff saved', 'Pharmacist and driver assignments were updated for this branch.', 'success');
        } catch (e: any) {
            Swal.fire('Staff assignment failed', e?.message || 'Could not update branch staff assignments.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleUserPermissions = async (user: AppUser) => {
        setSavingKey(`permissions:${user.userId}`);
        try {
            const current = await permissionService.listRawForUser(user.userId);
            const byFeature = new Map(current.map(permission => [permission.featureName, permission.accessLevel]));
            const enabledFeatures = getEnabledAccessFeatures();

            const allPermissionIds: string[] = [];
            enabledFeatures.forEach(feature => {
                allPermissionIds.push(feature.id);
                if (feature.subFeatures) {
                    feature.subFeatures.forEach(sub => allPermissionIds.push(sub.id));
                }
            });

            const { value } = await Swal.fire({
                title: `<span class="text-xl font-black tracking-tight">Module & Sub-Tool Access for ${escapeHtml(user.email)}</span>`,
                html: `
                  <div class="space-y-3 text-left">
                    <div class="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2.5 shadow-sm">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          Quick Access Presets
                        </span>
                        <button type="button" id="btn-preset-save-custom" class="inline-flex items-center gap-1 text-[10px] font-black uppercase text-brand hover:text-brand/80 transition-colors">
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                          Save Current as My Preset
                        </button>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        <button type="button" id="btn-preset-all-edit" class="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-[11px] font-black text-purple-700 hover:bg-purple-100 transition-all border border-purple-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          Full Admin (Edit All)
                        </button>
                        <button type="button" id="btn-preset-all-read" class="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100 transition-all border border-blue-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          Executive Viewer (Read All)
                        </button>
                        <button type="button" id="btn-preset-branch-std" class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                          Branch Ops
                        </button>
                        <button type="button" id="btn-preset-finance" class="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-100 transition-all border border-amber-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                          Financial Auditor
                        </button>
                        <button type="button" id="btn-preset-apply-custom" class="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100 transition-all border border-rose-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                          My Saved Preset
                        </button>
                        <button type="button" id="btn-preset-reset" class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-200 transition-all border border-slate-200/80 shadow-2xs">
                          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          Reset (Role Default)
                        </button>
                      </div>
                    </div>
                    <p class="text-xs font-semibold leading-5 text-slate-500">
                      Configure main module access or fine-tune individual sub-tools and tabs. Sub-tools set to "Inherit" follow the main module setting.
                    </p>
                    <div class="max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-2.5">
                      ${enabledFeatures.map(feature => {
                        const parentSelected = byFeature.get(feature.id) || '';
                        const hasSubs = feature.subFeatures && feature.subFeatures.length > 0;
                        return `
                          <div class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                            <div class="flex items-center justify-between gap-3">
                              <span class="text-sm font-black text-slate-900">${escapeHtml(feature.label)}</span>
                              <select id="swal-user-perm-${escapeHtml(feature.id)}" class="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-black uppercase text-slate-700 focus:border-brand">
                                <option value="" ${parentSelected === '' ? 'selected' : ''}>Role default</option>
                                <option value="none" ${parentSelected === 'none' ? 'selected' : ''}>None</option>
                                <option value="read" ${parentSelected === 'read' ? 'selected' : ''}>Read</option>
                                <option value="edit" ${parentSelected === 'edit' ? 'selected' : ''}>Edit</option>
                              </select>
                            </div>
                            ${hasSubs ? `
                              <div class="ml-2 pl-3 border-l-2 border-slate-200 space-y-2 pt-1.5">
                                <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">Sub-Tools & Tabs</div>
                                ${feature.subFeatures!.map(sub => {
                                  const subSelected = byFeature.get(sub.id) || '';
                                  return `
                                    <div class="flex items-center justify-between gap-3 text-xs">
                                      <span class="font-bold text-slate-600">↳ ${escapeHtml(sub.label)}</span>
                                      <select id="swal-user-perm-${escapeHtml(sub.id)}" class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                                        <option value="" ${subSelected === '' ? 'selected' : ''}>Inherit Module</option>
                                        <option value="none" ${subSelected === 'none' ? 'selected' : ''}>None</option>
                                        <option value="read" ${subSelected === 'read' ? 'selected' : ''}>Read</option>
                                        <option value="edit" ${subSelected === 'edit' ? 'selected' : ''}>Edit</option>
                                      </select>
                                    </div>
                                  `;
                                }).join('')}
                              </div>
                            ` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Save permissions',
                confirmButtonColor: '#B91c1c',
                width: 700,
                didOpen: () => {
                    document.getElementById('btn-preset-all-edit')?.addEventListener('click', () => {
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) select.value = 'edit';
                        });
                    });
                    document.getElementById('btn-preset-all-read')?.addEventListener('click', () => {
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) select.value = 'read';
                        });
                    });
                    document.getElementById('btn-preset-branch-std')?.addEventListener('click', () => {
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) {
                                if (id.startsWith('lost_sales') || id.startsWith('shortages') || id.startsWith('delivery') || id.startsWith('workflow_todo')) {
                                    select.value = 'edit';
                                } else if (id.startsWith('spin_win') || id.startsWith('hr_requests') || id.startsWith('quality_feedback')) {
                                    select.value = 'read';
                                } else {
                                    select.value = 'none';
                                }
                            }
                        });
                    });
                    document.getElementById('btn-preset-finance')?.addEventListener('click', () => {
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) {
                                if (id.startsWith('cash_flow') || id.startsWith('cash_tracker') || id.startsWith('benefit_pay_ledger') || id.startsWith('operational_expenses')) {
                                    select.value = 'edit';
                                } else {
                                    select.value = 'read';
                                }
                            }
                        });
                    });
                    document.getElementById('btn-preset-save-custom')?.addEventListener('click', () => {
                        const customConfig: Record<string, string> = {};
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) customConfig[id] = select.value;
                        });
                        localStorage.setItem('tabarak_user_perm_custom_preset', JSON.stringify(customConfig));
                        Swal.showValidationMessage('✅ Saved current settings as "My Saved Preset"!');
                        setTimeout(() => Swal.resetValidationMessage(), 2500);
                    });
                    document.getElementById('btn-preset-apply-custom')?.addEventListener('click', () => {
                        const saved = localStorage.getItem('tabarak_user_perm_custom_preset');
                        if (!saved) {
                            Swal.showValidationMessage('⚠️ No custom preset saved yet! Configure dropdowns and click "Save Current as My Preset".');
                            setTimeout(() => Swal.resetValidationMessage(), 3000);
                            return;
                        }
                        try {
                            const customConfig = JSON.parse(saved) as Record<string, string>;
                            allPermissionIds.forEach(id => {
                                const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                                if (select && customConfig[id] !== undefined) {
                                    select.value = customConfig[id];
                                }
                            });
                        } catch {
                            // ignore corrupt data
                        }
                    });
                    document.getElementById('btn-preset-reset')?.addEventListener('click', () => {
                        allPermissionIds.forEach(id => {
                            const select = document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement;
                            if (select) select.value = '';
                        });
                    });
                },
                preConfirm: () => allPermissionIds
                    .map(id => ({
                        featureName: id,
                        accessLevel: (document.getElementById(`swal-user-perm-${id}`) as HTMLSelectElement)?.value as 'none' | 'read' | 'edit' | ''
                    }))
                    .filter((permission): permission is { featureName: string; accessLevel: 'none' | 'read' | 'edit' } => !!permission.accessLevel)
            });

            if (!value) return;
            await permissionService.replaceUserPermissions(user.userId, value);
            Swal.fire('Permissions saved', 'User-level module & sub-tool overrides were updated.', 'success');
        } catch (e: any) {
            Swal.fire('Permissions failed', e?.message || 'Could not update user permissions.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const getDefault = (role: Role, feature: string): 'none' | 'read' | 'edit' => {
        if (role === 'admin' || role === 'manager') return 'edit';
        if (role === 'owner' && (feature === 'owner_dashboard' || feature === 'owner-dashboard')) return 'read';
        if (role === 'branch' && (feature === 'payroll' || feature === 'driver_payroll' || feature === 'driver-payroll')) return 'none';
        if (role === 'branch' && (feature === 'operational_expenses' || feature === 'operational-expenses')) {
            const configured = roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel;
            return (configured as any) || 'edit';
        }
        return (roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel as any) || 'none';
    };

    const moduleDisplayItems = useMemo(
        () => normalizeModuleDisplaySettings(settings?.moduleDisplaySettings).items,
        [settings?.moduleDisplaySettings]
    );

    const roleModuleLayouts = useMemo(() => {
        const hasAccess = (role: Role, feature: string, minimum: 'read' | 'edit' = 'read') => {
            const level = (role === 'admin' || role === 'manager')
                ? 'edit'
                : (role === 'owner' && (feature === 'owner_dashboard' || feature === 'owner-dashboard'))
                    ? 'read'
                    : (role === 'branch' && (feature === 'payroll' || feature === 'driver_payroll' || feature === 'driver-payroll'))
                        ? 'none'
                    : (role === 'branch' && (feature === 'operational_expenses' || feature === 'operational-expenses'))
                        ? ((roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel as any) || 'edit')
                    : (roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel as 'none' | 'read' | 'edit' | undefined) || 'none';

            if (minimum === 'edit') return level === 'edit';
            return level !== 'none';
        };

        const buildLayoutForRole = (role: Role): RoleModuleLayoutItem[] => {
            const isManager = role === 'admin' || role === 'manager';
            const isOwner = role === 'owner';
            const isWarehouse = role === 'warehouse';
            const isSupervisor = role === 'supervisor';
            const canUseSales = isModuleEnabled('sales');
            const canUseHr = isModuleEnabled('hr');
            const canUseWorkforce = canUseHr && isModuleEnabled('workforce');
            const canOpenDashboard = isModuleEnabled('reports') && (
                isWarehouse
                    ? isModuleEnabled('adminDashboard')
                    : (isManager || isSupervisor)
                        ? isModuleEnabled('managerDashboard')
                        : isModuleEnabled('branchDashboard')
            );

            const items: RoleModuleLayoutItem[] = [
                {
                    key: 'pos',
                    title: MODULE_DISPLAY_LABELS.pos,
                    visible: canUseSales && !isWarehouse && !isOwner && (hasAccess(role, 'lost_sales', 'edit') || hasAccess(role, 'shortages', 'edit')),
                    access: hasAccess(role, 'lost_sales', 'edit') || hasAccess(role, 'shortages', 'edit') ? 'edit' : 'none',
                    reason: 'Needs edit access to Lost Sales or Shortages.'
                },
                {
                    key: 'owner-dashboard',
                    title: MODULE_DISPLAY_LABELS['owner-dashboard'],
                    visible: hasAccess(role, 'owner_dashboard'),
                    access: getDefault(role, 'owner_dashboard'),
                    reason: 'Needs Owner Dashboard permission.'
                },
                {
                    key: 'dashboard-manager',
                    title: MODULE_DISPLAY_LABELS['dashboard-manager'],
                    visible: isManager && canOpenDashboard,
                    access: isManager ? 'edit' : 'none',
                    reason: 'Admin-only manager dashboard card.'
                },
                {
                    key: 'dashboard-admin',
                    title: MODULE_DISPLAY_LABELS['dashboard-admin'],
                    visible: isWarehouse && canOpenDashboard && (hasAccess(role, 'lost_sales') || hasAccess(role, 'shortages')),
                    access: hasAccess(role, 'lost_sales') || hasAccess(role, 'shortages') ? 'read' : 'none',
                    reason: 'Warehouse view needs report access to Lost Sales or Shortages.'
                },
                {
                    key: 'hr-manager',
                    title: MODULE_DISPLAY_LABELS['hr-manager'],
                    visible: canUseHr && (isManager || hasAccess(role, 'hr_requests')),
                    access: hasAccess(role, 'hr_requests') ? getDefault(role, 'hr_requests') : 'none',
                    reason: 'Admin HR request review.'
                },
                {
                    key: 'dashboard-branch',
                    title: MODULE_DISPLAY_LABELS['dashboard-branch'],
                    visible: !isManager && !isOwner && !isWarehouse && canOpenDashboard && (hasAccess(role, 'lost_sales') || hasAccess(role, 'shortages')),
                    access: hasAccess(role, 'lost_sales') || hasAccess(role, 'shortages') ? 'read' : 'none',
                    reason: 'Branch-style dashboard needs read access to Lost Sales or Shortages.'
                },
                {
                    key: 'hr-directory',
                    title: MODULE_DISPLAY_LABELS['hr-directory'],
                    visible: canUseWorkforce && (isManager || hasAccess(role, 'hr_directory') || hasAccess(role, 'workforce')),
                    access: getDefault(role, 'hr_directory'),
                    reason: 'Central HR employee directory and workforce records.'
                },
                {
                    key: 'driver-payroll',
                    title: MODULE_DISPLAY_LABELS['driver-payroll'],
                    visible: canUseWorkforce && (isManager || hasAccess(role, 'driver_payroll') || hasAccess(role, 'workforce')),
                    access: getDefault(role, 'driver_payroll'),
                    reason: 'Driver monthly salary matrix, delivery incentives, loans & deductions.'
                },
                {
                    key: 'workforce',
                    title: MODULE_DISPLAY_LABELS.workforce,
                    visible: canUseWorkforce && (isManager || hasAccess(role, 'workforce')),
                    access: getDefault(role, 'workforce'),
                    reason: 'Admin workforce planning module.'
                },
                {
                    key: 'hr',
                    title: MODULE_DISPLAY_LABELS.hr,
                    visible: canUseHr && (role === 'branch' || hasAccess(role, 'hr_requests')),
                    access: getDefault(role, 'hr_requests'),
                    reason: 'Branch HR self-service.'
                },
                {
                    key: 'cash-flow',
                    title: MODULE_DISPLAY_LABELS['cash-flow'],
                    visible: isModuleEnabled('cashFlow') && hasAccess(role, 'cash_flow'),
                    access: getDefault(role, 'cash_flow'),
                    reason: 'Needs Cash Flow access.'
                },
                {
                    key: 'cash-tracker',
                    title: MODULE_DISPLAY_LABELS['cash-tracker'],
                    visible: isModuleEnabled('cashTracker') && hasAccess(role, 'cash_tracker'),
                    access: getDefault(role, 'cash_tracker'),
                    reason: 'Needs Branch Cash Tracker access.'
                },
                {
                    key: 'corporate-codex',
                    title: MODULE_DISPLAY_LABELS['corporate-codex'],
                    visible: isModuleEnabled('corporateCodex') && hasAccess(role, 'corporate_codex'),
                    access: getDefault(role, 'corporate_codex'),
                    reason: 'Needs Corporate Codex access.'
                },
                {
                    key: 'settings',
                    title: MODULE_DISPLAY_LABELS['settings'],
                    visible: isModuleEnabled('settings') && (isManager || hasAccess(role, 'settings')),
                    access: isManager ? 'edit' : getDefault(role, 'settings'),
                    reason: 'Unified Control Center: System Settings, Access Control, Users & Operations.'
                },
                {
                    key: 'spin-win',
                    title: isManager ? 'Reward Control' : MODULE_DISPLAY_LABELS['spin-win'],
                    visible: isModuleEnabled('spinWin') && hasAccess(role, 'spin_win'),
                    access: getDefault(role, 'spin_win'),
                    reason: 'Needs Spin & Win access.'
                },
                {
                    key: 'feedback-form',
                    title: MODULE_DISPLAY_LABELS['feedback-form'],
                    visible: isModuleEnabled('qualityFeedback') && hasAccess(role, 'quality_feedback'),
                    access: getDefault(role, 'quality_feedback'),
                    reason: 'Needs QA Insights access.'
                },
                {
                    key: 'feedback-admin',
                    title: MODULE_DISPLAY_LABELS['feedback-admin'],
                    visible: isModuleEnabled('qualityFeedback') && hasAccess(role, 'feedback_admin'),
                    access: getDefault(role, 'feedback_admin'),
                    reason: 'QA response analytics and feedback admin.'
                },
                {
                    key: 'employee-contributions',
                    title: MODULE_DISPLAY_LABELS['employee-contributions'],
                    visible: isModuleEnabled('employeeContributions') && hasAccess(role, 'employee_contributions'),
                    access: getDefault(role, 'employee_contributions'),
                    reason: 'Needs Team Contributions access.'
                },
                {
                    key: 'workflow-todo',
                    title: MODULE_DISPLAY_LABELS['workflow-todo'],
                    visible: isModuleEnabled('workflowTodo') && hasAccess(role, 'workflow_todo'),
                    access: getDefault(role, 'workflow_todo'),
                    reason: 'Needs Workflow & Todo access for branch tasks, personal todos, and approvals.'
                },
                {
                    key: 'delivery',
                    title: MODULE_DISPLAY_LABELS.delivery,
                    visible: isModuleEnabled('delivery') && hasAccess(role, 'delivery'),
                    access: getDefault(role, 'delivery'),
                    reason: 'None disables delivery, Read shows overview/map, Edit allows delivery recording.'
                },
                {
                    key: 'benefit-pay-ledger',
                    title: MODULE_DISPLAY_LABELS['benefit-pay-ledger'],
                    visible: isModuleEnabled('benefitPayLedger') && hasAccess(role, 'benefit_pay_ledger'),
                    access: getDefault(role, 'benefit_pay_ledger'),
                    reason: 'None disables BP Ledger, Read shows dashboard, Edit allows manual BP transfer recording.'
                },
                {
                    key: 'products',
                    title: MODULE_DISPLAY_LABELS['products'] || 'Product Catalogue',
                    visible: isModuleEnabled('products') && (hasAccess(role, 'products') || hasAccess(role, 'products:catalogue') || hasAccess(role, 'products:search')),
                    access: getDefault(role, 'products'),
                    reason: 'Product catalogue view and price/item search access.'
                },
                {
                    key: 'block-analyzer',
                    title: MODULE_DISPLAY_LABELS['block-analyzer'],
                    visible: hasAccess(role, 'block_analyzer'),
                    access: getDefault(role, 'block_analyzer'),
                    reason: 'Block analyzer module.'
                },
                {
                    key: 'operational-expenses',
                    title: MODULE_DISPLAY_LABELS['operational-expenses'],
                    visible: isModuleEnabled('operationalExpenses') && hasAccess(role, 'operational_expenses'),
                    access: getDefault(role, 'operational_expenses'),
                    reason: 'Needs Operational Cash Expenses access.'
                }
            ];

            const orderByKey = new Map<string, number>(moduleDisplayItems.map(item => [item.key, item.order]));
            return items.sort((a, b) => (orderByKey.get(a.key) ?? 9999) - (orderByKey.get(b.key) ?? 9999) || a.key.localeCompare(b.key));
        };

        return ASSIGNABLE_ROLES.map(role => {
            const layout = buildLayoutForRole(role);
            return {
                role,
                visible: layout.filter(item => item.visible),
                hidden: layout.filter(item => !item.visible)
            };
        });
    }, [moduleDisplayItems, roleDefaults, ASSIGNABLE_ROLES]);

    const cycleDefault = async (role: Role, feature: string) => {
        if (role === 'admin' || role === 'manager') return; // admin always has full access
        const current = getDefault(role, feature);
        const cycle = ACCESS_CYCLE;
        const next = cycle[(cycle.indexOf(current) + 1) % cycle.length] || 'none';
        setSavingKey(`${role}:${feature}`);
        try {
            await permissionService.upsertRoleDefault({ role, featureName: feature, accessLevel: next });
            setRoleDefaults(prev => {
                const idx = prev.findIndex(p => p.role === role && p.featureName === feature);
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], accessLevel: next };
                    return copy;
                }
                return [...prev, { role, featureName: feature, accessLevel: next }];
            });
        } catch (e: any) {
            Swal.fire('Save failed', e?.message || 'Could not update role permission.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const activeUserCount = users.filter(user => user.isActive).length;
    const disabledUserCount = users.length - activeUserCount;
    const branchLoginCount = users.filter(user => user.role === 'branch').length;
    const supervisorLoginCount = users.filter(user => user.role === 'supervisor').length;
    const driverLoginCount = users.filter(user => user.role === 'driver').length;

    if (isLoading) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading access control…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50">
                    <button
                        onClick={() => setView('users')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'users' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserCog className="h-3.5 w-3.5" /> Users & Roles
                    </button>
                    <button
                        onClick={() => setView('zones')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'zones' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className="h-3.5 w-3.5" /> Zones
                    </button>
                    <button
                        onClick={() => setView('staff')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'staff' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Building2 className="h-3.5 w-3.5" /> Branch Staff
                    </button>
                    <button
                        onClick={() => setView('matrix')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'matrix' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Shield className="h-3.5 w-3.5" /> Role Permissions
                    </button>
                    <button
                        onClick={() => setView('simulator')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'simulator' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Eye className="h-3.5 w-3.5" /> Live Simulator
                    </button>
                    <button
                        onClick={() => setView('branch_overrides')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'branch_overrides' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <GitFork className="h-3.5 w-3.5" /> Branch Overrides
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleCreateCustomRole}
                        className="btn-secondary text-[10px] uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                        <Plus className="h-3.5 w-3.5 text-brand" /> Add Role
                    </button>
                    <button
                        onClick={handleCreateUser}
                        disabled={savingKey === 'create-user'}
                        className="btn-primary text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                        {savingKey === 'create-user' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        Add User
                    </button>
                    <button onClick={load} className="btn-secondary text-[10px] uppercase tracking-widest">
                        <RefreshCcw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {view === 'users' ? (
                <div className="space-y-5">
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-brand/5 text-brand">
                                    <UserCog className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Workspace access</p>
                                    <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Users & Roles</h3>
                                    <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                        Assign login roles, connect branch users to one branch, and keep supervisor zone scopes visible without hunting through a dense table.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[440px]">
                                {[
                                    { label: 'Users', value: users.length, tone: 'text-slate-900' },
                                    { label: 'Active', value: activeUserCount, tone: 'text-emerald-700' },
                                    { label: 'Branch', value: branchLoginCount, tone: 'text-brand' },
                                    { label: 'Supervisors', value: supervisorLoginCount, tone: 'text-blue-700' },
                                    { label: 'Drivers', value: driverLoginCount, tone: 'text-cyan-700' }
                                ].map(stat => (
                                    <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                                        <p className={`mt-1 text-xl font-black tabular-nums ${stat.tone}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {disabledUserCount > 0 && (
                            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
                                {disabledUserCount} disabled login{disabledUserCount === 1 ? '' : 's'} are currently blocked from accessing the dashboard.
                            </div>
                        )}
                    </section>

                    {/* User Search & Filter Bar */}
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search users by email or branch name..."
                                value={userSearchTerm}
                                onChange={e => setUserSearchTerm(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all focus:border-brand focus:bg-white"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={userRoleFilter}
                                onChange={e => setUserRoleFilter(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
                            >
                                <option value="all">All Roles</option>
                                {ASSIGNABLE_ROLES.map(role => (
                                    <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                                ))}
                            </select>
                            <select
                                value={userBranchFilter}
                                onChange={e => setUserBranchFilter(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
                            >
                                <option value="all">All Branches</option>
                                {branchOptions.map(b => (
                                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {filteredUsers.length === 0 ? (
                        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <UserCog className="mx-auto h-9 w-9 text-slate-300" />
                            <p className="mt-3 text-sm font-black text-slate-800">No login users found</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Try adjusting your search query or filters.</p>
                        </section>
                    ) : (
                        <section className="min-w-0 space-y-4">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identity roster</p>
                                    <h4 className="mt-1 text-base font-black tracking-tight text-slate-950">Login accounts</h4>
                                </div>
                                <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:w-fit">
                                    Showing {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
                                {filteredUsers.map(user => {
                                    const isSelf = user.userId === currentUserId;
                                    const isSaving = savingKey === user.userId;
                                    const isPermissionsSaving = savingKey === `permissions:${user.userId}`;
                                    const isProtectedAdmin = user.role === 'admin' || user.role === 'manager';
                                    const supervisorZoneIds = supervisorAssignments[user.userId] || [];
                                    const assignedZones = zoneOptions.filter(zone => supervisorZoneIds.includes(zone.id));
                                    const supervisorScopeMode = getSupervisorScopeMode(user);
                                    const scopeSummary = user.role === 'branch'
                                        ? (user.branchName || 'No branch linked')
                                        : user.role === 'supervisor'
                                            ? (supervisorScopeMode === 'all_zones' ? 'All zones' : `${supervisorZoneIds.length} assigned zone${supervisorZoneIds.length === 1 ? '' : 's'}`)
                                            : user.role === 'driver'
                                                ? 'Driver mobile'
                                                : 'All branches';
                                    const scopeDetail = user.role === 'branch'
                                        ? (user.branchCode ? `Branch code ${user.branchCode}` : 'Branch code not set')
                                        : user.role === 'supervisor'
                                            ? (supervisorScopeMode === 'all_zones'
                                                ? 'Full branch visibility'
                                                : (assignedZones.length > 0 ? assignedZones.slice(0, 4).map(zone => zone.name).join(', ') : 'No zones assigned yet'))
                                            : user.role === 'driver'
                                                ? 'Linked to a delivery driver profile.'
                                                : 'Cross-branch visibility follows this role.';
                                    const roleLocked = isSelf || isSaving || isProtectedAdmin;

                                    return (
                                        <article key={`roster-${user.userId}`} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/5">
                                            <div className="border-b border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-white text-sm font-black uppercase text-brand shadow-sm sm:h-11 sm:w-11">
                                                            {user.email.slice(0, 2)}
                                                            {user.isActive && (
                                                                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="break-all text-sm font-black leading-5 text-slate-950">{user.email}</p>
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${roleBadgeClass(user.role)}`}>
                                                                    {ROLE_LABELS[user.role] || user.role}
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                                                                    {user.isActive ? 'Active' : 'Disabled'}
                                                                </span>
                                                                {user.createdAt && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-bold text-slate-400">
                                                                        <Clock className="h-3 w-3" />
                                                                        {new Date(user.createdAt).toLocaleDateString('en-GB')}
                                                                    </span>
                                                                )}
                                                                {isSelf && (
                                                                    <span className="rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                                                        Current user
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {(isSaving || isPermissionsSaving) && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />}
                                                </div>
                                            </div>

                                            <div className="grid min-w-0 gap-4 p-3 sm:p-4">
                                                <div className="grid min-w-0 gap-3 md:grid-cols-2">
                                                    <label className="min-w-0 space-y-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Login role</span>
                                                        <select
                                                            title="Login role"
                                                            aria-label="Login role"
                                                            value={user.role}
                                                            disabled={roleLocked}
                                                            onChange={event => handleRoleChange(user, event.target.value as Role)}
                                                            className="min-h-[46px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                        >
                                                            {ASSIGNABLE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                                                            {!ASSIGNABLE_ROLES.includes(user.role) && <option value={user.role}>{ROLE_LABELS[user.role] || user.role}</option>}
                                                        </select>
                                                        {isProtectedAdmin && <p className="text-[10px] font-bold text-slate-400">Protected system role.</p>}
                                                    </label>

                                                    <div className="min-w-0 space-y-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch / scope</span>
                                                        {user.role === 'supervisor' ? (
                                                            <button
                                                                onClick={() => handleSupervisorZones(user)}
                                                                disabled={isSaving}
                                                                title={assignedZones.map(zone => `${zone.name} (${zone.branchIds.length} branches)`).join(', ')}
                                                                className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-all hover:border-brand/30 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <span className="min-w-0">
                                                                    <span className="block truncate text-sm font-black text-slate-800">{scopeSummary}</span>
                                                                    <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">{scopeDetail}</span>
                                                                </span>
                                                                <Users className="h-4 w-4 shrink-0 text-brand" />
                                                            </button>
                                                        ) : (
                                                            <div className="min-h-[46px] rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                                <p className="break-words text-sm font-black leading-5 text-slate-800">{scopeSummary}</p>
                                                                <p className="mt-0.5 break-words text-[10px] font-bold uppercase tracking-widest text-slate-400">{scopeDetail}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                    <button
                                                        onClick={() => handleActiveToggle(user)}
                                                        disabled={isSelf || isSaving || isProtectedAdmin}
                                                        className={`inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${user.isActive ? 'border-slate-200 bg-white text-slate-500 hover:border-brand/30 hover:text-brand' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                                    >
                                                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        {user.isActive ? 'Suspend' : 'Activate'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleUserPermissions(user)}
                                                        disabled={isSelf || isSaving || isProtectedAdmin || isPermissionsSaving}
                                                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                                                    >
                                                        {isPermissionsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                                                        Permissions
                                                    </button>
                                                    {user.role === 'branch' && (
                                                        <button
                                                            onClick={() => handleResetPassword(user)}
                                                            disabled={isSelf || isSaving}
                                                            className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                                                        >
                                                            <KeyRound className="h-3.5 w-3.5" />
                                                            Password
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        disabled={isSelf || isSaving || isProtectedAdmin}
                                                        className="inline-flex min-h-[38px] min-w-0 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Desktop table */}
                    <div className="hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="px-4 py-3">Login</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Branch / Scope</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(user => {
                                    const isSelf = user.userId === currentUserId;
                                    const isSaving = savingKey === user.userId;
                                    const isProtectedAdmin = user.role === 'admin' || user.role === 'manager';
                                    return (
                                        <tr key={user.userId} className="bg-white">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-900">{user.email}</p>
                                                {isSelf && <p className="text-[10px] font-bold text-brand">You — role locked</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={user.role}
                                                    title="Login role"
                                                    aria-label="Login role"
                                                    disabled={isSelf || isSaving || isProtectedAdmin}
                                                    onChange={e => handleRoleChange(user, e.target.value as Role)}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-brand/40 disabled:opacity-50"
                                                >
                                                    {ASSIGNABLE_ROLES.map(r => (
                                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                    ))}
                                                    {!ASSIGNABLE_ROLES.includes(user.role) && (
                                                        <option value={user.role}>{ROLE_LABELS[user.role] || user.role}</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.role === 'branch' ? (
                                                    <span className="text-xs font-bold text-slate-600">{user.branchName || '—'} {user.branchCode ? `(${user.branchCode})` : ''}</span>
                                                ) : user.role === 'supervisor' ? (
                                                    <button
                                                        onClick={() => handleSupervisorZones(user)}
                                                        disabled={isSaving}
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand/30 hover:text-brand"
                                                    >
                                                        <Users className="mr-1 inline h-3.5 w-3.5" />
                                                        {(supervisorAssignments[user.userId] || []).length} zones
                                                    </button>
                                                ) : user.role === 'driver' ? (
                                                    <span className="text-xs font-medium text-cyan-600">Driver mobile profile</span>
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-400">All branches</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                                    {user.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                        onClick={() => handleActiveToggle(user)}
                                                        disabled={isSelf || isSaving || isProtectedAdmin}
                                                    className={`text-xs font-bold ${user.isActive ? 'text-slate-400 hover:text-brand' : 'text-emerald-600 hover:text-emerald-700'} disabled:opacity-40`}
                                                >
                                                    {isSaving ? '...' : user.isActive ? 'Suspend' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => handleUserPermissions(user)}
                                                    disabled={isSelf || isSaving || isProtectedAdmin}
                                                    className="ml-3 text-xs font-bold text-slate-400 transition hover:text-brand disabled:opacity-40"
                                                >
                                                    Permissions
                                                </button>
                                                {user.role === 'branch' && (
                                                    <button
                                                        onClick={() => handleResetPassword(user)}
                                                        disabled={isSelf || isSaving}
                                                        className="ml-3 inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition hover:text-brand disabled:opacity-40"
                                                    >
                                                        <KeyRound className="h-3.5 w-3.5" /> Set Password
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    disabled={isSelf || isSaving || isProtectedAdmin}
                                                    className="ml-3 inline-flex items-center gap-1 text-xs font-bold text-slate-300 transition hover:text-red-700 disabled:opacity-40"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="hidden">
                        {users.map(user => {
                            const isSelf = user.userId === currentUserId;
                            const isSaving = savingKey === user.userId;
                            const isProtectedAdmin = user.role === 'admin' || user.role === 'manager';
                            const isPermissionsSaving = savingKey === `permissions:${user.userId}`;
                            const supervisorZoneIds = supervisorAssignments[user.userId] || [];
                            const assignedZones = zoneOptions.filter(zone => supervisorZoneIds.includes(zone.id));
                            const supervisorScopeMode = getSupervisorScopeMode(user);
                            const scopeSummary = user.role === 'branch'
                                ? (user.branchName || 'No branch linked')
                                : user.role === 'supervisor'
                                    ? (supervisorScopeMode === 'all_zones' ? 'All zones' : `${supervisorZoneIds.length} assigned zone${supervisorZoneIds.length === 1 ? '' : 's'}`)
                                    : user.role === 'driver'
                                        ? 'Driver mobile'
                                        : 'All branches';
                            const scopeDetail = user.role === 'branch'
                                ? (user.branchCode ? `Branch code ${user.branchCode}` : 'Branch code not set')
                                : user.role === 'supervisor'
                                    ? (supervisorScopeMode === 'all_zones'
                                        ? 'Full branch visibility'
                                        : (assignedZones.length > 0 ? assignedZones.slice(0, 3).map(zone => zone.name).join(', ') : 'No zones assigned yet'))
                                    : user.role === 'driver'
                                        ? 'Linked to a delivery driver profile.'
                                        : 'Cross-branch visibility follows this role.';
                            return (
                                <div key={user.userId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand/25 hover:shadow-md hover:shadow-brand/5">
                                    <div className="border-b border-slate-100 bg-slate-50/70 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="break-all text-sm font-black leading-5 text-slate-950">{user.email}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${roleBadgeClass(user.role)}`}>
                                                        {ROLE_LABELS[user.role] || user.role}
                                                    </span>
                                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
                                                        {user.isActive ? 'Active' : 'Disabled'}
                                                    </span>
                                                    {isSelf && (
                                                        <span className="rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {(isSaving || isPermissionsSaving) && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />}
                                        </div>
                                    </div>
                                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7)]">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <label className="min-w-0 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Login role</span>
                                                <select
                                                    title="Login role"
                                                    aria-label="Login role"
                                                    value={user.role}
                                                    disabled={isSelf || isSaving || isProtectedAdmin}
                                                    onChange={e => handleRoleChange(user, e.target.value as Role)}
                                                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                                >
                                                    {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                                    {!ASSIGNABLE_ROLES.includes(user.role) && <option value={user.role}>{ROLE_LABELS[user.role] || user.role}</option>}
                                                </select>
                                                {isProtectedAdmin && <p className="text-[10px] font-bold text-slate-400">Protected system role.</p>}
                                            </label>
                                            <div className="min-w-0 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch / scope</span>
                                                {user.role === 'supervisor' ? (
                                                    <button
                                                        onClick={() => handleSupervisorZones(user)}
                                                        disabled={isSaving}
                                                        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-all hover:border-brand/30 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-slate-800">{scopeSummary}</span>
                                                            <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">{scopeDetail}</span>
                                                        </span>
                                                        <Users className="h-4 w-4 shrink-0 text-brand" />
                                                    </button>
                                                ) : (
                                                    <div className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                        <p className="break-words text-sm font-black leading-5 text-slate-800">{scopeSummary}</p>
                                                        <p className="mt-0.5 break-words text-[10px] font-bold uppercase tracking-widest text-slate-400">{scopeDetail}</p>
                                                    </div>
                                                )}
                                            </div>
                                        {user.role === 'branch' && (
                                            <span className="text-xs font-bold text-slate-500">{user.branchCode || '—'}</span>
                                        )}
                                        <button
                                            onClick={() => handleActiveToggle(user)}
                                            disabled={isSelf || isSaving || isProtectedAdmin}
                                            className={`inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 ${user.isActive ? 'border-slate-200 bg-white text-slate-500 hover:border-brand/30 hover:text-brand' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                        >
                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            {user.isActive ? 'Suspend' : 'Activate'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            disabled={isSelf || isSaving || isProtectedAdmin}
                                            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </button>
                                        {user.role === 'branch' && (
                                            <button
                                                onClick={() => handleResetPassword(user)}
                                                disabled={isSelf || isSaving}
                                                className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <KeyRound className="h-3.5 w-3.5" />
                                                Password
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleUserPermissions(user)}
                                            disabled={isSelf || isSaving || isProtectedAdmin}
                                            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isPermissionsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                                            Permissions
                                        </button>
                                    </div>
                                </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : view === 'zones' ? (
                <div className="space-y-5">
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Supervisor zones</p>
                                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Branch Zones</h3>
                                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                    Create Zone 1, Zone 2, assign branches to each zone, then link each zone to one supervisor login.
                                </p>
                            </div>
                            <button
                                onClick={() => handleZoneEditor()}
                                disabled={savingKey === 'create-zone'}
                                className="btn-primary w-fit text-[10px] uppercase tracking-widest disabled:opacity-50"
                            >
                                {savingKey === 'create-zone' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                Create Zone
                            </button>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {zones.map(zone => {
                            const supervisor = zone.supervisorUserId
                                ? users.find(user => user.userId === zone.supervisorUserId)
                                : undefined;
                            const assignedBranches = branchOptions.filter(branch => zone.branchIds.includes(branch.id));
                            return (
                                <article key={zone.id} className={`rounded-xl border bg-white p-4 shadow-sm ${zone.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-base font-black text-slate-950">{zone.name}</p>
                                            <p className="mt-1 text-[11px] font-bold text-slate-400">
                                                {zone.code} / {assignedBranches.length} branch{assignedBranches.length === 1 ? '' : 'es'}
                                            </p>
                                            <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${supervisor ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {supervisor ? `Supervisor: ${supervisor.email}` : 'No supervisor assigned'}
                                            </p>
                                        </div>
                                        <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase ${zone.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                            {zone.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    {zone.notes && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{zone.notes}</p>}
                                    <p className="mt-3 line-clamp-2 text-[11px] font-bold leading-5 text-slate-400" title={assignedBranches.map(branch => `${branch.name} (${branch.code})`).join(', ')}>
                                        {assignedBranches.length > 0
                                            ? assignedBranches.map(branch => branch.code || branch.name).join(', ')
                                            : 'No branches assigned yet'}
                                    </p>
                                    <button
                                        onClick={() => handleZoneEditor(zone)}
                                        disabled={savingKey === zone.id}
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-brand/30 hover:text-brand disabled:opacity-50"
                                    >
                                        {savingKey === zone.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                                        Edit Zone
                                    </button>
                                </article>
                            );
                        })}
                        {zones.length === 0 && (
                            <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center xl:col-span-2">
                                <Users className="mx-auto h-9 w-9 text-slate-300" />
                                <p className="mt-3 text-sm font-black text-slate-800">No zones yet</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Create Zone 1 and assign branches before linking supervisors.</p>
                            </section>
                        )}
                    </div>
                </div>
            ) : view === 'staff' ? (
                <div className="space-y-5">
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Branch staff</p>
                                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Pharmacists & Drivers</h3>
                                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                    Assign active pharmacists and delivery drivers to each operational branch. Delivery Recording uses these branch-scoped lists.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
                                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Branches</p>
                                    <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{branchOptions.length}</p>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pharmacists</p>
                                    <p className="mt-1 text-xl font-black tabular-nums text-brand">{pharmacistOptions.length}</p>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Drivers</p>
                                    <p className="mt-1 text-xl font-black tabular-nums text-cyan-700">{driverOptions.length}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {branchOptions.map(branch => {
                            const assignment = branchStaffByBranchId.get(branch.id) || { branchId: branch.id, pharmacistIds: [], driverIds: [] };
                            const assignedPharmacists = pharmacistOptions.filter(pharmacist => assignment.pharmacistIds.includes(pharmacist.id));
                            const assignedDrivers = driverOptions.filter(driver => assignment.driverIds.includes(driver.id));
                            const isSaving = savingKey === `staff:${branch.id}`;
                            return (
                                <article key={branch.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-base font-black text-slate-950">{branch.name}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{branch.code || 'No branch code'}</p>
                                        </div>
                                        <Building2 className="h-5 w-5 shrink-0 text-brand" />
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pharmacists</p>
                                                <Users className="h-4 w-4 text-brand" />
                                            </div>
                                            <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{assignedPharmacists.length}</p>
                                            <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-5 text-slate-400" title={assignedPharmacists.map(pharmacist => pharmacist.code ? `${pharmacist.code} - ${pharmacist.name}` : pharmacist.name).join(', ')}>
                                                {assignedPharmacists.length > 0
                                                    ? assignedPharmacists.slice(0, 4).map(pharmacist => pharmacist.code || pharmacist.name).join(', ')
                                                    : 'No pharmacists assigned'}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drivers</p>
                                                <Bike className="h-4 w-4 text-cyan-700" />
                                            </div>
                                            <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{assignedDrivers.length}</p>
                                            <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-5 text-slate-400" title={assignedDrivers.map(driver => driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name).join(', ')}>
                                                {assignedDrivers.length > 0
                                                    ? assignedDrivers.slice(0, 4).map(driver => driver.driverCode || driver.name).join(', ')
                                                    : 'No drivers assigned'}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleBranchStaffEditor(branch)}
                                        disabled={isSaving}
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-brand/30 hover:text-brand disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                                        Assign Staff
                                    </button>
                                </article>
                            );
                        })}
                        {branchOptions.length === 0 && (
                            <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center xl:col-span-2">
                                <Building2 className="mx-auto h-9 w-9 text-slate-300" />
                                <p className="mt-3 text-sm font-black text-slate-800">No branches found</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Create operational branches before assigning branch staff.</p>
                            </section>
                        )}
                    </div>
                </div>
            ) : view === 'simulator' ? (
                <div className="space-y-5">
                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5 mb-5">
                            <div className="flex items-start gap-3.5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 text-brand ring-1 ring-brand/10 shadow-sm">
                                    <LayoutGrid className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black tracking-tight text-slate-950 uppercase">Module Layout per Role</h3>
                                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand">Live Simulator</span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 max-w-2xl">
                                        Simulate what each role sees in their Operations Launcher grid. Module sequence follows Module Layout; visibility respects global flags and role access levels.
                                    </p>
                                </div>
                            </div>

                            {/* Filter Tabs for Roles */}
                            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1.5 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setPreviewRoleFilter('all')}
                                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                        previewRoleFilter === 'all'
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                                    }`}
                                >
                                    All Roles
                                </button>
                                {ASSIGNABLE_ROLES.map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setPreviewRoleFilter(r)}
                                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                            previewRoleFilter === r
                                                ? 'bg-brand text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                                        }`}
                                    >
                                        {ROLE_LABELS[r]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Display Role Layouts Grid */}
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {roleModuleLayouts
                                .filter(layout => previewRoleFilter === 'all' || layout.role === previewRoleFilter)
                                .map(roleLayout => {
                                    const isExpanded = expandedHiddenRoles[roleLayout.role] || false;
                                    return (
                                        <article
                                            key={roleLayout.role}
                                            className="flex flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-slate-100/30 p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                                        >
                                            {/* Role Header Banner */}
                                            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-black">
                                                        {ROLE_LABELS[roleLayout.role]?.[0] || 'R'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="break-words text-sm font-black tracking-tight text-slate-900">{ROLE_LABELS[roleLayout.role]}</p>
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Launcher Simulator</p>
                                                    </div>
                                                </div>
                                                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    {roleLayout.visible.length} Active
                                                </span>
                                            </div>

                                            {/* 3x3 Mini Launcher Cards Grid */}
                                            <div className="flex-1 space-y-3">
                                                {roleLayout.visible.length === 0 ? (
                                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-inner">
                                                        <EyeOff className="mx-auto h-7 w-7 text-slate-300" />
                                                        <p className="mt-2 text-xs font-black text-slate-700 uppercase tracking-wider">No Launcher Modules Available</p>
                                                        <p className="mt-1 text-[10px] font-semibold text-slate-400">Role has no active permissions or module flags are off.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                                                        {roleLayout.visible.map((module, index) => (
                                                            <div
                                                                key={module.key}
                                                                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5"
                                                            >
                                                                <div className="flex items-start justify-between gap-1.5">
                                                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-black text-slate-500 group-hover:bg-brand group-hover:text-white transition-colors">
                                                                        {index + 1}
                                                                    </span>
                                                                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${accessBadgeClass(module.access || 'none')}`}>
                                                                        {module.access || 'show'}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-3 min-w-0">
                                                                    <p className="break-words text-xs font-black leading-snug text-slate-800 group-hover:text-brand transition-colors">
                                                                        {module.title}
                                                                    </p>
                                                                    <p className="mt-1 truncate text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                                        {module.key}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Hidden Modules Drawer Accordion */}
                                            <div className="mt-4 border-t border-slate-200/60 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedHiddenRoles(prev => ({ ...prev, [roleLayout.role]: !prev[roleLayout.role] }))}
                                                    className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left border border-slate-200/60 shadow-sm transition-all hover:bg-slate-50"
                                                >
                                                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                                                        Hidden ({roleLayout.hidden.length})
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase text-brand">
                                                        {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                                                    </span>
                                                </button>

                                                {isExpanded && roleLayout.hidden.length > 0 && (
                                                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200/60 bg-white p-2.5 shadow-inner">
                                                        {roleLayout.hidden.map(item => (
                                                            <div key={item.key} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{item.title}</p>
                                                                    <p className="text-[8px] font-semibold text-slate-400 truncate">{item.reason}</p>
                                                                </div>
                                                                <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[8px] font-black text-slate-500 uppercase">Hidden</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                        </div>
                    </section>
                </div>
            ) : (
                <div className="space-y-5">
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-3.5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 text-brand ring-1 ring-brand/10 shadow-sm">
                                    <Shield className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black tracking-tight text-slate-950 uppercase">Role Access Permissions Matrix</h3>
                                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand">Hierarchical Control</span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 max-w-2xl">
                                        Configure default permissions (None, Read, Edit) for system roles across main modules and sub-tools.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Matrix Controls & Search Bar */}
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search modules, sub-tools or tabs..."
                                value={matrixSearchTerm}
                                onChange={e => setMatrixSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all focus:border-brand focus:bg-white"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const allFeatures = getEnabledAccessFeatures();
                                    const allExpanded = allFeatures.every(f => expandedMatrixModules[f.id]);
                                    const nextState: Record<string, boolean> = {};
                                    allFeatures.forEach(f => { nextState[f.id] = !allExpanded; });
                                    setExpandedMatrixModules(nextState);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                            >
                                <LayoutGrid className="h-3.5 w-3.5 text-brand" />
                                {getEnabledAccessFeatures().every(f => expandedMatrixModules[f.id]) ? 'Collapse All' : 'Expand All'}
                            </button>
                            <button
                                type="button"
                                onClick={handleCloneRolePermissions}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                                title="Clone all permissions from one role to another"
                            >
                                <Copy className="h-3.5 w-3.5 text-brand" /> Clone Role
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkPermissionAction}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                                title="Set all permissions for a role to Read, Edit, or None"
                            >
                                <Zap className="h-3.5 w-3.5 text-amber-600" /> Bulk Action ⚡
                            </button>
                            <button
                                type="button"
                                onClick={handleExportMatrix}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                                title="Export current permissions matrix to JSON"
                            >
                                <Download className="h-3.5 w-3.5 text-slate-600" /> Export JSON
                            </button>
                            <button
                                type="button"
                                onClick={handleImportMatrix}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                                title="Import permissions matrix from JSON file"
                            >
                                <Upload className="h-3.5 w-3.5 text-slate-600" /> Import JSON
                            </button>
                        </div>
                    </div>

                    {/* Visual Legend Bar */}
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-[11px] font-bold text-slate-600 shadow-2xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Legend:</span>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-12 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-center text-[9px] font-black text-emerald-700 uppercase">EDIT</span>
                            <span className="text-slate-500 font-normal">Full Edit</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-12 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-center text-[9px] font-black text-blue-700 uppercase">READ</span>
                            <span className="text-slate-500 font-normal">View Only</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-12 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-[9px] font-black text-slate-400 uppercase">NONE</span>
                            <span className="text-slate-500 font-normal">Disabled</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-12 rounded border border-dashed border-slate-300 bg-slate-50 px-1.5 py-0.5 text-center text-[9px] font-black text-slate-500 uppercase">Def</span>
                            <span className="text-slate-500 font-normal">Inherits Module</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-center text-[9px] font-black text-emerald-700 uppercase">EDIT ★</span>
                            <span className="text-slate-500 font-normal">Explicit Sub-Tool Override</span>
                        </div>
                    </div>

                    {/* Matrix Table with Sticky Header & Accordion */}
                    <div className="max-h-[640px] overflow-auto rounded-xl border border-slate-200 shadow-sm custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-white">
                                    <th className="px-4 py-3.5 min-w-[260px] bg-slate-900">Module / Sub-Tool & Tab</th>
                                    {ASSIGNABLE_ROLES.map(r => (
                                        <th key={r} className="px-3 py-3.5 text-center bg-slate-900">{ROLE_LABELS[r]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {getEnabledAccessFeatures()
                                    .filter(feature => {
                                        const query = matrixSearchTerm.toLowerCase().trim();
                                        if (!query) return true;
                                        const matchesParent = feature.label.toLowerCase().includes(query) || (feature.description && feature.description.toLowerCase().includes(query));
                                        const matchesChild = feature.subFeatures && feature.subFeatures.some(s => s.label.toLowerCase().includes(query));
                                        return matchesParent || matchesChild;
                                    })
                                    .map(feature => {
                                        const hasSubs = feature.subFeatures && feature.subFeatures.length > 0;
                                        const query = matrixSearchTerm.toLowerCase().trim();
                                        const isExpanded = !!query || !!expandedMatrixModules[feature.id];

                                        const filteredSubs = hasSubs ? feature.subFeatures!.filter(sub => {
                                            if (!query) return true;
                                            const matchesParent = feature.label.toLowerCase().includes(query);
                                            const matchesSub = sub.label.toLowerCase().includes(query);
                                            return matchesParent || matchesSub;
                                        }) : [];

                                        return (
                                            <React.Fragment key={feature.id}>
                                                {/* Parent Feature Row */}
                                                <tr className="bg-slate-50/90 font-bold text-slate-900 border-t border-slate-200/80 hover:bg-slate-100/80 transition-colors">
                                                    <td className="px-4 py-3 cursor-pointer" onClick={() => hasSubs && setExpandedMatrixModules(prev => ({ ...prev, [feature.id]: !prev[feature.id] }))}>
                                                        <div className="flex items-center gap-2">
                                                            {hasSubs && (
                                                                <span className="text-slate-400 text-xs font-black transition-transform">
                                                                    {isExpanded ? '▼' : '▶'}
                                                                </span>
                                                            )}
                                                            <span className="font-black text-slate-950 text-xs tracking-tight">{feature.label}</span>
                                                            {hasSubs && (
                                                                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-black text-slate-600 uppercase">
                                                                    {feature.subFeatures!.length} sub-tools
                                                                </span>
                                                            )}
                                                        </div>
                                                        {feature.description && (
                                                            <p className="mt-0.5 text-[10px] font-medium text-slate-400 leading-tight pl-4">{feature.description}</p>
                                                        )}
                                                    </td>
                                                    {ASSIGNABLE_ROLES.map(r => {
                                                        const level = getDefault(r, feature.id);
                                                        const key = `${r}:${feature.id}`;
                                                        return (
                                                            <td key={r} className="px-3 py-2 text-center align-middle">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => cycleDefault(r, feature.id)}
                                                                    disabled={r === 'admin' || r === 'manager' || savingKey === key}
                                                                    className={`w-16 rounded-md border px-2 py-1.5 text-[10px] font-black uppercase transition-all shadow-2xs ${accessBadgeClass(level)} ${r === 'admin' || r === 'manager' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xs'}`}
                                                                >
                                                                    {savingKey === key ? '…' : level}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                                {/* Sub-Features Rows (Rendered if Expanded) */}
                                                {hasSubs && isExpanded && filteredSubs.map(sub => (
                                                    <tr key={sub.id} className="bg-white hover:bg-slate-50/70 transition-colors border-l-4 border-l-brand/30">
                                                        <td className="pl-9 pr-4 py-2.5 text-xs">
                                                            <span className="font-bold text-slate-700">↳ {sub.label}</span>
                                                        </td>
                                                        {ASSIGNABLE_ROLES.map(r => {
                                                            const explicitLevel = roleDefaults.find(p => p.role === r && p.featureName === sub.id)?.accessLevel;
                                                            const parentLevel = getDefault(r, feature.id);
                                                            const displayLevel = explicitLevel || parentLevel;
                                                            const isInherited = !explicitLevel;
                                                            const key = `${r}:${sub.id}`;
                                                            return (
                                                                <td key={r} className="px-3 py-1.5 text-center align-middle">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => cycleDefault(r, sub.id)}
                                                                        disabled={r === 'admin' || r === 'manager' || savingKey === key}
                                                                        className={`w-16 rounded-md border px-2 py-1 text-[9px] font-black uppercase transition-all shadow-2xs ${
                                                                            isInherited 
                                                                                ? 'border-dashed border-slate-300 text-slate-500 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-400' 
                                                                                : accessBadgeClass(displayLevel)
                                                                        } ${r === 'admin' || r === 'manager' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
                                                                        title={isInherited ? `Inherits from main module default (${parentLevel}). Click to override specifically for this sub-tool.` : `Explicit sub-tool override`}
                                                                    >
                                                                        {savingKey === key ? '…' : (isInherited ? `${displayLevel}` : `${displayLevel} ★`)}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'branch_overrides' && (
                <div className="space-y-6">
                    {/* Header Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase text-slate-950">Branch-Specific Permission Overrides</h3>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                        Customize specific feature permissions for an individual branch. Branch-level overrides supersede role defaults.
                                    </p>
                                </div>
                            </div>
                            <div className="w-full md:w-72">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Select Branch</label>
                                <select
                                    value={selectedOverrideBranchId}
                                    onChange={e => {
                                        const id = e.target.value;
                                        setSelectedOverrideBranchId(id);
                                        loadBranchOverrides(id);
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                                >
                                    <option value="">-- Select a Branch --</option>
                                    {branchOptions.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} ({b.code || 'No Code'})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {selectedOverrideBranchId ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h4 className="text-sm font-black uppercase text-slate-900">
                                        Permissions for {branchOptions.find(b => b.id === selectedOverrideBranchId)?.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Tap any badge to cycle: <span className="font-bold text-slate-400">Inherit Default</span> ➔ <span className="font-bold text-blue-600">Read</span> ➔ <span className="font-bold text-emerald-600">Edit</span> ➔ <span className="font-bold text-slate-600">None</span>
                                    </p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                                    {branchOverrides.length} Active Overrides
                                </span>
                            </div>

                            {isLoadingBranchOverrides ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {getEnabledAccessFeatures().map(feature => {
                                        const override = branchOverrides.find(p => p.featureName === feature.id);
                                        const currentLevel: 'inherit' | 'none' | 'read' | 'edit' = override ? override.accessLevel : 'inherit';
                                        const isSaving = savingKey === `branch-override:${selectedOverrideBranchId}:${feature.id}`;

                                        return (
                                            <div
                                                key={feature.id}
                                                onClick={() => !isSaving && handleBranchOverrideToggle(selectedOverrideBranchId, feature.id, currentLevel)}
                                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-brand/40 transition-all cursor-pointer shadow-2xs group"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs font-black text-slate-800 group-hover:text-brand transition-colors truncate">
                                                        {feature.label}
                                                    </p>
                                                    <p className="text-[9px] font-mono text-slate-400 uppercase font-bold truncate">
                                                        {feature.id}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isSaving ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                                                    ) : (
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                                            currentLevel === 'edit'
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                : currentLevel === 'read'
                                                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                                    : currentLevel === 'none'
                                                                        ? 'border-slate-200 bg-slate-100 text-slate-500'
                                                                        : 'border-dashed border-slate-300 bg-white text-slate-400'
                                                        }`}>
                                                            {currentLevel === 'inherit' ? 'Inherit' : currentLevel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
                            <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                            <h4 className="text-sm font-black text-slate-700 uppercase">No Branch Selected</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
                                Please select a branch from the dropdown above to view and customize branch-level permission overrides.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
