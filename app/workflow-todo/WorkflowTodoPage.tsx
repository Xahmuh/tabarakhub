import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserRound,
  UsersRound,
  XCircle
} from 'lucide-react';
import { branchService } from '../../services/branchService';
import { Branch, Role } from '../../types';
import { ROLE_LABELS } from '../../lib/access';
import { BackToModulesButton } from '../shared';
import { SearchableSelect } from '../delivery/components/SearchableSelect';
import { workflowTodoService } from './workflowTodoService';
import {
  CreateWorkflowTaskInput,
  CreateWorkflowTaskTemplateInput,
  UpdateWorkflowTaskTemplateInput,
  WorkflowAssigneeRole,
  WorkflowRecurrenceFrequency,
  WorkflowTask,
  WorkflowTaskAttachment,
  WorkflowTaskEvent,
  WorkflowTaskKind,
  WorkflowTaskPriority,
  WorkflowTaskStatus,
  WorkflowTaskTemplate
} from './types';

interface WorkflowTodoPageProps {
  user: Branch;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
}

type QueueView = 'dashboard' | 'active' | 'review' | 'personal' | 'closed' | 'calendar' | 'timeline' | 'analytics' | 'templates' | 'all';
type KpiTone = 'blue' | 'amber' | 'violet' | 'slate' | 'rose' | 'emerald';
type RouteDraft = {
  ccRoles: string;
  areas: string;
  observers: string;
};

interface QueueTab {
  key: QueueView;
  label: string;
  count: number;
  icon: React.ReactNode;
}

const CLOSED_STATUSES: WorkflowTaskStatus[] = ['approved', 'done', 'dismissed', 'expired'];
const REVIEW_ROLES: Role[] = ['admin', 'manager'];
const ASSIGNEE_ROLES: WorkflowAssigneeRole[] = ['branch', 'supervisor', 'warehouse', 'accounts', 'admin'];

const STATUS_LABELS: Record<WorkflowTaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  done: 'Done',
  dismissed: 'Dismissed',
  expired: 'Expired'
};

const PRIORITY_LABELS: Record<WorkflowTaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const FREQUENCY_LABELS: Record<WorkflowRecurrenceFrequency, string> = {
  none: 'One time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly'
};

const STATUS_CLASSES: Record<WorkflowTaskStatus, string> = {
  open: 'border-blue-100 bg-blue-50 text-blue-700',
  in_progress: 'border-amber-100 bg-amber-50 text-amber-700',
  submitted: 'border-violet-100 bg-violet-50 text-violet-700',
  approved: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-100 bg-rose-50 text-rose-700',
  done: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  dismissed: 'border-slate-200 bg-slate-50 text-slate-500',
  expired: 'border-orange-100 bg-orange-50 text-orange-700'
};

const PRIORITY_CLASSES: Record<WorkflowTaskPriority, string> = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-blue-100 bg-blue-50 text-blue-700',
  low: 'border-slate-200 bg-slate-50 text-slate-500'
};

const PRIORITY_ACCENT_CLASSES: Record<WorkflowTaskPriority, string> = {
  urgent: 'before:bg-rose-500',
  high: 'before:bg-orange-400',
  medium: 'before:bg-blue-400',
  low: 'before:bg-slate-300'
};

const emptyForm: CreateWorkflowTaskInput = {
  taskKind: 'work',
  title: '',
  description: '',
  priority: 'medium',
  branchId: null,
  branchName: null,
  assigneeRole: 'branch',
  assignedTo: null,
  reviewRequired: true,
  dueAt: null
};

const emptyRouteDraft: RouteDraft = {
  ccRoles: '',
  areas: '',
  observers: ''
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTokenList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const metadataList = (metadata: Record<string, unknown>, key: string) =>
  Array.isArray(metadata[key]) ? (metadata[key] as unknown[]).filter((item): item is string => typeof item === 'string') : [];

const routeDraftFromMetadata = (metadata: Record<string, unknown>): RouteDraft => ({
  ccRoles: metadataList(metadata, 'ccRoles').join(', '),
  areas: metadataList(metadata, 'areas').join(', '),
  observers: metadataList(metadata, 'observers').join(', ')
});

const mergeRouteMetadata = (metadata: Record<string, unknown> | undefined, draft: RouteDraft) => ({
  ...(metadata || {}),
  ccRoles: parseTokenList(draft.ccRoles),
  areas: parseTokenList(draft.areas),
  observers: parseTokenList(draft.observers)
});

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const taskDateKey = (task: WorkflowTask) => {
  if (task.dueAt) return dateKey(new Date(task.dueAt));
  if (task.templateOccurrenceDate) return task.templateOccurrenceDate;
  return dateKey(new Date(task.createdAt));
};

const makeEmptyTemplateForm = (user: Branch): CreateWorkflowTaskTemplateInput => ({
  taskKind: 'work',
  title: '',
  description: '',
  priority: 'medium',
  branchId: user.role === 'branch' ? user.id : null,
  branchName: user.role === 'branch' ? user.name : null,
  assigneeRole: 'branch',
  assignedTo: null,
  reviewRequired: true,
  recurrenceFrequency: 'weekly',
  startsOn: dateKey(new Date()),
  endsOn: null,
  nextDueOn: dateKey(new Date())
});

const formatDateTime = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatActivityTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));

const toLocalInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) => value ? new Date(value).toISOString() : null;

const isClosed = (task: WorkflowTask) => CLOSED_STATUSES.includes(task.status);

const isOverdue = (task: WorkflowTask) =>
  Boolean(task.dueAt && !isClosed(task) && new Date(task.dueAt).getTime() < Date.now());

const isDueToday = (task: WorkflowTask) =>
  Boolean(task.dueAt && !isClosed(task) && dateKey(new Date(task.dueAt)) === dateKey(new Date()));

const roleLabel = (role?: WorkflowAssigneeRole | null) =>
  role ? (ROLE_LABELS[role] || role) : 'Unassigned';

const currentRoleLabel = (role: Role) => ROLE_LABELS[role] || role;

const eventText = (event: WorkflowTaskEvent) => {
  if (event.eventType === 'comment') return event.comment || 'Comment added';
  if (event.eventType === 'created') return 'Task created';
  if (event.eventType === 'review') return `Review: ${event.oldStatus ? STATUS_LABELS[event.oldStatus] : 'Status'} to ${event.newStatus ? STATUS_LABELS[event.newStatus] : 'updated'}`;
  if (event.eventType === 'template_generated') return 'Generated from recurring template';
  if (event.eventType === 'attachment_added') return event.comment || 'Attachment added';
  return `${event.oldStatus ? STATUS_LABELS[event.oldStatus] : 'Status'} to ${event.newStatus ? STATUS_LABELS[event.newStatus] : 'updated'}`;
};

