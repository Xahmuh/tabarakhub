import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, CheckCheck, Clock3, Inbox, MapPin, RefreshCcw, Truck } from 'lucide-react';
import { DeliveryNotification } from '../../types';
import { deliveryNotificationService } from '../../services/deliveryNotificationService';
import { BackToModulesButton } from '../shared';

interface DeliveryNotificationsPageProps {
  onBack: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Pending time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending time';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getLocationLabel = (notification: DeliveryNotification) => {
  const block = notification.payload.blockNumber?.trim();
  const area = notification.payload.areaName?.trim();
  if (block && area) return `Block ${block} - ${area}`;
  if (block) return `Block ${block}`;
  if (area) return area;
  return 'Location not recorded';
};

const NotificationStrip: React.FC<{
  notification: DeliveryNotification;
  onMarkRead: (id: string) => void;
  isSaving: boolean;
}> = ({ notification, onMarkRead, isSaving }) => {
  const deliveredAt = notification.payload.deliveredAt || notification.createdAt;
  const branchLabel = notification.branchName || notification.branchCode || 'Branch';
  const driverLabel = notification.driverName || notification.driverCode || 'Driver';

  return (
    <article className={`grid gap-4 border-b border-slate-100 p-4 transition-colors last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)_auto] md:items-center ${
      notification.isRead ? 'bg-white' : 'bg-brand/5'
    }`}>
      <div className="flex min-w-0 gap-3">
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-brand text-white shadow-sm shadow-brand/20'
        }`}>
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-sm font-black leading-5 text-slate-950">{notification.title}</h3>
            {!notification.isRead && (
              <span className="rounded-md bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-600">{notification.body}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(deliveredAt)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5" />
              {getLocationLabel(notification)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Branch</p>
          <p className="mt-1 break-words font-black text-slate-900">{branchLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Driver</p>
          <p className="mt-1 break-words font-bold text-slate-600">{driverLabel}</p>
        </div>
      </div>

      <div className="flex justify-start md:justify-end">
        {notification.isRead ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
            <Check className="h-4 w-4" />
            Read
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm transition-all hover:bg-brand active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            Mark read
          </button>
        )}
      </div>
    </article>
  );
};

export const DeliveryNotificationsPage: React.FC<DeliveryNotificationsPageProps> = ({ onBack, onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setError(null);
    try {
      const [items, count] = await Promise.all([
        deliveryNotificationService.list({ limit: 100, unreadOnly: showUnreadOnly }),
        deliveryNotificationService.getUnreadCount()
      ]);
      setNotifications(items);
      setUnreadTotal(count);
      onUnreadCountChange?.(count);
    } catch (loadError) {
      console.error('Delivery notifications load failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load delivery notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange, showUnreadOnly]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleNewNotification = () => {
      void loadNotifications();
    };
    window.addEventListener('tabarak_delivery_notification_received', handleNewNotification);
    return () => window.removeEventListener('tabarak_delivery_notification_received', handleNewNotification);
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    setIsSaving(true);
    try {
      await deliveryNotificationService.markRead(id, true);
      const next = notifications.map(notification => (
        notification.id === id
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      ));
      setNotifications(showUnreadOnly ? next.filter(notification => !notification.isRead) : next);
      const nextUnreadCount = await deliveryNotificationService.getUnreadCount();
      setUnreadTotal(nextUnreadCount);
      onUnreadCountChange?.(nextUnreadCount);
    } catch (markError) {
      console.error('Delivery notification mark-read failed:', markError);
      setError(markError instanceof Error ? markError.message : 'Could not mark notification as read.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAllRead = async () => {
    setIsSaving(true);
    try {
      await deliveryNotificationService.markAllRead();
      setNotifications(showUnreadOnly ? [] : notifications.map(notification => ({
        ...notification,
        isRead: true,
        readAt: new Date().toISOString()
      })));
      setUnreadTotal(0);
      onUnreadCountChange?.(0);
    } catch (markError) {
      console.error('Delivery notifications mark-all-read failed:', markError);
      setError(markError instanceof Error ? markError.message : 'Could not mark notifications as read.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/25">
            <BellRing className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand">Delivery alerts</p>
            <h1 className="mt-1 break-words text-3xl font-black tracking-tight text-slate-950">Notifications</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              Driver-delivered orders are collected here as an operational inbox.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BackToModulesButton onClick={onBack} />
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void loadNotifications();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition-all hover:border-brand/40 hover:text-brand active:scale-95"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Unread</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-brand">{unreadTotal}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Loaded</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{notifications.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 md:w-auto">
          {[
            { key: false, label: 'All' },
            { key: true, label: 'Unread' }
          ].map(option => (
            <button
              key={option.label}
              type="button"
              onClick={() => setShowUnreadOnly(option.key)}
              className={`flex-1 rounded-md px-4 py-2 text-xs font-black transition-all md:flex-none ${
                showUnreadOnly === option.key
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={isSaving || unreadTotal === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map(index => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Inbox className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-950">No delivery notifications</h3>
            <p className="mt-1 max-w-sm text-sm font-semibold leading-6 text-slate-500">
              New driver delivery confirmations will appear here.
            </p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationStrip
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              isSaving={isSaving}
            />
          ))
        )}
      </div>
    </section>
  );
};
