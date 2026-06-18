import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import {
  currentAndroidBuild,
  driverApi,
  DriverBranchOption,
  DriverDutyRecord,
  DriverHistoryStatusFilter,
  isDriverForceUpdateRequired,
  DriverMobileAppSettings,
  DriverNearbyStartBranch,
  DriverOrder,
  DriverOrderStatus,
  DriverSessionPayload
} from '../src/lib/api';
import {
  driverLanguageOptions,
  formatCopy,
  getDriverCopy,
  isRtlLanguage,
  loadSavedDriverLanguage,
  saveDriverLanguage,
  type DriverLanguage
} from '../src/i18n';
import { enqueueOrderAction, flushQueuedActions } from '../src/lib/offlineQueue';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import {
  applyDriverTheme,
  colors,
  loadSavedDriverTheme,
  radius,
  saveDriverTheme,
  shadows,
  spacing,
  typography,
  type DriverColors,
  type DriverThemeMode
} from '../src/theme';

const tabarakLogo = require('../src/assets/tabarak-logo.jpg');
const hubFooterLogo = require('../src/assets/logo/hublogo.png');
const driverAlarmSound = require('../src/assets/sounds/driver.mp3');
const DEFAULT_FOOTER_CREDIT = 'Developed by Ahmed Elsherbini';
const DEFAULT_MOBILE_SETTINGS: DriverMobileAppSettings = {
  loginLogoUrl: null,
  footerLogoUrl: null,
  footerCredit: DEFAULT_FOOTER_CREDIT,
  androidMinimumBuild: 1,
  androidLatestBuild: 1,
  androidLatestVersion: '0.1.0',
  androidApkUrl: '',
  forceUpdateEnabled: false,
  forceUpdateTitle: 'Update required',
  forceUpdateMessage: 'A new driver app version is available. Please install the latest APK to continue.',
  updatedAt: null
};

type ButtonTone = 'brand' | 'light' | 'danger' | 'success' | 'warning' | 'dark' | 'collected';
type DashboardTab = 'home' | 'orders' | 'transfer' | 'history' | 'stats' | 'profile' | 'notifications' | 'dutyRecord';
type HistoryStatusFilter = 'all' | DriverHistoryStatusFilter;
type HistoryOrderTypeFilter = 'delivery' | 'internal_transfer';
type HistoryPeriodFilter = 'all' | 'today' | 'week' | 'month';
type DriverCopy = ReturnType<typeof getDriverCopy>;

const incentiveMoney = (value?: number | null) => `BHD ${Number(value || 0).toFixed(3)}`;
const paymentMoney = (value?: number | null) => `BHD ${Number(value || 0).toFixed(3)}`;
const isDriverPaymentPending = (order: DriverOrder) =>
  order.orderKind !== 'internal_transfer' && order.paymentCollectionStatus !== 'paid' && order.amountToCollectBhd > 0;
const paymentCollectionActionText = {
  confirmCollected: 'Payment collected',
  deliveredAndCollected: 'Collected',
  confirmCollectedTitle: 'Confirm payment collection',
  confirmCollectedMessage: 'Confirm you received {amount} from the customer.',
  confirmCollectedSuccessTitle: 'Payment confirmed',
  confirmCollectedSuccessText: 'This order is now marked as paid.',
  connectBeforeConfirm: 'Connect to the internet before confirming customer payment.'
};

const shortId = (id: string) => id.slice(0, 8);
const orderDisplayNumber = (order: Pick<DriverOrder, 'id' | 'orderNumber'>) =>
  order.orderNumber?.trim() || `#${shortId(order.id)}`;

const localeByLanguage: Record<DriverLanguage, string> = {
  en: 'en-GB',
  ar: 'ar-BH',
  ur: 'ur-PK',
  bn: 'bn-BD'
};

const statusLabel = (status: DriverOrderStatus, copy: DriverCopy) =>
  copy.status[status] || status;

const branchLabel = (branch: Pick<DriverBranchOption, 'code' | 'name'> | null | undefined, copy: DriverCopy) =>
  branch ? `${branch.code ? `${branch.code} - ` : ''}${branch.name}` : copy.common.branch;

const imageSource = (url: string | null | undefined, fallback: any) => {
  const trimmed = url?.trim();
  return trimmed ? { uri: trimmed } : fallback;
};

const orderRouteLabel = (order: DriverOrder, copy: DriverCopy) => {
  if (order.orderKind !== 'internal_transfer') return order.branchName;
  const from = order.transferFromBranchName || order.branchName;
  const to = order.transferToBranchName || copy.common.destinationBranch;
  return `${from} -> ${to}`;
};

const orderTypeLabel = (order: DriverOrder, copy: DriverCopy) =>
  order.orderKind === 'internal_transfer' ? copy.common.internalTransfer : copy.common.actualDelivery;

const paymentCollectionText = (language: DriverLanguage) => {
  if (language === 'ar') {
    return {
      title: 'ØªØ­ØµÙŠÙ„ Ø¹Ù†Ø¯ Ø§Ù„ØªÙˆØµÙŠÙ„',
      collectFromCustomer: 'ÙŠØªÙ… ØªØ­ØµÙŠÙ„Ù‡ Ù…Ù† Ø§Ù„Ø¹Ù…ÙŠÙ„',
      cashWithDriver: 'ÙƒØ§Ø´/Ø¨Ø§Ù‚ÙŠ Ù…Ø¹ Ø§Ù„Ø¯Ø±Ø§ÙŠÙØ±',
      note: 'Ù…Ù„Ø§Ø­Ø¸Ø© Ø§Ù„Ø¯ÙØ¹',
      collected: 'ØªÙ… ØªØ­ØµÙŠÙ„ Ø§Ù„Ø¯ÙØ¹',
      partial: 'Ø¯ÙØ¹ Ø¬Ø²Ø¦ÙŠ',
      collectOnDelivery: 'ØªØ­ØµÙŠÙ„ Ø¹Ù†Ø¯ Ø§Ù„ØªÙˆØµÙŠÙ„'
    };
  }
  if (language === 'ur') {
    return {
      title: 'ÚˆÙ„ÛŒÙˆØ±ÛŒ Ù¾Ø± ÙˆØµÙˆÙ„ÛŒ',
      collectFromCustomer: 'Ú©Ø³Ù¹Ù…Ø± Ø³Û’ ÙˆØµÙˆÙ„ Ú©Ø±ÛŒÚº',
      cashWithDriver: 'ÚˆØ±Ø§Ø¦ÛŒÙˆØ± Ú©Û’ Ù¾Ø§Ø³ Ú©ÛŒØ´/Ú†ÛŒÙ†Ø¬',
      note: 'Ù¾ÛŒÙ…Ù†Ù¹ Ù†ÙˆÙ¹',
      collected: 'Ù¾ÛŒÙ…Ù†Ù¹ ÙˆØµÙˆÙ„ ÛÙˆ Ú¯Ø¦ÛŒ',
      partial: 'Ø¬Ø²ÙˆÛŒ Ø§Ø¯Ø§Ø¦ÛŒÚ¯ÛŒ',
      collectOnDelivery: 'ÚˆÙ„ÛŒÙˆØ±ÛŒ Ù¾Ø± ÙˆØµÙˆÙ„ÛŒ'
    };
  }
  if (language === 'bn') {
    return {
      title: 'à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿à¦¤à§‡ à¦•à¦¾à¦²à§‡à¦•à¦¶à¦¨',
      collectFromCustomer: 'à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¥à§‡à¦•à§‡ à¦¨à¦¿à¦¨',
      cashWithDriver: 'à¦¡à§à¦°à¦¾à¦‡à¦­à¦¾à¦°à§‡à¦° à¦•à¦¾à¦›à§‡ à¦•à§à¦¯à¦¾à¦¶/à¦šà§‡à¦žà§à¦œ',
      note: 'à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¨à§‹à¦Ÿ',
      collected: 'à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦¾à¦²à§‡à¦•à§à¦Ÿà§‡à¦¡',
      partial: 'à¦ªà¦¾à¦°à§à¦¶à¦¿à§Ÿà¦¾à¦² à¦ªà§‡à¦‡à¦¡',
      collectOnDelivery: 'à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿à¦¤à§‡ à¦•à¦¾à¦²à§‡à¦•à¦¶à¦¨'
    };
  }
  return {
    title: 'Delivery payment',
    collectFromCustomer: 'Collect from customer',
    cashWithDriver: 'Cash/change with driver',
    note: 'Payment note',
    collected: 'Payment collected',
    partial: 'Partial paid',
    collectOnDelivery: 'Collect on delivery'
  };
};

const historyDetailText = (language: DriverLanguage) => {
  if (language === 'ar') {
    return {
      openDetails: 'افتح تفاصيل الطلب',
      orderDetails: 'بيانات الطلب',
      fullPathway: 'مسار الطلب الكامل',
      status: 'الحالة',
      orderDate: 'تاريخ الطلب',
      created: 'تم الإنشاء',
      governorate: 'المحافظة',
      notes: 'ملاحظات'
    };
  }
  if (language === 'ur') {
    return {
      openDetails: 'آرڈر تفصیلات کھولیں',
      orderDetails: 'آرڈر تفصیلات',
      fullPathway: 'مکمل راستہ',
      status: 'اسٹیٹس',
      orderDate: 'آرڈر تاریخ',
      created: 'بنایا گیا',
      governorate: 'گورنریٹ',
      notes: 'نوٹس'
    };
  }
  if (language === 'bn') {
    return {
      openDetails: 'অর্ডার বিস্তারিত খুলুন',
      orderDetails: 'অর্ডার বিস্তারিত',
      fullPathway: 'সম্পূর্ণ পথ',
      status: 'স্ট্যাটাস',
      orderDate: 'অর্ডারের তারিখ',
      created: 'তৈরি হয়েছে',
      governorate: 'গভর্নরেট',
      notes: 'নোট'
    };
  }

  return {
    openDetails: 'Open order details',
    orderDetails: 'Order details',
    fullPathway: 'Full pathway',
    status: 'Status',
    orderDate: 'Order date',
    created: 'Created',
    governorate: 'Governorate',
    notes: 'Notes'
  };
};

