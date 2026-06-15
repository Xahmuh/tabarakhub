import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { driverApi, DriverOrder, DriverOrderStatus } from '../src/lib/api';
import { enqueueOrderAction, flushQueuedActions } from '../src/lib/offlineQueue';
import { hasSupabaseConfig, supabase } from '../src/lib/supabase';
import { colors } from '../src/theme';

const money = (value: number) => `BHD ${value.toFixed(3)}`;

const statusLabel = (status: DriverOrderStatus) =>
  status === 'picked_up' ? 'Picked up' : status.charAt(0).toUpperCase() + status.slice(1);

const requestPushToken = async () => {
  try {
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const token = await Notifications.getExpoPushTokenAsync();
    if (token.data) await driverApi.registerPushToken(token.data);
  } catch (error) {
    console.warn('Push token registration skipped', error);
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
  tone?: 'brand' | 'light' | 'danger' | 'success';
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.button,
      tone === 'brand' && styles.buttonBrand,
      tone === 'light' && styles.buttonLight,
      tone === 'danger' && styles.buttonDanger,
      tone === 'success' && styles.buttonSuccess,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed
    ]}
  >
    <Text style={[
      styles.buttonText,
      tone === 'light' && styles.buttonTextLight
    ]}>
      {label}
    </Text>
  </Pressable>
);

const LoginScreen = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing login', 'Enter the driver email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await driverApi.signIn(email, password);
      onSignedIn();
    } catch (error: any) {
      Alert.alert('Login failed', error?.message || 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.loginWrap}>
        <View>
          <Text style={styles.eyebrow}>Tabarak Pharmacy</Text>
          <Text style={styles.loginTitle}>Driver Dispatch</Text>
          <Text style={styles.loginSub}>Sign in with the driver account created in Users & Roles.</Text>
        </View>
        <View style={styles.loginPanel}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="driver@example.com"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Button label={isSubmitting ? 'Signing in...' : 'Sign in'} onPress={submit} disabled={isSubmitting} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.statTile}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const OrderCard = ({
  order,
  onAction,
  busy
}: {
  order: DriverOrder;
  onAction: (order: DriverOrder, nextStatus: DriverOrderStatus) => void;
  busy: boolean;
}) => {
  const canPickUp = order.deliveryStatus === 'assigned';
  const canDeliver = order.deliveryStatus === 'assigned' || order.deliveryStatus === 'picked_up';

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={styles.orderTitleWrap}>
          <Text style={styles.orderBranch}>{order.branchName}</Text>
          <Text style={styles.orderMeta}>
            {order.paymentType} {order.blockNumber ? `- Block ${order.blockNumber}` : ''}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel(order.deliveryStatus)}</Text>
        </View>
      </View>
      <View style={styles.orderValueRow}>
        <Text style={styles.orderValue}>{money(order.valueBhd)}</Text>
        <Text style={styles.orderArea}>{order.areaName || order.governorate || 'No area'}</Text>
      </View>
      {order.notes ? <Text style={styles.orderNotes}>{order.notes}</Text> : null}
      <View style={styles.orderActions}>
        {canPickUp ? (
          <Button label="Picked up" tone="light" disabled={busy} onPress={() => onAction(order, 'picked_up')} />
        ) : null}
        {canDeliver ? (
          <Button label="Delivered" tone="success" disabled={busy} onPress={() => onAction(order, 'delivered')} />
        ) : null}
        <Button label="Cancel" tone="danger" disabled={busy} onPress={() => onAction(order, 'cancelled')} />
      </View>
    </View>
  );
};

