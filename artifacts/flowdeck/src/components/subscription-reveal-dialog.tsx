import { useEffect, useRef, useState } from "react";
import { useRevealSubscriptionCredential, type Subscription } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubscriptionLogo } from "@/components/subscription-logo";
import { brandDisplay } from "@/lib/subscription-brands";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Copy, Lock, ShieldCheck } from "lucide-react";

interface SubscriptionRevealDialogProps {
  subscription: Subscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AUTO_HIDE_MS = 45_000;

export function SubscriptionRevealDialog({
  subscription,
  open,
  onOpenChange,
}: SubscriptionRevealDialogProps) {
  const { toast } = useToast();
  const reveal = useRevealSubscriptionCredential();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ username: string | null; password: string | null } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAll = () => {
    setPassword("");
    setError(null);
    setCredential(null);
    setShowSecret(false);
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    reveal.reset();
  };

  useEffect(() => {
    if (!open) clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!subscription) return null;
  const display = brandDisplay(subscription);

  const handleReveal = () => {
    if (!password.trim()) return;
    setError(null);
    reveal.mutate(
      { subscriptionId: subscription.id, data: { password } },
      {
        onSuccess: (data) => {
          setCredential(data);
          setPassword("");
          hideTimer.current = setTimeout(() => {
            setCredential(null);
            setShowSecret(false);
          }, AUTO_HIDE_MS);
        },
        onError: (err: unknown) => {
          const message =
            (err as { data?: { error?: string } })?.data?.error ??
            "Não foi possível revelar as credenciais.";
          setError(message);
        },
      },
    );
  };

  const copy = async (value: string | null, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <SubscriptionLogo sub={subscription} size={40} />
            <div>
              <DialogTitle>Credenciais de {display.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {credential
                  ? "Copie com cuidado. Serão ocultadas automaticamente."
                  : "Confirme sua senha de acesso para revelar os dados."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!credential ? (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Sua senha de acesso</Label>
              <Input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleReveal()}
                placeholder="Digite a senha da sua conta"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              As credenciais ficam criptografadas no servidor e nunca aparecem em listas.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <CredentialField
              label="Usuário / e-mail"
              value={credential.username}
              reveal
              onCopy={() => copy(credential.username, "Usuário")}
            />
            <CredentialField
              label="Senha"
              value={credential.password}
              reveal={showSecret}
              onToggle={() => setShowSecret((s) => !s)}
              onCopy={() => copy(credential.password, "Senha")}
            />
            <p className="flex items-center gap-2 text-xs text-emerald-500">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Acesso registrado. Ocultando em alguns instantes.
            </p>
          </div>
        )}

        <DialogFooter>
          {!credential ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReveal} disabled={reveal.isPending || !password.trim()}>
                {reveal.isPending ? "Verificando..." : "Revelar"}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialField({
  label,
  value,
  reveal,
  onToggle,
  onCopy,
}: {
  label: string;
  value: string | null;
  reveal: boolean;
  onToggle?: () => void;
  onCopy: () => void;
}) {
  const display = value ?? "";
  const masked = display ? "•".repeat(Math.min(display.length, 16)) : "—";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono truncate">
          {value ? (reveal ? display : masked) : "—"}
        </code>
        {onToggle && (
          <Button variant="outline" size="icon" onClick={onToggle} aria-label="Mostrar/ocultar">
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          disabled={!value}
          aria-label={`Copiar ${label}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
