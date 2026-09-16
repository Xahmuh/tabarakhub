import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  permissionService,
  branchService,
  deliveryService,
  pharmacistService
} from '../../services';
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
  UserFeaturePermission
} from '../../types';
import { getSystemSettingsErrorMessage } from '../../services/systemSettingsService';

export interface SupabaseTableHealth {
  table: string;
  count?: number;
  status: 'healthy' | 'error' | 'empty';
  error?: string;
}

export interface SupabaseHealthState {
  isConnected: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  authStatus: 'authenticated' | 'anonymous' | 'error';
  tables: SupabaseTableHealth[];
  isChecking: boolean;
}

export const useControlCenter = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchClassifications, setBranchClassifications] = useState<BranchClassification[]>([]);
  const [zones, setZones] = useState<BranchZone[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [branchStaffAssignments, setBranchStaffAssignments] = useState<BranchStaffAssignment[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RolePermission[]>([]);
  const [supervisorAssignments, setSupervisorAssignments] = useState<Record<string, string[]>>({});
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings | null>(null);
  const [maintenanceSettingsError, setMaintenanceSettingsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const [healthState, setHealthState] = useState<SupabaseHealthState>({
    isConnected: true,
    latencyMs: null,
    lastCheckedAt: null,
    authStatus: 'authenticated',
    tables: [],
    isChecking: false
  });

  useEffect(() => {
    supabase.client.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id);
    });
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthState(prev => ({ ...prev, isChecking: true }));
    const startTime = performance.now();
    try {
      const coreTables = ['branches', 'pharmacists', 'system_settings', 'branch_zones', 'delivery_drivers'];
      const tableResults: SupabaseTableHealth[] = [];

      for (const table of coreTables) {
        try {
          const { count, error: tableErr } = await supabase.client
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (tableErr) {
            tableResults.push({ table, status: 'error', error: tableErr.message });
          } else {
            tableResults.push({
              table,
              count: count ?? 0,
              status: (count ?? 0) > 0 ? 'healthy' : 'empty'
            });
          }
        } catch (e: any) {
          tableResults.push({ table, status: 'error', error: e?.message || 'Check failed' });
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      setHealthState({
        isConnected: true,
        latencyMs: elapsed,
        lastCheckedAt: new Date().toISOString(),
        authStatus: 'authenticated',
        tables: tableResults,
        isChecking: false
      });
    } catch (e: any) {
      setHealthState(prev => ({
        ...prev,
        isConnected: false,
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        authStatus: 'error',
        isChecking: false
      }));
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMaintenanceSettingsError(null);
    try {
      const [
        userList,
        branchList,
        defaults,
        driverList,
        zoneList,
        pharmacistList,
        staffAssignments,
        classifications
      ] = await Promise.all([
        permissionService.adminListUsers().catch(() => [] as AppUser[]),
        branchService.list().catch(() => [] as Branch[]),
        permissionService.listAllRoleDefaults().catch(() => [] as RolePermission[]),
        deliveryService.drivers.list(true).catch(() => [] as DeliveryDriver[]),
        permissionService.listBranchZones().catch(() => [] as BranchZone[]),
        pharmacistService.listAll().catch(() => [] as Pharmacist[]),
        permissionService.listBranchStaffAssignments().catch(() => [] as BranchStaffAssignment[]),
        supabase.delivery.classifications.list().catch(() => [] as BranchClassification[])
      ]);

      setUsers(userList);
      setBranches(branchList);
      setRoleDefaults(defaults);
      setDrivers(driverList);
      setZones(zoneList);
      setPharmacists(pharmacistList);
      setBranchStaffAssignments(staffAssignments);
      setBranchClassifications(classifications);

      const supervisors = userList.filter(u => u.role === 'supervisor');
      const assignments: Record<string, string[]> = {};
      supervisors.forEach(s => {
        assignments[s.userId] = zoneList
          .filter(zone => zone.supervisorUserId === s.userId)
          .map(zone => zone.id);
      });
      setSupervisorAssignments(assignments);

      try {
        const settings = await supabase.systemSettings.getMaintenanceSettings();
        setMaintenanceSettings(settings);
      } catch (settingsErr) {
        setMaintenanceSettings(null);
        setMaintenanceSettingsError(getSystemSettingsErrorMessage(settingsErr));
      }
    } catch (err: any) {
      console.error('Error loading Control Center data:', err);
      setError(err?.message || 'Failed to load control center records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Optimistic Role Update
  const handleOptimisticRoleChange = useCallback(
    async (user: AppUser, newRole: Role, branchId?: string | null, driverId?: string | null) => {
      const originalUsers = [...users];
      const targetBranch = branches.find(b => b.id === branchId);

      // Optimistically update
      setUsers(prev =>
        prev.map(u =>
          u.userId === user.userId
            ? {
                ...u,
                role: newRole,
                branchId: branchId || null,
                branchCode: targetBranch?.code || null,
                branchName: targetBranch?.name || null
              }
            : u
        )
      );

      setSavingKey(user.userId);
      try {
        await permissionService.adminSetUserRole(
          user.userId,
          newRole,
          newRole === 'branch' ? branchId || null : null,
          user.isActive
        );
        if (newRole === 'driver' && driverId) {
          await permissionService.adminLinkDriverUser(user.userId, driverId);
        }
      } catch (err) {
        // Rollback
        setUsers(originalUsers);
        throw err;
      } finally {
        setSavingKey(null);
      }
    },
    [branches, users]
  );

  // Optimistic Active Toggle
  const handleOptimisticActiveToggle = useCallback(
    async (user: AppUser) => {
      const originalUsers = [...users];
      const nextActive = !user.isActive;

      setUsers(prev =>
        prev.map(u => (u.userId === user.userId ? { ...u, isActive: nextActive } : u))
      );

      setSavingKey(user.userId);
      try {
        await permissionService.adminSetUserRole(
          user.userId,
          user.role,
          user.role === 'branch' ? user.branchId || null : null,
          nextActive
        );
      } catch (err) {
        setUsers(originalUsers);
        throw err;
      } finally {
        setSavingKey(null);
      }
    },
    [users]
  );

  // Optimistic User Permissions Save
  const handleOptimisticSaveUserPermissions = useCallback(
    async (userId: string, permissions: Array<{ featureName: string; accessLevel: 'none' | 'read' | 'edit' }>) => {
      setSavingKey(`permissions:${userId}`);
      try {
        await permissionService.replaceUserPermissions(userId, permissions);
      } finally {
        setSavingKey(null);
      }
    },
    []
  );

  // Optimistic Role Default Cycle
  const handleOptimisticCycleRoleDefault = useCallback(
    async (role: Role, featureName: string) => {
      if (role === 'admin' || role === 'manager') return;

      const current =
        roleDefaults.find(p => p.role === role && p.featureName === featureName)?.accessLevel ||
        'none';
      const cycle: Array<'none' | 'read' | 'edit'> = ['none', 'read', 'edit'];
      const next = cycle[(cycle.indexOf(current as any) + 1) % cycle.length];
      const key = `${role}:${featureName}`;

      const originalDefaults = [...roleDefaults];

      setRoleDefaults(prev => {
        const idx = prev.findIndex(p => p.role === role && p.featureName === featureName);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], accessLevel: next };
          return updated;
        }
        return [...prev, { role, featureName, accessLevel: next }];
      });

      setSavingKey(key);
      try {
        await permissionService.upsertRoleDefault(role, featureName, next);
      } catch (err) {
        setRoleDefaults(originalDefaults);
        throw err;
      } finally {
        setSavingKey(null);
      }
    },
    [roleDefaults]
  );

  return {
    users,
    setUsers,
    branches,
    setBranches,
    branchClassifications,
    zones,
    setZones,
    drivers,
    setDrivers,
    pharmacists,
    setPharmacists,
    branchStaffAssignments,
    setBranchStaffAssignments,
    roleDefaults,
    setRoleDefaults,
    supervisorAssignments,
    setSupervisorAssignments,
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
    reload: loadData,
    handleOptimisticRoleChange,
    handleOptimisticActiveToggle,
    handleOptimisticSaveUserPermissions,
    handleOptimisticCycleRoleDefault
  };
};