export const WorkflowTodoPage: React.FC<WorkflowTodoPageProps> = ({ user, onBack, checkPermission }) => {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [templates, setTemplates] = useState<WorkflowTaskTemplate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [eventsByTask, setEventsByTask] = useState<Record<string, WorkflowTaskEvent[]>>({});
  const [attachmentsByTask, setAttachmentsByTask] = useState<Record<string, WorkflowTaskAttachment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [view, setView] = useState<QueueView>('dashboard');
  const [kindFilter, setKindFilter] = useState<WorkflowTaskKind | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [routingDraft, setRoutingDraft] = useState<RouteDraft>(emptyRouteDraft);
  const [templateRoutingDraft, setTemplateRoutingDraft] = useState<RouteDraft>(emptyRouteDraft);
  const [form, setForm] = useState<CreateWorkflowTaskInput>(() => ({
    ...emptyForm,
    branchId: user.role === 'branch' ? user.id : null,
    branchName: user.role === 'branch' ? user.name : null
  }));
  const [templateForm, setTemplateForm] = useState<CreateWorkflowTaskTemplateInput>(() => makeEmptyTemplateForm(user));

  const canEdit = checkPermission('workflow_todo', 'edit') && user.role !== 'owner';
  const canReview = REVIEW_ROLES.includes(user.role);
  const canDecideReview = canEdit && canReview;
  const canManageTemplates = canDecideReview;
  const isBranchUser = user.role === 'branch';
  const isAdminWorkspace = canReview;
  const moduleModeLabel = isAdminWorkspace ? 'Admin workspace' : isBranchUser ? 'Branch workspace' : `${currentRoleLabel(user.role)} workspace`;
  const moduleScopeLabel = isAdminWorkspace ? 'All permitted branches' : isBranchUser ? user.name : 'Assigned role scope';

  const branchOptions = useMemo(
    () => branches.map(branch => ({ value: branch.id, label: branch.name, hint: branch.code })),
    [branches]
  );

  const selectableTemplates = useMemo(
    () => templates.filter(template => template.isActive && !template.deletedAt),
    [templates]
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const [taskList, branchList, templateList] = await Promise.all([
        workflowTodoService.listTasks({ includeClosed: true, limit: 300 }),
        branchService.list(),
        workflowTodoService.listTemplates()
      ]);
      setTasks(taskList);
      setBranches(branchList);
      setTemplates(templateList);
    } catch (error: any) {
      Swal.fire('Workflow & Todo', error?.message || 'Unable to load workflow tasks.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scopedTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (kindFilter !== 'all' && task.taskKind !== kindFilter) return false;
      if (branchFilter && task.branchId !== branchFilter) return false;
      if (normalizedSearch) {
        const haystack = `${task.title} ${task.description || ''} ${task.branchName || ''} ${task.assigneeRole || ''}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [branchFilter, kindFilter, search, tasks]);

  const filteredTasks = useMemo(() => {
    return scopedTasks.filter(task => {
      if (view === 'templates' || view === 'dashboard' || view === 'calendar' || view === 'timeline' || view === 'analytics') return false;
      if (view === 'active' && (task.taskKind === 'personal' || task.status === 'submitted' || isClosed(task))) return false;
      if (view === 'review' && task.status !== 'submitted') return false;
      if (view === 'personal' && task.taskKind !== 'personal') return false;
      if (view === 'closed' && !isClosed(task)) return false;
      return true;
    });
  }, [scopedTasks, view]);

  const dueTemplates = useMemo(
    () => templates.filter(template =>
      template.isActive
      && !template.deletedAt
      && template.nextDueOn
      && template.nextDueOn <= dateKey(new Date())
      && (!template.endsOn || template.nextDueOn <= template.endsOn)
    ),
    [templates]
  );

  const kpis = useMemo(() => {
    const active = scopedTasks.filter(task => !isClosed(task));
    const workQueue = active.filter(task => task.taskKind === 'work' && task.status !== 'submitted');
    return {
      active: active.length,
      dueToday: active.filter(isDueToday).length,
      submitted: scopedTasks.filter(task => task.status === 'submitted').length,
      workQueue: workQueue.length,
      personal: active.filter(task => task.taskKind === 'personal').length,
      closed: scopedTasks.filter(isClosed).length,
      overdue: active.filter(isOverdue).length
    };
  }, [scopedTasks]);

  const kpiCards = useMemo(
    () => [
      {
        label: isAdminWorkspace ? 'Active Work' : 'My Active',
        value: kpis.active,
        icon: <CircleDot className="h-4 w-4" />,
        tone: 'blue' as KpiTone
      },
      {
        label: 'Due Today',
        value: kpis.dueToday,
        icon: <CalendarClock className="h-4 w-4" />,
        tone: 'amber' as KpiTone
      },
      {
        label: isAdminWorkspace ? 'Review Queue' : 'Sent Review',
        value: kpis.submitted,
        icon: <Send className="h-4 w-4" />,
        tone: 'violet' as KpiTone
      },
      {
        label: isAdminWorkspace ? 'Templates Due' : 'Personal',
        value: isAdminWorkspace ? dueTemplates.length : kpis.personal,
        icon: isAdminWorkspace ? <CalendarPlus className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />,
        tone: isAdminWorkspace ? 'emerald' as KpiTone : 'slate' as KpiTone
      },
      {
        label: 'Overdue',
        value: kpis.overdue,
        icon: <Clock3 className="h-4 w-4" />,
        tone: 'rose' as KpiTone
      }
    ],
    [dueTemplates.length, isAdminWorkspace, kpis.active, kpis.dueToday, kpis.overdue, kpis.personal, kpis.submitted]
  );

  const queueTabs = useMemo<QueueTab[]>(() => {
    const activeWorkCount = scopedTasks.filter(task => task.taskKind !== 'personal' && task.status !== 'submitted' && !isClosed(task)).length;
    const reviewCount = scopedTasks.filter(task => task.status === 'submitted').length;
    const personalCount = scopedTasks.filter(task => task.taskKind === 'personal' && !isClosed(task)).length;
    const closedCount = scopedTasks.filter(isClosed).length;
    const selectedDayCount = scopedTasks.filter(task => taskDateKey(task) === selectedDate).length;
    const tabs: QueueTab[] = [
      { key: 'dashboard', label: 'Dashboard', count: scopedTasks.length, icon: <LayoutDashboard className="h-4 w-4" /> },
      { key: 'active', label: 'Work Queue', count: activeWorkCount, icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'review', label: canReview ? 'Review' : 'Sent Review', count: reviewCount, icon: <Send className="h-4 w-4" /> },
      { key: 'personal', label: 'Personal', count: personalCount, icon: <UserRound className="h-4 w-4" /> },
      { key: 'closed', label: 'Closed', count: closedCount, icon: <CheckCircle2 className="h-4 w-4" /> },
      { key: 'calendar', label: 'Calendar', count: selectedDayCount, icon: <CalendarDays className="h-4 w-4" /> },
      { key: 'timeline', label: 'Timeline', count: selectedDayCount, icon: <Clock3 className="h-4 w-4" /> },
      { key: 'analytics', label: 'Analytics', count: scopedTasks.length, icon: <BarChart3 className="h-4 w-4" /> }
    ];
    if (canManageTemplates) {
      tabs.push({ key: 'templates', label: 'Templates', count: templates.length, icon: <CalendarPlus className="h-4 w-4" /> });
    }
    tabs.push({ key: 'all', label: 'All', count: scopedTasks.length, icon: <ListChecks className="h-4 w-4" /> });
    return tabs;
  }, [canManageTemplates, canReview, scopedTasks, selectedDate, templates.length]);

  const currentViewLabel = queueTabs.find(tab => tab.key === view)?.label || 'Dashboard';

  const loadTaskActivity = async (taskId: string, force = false) => {
    if (!force && eventsByTask[taskId] && attachmentsByTask[taskId]) return;
    try {
      const [events, attachments] = await Promise.all([
        workflowTodoService.listEvents(taskId),
        workflowTodoService.listAttachments(taskId)
      ]);
      setEventsByTask(prev => ({ ...prev, [taskId]: events }));
      setAttachmentsByTask(prev => ({ ...prev, [taskId]: attachments }));
    } catch (error: any) {
      Swal.fire('Workflow activity', error?.message || 'Unable to load activity.', 'error');
    }
  };

  const openEvents = async (taskId: string) => {
    const isClosing = activeTaskId === taskId;
    setActiveTaskId(isClosing ? null : taskId);
    if (!isClosing) await loadTaskActivity(taskId);
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      branchId: user.role === 'branch' ? user.id : null,
      branchName: user.role === 'branch' ? user.name : null
    });
    setSelectedTemplateId('');
    setRoutingDraft(emptyRouteDraft);
  };

  const resetTemplateForm = () => {
    setTemplateForm(makeEmptyTemplateForm(user));
    setTemplateRoutingDraft(emptyRouteDraft);
    setEditingTemplateId(null);
  };

  const handleKindChange = (taskKind: WorkflowTaskKind) => {
    setForm(prev => ({
      ...prev,
      taskKind,
      branchId: taskKind === 'personal' ? null : (user.role === 'branch' ? user.id : prev.branchId),
      branchName: taskKind === 'personal' ? null : (user.role === 'branch' ? user.name : prev.branchName),
      assigneeRole: taskKind === 'personal' ? null : (prev.assigneeRole || 'branch'),
      reviewRequired: taskKind === 'personal' ? false : prev.reviewRequired
    }));
  };

  const handleTemplateKindChange = (taskKind: WorkflowTaskKind) => {
    setTemplateForm(prev => ({
      ...prev,
      taskKind,
      branchId: taskKind === 'personal' ? null : (user.role === 'branch' ? user.id : prev.branchId),
      branchName: taskKind === 'personal' ? null : (user.role === 'branch' ? user.name : prev.branchName),
      assigneeRole: taskKind === 'personal' ? null : (prev.assigneeRole || 'branch'),
      reviewRequired: taskKind === 'personal' ? false : prev.reviewRequired
    }));
  };

  const applyTemplateToTaskForm = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(item => item.id === templateId);
    if (!template) return;
    setForm(prev => ({
      ...prev,
      taskKind: template.taskKind,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      branchId: template.taskKind === 'work' ? template.branchId || null : null,
      branchName: template.taskKind === 'work' ? template.branchName || null : null,
      assigneeRole: template.taskKind === 'work' ? template.assigneeRole || null : null,
      assignedTo: template.assignedTo || null,
      reviewRequired: template.taskKind === 'work' ? template.reviewRequired : false,
      templateId: template.id,
      templateOccurrenceDate: template.nextDueOn || dateKey(new Date()),
      dueAt: template.nextDueOn ? new Date(`${template.nextDueOn}T23:59:00`).toISOString() : prev.dueAt,
      metadata: {
        ...template.metadata,
        createdFromTemplatePicker: true,
        sourceTemplateTitle: template.title
      }
    }));
    setRoutingDraft(routeDraftFromMetadata(template.metadata));
  };

  const startEditTemplate = (template: WorkflowTaskTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      taskKind: template.taskKind,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      branchId: template.branchId || null,
      branchName: template.branchName || null,
      assigneeRole: template.assigneeRole || null,
      assignedTo: template.assignedTo || null,
      reviewRequired: template.reviewRequired,
      recurrenceFrequency: template.recurrenceFrequency,
      startsOn: template.startsOn,
      endsOn: template.endsOn || null,
      nextDueOn: template.nextDueOn || template.startsOn,
      metadata: template.metadata
    });
    setTemplateRoutingDraft(routeDraftFromMetadata(template.metadata));
    setIsTemplateOpen(true);
    setView('templates');
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const title = form.title.trim();
    if (!title) {
      Swal.fire('Workflow & Todo', 'Task title is required.', 'warning');
      return;
    }

    if (form.taskKind === 'work' && !form.branchId && !form.assigneeRole) {
      Swal.fire('Workflow & Todo', 'Choose a branch or role for work tasks.', 'warning');
      return;
    }

    const branch = branches.find(item => item.id === form.branchId);
    setIsSaving(true);
    try {
      await workflowTodoService.createTask({
        ...form,
        title,
        branchName: form.taskKind === 'work' ? (branch?.name || form.branchName || null) : null,
        assigneeRole: form.taskKind === 'work' ? form.assigneeRole : null,
        reviewRequired: form.taskKind === 'work' ? Boolean(form.reviewRequired) : false,
        metadata: mergeRouteMetadata(form.metadata, routingDraft)
      });
      resetForm();
      setIsCreateOpen(false);
      await load();
      Swal.fire('Task created', 'Workflow task was added.', 'success');
    } catch (error: any) {
      Swal.fire('Create task failed', error?.message || 'Unable to create workflow task.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageTemplates) return;

    const title = templateForm.title.trim();
    if (!title) {
      Swal.fire('Workflow & Todo', 'Template title is required.', 'warning');
      return;
    }

    if (templateForm.endsOn && templateForm.endsOn < templateForm.startsOn) {
      Swal.fire('Workflow & Todo', 'End date must be after the start date.', 'warning');
      return;
    }

    const branch = branches.find(item => item.id === templateForm.branchId);
    const wasEditing = Boolean(editingTemplateId);
    setIsSaving(true);
    try {
      const payload: UpdateWorkflowTaskTemplateInput = {
        ...templateForm,
        id: editingTemplateId || '',
        title,
        branchName: templateForm.taskKind === 'work' ? (branch?.name || templateForm.branchName || null) : null,
        assigneeRole: templateForm.taskKind === 'work' ? templateForm.assigneeRole : null,
        reviewRequired: templateForm.taskKind === 'work' ? Boolean(templateForm.reviewRequired) : false,
        nextDueOn: templateForm.recurrenceFrequency === 'none' ? templateForm.startsOn : (templateForm.nextDueOn || templateForm.startsOn),
        metadata: mergeRouteMetadata(templateForm.metadata, templateRoutingDraft),
        isActive: true
      };
      if (editingTemplateId) {
        await workflowTodoService.updateTemplate(payload);
      } else {
        const { id, isActive, ...createPayload } = payload;
        void id;
        void isActive;
        await workflowTodoService.createTemplate(createPayload);
      }
      resetTemplateForm();
      setIsTemplateOpen(false);
      await load();
      Swal.fire(wasEditing ? 'Template updated' : 'Template created', wasEditing ? 'Workflow template was updated.' : 'Workflow template was added.', 'success');
    } catch (error: any) {
      Swal.fire(wasEditing ? 'Update template failed' : 'Create template failed', error?.message || 'Unable to save workflow template.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const generateDueTasks = async () => {
    if (!canManageTemplates) return;
    setIsSaving(true);
    try {
      const generated = await workflowTodoService.generateDueTasks();
      await load();
      Swal.fire('Templates generated', `${generated.length} workflow task${generated.length === 1 ? '' : 's'} generated.`, 'success');
    } catch (error: any) {
      Swal.fire('Generate failed', error?.message || 'Unable to generate due workflow tasks.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (template: WorkflowTaskTemplate) => {
    const result = await Swal.fire({
      title: 'Archive template',
      text: template.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Archive',
      confirmButtonColor: '#B91c1c'
    });
    if (!result.isConfirmed) return;

    setIsSaving(true);
    try {
      await workflowTodoService.deleteTemplate(template.id);
      await load();
      Swal.fire('Template archived', 'Template was removed from the active scheduler.', 'success');
    } catch (error: any) {
      Swal.fire('Delete failed', error?.message || 'Unable to delete workflow template.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (task: WorkflowTask, status: WorkflowTaskStatus, comment?: string) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await workflowTodoService.updateTaskStatus({ taskId: task.id, status, comment });
      setEventsByTask(prev => {
        const copy = { ...prev };
        delete copy[task.id];
        return copy;
      });
      await load();
    } catch (error: any) {
      Swal.fire('Update failed', error?.message || 'Unable to update workflow task.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const rejectTask = async (task: WorkflowTask) => {
    const { value } = await Swal.fire({
      title: 'Reject task',
      input: 'textarea',
      inputPlaceholder: 'Reason',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#B91c1c',
      inputValidator: value => value?.trim() ? undefined : 'Add a reason.'
    });
    if (!value) return;
    await updateStatus(task, 'rejected', value);
  };

  const addComment = async (task: WorkflowTask) => {
    const comment = commentDrafts[task.id]?.trim();
    if (!comment) return;
    setIsSaving(true);
    try {
      const event = await workflowTodoService.addComment({ taskId: task.id, comment });
      setEventsByTask(prev => ({ ...prev, [task.id]: [event, ...(prev[task.id] || [])] }));
      setCommentDrafts(prev => ({ ...prev, [task.id]: '' }));
    } catch (error: any) {
      Swal.fire('Comment failed', error?.message || 'Unable to add comment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const completeStatusFor = (task: WorkflowTask): WorkflowTaskStatus =>
    task.taskKind === 'work' && task.reviewRequired ? 'submitted' : 'done';

  const completeTask = async (task: WorkflowTask) => {
    const { value } = await Swal.fire({
      title: task.reviewRequired ? 'Submit evidence' : 'Complete task',
      input: 'textarea',
      inputPlaceholder: 'Finish note / evidence summary',
      showCancelButton: true,
      confirmButtonText: task.reviewRequired ? 'Submit' : 'Complete',
      inputValidator: value => value?.trim() ? undefined : 'Add a finish note.'
    });
    if (!value) return;
    await updateStatus(task, completeStatusFor(task), value);
  };

  const approveTask = async (task: WorkflowTask) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'Approve task',
      input: 'textarea',
      inputPlaceholder: 'Optional review note',
      showCancelButton: true,
      confirmButtonText: 'Approve'
    });
    if (!isConfirmed) return;
    await updateStatus(task, 'approved', value || undefined);
  };

  const addAttachment = async (task: WorkflowTask) => {
    const result = await Swal.fire({
      title: 'Add evidence',
      html: `
        <input id="workflow-attachment-name" class="swal2-input" placeholder="Attachment name">
        <input id="workflow-attachment-url" class="swal2-input" placeholder="File URL or storage path">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Attach',
      preConfirm: () => {
        const name = (document.getElementById('workflow-attachment-name') as HTMLInputElement | null)?.value?.trim() || '';
        const url = (document.getElementById('workflow-attachment-url') as HTMLInputElement | null)?.value?.trim() || '';
        if (!name || !url) {
          Swal.showValidationMessage('Attachment name and URL/path are required.');
          return false;
        }
        return { name, url };
      }
    });
    if (!result.isConfirmed || !result.value) return;
    const value = result.value as { name: string; url: string };
    setIsSaving(true);
    try {
      const attachment = await workflowTodoService.addAttachment({
        taskId: task.id,
        fileName: value.name,
        fileUrl: value.url.startsWith('http') ? value.url : null,
        filePath: value.url.startsWith('http') ? null : value.url,
        mimeType: value.url.match(/\.(png|jpe?g|webp|gif)$/i) ? 'image/*' : null
      });
      setAttachmentsByTask(prev => ({ ...prev, [task.id]: [attachment, ...(prev[task.id] || [])] }));
      setEventsByTask(prev => {
        const copy = { ...prev };
        delete copy[task.id];
        return copy;
      });
      await loadTaskActivity(task.id, true);
    } catch (error: any) {
      Swal.fire('Attach failed', error?.message || 'Unable to add evidence attachment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAttachment = async (task: WorkflowTask, attachment: WorkflowTaskAttachment) => {
    const result = await Swal.fire({
      title: 'Remove attachment',
      text: attachment.fileName,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#B91c1c'
    });
    if (!result.isConfirmed) return;
    setIsSaving(true);
    try {
      await workflowTodoService.deleteAttachment(attachment.id);
      setAttachmentsByTask(prev => ({
        ...prev,
        [task.id]: (prev[task.id] || []).filter(item => item.id !== attachment.id)
      }));
    } catch (error: any) {
      Swal.fire('Remove failed', error?.message || 'Unable to remove attachment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openQuickAddForDate = (value: string) => {
    setForm(prev => ({
      ...prev,
      dueAt: new Date(`${value}T10:00:00`).toISOString()
    }));
    setIsCreateOpen(true);
  };

  const exportTasksCsv = async () => {
    const rows = scopedTasks.map(task => ({
      title: task.title,
      type: task.taskKind,
      status: STATUS_LABELS[task.status],
      priority: PRIORITY_LABELS[task.priority],
      branch: task.branchName || '',
      role: roleLabel(task.assigneeRole),
      due: task.dueAt ? new Date(task.dueAt).toISOString() : '',
      submitted: task.submittedAt || '',
      reviewed: task.reviewedAt || '',
      created: task.createdAt
    }));
    const headers = ['title', 'type', 'status', 'priority', 'branch', 'role', 'due', 'submitted', 'reviewed', 'created'];
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeCell(String(row[header as keyof typeof row] || ''))).join(','))
    ].join('\n');
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `Workflow_Todo_${dateKey(new Date())}.csv`);
  };

  const escalateOverdue = async () => {
    if (!canDecideReview) return;
    setIsSaving(true);
    try {
      const escalated = await workflowTodoService.escalateOverdueTasks();
      await load();
      Swal.fire('Escalation complete', `${escalated.length} overdue task${escalated.length === 1 ? '' : 's'} escalated to urgent.`, 'success');
    } catch (error: any) {
      Swal.fire('Escalation failed', error?.message || 'Unable to escalate overdue tasks.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <WorkflowHero
        user={user}
        modeLabel={moduleModeLabel}
        scopeLabel={moduleScopeLabel}
        isAdminWorkspace={isAdminWorkspace}
        onBack={onBack}
      />

      <WorkflowPulseStrip cards={kpiCards} overdueCount={kpis.overdue} reviewCount={kpis.submitted} isSaving={isSaving} />

      <main className="min-w-0 space-y-4">
          <WorkflowTabs
            tabs={queueTabs}
            activeView={view}
            onViewChange={tab => {
              setView(tab);
              setIsCreateOpen(false);
              if (tab !== 'templates') setIsTemplateOpen(false);
            }}
          />
          <WorkflowCommandBar
            title={currentViewLabel}
            resultCount={view === 'templates' ? templates.length : view === 'dashboard' || view === 'calendar' || view === 'timeline' || view === 'analytics' ? scopedTasks.length : filteredTasks.length}
            search={search}
            onSearchChange={setSearch}
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
            isBranchUser={isBranchUser}
            user={user}
            branchOptions={branchOptions}
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
            isLoading={isLoading}
            canExport={scopedTasks.length > 0}
            onRefresh={load}
            onExport={exportTasksCsv}
            canEdit={canEdit}
            canManageTemplates={canManageTemplates}
            canDecideReview={canDecideReview}
            view={view}
            isSaving={isSaving}
            dueTemplatesCount={dueTemplates.length}
            overdueCount={scopedTasks.filter(isOverdue).length}
            onNewTask={() => setIsCreateOpen(open => !open)}
            onNewTemplate={() => setIsTemplateOpen(open => !open)}
            onGenerateDue={generateDueTasks}
            onEscalate={escalateOverdue}
          />

      {isCreateOpen && canEdit && (
        <form onSubmit={handleCreateTask} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['work', 'personal'] as WorkflowTaskKind[]).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleKindChange(kind)}
                    className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition-colors ${
                      form.taskKind === kind ? 'bg-brand text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <input
                value={form.title}
                onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Task title"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              <textarea
                value={form.description || ''}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Details"
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <select
                value={form.priority}
                onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as WorkflowTaskPriority }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="datetime-local"
                value={toLocalInputValue(form.dueAt)}
                onChange={event => setForm(prev => ({ ...prev, dueAt: fromLocalInputValue(event.target.value) }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              {selectableTemplates.length > 0 && (
                <select
                  value={selectedTemplateId}
                  onChange={event => applyTemplateToTaskForm(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                >
                  <option value="">Pick from template</option>
                  {selectableTemplates.map(template => (
                    <option key={template.id} value={template.id}>{template.title}</option>
                  ))}
                </select>
              )}
              {form.taskKind === 'work' && (
                <>
                  <SearchableSelect
                    options={branchOptions}
                    value={form.branchId || null}
                    onChange={value => setForm(prev => ({ ...prev, branchId: value }))}
                    placeholder="Target branch"
                    disabled={user.role === 'branch'}
                  />
                  <select
                    value={form.assigneeRole || ''}
                    onChange={event => setForm(prev => ({ ...prev, assigneeRole: (event.target.value || null) as WorkflowAssigneeRole | null }))}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  >
                    <option value="">No role target</option>
                    {ASSIGNEE_ROLES.map(role => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(form.reviewRequired)}
                      onChange={event => setForm(prev => ({ ...prev, reviewRequired: event.target.checked }))}
                      className="h-4 w-4 accent-[#B91c1c]"
                    />
                    Requires review
                  </label>
                </>
              )}
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced routing</p>
                <input
                  value={routingDraft.ccRoles}
                  onChange={event => setRoutingDraft(prev => ({ ...prev, ccRoles: event.target.value }))}
                  placeholder="CC roles, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <input
                  value={routingDraft.areas}
                  onChange={event => setRoutingDraft(prev => ({ ...prev, areas: event.target.value }))}
                  placeholder="Areas, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <input
                  value={routingDraft.observers}
                  onChange={event => setRoutingDraft(prev => ({ ...prev, observers: event.target.value }))}
                  placeholder="Observers, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { resetForm(); setIsCreateOpen(false); }} className="btn-secondary h-10 flex-1 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary h-10 flex-1 text-xs">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>Create</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {view === 'templates' && isTemplateOpen && canManageTemplates && (
        <form onSubmit={handleCreateTemplate} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{editingTemplateId ? 'Edit template' : 'New template'}</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{editingTemplateId ? 'Update recurring workflow' : 'Create recurring workflow'}</h3>
            </div>
            {editingTemplateId && (
              <button type="button" onClick={resetTemplateForm} className="btn-secondary h-9 px-3 text-[10px]">
                <XCircle className="h-4 w-4" />
                <span>Clear Edit</span>
              </button>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['work', 'personal'] as WorkflowTaskKind[]).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleTemplateKindChange(kind)}
                    className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition-colors ${
                      templateForm.taskKind === kind ? 'bg-brand text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <input
                value={templateForm.title}
                onChange={event => setTemplateForm(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Template title"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              <textarea
                value={templateForm.description || ''}
                onChange={event => setTemplateForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Details"
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <select
                value={templateForm.recurrenceFrequency}
                onChange={event => setTemplateForm(prev => ({ ...prev, recurrenceFrequency: event.target.value as WorkflowRecurrenceFrequency }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={templateForm.priority}
                onChange={event => setTemplateForm(prev => ({ ...prev, priority: event.target.value as WorkflowTaskPriority }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="date"
                value={templateForm.startsOn}
                onChange={event => setTemplateForm(prev => ({ ...prev, startsOn: event.target.value, nextDueOn: prev.nextDueOn || event.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              <input
                type="date"
                value={templateForm.nextDueOn || ''}
                onChange={event => setTemplateForm(prev => ({ ...prev, nextDueOn: event.target.value || null }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              <input
                type="date"
                value={templateForm.endsOn || ''}
                onChange={event => setTemplateForm(prev => ({ ...prev, endsOn: event.target.value || null }))}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              {templateForm.taskKind === 'work' && (
                <>
                  <SearchableSelect
                    options={branchOptions}
                    value={templateForm.branchId || null}
                    onChange={value => setTemplateForm(prev => ({ ...prev, branchId: value }))}
                    placeholder="Target branch"
                    disabled={user.role === 'branch'}
                  />
                  <select
                    value={templateForm.assigneeRole || ''}
                    onChange={event => setTemplateForm(prev => ({ ...prev, assigneeRole: (event.target.value || null) as WorkflowAssigneeRole | null }))}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  >
                    <option value="">No role target</option>
                    {ASSIGNEE_ROLES.map(role => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(templateForm.reviewRequired)}
                      onChange={event => setTemplateForm(prev => ({ ...prev, reviewRequired: event.target.checked }))}
                      className="h-4 w-4 accent-[#B91c1c]"
                    />
                    Requires review
                  </label>
                </>
              )}
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Template routing</p>
                <input
                  value={templateRoutingDraft.ccRoles}
                  onChange={event => setTemplateRoutingDraft(prev => ({ ...prev, ccRoles: event.target.value }))}
                  placeholder="CC roles, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <input
                  value={templateRoutingDraft.areas}
                  onChange={event => setTemplateRoutingDraft(prev => ({ ...prev, areas: event.target.value }))}
                  placeholder="Areas, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <input
                  value={templateRoutingDraft.observers}
                  onChange={event => setTemplateRoutingDraft(prev => ({ ...prev, observers: event.target.value }))}
                  placeholder="Observers, comma separated"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { resetTemplateForm(); setIsTemplateOpen(false); }} className="btn-secondary h-10 flex-1 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary h-10 flex-1 text-xs">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{editingTemplateId ? 'Update' : 'Create'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {view === 'templates' ? (
        <TemplatesPanel
          templates={templates}
          dueCount={dueTemplates.length}
          canManage={canManageTemplates}
          onGenerateDue={generateDueTasks}
          onEdit={startEditTemplate}
          onDelete={deleteTemplate}
        />
      ) : view === 'dashboard' ? (
        <WorkflowDashboard
          tasks={scopedTasks}
          templates={templates}
          canManage={canManageTemplates}
          onGenerateDue={generateDueTasks}
          onQuickAddDate={openQuickAddForDate}
        />
      ) : view === 'calendar' ? (
        <WorkflowCalendar
          tasks={scopedTasks}
          selectedDate={selectedDate}
          calendarMonth={calendarMonth}
          onSelectedDateChange={setSelectedDate}
          onCalendarMonthChange={setCalendarMonth}
          onQuickAddDate={openQuickAddForDate}
        />
      ) : view === 'timeline' ? (
        <WorkflowTimeline
          tasks={scopedTasks}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          onQuickAddDate={openQuickAddForDate}
        />
      ) : view === 'analytics' ? (
        <div className="space-y-4">
          <WorkflowAnalytics tasks={scopedTasks} />
          <EisenhowerMatrix tasks={scopedTasks} />
        </div>
      ) : (
        <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <Filter className="h-4 w-4" />
          <span>{filteredTasks.length} tasks</span>
        </div>
        {isSaving && (
          <span className="inline-flex items-center gap-2 text-xs font-black text-brand">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
          <div>
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-black text-slate-700">No workflow tasks found.</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Adjust filters or create a new task.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              canReview={canDecideReview}
              isExpanded={activeTaskId === task.id}
              events={eventsByTask[task.id] || []}
              attachments={attachmentsByTask[task.id] || []}
              comment={commentDrafts[task.id] || ''}
              onCommentChange={value => setCommentDrafts(prev => ({ ...prev, [task.id]: value }))}
              onToggleEvents={() => openEvents(task.id)}
              onAddComment={() => addComment(task)}
              onStart={() => updateStatus(task, 'in_progress')}
              onComplete={() => completeTask(task)}
              onApprove={() => approveTask(task)}
              onReject={() => rejectTask(task)}
              onDismiss={() => updateStatus(task, 'dismissed')}
              onReopen={() => updateStatus(task, 'open')}
              onAddAttachment={() => addAttachment(task)}
              onDeleteAttachment={attachment => deleteAttachment(task, attachment)}
            />
          ))}
        </div>
      )}
        </>
      )}
      </main>
    </div>
  );
};

const WorkflowHero: React.FC<{
  user: Branch;
  modeLabel: string;
  scopeLabel: string;
  isAdminWorkspace: boolean;
  onBack: () => void;
}> = ({
  user,
  modeLabel,
  scopeLabel,
  isAdminWorkspace,
  onBack
}) => (
  <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-brand/15 bg-brand/10 text-brand shadow-sm">
          <ClipboardCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-brand/10 bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              {modeLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {isAdminWorkspace ? <UsersRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              {scopeLabel}
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Workflow & Todo</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            {isAdminWorkspace
              ? 'Branch work, reviews, routines, and personal follow-up.'
              : 'Branch tasks, personal todos, evidence, and review status.'}
          </p>
        </div>
      </div>
      <BackToModulesButton onClick={onBack} />
    </div>
  </header>
);

const WorkflowPulseStrip: React.FC<{
  cards: Array<{ label: string; value: number; icon: React.ReactNode; tone: KpiTone }>;
  overdueCount: number;
  reviewCount: number;
  isSaving: boolean;
}> = ({ cards, overdueCount, reviewCount, isSaving }) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="grid grid-cols-2 divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
      {cards.map(card => (
        <Kpi key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone} />
      ))}
    </div>
    {(isSaving || overdueCount > 0 || reviewCount > 0) && (
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {isSaving && (
          <span className="inline-flex items-center gap-1.5 text-brand">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving
          </span>
        )}
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} overdue
          </span>
        )}
        {reviewCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-violet-700">
            <Send className="h-3.5 w-3.5" />
            {reviewCount} in review
          </span>
        )}
      </div>
    )}
  </div>
);

const WorkflowTabs: React.FC<{
  tabs: QueueTab[];
  activeView: QueueView;
  onViewChange: (view: QueueView) => void;
}> = ({ tabs, activeView, onViewChange }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
    <div className="flex flex-wrap gap-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onViewChange(tab.key)}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${
            activeView === tab.key
              ? 'bg-slate-950 text-white shadow-sm'
              : 'text-slate-500 hover:bg-brand/5 hover:text-brand'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
            activeView === tab.key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  </div>
);

const WorkflowCommandBar: React.FC<{
  title: string;
  resultCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  kindFilter: WorkflowTaskKind | 'all';
  onKindFilterChange: (value: WorkflowTaskKind | 'all') => void;
  isBranchUser: boolean;
  user: Branch;
  branchOptions: Array<{ value: string; label: string; hint?: string }>;
  branchFilter: string | null;
  onBranchFilterChange: (value: string | null) => void;
  isLoading: boolean;
  canExport: boolean;
  onRefresh: () => void;
  onExport: () => void;
  canEdit: boolean;
  canManageTemplates: boolean;
  canDecideReview: boolean;
  view: QueueView;
  isSaving: boolean;
  dueTemplatesCount: number;
  overdueCount: number;
  onNewTask: () => void;
  onNewTemplate: () => void;
  onGenerateDue: () => void;
  onEscalate: () => void;
}> = ({
  title,
  resultCount,
  search,
  onSearchChange,
  kindFilter,
  onKindFilterChange,
  isBranchUser,
  user,
  branchOptions,
  branchFilter,
  onBranchFilterChange,
  isLoading,
  canExport,
  onRefresh,
  onExport,
  canEdit,
  canManageTemplates,
  canDecideReview,
  view,
  isSaving,
  dueTemplatesCount,
  overdueCount,
  onNewTask,
  onNewTemplate,
  onGenerateDue,
  onEscalate
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current View</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {resultCount} records
          </span>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(190px,280px)_150px_minmax(170px,220px)_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search tasks"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-bold outline-none transition-colors focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
          />
        </div>
        <select
          value={kindFilter}
          onChange={event => onKindFilterChange(event.target.value as WorkflowTaskKind | 'all')}
          className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
        >
          <option value="all">All types</option>
          <option value="work">Work tasks</option>
          <option value="personal">Personal todos</option>
        </select>
        {isBranchUser ? (
          <div className="inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-600">
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{user.name}</span>
          </div>
        ) : (
          <SearchableSelect
            options={branchOptions}
            value={branchFilter}
            onChange={onBranchFilterChange}
            placeholder="All branches"
          />
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-secondary h-10 min-w-10 px-3"
          title="Refresh"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className="btn-secondary h-10 px-3 text-xs"
          title="Export CSV"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
        {view === 'templates' && canManageTemplates ? (
          <button type="button" onClick={onNewTemplate} className="btn-primary h-10 px-3 text-xs">
            <Plus className="h-4 w-4" />
            <span>Template</span>
          </button>
        ) : canEdit ? (
          <button type="button" onClick={onNewTask} className="btn-primary h-10 px-3 text-xs">
            <Plus className="h-4 w-4" />
            <span>Task</span>
          </button>
        ) : null}
        {view === 'templates' && canManageTemplates && (
          <button type="button" onClick={onGenerateDue} disabled={isSaving || dueTemplatesCount === 0} className="btn-secondary h-10 px-3 text-xs">
            <CalendarClock className="h-4 w-4" />
            <span>Generate</span>
          </button>
        )}
        {canDecideReview && view !== 'templates' && (
          <button type="button" onClick={onEscalate} disabled={isSaving || overdueCount === 0} className="btn-secondary h-10 px-3 text-xs">
            <TrendingUp className="h-4 w-4" />
            <span>Escalate</span>
          </button>
        )}
      </div>
    </div>
  </div>
);

const TemplatesPanel: React.FC<{
  templates: WorkflowTaskTemplate[];
  dueCount: number;
  canManage: boolean;
  onGenerateDue: () => void;
  onEdit: (template: WorkflowTaskTemplate) => void;
  onDelete: (template: WorkflowTaskTemplate) => void;
}> = ({ templates, dueCount, canManage, onGenerateDue, onEdit, onDelete }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        <CalendarPlus className="h-4 w-4" />
        <span>{templates.length} templates</span>
      </div>
      {dueCount > 0 && canManage && (
        <button type="button" onClick={onGenerateDue} className="btn-secondary h-9 px-3 text-[10px]">
          <CalendarPlus className="h-4 w-4" />
          <span>{dueCount} Due</span>
        </button>
      )}
    </div>

    {templates.length === 0 ? (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
        <div>
          <CalendarPlus className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700">No templates found.</p>
        </div>
      </div>
    ) : (
      <div className="grid gap-3">
        {templates.map(template => {
          const due = Boolean(template.isActive && template.nextDueOn && template.nextDueOn <= dateKey(new Date()));
          return (
            <article
              key={template.id}
              className={`relative overflow-hidden rounded-lg border p-4 pl-5 shadow-sm transition-colors hover:border-brand/25 ${
                due ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 bg-white'
              } before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${PRIORITY_ACCENT_CLASSES[template.priority]}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${template.isActive ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${PRIORITY_CLASSES[template.priority]}`}>
                      {PRIORITY_LABELS[template.priority]}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                      {FREQUENCY_LABELS[template.recurrenceFrequency]}
                    </span>
                    {due && (
                      <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                        Due
                      </span>
                    )}
                    {template.reviewRequired && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                        <ShieldCheck className="h-3 w-3" />
                        Review
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 break-words text-lg font-black tracking-tight text-slate-950">{template.title}</h3>
                  {template.description && (
                    <p className="mt-2 whitespace-pre-line break-words text-sm font-medium leading-6 text-slate-500">{template.description}</p>
                  )}
                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2 xl:grid-cols-5">
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-300" />
                      <span className="truncate">Next {formatDate(template.nextDueOn)}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
                      <CalendarPlus className="h-3.5 w-3.5 text-slate-300" />
                      <span className="truncate">Starts {formatDate(template.startsOn)}</span>
                    </span>
                    {template.endsOn && (
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
                        <Clock3 className="h-3.5 w-3.5 text-slate-300" />
                        <span className="truncate">Ends {formatDate(template.endsOn)}</span>
                      </span>
                    )}
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-300" />
                      <span className="truncate">{template.branchName || 'No branch'}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
                      <UserRound className="h-3.5 w-3.5 text-slate-300" />
                      <span className="truncate">{roleLabel(template.assigneeRole)}</span>
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button type="button" onClick={() => onEdit(template)} className="btn-secondary h-9 px-3 text-[10px]">
                      <Edit3 className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button type="button" onClick={() => onDelete(template)} className="btn-secondary h-9 px-3 text-[10px]">
                      <Trash2 className="h-4 w-4" />
                      <span>Archive</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    )}
  </div>
);

const WorkflowDashboard: React.FC<{
  tasks: WorkflowTask[];
  templates: WorkflowTaskTemplate[];
  canManage: boolean;
  onGenerateDue: () => void;
  onQuickAddDate: (value: string) => void;
}> = ({ tasks, templates, canManage, onGenerateDue, onQuickAddDate }) => {
  const today = dateKey(new Date());
  const active = tasks.filter(task => !isClosed(task));
  const dueToday = active.filter(task => taskDateKey(task) === today);
  const overdue = active.filter(isOverdue);
  const completedToday = tasks.filter(task =>
    isClosed(task) && task.resolvedAt && dateKey(new Date(task.resolvedAt)) === today
  );
  const personalToday = active.filter(task => task.taskKind === 'personal' && taskDateKey(task) === today);
  const dueTemplates = templates.filter(template =>
    template.isActive && !template.deletedAt && template.nextDueOn && template.nextDueOn <= today
  );
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(new Date(), index - 6));
  const maxDayCount = Math.max(1, ...weekDays.map(day => tasks.filter(task => taskDateKey(task) === dateKey(day)).length));
  const priorityBuckets: WorkflowTaskPriority[] = ['urgent', 'high', 'medium', 'low'];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today Focus</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{dueToday.length} active item{dueToday.length === 1 ? '' : 's'}</h3>
          </div>
          <button type="button" onClick={() => onQuickAddDate(today)} className="btn-primary h-9 px-3 text-[10px]">
            <Plus className="h-4 w-4" />
            <span>Quick Add</span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniStat label="Completed Today" value={completedToday.length} icon={<CheckCircle2 className="h-4 w-4" />} />
          <MiniStat label="Missed / Overdue" value={overdue.length} icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
          <MiniStat label="Memos Today" value={personalToday.length} icon={<UserRound className="h-4 w-4" />} tone="slate" />
        </div>

        <div className="mt-4 grid gap-2">
          {dueToday.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
              No due items for today.
            </div>
          ) : dueToday.slice(0, 6).map(task => (
            <CompactTaskLine key={task.id} task={task} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action Alerts</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{overdue.length + dueTemplates.length} needs attention</h3>
          </div>
          {canManage && (
            <button type="button" onClick={onGenerateDue} disabled={dueTemplates.length === 0} className="btn-secondary h-9 px-3 text-[10px]">
              <CalendarPlus className="h-4 w-4" />
              <span>Generate</span>
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <AlertLine icon={<AlertTriangle className="h-4 w-4" />} label="Overdue tasks" value={overdue.length} />
          <AlertLine icon={<Send className="h-4 w-4" />} label="Waiting review" value={tasks.filter(task => task.status === 'submitted').length} />
          <AlertLine icon={<CalendarPlus className="h-4 w-4" />} label="Templates due" value={dueTemplates.length} />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Load</p>
          <div className="space-y-2">
            {weekDays.map(day => {
              const key = dateKey(day);
              const count = tasks.filter(task => taskDateKey(task) === key).length;
              return (
                <div key={key} className="grid grid-cols-[52px_1fr_28px] items-center gap-2 text-xs font-bold text-slate-500">
                  <span>{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, (count / maxDayCount) * 100)}%` }} />
                  </span>
                  <span className="text-right text-slate-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {priorityBuckets.map(priority => (
            <div key={priority} className={`rounded-lg border p-3 text-center ${PRIORITY_CLASSES[priority]}`}>
              <p className="text-[10px] font-black uppercase tracking-widest">{PRIORITY_LABELS[priority]}</p>
              <p className="mt-2 text-xl font-black">{active.filter(task => task.priority === priority).length}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const WorkflowCalendar: React.FC<{
  tasks: WorkflowTask[];
  selectedDate: string;
  calendarMonth: Date;
  onSelectedDateChange: (value: string) => void;
  onCalendarMonthChange: (value: Date) => void;
  onQuickAddDate: (value: string) => void;
}> = ({ tasks, selectedDate, calendarMonth, onSelectedDateChange, onCalendarMonthChange, onQuickAddDate }) => {
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const selectedTasks = tasks.filter(task => taskDateKey(task) === selectedDate);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="btn-secondary h-9 min-w-9 px-2" title="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-black tracking-tight text-slate-950">
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(calendarMonth)}
          </h3>
          <button type="button" onClick={() => onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="btn-secondary h-9 min-w-9 px-2" title="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map(day => {
            const key = dateKey(day);
            const dayTasks = tasks.filter(task => taskDateKey(task) === key);
            const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectedDateChange(key)}
                className={`min-h-24 rounded-lg border p-2 text-left transition-colors ${
                  isSelected ? 'border-slate-950 bg-slate-950 text-white' : isCurrentMonth ? 'border-slate-200 bg-white hover:border-brand/30' : 'border-slate-100 bg-slate-50 text-slate-300'
                }`}
              >
                <span className="text-xs font-black">{day.getDate()}</span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {dayTasks.slice(0, 4).map(task => (
                    <span key={task.id} className={`h-2 w-2 rounded-full ${task.priority === 'urgent' ? 'bg-rose-500' : task.priority === 'high' ? 'bg-orange-400' : task.taskKind === 'personal' ? 'bg-slate-400' : 'bg-brand'}`} />
                  ))}
                </div>
                {dayTasks.length > 0 && <p className="mt-2 text-[10px] font-black">{dayTasks.length} item{dayTasks.length === 1 ? '' : 's'}</p>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Day</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{formatDate(selectedDate)}</h3>
          </div>
          <button type="button" onClick={() => onQuickAddDate(selectedDate)} className="btn-primary h-9 px-3 text-[10px]">
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {selectedTasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">No scheduled items.</p>
          ) : selectedTasks.map(task => <CompactTaskLine key={task.id} task={task} />)}
        </div>
      </section>
    </div>
  );
};

const WorkflowTimeline: React.FC<{
  tasks: WorkflowTask[];
  selectedDate: string;
  onSelectedDateChange: (value: string) => void;
  onQuickAddDate: (value: string) => void;
}> = ({ tasks, selectedDate, onSelectedDateChange, onQuickAddDate }) => {
  const selectedTasks = tasks
    .filter(task => taskDateKey(task) === selectedDate)
    .sort((a, b) => new Date(a.dueAt || a.createdAt).getTime() - new Date(b.dueAt || b.createdAt).getTime());
  const hours = Array.from({ length: 15 }, (_, index) => index + 8);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Day Timeline</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{formatDate(selectedDate)}</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={event => onSelectedDateChange(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
          />
          <button type="button" onClick={() => onQuickAddDate(selectedDate)} className="btn-primary h-9 px-3 text-[10px]">
            <Plus className="h-4 w-4" />
            <span>Quick Add</span>
          </button>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {hours.map(hour => {
          const hourTasks = selectedTasks.filter(task => {
            if (!task.dueAt) return false;
            return new Date(task.dueAt).getHours() === hour;
          });
          return (
            <div key={hour} className="grid min-h-16 grid-cols-[64px_1fr] gap-3 py-3">
              <span className="text-xs font-black text-slate-400">{String(hour).padStart(2, '0')}:00</span>
              <div className="space-y-2">
                {hourTasks.length === 0 ? (
                  <div className="h-8 rounded-md border border-dashed border-slate-100 bg-slate-50/60" />
                ) : hourTasks.map(task => <CompactTaskLine key={task.id} task={task} />)}
              </div>
            </div>
          );
        })}
        {selectedTasks.some(task => !task.dueAt) && (
          <div className="grid grid-cols-[64px_1fr] gap-3 py-3">
            <span className="text-xs font-black text-slate-400">Any</span>
            <div className="space-y-2">
              {selectedTasks.filter(task => !task.dueAt).map(task => <CompactTaskLine key={task.id} task={task} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const WorkflowAnalytics: React.FC<{ tasks: WorkflowTask[] }> = ({ tasks }) => {
  const total = tasks.length;
  const closed = tasks.filter(isClosed).length;
  const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
  const active = tasks.filter(task => !isClosed(task));
  const branches = Array.from(new Set(tasks.map(task => task.branchName || 'No branch')));
  const roles = Array.from(new Set(tasks.map(task => roleLabel(task.assigneeRole))));
  const trendDays = Array.from({ length: 7 }, (_, index) => addDays(new Date(), index - 6));

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completion</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MiniStat label="Completion Rate" value={`${completionRate}%`} icon={<BadgeCheck className="h-4 w-4" />} tone="emerald" />
          <MiniStat label="Active Load" value={active.length} icon={<CircleDot className="h-4 w-4" />} />
          <MiniStat label="Review Queue" value={tasks.filter(task => task.status === 'submitted').length} icon={<Send className="h-4 w-4" />} tone="violet" />
          <MiniStat label="Expired / Missed" value={tasks.filter(task => task.status === 'expired' || isOverdue(task)).length} icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Historical Trend</p>
          <div className="flex h-36 items-end gap-2">
            {trendDays.map(day => {
              const key = dateKey(day);
              const count = tasks.filter(task => task.createdAt && dateKey(new Date(task.createdAt)) === key).length;
              const height = Math.max(8, count * 18);
              return (
                <div key={key} className="flex flex-1 flex-col items-center gap-2">
                  <span className="w-full rounded-t-md bg-brand/80" style={{ height }} />
                  <span className="text-[10px] font-black text-slate-400">{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch Compliance</p>
        <div className="mt-4 space-y-2">
          {branches.slice(0, 8).map(branch => {
            const branchTasks = tasks.filter(task => (task.branchName || 'No branch') === branch);
            const branchClosed = branchTasks.filter(isClosed).length;
            const rate = branchTasks.length === 0 ? 0 : Math.round((branchClosed / branchTasks.length) * 100);
            return <ProgressLine key={branch} label={branch} value={rate} detail={`${branchClosed}/${branchTasks.length}`} />;
          })}
        </div>

        <p className="mb-3 mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Impact</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map(role => (
            <div key={role} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="truncate text-xs font-black text-slate-700">{role}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{tasks.filter(task => roleLabel(task.assigneeRole) === role).length}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const EisenhowerMatrix: React.FC<{ tasks: WorkflowTask[] }> = ({ tasks }) => {
  const active = tasks.filter(task => !isClosed(task));
  const today = startOfDay(new Date());
  const soon = addDays(today, 2).getTime();
  const buckets = [
    {
      title: 'Do Now',
      tone: 'border-rose-200 bg-rose-50/30',
      tasks: active.filter(task => ['urgent', 'high'].includes(task.priority) && task.dueAt && new Date(task.dueAt).getTime() <= soon)
    },
    {
      title: 'Schedule',
      tone: 'border-orange-200 bg-orange-50/30',
      tasks: active.filter(task => ['urgent', 'high'].includes(task.priority) && (!task.dueAt || new Date(task.dueAt).getTime() > soon))
    },
    {
      title: 'Delegate',
      tone: 'border-blue-200 bg-blue-50/30',
      tasks: active.filter(task => task.priority === 'medium')
    },
    {
      title: 'Backlog',
      tone: 'border-slate-200 bg-slate-50',
      tasks: active.filter(task => task.priority === 'low')
    }
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {buckets.map(bucket => (
        <section key={bucket.title} className={`min-h-72 rounded-lg border p-4 shadow-sm ${bucket.tone}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-slate-950">{bucket.title}</h3>
            <span className="rounded-md border border-white/70 bg-white/80 px-2 py-1 text-xs font-black text-slate-500">{bucket.tasks.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {bucket.tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-center text-sm font-bold text-slate-400">Empty</p>
            ) : bucket.tasks.slice(0, 8).map(task => <CompactTaskLine key={task.id} task={task} />)}
          </div>
        </section>
      ))}
    </div>
  );
};

const MiniStat: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: KpiTone;
}> = ({ label, value, icon, tone = 'blue' }) => {
  const toneClass = {
    blue: 'border-blue-100 bg-blue-50/40 text-blue-700',
    amber: 'border-amber-100 bg-amber-50/40 text-amber-700',
    violet: 'border-violet-100 bg-violet-50/40 text-violet-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-100 bg-rose-50/40 text-rose-700',
    emerald: 'border-emerald-100 bg-emerald-50/40 text-emerald-700'
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
};

const AlertLine: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <span className="inline-flex items-center gap-2 text-xs font-black text-slate-600">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
    <span className="text-sm font-black text-slate-950">{value}</span>
  </div>
);

const ProgressLine: React.FC<{ label: string; value: number; detail: string }> = ({ label, value, detail }) => (
  <div className="grid grid-cols-[minmax(120px,1fr)_2fr_56px] items-center gap-3 text-xs font-bold text-slate-500">
    <span className="truncate">{label}</span>
    <span className="h-2 overflow-hidden rounded-full bg-slate-100">
      <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, value)}%` }} />
    </span>
    <span className="text-right text-slate-700">{detail}</span>
  </div>
);

const CompactTaskLine: React.FC<{ task: WorkflowTask }> = ({ task }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase ${STATUS_CLASSES[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase ${PRIORITY_CLASSES[task.priority]}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">{formatDateTime(task.dueAt)}</span>
    </div>
  </div>
);

const Kpi: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: KpiTone;
}> = ({ label, value, icon, tone }) => {
  const toneClass = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    violet: 'text-violet-700',
    slate: 'text-slate-700',
    rose: 'text-rose-700',
    emerald: 'text-emerald-700'
  }[tone];

  return (
    <div className={`p-4 transition-colors hover:bg-slate-50/70 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
};

const TaskRow: React.FC<{
  task: WorkflowTask;
  canEdit: boolean;
  canReview: boolean;
  isExpanded: boolean;
  events: WorkflowTaskEvent[];
  attachments: WorkflowTaskAttachment[];
  comment: string;
  onCommentChange: (value: string) => void;
  onToggleEvents: () => void;
  onAddComment: () => void;
  onStart: () => void;
  onComplete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDismiss: () => void;
  onReopen: () => void;
  onAddAttachment: () => void;
  onDeleteAttachment: (attachment: WorkflowTaskAttachment) => void;
}> = ({
  task,
  canEdit,
  canReview,
  isExpanded,
  events,
  attachments,
  comment,
  onCommentChange,
  onToggleEvents,
  onAddComment,
  onStart,
  onComplete,
  onApprove,
  onReject,
  onDismiss,
  onReopen,
  onAddAttachment,
  onDeleteAttachment
}) => {
  const closed = isClosed(task);
  const overdue = isOverdue(task);
  const doneLabel = task.taskKind === 'work' && task.reviewRequired ? 'Submit' : 'Done';
  const routeChips = [
    ...metadataList(task.metadata, 'ccRoles').map(value => `CC ${value}`),
    ...metadataList(task.metadata, 'areas').map(value => `Area ${value}`),
    ...metadataList(task.metadata, 'observers').map(value => `Observer ${value}`)
  ];
  const articleState = overdue
    ? 'border-rose-200 bg-rose-50/20'
    : task.status === 'submitted'
      ? 'border-violet-200 bg-violet-50/20'
      : 'border-slate-200 bg-white';

  return (
    <article className={`relative overflow-hidden rounded-lg border p-4 pl-5 shadow-sm transition-colors hover:border-brand/25 ${articleState} before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${PRIORITY_ACCENT_CLASSES[task.priority]}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_CLASSES[task.status]}`}>
              {STATUS_LABELS[task.status]}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${PRIORITY_CLASSES[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {task.taskKind === 'personal' ? 'Personal' : 'Work'}
            </span>
            {task.reviewRequired && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                <ShieldCheck className="h-3 w-3" />
                Review
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                Overdue
              </span>
            )}
          </div>
          <h3 className="mt-3 break-words text-lg font-black tracking-tight text-slate-950">{task.title}</h3>
          {task.description && (
            <p className="mt-2 whitespace-pre-line break-words text-sm font-medium leading-6 text-slate-500">{task.description}</p>
          )}
          <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-slate-300" />
              <span className="truncate">{formatDateTime(task.dueAt)}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-300" />
              <span className="truncate">{task.branchName || 'No branch'}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-2.5 py-1.5">
              <UserRound className="h-3.5 w-3.5 text-slate-300" />
              <span className="truncate">{roleLabel(task.assigneeRole)}</span>
            </span>
            {task.templateOccurrenceDate && (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5 text-emerald-700">
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="truncate">{formatDate(task.templateOccurrenceDate)}</span>
              </span>
            )}
          </div>
          {routeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {routeChips.map(chip => (
                <span key={chip} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button type="button" onClick={onToggleEvents} className="btn-secondary h-9 px-3 text-[10px]">
            <MessageSquarePlus className="h-4 w-4" />
            <span>Activity</span>
          </button>
          {canEdit && (
            <button type="button" onClick={onAddAttachment} className="btn-secondary h-9 px-3 text-[10px]">
              <Paperclip className="h-4 w-4" />
              <span>Evidence</span>
            </button>
          )}
          {canEdit && !closed && task.status === 'open' && (
            <button type="button" onClick={onStart} className="btn-secondary h-9 px-3 text-[10px]">
              <Clock3 className="h-4 w-4" />
              <span>Start</span>
            </button>
          )}
          {canEdit && !closed && task.status !== 'submitted' && (
            <button type="button" onClick={onComplete} className="btn-primary h-9 px-3 text-[10px]">
              <CheckCircle2 className="h-4 w-4" />
              <span>{doneLabel}</span>
            </button>
          )}
          {canReview && task.status === 'submitted' && (
            <>
              <button type="button" onClick={onApprove} className="btn-primary h-9 px-3 text-[10px]">
                <BadgeCheck className="h-4 w-4" />
                <span>Approve</span>
              </button>
              <button type="button" onClick={onReject} className="btn-secondary h-9 px-3 text-[10px]">
                <XCircle className="h-4 w-4" />
                <span>Reject</span>
              </button>
            </>
          )}
          {canEdit && task.taskKind === 'personal' && !closed && (
            <button type="button" onClick={onDismiss} className="btn-secondary h-9 px-3 text-[10px]">
              <XCircle className="h-4 w-4" />
              <span>Dismiss</span>
            </button>
          )}
          {canReview && closed && (
            <button type="button" onClick={onReopen} className="btn-secondary h-9 px-3 text-[10px]">
              <RefreshCw className="h-4 w-4" />
              <span>Reopen</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {canEdit && (
            <div className="mb-4 flex flex-col gap-2 md:flex-row">
              <input
                value={comment}
                onChange={event => onCommentChange(event.target.value)}
                placeholder="Add comment"
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
              <button type="button" onClick={onAddComment} className="btn-secondary h-10 px-4 text-xs">
                <MessageSquarePlus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
          )}
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Paperclip className="h-4 w-4" />
                Attachments
              </span>
              <span className="text-[10px] font-black text-slate-400">{attachments.length}</span>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs font-bold text-slate-400">No evidence attached.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {attachments.map(attachment => {
                  const href = attachment.fileUrl || attachment.filePath || '';
                  return (
                    <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-700">{attachment.fileName}</p>
                        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{attachment.scanStatus || 'pending'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-brand/30 hover:text-brand" title="Open attachment">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {canEdit && (
                          <button type="button" onClick={() => onDeleteAttachment(attachment)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600" title="Remove attachment">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {events.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map(event => (
                <div key={event.id} className="flex items-start justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="break-words text-sm font-semibold leading-5 text-slate-600">{eventText(event)}</p>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">{formatActivityTime(event.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
