import { useEffect, useState } from 'react';
import { MaintenanceSettings } from '../types';
import { supabase } from '../lib/supabase';
import { clientConfig } from '../config/clientConfig';
import { getSystemSettingsErrorMessage } from '../services/systemSettingsService';

export const hexToRgbParts = (value: string, fallback: string) => {
  const normalized = value.trim().replace('#', '');
  const hex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
};

export const updateBrowserIcon = (iconUrl: string) => {
  const href = iconUrl.trim() || clientConfig.logoUrl;
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = href;
  icon.type = href.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
};

export const useSystemMaintenance = () => {
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings | null>(null);
  const [maintenanceSettingsError, setMaintenanceSettingsError] = useState<string | null>(null);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true);

  useEffect(() => {
    document.title = `${clientConfig.clientName} | ${clientConfig.appName}`;
    const root = document.documentElement;
    root.style.setProperty('--client-primary-color', clientConfig.primaryColor);
    root.style.setProperty('--client-primary-hover-color', clientConfig.primaryHoverColor);
    root.style.setProperty('--client-primary-dark-color', clientConfig.primaryDarkColor);
    root.style.setProperty('--client-primary-muted-color', clientConfig.primaryMutedColor);
    root.style.setProperty('--client-accent-color', clientConfig.accentColor);
    root.style.setProperty('--client-primary-rgb', hexToRgbParts(clientConfig.primaryColor, '185 28 28'));
    root.style.setProperty('--client-primary-hover-rgb', hexToRgbParts(clientConfig.primaryHoverColor, '153 27 27'));
    root.style.setProperty('--client-primary-dark-rgb', hexToRgbParts(clientConfig.primaryDarkColor, '127 29 29'));
  }, []);

  useEffect(() => {
    document.title = `${clientConfig.clientName} | ${clientConfig.appName}`;
    updateBrowserIcon(
      maintenanceSettings?.browserIconUrl?.trim() ||
      maintenanceSettings?.pharmacyLogoUrl?.trim() ||
      clientConfig.logoUrl
    );
  }, [maintenanceSettings?.browserIconUrl, maintenanceSettings?.pharmacyLogoUrl]);

  useEffect(() => {
    let isMounted = true;

    const loadMaintenanceSettings = async () => {
      try {
        const settings = await supabase.systemSettings.getMaintenanceSettings();
        if (isMounted) {
          setMaintenanceSettings(settings);
          setMaintenanceSettingsError(null);
        }
      } catch (error) {
        if (isMounted) {
          setMaintenanceSettings(null);
          setMaintenanceSettingsError(getSystemSettingsErrorMessage(error));
        }
      } finally {
        if (isMounted) setIsMaintenanceLoading(false);
      }
    };

    loadMaintenanceSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    maintenanceSettings,
    setMaintenanceSettings,
    maintenanceSettingsError,
    isMaintenanceLoading
  };
};
