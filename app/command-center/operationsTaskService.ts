import { supabaseClient } from '../../lib/supabaseClient';
import { isDemoMode } from '../../config/clientConfig';
import {
  ActionQueueStatus,
  AddOperationsTaskCommentInput,
  CreateOperationsTaskInput,
  OperationsTask,
  OperationsTaskEvent,
  OperationalAlert,
  UpdateOperationsTaskStatusInput
} from './types';

const TASKS_KEY = 'tabarak_demo_operations_tasks';
const EVENTS_KEY = 'tabarak_demo_operations_task_events';
const priorityWeight: Record<ActionQueueStatus | 'low' | 'medium' | 'high' | 'critical', number> = {
  open: 0,
  in_progress: 0,
  resolved: 0,
  dismissed: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const readDemoArray = <T>(key: string): T[] => {
  if (!isDemoMode) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
};

const writeDemoArray = <T>(key: string, value: T[]) => {
  if (!isDemoMode) return;
  localStorage.setItem(key, JSON.stringify(value));
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) return parts.join(' | ');
  }
  return String(error);
};

const throwUnlessDemoMode = (error: unknown, context: string) => {
  if (!isDemoMode) throw new Error(`${context}: ${getErrorMessage(error)}`);
};

const toTask = (row: any): OperationsTask => ({
  id: row.id,
  sourceModule: row.source_module,
  title: row.title,
  description: row.description,
  severity: row.severity,
  priority: row.priority,
  status: row.status,
  branchId: row.branch_id,
  branchName: row.branch_name,
  ownerRole: row.owner_role,
  assignedTo: row.assigned_to,
  recommendedAction: row.recommended_action,
  nextStep: row.next_step,
  relatedRecordId: row.related_record_id,
  relatedRecordType: row.related_record_type,
  createdBy: row.created_by,
  resolvedBy: row.resolved_by,
  dueAt: row.due_at,
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toEvent = (row: any): OperationsTaskEvent => ({
  id: row.id,
  taskId: row.task_id,
  eventType: row.event_type,
  oldStatus: row.old_status,
  newStatus: row.new_status,
  comment: row.comment,
  createdBy: row.created_by,
  createdAt: row.created_at
});

const toInsertPayload = (input: CreateOperationsTaskInput) => ({
  source_module: input.sourceModule,
  title: input.title,
  description: input.description || null,
  severity: input.severity,
  priority: input.priority,
  branch_id: input.branchId || null,
  branch_name: input.branchName || null,
  owner_role: input.ownerRole || null,
  assigned_to: input.assignedTo || null,
  recommended_action: input.recommendedAction || null,
  next_step: input.nextStep || input.recommendedAction || null,
  related_record_id: input.relatedRecordId || null,
  related_record_type: input.relatedRecordType || null,
  due_at: input.dueAt || null
});

const inputFromAlert = (alert: OperationalAlert): CreateOperationsTaskInput => ({
  sourceModule: alert.sourceModule,
  title: alert.title,
  description: alert.message,
  severity: alert.severity,
  priority: alert.severity,
  branchId: alert.branchId || null,
  branchName: alert.branchName || null,
  ownerRole: alert.ownerRole || null,
  recommendedAction: alert.recommendedAction,
  nextStep: alert.recommendedAction,
  relatedRecordId: alert.relatedRecordId || alert.id,
  relatedRecordType: alert.relatedRecordType || alert.type,
  dueAt: alert.dueAt || null
});

const findMatchingDemoTask = (tasks: OperationsTask[], input: CreateOperationsTaskInput) =>
  tasks.find(task =>
    ['open', 'in_progress'].includes(task.status)
    && task.sourceModule === input.sourceModule
    && task.title === input.title
    && (task.branchId || null) === (input.branchId || null)
    && (task.relatedRecordId || null) === (input.relatedRecordId || null)
    && (task.relatedRecordType || null) === (input.relatedRecordType || null)
  );

const sortTasksForQueue = (tasks: OperationsTask[]) =>
  [...tasks].sort((a, b) =>
    (priorityWeight[b.priority] - priorityWeight[a.priority])
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

const makeDemoEvent = (event: Omit<OperationsTaskEvent, 'id' | 'createdAt'>): OperationsTaskEvent => ({
  ...event,
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString()
});

export const operationsTaskService = {
  listOpenTasks: async (): Promise<OperationsTask[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('operations_tasks')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return sortTasksForQueue((data || []).map(toTask));
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load saved operations tasks');
      return sortTasksForQueue(readDemoArray<OperationsTask>(TASKS_KEY)
        .filter(task => task.status === 'open' || task.status === 'in_progress')
      );
    }
  },

  createTaskFromAlert: async (alert: OperationalAlert): Promise<OperationsTask> => {
    const input = inputFromAlert(alert);

    try {
      let query = supabaseClient
        .from('operations_tasks')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .eq('source_module', input.sourceModule)
        .eq('title', input.title);

      query = input.relatedRecordId
        ? query.eq('related_record_id', input.relatedRecordId)
        : query.is('related_record_id', null);
      query = input.relatedRecordType
        ? query.eq('related_record_type', input.relatedRecordType)
        : query.is('related_record_type', null);
      query = input.branchId
        ? query.eq('branch_id', input.branchId)
        : query.is('branch_id', null);

      const { data: existing, error: existingError } = await query.limit(1);
      if (existingError) throw existingError;
      if (existing && existing.length > 0) return toTask(existing[0]);

      const { data, error } = await supabaseClient
        .from('operations_tasks')
        .insert([toInsertPayload(input)])
        .select()
        .single();
      if (error) throw error;

      const task = toTask(data);
      const { error: eventError } = await supabaseClient
        .from('operations_task_events')
        .insert([{
          task_id: task.id,
          event_type: 'created',
          new_status: task.status,
          comment: `Task created from computed alert: ${alert.type}`
        }]);
      if (eventError) throw eventError;
      return task;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to create operations task');
      const tasks = readDemoArray<OperationsTask>(TASKS_KEY);
      const existing = findMatchingDemoTask(tasks, input);
      if (existing) return existing;

      const now = new Date().toISOString();
      const task: OperationsTask = {
        id: crypto.randomUUID(),
        sourceModule: input.sourceModule,
        title: input.title,
        description: input.description || null,
        severity: input.severity,
        priority: input.priority,
        status: 'open',
        branchId: input.branchId || null,
        branchName: input.branchName || null,
        ownerRole: input.ownerRole || null,
        assignedTo: input.assignedTo || null,
        recommendedAction: input.recommendedAction || null,
        nextStep: input.nextStep || null,
        relatedRecordId: input.relatedRecordId || null,
        relatedRecordType: input.relatedRecordType || null,
        dueAt: input.dueAt || null,
        createdAt: now,
        updatedAt: now
      };
      writeDemoArray(TASKS_KEY, [task, ...tasks]);
      const events = readDemoArray<OperationsTaskEvent>(EVENTS_KEY);
      writeDemoArray(EVENTS_KEY, [
        makeDemoEvent({ taskId: task.id, eventType: 'created', comment: 'Demo task created from alert' }),
        ...events
      ]);
      return task;
    }
  },

  updateTaskStatus: async ({ taskId, status, comment }: UpdateOperationsTaskStatusInput): Promise<OperationsTask> => {
    try {
      const { data: current, error: currentError } = await supabaseClient
        .from('operations_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      if (currentError) throw currentError;

      const { data, error } = await supabaseClient
        .from('operations_tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw error;

      const task = toTask(data);
      const { error: eventError } = await supabaseClient
        .from('operations_task_events')
        .insert([{
          task_id: taskId,
          event_type: 'status_changed',
          old_status: current.status,
          new_status: status,
          comment: comment || null
        }]);
      if (eventError) throw eventError;
      return task;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to update operations task status');
      const tasks = readDemoArray<OperationsTask>(TASKS_KEY);
      const idx = tasks.findIndex(task => task.id === taskId);
      if (idx === -1) throw new Error('Demo task not found');
      const oldStatus = tasks[idx].status;
      const now = new Date().toISOString();
      tasks[idx] = {
        ...tasks[idx],
        status,
        resolvedAt: status === 'resolved' || status === 'dismissed' ? now : null,
        updatedAt: now
      };
      writeDemoArray(TASKS_KEY, tasks);
      const events = readDemoArray<OperationsTaskEvent>(EVENTS_KEY);
      writeDemoArray(EVENTS_KEY, [
        makeDemoEvent({ taskId, eventType: 'status_changed', oldStatus, newStatus: status, comment }),
        ...events
      ]);
      return tasks[idx];
    }
  },

  addTaskComment: async (taskId: string, comment: string): Promise<OperationsTaskEvent> => {
    try {
      const { data, error } = await supabaseClient
        .from('operations_task_events')
        .insert([{ task_id: taskId, event_type: 'comment', comment }])
        .select()
        .single();
      if (error) throw error;
      return toEvent(data);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to add operations task comment');
      const event = makeDemoEvent({ taskId, eventType: 'comment', comment });
      const events = readDemoArray<OperationsTaskEvent>(EVENTS_KEY);
      writeDemoArray(EVENTS_KEY, [event, ...events]);
      return event;
    }
  },

  addTaskCommentFromInput: async ({ taskId, comment }: AddOperationsTaskCommentInput): Promise<OperationsTaskEvent> => {
    return operationsTaskService.addTaskComment(taskId, comment);
  },

  listTaskEvents: async (taskId: string): Promise<OperationsTaskEvent[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('operations_task_events')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(toEvent);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load operations task events');
      return readDemoArray<OperationsTaskEvent>(EVENTS_KEY)
        .filter(event => event.taskId === taskId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }
};
