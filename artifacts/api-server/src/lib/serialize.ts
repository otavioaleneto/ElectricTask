import type {
  User,
  Workspace,
  Project,
  Column,
  Task,
  Checklist,
  ChecklistItem,
  Mindmap,
  MindmapDataShape,
  Label,
  TaskAttachment,
  TaskVideoLink,
  Note,
  RecurringTemplate,
  PaymentMethod,
  Subscription,
  SubscriptionCategoryRow,
  SubscriptionPayment,
} from "@workspace/db";

export function avatarSrc(
  userId: number,
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  const version = stored.slice(-10).replace(/[^a-zA-Z0-9]/g, "");
  return `/api/users/${userId}/avatar?v=${version}`;
}

export function toAuthUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "user" | "admin",
    avatarUrl: avatarSrc(u.id, u.avatarUrl),
    theme: u.theme as "dark" | "light",
    hasSecurityQuestions: Boolean(
      u.securityAnswerHash1 &&
        u.securityAnswerHash2 &&
        u.securityAnswerHash3,
    ),
  };
}

export function toWorkspace(
  w: Workspace,
  currentUserRole: "owner" | "editor" | "viewer" | null = null,
) {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? null,
    color: w.color,
    createdAt: w.createdAt.toISOString(),
    ...(currentUserRole ? { currentUserRole } : {}),
  };
}

export function toWorkspaceMember(m: {
  userId: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
}) {
  return {
    userId: m.userId,
    name: m.name,
    email: m.email,
    avatarUrl: avatarSrc(m.userId, m.avatarUrl),
    role: m.role as "owner" | "editor" | "viewer",
    createdAt: m.createdAt.toISOString(),
  };
}

export interface RecentTaskInfo {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  priority: string;
  createdAt: string;
}

export function toProject(
  p: Project,
  taskCount: number,
  completedCount: number,
  recentTasks: RecentTaskInfo[] = [],
  lastViewedAt: string | null = null,
) {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    description: p.description ?? null,
    type: p.type as "social" | "development",
    coverImageUrl: p.coverImageUrl ?? null,
    platform: p.platform as
      | "youtube"
      | "instagram"
      | "tiktok"
      | "twitter"
      | "linkedin"
      | "twitch"
      | "generic",
    accentColor: p.accentColor,
    taskCount,
    completedCount,
    createdAt: p.createdAt.toISOString(),
    lastViewedAt,
    recentTasks,
  };
}

export function toColumn(c: Column) {
  return {
    id: c.id,
    projectId: c.projectId,
    name: c.name,
    position: c.position,
    color: c.color,
    isDone: c.isDone,
  };
}

export function toLabel(l: Label) {
  return {
    id: l.id,
    projectId: l.projectId,
    name: l.name,
    color: l.color,
    createdAt: l.createdAt.toISOString(),
  };
}

export function toVideoLink(v: TaskVideoLink) {
  return {
    id: v.id,
    taskId: v.taskId,
    url: v.url,
    label: v.label ?? null,
    position: v.position,
    createdAt: v.createdAt.toISOString(),
  };
}

export function toTask(
  t: Task,
  checklistTotal: number,
  checklistDone: number,
  assignee: { id: number; name: string; avatarUrl: string | null } | null = null,
  labels: Label[] = [],
  videoLinks: TaskVideoLink[] = [],
) {
  return {
    id: t.id,
    projectId: t.projectId,
    columnId: t.columnId,
    title: t.title,
    description: t.description ?? null,
    type: t.type as "standard" | "video",
    priority: t.priority as "low" | "medium" | "high",
    dueDate: t.dueDate ?? null,
    position: t.position,
    mindmapId: t.mindmapId ?? null,
    assigneeId: t.assigneeId ?? null,
    assignee: assignee
      ? { ...assignee, avatarUrl: avatarSrc(assignee.id, assignee.avatarUrl) }
      : null,
    completed: t.completed,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    checklistTotal,
    checklistDone,
    createdAt: t.createdAt.toISOString(),
    labels: labels.map(toLabel),
    videoLinks: videoLinks.map(toVideoLink),
  };
}

