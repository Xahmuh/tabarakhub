import { supabaseClient } from '../lib/supabaseClient';
import { MaintenanceSettings } from '../types';

const SETTINGS_ID = 'global';

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
  footerLogoUrl: '',
  footerText: 'HUB',
  loginBadges: [],
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
  footer_logo_url,
  footer_text,
  login_badges,
  updated_at,
  updated_by
`;

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
  footerLogoUrl: row?.footer_logo_url ?? DEFAULT_MAINTENANCE_SETTINGS.footerLogoUrl,
  footerText: row?.footer_text ?? DEFAULT_MAINTENANCE_SETTINGS.footerText,
  loginBadges: normalizeLoginBadges(row?.login_badges),
  updatedAt: row?.updated_at,
  updatedBy: row?.updated_by
});

export const systemSettingsService = {
  getMaintenanceSettings: async (): Promise<MaintenanceSettings> => {
    try {
      const { data, error } = await supabaseClient
        .from('system_settings')
        .select(SYSTEM_SETTINGS_COLUMNS)
        .eq('id', SETTINGS_ID)
        .maybeSingle();

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
      | 'footerLogoUrl'
      | 'footerText'
      | 'loginBadges'
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

    const { data, error } = await supabaseClient
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select(SYSTEM_SETTINGS_COLUMNS)
      .single();

    if (error) throw error;
    return toMaintenanceSettings(data);
  }
};
