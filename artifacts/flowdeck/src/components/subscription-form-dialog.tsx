import { useEffect, useMemo, useState } from "react";
import {
  useCreateSubscription,
  useUpdateSubscription,
  useListPaymentMethods,
  useCreatePaymentMethod,
  useListWorkspaceCategories,
  getListPaymentMethodsQueryKey,
  getListWorkspaceCategoriesQueryKey,
  type Subscription,
  type CreateSubscriptionBody,
  type UpdateSubscriptionBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SubscriptionLogo } from "@/components/subscription-logo";
import {
  SUBSCRIPTION_BRANDS,
  BRAND_BY_SLUG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  BILLING_CYCLE_LABELS,
  brandDisplay,
} from "@/lib/subscription-brands";
import { useToast } from "@/hooks/use-toast";
import { ChevronsUpDown, Plus, Check, X } from "lucide-react";

interface SubscriptionFormDialogProps {
  workspaceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: Subscription | null;
  onSaved?: () => void;
}

const CYCLE_VALUES = ["monthly", "yearly", "weekly", "quarterly", "custom"] as const;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function inputToCents(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function SubscriptionFormDialog({
  workspaceId,
  open,
  onOpenChange,
  subscription,
  onSaved,
}: SubscriptionFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!subscription;

  const { data: paymentMethods = [] } = useListPaymentMethods(workspaceId, {
    query: {
      enabled: open,
      queryKey: getListPaymentMethodsQueryKey(workspaceId),
    },
  });
  const { data: categories = [] } = useListWorkspaceCategories(workspaceId, {
    query: {
      enabled: open,
      queryKey: getListWorkspaceCategoriesQueryKey(workspaceId),
    },
  });
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();
  const createPaymentMethod = useCreatePaymentMethod();

  const [mode, setMode] = useState<"brand" | "custom">("brand");
  const [companySlug, setCompanySlug] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#6366F1");
  const [category, setCategory] = useState<string>("streaming");
  const [amount, setAmount] = useState("0.00");
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
  const [billingCycle, setBillingCycle] = useState<string>("monthly");
  const [customCycleDays, setCustomCycleDays] = useState("30");
  const [nextDueDate, setNextDueDate] = useState("");
  const [reminderDaysBefore, setReminderDaysBefore] = useState("7");
  const [paymentType, setPaymentType] = useState<"automatic" | "manual">("automatic");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
  const [status, setStatus] = useState<"active" | "paused" | "cancelled">("active");
  const [website, setWebsite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [showNewMethod, setShowNewMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBrandPickerOpen(false);
    setNewMethodName("");
    setShowNewMethod(false);
    setUsername("");
    setPassword("");
    if (subscription) {
      const known = subscription.companySlug && BRAND_BY_SLUG[subscription.companySlug];
      setMode(known ? "brand" : "custom");
      setCompanySlug(subscription.companySlug ?? "");
      setCustomName(subscription.customName ?? "");
      setCustomColor(subscription.customColor ?? "#6366F1");
      setCategory(subscription.category);
      setAmount(centsToInput(subscription.amountCents));
      setCurrency(subscription.currency);
      setBillingCycle(subscription.billingCycle);
      setCustomCycleDays(String(subscription.customCycleDays ?? 30));
      setNextDueDate(subscription.nextDueDate.slice(0, 10));
      setReminderDaysBefore(String(subscription.reminderDaysBefore));
      setPaymentType(subscription.paymentType);
      setPaymentMethodId(subscription.paymentMethodId ? String(subscription.paymentMethodId) : "none");
      setStatus(subscription.status);
      setWebsite(subscription.website ?? "");
      setNotes(subscription.notes ?? "");
    } else {
      setMode("brand");
      setCompanySlug("");
      setCustomName("");
      setCustomColor("#6366F1");
      setCategory("streaming");
      setAmount("0.00");
      setCurrency("BRL");
      setBillingCycle("monthly");
      setCustomCycleDays("30");
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setNextDueDate(d.toISOString().slice(0, 10));
      setReminderDaysBefore("7");
      setPaymentType("automatic");
      setPaymentMethodId("none");
      setStatus("active");
      setWebsite("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      brands: SUBSCRIPTION_BRANDS.filter((b) => b.category === cat),
    })).filter((g) => g.brands.length > 0);
  }, []);

  const categoryOptions = useMemo(() => {
    const options =
      categories.length > 0
        ? categories.map((c) => ({ value: c.key, label: c.label }))
        : CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
    if (category && !options.some((o) => o.value === category)) {
      options.push({ value: category, label: category });
    }
    return options;
  }, [categories, category]);

  const selectedPreview =
    mode === "brand" && companySlug
      ? brandDisplay({ companySlug })
      : mode === "custom" && customName
        ? brandDisplay({ customName, customColor })
        : null;

  const handleSelectBrand = (slug: string) => {
    const brand = BRAND_BY_SLUG[slug];
    setMode("brand");
    setCompanySlug(slug);
    if (brand) {
      const existsInWorkspace =
        categories.length === 0 || categories.some((c) => c.key === brand.category);
      setCategory(existsInWorkspace ? brand.category : "other");
    }
    setBrandPickerOpen(false);
  };

  const handleSelectCustom = () => {
    setMode("custom");
    setCompanySlug("");
    setCategory("other");
    setBrandPickerOpen(false);
  };

  const handleAddPaymentMethod = () => {
    const name = newMethodName.trim();
    if (!name) return;
    createPaymentMethod.mutate(
      { workspaceId, data: { name } },
      {
        onSuccess: (pm) => {
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey(workspaceId) });
          setPaymentMethodId(String(pm.id));
          setNewMethodName("");
          setShowNewMethod(false);
          toast({ title: "Forma de pagamento adicionada" });
        },
        onError: () => toast({ title: "Não foi possível adicionar", variant: "destructive" }),
      },
    );
  };

  const validate = (): string | null => {
    if (mode === "brand" && !companySlug) return "Selecione um serviço.";
    if (mode === "custom" && !customName.trim()) return "Informe o nome do serviço.";
    if (!nextDueDate) return "Informe a próxima data de vencimento.";
    if (inputToCents(amount) <= 0) return "Informe um valor válido.";
    return null;
  };

  const buildBody = (): CreateSubscriptionBody => {
    const body: CreateSubscriptionBody = {
      companySlug: mode === "brand" ? companySlug : null,
      customName: mode === "custom" ? customName.trim() : null,
      customColor: mode === "custom" ? customColor : null,
      category,
      amountCents: inputToCents(amount),
      currency,
      billingCycle: billingCycle as CreateSubscriptionBody["billingCycle"],
      customCycleDays: billingCycle === "custom" ? Number(customCycleDays) || 30 : null,
      nextDueDate,
      reminderDaysBefore: Number(reminderDaysBefore) || 0,
      paymentType,
      paymentMethodId: paymentMethodId === "none" ? null : Number(paymentMethodId),
      status,
      website: website.trim() || null,
      notes: notes.trim() || null,
    };
    if (username.trim()) body.username = username.trim();
    if (password) body.password = password;
    return body;
  };

  const handleSave = () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    const onError = (err: unknown) => {
      const message =
        (err as { data?: { error?: string } })?.data?.error ??
        "Não foi possível salvar a assinatura.";
      setError(message);
    };

    if (isEdit && subscription) {
      updateSubscription.mutate(
        { subscriptionId: subscription.id, data: buildBody() as UpdateSubscriptionBody },
        {
          onSuccess: () => {
            toast({ title: "Assinatura atualizada" });
            onOpenChange(false);
            onSaved?.();
          },
          onError,
        },
      );
    } else {
      createSubscription.mutate(
        { workspaceId, data: buildBody() },
        {
          onSuccess: () => {
            toast({ title: "Assinatura criada" });
            onOpenChange(false);
            onSaved?.();
          },
          onError,
        },
      );
    }
  };

  const isSaving = createSubscription.isPending || updateSubscription.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {/* Serviço */}
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Popover open={brandPickerOpen} onOpenChange={setBrandPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {selectedPreview ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <SubscriptionLogo
                          sub={
                            mode === "brand"
                              ? { companySlug }
                              : { customName, customColor }
                          }
                          size={22}
                        />
                        <span className="truncate">{selectedPreview.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecionar serviço</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar serviço..." />
                    <CommandList>
                      <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__custom__ personalizado outro" onSelect={handleSelectCustom}>
                          <Plus className="mr-2 h-4 w-4" />
                          Serviço personalizado
                        </CommandItem>
                      </CommandGroup>
                      {grouped.map((g) => (
                        <CommandGroup key={g.category} heading={CATEGORY_LABELS[g.category]}>
                          {g.brands.map((b) => (
                            <CommandItem
                              key={b.slug}
                              value={`${b.name} ${b.slug}`}
                              onSelect={() => handleSelectBrand(b.slug)}
                            >
                              <SubscriptionLogo sub={{ companySlug: b.slug }} size={20} className="mr-2" />
                              {b.name}
                              {mode === "brand" && companySlug === b.slug && (
                                <Check className="ml-auto h-4 w-4" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {mode === "custom" && (
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <Label>Nome do serviço</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex: Provedor local"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-10 w-16 p-1"
                  />
                </div>
              </div>
            )}

            {/* Categoria + valor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as "BRL" | "USD")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD (US$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ciclo + vencimento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CYCLE_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {BILLING_CYCLE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {billingCycle === "custom" ? (
                <div className="space-y-2">
                  <Label>Dias do ciclo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={customCycleDays}
                    onChange={(e) => setCustomCycleDays(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Lembrete (dias antes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Próximo vencimento</Label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>
            </div>

            {billingCycle === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Lembrete (dias antes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de pagamento</Label>
                <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "automatic" | "manual")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automático</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <div className="flex items-center gap-2">
                  <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={String(pm.id)}>
                          {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={showNewMethod ? "Cancelar nova forma de pagamento" : "Nova forma de pagamento"}
                    title={showNewMethod ? "Cancelar" : "Nova forma de pagamento"}
                    onClick={() => {
                      setShowNewMethod((v) => !v);
                      setNewMethodName("");
                    }}
                  >
                    {showNewMethod ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {showNewMethod && (
              <div className="flex items-end gap-2">
                <div className="space-y-2 flex-1">
                  <Label className="text-xs text-muted-foreground">Nova forma de pagamento</Label>
                  <Input
                    autoFocus
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPaymentMethod();
                      }
                    }}
                    placeholder="Ex: Cartão Nubank"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddPaymentMethod}
                  disabled={!newMethodName.trim() || createPaymentMethod.isPending}
                >
                  Adicionar
                </Button>
              </div>
            )}

            {isEdit && (
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "active" | "paused" | "cancelled")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Site (opcional)</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>

            {/* Credenciais */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">Credenciais (opcional)</p>
              <p className="text-xs text-muted-foreground">
                Armazenadas com criptografia. {isEdit && "Deixe em branco para manter as atuais."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Usuário / e-mail</Label>
                  <Input
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isEdit && subscription?.hasCredential ? "••••••" : "login da conta"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit && subscription?.hasCredential ? "••••••" : "senha da conta"}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes do plano, observações..."
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
