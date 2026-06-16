import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  driverApi,
  DriverBranchOption,
  DriverHistoryStatusFilter,
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
import { colors, radius, shadows, spacing, typography } from '../src/theme';

const tabarakLogo = require('../src/assets/tabarak-logo.jpg');
const driverAlarmSound = require('../src/assets/sounds/driver.mp3');

type ButtonTone = 'brand' | 'light' | 'danger' | 'success' | 'warning' | 'dark';
type DashboardTab = 'home' | 'orders' | 'transfer' | 'history' | 'stats' | 'profile' | 'notifications';
type HistoryStatusFilter = 'all' | DriverHistoryStatusFilter;
type HistoryOrderTypeFilter = 'delivery' | 'internal_transfer';
type HistoryPeriodFilter = 'all' | 'today' | 'week' | 'month';
type DriverCopy = ReturnType<typeof getDriverCopy>;

const incentiveMoney = (value?: number | null) => `BHD ${Number(value || 0).toFixed(3)}`;

const shortId = (id: string) => id.slice(0, 8);

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

const orderRouteLabel = (order: DriverOrder, copy: DriverCopy) => {
  if (order.orderKind !== 'internal_transfer') return order.branchName;
  const from = order.transferFromBranchName || order.branchName;
  const to = order.transferToBranchName || copy.common.destinationBranch;
  return `${from} -> ${to}`;
};

const orderTypeLabel = (order: DriverOrder, copy: DriverCopy) =>
  order.orderKind === 'internal_transfer' ? copy.common.internalTransfer : copy.common.actualDelivery;

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

  return {
    label: 'Shift branch',
    checking: 'Checking nearest branch...',
    inside: 'Inside range',
    outside: 'Outside range',
    unavailable: 'No branch in range',
    recheck: 'Recheck'
  };
};

const shiftBranchStatus = (
  branch: DriverNearbyStartBranch | null | undefined,
  isFetching: boolean,
  error: unknown,
  language: DriverLanguage
) => {
  const text = shiftLocationCopy(language);
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
      title: `${branchLabel(branch, getDriverCopy(language))} · ${status}`,
      detail: `${formatDistanceMeters(branch.distanceMeters)} / ${formatDistanceMeters(branch.radiusMeters)}`
    };
  }
  return {
    tone: 'blocked' as const,
    title: error instanceof Error ? error.message : text.unavailable,
    detail: text.recheck
  };
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      tone === 'warning' && styles.buttonTextLight
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

