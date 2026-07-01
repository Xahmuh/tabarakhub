import { isDemoMode } from '../../config/clientConfig';
import { supabaseClient } from '../../lib/supabaseClient';
import {
  AddWorkflowTaskCommentInput,
  AddWorkflowTaskAttachmentInput,
  CreateWorkflowTaskInput,
  CreateWorkflowTaskTemplateInput,
  UpdateWorkflowTaskStatusInput,
  UpdateWorkflowTaskTemplateInput,
  WorkflowTask,
  WorkflowTaskAttachment,
  WorkflowTaskEvent,
  WorkflowTaskFilters,
  WorkflowTaskPriority,
  WorkflowTaskStatus,
  WorkflowTaskTemplate
} from './types';

const TASKS_KEY = 'tabarak_demo_workflow_tasks';
const EVENTS_KEY = 'tabarak_demo_workflow_task_events';
const TEMPLATES_KEY = 'tabarak_demo_workflow_task_templates';
const ATTACHMENTS_KEY = 'tabarak_demo_workflow_task_attachments';

const ACTIVE_STATUSES: WorkflowTaskStatus[] = ['open', 'in_progress', 'submitted', 'rejected'];
const CLOSED_STATUSES: WorkflowTaskStatus[] = ['approved', 'done', 'dismissed', 'expired'];
const priorityWeight: Record<WorkflowTaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dueAtForDate = (value: string) => {
  const date = new Date(`${value}T23:59:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const addFrequency = (value: string, frequency: WorkflowTaskTemplate['recurrenceFrequency']) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  if (frequency === 'none') return value;
  if (frequency === 'daily') date.setDate(date.getDate() + 1);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3);
  return dateKey(date);
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

const parseMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const toTask = (row: any): WorkflowTask => ({
  id: row.id,
  taskKind: row.task_kind,
  title: row.title,
  description: row.description,
  priority: row.priority,
  status: row.status,
  branchId: row.branch_id,
  branchName: row.branch_name,
  assigneeRole: row.assignee_role,
  assignedTo: row.assigned_to,
  reviewRequired: Boolean(row.review_required),
  templateId: row.template_id,
  templateOccurrenceDate: row.template_occurrence_date,
  dueAt: row.due_at,
  submittedAt: row.submitted_at,
  reviewedAt: row.reviewed_at ?? row.approved_at,
  reviewedBy: row.reviewed_by ?? row.approved_by,
  reviewOutcome: row.review_outcome ?? (row.status === 'approved' || row.status === 'rejected' ? row.status : null),
  approvedAt: row.approved_at ?? row.reviewed_at,
  approvedBy: row.approved_by ?? row.reviewed_by,
  resolvedAt: row.resolved_at,
  resolvedBy: row.resolved_by,
  dismissedBy: row.dismissed_by,
  metadata: parseMetadata(row.metadata),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastActivityAt: row.last_activity_at
});

const toEvent = (row: any): WorkflowTaskEvent => ({
  id: row.id,
  taskId: row.task_id,
  eventType: row.event_type,
  oldStatus: row.old_status,
  newStatus: row.new_status,
  comment: row.comment,
  metadata: parseMetadata(row.metadata),
  createdBy: row.created_by,
  createdAt: row.created_at
});

const toAttachment = (row: any): WorkflowTaskAttachment => ({
  id: row.id,
  taskId: row.task_id,
  fileName: row.file_name,
  filePath: row.file_path,
  fileUrl: row.file_url,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  scanStatus: row.scan_status,
  scannedAt: row.scanned_at,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at
});

const toTemplate = (row: any): WorkflowTaskTemplate => ({
  id: row.id,
  taskKind: row.task_kind,
  title: row.title,
  description: row.description,
  priority: row.priority,
  branchId: row.branch_id,
  branchName: row.branch_name,
  assigneeRole: row.assignee_role,
  assignedTo: row.assigned_to,
  reviewRequired: Boolean(row.review_required),
  recurrenceFrequency: row.recurrence_frequency,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  nextDueOn: row.next_due_on,
  deletedAt: row.deleted_at,
  deletedBy: row.deleted_by,
  isActive: Boolean(row.is_active),
  metadata: parseMetadata(row.metadata),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toTaskInsertPayload = (input: CreateWorkflowTaskInput) => ({
  task_kind: input.taskKind,
  title: input.title.trim(),
  description: input.description?.trim() || null,
  priority: input.priority,
  branch_id: input.branchId || null,
  branch_name: input.branchName || null,
  assignee_role: input.assigneeRole || null,
  assigned_to: input.assignedTo || null,
  review_required: Boolean(input.reviewRequired),
  template_id: input.templateId || null,
  template_occurrence_date: input.templateOccurrenceDate || null,
  due_at: input.dueAt || null,
  metadata: input.metadata || {}
});

const toTemplateInsertPayload = (input: CreateWorkflowTaskTemplateInput) => ({
  task_kind: input.taskKind,
  title: input.title.trim(),
  description: input.description?.trim() || null,
  priority: input.priority,
  branch_id: input.branchId || null,
  branch_name: input.branchName || null,
  assignee_role: input.assigneeRole || null,
  assigned_to: input.assignedTo || null,
  review_required: Boolean(input.reviewRequired),
  recurrence_frequency: input.recurrenceFrequency,
  starts_on: input.startsOn,
  ends_on: input.endsOn || null,
  next_due_on: input.nextDueOn || input.startsOn,
  metadata: input.metadata || {}
});

const toTemplateUpdatePayload = (input: UpdateWorkflowTaskTemplateInput) => ({
  ...toTemplateInsertPayload(input),
  is_active: input.isActive ?? true
});

const toAttachmentInsertPayload = (input: AddWorkflowTaskAttachmentInput) => ({
  task_id: input.taskId,
  file_name: input.fileName.trim(),
  file_path: input.filePath?.trim() || null,
  file_url: input.fileUrl?.trim() || null,
  mime_type: input.mimeType?.trim() || null,
  size_bytes: input.sizeBytes ?? null
});

const makeDemoEvent = (event: Omit<WorkflowTaskEvent, 'id' | 'createdAt' | 'metadata'> & { metadata?: Record<string, unknown> }): WorkflowTaskEvent => ({
  ...event,
  id: crypto.randomUUID(),
  metadata: event.metadata || {},
  createdAt: new Date().toISOString()
});

const sortTasks = (tasks: WorkflowTask[]) =>
  [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return (aDue - bDue)
      || (priorityWeight[b.priority] - priorityWeight[a.priority])
      || new Date(b.lastActivityAt || b.updatedAt).getTime() - new Date(a.lastActivityAt || a.updatedAt).getTime();
  });

const filterDemoTasks = (tasks: WorkflowTask[], filters: WorkflowTaskFilters = {}) => {
  const normalizedSearch = filters.search?.trim().toLowerCase();
  return tasks.filter(task => {
    if (filters.kind && filters.kind !== 'all' && task.taskKind !== filters.kind) return false;
    if (filters.branchId && task.branchId !== filters.branchId) return false;
    if (filters.status?.length && !filters.status.includes(task.status)) return false;
    if (!filters.includeClosed && CLOSED_STATUSES.includes(task.status)) return false;
    if (normalizedSearch) {
      const haystack = `${task.title} ${task.description || ''} ${task.branchName || ''}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }
    return true;
  });
};

