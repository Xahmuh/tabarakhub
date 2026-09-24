/**
 * ============================================================================
 * Control Center Module: Enterprise Multi-Branch Pharmacy Management System
 * Production Service Layer bridging DB, LocalStorage, and UI Components
 * ============================================================================
 */

import { supabaseClient } from '../../../lib/supabaseClient';
import {
  Branch,
  CommercialRegistration,
  Governorate,
  OperationalArea,
  OperationalZone,
  BranchDeliveryZone,
  BranchStaffAssignment,
  BranchStaffRole,
  StaffAssignmentType,
  BranchWithRelations,
  CreateOperationalAreaDTO,
  UpdateOperationalAreaDTO,
  CreateOperationalZoneDTO,
  CreateBranchStaffAssignmentDTO,
  AreaSupervisor
} from '../types';
import { INITIAL_21_CRS, crService } from '../../../services/crService';

const STORAGE_KEYS = {
  AREAS: 'tabarak_control_center_areas',
  ZONES: 'tabarak_control_center_zones',
  STAFF_ASSIGNMENTS: 'tabarak_control_center_staff_assignments',
  BRANCH_DELIVERY_PROFILES: 'tabarak_branch_delivery_profiles',
  SUPERVISORS: 'tabarak_control_center_supervisors',
  BRANCH_AREA_MAPPING: 'tabarak_control_center_branch_area_mapping'
};

// ----------------------------------------------------------------------------
// Initial Seed Data (Kingdom of Bahrain)
// ----------------------------------------------------------------------------

export const INITIAL_SUPERVISORS: AreaSupervisor[] = [
  {
    id: 'a8074b0d-669e-4d4e-8ff3-ab0219e35790',
    name: 'Dr. Abdelrahman Ahmed',
    email: 'a.rahman@tabarak.com',
    title: 'Area 1 Operations & Quality Supervisor',
    role: 'supervisor'
  },
  {
    id: 'b455e337-3202-4835-8d81-508729195268',
    name: 'Dr. Hisham Eldallash',
    email: 'hesham@tabarak.com',
    title: 'Area 2 Operations & Quality Supervisor',
    role: 'supervisor'
  },
  {
    id: '30ffe215-a5c2-44a6-b75c-dcf0ecb9e846',
    name: 'Ahmed Elsherbiinii',
    email: 'ahmedelsherbiinii@gmail.com',
    title: 'System Administrator & General Manager',
    role: 'admin'
  },
  {
    id: 'd24a29b9-52b4-4735-8a7e-6900ae5766b4',
    name: 'Hatem Saad',
    email: 'hatem_saad98@gmail.com',
    title: 'Executive Owner',
    role: 'owner'
  }
];

export const INITIAL_GOVERNORATES: Governorate[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    code: 'CAPITAL',
    name_en: 'Capital Governorate',
    name_ar: 'محافظة العاصمة',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    code: 'MUHARRAQ',
    name_en: 'Muharraq Governorate',
    name_ar: 'محافظة المحرق',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    code: 'NORTHERN',
    name_en: 'Northern Governorate',
    name_ar: 'المحافظة الشمالية',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    code: 'SOUTHERN',
    name_en: 'Southern Governorate',
    name_ar: 'المحافظة الجنوبية',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

export const INITIAL_AREAS: OperationalArea[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    code: 'AREA-1',
    name_en: 'Area 1 (Capital & Northern)',
    name_ar: 'Area 1 (Capital & Northern)',
    supervisor_id: 'a8074b0d-669e-4d4e-8ff3-ab0219e35790', // Dr. Abdelrahman Ahmed (E006)
    description: 'Capital, Manama, Tubli, Jerdab, Budaiya & Northern Coastal dispensaries',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    code: 'AREA-2',
    name_en: 'Area 2 (Muharraq & Southern)',
    name_ar: 'Area 2 (Muharraq & Southern)',
    supervisor_id: 'b455e337-3202-4835-8d81-508729195268', // Dr. Hisham Eldallash (E013)
    description: 'Muharraq, Hidd, Qalali, Riffa, Sanad, Isa Town and Southern dispensaries',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  }
];