const formatDateTime = (value: string | null | undefined, language: DriverLanguage, copy: DriverCopy) => {
  if (!value) return copy.common.notRecorded;
  try {
    return new Intl.DateTimeFormat(localeByLanguage[language], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatMonth = (value: string | null | undefined, language: DriverLanguage, copy: DriverCopy) => {
  if (!value) return copy.target.thisMonth;
  try {
    return new Intl.DateTimeFormat(localeByLanguage[language], { month: 'long', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
  } catch {
    return value;
  }
};

const activeRouteTitle = (count: number, copy: DriverCopy) =>
  count ? `${count} ${copy.home.activeDeliveries}` : copy.home.noActiveRoute;

const formatShiftHours = (minutes: number | null | undefined, copy: DriverCopy) =>
  `${(Math.max(0, Number(minutes || 0)) / 60).toFixed(1)}${copy.profile.hoursUnit}`;

const formatDistanceMeters = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;

const shiftLocationCopy = (language: DriverLanguage) => {
  if (language === 'ar') {
    return {
      label: 'فرع الدوام',
      checking: 'جارٍ تحديد أقرب فرع...',
      inside: 'داخل النطاق',
      outside: 'خارج النطاق',
      unavailable: 'لا يوجد فرع داخل النطاق',
      recheck: 'إعادة الفحص'
    };
  }
  if (language === 'ur') {
    return {
      label: 'ڈیوٹی برانچ',
      checking: 'قریبی برانچ چیک ہو رہی ہے...',
      inside: 'حد کے اندر',
      outside: 'حد سے باہر',
      unavailable: 'حد میں کوئی برانچ نہیں',
      recheck: 'دوبارہ چیک'
    };
  }
  if (language === 'bn') {
    return {
      label: 'ডিউটি ব্রাঞ্চ',
      checking: 'নিকটতম ব্রাঞ্চ চেক হচ্ছে...',
      inside: 'রেঞ্জের ভিতরে',
      outside: 'রেঞ্জের বাইরে',
      unavailable: 'রেঞ্জে কোনো ব্রাঞ্চ নেই',
      recheck: 'আবার চেক করুন'
    };
  }

  return {
    label: 'Shift branch',
    checking: 'Checking nearest branch...',
    inside: 'Inside range',
    outside: 'Outside range',
    unavailable: 'No branch in range',
    recheck: 'Recheck'
  };
};

const localizedDriverError = (error: unknown, copy: DriverCopy, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const knownMessages: Record<string, string> = {
    'Could not find this driver code.': copy.login.driverCodeNotFound,
    'Email ID or driver code is required.': copy.login.identifierRequired,
    'Could not load driver session.': copy.errors.couldNotLoadAccess,
    'Driver mobile access requires a driver login': copy.errors.driverLoginRequired,
    'This driver login is not linked to an active delivery driver': copy.errors.driverLoginNotLinked,
    'Could not load assigned orders.': copy.errors.couldNotLoadAssignedOrders,
    'Could not load order history.': copy.errors.couldNotLoadOrderHistory,
    'Could not load duty records.': copy.profile.dutyRecordsUnavailable,
    'Could not load transfer branches.': copy.errors.couldNotLoadTransferBranches,
    'Could not check nearby branch.': copy.errors.couldNotCheckNearbyBranch,
    'Could not start shift.': copy.errors.couldNotStartShift,
    'Could not end shift.': copy.errors.couldNotEndShift,
    'Could not create internal transfer.': copy.errors.couldNotCreateInternalTransfer
  };

  return knownMessages[message] || message || fallback;
};

const shiftBranchStatus = (
  branch: DriverNearbyStartBranch | null | undefined,
  isFetching: boolean,
  error: unknown,
  language: DriverLanguage
) => {
  const text = shiftLocationCopy(language);
  const copy = getDriverCopy(language);
  if (isFetching) {
    return {
      tone: 'neutral' as const,
      title: text.checking,
      detail: text.recheck
    };
  }
  if (branch) {
    const status = branch.isWithinRadius ? text.inside : text.outside;
    return {
      tone: branch.isWithinRadius ? 'ready' as const : 'blocked' as const,
      title: `${branchLabel(branch, copy)} · ${status}`,
      detail: `${formatDistanceMeters(branch.distanceMeters)} / ${formatDistanceMeters(branch.radiusMeters)}`
    };
  }
  return {
    tone: 'blocked' as const,
    title: localizedDriverError(error, copy, text.unavailable),
    detail: text.recheck
  };
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toMonthInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const monthRange = (month: string) => {
  const [yearValue, monthValue] = month.split('-').map(Number);
  const year = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear();
  const monthIndex = Number.isFinite(monthValue) ? Math.max(0, Math.min(11, monthValue - 1)) : new Date().getMonth();
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    dateFrom: toDateInput(start),
    dateTo: toDateInput(end)
  };
};

const recentMonthOptions = (count = 6) => {
  const current = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    return toMonthInput(date);
  });
};

const historyPeriodRange = (period: HistoryPeriodFilter) => {
  if (period === 'all') return { dateFrom: null, dateTo: null };
  const today = new Date();
  const from = new Date(today);

  if (period === 'week') {
    from.setDate(today.getDate() - 6);
  } else if (period === 'month') {
    from.setDate(1);
  }

  return {
    dateFrom: toDateInput(from),
    dateTo: toDateInput(today)
  };
};

const isHistoryStatus = (status: DriverOrderStatus) =>
  status === 'picked_up' || status === 'delivered' || status === 'cancelled';

const orderMatchesHistoryFilters = (
  order: DriverOrder,
  typeFilter: HistoryOrderTypeFilter,
  statusFilter: HistoryStatusFilter,
  periodFilter: HistoryPeriodFilter
) => {
  if (!isHistoryStatus(order.deliveryStatus)) return false;
  if (typeFilter === 'delivery' && order.orderKind !== 'actual_delivery') return false;
  if (typeFilter === 'internal_transfer' && order.orderKind !== 'internal_transfer') return false;
  if (statusFilter !== 'all' && order.deliveryStatus !== statusFilter) return false;

  const range = historyPeriodRange(periodFilter);
  if (range.dateFrom && order.orderDate < range.dateFrom) return false;
  if (range.dateTo && order.orderDate > range.dateTo) return false;
  return true;
};

const historySortTime = (order: DriverOrder) =>
  new Date(order.deliveredAt || order.cancelledAt || order.pickedUpAt || order.assignedAt || order.createdAt).getTime() || 0;

const requestPushToken = async () => {
  if (Platform.OS === 'web') {
    return;
  }

  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const token = await Notifications.getExpoPushTokenAsync();
    if (token.data) await driverApi.registerPushToken(token.data);
  } catch (error) {
    if (__DEV__) console.info('Push token registration skipped', error);
  }
};

const dutyLocationLabel = (record: DriverDutyRecord, copy: DriverCopy) => {
  if (record.startedBranchName) {
    const distance = record.startedDistanceMeters === null || record.startedDistanceMeters === undefined
      ? ''
      : ` · ${formatDistanceMeters(record.startedDistanceMeters)}`;
    return `${record.startedBranchName}${distance}`;
  }

  if (record.startedLat !== null && record.startedLat !== undefined && record.startedLng !== null && record.startedLng !== undefined) {
    return `${record.startedLat.toFixed(6)}, ${record.startedLng.toFixed(6)}`;
  }

  return copy.common.notRecorded;
};

const dutyRecordTotalOrders = (record: DriverDutyRecord) =>
  record.actualDeliveryCount + record.internalTransferCount;

const htmlCell = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildDutyPdfHtml = (records: DriverDutyRecord[], month: string, language: DriverLanguage, copy: DriverCopy) => {
  const rows = records.map(record => `
    <tr>
      <td>${htmlCell(record.statDate)}</td>
      <td>${htmlCell(formatDateTime(record.firstOnlineAt, language, copy))}</td>
      <td>${htmlCell(formatDateTime(record.lastOfflineAt, language, copy))}</td>
      <td>${htmlCell(dutyLocationLabel(record, copy))}</td>
      <td>${htmlCell(formatShiftHours(record.totalWorkingMinutes, copy))}</td>
      <td>${htmlCell(dutyRecordTotalOrders(record))}</td>
      <td>${htmlCell(record.internalTransferCount)}</td>
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          p { margin: 0 0 18px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; background: #f8fafc; color: #64748b; text-transform: uppercase; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
        </style>
      </head>
      <body>
        <h1>${htmlCell(copy.profile.pdfTitle)}</h1>
        <p>${htmlCell(month)}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Start</th>
              <th>Leave</th>
              <th>Starting location</th>
              <th>Hours</th>
              <th>Orders</th>
              <th>Transfers</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const pdfSafeText = (value: string | number, maxLength = 90) => {
  const clean = String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return clean
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

const base64FromBinaryString = (value: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index) & 255;
    const second = index + 1 < value.length ? value.charCodeAt(index + 1) & 255 : 0;
    const third = index + 2 < value.length ? value.charCodeAt(index + 2) & 255 : 0;
    const triple = (first << 16) | (second << 8) | third;

    output += chars[(triple >> 18) & 63];
    output += chars[(triple >> 12) & 63];
    output += index + 1 < value.length ? chars[(triple >> 6) & 63] : '=';
    output += index + 2 < value.length ? chars[triple & 63] : '=';
  }

  return output;
};

const buildSimpleDutyPdf = (records: DriverDutyRecord[], month: string, language: DriverLanguage, copy: DriverCopy) => {
  const pageLines: string[][] = [[]];
  const pushLine = (line: string) => {
    const current = pageLines[pageLines.length - 1];
    if (current.length >= 42) {
      pageLines.push([line]);
      return;
    }
    current.push(line);
  };

  pushLine(`${copy.profile.pdfTitle} - ${month}`);
  pushLine('');
  pushLine('Date       Start        Leave        Hours  Orders  Transfers  Starting location');
  pushLine('--------------------------------------------------------------------------');
  records.forEach(record => {
    const date = record.statDate.padEnd(10).slice(0, 10);
    const start = formatDateTime(record.firstOnlineAt, language, copy).padEnd(12).slice(0, 12);
    const leave = formatDateTime(record.lastOfflineAt, language, copy).padEnd(12).slice(0, 12);
    const hours = formatShiftHours(record.totalWorkingMinutes, copy).padEnd(6).slice(0, 6);
    const orders = String(dutyRecordTotalOrders(record)).padEnd(7).slice(0, 7);
    const transfers = String(record.internalTransferCount).padEnd(9).slice(0, 9);
    const location = dutyLocationLabel(record, copy).slice(0, 35);
    pushLine(`${date}   ${start} ${leave} ${hours} ${orders} ${transfers} ${location}`);
  });

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogObject = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObjectIndex = addObject('');
  const regularFontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const boldFontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageObjectIds: number[] = [];

  pageLines.forEach((lines, pageIndex) => {
    const content = [
      '0.2 w',
      'BT /F2 16 Tf 40 760 Td (Driver Duty Record) Tj ET',
      `BT /F1 9 Tf 40 744 Td (${pdfSafeText(`Month: ${month} | Page ${pageIndex + 1}/${pageLines.length}`, 80)}) Tj ET`,
      '36 732 m 576 732 l S',
      ...lines.map((line, lineIndex) => (
        `BT /F1 8 Tf 40 ${712 - (lineIndex * 15)} Td (${pdfSafeText(line, 115)}) Tj ET`
      ))
    ].join('\n');
    const contentObject = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObject = addObject(`<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    pageObjectIds.push(pageObject);
  });

  objects[pagesObjectIndex - 1] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
  objects[catalogObject - 1] = `<< /Type /Catalog /Pages ${pagesObjectIndex} 0 R >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

const dutyExportFileName = (month: string, extension: 'xls' | 'pdf') =>
  `driver-duty-${month.replace(/[^0-9-]/g, '') || toMonthInput(new Date())}.${extension}`;

type DutyExportFile = {
  uri: string;
  fileName: string;
  mimeType: string;
  title: string;
  uti: string;
  textContent?: string;
};

const shareDutyFile = async (
  uri: string,
  mimeType: string,
  dialogTitle: string,
  uti: string,
  copy: DriverCopy
) => {
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(copy.profile.exportUnavailableText);
  }

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle,
    UTI: uti
  });
};

const saveDutyFileToAndroidFolder = async (
  sourceUri: string,
  fileName: string,
  mimeType: string,
  textContent?: string
) => {
  const FileSystem = await import('expo-file-system/legacy');

  const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
  if (!permissions.granted) return false;

  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    fileName,
    mimeType
  );

  if (textContent !== undefined) {
    await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, textContent, {
      encoding: FileSystem.EncodingType.UTF8
    });
  } else {
    const content = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64
    });
    await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, content, {
      encoding: FileSystem.EncodingType.Base64
    });
  }

  return true;
};

const createDutyExcelFile = async (records: DriverDutyRecord[], month: string, language: DriverLanguage, copy: DriverCopy): Promise<DutyExportFile> => {
  const FileSystem = await import('expo-file-system/legacy');
  if (!FileSystem.cacheDirectory) {
    throw new Error(copy.profile.exportUnavailableText);
  }

  const fileName = dutyExportFileName(month, 'xls');
  const content = buildDutyPdfHtml(records, month, language, copy);
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8
  });

  return { uri, fileName, mimeType: 'application/vnd.ms-excel', title: `${copy.profile.exportExcel} - ${month}`, uti: 'com.microsoft.excel.xls', textContent: content };
};

const createDutyPdfFile = async (records: DriverDutyRecord[], month: string, language: DriverLanguage, copy: DriverCopy): Promise<DutyExportFile> => {
  const FileSystem = await import('expo-file-system/legacy');
  if (!FileSystem.cacheDirectory) {
    throw new Error(copy.profile.exportUnavailableText);
  }

  const fileName = dutyExportFileName(month, 'pdf');
  const pdf = buildSimpleDutyPdf(records, month, language, copy);
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64FromBinaryString(pdf), {
    encoding: FileSystem.EncodingType.Base64
  });

  return { uri, fileName, mimeType: 'application/pdf', title: `${copy.profile.exportPdf} - ${month}`, uti: 'com.adobe.pdf' };
};

const downloadDutyFileOnWeb = (
  records: DriverDutyRecord[],
  month: string,
  language: DriverLanguage,
  copy: DriverCopy,
  format: 'excel' | 'pdf'
) => {
  const fileName = dutyExportFileName(month, format === 'excel' ? 'xls' : 'pdf');
  const content = format === 'excel'
    ? buildDutyPdfHtml(records, month, language, copy)
    : buildSimpleDutyPdf(records, month, language, copy);
  const mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'application/pdf';
  const blob = new Blob(
    [format === 'excel' ? content : Uint8Array.from(content, character => character.charCodeAt(0) & 255)],
    { type: mimeType }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const exportDutyFile = async (
  records: DriverDutyRecord[],
  month: string,
  language: DriverLanguage,
  copy: DriverCopy,
  format: 'excel' | 'pdf'
) => {
  if (Platform.OS === 'web') {
    downloadDutyFileOnWeb(records, month, language, copy, format);
    return;
  }

  const file = format === 'excel'
    ? await createDutyExcelFile(records, month, language, copy)
    : await createDutyPdfFile(records, month, language, copy);

  if (Platform.OS === 'android') {
    try {
      const saved = await saveDutyFileToAndroidFolder(file.uri, file.fileName, file.mimeType, file.textContent);
      if (saved) {
        Alert.alert('Download complete', `${file.fileName} saved to the selected folder.`);
        return;
      }
    } catch (error) {
      if (__DEV__) console.warn('Android duty export save failed, falling back to share.', error);
    }
  }

  await shareDutyFile(file.uri, file.mimeType, file.title, file.uti, copy);
};

const Button = ({
  label,
  onPress,
  tone = 'brand',
  disabled = false
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.button,
      styles[`button_${tone}`],
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed
    ]}
  >
    <Text style={[
      styles.buttonText,
      tone === 'light' && styles.buttonTextLight,
      tone === 'danger' && styles.buttonTextDanger,
      tone === 'warning' && styles.buttonTextLight,
      tone === 'collected' && styles.buttonTextCollected
    ]}>
      {label}
    </Text>
  </Pressable>
);

const Pill = ({
  label,
  tone = 'neutral'
}: {
  label: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
}) => (
  <View style={[styles.pill, styles[`pill_${tone}`]]}>
    <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
  </View>
);

const TabButton = ({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </Pressable>
);

const FilterButton = ({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.filterButton, active && styles.filterButtonActive]}>
    <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
  </Pressable>
);

const LoginField = ({
  label,
  children,
  isRtl = false
}: {
  label: string;
  children: React.ReactNode;
  isRtl?: boolean;
}) => (
  <View style={styles.loginField}>
    <Text style={[styles.loginFieldLabel, isRtl && styles.rtlText]}>{label}</Text>
    {children}
  </View>
);

const PasswordEyeIcon = ({ visible }: { visible: boolean }) => (
  <View style={styles.eyeIcon}>
    <View style={[styles.eyeOutline, visible && styles.eyeOutlineActive]}>
      <View style={[styles.eyePupil, visible && styles.eyePupilActive]} />
    </View>
    {!visible ? <View style={styles.eyeSlash} /> : null}
  </View>
);

type IconName = 'home' | 'orders' | 'history' | 'stats' | 'profile' | 'alert';

const FlatIcon = ({
  name,
  active = false,
  size = 22,
  color
}: {
  name: IconName;
  active?: boolean;
  size?: number;
  color?: string;
}) => {
  const stroke = color || (active ? colors.brand : colors.slate600);
  const accent = color || (active ? colors.brand : colors.slate400);
  const muted = active ? colors.brandSoft : colors.surfaceMuted;
  const scale = size / 22;

  if (name === 'home') {
    return (
      <View style={[styles.iconBox, { width: size, height: size }]}>
        <View style={[
          styles.homeRoof,
          {
            borderLeftWidth: 6 * scale,
            borderRightWidth: 6 * scale,
            borderBottomWidth: 7 * scale,
            borderBottomColor: stroke,
            top: 2 * scale
          }
        ]} />
        <View style={[
          styles.homeBody,
          {
            width: 14 * scale,
            height: 11 * scale,
            borderColor: stroke,
            borderRadius: 3 * scale,
            top: 9 * scale
          }
        ]} />
      </View>
    );
  }

  if (name === 'orders') {
    return (
      <View style={[styles.iconBox, { width: size, height: size }]}>
        <View style={[
          styles.ordersPaper,
          {
            width: 15 * scale,
            height: 18 * scale,
            borderColor: stroke,
            borderRadius: 4 * scale
          }
        ]}>
          <View style={[styles.ordersLine, { width: 8 * scale, backgroundColor: stroke }]} />
          <View style={[styles.ordersLine, { width: 10 * scale, backgroundColor: stroke }]} />
          <View style={[styles.ordersDot, { backgroundColor: accent }]} />
        </View>
      </View>
    );
  }

  if (name === 'history') {
    return (
      <View style={[styles.iconBox, { width: size, height: size }]}>
        <View style={[
          styles.historyCircle,
          {
            width: 18 * scale,
            height: 18 * scale,
            borderRadius: 9 * scale,
            borderColor: stroke
          }
        ]}>
          <View style={[styles.historyHandTall, { height: 6 * scale, backgroundColor: stroke }]} />
          <View style={[styles.historyHandWide, { width: 5 * scale, backgroundColor: stroke }]} />
        </View>
      </View>
    );
  }

  if (name === 'stats') {
    return (
      <View style={[styles.iconBox, { width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 3 * scale }]}>
        {[8, 14, 18].map((height, index) => (
          <View
            key={height}
            style={{
              width: 4 * scale,
              height: height * scale,
              borderRadius: 2 * scale,
              backgroundColor: index === 1 && active ? colors.brand : stroke,
              opacity: index === 0 ? 0.55 : 1
            }}
          />
        ))}
      </View>
    );
  }

  if (name === 'profile') {
    return (
      <View style={[styles.iconBox, { width: size, height: size }]}>
        <View style={[
          styles.profileHead,
          {
            width: 8 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
            borderColor: stroke
          }
        ]} />
        <View style={[
          styles.profileShoulders,
          {
            width: 17 * scale,
            height: 9 * scale,
            borderRadius: 8 * scale,
            borderColor: stroke,
            backgroundColor: muted
          }
        ]} />
      </View>
    );
  }

  return (
    <View style={[styles.iconBox, { width: size, height: size }]}>
      <View style={[
        styles.alertBell,
        {
          width: 15 * scale,
          height: 15 * scale,
          borderRadius: 8 * scale,
          borderColor: stroke
        }
      ]} />
      <View style={[styles.alertClapper, { backgroundColor: stroke }]} />
    </View>
  );
};

const HeaderAction = ({
  icon,
  label,
  onPress,
  hasBadge = false
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  hasBadge?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [
      styles.headerAction,
      pressed && styles.buttonPressed
    ]}
  >
    <FlatIcon name={icon} />
    {hasBadge ? <View style={styles.headerActionBadge} /> : null}
  </Pressable>
);

const HeaderBackButton = ({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [
      styles.headerBackButton,
      pressed && styles.buttonPressed
    ]}
  >
    <Text style={styles.headerBackChevron}>‹</Text>
  </Pressable>
);

const BottomNavButton = ({
  label,
  icon,
  active,
  onPress
}: {
  label: string;
  icon: Exclude<IconName, 'alert' | 'orders'>;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    style={({ pressed }) => [
      styles.bottomNavButton,
      pressed && styles.buttonPressed
    ]}
  >
    <FlatIcon name={icon} active={active} size={21} />
    <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{label}</Text>
  </Pressable>
);

const ForceUpdateScreen = ({
  settings,
  isRtl,
  refreshing,
  onRetry
}: {
  settings: DriverMobileAppSettings;
  isRtl: boolean;
  refreshing: boolean;
  onRetry: () => void;
}) => {
  const currentBuild = currentAndroidBuild();
  const requiredBuild = Math.max(1, Number(settings.androidMinimumBuild || 1));
  const latestBuild = Math.max(requiredBuild, Number(settings.androidLatestBuild || requiredBuild));
  const apkUrl = settings.androidApkUrl?.trim() || '';

  const openApk = async () => {
    if (!apkUrl) {
      Alert.alert('APK link missing', 'Please contact the operations team for the latest driver APK.');
      return;
    }

    try {
      await Linking.openURL(apkUrl);
    } catch {
      Alert.alert('Could not open APK', 'Please contact the operations team for the latest driver APK.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.forceUpdateScroll}>
        <View style={styles.forceUpdatePanel}>
          <View style={styles.forceUpdateBadge}>
            <Text style={styles.forceUpdateBadgeText}>APK UPDATE</Text>
          </View>
          <Text style={[styles.forceUpdateTitle, isRtl && styles.rtlText]}>
            {settings.forceUpdateTitle?.trim() || DEFAULT_MOBILE_SETTINGS.forceUpdateTitle}
          </Text>
          <Text style={[styles.forceUpdateText, isRtl && styles.rtlText]}>
            {settings.forceUpdateMessage?.trim() || DEFAULT_MOBILE_SETTINGS.forceUpdateMessage}
          </Text>

          <View style={styles.forceUpdateMeta}>
            <View style={styles.forceUpdateMetaRow}>
              <Text style={styles.forceUpdateMetaLabel}>Current build</Text>
              <Text style={styles.forceUpdateMetaValue}>{currentBuild}</Text>
            </View>
            <View style={styles.forceUpdateMetaRow}>
              <Text style={styles.forceUpdateMetaLabel}>Required build</Text>
              <Text style={styles.forceUpdateMetaValue}>{requiredBuild}</Text>
            </View>
            <View style={styles.forceUpdateMetaRow}>
              <Text style={styles.forceUpdateMetaLabel}>Latest version</Text>
              <Text style={styles.forceUpdateMetaValue}>
                {settings.androidLatestVersion || '0.1.0'} - {latestBuild}
              </Text>
            </View>
          </View>

          <View style={styles.forceUpdateActions}>
            <Button
              label={apkUrl ? 'Download APK' : 'APK link missing'}
              onPress={openApk}
              tone="warning"
              disabled={!apkUrl}
            />
            <Button
              label={refreshing ? 'Checking...' : 'Check again'}
              onPress={onRetry}
              tone="light"
              disabled={refreshing}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const LoginScreen = ({
  onSignedIn,
  copy,
  isRtl,
  mobileSettings
}: {
  onSignedIn: () => void;
  copy: DriverCopy;
  isRtl: boolean;
  mobileSettings: DriverMobileAppSettings;
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginLogoSource = imageSource(mobileSettings.loginLogoUrl, tabarakLogo);
  const footerLogoSource = imageSource(mobileSettings.footerLogoUrl, hubFooterLogo);
  const footerCredit = mobileSettings.footerCredit?.trim() || DEFAULT_FOOTER_CREDIT;

  const submit = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert(copy.login.missingTitle, copy.login.missingText);
      return;
    }
    setIsSubmitting(true);
    try {
      await driverApi.signIn(identifier, password);
      onSignedIn();
    } catch (error: any) {
      Alert.alert(copy.login.failedTitle, localizedDriverError(error, copy, copy.login.failedFallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.loginWrap}>
        <View style={styles.loginPanel}>
          <View style={styles.loginBrandStack}>
            <View style={styles.loginLogoFrame}>
              <Image source={loginLogoSource} style={styles.loginLogo} resizeMode="contain" />
            </View>
            <Text style={[styles.loginAppBadgeText, isRtl && styles.rtlText]}>{copy.login.appBadge}</Text>
          </View>

          <View style={styles.loginPanelHeader}>
            <Text style={[styles.loginTitle, isRtl && styles.rtlText]}>{copy.login.title}</Text>
            <Text style={[styles.loginPanelTitle, isRtl && styles.rtlText]}>{copy.login.welcome}</Text>
            {copy.login.panelSub ? (
              <Text style={[styles.loginPanelSub, isRtl && styles.rtlText]}>{copy.login.panelSub}</Text>
            ) : null}
          </View>

          <View style={styles.loginForm}>
            <LoginField label={copy.login.identifier} isRtl={isRtl}>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder={copy.login.identifierPlaceholder}
                placeholderTextColor={colors.slate400}
                style={[styles.input, isRtl && styles.rtlInput]}
              />
            </LoginField>
            <LoginField label={copy.login.password} isRtl={isRtl}>
              <View style={[styles.passwordField, isRtl && styles.rtlRow]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  placeholder={copy.login.passwordPlaceholder}
                  placeholderTextColor={colors.slate400}
                  style={[styles.passwordInput, isRtl && styles.rtlInput]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? copy.login.hidePassword : copy.login.showPassword}
                  accessibilityState={{ checked: passwordVisible }}
                  onPress={() => setPasswordVisible(previous => !previous)}
                  style={({ pressed }) => [styles.passwordEyeButton, pressed && styles.buttonPressed]}
                >
                  <PasswordEyeIcon visible={passwordVisible} />
                </Pressable>
              </View>
            </LoginField>
            <Button label={isSubmitting ? copy.login.signingIn : copy.login.signIn} onPress={submit} disabled={isSubmitting} />
          </View>

        </View>

        <View style={styles.loginFooterBrand}>
          <Image source={footerLogoSource} style={styles.loginFooterLogo} resizeMode="contain" />
          <Text style={[styles.loginFooterCredit, isRtl && styles.rtlText]}>{footerCredit}</Text>
        </View>
      </View>
    </View>
  );
};

const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral',
  onPress
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
  onPress?: () => void;
}) => {
  const content = (
    <>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.statTile,
          styles[`statTile_${tone}`],
          styles.statTileClickable,
          pressed && styles.buttonPressed
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.statTile, styles[`statTile_${tone}`]]}>
      {content}
    </View>
  );
};

type MonthlyTarget = NonNullable<DriverSessionPayload['monthlyTarget']>;

const MonthlyTargetCard = ({
  target,
  copy,
  language,
  isRtl
}: {
  target?: MonthlyTarget | null;
  copy: DriverCopy;
  language: DriverLanguage;
  isRtl: boolean;
}) => {
  const progress = Math.max(0, Math.min(100, Number(target?.progressPct || 0)));
  const hasTarget = !!target?.isConfigured && Number(target.targetActualDeliveries || 0) > 0;
  return (
    <View style={styles.targetCard}>
      <View style={[styles.targetHeader, isRtl && styles.rtlRow]}>
        <View>
          <Text style={[styles.targetEyebrow, isRtl && styles.rtlText]}>{copy.target.title}</Text>
          <Text style={[styles.targetTitle, isRtl && styles.rtlText]}>{formatMonth(target?.targetMonth, language, copy)}</Text>
        </View>
        <Pill
          label={hasTarget ? (target?.targetReached ? copy.target.achieved : copy.target.active) : copy.target.notSet}
          tone={hasTarget ? (target?.targetReached ? 'green' : 'blue') : 'amber'}
        />
      </View>

      <View style={[styles.targetScoreRow, isRtl && styles.rtlRow]}>
        <Text style={styles.targetScore}>{target?.actualDeliveries ?? 0}</Text>
        <Text style={styles.targetScoreDivider}>/</Text>
        <Text style={styles.targetGoal}>{target?.targetActualDeliveries ?? 0}</Text>
        <Text style={[styles.targetScoreLabel, isRtl && styles.rtlText]}>{copy.target.actualDeliveries}</Text>
      </View>

      <View style={styles.targetProgressTrack}>
        <View style={[styles.targetProgressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.targetKpiGrid}>
        <View style={styles.targetMetric}>
          <Text style={[styles.targetMetricLabel, isRtl && styles.rtlText]}>{copy.target.remaining}</Text>
          <Text style={styles.targetMetricValue}>{target?.remainingDeliveries ?? 0}</Text>
          <Text style={[styles.targetMetricHint, isRtl && styles.rtlText]}>{copy.target.toTarget}</Text>
        </View>
        <View style={styles.targetMetric}>
          <Text style={[styles.targetMetricLabel, isRtl && styles.rtlText]}>{copy.target.overTarget}</Text>
          <Text style={styles.targetMetricValue}>{target?.overTargetDeliveries ?? 0}</Text>
          <Text style={[styles.targetMetricHint, isRtl && styles.rtlText]}>{copy.target.extraDeliveries}</Text>
        </View>
        <View style={styles.targetMetric}>
          <Text style={[styles.targetMetricLabel, isRtl && styles.rtlText]}>{copy.target.earned}</Text>
          <Text style={styles.targetMetricValue}>{incentiveMoney(target?.earnedIncentiveBhd)}</Text>
          <Text style={[styles.targetMetricHint, isRtl && styles.rtlText]}>{copy.target.incentive}</Text>
        </View>
        <View style={styles.targetMetric}>
          <Text style={[styles.targetMetricLabel, isRtl && styles.rtlText]}>{copy.target.progress}</Text>
          <Text style={styles.targetMetricValue}>{progress}%</Text>
          <Text style={[styles.targetMetricHint, isRtl && styles.rtlText]}>{copy.target.month}</Text>
        </View>
      </View>

      <Text style={[styles.targetFinePrint, isRtl && styles.rtlText]}>
        {hasTarget
          ? formatCopy(copy.target.configuredFinePrint, {
              targetBonus: incentiveMoney(target?.targetIncentiveBhd),
              overTargetBonus: incentiveMoney(target?.overTargetIncentivePerOrderBhd)
            })
          : copy.target.missingFinePrint}
      </Text>
    </View>
  );
};

const InfoRow = ({ label, value, isRtl = false }: { label: string; value: string; isRtl?: boolean }) => (
  <View style={[styles.infoRow, isRtl && styles.rtlRow]}>
    <Text style={[styles.infoLabel, isRtl && styles.rtlText]}>{label}</Text>
    <Text style={[styles.infoValue, isRtl && styles.rtlInfoValue]}>{value}</Text>
  </View>
);

const PaymentCollectionPanel = ({
  order,
  language,
  isRtl,
  forceCollected = false
}: {
  order: DriverOrder;
  language: DriverLanguage;
  isRtl: boolean;
  forceCollected?: boolean;
}) => {
  const text = paymentCollectionText(language);
  const hasCollectionDetails = order.amountToCollectBhd > 0
    || order.cashHandedToDriverBhd > 0
    || Boolean(order.driverPaymentNote);
  const isCollected = forceCollected || (order.paymentCollectionStatus === 'paid' && hasCollectionDetails);
  const shouldShow = order.orderKind !== 'internal_transfer'
    && (hasCollectionDetails || forceCollected);

  if (!shouldShow) return null;

  return (
    <View style={[styles.paymentPanel, isCollected && styles.paymentPanelCollected]}>
      <Text style={[styles.paymentPanelTitle, isCollected && styles.paymentPanelTitleCollected, isRtl && styles.rtlText]}>
        {isCollected ? text.collected : order.paymentCollectionStatus === 'partial' ? text.partial : text.collectOnDelivery}
      </Text>
      {order.amountToCollectBhd > 0 ? (
        <InfoRow label={text.collectFromCustomer} value={paymentMoney(order.amountToCollectBhd)} isRtl={isRtl} />
      ) : null}
      {order.cashHandedToDriverBhd > 0 ? (
        <InfoRow label={text.cashWithDriver} value={paymentMoney(order.cashHandedToDriverBhd)} isRtl={isRtl} />
      ) : null}
      {order.driverPaymentNote ? (
        <Text style={[styles.paymentNote, isCollected && styles.paymentNoteCollected, isRtl && styles.rtlText]}>
          {text.note}: {order.driverPaymentNote}
        </Text>
      ) : null}
    </View>
  );
};

const OrderCard = ({
  order,
  copy,
  language,
  isRtl,
  busy,
  onPickUp,
  onDeliver,
  onConfirmPayment,
  onCancel,
  paymentCollected = false,
  selectable = false,
  selected = false,
  onToggleSelected,
  compact = false
}: {
  order: DriverOrder;
  copy: DriverCopy;
  language: DriverLanguage;
  isRtl: boolean;
  busy?: boolean;
  onPickUp?: (order: DriverOrder) => void;
  onDeliver?: (order: DriverOrder) => void;
  onConfirmPayment?: (order: DriverOrder) => void;
  onCancel?: (order: DriverOrder) => void;
  paymentCollected?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (order: DriverOrder) => void;
  compact?: boolean;
}) => {
  const canPickUp = order.deliveryStatus === 'assigned';
  const canDeliver = order.deliveryStatus === 'picked_up';
  const canConfirmPayment = canDeliver && isDriverPaymentPending(order);
  const isClosed = order.deliveryStatus === 'delivered' || order.deliveryStatus === 'cancelled';
  const isTransfer = order.orderKind === 'internal_transfer';
  const routeLabel = orderRouteLabel(order, copy);
  const fromBranch = order.transferFromBranchName || order.branchName;
  const toBranch = order.transferToBranchName || copy.common.destinationPending;

  return (
    <View style={[styles.orderCard, compact && styles.orderCardCompact]}>
      <View style={[styles.orderTop, isRtl && styles.rtlRow]}>
        {selectable && canPickUp && onToggleSelected ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={formatCopy(copy.order.selectForBatch, { id: orderDisplayNumber(order) })}
            onPress={() => onToggleSelected(order)}
            style={[styles.pickupSelect, selected && styles.pickupSelectActive]}
          >
            <Text style={[styles.pickupSelectText, selected && styles.pickupSelectTextActive]}>
              {selected ? '✓' : '+'}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.orderTitleWrap}>
          <Text style={[styles.orderBranch, isRtl && styles.rtlText]}>{routeLabel}</Text>
          <Text style={[styles.orderMeta, isRtl && styles.rtlText]}>{orderDisplayNumber(order)} - {orderTypeLabel(order, copy)}</Text>
        </View>
        <Pill
          label={statusLabel(order.deliveryStatus, copy)}
          tone={order.deliveryStatus === 'delivered' ? 'green' : order.deliveryStatus === 'cancelled' ? 'red' : 'blue'}
        />
      </View>

      <View style={[styles.orderKindRow, isRtl && styles.rtlRow]}>
        <Text style={[styles.orderKindValue, isRtl && styles.rtlText]}>{isTransfer ? copy.order.transferRoute : copy.common.actualDelivery}</Text>
        <Text style={[styles.orderArea, isRtl && styles.rtlInfoValue]}>{isTransfer ? copy.order.branchToBranch : (order.areaName || order.governorate || copy.order.areaPending)}</Text>
      </View>

      <View style={styles.blockPanel}>
        {isTransfer ? (
          <>
            <InfoRow label={copy.order.fromBranch} value={fromBranch} isRtl={isRtl} />
            <InfoRow label={copy.order.toBranch} value={toBranch} isRtl={isRtl} />
          </>
        ) : (
          <>
            <InfoRow label={copy.order.pharmacyBlock} value={order.blockNumber || copy.order.notEntered} isRtl={isRtl} />
            <InfoRow label={copy.order.area} value={order.areaName || order.governorate || copy.common.pending} isRtl={isRtl} />
          </>
        )}
        <View style={styles.blockStatusRow}>
          <Pill
            label={isTransfer ? copy.order.createdByDriver : (order.blockNumber ? copy.order.recordedByPharmacy : copy.order.noBlockRequired)}
            tone={isTransfer ? 'amber' : (order.blockNumber ? 'blue' : 'neutral')}
          />
        </View>
      </View>

      <PaymentCollectionPanel order={order} language={language} isRtl={isRtl} forceCollected={paymentCollected} />

      {order.notes ? <Text style={[styles.orderNotes, isRtl && styles.rtlText]}>{order.notes}</Text> : null}

      <View style={styles.timeline}>
        <InfoRow label={copy.common.assigned} value={formatDateTime(order.assignedAt || order.createdAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.common.pickedUp} value={formatDateTime(order.pickedUpAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.common.delivered} value={formatDateTime(order.deliveredAt, language, copy)} isRtl={isRtl} />
        {order.pickupBatchId ? (
          <InfoRow
            label={copy.order.pickupRun}
            value={`#${shortId(order.pickupBatchId)}${order.batchDeliverySequence ? ` · ${copy.order.stop} ${order.batchDeliverySequence}` : ''}`}
            isRtl={isRtl}
          />
        ) : null}
      </View>

      {!isClosed && (onPickUp || onDeliver || onConfirmPayment || onCancel) ? (
        <View style={styles.orderActions}>
          {canPickUp && onPickUp ? (
            <Button label={copy.order.pickedUpAction} tone="light" disabled={busy} onPress={() => onPickUp(order)} />
          ) : null}
          {canConfirmPayment && onConfirmPayment ? (
            <Button
              label={paymentCollectionActionText.confirmCollected}
              tone="collected"
              disabled={busy}
              onPress={() => onConfirmPayment(order)}
            />
          ) : null}
          {canDeliver && onDeliver ? (
            <Button
              label={canConfirmPayment ? paymentCollectionActionText.deliveredAndCollected : copy.order.deliveredAction}
              tone="success"
              disabled={busy}
              onPress={() => onDeliver(order)}
            />
          ) : null}
          {onCancel ? (
            <Button label={copy.order.cancelAction} tone="danger" disabled={busy} onPress={() => onCancel(order)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const HistoryOrderStrip = ({
  order,
  copy,
  language,
  isRtl,
  onPress
}: {
  order: DriverOrder;
  copy: DriverCopy;
  language: DriverLanguage;
  isRtl: boolean;
  onPress: (order: DriverOrder) => void;
}) => {
  const isTransfer = order.orderKind === 'internal_transfer';
  const routeLabel = orderRouteLabel(order, copy);
  const fromBranch = order.transferFromBranchName || order.branchName;
  const toBranch = order.transferToBranchName || copy.common.destinationPending;
  const areaValue = order.areaName || order.governorate || copy.common.pending;
  const blockValue = order.blockNumber || copy.order.notEntered;
  const terminalLabel = order.deliveryStatus === 'cancelled' ? copy.common.cancelled : copy.common.delivered;
  const terminalTime = order.deliveryStatus === 'cancelled' ? order.cancelledAt : order.deliveredAt;
  const detailText = historyDetailText(language);
  const pickupRunValue = order.pickupBatchId
    ? ` | ${copy.order.pickupRun} #${shortId(order.pickupBatchId)}${order.batchDeliverySequence ? ` / ${copy.order.stop} ${order.batchDeliverySequence}` : ''}`
    : '';
  const routeDetail = isTransfer
    ? `${copy.order.fromBranch}: ${fromBranch} | ${copy.order.toBranch}: ${toBranch}`
    : `${copy.order.pharmacyBlock}: ${blockValue} | ${copy.order.area}: ${areaValue}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${detailText.openDetails} ${orderDisplayNumber(order)}`}
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.historyStrip, pressed && styles.historyStripPressed]}
    >
      <View style={[styles.historyStripTop, isRtl && styles.rtlRow]}>
        <View style={styles.historyStripTitleWrap}>
          <Text style={[styles.historyStripTitle, isRtl && styles.rtlText]} numberOfLines={1}>{routeLabel}</Text>
          <Text style={[styles.historyStripMeta, isRtl && styles.rtlText]} numberOfLines={2}>
            {orderDisplayNumber(order)} | {orderTypeLabel(order, copy)} | {order.paymentType} | {routeDetail}{pickupRunValue}
          </Text>
        </View>
        <Pill
          label={statusLabel(order.deliveryStatus, copy)}
          tone={order.deliveryStatus === 'delivered' ? 'green' : order.deliveryStatus === 'cancelled' ? 'red' : 'blue'}
        />
      </View>

      {order.notes ? (
        <Text style={[styles.historyStripNotes, isRtl && styles.rtlText]} numberOfLines={1}>{order.notes}</Text>
      ) : null}

      <View style={[styles.historyStripTimeline, isRtl && styles.rtlRow]}>
        <View style={styles.historyTimeCell}>
          <Text style={[styles.historyTimeLabel, isRtl && styles.rtlText]}>{copy.common.assigned}</Text>
          <Text style={[styles.historyTimeValue, isRtl && styles.rtlText]} numberOfLines={1}>
            {formatDateTime(order.assignedAt || order.createdAt, language, copy)}
          </Text>
        </View>
        <View style={styles.historyTimeCell}>
          <Text style={[styles.historyTimeLabel, isRtl && styles.rtlText]}>{copy.common.pickedUp}</Text>
          <Text style={[styles.historyTimeValue, isRtl && styles.rtlText]} numberOfLines={1}>
            {formatDateTime(order.pickedUpAt, language, copy)}
          </Text>
        </View>
        <View style={styles.historyTimeCell}>
          <Text style={[styles.historyTimeLabel, isRtl && styles.rtlText]}>{terminalLabel}</Text>
          <Text style={[styles.historyTimeValue, isRtl && styles.rtlText]} numberOfLines={1}>
            {formatDateTime(terminalTime, language, copy)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const HistoryDetailSheet = ({
  order,
  copy,
  language,
  isRtl,
  onClose
}: {
  order: DriverOrder | null;
  copy: DriverCopy;
  language: DriverLanguage;
  isRtl: boolean;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();

  if (!order) return null;

  const isTransfer = order.orderKind === 'internal_transfer';
  const routeLabel = orderRouteLabel(order, copy);
  const terminalLabel = order.deliveryStatus === 'cancelled' ? copy.common.cancelled : copy.common.delivered;
  const terminalTime = order.deliveryStatus === 'cancelled' ? order.cancelledAt : order.deliveredAt;
  const detailText = historyDetailText(language);
  const pathway = [
    {
      label: copy.common.assigned,
      value: formatDateTime(order.assignedAt || order.createdAt, language, copy),
      done: Boolean(order.assignedAt || order.createdAt)
    },
    {
      label: copy.common.pickedUp,
      value: formatDateTime(order.pickedUpAt, language, copy),
      done: Boolean(order.pickedUpAt)
    },
    {
      label: terminalLabel,
      value: formatDateTime(terminalTime, language, copy),
      done: Boolean(terminalTime)
    }
  ];
  const pickupRunValue = order.pickupBatchId
    ? `#${shortId(order.pickupBatchId)}${order.batchDeliverySequence ? ` / ${copy.order.stop} ${order.batchDeliverySequence}` : ''}`
    : copy.common.notRecorded;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[
          styles.sheet,
          styles.historyDetailSheet,
          { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }
        ]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.historyDetailHeader, isRtl && styles.rtlRow]}>
            <View style={styles.historyDetailTitleWrap}>
              <Text style={[styles.sheetEyebrow, isRtl && styles.rtlText]}>{copy.history.title}</Text>
              <Text style={[styles.sheetTitle, isRtl && styles.rtlText]}>{routeLabel}</Text>
              <Text style={[styles.sheetSub, isRtl && styles.rtlText]}>
                {orderDisplayNumber(order)} | {orderTypeLabel(order, copy)}
              </Text>
            </View>
            <Pill
              label={statusLabel(order.deliveryStatus, copy)}
              tone={order.deliveryStatus === 'delivered' ? 'green' : order.deliveryStatus === 'cancelled' ? 'red' : 'blue'}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyDetailScroll}>
            <View style={styles.blockCompare}>
              <Text style={[styles.historyDetailSectionTitle, isRtl && styles.rtlText]}>{detailText.orderDetails}</Text>
              <InfoRow label={copy.sheet.order} value={orderDisplayNumber(order)} isRtl={isRtl} />
              <InfoRow label={copy.sheet.type} value={orderTypeLabel(order, copy)} isRtl={isRtl} />
              <InfoRow label={detailText.status} value={statusLabel(order.deliveryStatus, copy)} isRtl={isRtl} />
              <InfoRow label={detailText.orderDate} value={order.orderDate || copy.common.notRecorded} isRtl={isRtl} />
              <InfoRow label={detailText.created} value={formatDateTime(order.createdAt, language, copy)} isRtl={isRtl} />
              {isTransfer ? (
                <>
                  <InfoRow label={copy.sheet.from} value={order.transferFromBranchName || order.branchName} isRtl={isRtl} />
                  <InfoRow label={copy.sheet.to} value={order.transferToBranchName || copy.common.destinationPending} isRtl={isRtl} />
                </>
              ) : (
                <>
                  <InfoRow label={copy.sheet.pharmacy} value={order.branchName} isRtl={isRtl} />
                  <InfoRow label={copy.sheet.payment} value={order.paymentType} isRtl={isRtl} />
                  <InfoRow label={copy.sheet.block} value={order.blockNumber || copy.order.notEntered} isRtl={isRtl} />
                  <InfoRow label={copy.order.area} value={order.areaName || copy.common.notRecorded} isRtl={isRtl} />
                  <InfoRow label={detailText.governorate} value={order.governorate || copy.common.notRecorded} isRtl={isRtl} />
                </>
              )}
              <InfoRow label={copy.order.pickupRun} value={pickupRunValue} isRtl={isRtl} />
              <InfoRow label={detailText.notes} value={order.notes || copy.common.notRecorded} isRtl={isRtl} />
            </View>

            <PaymentCollectionPanel order={order} language={language} isRtl={isRtl} />

            <View style={styles.historyPathwayCard}>
              <Text style={[styles.historyDetailSectionTitle, isRtl && styles.rtlText]}>{detailText.fullPathway}</Text>
              {pathway.map((step, index) => (
                <View key={step.label} style={[styles.pathwayStep, isRtl && styles.rtlRow]}>
                  <View style={styles.pathwayMarker}>
                    <View style={[styles.pathwayDot, step.done && styles.pathwayDotDone]} />
                    {index < pathway.length - 1 ? <View style={styles.pathwayLine} /> : null}
                  </View>
                  <View style={styles.pathwayContent}>
                    <Text style={[styles.pathwayLabel, isRtl && styles.rtlText]}>{step.label}</Text>
                    <Text style={[styles.pathwayTime, isRtl && styles.rtlText]}>{step.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.sheetActions, isRtl && styles.rtlRow]}>
            <Button label={copy.common.back} tone="light" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DeliveryConfirmSheet = ({
  order,
  copy,
  language,
  isRtl,
  busy,
  onClose,
  onConfirm
}: {
  order: DriverOrder | null;
  copy: DriverCopy;
  language: DriverLanguage;
  isRtl: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (order: DriverOrder, notes: string | null) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes('');
  }, [order?.id]);

  if (!order) return null;

  const submit = () => {
    onConfirm(order, notes.trim() || null);
  };
  const requiresPaymentConfirmation = isDriverPaymentPending(order);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetEyebrow, isRtl && styles.rtlText]}>{order.orderKind === 'internal_transfer' ? copy.sheet.transferConfirmation : copy.sheet.deliveryConfirmation}</Text>
          <Text style={[styles.sheetTitle, isRtl && styles.rtlText]}>{order.orderKind === 'internal_transfer' ? copy.sheet.completeTransfer : copy.sheet.markOrderDelivered}</Text>
          <Text style={[styles.sheetSub, isRtl && styles.rtlText]}>{copy.sheet.sub}</Text>

          <View style={styles.blockCompare}>
            <InfoRow label={copy.sheet.order} value={orderDisplayNumber(order)} isRtl={isRtl} />
            <InfoRow label={copy.sheet.type} value={orderTypeLabel(order, copy)} isRtl={isRtl} />
            {order.orderKind === 'internal_transfer' ? (
              <>
                <InfoRow label={copy.sheet.from} value={order.transferFromBranchName || order.branchName} isRtl={isRtl} />
                <InfoRow label={copy.sheet.to} value={order.transferToBranchName || copy.common.destinationPending} isRtl={isRtl} />
              </>
            ) : (
              <>
                <InfoRow label={copy.sheet.pharmacy} value={order.branchName} isRtl={isRtl} />
                <InfoRow label={copy.sheet.payment} value={order.paymentType} isRtl={isRtl} />
                <InfoRow label={copy.sheet.block} value={order.blockNumber || copy.common.notRequired} isRtl={isRtl} />
              </>
            )}
          </View>

          <PaymentCollectionPanel order={order} language={language} isRtl={isRtl} />

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={copy.sheet.optionalNote}
            placeholderTextColor={colors.slate400}
            multiline
            style={[styles.input, styles.noteInput, isRtl && styles.rtlInput]}
          />

          <View style={[styles.sheetActions, isRtl && styles.rtlRow]}>
            <Button label={copy.common.back} tone="light" onPress={onClose} disabled={busy} />
            <Button
              label={requiresPaymentConfirmation ? paymentCollectionActionText.deliveredAndCollected : copy.sheet.markDelivered}
              tone="success"
              onPress={submit}
              disabled={busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const EmptyState = ({
  title,
  text,
  isRtl = false
}: {
  title: string;
  text: string;
  isRtl?: boolean;
}) => (
  <View style={styles.emptyState}>
    <Text style={[styles.emptyTitle, isRtl && styles.rtlText]}>{title}</Text>
    <Text style={[styles.emptyText, isRtl && styles.rtlText]}>{text}</Text>
  </View>
);

const BranchDropdown = ({
  label,
  branches,
  value,
  onChange,
  open,
  onToggle,
  isRtl = false
}: {
  label: string;
  branches: DriverBranchOption[];
  value: string;
  onChange: (branchId: string) => void;
  open: boolean;
  onToggle: () => void;
  isRtl?: boolean;
}) => {
  const selected = branches.find(branch => branch.id === value);

  const chooseBranch = (branchId: string) => {
    onChange(branchId);
  };

  return (
    <View style={styles.branchDropdownWrap}>
      <Text style={[styles.branchDropdownLabel, isRtl && styles.rtlText]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={[styles.branchDropdownTrigger, isRtl && styles.rtlRow]}
      >
        <View style={styles.branchDropdownValue}>
          <Text style={[styles.branchDropdownCode, isRtl && styles.rtlText]}>{selected?.code || 'BR'}</Text>
          <Text style={[styles.branchDropdownName, isRtl && styles.rtlText]}>
            {selected?.name || label}
          </Text>
        </View>
        <Text style={styles.branchDropdownChevron}>{open ? '^' : 'v'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.branchDropdownMenu}>
          {branches.map(branch => {
            const active = branch.id === value;
            return (
              <Pressable
                key={branch.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => chooseBranch(branch.id)}
                style={[styles.branchDropdownItem, active && styles.branchDropdownItemActive, isRtl && styles.rtlRow]}
              >
                <View style={styles.branchDropdownValue}>
                  <Text style={[styles.branchDropdownCode, active && styles.branchDropdownTextActive, isRtl && styles.rtlText]}>
                    {branch.code || 'BR'}
                  </Text>
                  <Text style={[styles.branchDropdownName, active && styles.branchDropdownTextActive, isRtl && styles.rtlText]}>
                    {branch.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const LanguageSelector = ({
  language,
  copy,
  isRtl,
  onChange
}: {
  language: DriverLanguage;
  copy: DriverCopy;
  isRtl: boolean;
  onChange: (language: DriverLanguage) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = driverLanguageOptions.find(option => option.code === language) || driverLanguageOptions[0];

  const chooseLanguage = (nextLanguage: DriverLanguage) => {
    onChange(nextLanguage);
    setOpen(false);
  };

  return (
    <View style={styles.languageDropdownSection}>
      <Text style={[styles.loginFieldLabel, isRtl && styles.rtlText]}>{copy.profile.languageTitle}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(previous => !previous)}
        style={[styles.languageDropdownTrigger, isRtl && styles.rtlRow]}
      >
        <View style={styles.languageDropdownValue}>
          <Text style={[styles.languageOptionNative, isRtl && styles.rtlText]}>{selected.nativeLabel}</Text>
          <Text style={[styles.languageOptionText, isRtl && styles.rtlText]}>{selected.label}</Text>
        </View>
        <Text style={styles.languageDropdownChevron}>v</Text>
      </Pressable>
      {open ? (
        <View style={styles.languageDropdownMenu}>
          {driverLanguageOptions.map(option => {
            const active = option.code === language;
            return (
              <Pressable
                key={option.code}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => chooseLanguage(option.code)}
                style={[styles.languageDropdownItem, active && styles.languageDropdownItemActive, isRtl && styles.rtlRow]}
              >
                <Text style={[styles.languageOptionNative, active && styles.languageOptionTextActive, isRtl && styles.rtlText]}>
                  {option.nativeLabel}
                </Text>
                <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive, isRtl && styles.rtlText]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const ThemeSelector = ({
  themeMode,
  copy,
  isRtl,
  onChange
}: {
  themeMode: DriverThemeMode;
  copy: DriverCopy;
  isRtl: boolean;
  onChange: (themeMode: DriverThemeMode) => void;
}) => {
  const options: Array<{ mode: DriverThemeMode; label: string; hint: string }> = [
    { mode: 'light', label: copy.profile.lightTheme, hint: copy.profile.lightThemeHint },
    { mode: 'dark', label: copy.profile.darkTheme, hint: copy.profile.darkThemeHint }
  ];

  return (
    <View style={styles.languageDropdownSection}>
      <Text style={[styles.loginFieldLabel, isRtl && styles.rtlText]}>{copy.profile.themeTitle}</Text>
      <Text style={[styles.filterHint, isRtl && styles.rtlText]}>{copy.profile.themeText}</Text>
      <View style={[styles.themeSwitchRow, isRtl && styles.rtlRow]}>
        {options.map(option => {
          const active = option.mode === themeMode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.mode)}
              style={[styles.themeChoice, active && styles.themeChoiceActive]}
            >
              <Text style={[styles.themeChoiceText, active && styles.themeChoiceTextActive, isRtl && styles.rtlText]}>
                {option.label}
              </Text>
              <Text style={[styles.themeChoiceHint, active && styles.themeChoiceTextActive, isRtl && styles.rtlText]}>
                {active ? copy.profile.themeSelected : option.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const Dashboard = ({
  onSignedOut,
  language,
  onLanguageChange,
  themeMode,
  onThemeChange
}: {
  onSignedOut: () => void;
  language: DriverLanguage;
  onLanguageChange: (language: DriverLanguage) => void;
  themeMode: DriverThemeMode;
  onThemeChange: (themeMode: DriverThemeMode) => void;
}) => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const copy = useMemo(() => getDriverCopy(language), [language]);
  const isWideLayout = width >= 720;
  const isRtl = isRtlLanguage(language);
  const alarmPlayer = useAudioPlayer(driverAlarmSound, { downloadFirst: true, keepAudioSessionActive: true });
  const previousIncomingOrderIdsRef = useRef<Set<string> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryOrderTypeFilter>('delivery');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<HistoryPeriodFilter>('all');
  const [deliveryDraft, setDeliveryDraft] = useState<DriverOrder | null>(null);
  const [historyDetailOrder, setHistoryDetailOrder] = useState<DriverOrder | null>(null);
  const [recentHistoryOrders, setRecentHistoryOrders] = useState<DriverOrder[]>([]);
  const [paymentCollectedOrderIds, setPaymentCollectedOrderIds] = useState<Set<string>>(() => new Set());
  const [selectedPickupOrderIds, setSelectedPickupOrderIds] = useState<Set<string>>(() => new Set());
  const [transferFromBranchId, setTransferFromBranchId] = useState('');
  const [transferToBranchId, setTransferToBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [openTransferBranchDropdown, setOpenTransferBranchDropdown] = useState<'from' | 'to' | null>(null);
  const [dutyMonthFilter, setDutyMonthFilter] = useState(() => toMonthInput(new Date()));
  const [isExportingDuty, setIsExportingDuty] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['driver-session'],
    queryFn: driverApi.session
  });

  const ordersQuery = useQuery({
    queryKey: ['driver-active-orders'],
    queryFn: driverApi.activeOrders,
    refetchInterval: 10000
  });

  const historyQuery = useQuery({
    queryKey: ['driver-order-history', historyTypeFilter, historyStatusFilter, historyPeriodFilter],
    queryFn: () => {
      const range = historyPeriodRange(historyPeriodFilter);
      return driverApi.orderHistory({
        status: historyStatusFilter === 'all' ? null : historyStatusFilter,
        orderKind: historyTypeFilter === 'internal_transfer' ? 'internal_transfer' : 'actual_delivery',
        dateFrom: range.dateFrom,
        dateTo: range.dateTo
      });
    }
  });

  const dutyMonthRange = useMemo(() => monthRange(dutyMonthFilter), [dutyMonthFilter]);
  const dutyMonthOptions = useMemo(() => recentMonthOptions(6), []);

  const dutyRecordsQuery = useQuery({
    queryKey: ['driver-duty-records', dutyMonthFilter],
    queryFn: () => driverApi.dutyRecords(dutyMonthRange.dateFrom, dutyMonthRange.dateTo),
    enabled: activeTab === 'dutyRecord' && Boolean(sessionQuery.data)
  });

  const transferBranchesQuery = useQuery({
    queryKey: ['driver-transfer-branches'],
    queryFn: driverApi.transferBranches
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['driver-session'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-active-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-order-history'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-duty-records'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-transfer-branches'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-nearby-start-branch'] })
    ]);
  }, [queryClient]);

  const markPaymentCollectedLocally = useCallback((orderId: string) => {
    setPaymentCollectedOrderIds(previous => {
      const next = new Set(previous);
      next.add(orderId);
      return next;
    });
    queryClient.setQueryData<DriverOrder[]>(['driver-active-orders'], current => (
      current?.map(order => order.id === orderId
        ? { ...order, paymentCollectionStatus: 'paid', amountToCollectBhd: 0 }
        : order
      ) || current
    ));
  }, [queryClient]);

  const syncQueue = useCallback(async () => {
    setIsSyncing(true);
    try {
      await flushQueuedActions(action =>
        driverApi.transitionOrder(action.orderId, action.nextStatus, action.notes, action.id)
      );
      await refreshAll();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshAll]);

  const playDriverAlarm = useCallback(() => {
    try {
      alarmPlayer.volume = 1;
      alarmPlayer.loop = false;
      void alarmPlayer.seekTo(0).catch(error => console.warn('Driver alarm reset skipped', error));
      alarmPlayer.play();
    } catch (error) {
      console.warn('Driver alarm playback skipped', error);
    }
  }, [alarmPlayer]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false
    }).catch(error => console.warn('Audio mode setup skipped', error));
  }, []);

  useEffect(() => {
    requestPushToken();
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) syncQueue().catch(error => console.warn('Queue sync failed', error));
    });
    return unsubscribe;
  }, [syncQueue]);

  const readDutyStartLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error(copy.errors.locationPermissionDenied);
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy ?? null
      };
    } catch {
      throw new Error(copy.errors.locationUnavailable);
    }
  }, [copy]);

  const nearbyStartBranchQuery = useQuery({
    queryKey: ['driver-nearby-start-branch'],
    queryFn: async () => {
      const location = await readDutyStartLocation();
      return driverApi.nearbyStartBranch(location);
    },
    enabled: activeTab === 'home' && Boolean(sessionQuery.data) && !sessionQuery.data?.activeShift,
    refetchInterval: 30000,
    retry: false
  });

  const shiftMutation = useMutation({
    mutationFn: async (next: 'start' | 'end') => {
      if (next === 'end') return driverApi.endShift();
      const location = await readDutyStartLocation();
      return driverApi.startShift(location);
    },
    onSuccess: refreshAll,
    onError: (error: any) => Alert.alert(copy.errors.shiftUpdateFailed, localizedDriverError(error, copy, copy.errors.couldNotUpdateShift))
  });

  const orderMutation = useMutation({
    mutationFn: async ({
      order,
      nextStatus,
      notes,
    }: {
      order: DriverOrder;
      nextStatus: DriverOrderStatus;
      notes?: string | null;
    }) => {
      const network = await NetInfo.fetch();
      const actionNotes = notes || (nextStatus === 'cancelled' ? copy.errors.cancelledFromMobile : null);
      if (!network.isConnected) {
        if (nextStatus === 'delivered' && isDriverPaymentPending(order)) {
          throw new Error(paymentCollectionActionText.connectBeforeConfirm);
        }
        await enqueueOrderAction(
          order.id,
          nextStatus,
          actionNotes ? `${actionNotes} ${copy.errors.offlineSuffix}` : null
        );
        return { result: 'queued' as const, order, nextStatus };
      }
      const settledOrder = nextStatus === 'delivered' && isDriverPaymentPending(order)
        ? { ...order, paymentCollectionStatus: 'paid' as const, amountToCollectBhd: 0 }
        : order;
      if (settledOrder !== order) {
        await driverApi.confirmPaymentCollected(order.id);
      }
      await driverApi.transitionOrder(order.id, nextStatus, actionNotes);
      return { result: 'sent' as const, order: settledOrder, nextStatus };
    },
    onSuccess: async ({ result, order, nextStatus }) => {
      setDeliveryDraft(null);
      if (result === 'sent' && isHistoryStatus(nextStatus)) {
        const changedAt = new Date().toISOString();
        const recentOrder: DriverOrder = {
          ...order,
          deliveryStatus: nextStatus,
          pickedUpAt: nextStatus === 'picked_up' ? order.pickedUpAt || changedAt : order.pickedUpAt,
          deliveredAt: nextStatus === 'delivered' ? order.deliveredAt || changedAt : order.deliveredAt,
          cancelledAt: nextStatus === 'cancelled' ? order.cancelledAt || changedAt : order.cancelledAt
        };
        setRecentHistoryOrders(previous => [
          recentOrder,
          ...previous.filter(item => item.id !== order.id)
        ].slice(0, 20));
      }
      await refreshAll();
      if (result === 'queued') Alert.alert(copy.errors.queuedOffline, copy.errors.syncWhenConnected);
    },
    onError: (error: any) => Alert.alert(copy.errors.orderUpdateFailed, localizedDriverError(error, copy, copy.errors.couldNotUpdateOrder))
  });

  const paymentCollectionMutation = useMutation({
    mutationFn: async (order: DriverOrder) => {
      const network = await NetInfo.fetch();
      if (!network.isConnected) throw new Error(paymentCollectionActionText.connectBeforeConfirm);
      await driverApi.confirmPaymentCollected(order.id);
      return order;
    },
    onSuccess: async order => {
      markPaymentCollectedLocally(order.id);
      await refreshAll();
      Alert.alert(paymentCollectionActionText.confirmCollectedSuccessTitle, paymentCollectionActionText.confirmCollectedSuccessText);
    },
    onError: (error: any) => Alert.alert(copy.errors.orderUpdateFailed, localizedDriverError(error, copy, copy.errors.couldNotUpdateOrder))
  });

  const pickupBatchMutation = useMutation({
    mutationFn: async ({ pickupOrders }: { pickupOrders: DriverOrder[] }) => {
      if (pickupOrders.length === 0) throw new Error(copy.errors.selectAtLeastOne);
      const network = await NetInfo.fetch();
      if (!network.isConnected) {
        throw new Error(copy.errors.connectBeforePickup);
      }
      const firstBranchId = pickupOrders[0]?.branchId;
      if (pickupOrders.some(order => order.branchId !== firstBranchId)) {
        throw new Error(copy.errors.onePharmacy);
      }
      await driverApi.pickupOrders(
        pickupOrders.map(order => order.id),
        `pickup:${pickupOrders.map(order => order.id).sort().join(':')}:${Date.now()}`
      );
      return pickupOrders.length;
    },
    onSuccess: async count => {
      setSelectedPickupOrderIds(new Set());
      await refreshAll();
      if (count > 1) {
        Alert.alert(copy.errors.pickupStartedTitle, formatCopy(copy.errors.pickupStartedText, { count }));
      }
    },
    onError: (error: any) => Alert.alert(copy.errors.pickupFailed, localizedDriverError(error, copy, copy.errors.couldNotStartPickup))
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const network = await NetInfo.fetch();
      if (!network.isConnected) throw new Error(copy.transfer.connectBeforeCreate);
      if (!sessionQuery.data?.activeShift) throw new Error(copy.transfer.startDutyBeforeCreate);
      if (!transferFromBranchId || !transferToBranchId) throw new Error(copy.transfer.selectBranches);
      if (transferFromBranchId === transferToBranchId) throw new Error(copy.transfer.differentBranches);
      return driverApi.createInternalTransfer(
        transferFromBranchId,
        transferToBranchId,
        transferNotes.trim() || null
      );
    },
    onSuccess: async () => {
      setTransferNotes('');
      await refreshAll();
      setActiveTab('orders');
      Alert.alert(copy.transfer.createdTitle, copy.transfer.createdText);
    },
    onError: (error: any) => Alert.alert(copy.transfer.failedTitle, localizedDriverError(error, copy, copy.transfer.failedFallback))
  });

  const session = sessionQuery.data;
  const orders = ordersQuery.data || [];
  const serverHistory = historyQuery.data || [];
  const history = useMemo(() => {
    const byId = new Map<string, DriverOrder>();
    serverHistory.forEach(order => byId.set(order.id, order));
    recentHistoryOrders
      .filter(order => orderMatchesHistoryFilters(order, historyTypeFilter, historyStatusFilter, historyPeriodFilter))
      .forEach(order => {
        if (!byId.has(order.id)) byId.set(order.id, order);
      });
    return Array.from(byId.values()).sort((a, b) => historySortTime(b) - historySortTime(a));
  }, [historyPeriodFilter, historyStatusFilter, historyTypeFilter, recentHistoryOrders, serverHistory]);
  const dutyRecords = dutyRecordsQuery.data || [];
  const dutySummary = useMemo(
    () => dutyRecords.reduce(
      (total, record) => ({
        days: total.days + 1,
        minutes: total.minutes + record.totalWorkingMinutes,
        orders: total.orders + dutyRecordTotalOrders(record),
        transfers: total.transfers + record.internalTransferCount
      }),
      { days: 0, minutes: 0, orders: 0, transfers: 0 }
    ),
    [dutyRecords]
  );
  const transferBranches = transferBranchesQuery.data || [];
  const incomingOrders = useMemo(
    () => orders.filter(order => order.deliveryStatus === 'assigned'),
    [orders]
  );
  const selectedPickupOrders = useMemo(
    () => incomingOrders.filter(order => selectedPickupOrderIds.has(order.id)),
    [incomingOrders, selectedPickupOrderIds]
  );
  const activeShift = session?.activeShift;
  const monthlyTarget = session?.monthlyTarget;
  const isBusy = shiftMutation.isPending
    || orderMutation.isPending
    || paymentCollectionMutation.isPending
    || pickupBatchMutation.isPending
    || transferMutation.isPending
    || isSyncing
    || isExportingDuty;
  const isLoading = sessionQuery.isLoading || ordersQuery.isLoading;
  const nearbyStartBranch = nearbyStartBranchQuery.data;
  const shiftBranchInfo = shiftBranchStatus(
    nearbyStartBranch,
    nearbyStartBranchQuery.isFetching,
    nearbyStartBranchQuery.error,
    language
  );
  const shiftButtonDisabled = isBusy || (!activeShift && !nearbyStartBranch?.isWithinRadius);

  useEffect(() => {
    const assignedIds = new Set(incomingOrders.map(order => order.id));
    setSelectedPickupOrderIds(previous => {
      const next = new Set([...previous].filter(orderId => assignedIds.has(orderId)));
      return next.size === previous.size ? previous : next;
    });
  }, [incomingOrders]);

  useEffect(() => {
    if (transferBranches.length === 0) return;
    setTransferFromBranchId(previous => previous || transferBranches[0]?.id || '');
    setTransferToBranchId(previous => {
      if (previous) return previous;
      return transferBranches.find(branch => branch.id !== (transferFromBranchId || transferBranches[0]?.id))?.id || '';
    });
  }, [transferBranches, transferFromBranchId]);

  useEffect(() => {
    if (!transferFromBranchId || transferFromBranchId !== transferToBranchId) return;
    const alternate = transferBranches.find(branch => branch.id !== transferFromBranchId);
    setTransferToBranchId(alternate?.id || '');
  }, [transferBranches, transferFromBranchId, transferToBranchId]);

  useEffect(() => {
    const currentIncomingIds = new Set(incomingOrders.map(order => order.id));

    if (previousIncomingOrderIdsRef.current === null) {
      previousIncomingOrderIdsRef.current = currentIncomingIds;
      return;
    }

    const hasNewIncomingOrder = incomingOrders.some(
      order => !previousIncomingOrderIdsRef.current?.has(order.id)
    );

    previousIncomingOrderIdsRef.current = currentIncomingIds;

    if (hasNewIncomingOrder) {
      playDriverAlarm();
    }
  }, [incomingOrders, playDriverAlarm]);

  const togglePickupSelection = (order: DriverOrder) => {
    if (order.deliveryStatus !== 'assigned') return;
    if (selectedPickupOrderIds.has(order.id)) {
      setSelectedPickupOrderIds(previous => {
        const next = new Set(previous);
        next.delete(order.id);
        return next;
      });
      return;
    }

    const selectedBranchId = selectedPickupOrders[0]?.branchId;
    if (selectedBranchId && selectedBranchId !== order.branchId) {
      Alert.alert(copy.errors.onePharmacyTitle, copy.errors.onePharmacyText);
      return;
    }

    setSelectedPickupOrderIds(previous => new Set(previous).add(order.id));
  };

  const pickupSelectedOrders = () => {
    if (selectedPickupOrders.length === 0) {
      Alert.alert(copy.errors.noOrdersSelectedTitle, copy.errors.noOrdersSelectedText);
      return;
    }
    pickupBatchMutation.mutate({ pickupOrders: selectedPickupOrders });
  };

  const actionOrder = (order: DriverOrder, nextStatus: DriverOrderStatus) => {
    if (nextStatus === 'picked_up') {
      pickupBatchMutation.mutate({ pickupOrders: [order] });
      return;
    }

    if (nextStatus === 'delivered') {
      setDeliveryDraft(order);
      return;
    }

    if (nextStatus === 'cancelled') {
      Alert.alert(copy.errors.cancelTitle, copy.errors.cancelText, [
        { text: copy.errors.keepOrder, style: 'cancel' },
        { text: copy.errors.cancelOrder, style: 'destructive', onPress: () => orderMutation.mutate({ order, nextStatus }) }
      ]);
      return;
    }

    orderMutation.mutate({ order, nextStatus });
  };

  const confirmPaymentCollection = (order: DriverOrder) => {
    Alert.alert(
      paymentCollectionActionText.confirmCollectedTitle,
      paymentCollectionActionText.confirmCollectedMessage.replace('{amount}', paymentMoney(order.amountToCollectBhd)),
      [
        { text: copy.common.back, style: 'cancel' },
        {
          text: paymentCollectionActionText.confirmCollected,
          onPress: () => paymentCollectionMutation.mutate(order)
        }
      ]
    );
  };

  const confirmDelivery = (order: DriverOrder, notes: string | null) => {
    orderMutation.mutate({
      order,
      nextStatus: 'delivered',
      notes
    });
  };

  const signOut = async () => {
    await driverApi.signOut();
    onSignedOut();
  };

  const openNotifications = () => {
    setActiveTab('notifications');
    if (orders.length > 0) {
      playDriverAlarm();
    }
  };

  const openHistoryFromStat = (
    typeFilter: HistoryOrderTypeFilter,
    statusFilter: HistoryStatusFilter = 'all',
    periodFilter: HistoryPeriodFilter = 'today'
  ) => {
    setHistoryTypeFilter(typeFilter);
    setHistoryStatusFilter(statusFilter);
    setHistoryPeriodFilter(periodFilter);
    setActiveTab('history');
  };

  const exportDutyRecords = async (format: 'excel' | 'pdf') => {
    if (dutyRecords.length === 0) {
      Alert.alert(copy.profile.noDutyRecords, copy.profile.noDutyRecordsText);
      return;
    }

    setIsExportingDuty(true);
    try {
      await exportDutyFile(dutyRecords, dutyMonthFilter, language, copy, format);
    } catch (error) {
      Alert.alert(
        error instanceof Error && error.message === copy.profile.exportUnavailableText
          ? copy.profile.exportUnavailableTitle
          : copy.profile.exportFailedTitle,
        error instanceof Error ? error.message : copy.errors.couldNotLoadAccess
      );
    } finally {
      setIsExportingDuty(false);
    }
  };

  const renderHome = () => (
    <View style={styles.tabPane}>
      <View style={styles.shiftCard}>
        <View style={styles.commandCopy}>
          <Text style={[styles.commandLabel, isRtl && styles.rtlText]}>{activeShift ? copy.home.onlineLabel : copy.home.offlineLabel}</Text>
          <Text style={[styles.commandTitle, isRtl && styles.rtlText]}>{activeRouteTitle(orders.length, copy)}</Text>
          <Text style={[styles.commandText, isRtl && styles.rtlText]}>
            {activeShift ? copy.home.onlineText : copy.home.offlineText}
          </Text>
        </View>
        {!activeShift ? (
          <Pressable
            onPress={() => {
              void nearbyStartBranchQuery.refetch();
            }}
            style={[styles.shiftBranchPanel, styles[`shiftBranchPanel_${shiftBranchInfo.tone}`]]}
          >
            <View style={styles.shiftBranchCopy}>
              <Text style={[styles.shiftBranchLabel, isRtl && styles.rtlText]}>{shiftLocationCopy(language).label}</Text>
              <Text style={[styles.shiftBranchTitle, isRtl && styles.rtlText]}>{shiftBranchInfo.title}</Text>
              <Text style={[styles.shiftBranchMeta, isRtl && styles.rtlText]}>{shiftBranchInfo.detail}</Text>
            </View>
            <Text style={[styles.shiftBranchAction, isRtl && styles.rtlText]}>{shiftLocationCopy(language).recheck}</Text>
          </Pressable>
        ) : null}
        <Button
          label={activeShift ? copy.common.endShift : copy.common.startShift}
          tone={activeShift ? 'light' : 'brand'}
          disabled={shiftButtonDisabled}
          onPress={() => shiftMutation.mutate(activeShift ? 'end' : 'start')}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatTile label={copy.common.active} value={orders.length} hint={copy.home.assignedRoute} />
        <StatTile label={copy.common.incoming} value={incomingOrders.length} hint={copy.home.readyToPickUp} tone={incomingOrders.length ? 'amber' : 'neutral'} />
        <StatTile label={copy.common.actual} value={session?.stats.actualDeliveryCount ?? 0} hint={copy.common.deliveredToday} tone="green" />
        <StatTile label={copy.common.transfers} value={session?.stats.internalTransferCount ?? 0} hint={copy.common.completedToday} tone="amber" />
        <StatTile label={copy.common.hours} value={formatShiftHours(session?.stats.totalWorkingMinutes, copy)} hint={copy.home.shiftTime} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.home.nextOrder}</Text>
        <Pressable onPress={() => setActiveTab('orders')}>
          <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.home.viewAll}</Text>
        </Pressable>
      </View>

      {orders[0] ? (
        <OrderCard
          order={orders[0]}
          copy={copy}
          language={language}
          isRtl={isRtl}
          busy={isBusy}
          onPickUp={order => actionOrder(order, 'picked_up')}
          onDeliver={order => actionOrder(order, 'delivered')}
          onConfirmPayment={confirmPaymentCollection}
          onCancel={order => actionOrder(order, 'cancelled')}
          paymentCollected={paymentCollectedOrderIds.has(orders[0].id)}
          compact
        />
      ) : (
        <EmptyState title={copy.home.emptyTitle} text={copy.home.emptyText} isRtl={isRtl} />
      )}

      <View style={styles.commandCard}>
        <View style={styles.commandCopy}>
          <Text style={[styles.commandLabel, isRtl && styles.rtlText]}>{copy.common.internalTransfer}</Text>
          <Text style={[styles.commandTitle, isRtl && styles.rtlText]}>{copy.home.transferTitle}</Text>
          <Text style={[styles.commandText, isRtl && styles.rtlText]}>{copy.home.transferText}</Text>
        </View>
        <Button
          label={copy.home.newTransfer}
          tone="dark"
          disabled={isBusy}
          onPress={() => setActiveTab('transfer')}
        />
      </View>
    </View>
  );

  const renderOrders = () => (
    <View style={styles.tabPane}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.orders.title}</Text>
        <View style={styles.sectionHeaderActions}>
          {selectedPickupOrders.length > 0 ? (
            <Pressable onPress={pickupSelectedOrders} disabled={isBusy}>
              <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.orders.pickUp} {selectedPickupOrders.length}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={syncQueue} disabled={isBusy}>
            <Text style={[styles.linkText, isRtl && styles.rtlText]}>{isSyncing ? copy.orders.syncing : copy.orders.syncQueue}</Text>
          </Pressable>
        </View>
      </View>
      {incomingOrders.length > 1 ? (
        <Text style={[styles.batchHint, isRtl && styles.rtlText]}>{copy.orders.batchHint}</Text>
      ) : null}
      {orders.length === 0 ? (
        <EmptyState title={copy.orders.clearTitle} text={copy.orders.clearText} isRtl={isRtl} />
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            copy={copy}
            language={language}
            isRtl={isRtl}
            busy={isBusy}
            onPickUp={nextOrder => actionOrder(nextOrder, 'picked_up')}
            onDeliver={nextOrder => actionOrder(nextOrder, 'delivered')}
            onConfirmPayment={confirmPaymentCollection}
            onCancel={nextOrder => actionOrder(nextOrder, 'cancelled')}
            paymentCollected={paymentCollectedOrderIds.has(order.id)}
            selectable
            selected={selectedPickupOrderIds.has(order.id)}
            onToggleSelected={togglePickupSelection}
          />
        ))
      )}
    </View>
  );

  const renderTransfer = () => {
    const fromBranch = transferBranches.find(branch => branch.id === transferFromBranchId);
    const toBranch = transferBranches.find(branch => branch.id === transferToBranchId);
    const canCreateTransfer = !!activeShift
      && !!transferFromBranchId
      && !!transferToBranchId
      && transferFromBranchId !== transferToBranchId
      && transferBranches.length >= 2
      && !isBusy;

    return (
      <View style={styles.tabPane}>
        <View style={styles.transferHero}>
          <Text style={[styles.commandLabel, isRtl && styles.rtlText]}>{copy.transfer.title}</Text>
          <Text style={[styles.commandTitle, isRtl && styles.rtlText]}>{copy.transfer.createTitle}</Text>
          <Text style={[styles.commandText, isRtl && styles.rtlText]}>{copy.transfer.text}</Text>
          <View style={styles.transferSummary}>
            <InfoRow label={copy.transfer.from} value={branchLabel(fromBranch, copy)} isRtl={isRtl} />
            <InfoRow label={copy.transfer.to} value={branchLabel(toBranch, copy)} isRtl={isRtl} />
            <InfoRow label={copy.common.duty} value={activeShift ? copy.common.online : copy.transfer.dutyStartFirst} isRtl={isRtl} />
          </View>
        </View>

        {transferBranchesQuery.isLoading ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator color={colors.brand} />
            <Text style={[styles.loadingText, isRtl && styles.rtlText]}>{copy.transfer.loadingBranches}</Text>
          </View>
        ) : transferBranchesQuery.error ? (
        <EmptyState title={copy.transfer.unavailableTitle} text={localizedDriverError(transferBranchesQuery.error, copy, copy.transfer.unavailableFallback)} isRtl={isRtl} />
        ) : transferBranches.length < 2 ? (
          <EmptyState title={copy.transfer.notEnoughTitle} text={copy.transfer.notEnoughText} isRtl={isRtl} />
        ) : (
          <View style={styles.transferForm}>
            <BranchDropdown
              label={copy.transfer.fromBranch}
              branches={transferBranches}
              value={transferFromBranchId}
              onChange={branchId => {
                setTransferFromBranchId(branchId);
                setOpenTransferBranchDropdown(null);
              }}
              open={openTransferBranchDropdown === 'from'}
              onToggle={() => setOpenTransferBranchDropdown(previous => previous === 'from' ? null : 'from')}
              isRtl={isRtl}
            />
            <BranchDropdown
              label={copy.transfer.toBranch}
              branches={transferBranches.filter(branch => branch.id !== transferFromBranchId)}
              value={transferToBranchId}
              onChange={branchId => {
                setTransferToBranchId(branchId);
                setOpenTransferBranchDropdown(null);
              }}
              open={openTransferBranchDropdown === 'to'}
              onToggle={() => setOpenTransferBranchDropdown(previous => previous === 'to' ? null : 'to')}
              isRtl={isRtl}
            />
            <View style={styles.loginField}>
              <Text style={[styles.loginFieldLabel, isRtl && styles.rtlText]}>{copy.transfer.notes}</Text>
              <TextInput
                value={transferNotes}
                onChangeText={setTransferNotes}
                placeholder={copy.transfer.optionalNote}
                placeholderTextColor={colors.slate400}
                multiline
                style={[styles.input, styles.noteInput, styles.sheetInput, isRtl && styles.rtlInput]}
              />
            </View>
            {!activeShift ? (
              <View style={styles.warningBox}>
                <Text style={[styles.warningTitle, isRtl && styles.rtlText]}>{copy.transfer.dutyRequiredTitle}</Text>
                <Text style={[styles.warningText, isRtl && styles.rtlText]}>{copy.transfer.dutyRequiredText}</Text>
              </View>
            ) : null}
            <Button
              label={transferMutation.isPending ? copy.transfer.creating : copy.transfer.create}
              tone="brand"
              disabled={!canCreateTransfer}
              onPress={() => transferMutation.mutate()}
            />
          </View>
        )}
      </View>
    );
  };

  const renderNotifications = () => (
    <View style={styles.tabPane}>
      <View style={styles.notificationHero}>
        <View style={styles.notificationHeroIcon}>
          <FlatIcon name="alert" active size={28} color={colors.brand} />
          {incomingOrders.length > 0 ? <View style={styles.notificationPulse} /> : null}
        </View>
        <View style={styles.notificationHeroCopy}>
          <Text style={[styles.notificationEyebrow, isRtl && styles.rtlText]}>{copy.notifications.eyebrow}</Text>
          <Text style={[styles.notificationTitle, isRtl && styles.rtlText]}>
            {incomingOrders.length ? `${incomingOrders.length} ${copy.notifications.newAlerts}` : copy.notifications.noNewAlerts}
          </Text>
          <Text style={[styles.notificationText, isRtl && styles.rtlText]}>{copy.notifications.text}</Text>
        </View>
        <Button label={copy.notifications.playAlarm} tone="warning" disabled={orders.length === 0} onPress={playDriverAlarm} />
      </View>

      <View style={styles.statsGrid}>
        <StatTile label={copy.common.incoming} value={incomingOrders.length} hint={copy.notifications.assignedNow} tone={incomingOrders.length ? 'amber' : 'green'} />
        <StatTile label={copy.notifications.activeRoute} value={orders.length} hint={copy.notifications.activeRouteHint} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.notifications.allComingOrders}</Text>
        <View style={styles.sectionHeaderActions}>
          {selectedPickupOrders.length > 0 ? (
            <Pressable onPress={pickupSelectedOrders} disabled={isBusy}>
              <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.orders.pickUp} {selectedPickupOrders.length}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={refreshAll}>
            <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.common.refresh}</Text>
          </Pressable>
        </View>
      </View>
      {incomingOrders.length > 1 ? (
        <Text style={[styles.batchHint, isRtl && styles.rtlText]}>{copy.notifications.batchHint}</Text>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState title={copy.notifications.emptyTitle} text={copy.notifications.emptyText} isRtl={isRtl} />
      ) : (
        orders.map(order => (
          <View key={order.id} style={styles.notificationOrderWrap}>
            <View style={[styles.notificationOrderHeader, isRtl && styles.rtlRow]}>
              <View>
                <Text style={[styles.notificationOrderLabel, isRtl && styles.rtlText]}>
                  {order.deliveryStatus === 'assigned'
                    ? formatCopy(copy.notifications.newOrderFrom, { route: orderRouteLabel(order, copy) })
                    : formatCopy(copy.notifications.inProgress, { route: orderRouteLabel(order, copy) })}
                </Text>
                <Text style={[styles.notificationOrderTime, isRtl && styles.rtlText]}>
                  {formatDateTime(order.assignedAt || order.createdAt, language, copy)}
                </Text>
              </View>
              <Pill
                label={order.deliveryStatus === 'assigned' ? copy.notifications.alarmReady : copy.notifications.routeActive}
                tone={order.deliveryStatus === 'assigned' ? 'amber' : 'blue'}
              />
            </View>
            <OrderCard
              order={order}
              copy={copy}
              language={language}
              isRtl={isRtl}
              busy={isBusy}
              onPickUp={nextOrder => actionOrder(nextOrder, 'picked_up')}
              onDeliver={nextOrder => actionOrder(nextOrder, 'delivered')}
              onConfirmPayment={confirmPaymentCollection}
              onCancel={nextOrder => actionOrder(nextOrder, 'cancelled')}
              paymentCollected={paymentCollectedOrderIds.has(order.id)}
              selectable
              selected={selectedPickupOrderIds.has(order.id)}
              onToggleSelected={togglePickupSelection}
              compact
            />
          </View>
        ))
      )}
    </View>
  );

  const renderHistory = () => (
    <View style={styles.tabPane}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.history.title}</Text>
        <Pill label={`${history.length} ${copy.history.shown}`} tone="neutral" />
      </View>

      <View style={styles.historyFilterCard}>
        <View style={styles.historyFilterSection}>
          <View style={[styles.filterSectionHeader, !isWideLayout && styles.filterSectionHeaderCompact]}>
            <Text style={[styles.filterGroupLabel, isRtl && styles.rtlText]}>{copy.history.typeFilter}</Text>
            <Text style={[styles.filterHint, isRtl && styles.rtlText]}>{copy.history.typeHint}</Text>
          </View>
          <View style={[styles.historyTypeSwitch, isRtl && styles.rtlRow]}>
            <Pressable
              onPress={() => setHistoryTypeFilter('delivery')}
              style={[styles.historyTypeButton, historyTypeFilter === 'delivery' && styles.historyTypeButtonActive]}
            >
              <Text style={[styles.historyTypeLabel, historyTypeFilter === 'delivery' && styles.historyTypeLabelActive, isRtl && styles.rtlText]}>
                {copy.history.deliveryOrders}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHistoryTypeFilter('internal_transfer')}
              style={[styles.historyTypeButton, historyTypeFilter === 'internal_transfer' && styles.historyTypeButtonActive]}
            >
              <Text style={[styles.historyTypeLabel, historyTypeFilter === 'internal_transfer' && styles.historyTypeLabelActive, isRtl && styles.rtlText]}>
                {copy.history.internalTransfers}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.historyFilterDivider} />

        <View style={styles.historyFilterSection}>
          <View style={[styles.filterSectionHeader, !isWideLayout && styles.filterSectionHeaderCompact]}>
            <Text style={[styles.filterGroupLabel, isRtl && styles.rtlText]}>{copy.history.periodFilter}</Text>
            <Text style={[styles.filterHint, isRtl && styles.rtlText]}>{copy.history.timeFirstHint}</Text>
          </View>
          <View style={styles.filterRail}>
            <FilterButton label={copy.history.allTime} active={historyPeriodFilter === 'all'} onPress={() => setHistoryPeriodFilter('all')} />
            <FilterButton label={copy.history.today} active={historyPeriodFilter === 'today'} onPress={() => setHistoryPeriodFilter('today')} />
            <FilterButton label={copy.history.last7Days} active={historyPeriodFilter === 'week'} onPress={() => setHistoryPeriodFilter('week')} />
            <FilterButton label={copy.history.thisMonth} active={historyPeriodFilter === 'month'} onPress={() => setHistoryPeriodFilter('month')} />
          </View>
        </View>

        <View style={styles.historyFilterDivider} />

        <View style={styles.historyFilterSection}>
          <View style={[styles.filterSectionHeader, !isWideLayout && styles.filterSectionHeaderCompact]}>
            <Text style={[styles.filterGroupLabel, isRtl && styles.rtlText]}>{copy.history.statusFilter}</Text>
            <Text style={[styles.filterHint, isRtl && styles.rtlText]}>{copy.history.statusHint}</Text>
          </View>
          <View style={styles.filterRail}>
            <FilterButton label={copy.history.all} active={historyStatusFilter === 'all'} onPress={() => setHistoryStatusFilter('all')} />
            <FilterButton label={copy.history.pickedUp} active={historyStatusFilter === 'picked_up'} onPress={() => setHistoryStatusFilter('picked_up')} />
            <FilterButton label={copy.history.delivered} active={historyStatusFilter === 'delivered'} onPress={() => setHistoryStatusFilter('delivered')} />
            <FilterButton label={copy.history.cancelled} active={historyStatusFilter === 'cancelled'} onPress={() => setHistoryStatusFilter('cancelled')} />
          </View>
        </View>
      </View>

      {historyQuery.isLoading ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.loadingText, isRtl && styles.rtlText]}>{copy.history.loading}</Text>
        </View>
      ) : historyQuery.error ? (
        <EmptyState title={copy.history.unavailableTitle} text={localizedDriverError(historyQuery.error, copy, copy.history.unavailableFallback)} isRtl={isRtl} />
      ) : history.length === 0 ? (
        <EmptyState title={copy.history.emptyTitle} text={copy.history.emptyText} isRtl={isRtl} />
      ) : (
        <View style={[styles.historyList, isWideLayout && styles.historyListWide]}>
          {history.map(order => (
            <View key={order.id} style={[styles.historyListItem, isWideLayout && styles.historyListItemWide]}>
              <HistoryOrderStrip
                order={order}
                copy={copy}
                language={language}
                isRtl={isRtl}
                onPress={setHistoryDetailOrder}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderDutyRecord = () => (
    <View style={styles.tabPane}>
      <View style={styles.dutyHero}>
        <Text style={[styles.commandLabel, isRtl && styles.rtlText]}>{copy.profile.monthlyArchive}</Text>
        <Text style={[styles.commandTitle, isRtl && styles.rtlText]}>{formatMonth(`${dutyMonthFilter}-01`, language, copy)}</Text>
        <Text style={[styles.commandText, isRtl && styles.rtlText]}>{copy.profile.archiveHint}</Text>
        <View style={[styles.dutyExportActions, isRtl && styles.rtlRow]}>
          <Button
            label={copy.profile.exportExcel}
            tone="light"
            disabled={isExportingDuty || dutyRecords.length === 0}
            onPress={() => exportDutyRecords('excel')}
          />
          <Button
            label={copy.profile.exportPdf}
            tone="dark"
            disabled={isExportingDuty || dutyRecords.length === 0}
            onPress={() => exportDutyRecords('pdf')}
          />
        </View>
        <Text style={[styles.dutyExportHint, isRtl && styles.rtlText]}>{copy.profile.excelHint}</Text>
      </View>

      <View style={styles.historyFilterCard}>
        <View style={styles.historyFilterSection}>
          <View style={[styles.filterSectionHeader, !isWideLayout && styles.filterSectionHeaderCompact]}>
            <Text style={[styles.filterGroupLabel, isRtl && styles.rtlText]}>{copy.profile.monthlyArchive}</Text>
            <Text style={[styles.filterHint, isRtl && styles.rtlText]}>{copy.profile.archiveHint}</Text>
          </View>
          <View style={styles.filterRail}>
            {dutyMonthOptions.map(month => (
              <FilterButton
                key={month}
                label={formatMonth(`${month}-01`, language, copy)}
                active={dutyMonthFilter === month}
                onPress={() => setDutyMonthFilter(month)}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatTile label={copy.profile.dutyDays} value={dutySummary.days} hint={copy.profile.monthlyArchive} />
        <StatTile label={copy.profile.workHours} value={formatShiftHours(dutySummary.minutes, copy)} hint={copy.profile.monthlyArchive} tone="green" />
        <StatTile label={copy.profile.orderCount} value={dutySummary.orders} hint={copy.common.actualDelivery} />
        <StatTile label={copy.profile.transferRecord} value={dutySummary.transfers} hint={copy.common.internalTransfer} tone="amber" />
      </View>

      {dutyRecordsQuery.isLoading ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.loadingText, isRtl && styles.rtlText]}>{copy.common.loading}</Text>
        </View>
      ) : dutyRecordsQuery.error ? (
        <EmptyState title={copy.history.unavailableTitle} text={localizedDriverError(dutyRecordsQuery.error, copy, copy.profile.dutyRecordsUnavailable)} isRtl={isRtl} />
      ) : dutyRecords.length === 0 ? (
        <EmptyState title={copy.profile.noDutyRecords} text={copy.profile.noDutyRecordsText} isRtl={isRtl} />
      ) : (
        <View style={[styles.historyList, isWideLayout && styles.historyListWide]}>
          {dutyRecords.map(record => (
            <View key={`${record.driverId}-${record.statDate}`} style={[styles.historyListItem, isWideLayout && styles.historyListItemWide]}>
              <View style={styles.dutyRecordCard}>
                <View style={[styles.dutyRecordHeader, isRtl && styles.rtlRow]}>
                  <View>
                    <Text style={[styles.historyStripTitle, isRtl && styles.rtlText]}>{record.statDate}</Text>
                    <Text style={[styles.historyStripMeta, isRtl && styles.rtlText]}>
                      {copy.profile.recordCount.replace('{count}', String(dutyRecordTotalOrders(record)))}
                    </Text>
                  </View>
                  <Pill label={formatShiftHours(record.totalWorkingMinutes, copy)} tone={record.lastOfflineAt ? 'green' : 'amber'} />
                </View>
                <View style={styles.dutyRecordGrid}>
                  <InfoRow label={copy.common.started} value={formatDateTime(record.firstOnlineAt, language, copy)} isRtl={isRtl} />
                  <InfoRow label={copy.profile.finishTime} value={record.lastOfflineAt ? formatDateTime(record.lastOfflineAt, language, copy) : copy.profile.openShift} isRtl={isRtl} />
                  <InfoRow label={copy.profile.startLocation} value={dutyLocationLabel(record, copy)} isRtl={isRtl} />
                  <InfoRow label={copy.profile.orderCount} value={String(dutyRecordTotalOrders(record))} isRtl={isRtl} />
                  <InfoRow label={copy.common.actualDelivery} value={String(record.actualDeliveryCount)} isRtl={isRtl} />
                  <InfoRow label={copy.profile.transferRecord} value={String(record.internalTransferCount)} isRtl={isRtl} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderStats = () => (
    <View style={styles.tabPane}>
      <MonthlyTargetCard target={monthlyTarget} copy={copy} language={language} isRtl={isRtl} />
      <View style={styles.statsGrid}>
        <StatTile label={copy.stats.delivered} value={session?.stats.deliveredCount ?? 0} hint={copy.stats.today} tone="green" onPress={() => openHistoryFromStat('delivery', 'delivered')} />
        <StatTile label={copy.common.actual} value={session?.stats.actualDeliveryCount ?? 0} hint={copy.common.actualDelivery} onPress={() => openHistoryFromStat('delivery', 'delivered')} />
        <StatTile label={copy.common.transfers} value={session?.stats.internalTransferCount ?? 0} hint={copy.stats.internal} tone="amber" onPress={() => openHistoryFromStat('internal_transfer', 'delivered')} />
        <StatTile label={copy.stats.pickedUp} value={session?.stats.pickedUpCount ?? 0} hint={copy.stats.today} onPress={() => openHistoryFromStat('delivery', 'picked_up')} />
        <StatTile label={copy.common.cancelled} value={session?.stats.cancelledCount ?? 0} hint={copy.stats.today} tone="red" onPress={() => openHistoryFromStat('delivery', 'cancelled')} />
        <StatTile label={copy.stats.historyRows} value={history.length} hint={copy.stats.loadedOrders} onPress={() => setActiveTab('history')} />
        <StatTile label={copy.stats.assigned} value={session?.stats.assignedCount ?? 0} hint={copy.stats.today} onPress={() => setActiveTab('orders')} />
        <StatTile label={copy.common.hours} value={formatShiftHours(session?.stats.totalWorkingMinutes, copy)} hint={copy.stats.today} onPress={() => setActiveTab('dutyRecord')} />
      </View>
      <View style={styles.performanceCard}>
        <Text style={[styles.performanceTitle, isRtl && styles.rtlText]}>{copy.stats.performanceTitle}</Text>
        <Text style={[styles.performanceText, isRtl && styles.rtlText]}>{copy.stats.performanceText}</Text>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View style={styles.tabPane}>
      <View style={styles.profileCard}>
        <Text style={styles.profileInitial}>{session?.driver.name?.[0]?.toUpperCase() || 'D'}</Text>
        <Text style={[styles.profileName, isRtl && styles.rtlText]}>{session?.driver.name || copy.header.driver}</Text>
        <Text style={[styles.profileSub, isRtl && styles.rtlText]}>{session?.driver.driverCode || copy.profile.deliveryDriver}</Text>
        <Pill label={activeShift ? copy.common.online : copy.common.offline} tone={activeShift ? 'green' : 'neutral'} />
      </View>
      <LanguageSelector language={language} copy={copy} isRtl={isRtl} onChange={onLanguageChange} />
      <ThemeSelector themeMode={themeMode} copy={copy} isRtl={isRtl} onChange={onThemeChange} />
      <Pressable
        accessibilityRole="button"
        onPress={() => setActiveTab('dutyRecord')}
        style={({ pressed }) => [styles.profileActionCard, pressed && styles.buttonPressed]}
      >
        <View style={styles.profileActionCopy}>
          <Text style={[styles.performanceTitle, isRtl && styles.rtlText]}>{copy.profile.dutyRecordTitle}</Text>
          <Text style={[styles.performanceText, isRtl && styles.rtlText]}>{copy.profile.dutyRecordText}</Text>
        </View>
        <Text style={[styles.profileActionChevron, isRtl && styles.rtlText]}>›</Text>
      </Pressable>
      <View style={styles.detailCard}>
        <InfoRow label={copy.profile.phone} value={session?.driver.phone || copy.target.notSet} isRtl={isRtl} />
        <InfoRow label={copy.profile.lastSeen} value={formatDateTime(session?.driver.lastSeenAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.profile.statusChanged} value={formatDateTime(session?.driver.statusChangedAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.profile.activeShift} value={activeShift?.startedAt ? formatDateTime(activeShift.startedAt, language, copy) : copy.profile.noActiveShift} isRtl={isRtl} />
      </View>
      <View style={styles.detailCard}>
        <Text style={[styles.performanceTitle, isRtl && styles.rtlText]}>{copy.profile.todayDuty}</Text>
        <InfoRow label={copy.common.started} value={formatDateTime(session?.stats.firstOnlineAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.common.finished} value={formatDateTime(session?.stats.lastOfflineAt, language, copy)} isRtl={isRtl} />
        <InfoRow label={copy.common.hours} value={`${((session?.stats.totalWorkingMinutes || 0) / 60).toFixed(1)}${copy.profile.hoursUnit}`} isRtl={isRtl} />
        <InfoRow label={copy.common.actualDelivery} value={String(session?.stats.actualDeliveryCount ?? 0)} isRtl={isRtl} />
        <InfoRow label={copy.common.internalTransfer} value={String(session?.stats.internalTransferCount ?? 0)} isRtl={isRtl} />
      </View>
      <Button
        label={activeShift ? copy.common.endShift : copy.common.startShift}
        tone={activeShift ? 'warning' : 'brand'}
        disabled={isBusy}
        onPress={() => shiftMutation.mutate(activeShift ? 'end' : 'start')}
      />
      <Button label={copy.common.signOut} tone="light" onPress={signOut} disabled={isBusy} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.loadingText, isRtl && styles.rtlText]}>{copy.errors.loadingWorkspace}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionQuery.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={[styles.errorTitle, isRtl && styles.rtlText]}>{copy.errors.accessBlocked}</Text>
          <Text style={[styles.errorText, isRtl && styles.rtlText]}>{localizedDriverError(sessionQuery.error, copy, copy.errors.couldNotLoadAccess)}</Text>
          <Button label={copy.common.signOut} tone="light" onPress={signOut} />
        </View>
      </SafeAreaView>
    );
  }

  const isUtilityScreen = activeTab === 'notifications' || activeTab === 'dutyRecord';

  return (
    <View style={styles.safe}>
      <View style={[styles.appHeader, isRtl && styles.rtlRow, { paddingTop: Math.max(spacing.md, insets.top + spacing.sm) }]}>
        {activeTab === 'notifications' ? (
          <>
            <HeaderBackButton label={copy.header.backToWorkspace} onPress={() => setActiveTab('home')} />
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, isRtl && styles.rtlText]}>{copy.header.alerts}</Text>
              <Text style={[styles.title, isRtl && styles.rtlText]}>{copy.header.notifications}</Text>
              <Text style={[styles.subTitle, isRtl && styles.rtlText]}>
                {formatCopy(copy.header.incomingActive, { incoming: incomingOrders.length, active: orders.length })}
              </Text>
            </View>
            <HeaderAction icon="alert" label={copy.notifications.playAlarm} hasBadge={incomingOrders.length > 0} onPress={playDriverAlarm} />
          </>
        ) : activeTab === 'dutyRecord' ? (
          <>
            <HeaderBackButton label={copy.header.backToWorkspace} onPress={() => setActiveTab('profile')} />
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, isRtl && styles.rtlText]}>{copy.profile.monthlyArchive}</Text>
              <Text style={[styles.title, isRtl && styles.rtlText]}>{copy.header.dutyRecord}</Text>
              <Text style={[styles.subTitle, isRtl && styles.rtlText]}>
                {formatMonth(`${dutyMonthFilter}-01`, language, copy)}
              </Text>
            </View>
            <HeaderAction icon="stats" label={copy.header.stats} onPress={() => setActiveTab('stats')} />
          </>
        ) : (
          <>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, isRtl && styles.rtlText]}>{copy.header.driverMobile}</Text>
              <Text style={[styles.title, isRtl && styles.rtlText]}>{session?.driver.name || copy.header.driver}</Text>
              <Text style={[styles.subTitle, isRtl && styles.rtlText]}>
                {session?.driver.driverCode || copy.header.deliveryRoute} - {activeShift ? copy.common.online : copy.common.offline}
              </Text>
            </View>
            <View style={[styles.headerActions, isRtl && styles.rtlRow]}>
              <HeaderAction icon="profile" label={copy.header.openProfile} onPress={() => setActiveTab('profile')} />
              <HeaderAction
                icon="alert"
                label={copy.header.notifications}
                hasBadge={orders.length > 0}
                onPress={openNotifications}
              />
            </View>
          </>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.page,
          isWideLayout && styles.pageWide,
          isUtilityScreen && { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.xl) }
        ]}
        refreshControl={<RefreshControl refreshing={isLoading || isSyncing} onRefresh={refreshAll} />}
      >
        <View style={styles.hidden}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{copy.header.driverMobile}</Text>
            <Text style={styles.title}>{session?.driver.name || copy.header.driver}</Text>
            <Text style={styles.subTitle}>{session?.driver.driverCode || copy.header.deliveryRoute} · {activeShift ? copy.common.online : copy.common.offline}</Text>
          </View>
          <Pill label={activeShift ? copy.common.live : copy.common.offline} tone={activeShift ? 'green' : 'neutral'} />
        </View>

        <View style={styles.hidden}>
          <TabButton label={copy.header.home} active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
          <TabButton label={copy.header.orders} active={activeTab === 'orders'} onPress={() => setActiveTab('orders')} />
          <TabButton label={copy.header.transfer} active={activeTab === 'transfer'} onPress={() => setActiveTab('transfer')} />
          <TabButton label={copy.header.history} active={activeTab === 'history'} onPress={() => setActiveTab('history')} />
          <TabButton label={copy.header.stats} active={activeTab === 'stats'} onPress={() => setActiveTab('stats')} />
          <TabButton label={copy.header.profile} active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
          <TabButton label={copy.header.dutyRecord} active={activeTab === 'dutyRecord'} onPress={() => setActiveTab('dutyRecord')} />
        </View>

        {activeTab === 'home' ? renderHome() : null}
        {activeTab === 'orders' ? renderOrders() : null}
        {activeTab === 'transfer' ? renderTransfer() : null}
        {activeTab === 'notifications' ? renderNotifications() : null}
        {activeTab === 'history' ? renderHistory() : null}
        {activeTab === 'stats' ? renderStats() : null}
        {activeTab === 'profile' ? renderProfile() : null}
        {activeTab === 'dutyRecord' ? renderDutyRecord() : null}
      </ScrollView>

      {!isUtilityScreen ? (
        <View style={[styles.bottomNavShell, { paddingBottom: Math.max(spacing.md, insets.bottom + spacing.sm) }]}>
          <View style={styles.bottomNav}>
            <BottomNavButton label={copy.header.home} icon="home" active={activeTab === 'home'} onPress={() => setActiveTab('home')} />
            <BottomNavButton label={copy.header.history} icon="history" active={activeTab === 'history'} onPress={() => setActiveTab('history')} />
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'orders' }}
              accessibilityLabel={copy.header.orders}
              onPress={() => setActiveTab('orders')}
              style={({ pressed }) => [
                styles.ordersFab,
                activeTab === 'orders' && styles.ordersFabActive,
                pressed && styles.buttonPressed
              ]}
            >
              <FlatIcon name="orders" active size={28} color={colors.white} />
              <Text style={styles.ordersFabLabel}>{copy.header.orders}</Text>
            </Pressable>
            <BottomNavButton label={copy.header.stats} icon="stats" active={activeTab === 'stats'} onPress={() => setActiveTab('stats')} />
            <BottomNavButton label={copy.header.profile} icon="profile" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
          </View>
        </View>
      ) : null}

      <HistoryDetailSheet
        order={historyDetailOrder}
        copy={copy}
        language={language}
        isRtl={isRtl}
        onClose={() => setHistoryDetailOrder(null)}
      />

      <DeliveryConfirmSheet
        order={deliveryDraft}
        copy={copy}
        language={language}
        isRtl={isRtl}
        busy={isBusy}
        onClose={() => setDeliveryDraft(null)}
        onConfirm={confirmDelivery}
      />
    </View>
  );
};

