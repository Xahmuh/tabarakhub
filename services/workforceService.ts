import { supabaseClient } from '../lib/supabaseClient';

export type StaffCategory = 'Pharmacist' | 'Driver' | 'Worker' | 'Management';
export type StaffStatus = 'Active' | 'Inactive' | 'OnLeave';

export interface EmployeeBranchAssignment {
  id?: string;
  employee_id?: string;
  branch_id: string;
  branch_name?: string;
  lat?: number;
  lng?: number;
  geofence_radius_meters: number;
  is_primary: boolean;
}

export interface EmployeeSalaryMatrix {
  // EMPLOYEE DATA & CR
  company?: string;
  cr?: string;
  expatCpr?: string;
  expatPp?: string;
  expatPpExpiryDate?: string; // PP Expiry Date (Passport Expiry Date)
  ppExpiryDate?: string;      // Alias for PP Expiry Date
  wpExpiryDate?: string;       // WP Expiry Date (Work Permit / Visa Expiry Date)
  visaExpiryDate?: string;    // Alias for WP Expiry Date
  gender?: 'Male' | 'Female';
  visaType?: 'Internal' | 'Flexi';
  nationality?: string;

  // PHARMACIST LICENSING
  nhraLicenseNo?: string;
  nhraExpiryDate?: string;

  // FINANCIAL DATA
  iban?: string;
  totalSalary?: number;

  // FIXED SALARY
  basicSalary?: number;
  housing?: number;
  transportation?: number;
  totalFixed?: number; // basic + housing + transportation

  // VARIABLE SALARY
  jobResponsibilityBonus?: number; // Job responsibility / Retention bonus
  longShiftIncentive?: number;
  totalVariable?: number; // responsibility bonus + long shift incentive

  // DEDUCTIONS
  gosi1Pct?: number; // 1% GOSI / SIO deduction
  ewaFees?: number;
  othersDeduction?: number;
  payrollDedLoan?: number; // Loan deduction
  totalDeductions?: number;

  // NET SALARY
  netSalary?: number;
}

export interface Employee {
  id: string;
  code: string;
  full_name: string;
  category: StaffCategory;
  cpr_number?: string;
  passport_number?: string;
  passport_expiry_date?: string;
  wp_expiry_date?: string;
  phone?: string;
  email?: string;
  gender?: 'Male' | 'Female';
  visa_type?: 'Internal' | 'Flexi';
  nationality?: string;
  status: StaffStatus;
  notes?: string;
  driver_id?: string;
  pharmacist_id?: string;
  assigned_vehicles?: string[]; // Fleet motorcycles / bike numbers e.g. ["M-101", "M-102"]
  salary_matrix?: EmployeeSalaryMatrix;
  created_at?: string;
  updated_at?: string;
  assignments?: EmployeeBranchAssignment[];
  registered_fingerprint?: string | null;
  device_fingerprint?: string | null;
}

export const CATEGORY_PREFIXES: Record<StaffCategory, string> = {
  Pharmacist: 'E',
  Driver: 'D',
  Worker: 'W',
  Management: 'M'
};

// Local storage keys
const LOCAL_STORAGE_KEY = 'tabarak_hr_workforce_directory_v1';
const DELETED_STORAGE_KEY = 'tabarak_hr_workforce_deleted_ids_v1';

