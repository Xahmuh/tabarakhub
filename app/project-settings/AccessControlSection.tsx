import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Loader2, RefreshCcw, Shield, UserCog, UserPlus, Users } from 'lucide-react';
import { permissionService, branchService } from '../../services';
import { AppUser, Branch, Role, RolePermission } from '../../types';
import { ROLE_LABELS } from '../../lib/access';
import { getEnabledAccessFeatures } from '../../lib/moduleRegistry';

const ASSIGNABLE_ROLES: Role[] = ['manager', 'owner', 'supervisor', 'warehouse', 'branch'];

const FEATURE_LABELS = getEnabledAccessFeatures().map(({ id, label }) => ({ id, label }));

const ACCESS_CYCLE: Array<'none' | 'read' | 'edit'> = ['none', 'read', 'edit'];

const accessBadgeClass = (level: 'none' | 'read' | 'edit') =>
    level === 'edit'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : level === 'read'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-400';

const escapeHtml = (value: string | null | undefined) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

export const AccessControlSection: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [roleDefaults, setRoleDefaults] = useState<RolePermission[]>([]);
    const [supervisorAssignments, setSupervisorAssignments] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [view, setView] = useState<'users' | 'matrix'>('users');

    const branchOptions = useMemo(
        () => branches.filter(b => b.role === 'branch').sort((a, b) => a.name.localeCompare(b.name)),
        [branches]
    );

    const load = async () => {
        setIsLoading(true);
        try {
            const [userList, branchList, defaults] = await Promise.all([
                permissionService.adminListUsers(),
                branchService.list(),
                permissionService.listAllRoleDefaults()
            ]);
            setUsers(userList);
            setBranches(branchList);
            setRoleDefaults(defaults);

            const supervisors = userList.filter(u => u.role === 'supervisor');
            const assignments: Record<string, string[]> = {};
            await Promise.all(supervisors.map(async s => {
                assignments[s.userId] = await permissionService.listSupervisorBranches(s.userId);
            }));
            setSupervisorAssignments(assignments);
        } catch (e: any) {
            Swal.fire('Access Control', e?.message || 'Failed to load users. Only managers can open this panel.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreateUser = async () => {
        const branchOptionsHtml = branchOptions.map(b =>
            `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.code)})</option>`
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
                const supervisorWrap = document.getElementById('swal-new-supervisor-wrap');
                const syncRoleFields = () => {
                    const role = roleInput?.value;
                    branchWrap?.classList.toggle('hidden', role !== 'branch');
                    supervisorWrap?.classList.toggle('hidden', role !== 'supervisor');
                };
                roleInput?.addEventListener('change', syncRoleFields);
                syncRoleFields();
            },
            preConfirm: () => {
                const email = (document.getElementById('swal-new-email') as HTMLInputElement).value.trim().toLowerCase();
                const password = (document.getElementById('swal-new-password') as HTMLInputElement).value;
                const role = (document.getElementById('swal-new-role') as HTMLSelectElement).value as Role;
                const branchId = (document.getElementById('swal-new-branch') as HTMLSelectElement).value || null;
                const isActive = (document.getElementById('swal-new-active') as HTMLInputElement).checked;
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

                return { email, password, role, branchId, supervisorBranchIds, isActive };
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

        setSavingKey(user.userId);
        try {
            await permissionService.adminSetUserRole(user.userId, newRole, branchId, user.isActive);
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

    const getDefault = (role: Role, feature: string): 'none' | 'read' | 'edit' => {
        if (role === 'manager') return 'edit';
        return (roleDefaults.find(p => p.role === role && p.featureName === feature)?.accessLevel as any) || 'none';
    };

    const cycleDefault = async (role: Role, feature: string) => {
        if (role === 'manager') return; // manager always has full access
        const current = getDefault(role, feature);
        const next = ACCESS_CYCLE[(ACCESS_CYCLE.indexOf(current) + 1) % ACCESS_CYCLE.length];
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
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-500">
                        Assign each login a role. Supervisors must be linked to the branches they oversee; branch logins must be linked to one branch.
                        Managers can create new logins here; temporary passwords are shown only while you type them.
                    </p>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
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
                                    return (
                                        <tr key={user.userId} className="bg-white">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-900">{user.email}</p>
                                                {isSelf && <p className="text-[10px] font-bold text-brand">You — role locked</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={user.role}
                                                    disabled={isSelf || isSaving}
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
                                                    disabled={isSelf || isSaving}
                                                    className={`text-xs font-bold ${user.isActive ? 'text-slate-400 hover:text-brand' : 'text-emerald-600 hover:text-emerald-700'} disabled:opacity-40`}
                                                >
                                                    {isSaving ? '…' : user.isActive ? 'Disable' : 'Enable'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="space-y-3 md:hidden">
                        {users.map(user => {
                            const isSelf = user.userId === currentUserId;
                            const isSaving = savingKey === user.userId;
                            return (
                                <div key={user.userId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="min-w-0 truncate text-sm font-bold text-slate-900">{user.email}</p>
                                        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                            {user.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={user.role}
                                            disabled={isSelf || isSaving}
                                            onChange={e => handleRoleChange(user, e.target.value as Role)}
                                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none disabled:opacity-50"
                                        >
                                            {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                            {!ASSIGNABLE_ROLES.includes(user.role) && <option value={user.role}>{ROLE_LABELS[user.role] || user.role}</option>}
                                        </select>
                                        {user.role === 'supervisor' && (
                                            <button onClick={() => handleSupervisorBranches(user)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                                                {(supervisorAssignments[user.userId] || []).length} branches
                                            </button>
                                        )}
                                        {user.role === 'branch' && (
                                            <span className="text-xs font-bold text-slate-500">{user.branchCode || '—'}</span>
                                        )}
                                        <button
                                            onClick={() => handleActiveToggle(user)}
                                            disabled={isSelf || isSaving}
                                            className="ml-auto text-xs font-bold text-slate-400 disabled:opacity-40"
                                        >
                                            {user.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-500">
                        Default access per role. Tap a cell to cycle None → Read → Edit. Per-branch overrides (Access tab) win over these defaults. Managers always have full access.
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
                                                        disabled={r === 'manager' || savingKey === key}
                                                        className={`w-16 rounded-md border px-2 py-1.5 text-[10px] font-black uppercase transition-colors ${accessBadgeClass(level)} ${r === 'manager' ? 'opacity-60 cursor-not-allowed' : 'hover:border-brand/40'}`}
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