export default function DriverApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [language, setLanguage] = useState<DriverLanguage>('en');
  const [themeMode, setThemeMode] = useState<DriverThemeMode>('dark');
  const [mobileSettings, setMobileSettings] = useState<DriverMobileAppSettings>(DEFAULT_MOBILE_SETTINGS);
  const [mobileSettingsLoaded, setMobileSettingsLoaded] = useState(false);
  const [mobileSettingsRefreshing, setMobileSettingsRefreshing] = useState(false);
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const copy = useMemo(() => getDriverCopy(language), [language]);
  const isRtl = isRtlLanguage(language);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshMobileSettings = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setMobileSettings(DEFAULT_MOBILE_SETTINGS);
      setMobileSettingsLoaded(true);
      return;
    }

    setMobileSettingsRefreshing(true);
    try {
      setMobileSettings(await driverApi.mobileAppSettings());
    } catch (error: any) {
      console.info('Driver mobile settings unavailable; using bundled branding.', error?.message || error);
      setMobileSettings(DEFAULT_MOBILE_SETTINGS);
    } finally {
      setMobileSettingsLoaded(true);
      setMobileSettingsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshMobileSettings();
  }, [refreshMobileSettings]);

  useEffect(() => {
    Promise.all([loadSavedDriverLanguage(), loadSavedDriverTheme()])
      .then(([savedLanguage, savedTheme]) => {
        setLanguage(savedLanguage);
        refreshDriverTheme(savedTheme);
        setThemeMode(savedTheme);
      })
      .finally(() => setLanguageLoaded(true));
  }, []);

  const changeLanguage = useCallback((nextLanguage: DriverLanguage) => {
    setLanguage(nextLanguage);
    saveDriverLanguage(nextLanguage).catch(error => console.warn('Driver language save failed', error));
  }, []);

  const changeTheme = useCallback((nextThemeMode: DriverThemeMode) => {
    refreshDriverTheme(nextThemeMode);
    setThemeMode(nextThemeMode);
    saveDriverTheme(nextThemeMode).catch(error => console.warn('Driver theme save failed', error));
  }, []);

  if (!languageLoaded || !mobileSettingsLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasSupabaseConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={[styles.errorTitle, isRtl && styles.rtlText]}>{copy.errors.envMissingTitle}</Text>
          <Text style={[styles.errorText, isRtl && styles.rtlText]}>{copy.errors.envMissingText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isDriverForceUpdateRequired(mobileSettings)) {
    return (
      <ForceUpdateScreen
        settings={mobileSettings}
        isRtl={isRtl}
        refreshing={mobileSettingsRefreshing}
        onRetry={refreshMobileSettings}
      />
    );
  }

  if (session === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return session
    ? (
      <Dashboard
        onSignedOut={() => setSession(null)}
        language={language}
        onLanguageChange={changeLanguage}
        themeMode={themeMode}
        onThemeChange={changeTheme}
      />
    )
    : (
      <LoginScreen
        onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))}
        copy={copy}
        isRtl={isRtl}
        mobileSettings={mobileSettings}
      />
    );
}

