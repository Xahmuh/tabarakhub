/**
 * Device fingerprinting & persistent UUID generator for Spin & Win fraud prevention.
 * Combines persistent local storage, resilient cookie storage, and hardware parameters
 * to create a stable identifier for a customer's browser/device.
 */

const STORAGE_KEY = 'tabarak_spin_device_id';

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
};

const setCookie = (name: string, value: string, days: number = 3650) => {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const fallbackHash = (value: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
};

const sha256 = async (value: string): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return fallbackHash(value);
  }
  try {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return fallbackHash(value);
  }
};

export const getSpinDeviceFingerprint = async (): Promise<string> => {
  if (typeof window === 'undefined') return 'server-context';

  // 1. Recover or generate persistent device UUID
  let deviceId = '';
  try {
    deviceId = localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    // localStorage might be restricted in strict privacy modes
  }

  if (!deviceId) {
    deviceId = getCookie(STORAGE_KEY) || '';
  }

  if (!deviceId) {
    deviceId = generateUUID();
    try {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } catch {
      // ignore
    }
    setCookie(STORAGE_KEY, deviceId);
  } else {
    // Sync both stores in case one was cleared
    try {
      if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, deviceId);
    } catch {}
    if (!getCookie(STORAGE_KEY)) setCookie(STORAGE_KEY, deviceId);
  }

  // 2. Hardware and environment signals
  const nav = navigator;
  const scr = window.screen;
  const screenInfo = scr ? `${scr.width}x${scr.height}x${scr.colorDepth || 24}` : 'unknown-screen';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown-tz';
  const language = nav.language || 'unknown-lang';
  const platform = nav.platform || 'unknown-platform';
  const concurrency = String(nav.hardwareConcurrency || 4);
  const userAgent = nav.userAgent || 'unknown-ua';

  const source = [deviceId, screenInfo, timezone, language, platform, concurrency, userAgent].join('|');
  return sha256(source);
};
