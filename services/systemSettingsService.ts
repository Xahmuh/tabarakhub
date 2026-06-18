import { supabaseClient } from '../lib/supabaseClient';
import { MaintenanceSettings } from '../types';
import { normalizeModuleDisplaySettings } from '../lib/moduleDisplay';
import { generateUUID } from '../utils/uuid';

const SETTINGS_ID = 'global';
const SYSTEM_BRANDING_ASSETS_BUCKET = 'system-branding-assets';

const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  id: SETTINGS_ID,
  isMaintenanceModeEnabled: false,
  maintenanceTitle: 'Tabarak Hub is under maintenance',
  maintenanceMessage: 'We are making a few improvements. Please check back shortly.',
  posGuidelineEnabled: true,
  posGuidelineTitle: 'Attention / تنبيه',
  posGuidelineIntro: 'Choose the correct type before submitting to keep reports accurate.',
  posGuidelineLostSalesEn: 'Actual customer request + item unavailable in branch.',
  posGuidelineShortageEn: 'Daily missing stock, even without a customer request.',
  pharmacyLogoUrl: '',
  hubLogoUrl: '',
  browserIconUrl: '',
  loadingSpinnerUrl: '',
  footerLogoUrl: '',
  footerText: 'HUB',
  loginBadges: [],
  branchLoginApprovalRequired: true,
  moduleDisplaySettings: normalizeModuleDisplaySettings(null),
  posGuidelineLostSalesAr: 'طلب فعلي من عميل + الصنف غير متوفر داخل الفرع.',
  posGuidelineShortageAr: 'نواقص يومية داخل الفرع حتى بدون طلب من عميل.'
};

const SYSTEM_SETTINGS_COLUMNS = `
  id,
  maintenance_mode_enabled,
  maintenance_title,
  maintenance_message,
  pos_guideline_enabled,
  pos_guideline_title,
  pos_guideline_intro,
  pos_guideline_lost_sales_en,
  pos_guideline_shortage_en,
  pos_guideline_lost_sales_ar,
  pos_guideline_shortage_ar,
  pharmacy_logo_url,
  hub_logo_url,
  browser_icon_url,
  loading_spinner_url,
  footer_logo_url,
  footer_text,
  login_badges,
  branch_login_approval_required,
  module_display_settings,
  updated_at,
  updated_by
`;

const WITHOUT_BRANDING_SYSTEM_SETTINGS_COLUMNS = SYSTEM_SETTINGS_COLUMNS
  .replace('  pharmacy_logo_url,\n', '')
  .replace('  hub_logo_url,\n', '')
  .replace('  browser_icon_url,\n', '')
  .replace('  loading_spinner_url,\n', '');

const LEGACY_SYSTEM_SETTINGS_COLUMNS = WITHOUT_BRANDING_SYSTEM_SETTINGS_COLUMNS.replace('  module_display_settings,\n', '');

const errorPart = (error: unknown, key: string) => {
  if (typeof error !== 'object' || error === null) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export const getSystemSettingsErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.name !== 'SystemSettingsUnavailableError') return error.message;
  const parts = [
    errorPart(error, 'message'),
    errorPart(error, 'details'),
    errorPart(error, 'hint'),
    errorPart(error, 'code') ? `code ${errorPart(error, 'code')}` : null
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' | ') : 'System settings could not be loaded.';
};

export class SystemSettingsUnavailableError extends Error {
  originalError: unknown;

  constructor(error: unknown) {
    super(`System settings unavailable: ${getSystemSettingsErrorMessage(error)}`);
    this.name = 'SystemSettingsUnavailableError';
    this.originalError = error;
  }
}

const isMissingModuleDisplaySettingsColumn = (error: unknown) =>
  getSystemSettingsErrorMessage(error).includes('module_display_settings');

const isMissingBrandingColumn = (error: unknown) => {
  const message = getSystemSettingsErrorMessage(error);
  return (
    message.includes('pharmacy_logo_url') ||
    message.includes('hub_logo_url') ||
    message.includes('browser_icon_url') ||
    message.includes('loading_spinner_url')
  );
};

const BRANDING_PAYLOAD_KEYS = [
  'pharmacy_logo_url',
  'hub_logo_url',
  'browser_icon_url',
  'loading_spinner_url'
];

export type SystemBrandingAssetSlot = 'pharmacy' | 'hub' | 'browser-icon' | 'spinner' | 'footer';

const normalizeImageUrl = (value?: string | null) => value?.trim() || '';

const normalizeLoginBadges = (value: unknown): string[] => {
  if (!Array.isArray(value)) return DEFAULT_MAINTENANCE_SETTINGS.loginBadges;
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6);
};

