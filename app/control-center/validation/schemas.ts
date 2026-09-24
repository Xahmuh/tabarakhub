/**
 * ============================================================================
 * Control Center Module: Enterprise Multi-Branch Pharmacy Management System
 * Zod Runtime Validation Schemas (Kingdom of Bahrain Regulatory & Operational)
 * ============================================================================
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// 1. Common Reusable Validators & RegEx Patterns (Kingdom of Bahrain)
// ----------------------------------------------------------------------------

/**
 * Standard PostgreSQL UUID Regex (32 hex digits separated by hyphens)
 */
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const UuidSchema = (fieldLabel = 'Field') =>
  z.string().trim().regex(UUID_REGEX, `${fieldLabel} must be a valid UUID`);

/**
 * Bahrain Block Number Regex: Standard 3 or 4 digits (e.g. 301, 743, 929, 1012)
 */
export const BAHRAIN_BLOCK_REGEX = /^\d{3,4}$/;

/**
 * Bahrain Phone Number Regex:
 * Accepts optional country code (+973 or 00973), followed by standard 8 digits
 * starting with 1, 3, 6, 7, 8, or 9.
 */
export const BAHRAIN_PHONE_REGEX = /^(?:(?:\+|00)973)?[136789]\d{7}$/;

/**
 * Bahrain Commercial Registration (CR) Number Pattern:
 * Standard format: 5 to 8 digits, hyphen, 1 to 2 branch digits (e.g. 127506-01)
 */
export const BAHRAIN_CR_NUMBER_REGEX = /^\d{4,8}(?:-\d{1,3})?$/;

/**
 * Bahrain VAT / National Bureau for Revenue (NBR) Account Number:
 * 15 digits, typically starting with 200 (e.g. 200012345600002)
 */
export const BAHRAIN_VAT_REGEX = /^\d{15}$/;

/**
 * ISO Date string validator (YYYY-MM-DD)
 */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
  .refine(val => !isNaN(Date.parse(val)), {
    message: 'Invalid calendar date'
  });

/**
 * Optional or Nullable Coordinates Validator
 */
export const LatitudeSchema = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90')
  .nullable()
  .optional();

export const LongitudeSchema = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180')
  .nullable()
  .optional();

/**
 * Start Shift Radius Validator (Strictly between 10m and 1000m)
 */
export const StartShiftRadiusSchema = z
  .number()
  .int('start_shift_radius_meters must be an integer')
  .min(10, 'start_shift_radius_meters must be at least 10 meters')
  .max(1000, 'start_shift_radius_meters cannot exceed 1000 meters');

// ----------------------------------------------------------------------------
// 2. Commercial Registration Schemas
// ----------------------------------------------------------------------------

export const BaseCommercialRegistrationSchema = z.object({
  cr_number: z
    .string()
    .trim()
    .min(3, 'CR number must be at least 3 characters')
    .max(50, 'CR number cannot exceed 50 characters')
    .regex(BAHRAIN_CR_NUMBER_REGEX, 'CR number must follow Bahrain format (e.g. 127506-01)'),
  is_main_group_cr: z.boolean().default(false),
  legal_name_en: z
    .string()
    .trim()
    .min(3, 'English legal name is required')
    .max(255, 'English legal name cannot exceed 255 characters'),
  legal_name_ar: z
    .string()
    .trim()
    .min(3, 'Arabic legal name is required')
    .max(255, 'Arabic legal name cannot exceed 255 characters'),
  vat_account_number: z
    .string()
    .trim()
    .regex(BAHRAIN_VAT_REGEX, 'VAT account number must be 15 digits as issued by Bahrain NBR'),
  cr_expiry_date: IsoDateSchema,
  nhra_cr_license_no: z
    .string()
    .trim()
    .min(3, 'NHRA license number is required')
    .max(50, 'NHRA license number cannot exceed 50 characters'),
  nhra_cr_expiry_date: IsoDateSchema,
  bcci_expiry_date: IsoDateSchema,
  logo_url: z.string().trim().url('logo_url must be a valid URL'),
  ceo_signature_url: z.string().trim().url('ceo_signature_url must be a valid URL'),
  official_seal_stamp_url: z.string().trim().url('official_seal_stamp_url must be a valid URL')
});

export const CreateCommercialRegistrationSchema = BaseCommercialRegistrationSchema;
export const UpdateCommercialRegistrationSchema = BaseCommercialRegistrationSchema.partial();