const getInitialDemoEmployees = (): Employee[] => [
  {
    id: 'emp-101',
    code: 'E001',
    full_name: 'Dr. Ali Hassan',
    category: 'Pharmacist',
    cpr_number: '910284712',
    phone: '+973 39123456',
    email: 'ali.hassan@tabarak.com',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'Senior Pharmacist',
    registered_fingerprint: 'FP-E001-948A',
    device_fingerprint: 'FP-E001-948A',
    assignments: [
      { branch_id: 'B1', branch_name: 'Main Pharmacy - Manama', lat: 26.2285, lng: 50.5860, geofence_radius_meters: 50, is_primary: true }
    ],
    salary_matrix: {
      nationality: 'Egyptian / مصري',
      basicSalary: 180,
      housing: 40,
      transportation: 20,
      jobResponsibilityBonus: 60,
      totalSalary: 300,
      expatCpr: '910284712',
      expatPp: 'A29381726',
      expatPpExpiryDate: '2028-06-30',
      ppExpiryDate: '2028-06-30',
      wpExpiryDate: '2026-12-31',
      visaExpiryDate: '2026-12-31',
      nhraLicenseNo: 'NHRA/PH/2021/3941',
      company: 'Tabarak Pharmacy CO W.L.L',
      cr: '127506-01'
    }
  },
  {
    id: 'emp-102',
    code: 'D001',
    full_name: 'Mohamed Ahmed',
    category: 'Driver',
    cpr_number: '880193812',
    phone: '+973 36554433',
    email: 'm.ahmed@tabarak.com',
    nationality: 'Bahraini / بحريني',
    status: 'Active',
    notes: 'Express Delivery Driver',
    assigned_vehicles: ['654321', '123456'],
    registered_fingerprint: 'FP-D001-381C',
    device_fingerprint: 'FP-D001-381C',
    assignments: [
      { branch_id: 'B1', branch_name: 'Main Pharmacy - Manama', lat: 26.2285, lng: 50.5860, geofence_radius_meters: 100, is_primary: true },
      { branch_id: 'B2', branch_name: 'Riffa Branch', lat: 26.1300, lng: 50.5550, geofence_radius_meters: 100, is_primary: false }
    ],
    salary_matrix: {
      nationality: 'Bahraini / بحريني',
      basicSalary: 120,
      housing: 20,
      transportation: 10,
      totalSalary: 150,
      expatCpr: '880193812',
      company: 'Tabarak Pharmacy CO W.L.L',
      cr: '127506-01'
    }
  },
  {
    id: 'emp-103',
    code: 'W001',
    full_name: 'Suresh Kumar',
    category: 'Worker',
    cpr_number: '951239841',
    phone: '+973 33221100',
    nationality: 'Indian / هندي',
    status: 'Active',
    notes: 'Pharmacy Assistant & Stock Handler',
    assigned_vehicles: ['987654'],
    assignments: [
      { branch_id: 'B1', branch_name: 'Main Pharmacy - Manama', lat: 26.2285, lng: 50.5860, geofence_radius_meters: 50, is_primary: true }
    ],
    salary_matrix: {
      nationality: 'Indian / هندي',
      basicSalary: 90,
      housing: 15,
      transportation: 5,
      totalSalary: 110,
      expatCpr: '951239841',
      expatPp: 'K81920481',
      expatPpExpiryDate: '2027-11-15',
      ppExpiryDate: '2027-11-15',
      wpExpiryDate: '2026-10-15',
      visaExpiryDate: '2026-10-15',
      company: 'Tabarak Pharmacy CO W.L.L',
      cr: '127506-01'
    }
  },
  {
    id: 'emp-104',
    code: 'M001',
    full_name: 'Tariq Al-Mansoor',
    category: 'Management',
    cpr_number: '840192841',
    phone: '+973 39998877',
    email: 'tariq.mansoor@tabarak.com',
    nationality: 'Bahraini / بحريني',
    status: 'Active',
    notes: 'Operations & HR Director',
    assignments: [
      { branch_id: 'B1', branch_name: 'Main Pharmacy - Manama', lat: 26.2285, lng: 50.5860, geofence_radius_meters: 200, is_primary: true },
      { branch_id: 'B2', branch_name: 'Riffa Branch', lat: 26.1300, lng: 50.5550, geofence_radius_meters: 200, is_primary: false }
    ],
    salary_matrix: {
      nationality: 'Bahraini / بحريني',
      basicSalary: 250,
      housing: 50,
      transportation: 30,
      jobResponsibilityBonus: 70,
      totalSalary: 400,
      expatCpr: '840192841',
      company: 'Tabarak Pharmacy CO W.L.L',
      cr: '127506-01'
    }
  }
];

