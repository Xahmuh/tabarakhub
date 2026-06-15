import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Eye, EyeOff, KeyRound, LayoutGrid, Loader2, RefreshCcw, Shield, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { permissionService, branchService, deliveryService } from '../../services';
import { AppUser, Branch, DeliveryDriver, MaintenanceSettings, Role, RolePermission } from '../../types';
import { ROLE_LABELS } from '../../lib/access';
import { getEnabledAccessFeatures } from '../../lib/moduleRegistry';
import { MODULE_DISPLAY_LABELS, normalizeModuleDisplaySettings } from '../../lib/moduleDisplay';
import { isModuleEnabled } from '../../config/clientConfig';

const ASSIGNABLE_ROLES: Role[] = ['admin', 'owner', 'branch', 'supervisor', 'warehouse', 'accounts', 'driver'];
const MODULE_LAYOUT_ROLES: Role[] = ['admin', 'owner', 'supervisor', 'warehouse', 'accounts', 'branch'];

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
    const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
    const [roleDefaults, setRoleDefaults] = useState<RolePermission[]>([]);
    const [supervisorAssignments, setSupervisorAssignments] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [view, setView] = useState<'users' | 'matrix'>('users');

    const branchOptions = useMemo(
        () => branches.filter(b => b.role === 'branch').sort((a, b) => a.name.localeCompare(b.name)),
        [branches]
    );
    const driverOptions = useMemo(
        () => drivers.filter(driver => driver.isActive).sort((a, b) => a.name.localeCompare(b.name)),
        [drivers]
    );

    const load = async () => {
        setIsLoading(true);
        try {
            const [userList, branchList, defaults, driverList] = await Promise.all([
                permissionService.adminListUsers(),
                branchService.list(),
                permissionService.listAllRoleDefaults(),
                deliveryService.drivers.list(true)
            ]);
            setUsers(userList);
            setBranches(branchList);
            setRoleDefaults(defaults);
            setDrivers(driverList);

            const supervisors = userList.filter(u => u.role === 'supervisor');
            const assignments: Record<string, string[]> = {};
            await Promise.all(supervisors.map(async s => {
                assignments[s.userId] = await permissionService.listSupervisorBranches(s.userId);
            }));
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
        const supervisorOptionsHtml = branchOptions.map(b => `
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                <input type="checkbox" value="${escapeHtml(b.id)}" class="swal-new-supervisor-branch h-4 w-4 accent-[#B91c1c]">
                ${escapeHtml(b.name)} <span class="text-slate-400 font-medium">(${escapeHtml(b.code)})</span>
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
                        <label class="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor branches</label>
                        <div class="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                            ${supervisorOptionsHtml || '<p class="p-3 text-xs font-bold text-slate-400">No branch logins found.</p>'}
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
                const supervisorBranchIds = Array.from(document.querySelectorAll<HTMLInputElement>('.swal-new-supervisor-branch:checked')).map(i => i.value);

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

                return { email, password, role, branchId, driverId, supervisorBranchIds, isActive };
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

    const handleSupervisorBranches = async (user: AppUser) => {
        const current = supervisorAssignments[user.userId] || [];
        const { value } = await Swal.fire({
            title: `<span class="text-xl font-black tracking-tight">Branches for ${user.email}</span>`,
            html: `
              <div class="space-y-2 text-left max-h-72 overflow-y-auto p-2">
                ${branchOptions.map(b => `
                  <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" value="${b.id}" ${current.includes(b.id) ? 'checked' : ''} class="swal-supervisor-branch h-4 w-4 accent-[#B91c1c]">
                    ${b.name} <span class="text-slate-400 font-medium">(${b.code})</span>
                  </label>`).join('')}
              </div>`,
            showCancelButton: true,
            confirmButtonText: 'Save assignment',
            confirmButtonColor: '#B91c1c',
            preConfirm: () => Array.from(document.querySelectorAll<HTMLInputElement>('.swal-supervisor-branch:checked')).map(i => i.value)
        });
        if (!value) return;

        setSavingKey(user.userId);
        try {
            await permissionService.setSupervisorBranches(user.userId, value);
            setSupervisorAssignments(prev => ({ ...prev, [user.userId]: value }));
        } catch (e: any) {
            Swal.fire('Assignment failed', e?.message || 'Could not save supervisor branches.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const handleUserPermissions = async (user: AppUser) => {
        setSavingKey(`permissions:${user.userId}`);
        try {
            const current = await permissionService.listRawForUser(user.userId);
            const byFeature = new Map(current.map(permission => [permission.featureName, permission.accessLevel]));
            const { value } = await Swal.fire({
                title: `<span class="text-xl font-black tracking-tight">Module access for ${escapeHtml(user.email)}</span>`,
                html: `
                  <div class="space-y-2 text-left">
                    <p class="text-xs font-semibold leading-5 text-slate-500">
                      Leave a module on Role default to inherit the role matrix. Pick None, Read, or Edit to override this user only.
                      Owner users are capped at Read because Owner is a read-only executive role.
                    </p>
                    <div class="max-h-[420px] space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
                      ${FEATURE_LABELS.map(feature => {
                        const selected = byFeature.get(feature.id) || '';
                        const isOwnerUser = user.role === 'owner';
                        return `
                          <label class="grid grid-cols-[1fr_120px] items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                            <span class="text-sm font-bold text-slate-700">${escapeHtml(feature.label)}</span>
                            <select id="swal-user-perm-${escapeHtml(feature.id)}" class="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black uppercase text-slate-600">
                              <option value="" ${selected === '' ? 'selected' : ''}>Role default</option>
                              <option value="none" ${selected === 'none' ? 'selected' : ''}>None</option>
                              <option value="read" ${selected === 'read' ? 'selected' : ''}>Read</option>
                              ${isOwnerUser ? '' : `<option value="edit" ${selected === 'edit' ? 'selected' : ''}>Edit</option>`}
                            </select>
                          </label>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Save permissions',
                confirmButtonColor: '#B91c1c',
                width: 680,
                preConfirm: () => FEATURE_LABELS
                    .map(feature => ({
                        featureName: feature.id,
                        accessLevel: (document.getElementById(`swal-user-perm-${feature.id}`) as HTMLSelectElement).value as 'none' | 'read' | 'edit' | ''
                    }))
                    .filter((permission): permission is { featureName: string; accessLevel: 'none' | 'read' | 'edit' } => !!permission.accessLevel)
            });

            if (!value) return;
            await permissionService.replaceUserPermissions(user.userId, value);
            Swal.fire('Permissions saved', 'User-level module overrides were updated.', 'success');
        } catch (e: any) {
            Swal.fire('Permissions failed', e?.message || 'Could not update user permissions.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const getDefault = (role: Role, feature: string): 'none' | 'read' | 'edit' => {
        if (role === 'admin' || role === 'manager') return 'edit';
        return (roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel as any) || 'none';
    };

    const moduleDisplayItems = useMemo(
        () => normalizeModuleDisplaySettings(settings?.moduleDisplaySettings).items,
        [settings?.moduleDisplaySettings]
    );

    const roleModuleLayouts = useMemo(() => {
        const hasAccess = (role: Role, feature: string, minimum: 'read' | 'edit' = 'read') => {
            const level = role === 'admin' || role === 'manager'
                ? 'edit'
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
                    visible: isOwner,
                    access: 'read',
                    reason: 'Owner read-only executive dashboard.'
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
                    visible: isManager && canUseHr && hasAccess(role, 'hr_requests'),
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
                    key: 'workforce',
                    title: MODULE_DISPLAY_LABELS.workforce,
                    visible: isManager && canUseWorkforce && hasAccess(role, 'workforce'),
                    access: getDefault(role, 'workforce'),
                    reason: 'Admin workforce planning module.'
                },
                {
                    key: 'hr',
                    title: MODULE_DISPLAY_LABELS.hr,
                    visible: role === 'branch' && canUseHr && hasAccess(role, 'hr_requests'),
                    access: getDefault(role, 'hr_requests'),
                    reason: 'Branch HR self-service.'
                },
                {
                    key: 'cash-flow',
                    title: MODULE_DISPLAY_LABELS['cash-flow'],
                    visible: !isOwner && isModuleEnabled('cashFlow') && hasAccess(role, 'cash_flow'),
                    access: getDefault(role, 'cash_flow'),
                    reason: 'Needs Cash Flow access.'
                },
                {
                    key: 'cash-tracker',
                    title: MODULE_DISPLAY_LABELS['cash-tracker'],
                    visible: !isManager && !isOwner && isModuleEnabled('cashTracker') && hasAccess(role, 'cash_tracker'),
                    access: getDefault(role, 'cash_tracker'),
                    reason: 'Needs Branch Cash Tracker access.'
                },
                {
                    key: 'corporate-codex',
                    title: MODULE_DISPLAY_LABELS['corporate-codex'],
                    visible: !isOwner && isModuleEnabled('corporateCodex') && hasAccess(role, 'corporate_codex'),
                    access: getDefault(role, 'corporate_codex'),
                    reason: 'Needs Corporate Codex access.'
                },
                {
                    key: 'system-settings',
                    title: MODULE_DISPLAY_LABELS['system-settings'],
                    visible: isModuleEnabled('settings') && isManager,
                    access: isManager ? 'edit' : getDefault(role, 'settings'),
                    reason: 'System settings, branding, module layout, and branch setup control.'
                },
                {
                    key: 'access-control',
                    title: MODULE_DISPLAY_LABELS['access-control'],
                    visible: isModuleEnabled('settings') && isManager,
                    access: isManager ? 'edit' : getDefault(role, 'settings'),
                    reason: 'Users, roles, branch permissions, and login approval control.'
                },
                {
                    key: 'spin-win',
                    title: isManager ? 'Reward Control' : MODULE_DISPLAY_LABELS['spin-win'],
                    visible: !isOwner && isModuleEnabled('spinWin') && hasAccess(role, 'spin_win'),
                    access: getDefault(role, 'spin_win'),
                    reason: 'Needs Spin & Win access.'
                },
                {
                    key: 'feedback-form',
                    title: MODULE_DISPLAY_LABELS['feedback-form'],
                    visible: !isOwner && isModuleEnabled('qualityFeedback') && hasAccess(role, 'quality_feedback'),
                    access: getDefault(role, 'quality_feedback'),
                    reason: 'Needs Quality Feedback access.'
                },
                {
                    key: 'feedback-admin',
                    title: MODULE_DISPLAY_LABELS['feedback-admin'],
                    visible: isModuleEnabled('qualityFeedback') && isManager && hasAccess(role, 'quality_feedback'),
                    access: getDefault(role, 'quality_feedback'),
                    reason: 'Admin quality analytics.'
                },
                {
                    key: 'employee-contributions',
                    title: MODULE_DISPLAY_LABELS['employee-contributions'],
                    visible: !isOwner && isModuleEnabled('employeeContributions') && hasAccess(role, 'employee_contributions'),
                    access: getDefault(role, 'employee_contributions'),
                    reason: 'Needs Team Contributions access.'
                },
                {
                    key: 'delivery',
                    title: MODULE_DISPLAY_LABELS.delivery,
                    visible: !isOwner && isModuleEnabled('delivery') && hasAccess(role, 'delivery'),
                    access: getDefault(role, 'delivery'),
                    reason: 'None disables delivery, Read shows overview/map, Edit allows delivery recording.'
                },
                {
                    key: 'block-analyzer',
                    title: MODULE_DISPLAY_LABELS['block-analyzer'],
                    visible: isManager && hasAccess(role, 'block_analyzer'),
                    access: getDefault(role, 'block_analyzer'),
                    reason: 'Admin block analyzer.'
                },
                {
                    key: 'command-center',
                    title: MODULE_DISPLAY_LABELS['command-center'],
                    visible: !isOwner && hasAccess(role, 'command_center'),
                    access: getDefault(role, 'command_center'),
                    reason: 'Needs Daily Command Center access.'
                }
            ];

            const orderByKey = new Map<string, number>(moduleDisplayItems.map(item => [item.key, item.order]));
            return items.sort((a, b) => (orderByKey.get(a.key) ?? 9999) - (orderByKey.get(b.key) ?? 9999) || a.key.localeCompare(b.key));
        };

        return MODULE_LAYOUT_ROLES.map(role => {
            const layout = buildLayoutForRole(role);
            return {
                role,
                visible: layout.filter(item => item.visible),
                hidden: layout.filter(item => !item.visible)
            };
        });
    }, [moduleDisplayItems, roleDefaults]);

    const cycleDefault = async (role: Role, feature: string) => {
        if (role === 'admin' || role === 'manager') return; // admin always has full access
        const current = getDefault(role, feature);
        const cycle = role === 'owner' ? (['none', 'read'] as Array<'none' | 'read' | 'edit'>) : ACCESS_CYCLE;
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
                        onClick={() => setView('matrix')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'matrix' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Shield className="h-3.5 w-3.5" /> Role Permissions
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                                        Assign login roles, connect branch users to one branch, and keep supervisor branch scopes visible without hunting through a dense table.
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

                    {users.length === 0 ? (
                        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <UserCog className="mx-auto h-9 w-9 text-slate-300" />
                            <p className="mt-3 text-sm font-black text-slate-800">No login users found</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Create the first login user to start assigning roles and branch scopes.</p>
                        </section>
                    ) : (
                        <section className="min-w-0 space-y-4">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identity roster</p>
                                    <h4 className="mt-1 text-base font-black tracking-tight text-slate-950">Login accounts</h4>
                                </div>
                                <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:w-fit">
                                    {users.length} account{users.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
                                {users.map(user => {
                                    const isSelf = user.userId === currentUserId;
                                    const isSaving = savingKey === user.userId;
                                    const isPermissionsSaving = savingKey === `permissions:${user.userId}`;
                                    const isProtectedAdmin = user.role === 'admin' || user.role === 'manager';
                                    const supervisorBranchIds = supervisorAssignments[user.userId] || [];
                                    const assignedBranches = branchOptions.filter(branch => supervisorBranchIds.includes(branch.id));
                                    const scopeSummary = user.role === 'branch'
                                        ? (user.branchName || 'No branch linked')
                                        : user.role === 'supervisor'
                                            ? `${supervisorBranchIds.length} assigned branch${supervisorBranchIds.length === 1 ? '' : 'es'}`
                                            : user.role === 'driver'
                                                ? 'Driver mobile'
                                                : 'All branches';
                                    const scopeDetail = user.role === 'branch'
                                        ? (user.branchCode ? `Branch code ${user.branchCode}` : 'Branch code not set')
                                        : user.role === 'supervisor'
                                            ? (assignedBranches.length > 0 ? assignedBranches.slice(0, 4).map(branch => branch.code || branch.name).join(', ') : 'No branches assigned yet')
                                            : user.role === 'driver'
                                                ? 'Linked to a delivery driver profile.'
                                                : 'Cross-branch visibility follows this role.';
                                    const roleLocked = isSelf || isSaving || isProtectedAdmin;

                                    return (
                                        <article key={`roster-${user.userId}`} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/5">
                                            <div className="border-b border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-white text-sm font-black uppercase text-brand shadow-sm sm:h-11 sm:w-11">
                                                            {user.email.slice(0, 2)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
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
                                                                onClick={() => handleSupervisorBranches(user)}
                                                                disabled={isSaving}
                                                                title={assignedBranches.map(branch => `${branch.name} (${branch.code})`).join(', ')}
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
                                                        onClick={() => handleSupervisorBranches(user)}
                                                        disabled={isSaving}
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand/30 hover:text-brand"
                                                    >
                                                        <Users className="mr-1 inline h-3.5 w-3.5" />
                                                        {(supervisorAssignments[user.userId] || []).length} branches
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
                            const supervisorBranchIds = supervisorAssignments[user.userId] || [];
                            const assignedBranches = branchOptions.filter(branch => supervisorBranchIds.includes(branch.id));
                            const scopeSummary = user.role === 'branch'
                                ? (user.branchName || 'No branch linked')
                                : user.role === 'supervisor'
                                    ? `${supervisorBranchIds.length} assigned branch${supervisorBranchIds.length === 1 ? '' : 'es'}`
                                    : user.role === 'driver'
                                        ? 'Driver mobile'
                                        : 'All branches';
                            const scopeDetail = user.role === 'branch'
                                ? (user.branchCode ? `Branch code ${user.branchCode}` : 'Branch code not set')
                                : user.role === 'supervisor'
                                    ? (assignedBranches.length > 0 ? assignedBranches.slice(0, 3).map(branch => branch.code || branch.name).join(', ') : 'No branches assigned yet')
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
                                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <label className="min-w-0 space-y-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Login role</span>
                                                <select
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
                                                        onClick={() => handleSupervisorBranches(user)}
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
            ) : (
                <div className="space-y-5">
                    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
                                    <LayoutGrid className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-tight text-slate-950">Module Layout per Role</h3>
                                    <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
                                        Preview what each login role will see in the Operations Modules launcher. Order follows Module Layout; visibility follows module flags and role permissions.
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <Eye className="h-3.5 w-3.5 text-brand" />
                                Live launcher preview
                            </span>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                            {roleModuleLayouts.map(roleLayout => (
                                <article key={roleLayout.role} className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-black leading-5 text-slate-950">{ROLE_LABELS[roleLayout.role]}</p>
                                            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {roleLayout.visible.length} visible
                                            </p>
                                        </div>
                                        <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                                            {roleLayout.visible.length}
                                        </span>
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        {roleLayout.visible.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center">
                                                <EyeOff className="mx-auto h-5 w-5 text-slate-300" />
                                                <p className="mt-2 text-xs font-bold text-slate-400">No modules visible</p>
                                            </div>
                                        ) : roleLayout.visible.map((module, index) => (
                                            <div key={module.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="break-words text-xs font-black leading-5 text-slate-800">{index + 1}. {module.title}</p>
                                                        <p className="mt-0.5 break-all text-[9px] font-black uppercase tracking-widest text-slate-400">{module.key}</p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase ${accessBadgeClass(module.access || 'none')}`}>
                                                        {module.access || 'show'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                <EyeOff className="h-3.5 w-3.5" />
                                                Hidden
                                            </span>
                                            <span className="text-xs font-black tabular-nums text-slate-600">{roleLayout.hidden.length}</span>
                                        </div>
                                        {roleLayout.hidden.length > 0 && (
                                            <p className="mt-1 break-words text-[10px] font-semibold leading-5 text-slate-400" title={roleLayout.hidden.map(item => item.title).join(', ')}>
                                                {roleLayout.hidden.slice(0, 2).map(item => item.title).join(', ')}
                                                {roleLayout.hidden.length > 2 ? ` +${roleLayout.hidden.length - 2} more` : ''}
                                            </p>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                    <p className="text-sm font-medium text-slate-500">
                        Default access per role. Tap a cell to cycle None → Read → Edit. Per-branch overrides (Access tab) win over these defaults. Admin always has full access.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="px-4 py-3">Feature</th>
                                    {ASSIGNABLE_ROLES.map(r => (
                                        <th key={r} className="px-3 py-3 text-center">{ROLE_LABELS[r]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {FEATURE_LABELS.map(feature => (
                                    <tr key={feature.id} className="bg-white">
                                        <td className="px-4 py-3 font-bold text-slate-800">{feature.label}</td>
                                        {ASSIGNABLE_ROLES.map(r => {
                                            const level = getDefault(r, feature.id);
                                            const key = `${r}:${feature.id}`;
                                            return (
                                                <td key={r} className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => cycleDefault(r, feature.id)}
                                                        disabled={r === 'admin' || r === 'manager' || savingKey === key}
                                                        className={`w-16 rounded-md border px-2 py-1.5 text-[10px] font-black uppercase transition-colors ${accessBadgeClass(level)} ${r === 'admin' || r === 'manager' ? 'opacity-60 cursor-not-allowed' : 'hover:border-brand/40'}`}
                                                    >
                                                        {savingKey === key ? '…' : level}
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
        </div>
    );
};
