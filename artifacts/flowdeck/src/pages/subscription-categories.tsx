import { useState } from "react";
import {
  useListWorkspaceCategories,
  useCreateWorkspaceCategory,
  useUpdateWorkspaceCategory,
  useDeleteWorkspaceCategory,
  getListWorkspaceCategoriesQueryKey,
  getGetSubscriptionSummaryQueryKey,
  type WorkspaceCategory,
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
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

export default function SubscriptionCategories() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState<WorkspaceCategory | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<WorkspaceCategory | null>(null);

  const { data: categories = [], isLoading } = useListWorkspaceCategories(
    activeWorkspaceId!,
    {
      query: {
        enabled: !!activeWorkspaceId,
        queryKey: getListWorkspaceCategoriesQueryKey(activeWorkspaceId!),
      },
    },
  );

  const createCategory = useCreateWorkspaceCategory();
  const updateCategory = useUpdateWorkspaceCategory();
  const deleteCategory = useDeleteWorkspaceCategory();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListWorkspaceCategoriesQueryKey(activeWorkspaceId!),
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/workspaces/${activeWorkspaceId}/subscriptions`],
    });
    queryClient.invalidateQueries({
      queryKey: getGetSubscriptionSummaryQueryKey(activeWorkspaceId!),
    });
  };

  if (!activeWorkspaceId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias das assinaturas do workspace.
          </p>
        </div>
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Tags className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Selecione um workspace</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            As categorias de cada workspace são separadas. Escolha um workspace no seletor no
            topo da página.
          </p>
        </Card>
      </div>
    );
  }

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) return;
    createCategory.mutate(
      { workspaceId: activeWorkspaceId, data: { label } },
      {
        onSuccess: () => {
          invalidate();
          setNewLabel("");
          toast({ title: "Categoria criada" });
        },
        onError: (err) =>
          toast({
            title:
              (err as { data?: { error?: string } })?.data?.error ??
              "Não foi possível criar a categoria",
            variant: "destructive",
          }),
      },
    );
  };

  const handleRename = () => {
    if (!renaming) return;
    const label = renameValue.trim();
    if (!label) return;
    updateCategory.mutate(
      { categoryId: renaming.id, data: { label } },
      {
        onSuccess: () => {
          invalidate();
          setRenaming(null);
          toast({ title: "Categoria renomeada" });
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
    deleteCategory.mutate(
      { categoryId: deleting.id },
      {
        onSuccess: () => {
          invalidate();
          setDeleting(null);
          toast({ title: "Categoria removida" });
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
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias das assinaturas do workspace.
          </p>
        </div>
      </div>

      <div className="flex gap-2 max-w-md">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Ex: Educação"
        />
        <Button
          onClick={handleCreate}
          disabled={!newLabel.trim() || createCategory.isPending}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Tags className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{cat.label}</p>
                  <Badge variant="outline" className="mt-1">
                    {cat.subscriptionCount ?? 0}{" "}
                    {(cat.subscriptionCount ?? 0) === 1 ? "assinatura" : "assinaturas"}
                  </Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Renomear ${cat.label}`}
                    onClick={() => {
                      setRenaming(cat);
                      setRenameValue(cat.label);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {cat.key !== "other" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${cat.label}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(cat)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear categoria</DialogTitle>
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
              disabled={!renameValue.trim() || updateCategory.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (deleting.subscriptionCount ?? 0) > 0
                ? `"${deleting.label}" está em uso por ${deleting.subscriptionCount} assinatura(s). Elas serão movidas para a categoria "Outros".`
                : `"${deleting?.label}" será removida permanentemente.`}
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