export const workforceService = {
  getDeletedIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  },

  markAsDeleted(identifiers: (string | undefined | null)[]) {
    if (typeof window === 'undefined') return;
    const current = this.getDeletedIds();
    identifiers.forEach(id => {
      if (id) {
        current.add(String(id));
        current.add(String(id).toUpperCase());
        current.add(String(id).toLowerCase());
      }
    });
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(current)));
  },

  unmarkDeleted(identifiers: (string | undefined | null)[]) {
    if (typeof window === 'undefined') return;
    const current = this.getDeletedIds();
    let changed = false;
    identifiers.forEach(id => {
      if (id) {
        const s = String(id);
        if (current.has(s)) { current.delete(s); changed = true; }
        if (current.has(s.toUpperCase())) { current.delete(s.toUpperCase()); changed = true; }
        if (current.has(s.toLowerCase())) { current.delete(s.toLowerCase()); changed = true; }
      }
    });
    if (changed) {
      localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(current)));
    }
  },

  generateNextCode(category: StaffCategory, existing: Employee[]): string {
    const prefix = CATEGORY_PREFIXES[category] || 'W';
    let maxNum = 0;
    existing.forEach(emp => {
      if (emp.code && emp.code.toUpperCase().startsWith(prefix)) {
        const numPart = parseInt(emp.code.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  },

  async syncExternalStaff(baseEmployees: Employee[]): Promise<Employee[]> {
    const list = [...baseEmployees];
    const existingDriverIds = new Set(
      list
        .map(e => e.driver_id || (e.id.startsWith('drv-') ? e.id.replace('drv-', '') : null))
        .filter(Boolean)
    );
    const existingPharmacistIds = new Set(
      list
        .map(e => e.pharmacist_id || (e.id.startsWith('phm-') ? e.id.replace('phm-', '') : null))
        .filter(Boolean)
    );
    const existingNames = new Set(list.map(e => e.full_name.trim().toLowerCase()));

    // 1. Fetch external drivers from delivery_drivers table
    try {
      const { data: drivers } = await supabaseClient.from('delivery_drivers').select('*');
      if (drivers && drivers.length > 0) {
        drivers.forEach((d: any) => {
          const nameTrim = (d.name || '').trim();
          if (nameTrim && !existingDriverIds.has(String(d.id)) && !existingNames.has(nameTrim.toLowerCase())) {
            const code = d.driver_code || this.generateNextCode('Driver', list);
            const newEmp: Employee = {
              id: `drv-${d.id}`,
              code,
              full_name: nameTrim,
              category: 'Driver',
              phone: d.phone || undefined,
              status: d.is_active !== false ? 'Active' : 'Inactive',
              notes: d.notes || 'سائق توصيل مسجل بالنظام',
              driver_id: String(d.id),
              assignments: []
            };
            list.push(newEmp);
            existingDriverIds.add(String(d.id));
            existingNames.add(nameTrim.toLowerCase());
          }
        });
      }
    } catch (e) {
      console.warn('Driver sync skipped:', e);
    }

    // 2. Fetch external pharmacists from pharmacists table
    try {
      const { data: pharmacists } = await supabaseClient.from('pharmacists').select('*');
      if (pharmacists && pharmacists.length > 0) {
        pharmacists.forEach((p: any) => {
          const nameTrim = (p.name || '').trim();
          if (nameTrim && !existingPharmacistIds.has(String(p.id)) && !existingNames.has(nameTrim.toLowerCase())) {
            const code = p.code || this.generateNextCode('Pharmacist', list);
            const newEmp: Employee = {
              id: `phm-${p.id}`,
              code,
              full_name: nameTrim,
              category: 'Pharmacist',
              status: p.is_active !== false ? 'Active' : 'Inactive',
              notes: 'صيدلي مسجل بالنظام',
              pharmacist_id: String(p.id),
              assignments: []
            };
            list.push(newEmp);
            existingPharmacistIds.add(String(p.id));
            existingNames.add(nameTrim.toLowerCase());
          }
        });
      }
    } catch (e) {
      console.warn('Pharmacist sync skipped:', e);
    }

    return list;
  },

  async getAllEmployees(): Promise<Employee[]> {
    let baseEmployees: Employee[] = [];
    try {
      const { data: employeesData, error: empError } = await supabaseClient
        .from('employees')
        .select('*')
        .order('code', { ascending: true });

      if (!empError && employeesData) {
        const { data: assignmentsData } = await supabaseClient
          .from('employee_branch_assignments')
          .select('*');

        const assignmentsMap: Record<string, EmployeeBranchAssignment[]> = {};
        if (assignmentsData) {
          assignmentsData.forEach((asg: any) => {
            if (!assignmentsMap[asg.employee_id]) {
              assignmentsMap[asg.employee_id] = [];
            }
            assignmentsMap[asg.employee_id].push({
              id: asg.id,
              employee_id: asg.employee_id,
              branch_id: asg.branch_id,
              branch_name: asg.branch_name,
              lat: asg.lat ? parseFloat(asg.lat) : undefined,
              lng: asg.lng ? parseFloat(asg.lng) : undefined,
              geofence_radius_meters: asg.geofence_radius_meters || 50,
              is_primary: Boolean(asg.is_primary)
            });
          });
        }

        baseEmployees = employeesData.map((emp: any) => ({
          id: emp.id,
          code: emp.code,
          full_name: emp.full_name,
          category: emp.category,
          cpr_number: emp.cpr_number,
          passport_number: emp.passport_number || emp.salary_matrix?.expatPp || undefined,
          passport_expiry_date: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate || undefined,
          wp_expiry_date: emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate || undefined,
          phone: emp.phone,
          email: emp.email,
          gender: emp.gender,
          visa_type: emp.visa_type,
          nationality: emp.nationality || emp.salary_matrix?.nationality || undefined,
          status: emp.status || 'Active',
          notes: emp.notes,
          driver_id: emp.driver_id,
          pharmacist_id: emp.pharmacist_id,
          assigned_vehicles: Array.isArray(emp.assigned_vehicles) ? emp.assigned_vehicles : (emp.assigned_vehicles ? String(emp.assigned_vehicles).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
          salary_matrix: emp.salary_matrix ? {
            ...emp.salary_matrix,
            expatPpExpiryDate: emp.salary_matrix.expatPpExpiryDate || emp.salary_matrix.ppExpiryDate || emp.passport_expiry_date || undefined,
            ppExpiryDate: emp.salary_matrix.ppExpiryDate || emp.salary_matrix.expatPpExpiryDate || emp.passport_expiry_date || undefined,
            wpExpiryDate: emp.salary_matrix.wpExpiryDate || emp.salary_matrix.visaExpiryDate || emp.wp_expiry_date || undefined,
            visaExpiryDate: emp.salary_matrix.visaExpiryDate || emp.salary_matrix.wpExpiryDate || emp.wp_expiry_date || undefined,
            nationality: emp.salary_matrix.nationality || emp.nationality || undefined
          } : undefined,
          created_at: emp.created_at,
          updated_at: emp.updated_at,
          assignments: assignmentsMap[emp.id] || []
        }));
      }
    } catch (e) {
      console.warn('Employees table fetch skipped:', e);
    }

    // Merge local storage records, giving precedence to local updates
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      try {
        const localList: Employee[] = JSON.parse(rawLocal);
        const map = new Map<string, Employee>();
        baseEmployees.forEach(e => map.set(e.id, e));
        localList.forEach(e => {
          const mergedNat = e.nationality || e.salary_matrix?.nationality;
          map.set(e.id, {
            ...e,
            passport_number: e.passport_number || e.salary_matrix?.expatPp || map.get(e.id)?.passport_number,
            passport_expiry_date: e.passport_expiry_date || e.salary_matrix?.expatPpExpiryDate || e.salary_matrix?.ppExpiryDate || map.get(e.id)?.passport_expiry_date,
            wp_expiry_date: e.wp_expiry_date || e.salary_matrix?.wpExpiryDate || e.salary_matrix?.visaExpiryDate || map.get(e.id)?.wp_expiry_date,
            nationality: mergedNat || (map.get(e.id)?.nationality),
            salary_matrix: e.salary_matrix ? {
              ...e.salary_matrix,
              expatPpExpiryDate: e.salary_matrix.expatPpExpiryDate || e.salary_matrix.ppExpiryDate || e.passport_expiry_date || (map.get(e.id)?.salary_matrix?.expatPpExpiryDate),
              ppExpiryDate: e.salary_matrix.ppExpiryDate || e.salary_matrix.expatPpExpiryDate || e.passport_expiry_date || (map.get(e.id)?.salary_matrix?.ppExpiryDate),
              wpExpiryDate: e.salary_matrix.wpExpiryDate || e.salary_matrix.visaExpiryDate || e.wp_expiry_date || (map.get(e.id)?.salary_matrix?.wpExpiryDate),
              visaExpiryDate: e.salary_matrix.visaExpiryDate || e.salary_matrix.wpExpiryDate || e.wp_expiry_date || (map.get(e.id)?.salary_matrix?.visaExpiryDate),
              nationality: mergedNat || e.salary_matrix.nationality || (map.get(e.id)?.salary_matrix?.nationality)
            } : map.get(e.id)?.salary_matrix
          });
        });
        baseEmployees = Array.from(map.values());
      } catch (e) {
        console.error(e);
      }
    } else if (baseEmployees.length === 0) {
      baseEmployees = getInitialDemoEmployees();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(baseEmployees));
    }

    const syncedList = await this.syncExternalStaff(baseEmployees);
    const deletedSet = this.getDeletedIds();
    if (deletedSet.size === 0) return syncedList;

    return syncedList.filter(e => {
      if (deletedSet.has(e.id) || deletedSet.has(e.id.toLowerCase())) return false;
      if (e.code && (deletedSet.has(e.code) || deletedSet.has(e.code.toUpperCase()))) return false;
      if (e.driver_id && (deletedSet.has(e.driver_id) || deletedSet.has(`drv-${e.driver_id}`))) return false;
      if (e.pharmacist_id && (deletedSet.has(e.pharmacist_id) || deletedSet.has(`phm-${e.pharmacist_id}`))) return false;
      return true;
    });
  },

  async saveEmployee(
    emp: Partial<Employee> & { full_name: string; category: StaffCategory },
    assignments: EmployeeBranchAssignment[] = []
  ): Promise<Employee> {
    const isEdit = Boolean(emp.id);
    let savedEmp: Employee | null = null;

    const empId = emp.id || `emp-${Date.now()}`;
    const finalCode = emp.code || 'W001';

    let driverId = emp.driver_id || (emp.id?.startsWith('drv-') ? emp.id.replace('drv-', '') : undefined);
    let pharmacistId = emp.pharmacist_id || (emp.id?.startsWith('phm-') ? emp.id.replace('phm-', '') : undefined);

    // 1. Try syncing with delivery_drivers table if Driver
    if (emp.category === 'Driver') {
      try {
        const payload: any = {
          name: emp.full_name,
          phone: emp.phone || null,
          notes: `Synced from HR Master Directory [${finalCode}]`,
          is_active: emp.status === 'Active'
        };
        if (driverId) payload.id = driverId;

        const { data: driverRow } = await supabaseClient
          .from('delivery_drivers')
          .upsert(payload)
          .select()
          .maybeSingle();

        if (driverRow) {
          driverId = String(driverRow.id);
        }
      } catch (e) {
        console.warn('Driver table upsert ignored:', e);
      }
    }

    // 2. Try syncing with pharmacists table if Pharmacist
    if (emp.category === 'Pharmacist') {
      try {
        const payload: any = {
          code: finalCode,
          name: emp.full_name,
          is_active: emp.status === 'Active'
        };
        if (pharmacistId) payload.id = pharmacistId;

        const { data: pharmRow } = await supabaseClient
          .from('pharmacists')
          .upsert(payload)
          .select()
          .maybeSingle();

        if (pharmRow) {
          pharmacistId = String(pharmRow.id);
        }
      } catch (e) {
        console.warn('Pharmacist table upsert ignored:', e);
      }
    }

    // 3. Try saving to employees table in Supabase
    try {
      const isInactiveStatus = emp.status && emp.status !== 'Active';
      const assignedVehiclesToSave = isInactiveStatus ? [] : (emp.assigned_vehicles || []);

      const payload = {
        code: finalCode,
        full_name: emp.full_name,
        category: emp.category,
        cpr_number: emp.cpr_number || null,
        passport_number: emp.passport_number || emp.salary_matrix?.expatPp || null,
        passport_expiry_date: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate || null,
        wp_expiry_date: emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate || null,
        phone: emp.phone || null,
        email: emp.email || null,
        gender: emp.gender || null,
        visa_type: emp.visa_type || null,
        nationality: emp.nationality || emp.salary_matrix?.nationality || null,
        status: emp.status || 'Active',
        notes: emp.notes || null,
        driver_id: driverId || null,
        pharmacist_id: pharmacistId || null,
        assigned_vehicles: assignedVehiclesToSave,
        salary_matrix: emp.salary_matrix ? {
          ...emp.salary_matrix,
          expatPpExpiryDate: emp.salary_matrix.expatPpExpiryDate || emp.salary_matrix.ppExpiryDate || emp.passport_expiry_date || undefined,
          ppExpiryDate: emp.salary_matrix.ppExpiryDate || emp.salary_matrix.expatPpExpiryDate || emp.passport_expiry_date || undefined,
          wpExpiryDate: emp.salary_matrix.wpExpiryDate || emp.salary_matrix.visaExpiryDate || emp.wp_expiry_date || undefined,
          visaExpiryDate: emp.salary_matrix.visaExpiryDate || emp.salary_matrix.wpExpiryDate || emp.wp_expiry_date || undefined,
          nationality: emp.nationality || emp.salary_matrix.nationality || undefined
        } : null,
        updated_at: new Date().toISOString()
      };

      if (isEdit && emp.id && !emp.id.startsWith('emp-') && !emp.id.startsWith('drv-') && !emp.id.startsWith('phm-')) {
        const { data, error } = await supabaseClient
          .from('employees')
          .update(payload)
          .eq('id', emp.id)
          .select()
          .maybeSingle();
        if (!error && data) {
          savedEmp = {
            ...data,
            passport_number: emp.passport_number || emp.salary_matrix?.expatPp || data.passport_number,
            passport_expiry_date: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || data.passport_expiry_date,
            wp_expiry_date: emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || data.wp_expiry_date,
            nationality: emp.nationality || emp.salary_matrix?.nationality || data.nationality,
            assigned_vehicles: emp.assigned_vehicles || data.assigned_vehicles || [],
            salary_matrix: emp.salary_matrix ? {
              ...emp.salary_matrix,
              expatPpExpiryDate: emp.salary_matrix.expatPpExpiryDate || emp.salary_matrix.ppExpiryDate || emp.passport_expiry_date || undefined,
              ppExpiryDate: emp.salary_matrix.ppExpiryDate || emp.salary_matrix.expatPpExpiryDate || emp.passport_expiry_date || undefined,
              wpExpiryDate: emp.salary_matrix.wpExpiryDate || emp.salary_matrix.visaExpiryDate || emp.wp_expiry_date || undefined,
              visaExpiryDate: emp.salary_matrix.visaExpiryDate || emp.salary_matrix.wpExpiryDate || emp.wp_expiry_date || undefined,
              nationality: emp.nationality || emp.salary_matrix.nationality || undefined
            } : undefined,
            assignments
          };
        }
      } else {
        const { data, error } = await supabaseClient
          .from('employees')
          .insert(payload)
          .select()
          .maybeSingle();
        if (!error && data) {
          savedEmp = {
            ...data,
            passport_number: emp.passport_number || emp.salary_matrix?.expatPp || data.passport_number,
            passport_expiry_date: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || data.passport_expiry_date,
            wp_expiry_date: emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || data.wp_expiry_date,
            nationality: emp.nationality || emp.salary_matrix?.nationality || data.nationality,
            assigned_vehicles: emp.assigned_vehicles || data.assigned_vehicles || [],
            salary_matrix: emp.salary_matrix ? {
              ...emp.salary_matrix,
              expatPpExpiryDate: emp.salary_matrix.expatPpExpiryDate || emp.salary_matrix.ppExpiryDate || emp.passport_expiry_date || undefined,
              ppExpiryDate: emp.salary_matrix.ppExpiryDate || emp.salary_matrix.expatPpExpiryDate || emp.passport_expiry_date || undefined,
              wpExpiryDate: emp.salary_matrix.wpExpiryDate || emp.salary_matrix.visaExpiryDate || emp.wp_expiry_date || undefined,
              visaExpiryDate: emp.salary_matrix.visaExpiryDate || emp.salary_matrix.wpExpiryDate || emp.wp_expiry_date || undefined,
              nationality: emp.nationality || emp.salary_matrix.nationality || undefined
            } : undefined,
            assignments
          };
        }
      }
    } catch (e) {
      console.warn('Employees table write failed:', e);
    }

    // 4. Always update Local Storage as fallback / backup guarantee
    const newRecord: Employee = savedEmp || {
      id: empId,
      code: finalCode,
      full_name: emp.full_name,
      category: emp.category,
      cpr_number: emp.cpr_number,
      passport_number: emp.passport_number || emp.salary_matrix?.expatPp,
      passport_expiry_date: emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate,
      wp_expiry_date: emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate,
      phone: emp.phone,
      email: emp.email,
      gender: emp.gender,
      visa_type: emp.visa_type,
      nationality: emp.nationality || emp.salary_matrix?.nationality || undefined,
      status: emp.status || 'Active',
      notes: emp.notes,
      driver_id: driverId,
      pharmacist_id: pharmacistId,
      assigned_vehicles: emp.assigned_vehicles || [],
      salary_matrix: emp.salary_matrix ? {
        ...emp.salary_matrix,
        expatPpExpiryDate: emp.salary_matrix.expatPpExpiryDate || emp.salary_matrix.ppExpiryDate || emp.passport_expiry_date || undefined,
        ppExpiryDate: emp.salary_matrix.ppExpiryDate || emp.salary_matrix.expatPpExpiryDate || emp.passport_expiry_date || undefined,
        wpExpiryDate: emp.salary_matrix.wpExpiryDate || emp.salary_matrix.visaExpiryDate || emp.wp_expiry_date || undefined,
        visaExpiryDate: emp.salary_matrix.visaExpiryDate || emp.salary_matrix.wpExpiryDate || emp.wp_expiry_date || undefined,
        nationality: emp.nationality || emp.salary_matrix.nationality || undefined
      } : undefined,
      assignments
    };

    // Clear any deletion flag if re-saving this employee
    this.unmarkDeleted([emp.id, finalCode, driverId, pharmacistId]);

    const currentRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let currentList: Employee[] = currentRaw ? JSON.parse(currentRaw) : [];
    const exists = currentList.some(e => e.id === newRecord.id);
    if (exists) {
      currentList = currentList.map(e => (e.id === newRecord.id ? newRecord : e));
    } else {
      currentList = [newRecord, ...currentList];
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentList));

    return newRecord;
  },

  async deleteEmployee(id: string, emp?: Employee): Promise<boolean> {
    const idsToMark = [
      id,
      emp?.id,
      emp?.code,
      emp?.driver_id,
      emp?.pharmacist_id,
      id.startsWith('drv-') ? id.replace('drv-', '') : null,
      id.startsWith('phm-') ? id.replace('phm-', '') : null
    ];
    this.markAsDeleted(idsToMark);

    // 1. Delete from Supabase `employees` table
    try {
      await supabaseClient.from('employees').delete().eq('id', id);
      if (emp?.code) {
        await supabaseClient.from('employees').delete().eq('code', emp.code);
      }
    } catch (e) {
      console.warn('Delete from Supabase employees failed:', e);
    }

    // 2. Delete branch assignments
    try {
      await supabaseClient.from('employee_branch_assignments').delete().eq('employee_id', id);
    } catch (e) {
      console.warn('Delete employee branch assignments failed:', e);
    }

    // 3. Delete from `delivery_drivers` if applicable
    const driverId = emp?.driver_id || (id.startsWith('drv-') ? id.replace('drv-', '') : null);
    if (driverId) {
      try {
        await supabaseClient.from('delivery_drivers').delete().eq('id', driverId);
      } catch (e) {
        console.warn('Delete delivery driver failed:', e);
      }
    }

    // 4. Delete from `pharmacists` if applicable
    const pharmacistId = emp?.pharmacist_id || (id.startsWith('phm-') ? id.replace('phm-', '') : null);
    if (pharmacistId) {
      try {
        await supabaseClient.from('pharmacists').delete().eq('id', pharmacistId);
      } catch (e) {
        console.warn('Delete pharmacist failed:', e);
      }
    }

    // 5. Clean local storage
    const currentRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (currentRaw) {
      try {
        const currentList: Employee[] = JSON.parse(currentRaw);
        const filtered = currentList.filter(e => {
          if (e.id === id) return false;
          if (emp?.code && e.code.toUpperCase() === emp.code.toUpperCase()) return false;
          if (driverId && (e.driver_id === driverId || e.id === `drv-${driverId}`)) return false;
          if (pharmacistId && (e.pharmacist_id === pharmacistId || e.id === `phm-${pharmacistId}`)) return false;
          return true;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.error('Error updating localStorage after deletion:', e);
      }
    }
    return true;
  },

  async deleteEmployees(emps: Employee[]): Promise<boolean> {
    if (!emps || emps.length === 0) return true;

    // Collect all identifiers to mark as deleted
    const allIdsToMark: (string | undefined | null)[] = [];
    const empIds: string[] = [];
    const empCodes: string[] = [];
    const driverIds: string[] = [];
    const pharmacistIds: string[] = [];

    emps.forEach(emp => {
      empIds.push(emp.id);
      allIdsToMark.push(emp.id);
      if (emp.code) {
        empCodes.push(emp.code);
        allIdsToMark.push(emp.code);
      }
      const dId = emp.driver_id || (emp.id.startsWith('drv-') ? emp.id.replace('drv-', '') : null);
      if (dId) {
        driverIds.push(dId);
        allIdsToMark.push(dId);
      }
      const pId = emp.pharmacist_id || (emp.id.startsWith('phm-') ? emp.id.replace('phm-', '') : null);
      if (pId) {
        pharmacistIds.push(pId);
        allIdsToMark.push(pId);
      }
    });

    this.markAsDeleted(allIdsToMark);

    // 1. Delete from Supabase `employees`
    try {
      await supabaseClient.from('employees').delete().in('id', empIds);
      if (empCodes.length > 0) {
        await supabaseClient.from('employees').delete().in('code', empCodes);
      }
    } catch (e) {
      console.warn('Batch delete from Supabase employees failed:', e);
    }

    // 2. Delete branch assignments
    try {
      await supabaseClient.from('employee_branch_assignments').delete().in('employee_id', empIds);
    } catch (e) {
      console.warn('Batch delete employee branch assignments failed:', e);
    }

    // 3. Delete from `delivery_drivers`
    if (driverIds.length > 0) {
      try {
        await supabaseClient.from('delivery_drivers').delete().in('id', driverIds);
      } catch (e) {
        console.warn('Batch delete delivery drivers failed:', e);
      }
    }

    // 4. Delete from `pharmacists`
    if (pharmacistIds.length > 0) {
      try {
        await supabaseClient.from('pharmacists').delete().in('id', pharmacistIds);
      } catch (e) {
        console.warn('Batch delete pharmacists failed:', e);
      }
    }

    // 5. Clean local storage
    const currentRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (currentRaw) {
      try {
        const currentList: Employee[] = JSON.parse(currentRaw);
        const empIdSet = new Set(empIds);
        const codeSet = new Set(empCodes.map(c => c.toUpperCase()));
        const dIdSet = new Set(driverIds);
        const pIdSet = new Set(pharmacistIds);

        const filtered = currentList.filter(e => {
          if (empIdSet.has(e.id)) return false;
          if (e.code && codeSet.has(e.code.toUpperCase())) return false;
          if (e.driver_id && dIdSet.has(e.driver_id)) return false;
          if (e.id.startsWith('drv-') && dIdSet.has(e.id.replace('drv-', ''))) return false;
          if (e.pharmacist_id && pIdSet.has(e.pharmacist_id)) return false;
          if (e.id.startsWith('phm-') && pIdSet.has(e.id.replace('phm-', ''))) return false;
          return true;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.error('Error updating localStorage after batch deletion:', e);
      }
    }
    return true;
  },

  async batchSoftDelete(emps: Employee[], isRtl: boolean = true): Promise<boolean> {
    if (!emps || emps.length === 0) return true;
    const empIds = emps.map(e => e.id);
    const empCodes = emps.filter(e => !!e.code).map(e => e.code);

    const deactivationNote = isRtl
      ? 'تم تعطيل الحساب جماعياً لحفظ السجلات التاريخية'
      : 'Batch deactivated to preserve audit log history';

    // 1. Update Supabase
    try {
      await supabaseClient
        .from('employees')
        .update({ status: 'Inactive', updated_at: new Date().toISOString() })
        .in('id', empIds);
    } catch (e) {
      console.warn('Batch soft delete in Supabase failed:', e);
    }

    // 2. Update local storage
    const currentRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (currentRaw) {
      try {
        const currentList: Employee[] = JSON.parse(currentRaw);
        const idSet = new Set(empIds);
        const codeSet = new Set(empCodes.map(c => c.toUpperCase()));

        const updated = currentList.map(e => {
          if (idSet.has(e.id) || (e.code && codeSet.has(e.code.toUpperCase()))) {
            return {
              ...e,
              status: 'Inactive' as StaffStatus,
              notes: (e.notes ? e.notes + ' | ' : '') + deactivationNote,
              updated_at: new Date().toISOString()
            };
          }
          return e;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error updating localStorage after batch soft delete:', e);
      }
    }
    return true;
  },

  async getEmployeeBranchAssignments(employeeId: string): Promise<EmployeeBranchAssignment[]> {
    const employees = await this.getAllEmployees();
    const emp = employees.find(e => e.id === employeeId || e.code === employeeId);
    return emp?.assignments || [];
  },

  async getEmployeesByBranch(branchId: string): Promise<Employee[]> {
    const employees = await this.getAllEmployees();
    return employees.filter(e => 
      e.status === 'Active' && 
      (!branchId || branchId === 'ALL' || e.assignments?.some(a => a.branch_id === branchId))
    );
  }
};