const Dashboard = ({ onSignedOut }: { onSignedOut: () => void }) => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['driver-session'],
    queryFn: driverApi.session
  });

  const ordersQuery = useQuery({
    queryKey: ['driver-active-orders'],
    queryFn: driverApi.activeOrders
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['driver-session'] }),
      queryClient.invalidateQueries({ queryKey: ['driver-active-orders'] })
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

  useEffect(() => {
    requestPushToken();
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) syncQueue().catch(error => console.warn('Queue sync failed', error));
    });
    return unsubscribe;
  }, [syncQueue]);

  const shiftMutation = useMutation({
    mutationFn: async (next: 'start' | 'end') => next === 'start' ? driverApi.startShift() : driverApi.endShift(),
    onSuccess: refreshAll,
    onError: (error: any) => Alert.alert('Shift update failed', error?.message || 'Could not update shift.')
  });

  const orderMutation = useMutation({
    mutationFn: async ({ order, nextStatus }: { order: DriverOrder; nextStatus: DriverOrderStatus }) => {
      const network = await NetInfo.fetch();
      if (!network.isConnected) {
        await enqueueOrderAction(
          order.id,
          nextStatus,
          nextStatus === 'cancelled' ? 'Cancelled from driver mobile while offline' : null
        );
        return 'queued';
      }
      await driverApi.transitionOrder(
        order.id,
        nextStatus,
        nextStatus === 'cancelled' ? 'Cancelled from driver mobile' : null
      );
      return 'sent';
    },
    onSuccess: async result => {
      await refreshAll();
      if (result === 'queued') Alert.alert('Queued offline', 'This update will sync when the connection returns.');
    },
    onError: (error: any) => Alert.alert('Order update failed', error?.message || 'Could not update this order.')
  });

  const session = sessionQuery.data;
  const orders = ordersQuery.data || [];
  const activeShift = session?.activeShift;
  const isBusy = shiftMutation.isPending || orderMutation.isPending || isSyncing;
  const isLoading = sessionQuery.isLoading || ordersQuery.isLoading;

  const inMotionValue = useMemo(
    () => orders.reduce((total, order) => total + order.valueBhd, 0),
    [orders]
  );

  const actionOrder = (order: DriverOrder, nextStatus: DriverOrderStatus) => {
    if (nextStatus === 'cancelled') {
      Alert.alert('Cancel order?', 'This will notify dispatch and close the order for your route.', [
        { text: 'Keep order', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => orderMutation.mutate({ order, nextStatus }) }
      ]);
      return;
    }
    orderMutation.mutate({ order, nextStatus });
  };

  const signOut = async () => {
    await driverApi.signOut();
    onSignedOut();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading driver workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionQuery.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Driver access blocked</Text>
          <Text style={styles.errorText}>{sessionQuery.error instanceof Error ? sessionQuery.error.message : 'Could not load driver access.'}</Text>
          <Button label="Sign out" tone="light" onPress={signOut} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={isLoading || isSyncing} onRefresh={refreshAll} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Driver mobile</Text>
            <Text style={styles.title}>{session?.driver.name || 'Driver'}</Text>
            <Text style={styles.subTitle}>{session?.driver.driverCode || 'Delivery route'} - {activeShift ? 'Online' : 'Offline'}</Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={[styles.shiftCard, activeShift ? styles.shiftOnline : styles.shiftOffline]}>
          <View>
            <Text style={styles.shiftLabel}>{activeShift ? 'Shift active' : 'Shift offline'}</Text>
            <Text style={styles.shiftValue}>{activeShift ? 'Ready for assigned orders' : 'Start shift before taking deliveries'}</Text>
          </View>
          <Button
            label={activeShift ? 'End shift' : 'Start shift'}
            tone={activeShift ? 'light' : 'brand'}
            disabled={isBusy}
            onPress={() => shiftMutation.mutate(activeShift ? 'end' : 'start')}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatTile label="Active orders" value={orders.length} />
          <StatTile label="In motion" value={money(inMotionValue)} />
          <StatTile label="Delivered" value={session?.stats.deliveredCount ?? 0} />
          <StatTile label="Minutes" value={session?.stats.totalWorkingMinutes ?? 0} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned orders</Text>
          <Pressable onPress={syncQueue} disabled={isBusy}>
            <Text style={styles.syncText}>{isSyncing ? 'Syncing...' : 'Sync queue'}</Text>
          </Pressable>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No active assigned orders</Text>
            <Text style={styles.emptyText}>New orders appear here after the branch records and assigns them.</Text>
          </View>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              busy={isBusy}
              onAction={actionOrder}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default function DriverApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Supabase env missing</Text>
          <Text style={styles.errorText}>Create apps/driver-mobile/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text>
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
    ? <Dashboard onSignedOut={() => setSession(null)} />
    : <LoginScreen onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.page
  },
  page: {
    padding: 18,
    paddingBottom: 34,
    gap: 14
  },
  loginWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    gap: 24
  },
  loginPanel: {
    gap: 12
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase'
  },
  loginTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900'
  },
  loginSub: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1
  },
  buttonBrand: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  buttonSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  buttonDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  },
  buttonLight: {
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  buttonTextLight: {
    color: colors.ink
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start'
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900'
  },
  subTitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800'
  },
  signOutButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  signOutText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  shiftCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  shiftOnline: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4'
  },
  shiftOffline: {
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  shiftLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  shiftValue: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  statValue: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900'
  },
  sectionHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  syncText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  emptyState: {
    minHeight: 140,
    borderRadius: 16,
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
    fontSize: 15,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12
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
  orderBranch: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900'
  },
  orderMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  orderValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  orderValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900'
  },
  orderArea: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right'
  },
  orderNotes: {
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18
  },
  orderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  }
});
