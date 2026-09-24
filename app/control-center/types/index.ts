/**
 * ============================================================================
 * Control Center Module: Enterprise Multi-Branch Pharmacy Management System
 * TypeScript Domain Interfaces & Relational Types (Kingdom of Bahrain)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Literal Enums & Domain Value Objects
// ----------------------------------------------------------------------------

export type GovernorateCode = 'CAPITAL' | 'MUHARRAQ' | 'NORTHERN' | 'SOUTHERN';

export type BranchStaffRole = 'Pharmacist' | 'Driver' | 'Worker' | 'Assistant' | 'Cashier';

export type StaffAssignmentType = 'Primary Base' | 'Floating / Relief Cover';

// ----------------------------------------------------------------------------
// 2. Base Entity Interfaces (Database Row Types)
// ----------------------------------------------------------------------------

/**
 * Administrative Governorate of Bahrain
 */
export interface Governorate {
  id: string;
  code: GovernorateCode;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Operational Area (e.g. Area 1, Area 2) assigned to a Supervisor
 */
export interface OperationalArea {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  supervisor_id: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Area Supervisor representation in Control Center
 */
export interface AreaSupervisor {
  id: string;
  name: string;
  email?: string;
  title: string;
  role?: string;
  phone?: string;
  is_custom?: boolean;
}

/**
 * Operational Zone inside an Area for workforce coverage and dispatching
 */
export interface OperationalZone {
  id: string;
  area_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  default_shift_schedule_id?: string | null;
  coverage_parameters: Record<string, any>;
  shift_rules: Record<string, any>[] | string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Commercial Registration (CR) & Legal Identity powering statutory compliance and HR letter generation
 */
export interface CommercialRegistration {
  id: string;
  cr_number: string;
  is_main_group_cr: boolean;
  legal_name_en: string;
  legal_name_ar: string;
  vat_account_number: string;
  cr_expiry_date: string; // YYYY-MM-DD
  nhra_cr_license_no: string;
  nhra_cr_expiry_date: string; // YYYY-MM-DD
  bcci_expiry_date: string; // YYYY-MM-DD
  logo_url: string;
  ceo_signature_url: string;
  official_seal_stamp_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Pharmacy Branch Store & Dispensary
 */
export interface Branch {
  id: string;
  branch_code: string;
  name_en: string;
  name_ar: string;
  operational_name: string;

  // Foreign keys
  cr_id: string;
  governorate_id: string;
  area_id: string;
  zone_id: string;

  // Civil Address
  block_number: string;
  road_number: string;
  building_number: string;
  shop_number?: string | null;

  // Coordinates & Geofencing
  latitude?: number | null;
  longitude?: number | null;
  start_shift_radius_meters: number; // 10m to 1000m

  // Management & Licensing
  branch_manager_id?: string | null;
  in_charge_pharmacist_id?: string | null;

  // Contact
  phone_landline?: string | null;
  phone_mobile?: string | null;
  branch_email: string;