const toMaintenanceSettings = (row: any): MaintenanceSettings => ({
  id: SETTINGS_ID,
  isMaintenanceModeEnabled: Boolean(row?.maintenance_mode_enabled),
  maintenanceTitle: row?.maintenance_title || DEFAULT_MAINTENANCE_SETTINGS.maintenanceTitle,
  maintenanceMessage: row?.maintenance_message || DEFAULT_MAINTENANCE_SETTINGS.maintenanceMessage,
  posGuidelineEnabled: row?.pos_guideline_enabled !== false,
  posGuidelineTitle: row?.pos_guideline_title || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineTitle,
  posGuidelineIntro: row?.pos_guideline_intro || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineIntro,
  posGuidelineLostSalesEn: row?.pos_guideline_lost_sales_en || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineLostSalesEn,
  posGuidelineShortageEn: row?.pos_guideline_shortage_en || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineShortageEn,
  posGuidelineLostSalesAr: row?.pos_guideline_lost_sales_ar || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineLostSalesAr,
  posGuidelineShortageAr: row?.pos_guideline_shortage_ar || DEFAULT_MAINTENANCE_SETTINGS.posGuidelineShortageAr,
  pharmacyLogoUrl: row?.pharmacy_logo_url ?? DEFAULT_MAINTENANCE_SETTINGS.pharmacyLogoUrl,
  hubLogoUrl: row?.hub_logo_url ?? DEFAULT_MAINTENANCE_SETTINGS.hubLogoUrl,
  browserIconUrl: row?.browser_icon_url ?? DEFAULT_MAINTENANCE_SETTINGS.browserIconUrl,
  loadingSpinnerUrl: row?.loading_spinner_url ?? DEFAULT_MAINTENANCE_SETTINGS.loadingSpinnerUrl,
  footerLogoUrl: row?.footer_logo_url ?? DEFAULT_MAINTENANCE_SETTINGS.footerLogoUrl,
  footerText: row?.footer_text ?? DEFAULT_MAINTENANCE_SETTINGS.footerText,
  loginBadges: normalizeLoginBadges(row?.login_badges),
  branchLoginApprovalRequired: row?.branch_login_approval_required !== false,
  moduleDisplaySettings: normalizeModuleDisplaySettings(row?.module_display_settings),
  updatedAt: row?.updated_at,
  updatedBy: row?.updated_by
});

