import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type UnsavedGuardHandler = {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
};

type UnsavedGuardValue = {
  register: (handler: UnsavedGuardHandler | null) => void;
  /**
   * Navega respeitando alterações não salvas. `beforeNavigate` (opcional) roda
   * imediatamente antes da navegação efetiva — e NÃO roda se o usuário
   * cancelar o diálogo — útil para efeitos colaterais atrelados à saída
   * (ex.: trocar o workspace ativo).
   */
  guardedNavigate: (to: string, beforeNavigate?: () => void) => void;
};

const UnsavedGuardContext = createContext<UnsavedGuardValue | null>(null);

export function useUnsavedGuard(): UnsavedGuardValue {
  const ctx = useContext(UnsavedGuardContext);
  if (!ctx) {
    throw new Error("useUnsavedGuard must be used within UnsavedGuardProvider");
  }
  return ctx;
}

export function UnsavedGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [, setLocation] = useLocation();
  const handlerRef = useRef<UnsavedGuardHandler | null>(null);
  const beforeNavigateRef = useRef<(() => void) | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const register = useCallback((handler: UnsavedGuardHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const navigateNow = useCallback(
    (to: string) => {
      const before = beforeNavigateRef.current;
      beforeNavigateRef.current = null;
      before?.();
      setLocation(to);
    },
    [setLocation],
  );

  const guardedNavigate = useCallback(
    (to: string, beforeNavigate?: () => void) => {
      const handler = handlerRef.current;
      beforeNavigateRef.current = beforeNavigate ?? null;
      if (handler && handler.isDirty()) {
        setPending(to);
      } else {
        navigateNow(to);
      }
    },
    [navigateNow],
  );

  const closeDialog = useCallback(() => {
    if (!saving) {
      beforeNavigateRef.current = null;
      setPending(null);
    }
  }, [saving]);

  const handleSave = useCallback(async () => {
    const handler = handlerRef.current;
    if (!handler || pending == null) return;
    setSaving(true);
    try {
      await handler.save();
      const to = pending;
      setPending(null);
      navigateNow(to);
    } catch {
      /* keep dialog open so the user can retry or discard */
    } finally {
      setSaving(false);
    }
  }, [pending, navigateNow]);

  const handleDiscard = useCallback(() => {
    if (pending == null) return;
    handlerRef.current?.discard();
    const to = pending;
    setPending(null);
    navigateNow(to);
  }, [pending, navigateNow]);

  return (
    <UnsavedGuardContext.Provider value={{ register, guardedNavigate }}>
      {children}
      <AlertDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez alterações que ainda não foram salvas. Deseja salvar antes
              de sair ou descartar as alterações?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleDiscard}
              disabled={saving}
            >
              Descartar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar e sair"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedGuardContext.Provider>
  );
}
