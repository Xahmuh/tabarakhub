import AsyncStorage from '@react-native-async-storage/async-storage';
import { DriverOrderStatus } from './api';

const QUEUE_KEY = 'tabarak-driver:queued-order-actions';

export type QueuedOrderAction = {
  id: string;
  orderId: string;
  nextStatus: DriverOrderStatus;
  notes?: string | null;
  createdAt: string;
};

export const readQueuedActions = async (): Promise<QueuedOrderAction[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueuedActions = async (actions: QueuedOrderAction[]) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(actions));
};

export const enqueueOrderAction = async (
  orderId: string,
  nextStatus: DriverOrderStatus,
  notes?: string | null
) => {
  const actions = await readQueuedActions();
  const action: QueuedOrderAction = {
    id: `${orderId}:${nextStatus}:${Date.now()}`,
    orderId,
    nextStatus,
    notes,
    createdAt: new Date().toISOString()
  };
  await writeQueuedActions([...actions, action]);
  return action;
};

export const flushQueuedActions = async (
  send: (action: QueuedOrderAction) => Promise<void>
) => {
  const actions = await readQueuedActions();
  const remaining: QueuedOrderAction[] = [];

  for (const action of actions) {
    try {
      await send(action);
    } catch {
      remaining.push(action);
    }
  }

  await writeQueuedActions(remaining);
  return { attempted: actions.length, remaining: remaining.length };
};