// ----------------------------------------------------------------------------
// 3. Operational Areas & Zones Schemas
// ----------------------------------------------------------------------------

export const BaseOperationalAreaSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Area code must be at least 2 characters')
    .max(30, 'Area code cannot exceed 30 characters'),
  name_en: z.string().trim().min(3, 'English area name is required').max(120),
  name_ar: z.string().trim().min(3, 'Arabic area name is required').max(120),
  supervisor_id: UuidSchema('supervisor_id'),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true)
});

export const CreateOperationalAreaSchema = BaseOperationalAreaSchema;
export const UpdateOperationalAreaSchema = BaseOperationalAreaSchema.partial();

export const BaseOperationalZoneSchema = z.object({
  area_id: UuidSchema('area_id'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Zone code must be at least 2 characters')
    .max(30, 'Zone code cannot exceed 30 characters'),
  name_en: z.string().trim().min(3, 'English zone name is required').max(120),
  name_ar: z.string().trim().min(3, 'Arabic zone name is required').max(120),
  default_shift_schedule_id: z.string().regex(UUID_REGEX, 'default_shift_schedule_id must be a valid UUID').optional().nullable(),
  coverage_parameters: z.record(z.string(), z.any()).default({}),
  shift_rules: z.array(z.any()).default([]),
  is_active: z.boolean().default(true)
});

export const CreateOperationalZoneSchema = BaseOperationalZoneSchema;
export const UpdateOperationalZoneSchema = BaseOperationalZoneSchema.partial();

// ----------------------------------------------------------------------------
// 4. Pharmacy Branch Schemas
// ----------------------------------------------------------------------------

export const BaseBranchSchema = z.object({
  branch_code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Branch code must be at least 2 characters (e.g. T001)')
    .max(20, 'Branch code cannot exceed 20 characters'),
  name_en: z.string().trim().min(3, 'English branch name is required').max(150),
  name_ar: z.string().trim().min(3, 'Arabic branch name is required').max(150),
  operational_name: z.string().trim().min(2, 'Operational name is required').max(150),

  // Relational Foreign Keys
  cr_id: UuidSchema('cr_id'),
  governorate_id: UuidSchema('governorate_id'),
  area_id: UuidSchema('area_id'),
  zone_id: UuidSchema('zone_id'),

  // Civil Address (Bahrain Standards)
  block_number: z
    .string()
    .trim()
    .regex(BAHRAIN_BLOCK_REGEX, 'block_number must be a 3 or 4 digit Bahrain Block number (e.g. 743)'),
  road_number: z.string().trim().min(1, 'road_number is required').max(50),
  building_number: z.string().trim().min(1, 'building_number is required').max(50),
  shop_number: z.string().trim().max(50).optional().nullable(),

  // Geolocation & Geofence (Start Shift Boundary)
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  start_shift_radius_meters: StartShiftRadiusSchema.default(100),

  // Management & License Holders
  branch_manager_id: z.string().regex(UUID_REGEX, 'branch_manager_id must be a valid UUID').optional().nullable(),
  in_charge_pharmacist_id: z.string().regex(UUID_REGEX, 'in_charge_pharmacist_id must be a valid UUID').optional().nullable(),

  // Contacts
  phone_landline: z
    .string()
    .trim()
    .regex(BAHRAIN_PHONE_REGEX, 'phone_landline must be a valid 8-digit Bahrain number')
    .optional()
    .nullable(),
  phone_mobile: z
    .string()
    .trim()
    .regex(BAHRAIN_PHONE_REGEX, 'phone_mobile must be a valid 8-digit Bahrain number')
    .optional()
    .nullable(),
  branch_email: z.string().trim().toLowerCase().email('branch_email must be a valid email address'),

  // Operational Flags
  is_24_hours: z.boolean().default(false),
  is_active: z.boolean().default(true)
});

export const CreateBranchSchema = BaseBranchSchema.refine(
  data => {
    const hasLat = data.latitude !== null && data.latitude !== undefined;
    const hasLng = data.longitude !== null && data.longitude !== undefined;
    return (hasLat && hasLng) || (!hasLat && !hasLng);
  },
  {
    message: 'Both latitude and longitude must be provided together when setting GPS location',
    path: ['latitude']
  }
);

export const UpdateBranchSchema = BaseBranchSchema.partial().refine(
  data => {
    if (data.latitude !== undefined || data.longitude !== undefined) {
      const hasLat = data.latitude !== null && data.latitude !== undefined;
      const hasLng = data.longitude !== null && data.longitude !== undefined;
      return (hasLat && hasLng) || (!hasLat && !hasLng);
    }
    return true;
  },
  {
    message: 'Both latitude and longitude must be updated together when setting GPS coordinates',
    path: ['latitude']
  }
);

// ----------------------------------------------------------------------------
// 5. Branch Delivery Zone Schemas
// ----------------------------------------------------------------------------

export const BaseBranchDeliveryZoneSchema = z.object({
  branch_id: UuidSchema('branch_id'),
  origin_block: z
    .string()
    .trim()
    .regex(BAHRAIN_BLOCK_REGEX, 'origin_block must be a 3 or 4 digit Bahrain Block number'),

  // Distance Tiers (KM)
  core_km: z
    .number()
    .positive('core_km must be greater than 0')
    .max(50, 'core_km cannot exceed 50 km'),
  standard_km: z
    .number()
    .positive('standard_km must be greater than 0')
    .max(80, 'standard_km cannot exceed 80 km'),
  extended_km: z
    .number()
    .positive('extended_km must be greater than 0')
    .max(120, 'extended_km cannot exceed 120 km'),

  // SLA Timers (Minutes)
  target_min: z
    .number()
    .int('target_min must be an integer')
    .min(5, 'target_min must be at least 5 minutes')
    .max(180, 'target_min cannot exceed 180 minutes'),
  warning_min: z
    .number()
    .int('warning_min must be an integer')
    .min(5, 'warning_min must be at least 5 minutes')
    .max(240, 'warning_min cannot exceed 240 minutes'),

  is_active: z.boolean().default(true)
});

export const CreateBranchDeliveryZoneSchema = BaseBranchDeliveryZoneSchema
  .refine(data => data.core_km < data.standard_km, {
    message: 'standard_km must be strictly greater than core_km',
    path: ['standard_km']
  })
  .refine(data => data.standard_km < data.extended_km, {
    message: 'extended_km must be strictly greater than standard_km',
    path: ['extended_km']
  })
  .refine(data => data.warning_min >= data.target_min, {
    message: 'warning_min must be greater than or equal to target_min',
    path: ['warning_min']
  });

export const UpdateBranchDeliveryZoneSchema = BaseBranchDeliveryZoneSchema.partial().refine(
  data => {
    if (data.core_km !== undefined && data.standard_km !== undefined) {
      if (data.standard_km <= data.core_km) return false;
    }
    if (data.standard_km !== undefined && data.extended_km !== undefined) {
      if (data.extended_km <= data.standard_km) return false;
    }
    if (data.target_min !== undefined && data.warning_min !== undefined) {
      if (data.warning_min < data.target_min) return false;
    }
    return true;
  },
  {
    message: 'Distance tiers and SLA timers must maintain logical progression',
    path: ['standard_km']
  }
);

// ----------------------------------------------------------------------------
// 6. Dynamic Staff Allocation Schemas
// ----------------------------------------------------------------------------

export const BranchStaffRoleEnum = z.enum(['Pharmacist', 'Driver', 'Worker', 'Assistant', 'Cashier'], {
  message: "Role must be 'Pharmacist', 'Driver', 'Worker', 'Assistant', or 'Cashier'"
});

export const StaffAssignmentTypeEnum = z.enum(['Primary Base', 'Floating / Relief Cover'], {
  message: "Assignment type must be 'Primary Base' or 'Floating / Relief Cover'"
});

export const BaseBranchStaffAssignmentSchema = z.object({
  branch_id: UuidSchema('branch_id'),
  user_id: UuidSchema('user_id'),
  role: BranchStaffRoleEnum,
  assignment_type: StaffAssignmentTypeEnum.default('Primary Base'),
  start_date: IsoDateSchema,
  end_date: IsoDateSchema.nullable().optional(),
  is_active: z.boolean().default(true)
});

export const CreateBranchStaffAssignmentSchema = BaseBranchStaffAssignmentSchema.refine(
  data => {
    if (data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'end_date must be on or after start_date',
    path: ['end_date']
  }
);

export const UpdateBranchStaffAssignmentSchema = BaseBranchStaffAssignmentSchema.partial().refine(
  data => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'end_date must be on or after start_date',
    path: ['end_date']
  }
);
