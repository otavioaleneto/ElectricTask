import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListWorkspaces, useCreateWorkspace, useGetWorkspaceSummary, 
  useListProjects, useCreateProject, getListWorkspacesQueryKey, 
  getListProjectsQueryKey, getGetWorkspaceSummaryQueryKey,
  useGetSubscriptionSummary, getGetSubscriptionSummaryQueryKey,
  useUpdateWorkspace, useDeleteWorkspace
} from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionLogo } from "@/components/subscription-logo";
import { brandDisplay, BILLING_CYCLE_LABELS } from "@/lib/subscription-brands";
import { parseDueDate, startOfToday } from "@/lib/date";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, LayoutTemplate, Briefcase, Activity, CheckCircle2, Network, Globe, Clock, ArrowRight, Code2, Users, GripVertical, Settings, Check, RotateCcw, ChevronUp, ChevronDown, Wallet, CreditCard, AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiYoutube, SiInstagram, SiTiktok, SiX, SiTwitch } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { WorkspaceMembersDialog } from "@/components/workspace-members-dialog";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
  switch (platform) {
    case 'youtube': return <SiYoutube className={className} />;
    case 'instagram': return <SiInstagram className={className} />;
    case 'tiktok': return <SiTiktok className={className} />;
    case 'twitter': return <SiX className={className} />;
    case 'linkedin': return <FaLinkedin className={className} />;
    case 'twitch': return <SiTwitch className={className} />;
    default: return <Globe className={className} />;
  }
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Nunca acessado";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) return "Agora mesmo";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Há poucos segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Há ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `Há ${years} ${years === 1 ? "ano" : "anos"}`;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
};

const CHART_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#a855f7", "#06b6d4", "#f97316"];
const completionChartConfig = { count: { label: "Concluídas", color: "#6366f1" } } satisfies ChartConfig;
const barChartConfig = { count: { label: "Tarefas", color: "#6366f1" } } satisfies ChartConfig;