const LoginScreen = ({
  onSignedIn,
  copy,
  isRtl
}: {
  onSignedIn: () => void;
  copy: DriverCopy;
  isRtl: boolean;
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      Alert.alert(copy.login.failedTitle, error?.message || copy.login.failedFallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.loginWrap}>
        <View style={styles.loginBrandStage}>
          <Image source={tabarakLogo} style={styles.loginLogo} resizeMode="cover" />
          <Text style={[styles.loginAppBadgeText, isRtl && styles.rtlText]}>{copy.login.appBadge}</Text>
          <Text style={[styles.loginTitle, isRtl && styles.rtlText]}>{copy.login.title}</Text>
          <Text style={[styles.loginSub, isRtl && styles.rtlText]}>{copy.login.sub}</Text>
        </View>

        <View style={styles.loginPanel}>
          <View style={styles.loginPanelHeader}>
            <Text style={[styles.loginPanelTitle, isRtl && styles.rtlText]}>{copy.login.welcome}</Text>
            <Text style={[styles.loginPanelSub, isRtl && styles.rtlText]}>{copy.login.panelSub}</Text>
          </View>
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
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                accessibilityState={{ checked: passwordVisible }}
                onPress={() => setPasswordVisible(previous => !previous)}
                style={({ pressed }) => [styles.passwordEyeButton, pressed && styles.buttonPressed]}
              >
                <PasswordEyeIcon visible={passwordVisible} />
              </Pressable>
            </View>
          </LoginField>
          <Button label={isSubmitting ? copy.login.signingIn : copy.login.signIn} onPress={submit} disabled={isSubmitting} />
          <View style={[styles.loginFootnote, isRtl && styles.rtlRow]}>
            <View style={styles.loginFootnoteDot} />
            <Text style={[styles.loginFootnoteText, isRtl && styles.rtlText]}>{copy.login.footnote}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral'
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) => (
  <View style={[styles.statTile, styles[`statTile_${tone}`]]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
  </View>
);

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

const OrderCard = ({
  order,
  copy,
  language,
  isRtl,
  busy,
  onPickUp,
  onDeliver,
  onCancel,
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
  onCancel?: (order: DriverOrder) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (order: DriverOrder) => void;
  compact?: boolean;
}) => {
  const canPickUp = order.deliveryStatus === 'assigned';
  const canDeliver = order.deliveryStatus === 'picked_up';
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
            accessibilityLabel={formatCopy(copy.order.selectForBatch, { id: shortId(order.id) })}
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
          <Text style={[styles.orderMeta, isRtl && styles.rtlText]}>#{shortId(order.id)} - {orderTypeLabel(order, copy)}</Text>
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

      {!isClosed && (onPickUp || onDeliver || onCancel) ? (
        <View style={styles.orderActions}>
          {canPickUp && onPickUp ? (
            <Button label={copy.order.pickedUpAction} tone="light" disabled={busy} onPress={() => onPickUp(order)} />
          ) : null}
          {canDeliver && onDeliver ? (
            <Button label={copy.order.deliveredAction} tone="success" disabled={busy} onPress={() => onDeliver(order)} />
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
      accessibilityLabel={`${detailText.openDetails} #${shortId(order.id)}`}
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.historyStrip, pressed && styles.historyStripPressed]}
    >
      <View style={[styles.historyStripTop, isRtl && styles.rtlRow]}>
        <View style={styles.historyStripTitleWrap}>
          <Text style={[styles.historyStripTitle, isRtl && styles.rtlText]} numberOfLines={1}>{routeLabel}</Text>
          <Text style={[styles.historyStripMeta, isRtl && styles.rtlText]} numberOfLines={2}>
            #{shortId(order.id)} | {orderTypeLabel(order, copy)} | {order.paymentType} | {routeDetail}{pickupRunValue}
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
                #{shortId(order.id)} | {orderTypeLabel(order, copy)}
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
              <InfoRow label={copy.sheet.order} value={`#${shortId(order.id)}`} isRtl={isRtl} />
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetEyebrow, isRtl && styles.rtlText]}>{order.orderKind === 'internal_transfer' ? copy.sheet.transferConfirmation : copy.sheet.deliveryConfirmation}</Text>
          <Text style={[styles.sheetTitle, isRtl && styles.rtlText]}>{order.orderKind === 'internal_transfer' ? copy.sheet.completeTransfer : copy.sheet.markOrderDelivered}</Text>
          <Text style={[styles.sheetSub, isRtl && styles.rtlText]}>{copy.sheet.sub}</Text>

          <View style={styles.blockCompare}>
            <InfoRow label={copy.sheet.order} value={`#${shortId(order.id)}`} isRtl={isRtl} />
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

          <View style={styles.infoBox}>
            <Text style={[styles.infoTitle, isRtl && styles.rtlText]}>{copy.sheet.statusOnly}</Text>
            <Text style={[styles.infoText, isRtl && styles.rtlText]}>{copy.sheet.noBlockCheck}</Text>
          </View>

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
            <Button label={copy.sheet.markDelivered} tone="success" onPress={submit} disabled={busy} />
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

const BranchRail = ({
  label,
  branches,
  value,
  onChange,
  isRtl = false
}: {
  label: string;
  branches: DriverBranchOption[];
  value: string;
  onChange: (branchId: string) => void;
  isRtl?: boolean;
}) => (
  <View style={styles.branchRailWrap}>
    <Text style={[styles.branchRailLabel, isRtl && styles.rtlText]}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.branchRail, isRtl && styles.rtlRow]}>
      {branches.map(branch => {
        const active = branch.id === value;
        return (
          <Pressable
            key={branch.id}
            onPress={() => onChange(branch.id)}
            style={[styles.branchChip, active && styles.branchChipActive]}
          >
            <Text style={[styles.branchChipCode, active && styles.branchChipCodeActive, isRtl && styles.rtlText]}>{branch.code || 'BR'}</Text>
            <Text style={[styles.branchChipName, active && styles.branchChipNameActive, isRtl && styles.rtlText]} numberOfLines={1}>
              {branch.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

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

const Dashboard = ({
  onSignedOut,
  language,
  onLanguageChange
}: {
  onSignedOut: () => void;
  language: DriverLanguage;
  onLanguageChange: (language: DriverLanguage) => void;
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
  const [selectedPickupOrderIds, setSelectedPickupOrderIds] = useState<Set<string>>(() => new Set());
  const [transferFromBranchId, setTransferFromBranchId] = useState('');
  const [transferToBranchId, setTransferToBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

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

  const transferBranchesQuery = useQuery({
    queryKey: ['driver-transfer-branches'],
    queryFn: driverApi.transferBranches
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['driver-session'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-active-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-order-history'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-transfer-branches'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-nearby-start-branch'] })
    ]);
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
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : copy.errors.locationUnavailable);
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
    onError: (error: any) => Alert.alert(copy.errors.shiftUpdateFailed, error?.message || copy.errors.couldNotUpdateShift)
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
        await enqueueOrderAction(
          order.id,
          nextStatus,
          actionNotes ? `${actionNotes} ${copy.errors.offlineSuffix}` : null
        );
        return { result: 'queued' as const, order, nextStatus };
      }
      await driverApi.transitionOrder(order.id, nextStatus, actionNotes);
      return { result: 'sent' as const, order, nextStatus };
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
    onError: (error: any) => Alert.alert(copy.errors.orderUpdateFailed, error?.message || copy.errors.couldNotUpdateOrder)
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
    onError: (error: any) => Alert.alert(copy.errors.pickupFailed, error?.message || copy.errors.couldNotStartPickup)
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
    onError: (error: any) => Alert.alert(copy.transfer.failedTitle, error?.message || copy.transfer.failedFallback)
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
  const isBusy = shiftMutation.isPending || orderMutation.isPending || pickupBatchMutation.isPending || transferMutation.isPending || isSyncing;
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
          onCancel={order => actionOrder(order, 'cancelled')}
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
            onCancel={nextOrder => actionOrder(nextOrder, 'cancelled')}
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
          <EmptyState title={copy.transfer.unavailableTitle} text={transferBranchesQuery.error instanceof Error ? transferBranchesQuery.error.message : copy.transfer.unavailableFallback} isRtl={isRtl} />
        ) : transferBranches.length < 2 ? (
          <EmptyState title={copy.transfer.notEnoughTitle} text={copy.transfer.notEnoughText} isRtl={isRtl} />
        ) : (
          <View style={styles.transferForm}>
            <BranchRail
              label={copy.transfer.fromBranch}
              branches={transferBranches}
              value={transferFromBranchId}
              onChange={setTransferFromBranchId}
              isRtl={isRtl}
            />
            <BranchRail
              label={copy.transfer.toBranch}
              branches={transferBranches.filter(branch => branch.id !== transferFromBranchId)}
              value={transferToBranchId}
              onChange={setTransferToBranchId}
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
              onCancel={nextOrder => actionOrder(nextOrder, 'cancelled')}
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
        <EmptyState title={copy.history.unavailableTitle} text={historyQuery.error instanceof Error ? historyQuery.error.message : copy.history.unavailableFallback} isRtl={isRtl} />
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

  const renderStats = () => (
    <View style={styles.tabPane}>
      <MonthlyTargetCard target={monthlyTarget} copy={copy} language={language} isRtl={isRtl} />
      <View style={styles.statsGrid}>
        <StatTile label={copy.stats.delivered} value={session?.stats.deliveredCount ?? 0} hint={copy.stats.today} tone="green" />
        <StatTile label={copy.common.actual} value={session?.stats.actualDeliveryCount ?? 0} hint={copy.common.actualDelivery} />
        <StatTile label={copy.common.transfers} value={session?.stats.internalTransferCount ?? 0} hint={copy.stats.internal} tone="amber" />
        <StatTile label={copy.stats.pickedUp} value={session?.stats.pickedUpCount ?? 0} hint={copy.stats.today} />
        <StatTile label={copy.common.cancelled} value={session?.stats.cancelledCount ?? 0} hint={copy.stats.today} tone="red" />
        <StatTile label={copy.stats.historyRows} value={history.length} hint={copy.stats.loadedOrders} />
        <StatTile label={copy.stats.assigned} value={session?.stats.assignedCount ?? 0} hint={copy.stats.today} />
        <StatTile label={copy.common.hours} value={formatShiftHours(session?.stats.totalWorkingMinutes, copy)} hint={copy.stats.today} />
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
          <Text style={[styles.errorText, isRtl && styles.rtlText]}>{sessionQuery.error instanceof Error ? sessionQuery.error.message : copy.errors.couldNotLoadAccess}</Text>
          <Button label={copy.common.signOut} tone="light" onPress={signOut} />
        </View>
      </SafeAreaView>
    );
  }

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
          activeTab === 'notifications' && { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.xl) }
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
        </View>

        {activeTab === 'home' ? renderHome() : null}
        {activeTab === 'orders' ? renderOrders() : null}
        {activeTab === 'transfer' ? renderTransfer() : null}
        {activeTab === 'notifications' ? renderNotifications() : null}
        {activeTab === 'history' ? renderHistory() : null}
        {activeTab === 'stats' ? renderStats() : null}
        {activeTab === 'profile' ? renderProfile() : null}
      </ScrollView>

      {activeTab !== 'notifications' ? (
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

  useEffect(() => {
    loadSavedDriverLanguage()
      .then(savedLanguage => setLanguage(savedLanguage))
      .finally(() => setLanguageLoaded(true));
  }, []);

  const changeLanguage = useCallback((nextLanguage: DriverLanguage) => {
    setLanguage(nextLanguage);
    saveDriverLanguage(nextLanguage).catch(error => console.warn('Driver language save failed', error));
  }, []);

  if (!languageLoaded) {
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
    ? <Dashboard onSignedOut={() => setSession(null)} language={language} onLanguageChange={changeLanguage} />
    : <LoginScreen onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} copy={copy} isRtl={isRtl} />;
}

const styles = StyleSheet.create({
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
  loginWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
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
  loginBrandStage: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  loginLogo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: colors.brand
  },
  loginAppBadgeText: {
    color: colors.brand,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  loginPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  loginPanelHeader: {
    gap: 5
  },
  loginPanelTitle: {
    color: colors.ink,
    fontSize: 22
  },
  loginPanelSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
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
  loginFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md
  },
  loginFootnoteDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.success
  },
  loginFootnoteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  eyebrow: {
    color: colors.brand,
    ...typography.micro
  },
  loginTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center'
  },
  loginSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center'
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  passwordField: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14
  },
  passwordInput: {
    flex: 1,
    minHeight: 48,
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
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSoft,
    padding: spacing.md
  },
  infoTitle: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '900'
  },
  infoText: {
    marginTop: 4,
    color: colors.info,
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
  branchRailWrap: {
    gap: spacing.sm
  },
  branchRailLabel: {
    color: colors.muted,
    ...typography.micro
  },
  branchRail: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  branchChip: {
    width: 148,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  branchChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  branchChipCode: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  branchChipCodeActive: {
    color: colors.brand
  },
  branchChipName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900'
  },
  branchChipNameActive: {
    color: colors.brandDark
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
