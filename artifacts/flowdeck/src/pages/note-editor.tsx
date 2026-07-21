import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetNote,
  useUpdateNote,
  useDeleteNote,
  useListMentionables,
  getGetNoteQueryKey,
  getListNotesQueryKey,
  getListMentionablesQueryKey,
} from "@workspace/api-client-react";
import type { ItemRef } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  Save,
  Trash2,
  FileText,
  Network,
  CheckSquare,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { encryptNoteContent, decryptNoteContent } from "@/lib/note-lock";

function getActiveMention(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const upto = value.slice(0, caret);
  const open = upto.lastIndexOf("[[");
  if (open === -1) return null;
  const between = upto.slice(open + 2);
  if (
    between.includes("]]") ||
    between.includes("\n") ||
    between.includes("[[")
  )
    return null;
  return { query: between, start: open + 2 };
}

const typeIcon = (type: ItemRef["type"]) => {
  if (type === "note") return <FileText className="h-4 w-4 text-blue-500" />;
  if (type === "mindmap") return <Network className="h-4 w-4 text-violet-500" />;
  return <CheckSquare className="h-4 w-4 text-emerald-500" />;
};

const typeLabel = (type: ItemRef["type"]) =>
  type === "note" ? "Nota" : type === "mindmap" ? "Mapa Mental" : "Tarefa";

export default function NoteEditor() {
  const { noteId } = useParams();
  const id = parseInt(noteId || "0", 10);
  // Remount the editor whenever the note changes so no per-note state
  // (decrypted content, password, open dialogs) can leak across notes.
  return <NoteEditorInner key={id} id={id} />;
}