  // State
  is_24_hours: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Branch Logistical Delivery Zone Rules & SLAs
 */
export interface BranchDeliveryZone {
  id: string;
  branch_id: string;
  origin_block: string;
  core_km: number;
  standard_km: number;
  extended_km: number;
  target_min: number;
  warning_min: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Dynamic Multi-Staff Allocation per Branch
 */
export interface BranchStaffAssignment {
  id: string;
  branch_id: string;
  user_id: string;
  role: BranchStaffRole;
  assignment_type: StaffAssignmentType;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// 3. User & Staff Mini Reference (For joined payload presentation)
// ----------------------------------------------------------------------------

export interface StaffUserSummary {
  id: string;
  name: string;
  cpr?: string;
  code?: string;
  email?: string;
  mobile?: string;
  role: string;
  nhra_license_no?: string;
}

// ----------------------------------------------------------------------------
// 4. Relational Join Models (Aggregates & Enriched Views)
// ----------------------------------------------------------------------------

export interface BranchStaffAssignmentWithUser extends BranchStaffAssignment {
  user?: StaffUserSummary;
}

export interface OperationalAreaWithSupervisor extends OperationalArea {
  supervisor?: StaffUserSummary;
  zones_count?: number;
  branches_count?: number;
}

export interface OperationalZoneWithDetails extends OperationalZone {
  area?: OperationalArea;
  branches_count?: number;
}

/**
 * Complete Enriched Branch Entity with All Relational Associations
 */
export interface BranchWithRelations extends Branch {
  commercial_registration: CommercialRegistration;
  governorate: Governorate;
  operational_area: OperationalAreaWithSupervisor;
  operational_zone: OperationalZone;
  delivery_zone?: BranchDeliveryZone | null;
  staff_assignments: BranchStaffAssignmentWithUser[];
  branch_manager?: StaffUserSummary | null;
  in_charge_pharmacist?: StaffUserSummary | null;
}

/**
 * Commercial Registration with all affiliated branch entities
 */
export interface CommercialRegistrationWithBranches extends CommercialRegistration {
  branches: Branch[];
  active_branches_count: number;
  is_expired_cr?: boolean;
  is_expired_nhra?: boolean;
}

/**
 * Operational Area Hierarchy Aggregate
 */
export interface OperationalAreaHierarchy extends OperationalArea {
  supervisor?: StaffUserSummary;
  zones: (OperationalZone & {
    branches: (Branch & {
      delivery_zone?: BranchDeliveryZone | null;
      active_staff_count: number;
    })[];
  })[];
}

// ----------------------------------------------------------------------------
// 5. Input DTOs (Data Transfer Objects for Control Center APIs)
// ----------------------------------------------------------------------------

export interface CreateCommercialRegistrationDTO {
  cr_number: string;
  is_main_group_cr?: boolean;
  legal_name_en: string;
  legal_name_ar: string;
  vat_account_number: string;
  cr_expiry_date: string;
  nhra_cr_license_no: string;
  nhra_cr_expiry_date: string;
  bcci_expiry_date: string;
  logo_url: string;
  ceo_signature_url: string;
  official_seal_stamp_url: string;
}

export type UpdateCommercialRegistrationDTO = Partial<CreateCommercialRegistrationDTO>;

export interface CreateBranchDTO {
  branch_code: string;
  name_en: string;
  name_ar: string;
  operational_name: string;
  cr_id: string;
  governorate_id: string;
  area_id: string;
  zone_id: string;
  block_number: string;
  road_number: string;
  building_number: string;
  shop_number?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_shift_radius_meters?: number;
  branch_manager_id?: string | null;
  in_charge_pharmacist_id?: string | null;
  phone_landline?: string | null;
  phone_mobile?: string | null;
  branch_email: string;
  is_24_hours?: boolean;
  is_active?: boolean;
}

export type UpdateBranchDTO = Partial<CreateBranchDTO>;

export interface CreateBranchDeliveryZoneDTO {
  branch_id: string;
  origin_block: string;
  core_km: number;
  standard_km: number;
  extended_km: number;
  target_min: number;
  warning_min: number;
  is_active?: boolean;
}

export type UpdateBranchDeliveryZoneDTO = Partial<CreateBranchDeliveryZoneDTO>;

export interface CreateBranchStaffAssignmentDTO {
  branch_id: string;
  user_id: string;
  role: BranchStaffRole;
  assignment_type?: StaffAssignmentType;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

export type UpdateBranchStaffAssignmentDTO = Partial<CreateBranchStaffAssignmentDTO>;

export interface CreateOperationalAreaDTO {
  code: string;
  name_en: string;
  name_ar: string;
  supervisor_id: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateOperationalAreaDTO = Partial<CreateOperationalAreaDTO>;

export interface CreateOperationalZoneDTO {
  area_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  default_shift_schedule_id?: string | null;
  coverage_parameters?: Record<string, any>;
  shift_rules?: Record<string, any>[] | string[];
  is_active?: boolean;
}

// ----------------------------------------------------------------------------
// 6. Query & Filter Parameters
// ----------------------------------------------------------------------------

export interface BranchQueryParams {
  cr_id?: string;
  governorate_id?: string;
  area_id?: string;
  zone_id?: string;
  is_active?: boolean;
  is_24_hours?: boolean;
  search_query?: string;
  limit?: number;
  offset?: number;
}