export const INITIAL_ZONES: OperationalZone[] = [
  // ── Zones under Area 1 ─────────────────────────────────────
  {
    id: 'a2000000-0000-4000-8000-000000000011',
    area_id: 'a1000000-0000-4000-8000-000000000001',
    code: 'ZONE-1A',
    name_en: 'Zone 1A - Manama & Capital Core',
    name_ar: 'Zone 1A - Manama & Capital Core',
    default_shift_schedule_id: 's0000000-0000-4000-8000-000000000001',
    coverage_parameters: {
      minimum_pharmacists_on_duty: 1,
      rush_hours_overlap_enabled: true,
      has_24h_duty: true
    },
    shift_rules: [
      {
        id: 'shift-1a-1',
        shift_name: 'Morning Shift',
        start_time: '08:00',
        end_time: '16:00',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Standard operational coverage for Manama, Jirdab and Tubli'
      },
      {
        id: 'shift-1a-2',
        shift_name: 'Evening Shift',
        start_time: '16:00',
        end_time: '00:00',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Peak evening coverage and central delivery dispatch'
      },
      {
        id: 'shift-1a-3',
        shift_name: 'Night & 24H Emergency Shift',
        start_time: '00:00',
        end_time: '08:00',
        duration_hours: 8,
        coverage_type: 'full_day_24h',
        notes: 'Continuous 24-hour pharmacy coverage and urgent prescription dispensing'
      }
    ],
    is_active: true,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'a2000000-0000-4000-8000-000000000012',
    area_id: 'a1000000-0000-4000-8000-000000000001',
    code: 'ZONE-1B',
    name_en: 'Zone 1B - Northern Coast & Budaiya',
    name_ar: 'Zone 1B - Northern Coast & Budaiya',
    default_shift_schedule_id: 's0000000-0000-4000-8000-000000000001',
    coverage_parameters: {
      minimum_pharmacists_on_duty: 1,
      friday_coverage_required: true
    },
    shift_rules: [
      {
        id: 'shift-1b-1',
        shift_name: 'Morning Shift',
        start_time: '08:30',
        end_time: '16:30',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Budaiya, Janabiya, Karrana and Dumistan coverage'
      },
      {
        id: 'shift-1b-2',
        shift_name: 'Evening Shift',
        start_time: '16:30',
        end_time: '00:30',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Residential delivery and peak evening service'
      },
      {
        id: 'shift-1b-3',
        shift_name: 'Weekend On-Call Shift',
        start_time: '09:00',
        end_time: '23:00',
        duration_hours: 14,
        coverage_type: 'weekend_on_call',
        notes: 'Friday & Saturday on-call coverage under area supervision'
      }
    ],
    is_active: true,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  },

  // ── Zones under Area 2 ─────────────────────────────────────
  {
    id: 'a2000000-0000-4000-8000-000000000021',
    area_id: 'a1000000-0000-4000-8000-000000000002',
    code: 'ZONE-2A',
    name_en: 'Zone 2A - Muharraq & Airport Hub',
    name_ar: 'Zone 2A - Muharraq & Airport Hub',
    default_shift_schedule_id: 's0000000-0000-4000-8000-000000000002',
    coverage_parameters: {
      minimum_pharmacists_on_duty: 1,
      has_24h_duty: true
    },
    shift_rules: [
      {
        id: 'shift-2a-1',
        shift_name: 'Morning Shift',
        start_time: '08:00',
        end_time: '16:00',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Galali, Hidd and Busaiteen branch stations'
      },
      {
        id: 'shift-2a-2',
        shift_name: 'Evening Shift',
        start_time: '16:00',
        end_time: '00:00',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'High-traffic branches and station coverage'
      },
      {
        id: 'shift-2a-3',
        shift_name: '24H Continuous Service',
        start_time: '00:00',
        end_time: '08:00',
        duration_hours: 8,
        coverage_type: 'full_day_24h',
        notes: 'Galali and Hidd continuous 24/7 service'
      }
    ],
    is_active: true,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'a2000000-0000-4000-8000-000000000022',
    area_id: 'a1000000-0000-4000-8000-000000000002',
    code: 'ZONE-2B',
    name_en: 'Zone 2B - Riffa & Sanad Hub',
    name_ar: 'Zone 2B - Riffa & Sanad Hub',
    default_shift_schedule_id: 's0000000-0000-4000-8000-000000000002',
    coverage_parameters: {
      minimum_pharmacists_on_duty: 1,
      rush_hours_overlap_enabled: true
    },
    shift_rules: [
      {
        id: 'shift-2b-1',
        shift_name: 'Morning Shift',
        start_time: '08:30',
        end_time: '16:30',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'West & East Riffa, Sanad, and Isa Town hubs'
      },
      {
        id: 'shift-2b-2',
        shift_name: 'Evening Shift',
        start_time: '16:30',
        end_time: '00:30',
        duration_hours: 8,
        coverage_type: 'regular',
        notes: 'Home delivery peak hours and clinical dispensing'
      }
    ],
    is_active: true,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  }
];