function NoteEditorInner({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: detail, isLoading } = useGetNote(id, {
    query: { enabled: !!id, queryKey: getGetNoteQueryKey(id) },
  });
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mention, setMention] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Lock state
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockPending, setUnlockPending] = useState(false);

  // Lock dialog
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockPending, setLockPending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const loadedIdRef = useRef<number | null>(null);

  const workspaceId = detail?.note.workspaceId ?? null;

  useLayoutEffect(() => {
    if (!detail) return;
    const isNewNote = loadedIdRef.current !== detail.note.id;
    if (isNewNote) {
      // First load of this note. Seed all per-note state from the server and
      // ensure a locked note starts gated (no plaintext/password carried in).
      loadedIdRef.current = detail.note.id;
      setTitle(detail.note.title);
      setLocked(detail.note.isLocked);
      setDirty(false);
      setPassword("");
      setUnlockInput("");
      setUnlockError("");
      setUnlockPending(false);
      setLockDialogOpen(false);
      setPw1("");
      setPw2("");
      setLockError("");
      setLockPending(false);
      setMention(null);
      if (detail.note.isLocked) {
        setContent("");
        setUnlocked(false);
      } else {
        setContent(detail.note.content);
        setUnlocked(true);
      }
      return;
    }
    // Same note refetched (e.g. after a save): sync only when the user has no
    // pending edits, and never re-lock a note the user already unlocked.
    if (!dirtyRef.current) {
      setTitle(detail.note.title);
      setLocked(detail.note.isLocked);
      if (!detail.note.isLocked) {
        setContent(detail.note.content);
        setUnlocked(true);
      }
    }
  }, [detail]);

  const { data: mentionables = [] } = useListMentionables(
    workspaceId!,
    { q: mention?.query ?? "" },
    {
      query: {
        enabled: !!mention && !!workspaceId,
        queryKey: getListMentionablesQueryKey(workspaceId!, {
          q: mention?.query ?? "",
        }),
      },
    },
  );
  const suggestions = mentionables.slice(0, 8);

  useEffect(() => {
    setActiveIdx(0);
  }, [mention?.query]);

  const recomputeMention = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    setMention(getActiveMention(ta.value, caret));
  };

  const onContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    setDirty(true);
    const caret = e.target.selectionStart ?? value.length;
    setMention(getActiveMention(value, caret));
  };

  const applyMention = (selected: string) => {
    if (!mention) return;
    const ta = textareaRef.current;
    if (!ta) return;
    let end = mention.start;
    while (
      end < content.length &&
      content[end] !== "]" &&
      content[end] !== "\n" &&
      content[end] !== "["
    )
      end++;
    const before = content.slice(0, mention.start);
    let after = content.slice(end);
    if (after.startsWith("]]")) after = after.slice(2);
    const insert = `${selected}]]`;
    const newValue = before + insert + after;
    setContent(newValue);
    setDirty(true);
    setMention(null);
    const newCaret = before.length + insert.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      applyMention(suggestions[activeIdx].title);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  };

  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(id) });
    if (workspaceId)
      queryClient.invalidateQueries({
        queryKey: getListNotesQueryKey(workspaceId),
      });
  }, [id, workspaceId, queryClient]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    const targetId = id;
    let payloadContent = content;
    if (locked) {
      if (!password) return;
      payloadContent = await encryptNoteContent(content, password);
    }
    // The user may have navigated to another note while encrypting.
    if (loadedIdRef.current !== targetId) return;
    updateNote.mutate(
      {
        noteId: targetId,
        data: { title: title.trim(), content: payloadContent, isLocked: locked },
      },
      {
        onSuccess: () => {
          if (loadedIdRef.current !== targetId) return;
          setDirty(false);
          invalidateLists();
        },
      },
    );
  }, [id, title, content, locked, password, updateNote, invalidateLists]);

  const handleUnlock = async () => {
    if (!detail || !unlockInput) return;
    const targetId = detail.note.id;
    setUnlockPending(true);
    try {
      const plain = await decryptNoteContent(detail.note.content, unlockInput);
      // Ignore a stale unlock if the user navigated to another note mid-decrypt.
      if (loadedIdRef.current !== targetId) return;
      setContent(plain);
      setPassword(unlockInput);
      setUnlocked(true);
      setUnlockError("");
      setUnlockInput("");
    } catch {
      if (loadedIdRef.current === targetId) setUnlockError("Senha incorreta.");
    } finally {
      if (loadedIdRef.current === targetId) setUnlockPending(false);
    }
  };

  const handleConfirmLock = async () => {
    if (!title.trim()) {
      setLockError("Dê um título à nota antes de protegê-la.");
      return;
    }
    if (!pw1) {
      setLockError("Digite uma senha.");
      return;
    }
    if (pw1 !== pw2) {
      setLockError("As senhas não coincidem.");
      return;
    }
    const targetId = id;
    setLockPending(true);
    try {
      const cipher = await encryptNoteContent(content, pw1);
      // The user may have navigated to another note while encrypting.
      if (loadedIdRef.current !== targetId) {
        setLockPending(false);
        return;
      }
      updateNote.mutate(
        {
          noteId: targetId,
          data: { title: title.trim(), content: cipher, isLocked: true },
        },
        {
          onSuccess: () => {
            if (loadedIdRef.current !== targetId) return;
            setLocked(true);
            setUnlocked(true);
            setPassword(pw1);
            setDirty(false);
            setLockDialogOpen(false);
            setPw1("");
            setPw2("");
            setLockError("");
            invalidateLists();
          },
          onSettled: () => setLockPending(false),
        },
      );
    } catch {
      if (loadedIdRef.current === targetId) {
        setLockError("Não foi possível proteger a nota.");
        setLockPending(false);
      }
    }
  };

  const handleRemoveLock = () => {
    if (!title.trim()) return;
    const targetId = id;
    updateNote.mutate(
      {
        noteId: targetId,
        data: { title: title.trim(), content, isLocked: false },
      },
      {
        onSuccess: () => {
          if (loadedIdRef.current !== targetId) return;
          setLocked(false);
          setPassword("");
          setDirty(false);
          invalidateLists();
        },
      },
    );
  };

  const navTo = (ref: ItemRef) => {
    if (ref.type === "note") setLocation(`/notes/${ref.id}`);
    else if (ref.type === "mindmap") setLocation(`/mindmaps/${ref.id}`);
    else if (ref.type === "task" && ref.projectId != null)
      setLocation(`/projects/${ref.projectId}?task=${ref.id}`);
  };

  if (isLoading) return <div className="p-8">Carregando nota...</div>;
  if (!detail) return <div className="p-8">Nota não encontrada</div>;

  const showGate = locked && !unlocked;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              Editar Nota
              {locked && <Lock className="h-5 w-5 text-amber-500" />}
            </h1>
            <p className="text-sm text-muted-foreground">
              Use [[ para vincular notas, mapas mentais ou tarefas.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {locked && unlocked && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Unlock className="mr-2 h-4 w-4" /> Remover proteção
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover proteção?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O conteúdo desta nota deixará de exigir senha e ficará
                    visível para todos os membros do workspace.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemoveLock}>
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!locked && (
            <Button
              variant="outline"
              onClick={() => {
                setPw1("");
                setPw2("");
                setLockError("");
                setLockDialogOpen(true);
              }}
            >
              <Lock className="mr-2 h-4 w-4" /> Proteger com senha
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    deleteNote.mutate(
                      { noteId: id },
                      {
                        onSuccess: () => {
                          if (workspaceId)
                            queryClient.invalidateQueries({
                              queryKey: getListNotesQueryKey(workspaceId),
                            });
                          setLocation("/notes");
                        },
                      },
                    )
                  }
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!showGate && (
            <Button
              onClick={handleSave}
              disabled={!dirty || updateNote.isPending || !title.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              {dirty ? "Salvar" : "Salvo"}
            </Button>
          )}
        </div>
      </div>

      {showGate ? (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <Lock className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold">{detail.note.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta nota está protegida. Digite a senha para abrir.
          </p>
          <div className="mt-6 space-y-3 text-left">
            <Input
              type="password"
              autoFocus
              value={unlockInput}
              onChange={(e) => {
                setUnlockInput(e.target.value);
                setUnlockError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Senha da nota"
            />
            {unlockError && (
              <p className="text-sm text-destructive">{unlockError}</p>
            )}
            <Button
              className="w-full"
              onClick={handleUnlock}
              disabled={!unlockInput || unlockPending}
            >
              Abrir
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder="Título da nota"
              className="text-lg font-semibold"
            />
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={onContentChange}
                onKeyDown={onKeyDown}
                onKeyUp={recomputeMention}
                onClick={recomputeMention}
                placeholder="Comece a escrever... use [[ para criar links."
                className="min-h-[420px] font-mono text-sm leading-relaxed"
              />
              {mention && suggestions.length > 0 && (
                <div className="absolute left-3 top-3 z-30 w-72 max-h-72 overflow-auto rounded-md border border-border bg-popover shadow-lg">
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.type}-${s.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention(s.title);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      {typeIcon(s.type)}
                      <span className="truncate flex-1">{s.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {typeLabel(s.type)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {mention && suggestions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum item encontrado. Ao salvar, "[[{mention.query}]]" criará
                uma nova nota vazia.
              </p>
            )}
            {locked && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 text-amber-500" />
                Nota protegida. O conteúdo é criptografado com sua senha ao
                salvar. Links [[ ]] ficam indisponíveis enquanto protegida.
              </p>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                Links ({detail.outgoingLinks.length})
              </h2>
              {detail.outgoingLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum link nesta nota.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.outgoingLinks.map((ref) => (
                    <button
                      key={`out-${ref.type}-${ref.id}`}
                      onClick={() => navTo(ref)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/50 transition-colors"
                    >
                      {typeIcon(ref.type)}
                      <span className="truncate flex-1">{ref.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                Backlinks ({detail.backlinks.length})
              </h2>
              {detail.backlinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma nota aponta para esta.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.backlinks.map((ref) => (
                    <button
                      key={`back-${ref.type}-${ref.id}`}
                      onClick={() => navTo(ref)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/50 transition-colors"
                    >
                      {typeIcon(ref.type)}
                      <span className="truncate flex-1">{ref.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proteger nota com senha</DialogTitle>
            <DialogDescription>
              Digite a mesma senha duas vezes. O conteúdo será criptografado e
              só poderá ser aberto com esta senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                autoFocus
                value={pw1}
                onChange={(e) => {
                  setPw1(e.target.value);
                  setLockError("");
                }}
                placeholder="Digite a senha"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={pw2}
                onChange={(e) => {
                  setPw2(e.target.value);
                  setLockError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmLock()}
                placeholder="Digite a senha novamente"
              />
            </div>
            {lockError && <p className="text-sm text-destructive">{lockError}</p>}
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Atenção: se você esquecer esta senha, não será possível recuperar
              o conteúdo desta nota.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLockDialogOpen(false)}
              disabled={lockPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmLock} disabled={lockPending}>
              Proteger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
