import { useState } from "react";
import {
  useListMindmaps,
  useCreateMindmap,
  useUpdateMindmap,
  useDeleteMindmap,
  getListMindmapsQueryKey,
} from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Network,
  Plus,
  Trash2,
  CornerDownRight,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";

export default function Mindmaps() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { data: mindmaps = [] } = useListMindmaps(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getListMindmapsQueryKey(activeWorkspaceId!),
    },
  });

  const createMindmap = useCreateMindmap();
  const updateMindmap = useUpdateMindmap();
  const deleteMindmap = useDeleteMindmap();

  // Top-level "novo mapa" dialog
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // "Adicionar complementar" dialog
  const [addParent, setAddParent] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [addMode, setAddMode] = useState<"create" | "link">("create");
  const [childName, setChildName] = useState("");
  const [linkId, setLinkId] = useState("");
  const [addError, setAddError] = useState("");

  // Remover complementar (excluir ou desvincular)
  const [removeChild, setRemoveChild] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListMindmapsQueryKey(activeWorkspaceId!),
    });

  if (!activeWorkspaceId)
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapas Mentais</h1>
            <p className="text-muted-foreground">
              Planeje suas ideias visualmente.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground">
          Selecione um workspace no seletor no topo da página.
        </p>
      </div>
    );

  const topLevel = mindmaps.filter((m) => m.parentId === null);
  const childrenOf = (id: number) =>
    mindmaps.filter((m) => m.parentId === id);
  // Elegíveis para vincular: mapas de topo que não são pais (sem complementares).
  const eligibleToLink = mindmaps.filter(
    (m) =>
      m.parentId === null &&
      childrenOf(m.id).length === 0 &&
      (!addParent || m.id !== addParent.id),
  );

  const handleCreate = () => {
    if (!name.trim()) return;
    createMindmap.mutate(
      { workspaceId: activeWorkspaceId, data: { name: name.trim() } },
      {
        onSuccess: () => {
          invalidate();
          setName("");
          setOpen(false);
        },
      },
    );
  };

  const openAdd = (mm: { id: number; name: string }) => {
    setAddParent({ id: mm.id, name: mm.name });
    setAddMode("create");
    setChildName("");
    setLinkId("");
    setAddError("");
  };

  const closeAdd = () => {
    setAddParent(null);
    setAddMode("create");
    setChildName("");
    setLinkId("");
    setAddError("");
  };

  const handleAddCreate = () => {
    if (!addParent || !childName.trim()) return;
    createMindmap.mutate(
      {
        workspaceId: activeWorkspaceId,
        data: { name: childName.trim(), parentId: addParent.id },
      },
      {
        onSuccess: () => {
          invalidate();
          closeAdd();
        },
        onError: () =>
          setAddError("Não foi possível criar o mapa complementar."),
      },
    );
  };

  const handleAddLink = () => {
    if (!addParent || !linkId) return;
    updateMindmap.mutate(
      { mindmapId: Number(linkId), data: { parentId: addParent.id } },
      {
        onSuccess: () => {
          invalidate();
          closeAdd();
        },
        onError: () =>
          setAddError(
            "Não foi possível vincular este mapa. Atualize a página e tente novamente.",
          ),
      },
    );
  };

  const handleUnlinkChild = () => {
    if (!removeChild) return;
    updateMindmap.mutate(
      { mindmapId: removeChild.id, data: { parentId: null } },
      {
        onSuccess: () => {
          invalidate();
          setRemoveChild(null);
        },
      },
    );
  };

  const handleDeleteChild = () => {
    if (!removeChild) return;
    deleteMindmap.mutate(
      { mindmapId: removeChild.id },
      {
        onSuccess: () => {
          invalidate();
          setRemoveChild(null);
        },
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mapas Mentais</h1>
          <p className="text-muted-foreground">
            Planeje suas ideias visualmente.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Mapa Mental
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Mapa Mental</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Nome</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Ex: Estratégia de Conteúdo"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {topLevel.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Network className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhum mapa mental</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Crie um mapa mental para organizar fluxos complexos de conteúdo.
          </p>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            Criar Primeiro Mapa
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {topLevel.map((mm) => {
            const children = childrenOf(mm.id);
            return (
              <Card key={mm.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 shrink-0 bg-muted rounded-full flex items-center justify-center">
                      <Network className="h-5 w-5 text-primary" />
                    </div>
                    <Link
                      href={`/mindmaps/${mm.id}`}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <h3 className="font-semibold truncate">{mm.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {mm.data?.nodes?.length ?? 0} nós
                        {children.length > 0 &&
                          ` · ${children.length} complementar${children.length > 1 ? "es" : ""}`}
                        {" · "}
                        {new Date(mm.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Excluir mapa mental?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. "{mm.name}" será
                            removido permanentemente.
                            {children.length > 0 &&
                              " Os mapas complementares vinculados não serão excluídos, apenas desvinculados."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteMindmap.mutate(
                                { mindmapId: mm.id },
                                { onSuccess: invalidate },
                              )
                            }
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {children.length > 0 && (
                    <div className="border-t bg-muted/30">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-2 pl-6 pr-4 py-2.5 border-b last:border-b-0"
                        >
                          <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <Link
                            href={`/mindmaps/${child.id}`}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <span className="text-sm font-medium truncate block">
                              {child.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {child.data?.nodes?.length ?? 0} nós
                            </span>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setRemoveChild({
                                id: child.id,
                                name: child.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t">
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-none text-muted-foreground h-10 px-6"
                      onClick={() => openAdd(mm)}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Adicionar mapa mental
                      complementar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Adicionar complementar */}
      <Dialog open={!!addParent} onOpenChange={(o) => !o && closeAdd()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar mapa mental complementar</DialogTitle>
            <DialogDescription>
              Vinculado a "{addParent?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant={addMode === "create" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAddMode("create");
                setAddError("");
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Criar novo
            </Button>
            <Button
              variant={addMode === "link" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAddMode("link");
                setAddError("");
              }}
            >
              <Link2 className="mr-2 h-4 w-4" /> Vincular existente
            </Button>
          </div>

          {addMode === "create" ? (
            <div className="space-y-2 py-2">
              <Label>Nome</Label>
              <Input
                autoFocus
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCreate()}
                placeholder="Ex: Sub-tópico"
              />
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Label>Mapa mental</Label>
              {eligibleToLink.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum mapa disponível. Apenas mapas mentais sem vínculos
                  podem ser vinculados.
                </p>
              ) : (
                <Select value={linkId} onValueChange={setLinkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um mapa mental" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleToLink.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {addError && (
            <p className="text-sm text-destructive">{addError}</p>
          )}

          <DialogFooter>
            {addMode === "create" ? (
              <Button
                onClick={handleAddCreate}
                disabled={!childName.trim() || createMindmap.isPending}
              >
                Criar e vincular
              </Button>
            ) : (
              <Button
                onClick={handleAddLink}
                disabled={!linkId || updateMindmap.isPending}
              >
                Vincular
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remover complementar: excluir ou desvincular */}
      <AlertDialog
        open={!!removeChild}
        onOpenChange={(o) => !o && setRemoveChild(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover mapa complementar</AlertDialogTitle>
            <AlertDialogDescription>
              "{removeChild?.name}": deseja excluí-lo permanentemente ou apenas
              desvinculá-lo do mapa mental principal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-between">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleUnlinkChild}
                disabled={updateMindmap.isPending}
              >
                Apenas desvincular
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteChild}
                disabled={deleteMindmap.isPending}
              >
                Excluir
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