class ControlCenterService {
  // ── Helper LocalStorage Accessors ──────────────────────────
  private load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Storage fallback
    }
  }

  // ── 1. Operational Areas ───────────────────────────────────
  getAreas(): OperationalArea[] {
    return this.load<OperationalArea[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
  }

  createArea(dto: CreateOperationalAreaDTO): OperationalArea {
    const areas = this.getAreas();
    const newArea: OperationalArea = {
      id: `a1000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
      code: dto.code.trim().toUpperCase(),
      name_en: dto.name_en.trim(),
      name_ar: dto.name_ar.trim(),
      supervisor_id: dto.supervisor_id,
      description: dto.description || null,
      is_active: dto.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const updated = [...areas, newArea];
    this.save(STORAGE_KEYS.AREAS, updated);
    return newArea;
  }

  updateArea(id: string, updates: Partial<OperationalArea>): OperationalArea | null {
    const areas = this.getAreas();
    const idx = areas.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const updatedArea: OperationalArea = {
      ...areas[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    areas[idx] = updatedArea;
    this.save(STORAGE_KEYS.AREAS, areas);

    // Non-blocking background sync with Supabase
    try {
      Promise.resolve(
        supabaseClient
          .from('operational_areas')
          .update({
            code: updatedArea.code,
            name_en: updatedArea.name_en,
            name_ar: updatedArea.name_ar,
            supervisor_id: updatedArea.supervisor_id,
            description: updatedArea.description,
            updated_at: updatedArea.updated_at
          })
          .eq('id', id)
      ).catch(() => {});
    } catch {
      // offline safe
    }

    return updatedArea;
  }

  deleteArea(id: string): boolean {
    const areas = this.getAreas();
    const filtered = areas.filter(a => a.id !== id);
    if (filtered.length === areas.length) return false;
    this.save(STORAGE_KEYS.AREAS, filtered);
    return true;
  }

  // ── 2. Operational Zones & Shift Schedules ─────────────────
  getZones(areaId?: string): OperationalZone[] {
    const allZones = this.load<OperationalZone[]>(STORAGE_KEYS.ZONES, INITIAL_ZONES);
    if (areaId) {
      return allZones.filter(z => z.area_id === areaId);
    }
    return allZones;
  }

  createZone(dto: CreateOperationalZoneDTO): OperationalZone {
    const zones = this.getZones();
    const newZone: OperationalZone = {
      id: `a2000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
      area_id: dto.area_id,
      code: dto.code.trim().toUpperCase(),
      name_en: dto.name_en.trim(),
      name_ar: dto.name_ar.trim(),
      default_shift_schedule_id: dto.default_shift_schedule_id || null,
      coverage_parameters: dto.coverage_parameters || {},
      shift_rules: dto.shift_rules || [],
      is_active: dto.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const updated = [...zones, newZone];
    this.save(STORAGE_KEYS.ZONES, updated);
    return newZone;
  }

  updateZone(id: string, updates: Partial<OperationalZone>): OperationalZone | null {
    const zones = this.getZones();
    const idx = zones.findIndex(z => z.id === id);
    if (idx === -1) return null;
    const updatedZone: OperationalZone = {
      ...zones[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    zones[idx] = updatedZone;
    this.save(STORAGE_KEYS.ZONES, zones);
    return updatedZone;
  }

  updateZoneShiftRules(zoneId: string, shiftRules: any[]): OperationalZone | null {
    return this.updateZone(zoneId, { shift_rules: shiftRules });
  }

  deleteZone(id: string): boolean {
    const zones = this.getZones();
    const filtered = zones.filter(z => z.id !== id);
    if (filtered.length === zones.length) return false;
    this.save(STORAGE_KEYS.ZONES, filtered);
    return true;
  }

  // ── 3. Dynamic Staff Assignments (Pharmacists, Drivers, Workers) ─
  getStaffAssignments(branchId?: string): BranchStaffAssignment[] {
    const all = this.load<BranchStaffAssignment[]>(STORAGE_KEYS.STAFF_ASSIGNMENTS, []);
    if (branchId) {
      return all.filter(sa => sa.branch_id === branchId);
    }
    return all;
  }

  assignStaff(dto: CreateBranchStaffAssignmentDTO): BranchStaffAssignment {
    const assignments = this.getStaffAssignments();
    const newAssignment: BranchStaffAssignment = {
      id: `sa000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
      branch_id: dto.branch_id,
      user_id: dto.user_id,
      role: dto.role,
      assignment_type: dto.assignment_type || 'Primary Base',
      start_date: dto.start_date,
      end_date: dto.end_date || null,
      is_active: dto.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const updated = [...assignments, newAssignment];
    this.save(STORAGE_KEYS.STAFF_ASSIGNMENTS, updated);
    return newAssignment;
  }

  removeStaffAssignment(id: string): boolean {
    const assignments = this.getStaffAssignments();
    const filtered = assignments.filter(sa => sa.id !== id);
    if (filtered.length === assignments.length) return false;
    this.save(STORAGE_KEYS.STAFF_ASSIGNMENTS, filtered);
    return true;
  }

  // ── 4. Async Supabase Synchronization ──────────────────────
  async fetchAreasFromSupabase(): Promise<OperationalArea[]> {
    try {
      const { data, error } = await supabaseClient
        .from('operational_areas')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (!error && data && data.length > 0) {
        this.save(STORAGE_KEYS.AREAS, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase operational_areas read error:', e);
    }
    return this.getAreas();
  }

  async fetchZonesFromSupabase(areaId?: string): Promise<OperationalZone[]> {
    try {
      let query = supabaseClient
        .from('operational_zones')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (areaId) {
        query = query.eq('area_id', areaId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        this.save(STORAGE_KEYS.ZONES, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase operational_zones read error:', e);
    }
    return this.getZones(areaId);
  }

  getZoneShiftRules(zoneCodeOrId: string): any[] {
    const zones = this.getZones();
    const zone = zones.find(z => z.id === zoneCodeOrId || z.code === zoneCodeOrId);
    return zone && Array.isArray(zone.shift_rules) ? zone.shift_rules : [];
  }

  // ── 5. Area Supervisors Management ─────────────────────────
  getSupervisors(): AreaSupervisor[] {
    return this.load<AreaSupervisor[]>(STORAGE_KEYS.SUPERVISORS, INITIAL_SUPERVISORS);
  }

  saveSupervisor(sup: AreaSupervisor): AreaSupervisor {
    const list = this.getSupervisors();
    const existingIdx = list.findIndex(s => s.id === sup.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...sup };
    } else {
      list.push(sup);
    }
    this.save(STORAGE_KEYS.SUPERVISORS, list);
    return sup;
  }

  async fetchLiveSupervisors(): Promise<AreaSupervisor[]> {
    try {
      const { data: users, error: uErr } = await supabaseClient
        .from('app_user_profiles')
        .select('user_id, role, full_name');

      if (uErr || !users) return this.getSupervisors();

      const specialUsers = users.filter((u: any) =>
        ['supervisor', 'admin', 'owner', 'manager'].includes(u.role)
      );

      const localList = this.getSupervisors();
      const map = new Map<string, AreaSupervisor>();
      localList.forEach(s => map.set(s.id, s));

      specialUsers.forEach((u: any) => {
        const existing = map.get(u.user_id);
        if (!existing) {
          map.set(u.user_id, {
            id: u.user_id,
            name: u.full_name || 'System Leader',
            title: u.role === 'supervisor' ? 'Area Supervisor' : (u.role === 'admin' ? 'Administrator' : 'Operations Leader'),
            role: u.role
          });
        }
      });

      const merged = Array.from(map.values());
      this.save(STORAGE_KEYS.SUPERVISORS, merged);
      return merged;
    } catch {
      return this.getSupervisors();
    }
  }

  // ── 6. Branch Area Allocations & Reassignments ─────────────
  getBranchAreaMapping(branches?: Array<{ id: string }>): Record<string, string> {
    const defaultMapping: Record<string, string> = {};
    const areas = this.getAreas();
    const area1Id = areas[0]?.id || 'a1000000-0000-4000-8000-000000000001';
    const area2Id = areas[1]?.id || 'a1000000-0000-4000-8000-000000000002';

    if (branches && branches.length > 0) {
      branches.forEach((b, index) => {
        defaultMapping[b.id] = index < 11 ? area1Id : area2Id;
      });
    }

    return this.load<Record<string, string>>(STORAGE_KEYS.BRANCH_AREA_MAPPING, defaultMapping);
  }

  setBranchArea(branchId: string, areaId: string): void {
    const mapping = this.getBranchAreaMapping();
    mapping[branchId] = areaId;
    this.save(STORAGE_KEYS.BRANCH_AREA_MAPPING, mapping);

    // Non-blocking background sync with Supabase
    try {
      Promise.resolve(
        supabaseClient
          .from('branch_classifications')
          .update({ area_id: areaId, updated_at: new Date().toISOString() })
          .eq('branch_id', branchId)
      ).catch(() => {});
    } catch {
      // offline safe
    }
  }

  batchAssignBranchesToArea(branchIds: string[], areaId: string): void {
    const mapping = this.getBranchAreaMapping();
    branchIds.forEach(id => {
      mapping[id] = areaId;
    });
    this.save(STORAGE_KEYS.BRANCH_AREA_MAPPING, mapping);

    // Non-blocking background sync with Supabase
    try {
      Promise.resolve(
        supabaseClient
          .from('branch_classifications')
          .update({ area_id: areaId, updated_at: new Date().toISOString() })
          .in('branch_id', branchIds)
      ).catch(() => {});
    } catch {
      // offline safe
    }
  }

  async fetchLiveBranchAreaMapping(branches?: Array<{ id: string }>): Promise<Record<string, string>> {
    const localMap = this.getBranchAreaMapping(branches);
    try {
      const { data, error } = await supabaseClient
        .from('branch_classifications')
        .select('branch_id, area_id');

      if (error || !data || data.length === 0) {
        return localMap;
      }

      const merged = { ...localMap };
      data.forEach((row: any) => {
        if (row.branch_id && row.area_id) {
          merged[row.branch_id] = row.area_id;
        }
      });
      this.save(STORAGE_KEYS.BRANCH_AREA_MAPPING, merged);
      return merged;
    } catch {
      return localMap;
    }
  }
}

export const controlCenterService = new ControlCenterService();