export function toAttachment(
  a: TaskAttachment,
  uploaderName: string | null = null,
) {
  return {
    id: a.id,
    taskId: a.taskId,
    name: a.name,
    contentType: a.contentType,
    size: a.size,
    uploaderName,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toChecklistItem(i: ChecklistItem) {
  return {
    id: i.id,
    checklistId: i.checklistId,
    content: i.content,
    done: i.done,
    position: i.position,
  };
}

export function toChecklist(c: Checklist, items: ChecklistItem[]) {
  return {
    id: c.id,
    taskId: c.taskId,
    title: c.title,
    position: c.position,
    items: items.map(toChecklistItem),
  };
}

export interface UserMini {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export function toComment(
  c: { id: number; taskId: number; body: string; createdAt: Date },
  author: UserMini,
  mentions: UserMini[],
) {
  return {
    id: c.id,
    taskId: c.taskId,
    body: c.body,
    author: { ...author, avatarUrl: avatarSrc(author.id, author.avatarUrl) },
    mentions: mentions.map((m) => ({
      ...m,
      avatarUrl: avatarSrc(m.id, m.avatarUrl),
    })),
    createdAt: c.createdAt.toISOString(),
  };
}

export function toActivity(
  a: {
    id: number;
    taskId: number;
    action: string;
    detail: string | null;
    createdAt: Date;
  },
  actor: UserMini | null,
) {
  return {
    id: a.id,
    taskId: a.taskId,
    action: a.action as
      | "created"
      | "moved"
      | "completed"
      | "reopened"
      | "assignee_changed"
      | "due_changed"
      | "timer_started"
      | "timer_paused"
      | "timer_finished",
    detail: a.detail ?? null,
    actor: actor
      ? { ...actor, avatarUrl: avatarSrc(actor.id, actor.avatarUrl) }
      : null,
    createdAt: a.createdAt.toISOString(),
  };
}

export interface NotificationSubscriptionInfo {
  id: number;
  companySlug: string | null;
  customName: string | null;
  customColor: string | null;
  amountCents: number;
  currency: string;
  nextDueDate: string;
  paymentType: string;
}

export function toNotification(
  n: { id: number; type: string; read: boolean; createdAt: Date },
  task: { id: number; projectId: number; title: string } | null,
  actor: UserMini | null,
  subscription: NotificationSubscriptionInfo | null = null,
) {
  return {
    id: n.id,
    type: n.type as
      | "assigned"
      | "mentioned"
      | "due_soon"
      | "subscription_due"
      | "subscription_overdue",
    read: n.read,
    task: task ?? null,
    subscription: subscription ?? null,
    actor: actor
      ? { ...actor, avatarUrl: avatarSrc(actor.id, actor.avatarUrl) }
      : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toPaymentMethod(p: PaymentMethod, subscriptionCount?: number) {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    ...(subscriptionCount !== undefined ? { subscriptionCount } : {}),
  };
}

export function toWorkspaceCategory(
  c: SubscriptionCategoryRow,
  subscriptionCount?: number,
) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    key: c.key,
    label: c.label,
    createdAt: c.createdAt.toISOString(),
    ...(subscriptionCount !== undefined ? { subscriptionCount } : {}),
  };
}

export function toSubscription(
  s: Subscription,
  paymentMethodName: string | null = null,
  linkedTaskCount = 0,
) {
  return {
    id: s.id,
    workspaceId: s.workspaceId,
    companySlug: s.companySlug ?? null,
    customName: s.customName ?? null,
    customColor: s.customColor ?? null,
    category: s.category as
      | "streaming"
      | "technology"
      | "telecom"
      | "hosting"
      | "domain"
      | "other",
    amountCents: s.amountCents,
    currency: s.currency as "BRL" | "USD",
    billingCycle: s.billingCycle as
      | "monthly"
      | "yearly"
      | "weekly"
      | "quarterly"
      | "custom",
    customCycleDays: s.customCycleDays ?? null,
    nextDueDate: s.nextDueDate,
    reminderDaysBefore: s.reminderDaysBefore,
    paymentType: s.paymentType as "automatic" | "manual",
    paymentMethodId: s.paymentMethodId ?? null,
    paymentMethodName,
    status: s.status as "active" | "paused" | "cancelled",
    website: s.website ?? null,
    // Never expose the stored username/password here; hasCredential only tells
    // the UI whether there is something to reveal.
    hasCredential: Boolean(s.credentialCiphertext) || Boolean(s.username),
    notes: s.notes ?? null,
    lastPaidAt: s.lastPaidAt ? s.lastPaidAt.toISOString() : null,
    linkedTaskCount,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toSubscriptionPayment(
  p: SubscriptionPayment,
  paidByName: string | null = null,
) {
  return {
    id: p.id,
    subscriptionId: p.subscriptionId,
    amountCents: p.amountCents,
    currency: p.currency,
    dueDate: p.dueDate,
    paidAt: p.paidAt.toISOString(),
    paidByName,
  };
}

// `data` must always leave the API as a valid mindmap document. MariaDB
// stores JSON as LONGTEXT (strings), and legacy or hand-edited rows could
// otherwise ship null/malformed data that white-screens clients reading
// `data.nodes` directly.
function normalizeMindmapData(raw: unknown): MindmapDataShape {
  let value = raw;
  // Parse up to two string layers: MariaDB returns JSON as LONGTEXT strings,
  // and legacy imports may have double-encoded the payload. Falling back to an
  // empty map on a recoverable row would risk the user saving over real data.
  try {
    if (typeof value === "string") value = JSON.parse(value);
    if (typeof value === "string") value = JSON.parse(value);
  } catch {
    value = null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { nodes: [], edges: [] };
  }
  const obj = value as Record<string, unknown>;
  return {
    nodes: Array.isArray(obj.nodes)
      ? (obj.nodes as MindmapDataShape["nodes"])
      : [],
    edges: Array.isArray(obj.edges)
      ? (obj.edges as MindmapDataShape["edges"])
      : [],
    ...(Array.isArray(obj.areas)
      ? { areas: obj.areas as NonNullable<MindmapDataShape["areas"]> }
      : {}),
    ...(Array.isArray(obj.elements)
      ? {
          elements: obj.elements as NonNullable<
            MindmapDataShape["elements"]
          >,
        }
      : {}),
  };
}

export function toMindmap(m: Mindmap) {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    name: m.name,
    data: normalizeMindmapData(m.data),
    taskId: m.taskId ?? null,
    parentId: m.parentId ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toNote(n: Note) {
  return {
    id: n.id,
    workspaceId: n.workspaceId,
    title: n.title,
    content: n.content,
    isLocked: n.isLocked,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export function toRecurrence(r: RecurringTemplate, columnName: string) {
  return {
    id: r.id,
    projectId: r.projectId,
    columnId: r.columnId,
    columnName,
    title: r.title,
    description: r.description ?? null,
    type: r.type as "standard" | "video",
    priority: r.priority as "low" | "medium" | "high",
    frequency: r.frequency as "hourly" | "daily" | "weekly" | "monthly",
    timeOfDay: r.timeOfDay ?? null,
    dayOfWeek: r.dayOfWeek ?? null,
    dayOfMonth: r.dayOfMonth ?? null,
    active: r.active,
    nextRunAt: r.nextRunAt.toISOString(),
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toNoteSummary(n: Note) {
  const excerpt = n.isLocked
    ? ""
    : n.content.replace(/\s+/g, " ").trim().slice(0, 140);
  return {
    id: n.id,
    workspaceId: n.workspaceId,
    title: n.title,
    excerpt,
    isLocked: n.isLocked,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}