function fmtDay(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}
function truncateLabel(s: string): string {
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}
function ChartEmpty({ message, className }: { message: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center text-sm text-muted-foreground ${className ?? "h-[240px]"}`}>
      {message}
    </div>
  );
}

type SectionId = "stats" | "subscriptions" | "completion" | "breakdowns" | "projects";
const DEFAULT_SECTION_ORDER: SectionId[] = ["stats", "projects", "subscriptions", "completion", "breakdowns"];
const SECTION_LABELS: Record<SectionId, string> = {
  stats: "Indicadores",
  subscriptions: "Assinaturas",
  completion: "Conclusões ao longo do tempo",
  breakdowns: "Distribuição de tarefas",
  projects: "Projetos",
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function daysUntil(dateStr: string): number {
  const due = parseDueDate(dateStr);
  const today = startOfToday();
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(dateStr: string): { text: string; overdue: boolean; soon: boolean } {
  const d = daysUntil(dateStr);
  if (d < 0) return { text: `Vencida há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`, overdue: true, soon: false };
  if (d === 0) return { text: "Vence hoje", overdue: false, soon: true };
  if (d === 1) return { text: "Vence amanhã", overdue: false, soon: true };
  return { text: `Vence em ${d} dias`, overdue: false, soon: d <= 7 };
}
const SECTION_ORDER_KEY = "flowdeck-dashboard-order";

function loadSectionOrder(): SectionId[] {
  try {
    const raw = localStorage.getItem(SECTION_ORDER_KEY);
    if (!raw) return DEFAULT_SECTION_ORDER;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SECTION_ORDER;
    const valid = parsed.filter(
      (id): id is SectionId => typeof id === "string" && (DEFAULT_SECTION_ORDER as string[]).includes(id),
    );
    const deduped = Array.from(new Set(valid));
    const missing = DEFAULT_SECTION_ORDER.filter((id) => !deduped.includes(id));
    return [...deduped, ...missing];
  } catch {
    return DEFAULT_SECTION_ORDER;
  }
}

function SortableSection({
  id,
  label,
  index,
  total,
  onMove,
  children,
}: {
  id: SectionId;
  label: string;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-xl border-2 border-dashed p-4 transition-colors ${isDragging ? "border-primary bg-card shadow-lg z-10" : "border-border/70 bg-card/30"}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar seção ${label}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Mover ${label} para cima`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Mover ${label} para baixo`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="pointer-events-none select-none">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: workspaces = [], isLoading: isLoadingWorkspaces } = useListWorkspaces();

  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data: summary } = useGetWorkspaceSummary(
    activeWorkspaceId!,
    { period },
    {
      query: {
        enabled: !!activeWorkspaceId,
        queryKey: getGetWorkspaceSummaryQueryKey(activeWorkspaceId!, { period }),
      },
    }
  );

  const { data: projects = [], isLoading: isLoadingProjects } = useListProjects(activeWorkspaceId!, {
    query: { enabled: !!activeWorkspaceId, queryKey: getListProjectsQueryKey(activeWorkspaceId!) }
  });

  const { data: subSummary } = useGetSubscriptionSummary(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getGetSubscriptionSummaryQueryKey(activeWorkspaceId!),
    },
  });

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);
  const isOwner = activeWorkspace?.currentUserRole === "owner";
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);

  const createWorkspace = useCreateWorkspace();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) return;
    createWorkspace.mutate({ data: { name: newWorkspaceName } }, {
      onSuccess: (ws) => {
        queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
        setActiveWorkspaceId(ws.id);
        setNewWorkspaceName("");
        setIsWorkspaceDialogOpen(false);
        toast({ title: "Workspace criado com sucesso" });
      }
    });
  };

  const createProject = useCreateProject();
  const [newProject, setNewProject] = useState({ name: "", type: "social", platform: "youtube", accentColor: "#3b82f6", coverImageUrl: "", description: "" });
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);

  const handleCreateProject = () => {
    if (!activeWorkspaceId || !newProject.name.trim()) return;
    const payload = {
      name: newProject.name.trim(),
      type: newProject.type,
      platform: newProject.type === "development" ? "generic" : newProject.platform,
      accentColor: newProject.accentColor,
      coverImageUrl: newProject.coverImageUrl || undefined,
      description: newProject.description.trim() || undefined,
    };
    createProject.mutate({ 
      workspaceId: activeWorkspaceId, 
      data: payload as any
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey(activeWorkspaceId) });
        queryClient.invalidateQueries({ queryKey: getGetWorkspaceSummaryQueryKey(activeWorkspaceId) });
        setNewProject({ name: "", type: "social", platform: "youtube", accentColor: "#3b82f6", coverImageUrl: "", description: "" });
        setIsProjectDialogOpen(false);
        toast({ title: "Projeto criado com sucesso" });
      }
    });
  };

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const canRename = !!activeWorkspace && activeWorkspace.currentUserRole !== "viewer";

  useEffect(() => {
    setWorkspaceNameDraft(activeWorkspace?.name ?? "");
  }, [activeWorkspaceId, activeWorkspace?.name]);

  const handleOpenSettings = () => {
    setWorkspaceNameDraft(activeWorkspace?.name ?? "");
    setIsEditingLayout(true);
  };

  const handleSaveWorkspaceName = (thenExit: boolean) => {
    const trimmed = workspaceNameDraft.trim();
    if (!canRename || !activeWorkspace || !trimmed || trimmed === activeWorkspace.name) {
      if (thenExit) setIsEditingLayout(false);
      return;
    }
    updateWorkspace.mutate(
      { workspaceId: activeWorkspace.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
          toast({ title: "Workspace renomeado" });
          if (thenExit) setIsEditingLayout(false);
        },
        onError: () => {
          toast({
            title: "Não foi possível renomear o workspace",
            description: "Tente novamente em instantes.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDeleteWorkspace = () => {
    if (!activeWorkspace) return;
    const deletedId = activeWorkspace.id;
    deleteWorkspace.mutate(
      { workspaceId: deletedId },
      {
        onSuccess: () => {
          const remaining = workspaces.filter((w) => w.id !== deletedId);
          setActiveWorkspaceId(remaining[0]?.id ?? null);
          queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
          queryClient.removeQueries({ queryKey: getListProjectsQueryKey(deletedId) });
          queryClient.removeQueries({ queryKey: getGetSubscriptionSummaryQueryKey(deletedId) });
          queryClient.removeQueries({ queryKey: getGetWorkspaceSummaryQueryKey(deletedId) });
          setIsEditingLayout(false);
          toast({ title: "Workspace excluído", description: "Todo o conteúdo foi removido." });
        },
        onError: () => {
          toast({
            title: "Não foi possível excluir o workspace",
            description: "Tente novamente em instantes.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => loadSectionOrder());

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(sectionOrder));
    } catch {
      // ignore persistence failures (private mode / quota)
    }
  }, [sectionOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((items) =>
        arrayMove(items, items.indexOf(active.id as SectionId), items.indexOf(over.id as SectionId)),
      );
    }
  };

  const handleResetLayout = () => setSectionOrder(DEFAULT_SECTION_ORDER);

  if (isLoadingWorkspaces) return <div className="p-8">Carregando...</div>;

  const sectionContent: Partial<Record<SectionId, ReactNode>> = {
    stats: summary ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.projectCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Abertas</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mapas Mentais</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.mindmapCount}</div>
          </CardContent>
        </Card>
      </div>
    ) : undefined,
    subscriptions:
      subSummary &&
      (subSummary.monthlyByCurrency.length > 0 ||
        subSummary.upcoming.length > 0 ||
        subSummary.projectAlerts.length > 0) ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">Assinaturas</h2>
            </div>
            <Link href="/subscriptions">
              <Button variant="ghost" size="sm" className="group/btn">
                Ver todas
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </Link>
          </div>

          {subSummary.monthlyByCurrency.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {subSummary.monthlyByCurrency.map((m) => (
                <Card key={m.currency}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gasto mensal ({m.currency})</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatMoney(m.amountCents, m.currency)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Equivalente por mês</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Próximos vencimentos</CardTitle>
                <CardDescription>Assinaturas com vencimento em breve</CardDescription>
              </CardHeader>
              <CardContent>
                {subSummary.upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum vencimento próximo.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {subSummary.upcoming.slice(0, 6).map((sub) => {
                      const meta = dueLabel(sub.nextDueDate);
                      return (
                        <li key={sub.id} className="flex items-center gap-3">
                          <SubscriptionLogo sub={sub} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{brandDisplay(sub).name}</p>
                            <p className="text-xs text-muted-foreground">
                              {BILLING_CYCLE_LABELS[sub.billingCycle] ?? sub.billingCycle}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{formatMoney(sub.amountCents, sub.currency)}</p>
                            <span
                              className={`text-[11px] ${
                                meta.overdue
                                  ? "text-destructive font-medium"
                                  : meta.soon
                                    ? "text-amber-500"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {meta.text}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Assinaturas por projeto
                </CardTitle>
                <CardDescription>Projetos com assinaturas vencendo</CardDescription>
              </CardHeader>
              <CardContent>
                {subSummary.projectAlerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum projeto com vencimentos próximos.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {subSummary.projectAlerts.map((alert) => (
                      <li key={alert.projectId}>
                        <Link
                          href={`/projects/${alert.projectId}`}
                          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: alert.accentColor || "var(--primary)" }}
                          />
                          <span className="truncate">{alert.projectName}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {alert.subscriptions.length}{" "}
                            {alert.subscriptions.length === 1 ? "assinatura" : "assinaturas"}
                          </span>
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                          {alert.subscriptions.map((sub) => (
                            <Badge key={sub.id} variant="secondary" className="gap-1 font-normal">
                              {brandDisplay(sub).name}
                              <span className="text-muted-foreground">· {dueLabel(sub.nextDueDate).text}</span>
                            </Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : undefined,
    completion: summary ? (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Conclusões ao longo do tempo</CardTitle>
            <CardDescription>Tarefas concluídas no período selecionado</CardDescription>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {summary.completionSeries.reduce((s, p) => s + p.count, 0) === 0 ? (
            <ChartEmpty message="Nenhuma conclusão no período" className="h-[260px]" />
          ) : (
            <ChartContainer config={completionChartConfig} className="h-[260px] w-full">
              <AreaChart data={summary.completionSeries} margin={{ left: 4, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="fillCompletion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtDay} />
                <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} />} />
                <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} fill="url(#fillCompletion)" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    ) : undefined,
    breakdowns: summary ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tarefas por status</CardTitle>
            <CardDescription>Distribuição pelas colunas</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.statusBreakdown.length === 0 ? (
              <ChartEmpty message="Nenhuma tarefa ainda" />
            ) : (
              <ChartContainer config={barChartConfig} className="h-[240px] w-full">
                <BarChart data={summary.statusBreakdown} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" dataKey="count" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="status" width={90} tickLine={false} axisLine={false} tickFormatter={truncateLabel} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4}>
                    {summary.statusBreakdown.map((e) => (
                      <Cell key={e.status} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tarefas por responsável</CardTitle>
            <CardDescription>Quem está com mais tarefas</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.assigneeBreakdown.length === 0 ? (
              <ChartEmpty message="Nenhuma tarefa ainda" />
            ) : (
              <ChartContainer config={barChartConfig} className="h-[240px] w-full">
                <BarChart data={summary.assigneeBreakdown} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" dataKey="count" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tickFormatter={truncateLabel} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4}>
                    {summary.assigneeBreakdown.map((e, i) => (
                      <Cell key={e.assigneeId ?? "none"} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tarefas por etiqueta</CardTitle>
            <CardDescription>Distribuição por etiqueta</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.labelBreakdown.length === 0 ? (
              <ChartEmpty message="Nenhuma etiqueta atribuída" />
            ) : (
              <ChartContainer config={barChartConfig} className="h-[240px] w-full">
                <BarChart data={summary.labelBreakdown} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" dataKey="count" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tickFormatter={truncateLabel} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4}>
                    {summary.labelBreakdown.map((e) => (
                      <Cell key={e.labelId} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    ) : undefined,
    projects: (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Projetos</h2>
          <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Projeto</DialogTitle>
                <DialogDescription>Adicione um novo canal ou projeto ao seu workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Projeto</Label>
                  <Input 
                    value={newProject.name} 
                    onChange={e => setNewProject({...newProject, name: e.target.value})} 
                    placeholder="Ex: Canal Principal YouTube"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Projeto</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={newProject.type === "social" ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setNewProject({ ...newProject, type: "social" })}
                    >
                      <Globe className="mr-2 h-4 w-4" /> Social
                    </Button>
                    <Button
                      type="button"
                      variant={newProject.type === "development" ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setNewProject({ ...newProject, type: "development" })}
                    >
                      <Code2 className="mr-2 h-4 w-4" /> Projeto
                    </Button>
                  </div>
                </div>
                {newProject.type === "social" && (
                  <div className="space-y-2">
                    <Label>Plataforma</Label>
                    <Select value={newProject.platform} onValueChange={(v: any) => setNewProject({...newProject, platform: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="twitch">Twitch</SelectItem>
                        <SelectItem value="generic">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={e => setNewProject({...newProject, description: e.target.value})}
                    placeholder="Uma breve descrição do projeto (opcional)"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex gap-2">
                    {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                      <div 
                        key={color}
                        className={`w-8 h-8 rounded cursor-pointer border-2 ${newProject.accentColor === color ? 'border-foreground' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewProject({...newProject, accentColor: color})}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Imagem de Capa</Label>
                  <div
                    className="h-28 w-full rounded-md border border-border overflow-hidden relative flex items-center justify-center"
                    style={{ backgroundColor: newProject.accentColor }}
                  >
                    {newProject.coverImageUrl ? (
                      <img src={newProject.coverImageUrl} alt="capa" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-white/80">Pré-visualização da capa</span>
                    )}
                  </div>
                  <Input
                    value={newProject.coverImageUrl}
                    onChange={e => setNewProject({...newProject, coverImageUrl: e.target.value})}
                    placeholder="Cole uma URL de imagem"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      className="text-xs"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setNewProject(p => ({ ...p, coverImageUrl: reader.result as string }));
                        reader.readAsDataURL(file);
                      }}
                    />
                    {newProject.coverImageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNewProject({...newProject, coverImageUrl: ""})}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateProject} disabled={createProject.isPending || !newProject.name}>Criar Projeto</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Crie seu primeiro projeto para começar a organizar seu conteúdo e tarefas.
            </p>
            <Button className="mt-6" onClick={() => setIsProjectDialogOpen(true)}>
              Criar Primeiro Projeto
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, idx) => (
              <Card
                key={project.id}
                className="overflow-hidden group flex flex-col border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <Link href={`/projects/${project.id}`} className="cursor-pointer">
                  <div
                    className="h-24 w-full relative"
                    style={{ backgroundColor: project.accentColor || 'var(--primary)' }}
                  >
                    {project.coverImageUrl && (
                      <img src={project.coverImageUrl} alt={project.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                    <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-sm">
                      {project.type === "development" ? (
                        <Code2 className="w-5 h-5" />
                      ) : (
                        <PlatformIcon platform={project.platform} className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </Link>
                <CardContent className="p-5 flex flex-col flex-1">
                  <Link href={`/projects/${project.id}`} className="cursor-pointer">
                    <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">{project.name}</h3>
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeAgo(project.lastViewedAt)}</span>
                  </div>
                  {project.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      <span>{project.taskCount - project.completedCount} abertas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{project.completedCount} prontas</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Últimas tarefas
                    </p>
                    {project.recentTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 italic">Nenhuma tarefa ainda</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {project.recentTasks.slice(0, 3).map((task) => (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-muted-foreground'}`} />
                            <span className="truncate">{task.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Link href={`/projects/${project.id}`} className="mt-4">
                    <Button variant="outline" size="sm" className="w-full group/btn">
                      Ver tudo
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    ),
  };

  const visibleOrder = sectionOrder.filter((id) => sectionContent[id] != null);
  const visibleSet = new Set(visibleOrder);

  const moveSection = (id: SectionId, dir: -1 | 1) => {
    setSectionOrder((items) => {
      const idx = items.indexOf(id);
      if (idx < 0) return items;
      let j = idx + dir;
      while (j >= 0 && j < items.length && !visibleSet.has(items[j])) j += dir;
      if (j < 0 || j >= items.length) return items;
      return arrayMove(items, idx, j);
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          {isEditingLayout && canRename ? (
            <div className="flex items-center gap-2">
              <Input
                value={workspaceNameDraft}
                onChange={(e) => setWorkspaceNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveWorkspaceName(false);
                }}
                placeholder="Nome do workspace"
                aria-label="Nome do workspace"
                data-testid="input-workspace-name"
                className="h-10 w-[240px] sm:w-[320px] text-lg font-semibold"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleSaveWorkspaceName(false)}
                disabled={updateWorkspace.isPending || !workspaceNameDraft.trim()}
                aria-label="Salvar nome do workspace"
                data-testid="button-save-workspace-name"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight truncate">
              {activeWorkspace?.name ?? "Dashboard"}
            </h1>
          )}
          <p className="text-muted-foreground">Visão geral do seu espaço de trabalho.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {isEditingLayout ? (
            <>
              <Button variant="ghost" onClick={handleResetLayout}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
              </Button>
              {isOwner && activeWorkspace && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  data-testid="button-delete-workspace"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir workspace
                </Button>
              )}
              <Button onClick={() => handleSaveWorkspaceName(true)} disabled={updateWorkspace.isPending}>
                <Check className="mr-2 h-4 w-4" /> Concluir
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleOpenSettings} data-testid="button-workspace-settings">
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </Button>
          )}

          {isOwner && activeWorkspaceId && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMembersDialogOpen(true)}
              aria-label="Gerenciar membros"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}

          <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Workspace</DialogTitle>
                <DialogDescription>Crie um novo espaço de trabalho para organizar seus projetos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Workspace</Label>
                  <Input 
                    value={newWorkspaceName} 
                    onChange={e => setNewWorkspaceName(e.target.value)} 
                    placeholder="Ex: Agência ACME"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWorkspaceDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateWorkspace} disabled={createWorkspace.isPending}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isEditingLayout && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <GripVertical className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Arraste as seções pelo ícone para reorganizar. Coloque no topo o que é mais importante para você — as mudanças são salvas automaticamente.
          </span>
        </div>
      )}

      {isEditingLayout ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {visibleOrder.map((id, index) => (
                <SortableSection
                  key={id}
                  id={id}
                  label={SECTION_LABELS[id]}
                  index={index}
                  total={visibleOrder.length}
                  onMove={(dir) => moveSection(id, dir)}
                >
                  {sectionContent[id]}
                </SortableSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-8">
          {visibleOrder.map((id) => (
            <div key={id}>{sectionContent[id]}</div>
          ))}
        </div>
      )}

      {activeWorkspaceId && (
        <WorkspaceMembersDialog
          workspaceId={activeWorkspaceId}
          open={isMembersDialogOpen}
          onOpenChange={setIsMembersDialogOpen}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir o workspace "{activeWorkspace?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. TODO o conteúdo deste
              workspace será excluído: projetos, tarefas, notas, mapas mentais,
              assinaturas, formas de pagamento e membros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteWorkspace}
              disabled={deleteWorkspace.isPending}
              data-testid="button-confirm-delete-workspace"
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