export const systemSettingsService = {
  getMaintenanceSettings: async (): Promise<MaintenanceSettings> => {
    try {
      const response = await supabaseClient
        .from('system_settings')
        .select(SYSTEM_SETTINGS_COLUMNS)
        .eq('id', SETTINGS_ID)
        .maybeSingle();
      let data: any = response.data;
      let error: any = response.error;

      if (error && isMissingBrandingColumn(error)) {
        const fallback = await supabaseClient
          .from('system_settings')
          .select(WITHOUT_BRANDING_SYSTEM_SETTINGS_COLUMNS)
          .eq('id', SETTINGS_ID)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error && isMissingModuleDisplaySettingsColumn(error)) {
        const fallback = await supabaseClient
          .from('system_settings')
          .select(LEGACY_SYSTEM_SETTINGS_COLUMNS)
          .eq('id', SETTINGS_ID)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return data ? toMaintenanceSettings(data) : DEFAULT_MAINTENANCE_SETTINGS;
    } catch (error) {
      console.warn('Maintenance settings unavailable; surfacing configuration warning.', error);
      throw new SystemSettingsUnavailableError(error);
    }
  },

  updateMaintenanceSettings: async (
    settings: Partial<Pick<
      MaintenanceSettings,
      | 'isMaintenanceModeEnabled'
      | 'maintenanceTitle'
      | 'maintenanceMessage'
      | 'posGuidelineEnabled'
      | 'posGuidelineTitle'
      | 'posGuidelineIntro'
      | 'posGuidelineLostSalesEn'
      | 'posGuidelineShortageEn'
      | 'posGuidelineLostSalesAr'
      | 'posGuidelineShortageAr'
      | 'pharmacyLogoUrl'
      | 'hubLogoUrl'
      | 'browserIconUrl'
      | 'loadingSpinnerUrl'
      | 'footerLogoUrl'
      | 'footerText'
      | 'loginBadges'
      | 'branchLoginApprovalRequired'
      | 'moduleDisplaySettings'
    >>
  ): Promise<MaintenanceSettings> => {
    const payload: Record<string, unknown> = { id: SETTINGS_ID };

    if (typeof settings.isMaintenanceModeEnabled === 'boolean') {
      payload.maintenance_mode_enabled = settings.isMaintenanceModeEnabled;
    }
    if (typeof settings.maintenanceTitle === 'string') {
      payload.maintenance_title = settings.maintenanceTitle.trim();
    }
    if (typeof settings.maintenanceMessage === 'string') {
      payload.maintenance_message = settings.maintenanceMessage.trim();
    }
    if (typeof settings.posGuidelineEnabled === 'boolean') {
      payload.pos_guideline_enabled = settings.posGuidelineEnabled;
    }
    if (typeof settings.posGuidelineTitle === 'string') {
      payload.pos_guideline_title = settings.posGuidelineTitle.trim();
    }
    if (typeof settings.posGuidelineIntro === 'string') {
      payload.pos_guideline_intro = settings.posGuidelineIntro.trim();
    }
    if (typeof settings.posGuidelineLostSalesEn === 'string') {
      payload.pos_guideline_lost_sales_en = settings.posGuidelineLostSalesEn.trim();
    }
    if (typeof settings.posGuidelineShortageEn === 'string') {
      payload.pos_guideline_shortage_en = settings.posGuidelineShortageEn.trim();
    }
    if (typeof settings.posGuidelineLostSalesAr === 'string') {
      payload.pos_guideline_lost_sales_ar = settings.posGuidelineLostSalesAr.trim();
    }
    if (typeof settings.posGuidelineShortageAr === 'string') {
      payload.pos_guideline_shortage_ar = settings.posGuidelineShortageAr.trim();
    }
    if (typeof settings.pharmacyLogoUrl === 'string') {
      payload.pharmacy_logo_url = settings.pharmacyLogoUrl.trim();
    }
    if (typeof settings.hubLogoUrl === 'string') {
      payload.hub_logo_url = settings.hubLogoUrl.trim();
    }
    if (typeof settings.browserIconUrl === 'string') {
      payload.browser_icon_url = settings.browserIconUrl.trim();
    }
    if (typeof settings.loadingSpinnerUrl === 'string') {
      payload.loading_spinner_url = settings.loadingSpinnerUrl.trim();
    }
    if (typeof settings.footerLogoUrl === 'string') {
      payload.footer_logo_url = settings.footerLogoUrl.trim();
    }
    if (typeof settings.footerText === 'string') {
      payload.footer_text = settings.footerText.trim();
    }
    if (Array.isArray(settings.loginBadges)) {
      payload.login_badges = settings.loginBadges
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    if (typeof settings.branchLoginApprovalRequired === 'boolean') {
      payload.branch_login_approval_required = settings.branchLoginApprovalRequired;
    }
    if (settings.moduleDisplaySettings) {
      payload.module_display_settings = normalizeModuleDisplaySettings(settings.moduleDisplaySettings);
    }

    const hasBrandingPayload = BRANDING_PAYLOAD_KEYS.some(key => key in payload);
    const hasModuleDisplayPayload = 'module_display_settings' in payload;
    let selectColumns = SYSTEM_SETTINGS_COLUMNS;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await supabaseClient
        .from('system_settings')
        .upsert(payload, { onConflict: 'id' })
        .select(selectColumns)
        .single();

      if (!response.error) return toMaintenanceSettings(response.data);

      if (isMissingBrandingColumn(response.error) && !hasBrandingPayload && selectColumns.includes('browser_icon_url')) {
        selectColumns = selectColumns
          .replace('  pharmacy_logo_url,\n', '')
          .replace('  hub_logo_url,\n', '')
          .replace('  browser_icon_url,\n', '')
          .replace('  loading_spinner_url,\n', '');
        continue;
      }

      if (isMissingModuleDisplaySettingsColumn(response.error) && !hasModuleDisplayPayload && selectColumns.includes('module_display_settings')) {
        selectColumns = selectColumns.replace('  module_display_settings,\n', '');
        continue;
      }

      throw response.error;
    }

    throw new Error('Failed to update system settings.');
  },

  uploadBrandingAsset: async (file: File, slot: SystemBrandingAssetSlot): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Please upload an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Logo image must be 5MB or smaller.');

    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `logos/${slot}/${generateUUID()}_${safeName || `logo.${extension}`}`;
    const { error } = await supabaseClient.storage
      .from(SYSTEM_BRANDING_ASSETS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true
      });
    if (error) throw error;

    const { data } = supabaseClient.storage
      .from(SYSTEM_BRANDING_ASSETS_BUCKET)
      .getPublicUrl(filePath);
    return normalizeImageUrl(data.publicUrl);
  }
};