const createDriverStyles = (colors: DriverColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.page
  },
  rtlRow: {
    flexDirection: 'row-reverse'
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  rtlInput: {
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  rtlInfoValue: {
    textAlign: 'left',
    writingDirection: 'rtl'
  },
  content: {
    flex: 1
  },
  page: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  pageWide: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center'
  },
  hidden: {
    display: 'none'
  },
  forceUpdateScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.page
  },
  forceUpdatePanel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  forceUpdateBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  forceUpdateBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  forceUpdateTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34
  },
  forceUpdateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21
  },
  forceUpdateMeta: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm
  },
  forceUpdateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  forceUpdateMetaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  forceUpdateMetaValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right'
  },
  forceUpdateActions: {
    gap: spacing.sm
  },
  loginWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
    backgroundColor: colors.page
  },
  loginHero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card
  },
  loginBrandStack: {
    alignItems: 'center',
    gap: spacing.sm
  },
  loginLogoFrame: {
    width: 82,
    height: 82,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card
  },
  loginLogo: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.brand
  },
  loginAppBadgeText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  loginPanel: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: 28,
    gap: spacing.lg,
    ...shadows.card
  },
  loginPanelHeader: {
    alignItems: 'center',
    gap: spacing.xs
  },
  loginPanelTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
    textAlign: 'center'
  },
  loginPanelSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  },
  loginForm: {
    gap: spacing.md,
    paddingTop: spacing.xs
  },
  loginField: {
    gap: 7
  },
  loginFieldLabel: {
    color: colors.slate700,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7
  },
  loginFooterBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xl
  },
  loginFooterLogo: {
    width: 132,
    height: 54,
    opacity: 0.88
  },
  loginFooterCredit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center'
  },
  eyebrow: {
    color: colors.brand,
    ...typography.micro
  },
  loginTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  loginSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center'
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  passwordField: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  passwordInput: {
    flex: 1,
    minHeight: 52,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0
  },
  passwordEyeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyeIcon: {
    width: 22,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyeOutline: {
    width: 20,
    height: 12,
    borderRadius: 10,
    borderWidth: 1.7,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyeOutlineActive: {
    borderColor: colors.brand
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.slate400
  },
  eyePupilActive: {
    backgroundColor: colors.brand
  },
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    transform: [{ rotate: '-35deg' }]
  },
  button: {
    minHeight: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1
  },
  button_brand: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    ...shadows.brand
  },
  button_success: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  button_danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder
  },
  button_warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder
  },
  button_collected: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder
  },
  button_dark: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  button_light: {
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  },
  buttonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  buttonTextLight: {
    color: colors.ink
  },
  buttonTextDanger: {
    color: colors.danger
  },
  buttonTextCollected: {
    color: colors.success
  },
  iconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  homeRoof: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  homeBody: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: colors.surface
  },
  ordersPaper: {
    borderWidth: 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 3,
    gap: 3
  },
  ordersLine: {
    height: 2,
    borderRadius: radius.pill
  },
  ordersDot: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: radius.pill
  },
  historyCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  historyHandTall: {
    position: 'absolute',
    width: 2,
    borderRadius: radius.pill,
    top: 4
  },
  historyHandWide: {
    position: 'absolute',
    height: 2,
    borderRadius: radius.pill,
    right: 4
  },
  profileHead: {
    position: 'absolute',
    top: 2,
    borderWidth: 2,
    backgroundColor: colors.surface
  },
  profileShoulders: {
    position: 'absolute',
    bottom: 1,
    borderWidth: 2
  },
  alertBell: {
    borderWidth: 2,
    backgroundColor: colors.surface
  },
  alertClapper: {
    position: 'absolute',
    bottom: 3,
    width: 6,
    height: 2,
    borderRadius: radius.pill
  },
  alertBadge: {
    position: 'absolute',
    top: 1,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: radius.pill
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    gap: 12
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800'
  },
  inlineLoader: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  errorTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center'
  },
  errorText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center'
  },
  appHeader: {
    zIndex: 20,
    minHeight: 92,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    ...shadows.card
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start'
  },
  headerCopy: {
    flex: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerActionBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.brand
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerBackChevron: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 34
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  subTitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800'
  },
  tabRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.rail,
    padding: spacing.xs
  },
  tabButton: {
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    ...shadows.card
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  tabTextActive: {
    color: colors.ink
  },
  bottomNavShell: {
    zIndex: 30,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    ...shadows.card
  },
  bottomNav: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  bottomNavLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  bottomNavLabelActive: {
    color: colors.brand
  },
  ordersFab: {
    width: 76,
    height: 76,
    marginTop: -30,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...shadows.brand
  },
  ordersFabActive: {
    backgroundColor: colors.brandDark
  },
  ordersFabLabel: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  tabPane: {
    gap: spacing.md
  },
  commandCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card
  },
  shiftCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  commandCopy: {
    gap: 6
  },
  commandLabel: {
    color: colors.brand,
    ...typography.micro
  },
  commandTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900'
  },
  commandText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20
  },
  shiftBranchPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  shiftBranchPanel_neutral: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  shiftBranchPanel_ready: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft
  },
  shiftBranchPanel_blocked: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft
  },
  shiftBranchCopy: {
    flex: 1,
    gap: 4
  },
  shiftBranchLabel: {
    color: colors.muted,
    ...typography.micro
  },
  shiftBranchTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900'
  },
  shiftBranchMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800'
  },
  shiftBranchAction: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadows.card
  },
  statTileClickable: {
    justifyContent: 'space-between'
  },
  statTile_neutral: {
    borderColor: colors.border
  },
  statTile_green: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft
  },
  statTile_amber: {
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft
  },
  statTile_red: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft
  },
  statLabel: {
    color: colors.muted,
    ...typography.micro
  },
  statValue: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  statHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  targetCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  targetEyebrow: {
    color: colors.brand,
    ...typography.micro
  },
  targetTitle: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900'
  },
  targetScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 6
  },
  targetScore: {
    color: colors.ink,
    fontSize: 40,
    fontWeight: '900'
  },
  targetScoreDivider: {
    marginBottom: 7,
    color: colors.slate300,
    fontSize: 24,
    fontWeight: '900'
  },
  targetGoal: {
    marginBottom: 4,
    color: colors.muted,
    fontSize: 26,
    fontWeight: '900'
  },
  targetScoreLabel: {
    marginBottom: 8,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  targetProgressTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  targetProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand
  },
  targetKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  targetMetric: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft
  },
  targetMetricLabel: {
    color: colors.muted,
    ...typography.micro
  },
  targetMetricValue: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900'
  },
  targetMetricHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  targetFinePrint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18
  },
  sectionHeader: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md
  },
  batchHint: {
    marginTop: -6,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18
  },
  sectionTitle: {
    color: colors.ink,
    ...typography.sectionTitle
  },
  linkText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  historyFilterCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  historyFilterSection: {
    gap: spacing.sm
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  filterSectionHeaderCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.xs
  },
  filterHint: {
    flexShrink: 1,
    color: colors.slate400,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right'
  },
  historyFilterDivider: {
    height: 1,
    backgroundColor: colors.borderSoft
  },
  filterRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  historyTypeSwitch: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
    gap: 4
  },
  historyTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  historyTypeButtonActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  historyTypeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  historyTypeLabelActive: {
    color: colors.white
  },
  filterGroupLabel: {
    color: colors.muted,
    ...typography.micro
  },
  filterButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  filterButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  filterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  filterTextActive: {
    color: colors.brand
  },
  historyList: {
    gap: spacing.md
  },
  historyListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  historyListItem: {
    width: '100%'
  },
  historyListItemWide: {
    width: '48.5%',
    flexGrow: 1
  },
  historyStrip: {
    minHeight: 104,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8
  },
  historyStripPressed: {
    opacity: 0.78
  },
  historyStripTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  historyStripTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  historyStripTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  historyStripMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    textTransform: 'uppercase'
  },
  historyStripNotes: {
    marginTop: -2,
    color: colors.slate600,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15
  },
  historyStripTimeline: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 8
  },
  historyTimeCell: {
    flex: 1,
    minWidth: 0
  },
  historyTimeLabel: {
    color: colors.slate400,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  historyTimeValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900'
  },
  historyDetailSheet: {
    maxHeight: '86%'
  },
  historyDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  historyDetailTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  historyDetailScroll: {
    gap: spacing.md,
    paddingBottom: spacing.xs
  },
  historyDetailSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  historyPathwayCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md
  },
  pathwayStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  pathwayMarker: {
    width: 18,
    alignItems: 'center'
  },
  pathwayDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.slate300,
    backgroundColor: colors.surface
  },
  pathwayDotDone: {
    borderColor: colors.success,
    backgroundColor: colors.success
  },
  pathwayLine: {
    width: 2,
    height: 34,
    marginTop: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  pathwayContent: {
    flex: 1,
    minWidth: 0,
    paddingBottom: spacing.sm
  },
  pathwayLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900'
  },
  pathwayTime: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  emptyState: {
    minHeight: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  emptyText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19
  },
  orderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  orderCardCompact: {
    padding: 14
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  orderTitleWrap: {
    flex: 1
  },
  pickupSelect: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pickupSelectActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand
  },
  pickupSelectText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '900'
  },
  pickupSelectTextActive: {
    color: colors.white
  },
  orderBranch: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900'
  },
  orderMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  orderKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  orderKindValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  orderArea: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right'
  },
  blockPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm
  },
  blockStatusRow: {
    alignItems: 'flex-start',
    marginTop: 2
  },
  paymentPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    gap: spacing.sm
  },
  paymentPanelCollected: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft
  },
  paymentPanelTitle: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  paymentPanelTitleCollected: {
    color: colors.success
  },
  paymentNote: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18
  },
  paymentNoteCollected: {
    color: colors.success
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  infoValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right'
  },
  orderNotes: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18
  },
  timeline: {
    gap: 7
  },
  orderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  pill: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  pill_neutral: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  pill_blue: {
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSoft
  },
  pill_green: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft
  },
  pill_amber: {
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft
  },
  pill_red: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft
  },
  pillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  pillText_neutral: {
    color: colors.muted
  },
  pillText_blue: {
    color: colors.info
  },
  pillText_green: {
    color: colors.success
  },
  pillText_amber: {
    color: colors.warning
  },
  pillText_red: {
    color: colors.danger
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.page,
    padding: spacing.lg,
    gap: spacing.md
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.slate300,
    marginBottom: 4
  },
  sheetEyebrow: {
    color: colors.brand,
    ...typography.micro
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  sheetSub: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19
  },
  sheetInput: {
    backgroundColor: colors.surface
  },
  noteInput: {
    minHeight: 82,
    paddingTop: 14,
    textAlignVertical: 'top'
  },
  blockCompare: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 9
  },
  warningBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft,
    padding: spacing.md
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900'
  },
  warningText: {
    marginTop: 4,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18
  },
  successBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft,
    padding: spacing.md
  },
  successTitle: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900'
  },
  successText: {
    marginTop: 4,
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  transferHero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  transferSummary: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm
  },
  transferForm: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card
  },
  branchDropdownWrap: {
    gap: spacing.sm
  },
  branchDropdownLabel: {
    color: colors.muted,
    ...typography.micro
  },
  branchDropdownTrigger: {
    minHeight: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  branchDropdownValue: {
    flex: 1,
    gap: 5
  },
  branchDropdownCode: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  branchDropdownName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20
  },
  branchDropdownChevron: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900'
  },
  branchDropdownMenu: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  branchDropdownItem: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center'
  },
  branchDropdownItemActive: {
    backgroundColor: colors.brandSoft
  },
  branchDropdownTextActive: {
    color: colors.brand
  },
  performanceCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  dutyHero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  dutyExportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  dutyExportHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800'
  },
  dutyRecordCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  dutyRecordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  dutyRecordGrid: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    gap: spacing.sm
  },
  notificationHero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  notificationHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationPulse: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.brand
  },
  notificationHeroCopy: {
    gap: 5
  },
  notificationEyebrow: {
    color: colors.brand,
    ...typography.micro
  },
  notificationTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900'
  },
  notificationText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20
  },
  notificationOrderWrap: {
    gap: spacing.sm
  },
  notificationOrderHeader: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  notificationOrderLabel: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  notificationOrderTime: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  performanceTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900'
  },
  performanceText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20
  },
  languageDropdownSection: {
    gap: spacing.sm
  },
  languageDropdownTrigger: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  languageDropdownValue: {
    flex: 1
  },
  languageDropdownChevron: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900'
  },
  languageDropdownMenu: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  languageDropdownItem: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  languageDropdownItemActive: {
    backgroundColor: colors.brandSoft
  },
  themeSwitchRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  themeChoice: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  themeChoiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  themeChoiceText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900'
  },
  themeChoiceTextActive: {
    color: colors.brand
  },
  themeChoiceHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800'
  },
  languageCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  languageHeader: {
    gap: 5
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  languageOption: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  languageOptionActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  languageOptionNative: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  languageOptionText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  languageOptionTextActive: {
    color: colors.brand
  },
  languageSelectedText: {
    marginTop: 8,
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  profileCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card
  },
  profileActionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    ...shadows.card
  },
  profileActionCopy: {
    flex: 1,
    gap: 5
  },
  profileActionChevron: {
    color: colors.brand,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 36
  },
  profileInitial: {
    width: 74,
    height: 74,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 74
  },
  profileName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900'
  },
  profileSub: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800'
  },
  detailCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card
  }
});

let styles = createDriverStyles(colors);

const refreshDriverTheme = (themeMode: DriverThemeMode) => {
  applyDriverTheme(themeMode);
  styles = createDriverStyles(colors);
};
