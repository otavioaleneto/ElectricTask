import { useState } from "react";
import {
  useListPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  getListPaymentMethodsQueryKey,
  type PaymentMethod,
} from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";

export default function PaymentMethods() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<PaymentMethod | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);

  const { data: methods = [], isLoading } = useListPaymentMethods(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getListPaymentMethodsQueryKey(activeWorkspaceId!),
    },
  });

  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListPaymentMethodsQueryKey(activeWorkspaceId!),
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/workspaces/${activeWorkspaceId}/subscriptions`],
    });
  };

  if (!activeWorkspaceId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formas de pagamento</h1>
          <p className="text-muted-foreground">
            Gerencie as formas de pagamento usadas nas assinaturas.
          </p>
        </div>
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Selecione um workspace</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            As formas de pagamento de cada workspace são separadas. Escolha um workspace no
            seletor no topo da página.
          </p>
        </Card>
      </div>
    );
  }

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createMethod.mutate(
      { workspaceId: activeWorkspaceId, data: { name } },
      {
        onSuccess: () => {
          invalidate();
          setNewName("");
          toast({ title: "Forma de pagamento adicionada" });
        },
        onError: (err) =>
          toast({
            title:
              (err as { data?: { error?: string } })?.data?.error ??
              "Não foi possível adicionar",
            variant: "destructive",
          }),
      },
    );
  };

  const handleRename = () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    updateMethod.mutate(
      { paymentMethodId: renaming.id, data: { name } },
      {
        onSuccess: () => {
          invalidate();
          setRenaming(null);
          toast({ title: "Forma de pagamento renomeada" });
        },
        onError: (err) =>
          toast({
            title:
              (err as { data?: { error?: string } })?.data?.error ??
              "Não foi possível renomear",
            variant: "destructive",
          }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMethod.mutate(
      { paymentMethodId: deleting.id },
      {
        onSuccess: () => {
          invalidate();
          setDeleting(null);
          toast({ title: "Forma de pagamento removida" });
        },
        onError: (err) =>
          toast({
            title:
              (err as { data?: { error?: string } })?.data?.error ??
              "Não foi possível remover",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formas de pagamento</h1>
          <p className="text-muted-foreground">
            Gerencie as formas de pagamento usadas nas assinaturas.
          </p>
        </div>
      </div>

      <div className="flex gap-2 max-w-md">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Ex: Cartão Nubank"
        />
        <Button
          onClick={handleCreate}
          disabled={!newName.trim() || createMethod.isPending}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : methods.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhuma forma de pagamento</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Adicione uma forma de pagamento para vinculá-la às suas assinaturas.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {methods.map((pm) => (
            <Card key={pm.id}>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pm.name}</p>
                  <Badge variant="outline" className="mt-1">
                    {pm.subscriptionCount ?? 0}{" "}
                    {(pm.subscriptionCount ?? 0) === 1 ? "assinatura" : "assinaturas"}
                  </Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Renomear ${pm.name}`}
                    onClick={() => {
                      setRenaming(pm);
                      setRenameValue(pm.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${pm.name}`}
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(pm)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear forma de pagamento</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || updateMethod.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (deleting.subscriptionCount ?? 0) > 0
                ? `"${deleting.name}" está em uso por ${deleting.subscriptionCount} assinatura(s). Elas continuarão funcionando, mas ficarão sem forma de pagamento.`
                : `"${deleting?.name}" será removida permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