export const workflowTodoService = {
  listTasks: async (filters: WorkflowTaskFilters = {}): Promise<WorkflowTask[]> => {
    try {
      let query = supabaseClient
        .from('workflow_tasks')
        .select('*')
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('last_activity_at', { ascending: false })
        .limit(filters.limit || 250);

      if (filters.kind && filters.kind !== 'all') query = query.eq('task_kind', filters.kind);
      if (filters.branchId) query = query.eq('branch_id', filters.branchId);
      if (filters.status?.length) {
        query = query.in('status', filters.status);
      } else if (!filters.includeClosed) {
        query = query.in('status', ACTIVE_STATUSES);
      }

      const { data, error } = await query;
      if (error) throw error;
      const tasks = (data || []).map(toTask);
      return sortTasks(filterDemoTasks(tasks, { ...filters, includeClosed: true }));
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load workflow tasks');
      return sortTasks(filterDemoTasks(readDemoArray<WorkflowTask>(TASKS_KEY), filters)).slice(0, filters.limit || 250);
    }
  },

  listEvents: async (taskId: string): Promise<WorkflowTaskEvent[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_events')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(toEvent);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load workflow task activity');
      return readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)
        .filter(event => event.taskId === taskId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  createTask: async (input: CreateWorkflowTaskInput): Promise<WorkflowTask> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_tasks')
        .insert([toTaskInsertPayload(input)])
        .select()
        .single();
      if (error) throw error;

      const task = toTask(data);
      const { error: eventError } = await supabaseClient
        .from('workflow_task_events')
        .insert([{
          task_id: task.id,
          event_type: input.templateId ? 'template_generated' : 'created',
          comment: input.templateId ? 'Generated from recurring template' : 'Workflow task created'
        }]);
      if (eventError) throw eventError;
      return task;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to create workflow task');
      const now = new Date().toISOString();
      const task: WorkflowTask = {
        id: crypto.randomUUID(),
        taskKind: input.taskKind,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority,
        status: 'open',
        branchId: input.branchId || null,
        branchName: input.branchName || null,
        assigneeRole: input.assigneeRole || null,
        assignedTo: input.assignedTo || null,
        reviewRequired: Boolean(input.reviewRequired),
        templateId: input.templateId || null,
        templateOccurrenceDate: input.templateOccurrenceDate || null,
        dueAt: input.dueAt || null,
        metadata: input.metadata || {},
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now
      };
      writeDemoArray(TASKS_KEY, [task, ...readDemoArray<WorkflowTask>(TASKS_KEY)]);
      writeDemoArray(EVENTS_KEY, [
        makeDemoEvent({
          taskId: task.id,
          eventType: input.templateId ? 'template_generated' : 'created',
          comment: input.templateId ? 'Generated from demo recurring template' : 'Demo workflow task created'
        }),
        ...readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)
      ]);
      return task;
    }
  },

  updateTaskStatus: async (input: UpdateWorkflowTaskStatusInput): Promise<WorkflowTask> => {
    try {
      const { data: currentRow, error: currentError } = await supabaseClient
        .from('workflow_tasks')
        .select('*')
        .eq('id', input.taskId)
        .single();
      if (currentError) throw currentError;
      const current = toTask(currentRow);

      const { data, error } = await supabaseClient
        .from('workflow_tasks')
        .update({ status: input.status })
        .eq('id', input.taskId)
        .select()
        .single();
      if (error) throw error;

      const task = toTask(data);
      const eventType = input.status === 'approved' || input.status === 'rejected' ? 'review' : 'status_changed';
      const { error: eventError } = await supabaseClient
        .from('workflow_task_events')
        .insert([{
          task_id: task.id,
          event_type: eventType,
          old_status: current.status,
          new_status: task.status,
          comment: input.comment?.trim() || null
        }]);
      if (eventError) throw eventError;
      return task;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to update workflow task status');
      const now = new Date().toISOString();
      const tasks = readDemoArray<WorkflowTask>(TASKS_KEY);
      const current = tasks.find(task => task.id === input.taskId);
      if (!current) throw new Error('Workflow task was not found.');
      const updated: WorkflowTask = {
        ...current,
        status: input.status,
        submittedAt: input.status === 'submitted' ? now : current.submittedAt,
        reviewedAt: ['approved', 'rejected'].includes(input.status) ? now : current.reviewedAt,
        reviewedBy: ['approved', 'rejected'].includes(input.status) ? current.reviewedBy : current.reviewedBy,
        reviewOutcome: input.status === 'approved' || input.status === 'rejected' ? input.status : current.reviewOutcome,
        approvedAt: ['approved', 'rejected'].includes(input.status) ? now : current.approvedAt,
        resolvedAt: ['approved', 'done', 'dismissed', 'expired'].includes(input.status) ? now : current.resolvedAt,
        dismissedBy: input.status === 'dismissed' ? current.dismissedBy : current.dismissedBy,
        updatedAt: now,
        lastActivityAt: now
      };
      writeDemoArray(TASKS_KEY, tasks.map(task => task.id === input.taskId ? updated : task));
      writeDemoArray(EVENTS_KEY, [
        makeDemoEvent({
          taskId: updated.id,
          eventType: input.status === 'approved' || input.status === 'rejected' ? 'review' : 'status_changed',
          oldStatus: current.status,
          newStatus: updated.status,
          comment: input.comment?.trim() || null
        }),
        ...readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)
      ]);
      return updated;
    }
  },

  addComment: async (input: AddWorkflowTaskCommentInput): Promise<WorkflowTaskEvent> => {
    const comment = input.comment.trim();
    if (!comment) throw new Error('Comment cannot be empty.');

    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_events')
        .insert([{ task_id: input.taskId, event_type: 'comment', comment }])
        .select()
        .single();
      if (error) throw error;
      return toEvent(data);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to add workflow task comment');
      const event = makeDemoEvent({ taskId: input.taskId, eventType: 'comment', comment });
      writeDemoArray(EVENTS_KEY, [event, ...readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)]);
      return event;
    }
  },

  listAttachments: async (taskId: string): Promise<WorkflowTaskAttachment[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(toAttachment);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load workflow task attachments');
      return readDemoArray<WorkflowTaskAttachment>(ATTACHMENTS_KEY)
        .filter(attachment => attachment.taskId === taskId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  addAttachment: async (input: AddWorkflowTaskAttachmentInput): Promise<WorkflowTaskAttachment> => {
    const fileName = input.fileName.trim();
    const fileUrl = input.fileUrl?.trim() || null;
    const filePath = input.filePath?.trim() || null;
    if (!fileName) throw new Error('Attachment name is required.');
    if (!fileUrl && !filePath) throw new Error('Attachment URL or storage path is required.');

    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_attachments')
        .insert([toAttachmentInsertPayload({ ...input, fileName, fileUrl, filePath })])
        .select()
        .single();
      if (error) throw error;
      const attachment = toAttachment(data);
      const { error: eventError } = await supabaseClient
        .from('workflow_task_events')
        .insert([{
          task_id: input.taskId,
          event_type: 'attachment_added',
          comment: `Attachment added: ${attachment.fileName}`
        }]);
      if (eventError) throw eventError;
      return attachment;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to add workflow task attachment');
      const now = new Date().toISOString();
      const attachment: WorkflowTaskAttachment = {
        id: crypto.randomUUID(),
        taskId: input.taskId,
        fileName,
        fileUrl,
        filePath,
        mimeType: input.mimeType || null,
        sizeBytes: input.sizeBytes ?? null,
        scanStatus: 'skipped',
        scannedAt: null,
        createdAt: now
      };
      writeDemoArray(ATTACHMENTS_KEY, [attachment, ...readDemoArray<WorkflowTaskAttachment>(ATTACHMENTS_KEY)]);
      writeDemoArray(EVENTS_KEY, [
        makeDemoEvent({
          taskId: input.taskId,
          eventType: 'attachment_added',
          comment: `Attachment added: ${attachment.fileName}`
        }),
        ...readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)
      ]);
      return attachment;
    }
  },

  deleteAttachment: async (attachmentId: string): Promise<void> => {
    try {
      const { error } = await supabaseClient
        .from('workflow_task_attachments')
        .delete()
        .eq('id', attachmentId);
      if (error) throw error;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to delete workflow task attachment');
      writeDemoArray(
        ATTACHMENTS_KEY,
        readDemoArray<WorkflowTaskAttachment>(ATTACHMENTS_KEY).filter(attachment => attachment.id !== attachmentId)
      );
    }
  },

  listTemplates: async (): Promise<WorkflowTaskTemplate[]> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_templates')
        .select('*')
        .is('deleted_at', null)
        .order('is_active', { ascending: false })
        .order('next_due_on', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []).map(toTemplate);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to load workflow templates');
      return readDemoArray<WorkflowTaskTemplate>(TEMPLATES_KEY).filter(template => !template.deletedAt);
    }
  },

  createTemplate: async (input: CreateWorkflowTaskTemplateInput): Promise<WorkflowTaskTemplate> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_templates')
        .insert([toTemplateInsertPayload(input)])
        .select()
        .single();
      if (error) throw error;
      return toTemplate(data);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to create workflow template');
      const now = new Date().toISOString();
      const template: WorkflowTaskTemplate = {
        id: crypto.randomUUID(),
        taskKind: input.taskKind,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority,
        branchId: input.branchId || null,
        branchName: input.branchName || null,
        assigneeRole: input.assigneeRole || null,
        assignedTo: input.assignedTo || null,
        reviewRequired: Boolean(input.reviewRequired),
        recurrenceFrequency: input.recurrenceFrequency,
        startsOn: input.startsOn,
        endsOn: input.endsOn || null,
        nextDueOn: input.nextDueOn || input.startsOn,
        deletedAt: null,
        deletedBy: null,
        isActive: true,
        metadata: input.metadata || {},
        createdAt: now,
        updatedAt: now
      };
      writeDemoArray(TEMPLATES_KEY, [template, ...readDemoArray<WorkflowTaskTemplate>(TEMPLATES_KEY)]);
      return template;
    }
  },

  updateTemplate: async (input: UpdateWorkflowTaskTemplateInput): Promise<WorkflowTaskTemplate> => {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_task_templates')
        .update(toTemplateUpdatePayload(input))
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return toTemplate(data);
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to update workflow template');
      const now = new Date().toISOString();
      let updated: WorkflowTaskTemplate | null = null;
      writeDemoArray(
        TEMPLATES_KEY,
        readDemoArray<WorkflowTaskTemplate>(TEMPLATES_KEY).map(template => {
          if (template.id !== input.id) return template;
          updated = {
            ...template,
            taskKind: input.taskKind,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            priority: input.priority,
            branchId: input.branchId || null,
            branchName: input.branchName || null,
            assigneeRole: input.assigneeRole || null,
            assignedTo: input.assignedTo || null,
            reviewRequired: Boolean(input.reviewRequired),
            recurrenceFrequency: input.recurrenceFrequency,
            startsOn: input.startsOn,
            endsOn: input.endsOn || null,
            nextDueOn: input.nextDueOn || input.startsOn,
            isActive: input.isActive ?? template.isActive,
            metadata: input.metadata || {},
            updatedAt: now
          };
          return updated;
        })
      );
      if (!updated) throw new Error('Workflow template was not found.');
      return updated;
    }
  },

  deleteTemplate: async (templateId: string): Promise<void> => {
    try {
      const { error } = await supabaseClient
        .from('workflow_task_templates')
        .delete()
        .eq('id', templateId);
      if (error) throw error;
    } catch (error) {
      throwUnlessDemoMode(error, 'Unable to delete workflow template');
      const now = new Date().toISOString();
      writeDemoArray(
        TEMPLATES_KEY,
        readDemoArray<WorkflowTaskTemplate>(TEMPLATES_KEY).map(template =>
          template.id === templateId
            ? { ...template, deletedAt: now, isActive: false, updatedAt: now }
            : template
        )
      );
    }
  },

  generateDueTasks: async (throughDate = dateKey(new Date())): Promise<WorkflowTask[]> => {
    const generated: WorkflowTask[] = [];
    const templates = await workflowTodoService.listTemplates();
    const dueTemplates = templates.filter(template =>
      template.isActive
      && !template.deletedAt
      && template.nextDueOn
      && template.nextDueOn <= throughDate
      && (!template.endsOn || template.nextDueOn <= template.endsOn)
    );

    for (const template of dueTemplates) {
      const occurrenceDate = template.nextDueOn!;
      try {
        const task = await workflowTodoService.createTask({
          taskKind: template.taskKind,
          title: template.title,
          description: template.description || null,
          priority: template.priority,
          branchId: template.branchId || null,
          branchName: template.branchName || null,
          assigneeRole: template.assigneeRole || null,
          assignedTo: template.assignedTo || null,
          reviewRequired: template.reviewRequired,
          templateId: template.id,
          templateOccurrenceDate: occurrenceDate,
          dueAt: dueAtForDate(occurrenceDate),
          metadata: {
            generatedFromTemplate: true,
            templateFrequency: template.recurrenceFrequency
          }
        });
        generated.push(task);

        if (isDemoMode) {
          const nextDueOn = addFrequency(occurrenceDate, template.recurrenceFrequency);
          const shouldDeactivate = template.recurrenceFrequency === 'none' || Boolean(template.endsOn && nextDueOn > template.endsOn);
          const now = new Date().toISOString();
          writeDemoArray(
            TEMPLATES_KEY,
            readDemoArray<WorkflowTaskTemplate>(TEMPLATES_KEY).map(item =>
              item.id === template.id
                ? {
                    ...item,
                    nextDueOn: shouldDeactivate ? null : nextDueOn,
                    isActive: shouldDeactivate ? false : item.isActive,
                    updatedAt: now
                  }
                : item
            )
          );
        }
      } catch (error) {
        const message = getErrorMessage(error);
        if (!message.includes('23505') && !message.toLowerCase().includes('duplicate')) throw error;
      }
    }

    return generated;
  },

  escalateOverdueTasks: async (): Promise<WorkflowTask[]> => {
    const candidates = (await workflowTodoService.listTasks({ includeClosed: true, limit: 500 }))
      .filter(task =>
        task.priority !== 'urgent'
        && !CLOSED_STATUSES.includes(task.status)
        && task.dueAt
        && new Date(task.dueAt).getTime() < Date.now()
      );

    const escalated: WorkflowTask[] = [];
    for (const task of candidates) {
      try {
        const { data, error } = await supabaseClient
          .from('workflow_tasks')
          .update({
            priority: 'urgent',
            metadata: {
              ...task.metadata,
              escalatedAt: new Date().toISOString(),
              escalationReason: 'Overdue task'
            }
          })
          .eq('id', task.id)
          .select()
          .single();
        if (error) throw error;
        const updated = toTask(data);
        escalated.push(updated);
        const { error: eventError } = await supabaseClient
          .from('workflow_task_events')
          .insert([{
            task_id: updated.id,
            event_type: 'status_changed',
            old_status: task.status,
            new_status: updated.status,
            comment: 'Auto-escalated overdue task to urgent priority'
          }]);
        if (eventError) throw eventError;
      } catch (error) {
        throwUnlessDemoMode(error, 'Unable to escalate overdue workflow tasks');
        const now = new Date().toISOString();
        const tasks = readDemoArray<WorkflowTask>(TASKS_KEY);
        const current = tasks.find(item => item.id === task.id);
        if (!current) continue;
        const updated: WorkflowTask = {
          ...current,
          priority: 'urgent',
          metadata: {
            ...current.metadata,
            escalatedAt: now,
            escalationReason: 'Overdue task'
          },
          updatedAt: now,
          lastActivityAt: now
        };
        writeDemoArray(TASKS_KEY, tasks.map(item => item.id === task.id ? updated : item));
        writeDemoArray(EVENTS_KEY, [
          makeDemoEvent({
            taskId: updated.id,
            eventType: 'status_changed',
            oldStatus: current.status,
            newStatus: updated.status,
            comment: 'Auto-escalated overdue task to urgent priority'
          }),
          ...readDemoArray<WorkflowTaskEvent>(EVENTS_KEY)
        ]);
        escalated.push(updated);
      }
    }

    return escalated;
  }
};
