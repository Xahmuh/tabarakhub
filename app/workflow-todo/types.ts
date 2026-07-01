import { Role } from '../../types';

export type WorkflowTaskKind = 'work' | 'personal';
export type WorkflowTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkflowTaskStatus =
  | 'open'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'done'
  | 'dismissed'
  | 'expired';
export type WorkflowTaskEventType = 'created' | 'status_changed' | 'comment' | 'review' | 'template_generated' | 'attachment_added';
export type WorkflowRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type WorkflowAssigneeRole = Extract<Role, 'admin' | 'manager' | 'owner' | 'accounts' | 'supervisor' | 'warehouse' | 'branch'>;

export interface WorkflowTask {
  id: string;
  taskKind: WorkflowTaskKind;
  title: string;
  description?: string | null;
  priority: WorkflowTaskPriority;
  status: WorkflowTaskStatus;
  branchId?: string | null;
  branchName?: string | null;
  assigneeRole?: WorkflowAssigneeRole | null;
  assignedTo?: string | null;
  reviewRequired: boolean;
  templateId?: string | null;
  templateOccurrenceDate?: string | null;
  dueAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewOutcome?: 'approved' | 'rejected' | null;
  /** @deprecated Kept while v1/v2 databases overlap. Use reviewedAt. */
  approvedAt?: string | null;
  /** @deprecated Kept while v1/v2 databases overlap. Use reviewedBy. */
  approvedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  dismissedBy?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface WorkflowTaskEvent {
  id: string;
  taskId: string;
  eventType: WorkflowTaskEventType;
  oldStatus?: WorkflowTaskStatus | null;
  newStatus?: WorkflowTaskStatus | null;
  comment?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface WorkflowTaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  scanStatus?: 'pending' | 'clean' | 'flagged' | 'skipped' | null;
  scannedAt?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
}

export interface WorkflowTaskTemplate {
  id: string;
  taskKind: WorkflowTaskKind;
  title: string;
  description?: string | null;
  priority: WorkflowTaskPriority;
  branchId?: string | null;
  branchName?: string | null;
  assigneeRole?: WorkflowAssigneeRole | null;
  assignedTo?: string | null;
  reviewRequired: boolean;
  recurrenceFrequency: WorkflowRecurrenceFrequency;
  startsOn: string;
  endsOn?: string | null;
  nextDueOn?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowTaskInput {
  taskKind: WorkflowTaskKind;
  title: string;
  description?: string | null;
  priority: WorkflowTaskPriority;
  branchId?: string | null;
  branchName?: string | null;
  assigneeRole?: WorkflowAssigneeRole | null;
  assignedTo?: string | null;
  reviewRequired?: boolean;
  templateId?: string | null;
  templateOccurrenceDate?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkflowTaskFilters {
  kind?: WorkflowTaskKind | 'all';
  status?: WorkflowTaskStatus[];
  branchId?: string | null;
  includeClosed?: boolean;
  search?: string;
  limit?: number;
}

export interface UpdateWorkflowTaskStatusInput {
  taskId: string;
  status: WorkflowTaskStatus;
  comment?: string;
}

export interface AddWorkflowTaskAttachmentInput {
  taskId: string;
  fileName: string;
  fileUrl?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface AddWorkflowTaskCommentInput {
  taskId: string;
  comment: string;
}

export interface CreateWorkflowTaskTemplateInput {
  taskKind: WorkflowTaskKind;
  title: string;
  description?: string | null;
  priority: WorkflowTaskPriority;
  branchId?: string | null;
  branchName?: string | null;
  assigneeRole?: WorkflowAssigneeRole | null;
  assignedTo?: string | null;
  reviewRequired?: boolean;
  recurrenceFrequency: WorkflowRecurrenceFrequency;
  startsOn: string;
  endsOn?: string | null;
  nextDueOn?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkflowTaskTemplateInput extends CreateWorkflowTaskTemplateInput {
  id: string;
  isActive?: boolean;
}
