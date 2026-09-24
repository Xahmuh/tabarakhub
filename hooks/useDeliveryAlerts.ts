import { useCallback, useEffect, useState } from 'react';
import { deliveryNotificationService } from '../services/deliveryNotificationService';

interface UseDeliveryAlertsOptions {
  userId?: string | null;
  canReceiveDeliveryNotifications: boolean;
  activeTab?: string | null;
}

export const useDeliveryAlerts = ({
  userId,
  canReceiveDeliveryNotifications,
  activeTab
}: UseDeliveryAlertsOptions) => {
  const [deliveryNotificationUnreadCount, setDeliveryNotificationUnreadCount] = useState(0);
  const [hasDeliveryNotificationAlert, setHasDeliveryNotificationAlert] = useState(false);

  const playDeliveryNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/pharmacy.mp3');
      audio.volume = 0.8;
      void audio.play().catch(() => undefined);
    } catch {
      // Browser audio can be unavailable until the first user gesture.
    }
  }, []);

  useEffect(() => {
    if (!canReceiveDeliveryNotifications) {
      setDeliveryNotificationUnreadCount(0);
      setHasDeliveryNotificationAlert(false);
      return;
    }

    let isMounted = true;

    const refreshUnreadCount = async () => {
      try {
        const count = await deliveryNotificationService.getUnreadCount();
        if (isMounted) setDeliveryNotificationUnreadCount(count);
      } catch (error) {
        console.warn('Delivery notification count failed:', error);
      }
    };

    void refreshUnreadCount();

    const unsubscribe = deliveryNotificationService.subscribeToNew(notification => {
      if (!isMounted) return;
      setDeliveryNotificationUnreadCount(count => count + 1);
      setHasDeliveryNotificationAlert(true);
      playDeliveryNotificationSound();
      window.dispatchEvent(new CustomEvent('tabarak_delivery_notification_received', { detail: notification }));
    });
    const intervalId = window.setInterval(refreshUnreadCount, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [userId, canReceiveDeliveryNotifications, playDeliveryNotificationSound]);

  useEffect(() => {
    if (activeTab === 'notifications') setHasDeliveryNotificationAlert(false);
  }, [activeTab]);

  return {
    deliveryNotificationUnreadCount,
    setDeliveryNotificationUnreadCount,
    hasDeliveryNotificationAlert,
    setHasDeliveryNotificationAlert,
    playDeliveryNotificationSound
  };
};
