import { useMemo, useState } from "react";
import {
  useListSubscriptions,
  useGetSubscriptionSummary,
  useMarkSubscriptionPaid,
  useDeleteSubscription,
  useListWorkspaceCategories,
  getListSubscriptionsQueryKey,
  getGetSubscriptionSummaryQueryKey,
  getListWorkspaceCategoriesQueryKey,
  type Subscription,
} from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SubscriptionLogo } from "@/components/subscription-logo";
import { SubscriptionFormDialog } from "@/components/subscription-form-dialog";
import { SubscriptionRevealDialog } from "@/components/subscription-reveal-dialog";
import { BILLING_CYCLE_LABELS, brandDisplay } from "@/lib/subscription-brands";
import { useToast } from "@/hooks/use-toast";
import { parseDueDate, startOfToday } from "@/lib/date";
import {
  Plus,
  Search,
  CreditCard,
  MoreVertical,
  Pencil,
  Trash2,
  KeyRound,
  CheckCircle2,
  Link2,
  Wallet,
} from "lucide-react";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function daysUntil(dateStr: string): number {
  const due = parseDueDate(dateStr);
  const today = startOfToday();
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

interface DueMeta {
  label: string;
  className: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}

function dueMeta(sub: Subscription): DueMeta {
  const d = daysUntil(sub.nextDueDate);
  if (sub.status === "cancelled")
    return { label: "Cancelada", className: "text-muted-foreground", badgeVariant: "outline" };
  if (sub.status === "paused")
    return { label: "Pausada", className: "text-muted-foreground", badgeVariant: "outline" };
  if (d < 0)
    return { label: `Venceu há ${Math.abs(d)}d`, className: "text-destructive", badgeVariant: "destructive" };
  if (d === 0) return { label: "Vence hoje", className: "text-destructive", badgeVariant: "destructive" };
  if (d <= sub.reminderDaysBefore)
    return { label: `Vence em ${d}d`, className: "text-amber-500", badgeVariant: "secondary" };
  return { label: `Vence em ${d}d`, className: "text-muted-foreground", badgeVariant: "outline" };
}

export default function Subscriptions() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [revealSub, setRevealSub] = useState<Subscription | null>(null);
  const [deleteSub, setDeleteSub] = useState<Subscription | null>(null);

  const params = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(category !== "all" ? { category } : {}),
      ...(status !== "all" ? { status } : {}),
    }),
    [search, category, status],
  );

  const { data: subscriptions = [], isLoading } = useListSubscriptions(activeWorkspaceId!, params, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getListSubscriptionsQueryKey(activeWorkspaceId!, params),
    },
  });

  const { data: summary } = useGetSubscriptionSummary(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getGetSubscriptionSummaryQueryKey(activeWorkspaceId!),
    },
  });

  const { data: workspaceCategories = [] } = useListWorkspaceCategories(
    activeWorkspaceId!,
    {
      query: {
        enabled: !!activeWorkspaceId,
        queryKey: getListWorkspaceCategoriesQueryKey(activeWorkspaceId!),
      },
    },
  );

  const categoryLabel = useMemo(() => {
    const map = new Map(workspaceCategories.map((c) => [c.key, c.label]));
    return (key: string) => map.get(key) ?? key;
  }, [workspaceCategories]);

  const markPaid = useMarkSubscriptionPaid();
  const removeSubscription = useDeleteSubscription();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${activeWorkspaceId}/subscriptions`] });
    queryClient.invalidateQueries({
      queryKey: getGetSubscriptionSummaryQueryKey(activeWorkspaceId!),
    });
  };

  if (!activeWorkspaceId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie serviços, renovações e credenciais do workspace.
          </p>
        </div>
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Selecione um workspace</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            As assinaturas de cada workspace são separadas. Escolha um workspace no seletor no
            topo da página. Se você ainda não tem um, crie um no Dashboard.
          </p>
        </Card>
      </div>
    );
  }

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (sub: Subscription) => {
    setEditing(sub);
    setFormOpen(true);
  };

  const handleMarkPaid = (sub: Subscription) => {
    markPaid.mutate(
      { subscriptionId: sub.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: `${brandDisplay(sub).name} marcada como paga` });
        },
        onError: () => toast({ title: "Não foi possível marcar como paga", variant: "destructive" }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteSub) return;
    removeSubscription.mutate(
      { subscriptionId: deleteSub.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Assinatura removida" });
          setDeleteSub(null);
        },
        onError: () => toast({ title: "Não foi possível remover", variant: "destructive" }),
      },
    );
  };

  const monthly = summary?.monthlyByCurrency ?? [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie serviços, renovações e credenciais do workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" /> Nova Assinatura
          </Button>
        </div>
      </div>

      {/* Resumo de gastos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {monthly.length === 0 ? (
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gasto mensal</p>
                <p className="text-xl font-bold">—</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          monthly.map((m) => (
            <Card key={m.currency}>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gasto mensal ({m.currency})</p>
                  <p className="text-xl font-bold">{formatMoney(m.amountCents, m.currency)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativas</p>
              <p className="text-xl font-bold">
                {subscriptions.filter((s) => s.status === "active").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar assinatura..."
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {workspaceCategories.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : subscriptions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhuma assinatura</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Cadastre os serviços do workspace para acompanhar renovações e gastos.
          </p>
          <Button className="mt-6" onClick={handleNew}>
            Adicionar Assinatura
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((sub) => {
            const meta = dueMeta(sub);
            const display = brandDisplay(sub);
            return (
              <Card key={sub.id} className="group relative hover:border-primary/50 transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <SubscriptionLogo sub={sub} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{display.name}</h3>
                        {sub.hasCredential && (
                          <KeyRound className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabel(sub.category)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {BILLING_CYCLE_LABELS[sub.billingCycle]}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground shrink-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMarkPaid(sub)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como paga
                        </DropdownMenuItem>
                        {sub.hasCredential && (
                          <DropdownMenuItem onClick={() => setRevealSub(sub)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Ver credenciais
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(sub)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteSub(sub)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {formatMoney(sub.amountCents, sub.currency)}
                      </p>
                      <p className={`text-sm font-medium ${meta.className}`}>{meta.label}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-1">
                      <p>{parseDueDate(sub.nextDueDate).toLocaleDateString("pt-BR")}</p>
                      {sub.paymentMethodName && (
                        <p className="flex items-center justify-end gap-1">
                          <CreditCard className="h-3 w-3" /> {sub.paymentMethodName}
                        </p>
                      )}
                      {sub.linkedTaskCount > 0 && (
                        <p className="flex items-center justify-end gap-1">
                          <Link2 className="h-3 w-3" /> {sub.linkedTaskCount} tarefa
                          {sub.linkedTaskCount > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleMarkPaid(sub)}
                      disabled={markPaid.isPending}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Pagar
                    </Button>
                    {sub.hasCredential && (
                      <Button variant="outline" size="sm" onClick={() => setRevealSub(sub)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SubscriptionFormDialog
        workspaceId={activeWorkspaceId}
        open={formOpen}
        onOpenChange={setFormOpen}
        subscription={editing}
        onSaved={invalidateAll}
      />

      <SubscriptionRevealDialog
        subscription={revealSub}
        open={!!revealSub}
        onOpenChange={(o) => !o && setRevealSub(null)}
      />

      <AlertDialog open={!!deleteSub} onOpenChange={(o) => !o && setDeleteSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. "{deleteSub ? brandDisplay(deleteSub).name : ""}" e
              seu histórico serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
