import { useState } from "react";
import {
  useListNotes,
  useCreateNote,
  useDeleteNote,
  getListNotesQueryKey,
} from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";

export default function Notes() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: notes = [] } = useListNotes(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getListNotesQueryKey(activeWorkspaceId!),
    },
  });

  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListNotesQueryKey(activeWorkspaceId!),
    });

  if (!activeWorkspaceId)
    return <div className="p-8">Selecione um workspace primeiro.</div>;

  const handleCreate = () => {
    if (!title.trim()) return;
    createNote.mutate(
      { workspaceId: activeWorkspaceId, data: { title: title.trim() } },
      {
        onSuccess: (detail) => {
          invalidate();
          setTitle("");
          setOpen(false);
          setLocation(`/notes/${detail.note.id}`);
        },
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notas</h1>
          <p className="text-muted-foreground">
            Escreva e conecte ideias com links [[título]].
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova Nota
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Nota</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Título</Label>
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Ex: Ideias para campanha"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createNote.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {notes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhuma nota</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Crie uma nota para registrar e conectar suas ideias.
          </p>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            Criar Primeira Nota
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="group relative hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
            >
              <Link href={`/notes/${note.id}`}>
                <CardContent className="p-6 space-y-3 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      {note.isLocked ? (
                        <Lock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate">
                      {note.title}
                    </h3>
                  </div>
                  {note.isLocked ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground min-h-[2.5rem]">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      Nota protegida
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {note.excerpt || "Nota vazia"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. "{note.title}" será
                      removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        deleteNote.mutate(
                          { noteId: note.id },
                          { onSuccess: invalidate },
                        )
                      }
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
