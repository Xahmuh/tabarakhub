import { supabaseClient } from '../lib/supabaseClient';
import { MaintenanceSettings } from '../types';

const SETTINGS_ID = 'global';

const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  id: SETTINGS_ID,
  isMaintenanceModeEnabled: false,
  maintenanceTitle: 'Tabarak Hub is under maintenance',
  maintenanceMessage: 'We are making a few improvements. Please check back shortly.'
};

const SYSTEM_SETTINGS_COLUMNS = `
  id,
  maintenance_mode_enabled,
  maintenance_title,
  maintenance_message,
  updated_at,
  updated_by
`;

const toMaintenanceSettings = (row: any): MaintenanceSettings => ({
  id: SETTINGS_ID,
  isMaintenanceModeEnabled: Boolean(row?.maintenance_mode_enabled),
  maintenanceTitle: row?.maintenance_title || DEFAULT_MAINTENANCE_SETTINGS.maintenanceTitle,
  maintenanceMessage: row?.maintenance_message || DEFAULT_MAINTENANCE_SETTINGS.maintenanceMessage,
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
      console.warn('Maintenance settings unavailable; defaulting to online mode.', error);
      return DEFAULT_MAINTENANCE_SETTINGS;
    }
  },

  updateMaintenanceSettings: async (
    settings: Partial<Pick<MaintenanceSettings, 'isMaintenanceModeEnabled' | 'maintenanceTitle' | 'maintenanceMessage'>>
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

    const { data, error } = await supabaseClient
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select(SYSTEM_SETTINGS_COLUMNS)
      .single();

    if (error) throw error;
    return toMaintenanceSettings(data);
  }
};
