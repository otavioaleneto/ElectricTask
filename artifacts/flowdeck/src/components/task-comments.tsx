import { useState, useRef } from "react";
import {
  useListComments,
  useCreateComment,
  useDeleteComment,
  useGetCurrentUser,
  getListCommentsQueryKey,
  getListTaskActivityQueryKey,
} from "@workspace/api-client-react";
import type { Comment, WorkspaceMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AtSign, Trash2, Loader2 } from "lucide-react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderBody(body: string, mentions: Comment["mentions"]) {
  if (mentions.length === 0) return body;
  const names = mentions
    .map((m) => m.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`@(?:${names.join("|")})`, "g");
  const parts: Array<string | { mention: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push({ mention: match[0] });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span key={i} className="font-medium text-primary">
        {p.mention}
      </span>
    ),
  );
}

export function TaskComments({
  taskId,
  members,
}: {
  taskId: number;
  members: WorkspaceMember[];
}) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");

  const { data: currentUser } = useGetCurrentUser();
  const { data: comments = [], isLoading } = useListComments(taskId, {
    query: { queryKey: getListCommentsQueryKey(taskId) },
  });
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getListCommentsQueryKey(taskId),
    });
    queryClient.invalidateQueries({
      queryKey: getListTaskActivityQueryKey(taskId),
    });
  };

  const insertMention = (name: string) => {
    setBody((prev) => {
      const sep = prev.length === 0 || prev.endsWith(" ") ? "" : " ";
      return `${prev}${sep}@${name} `;
    });
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const mentionedUserIds = members
      .filter((m) => trimmed.includes(`@${m.name}`))
      .map((m) => m.userId);
    createComment.mutate(
      { taskId, data: { body: trimmed, mentionedUserIds } },
      {
        onSuccess: () => {
          setBody("");
          refresh();
        },
      },
    );
  };

  const handleDelete = (commentId: number) => {
    deleteComment.mutate({ commentId }, { onSuccess: refresh });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          rows={3}
          value={body}
          placeholder="Escreva um comentário..."
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <AtSign className="mr-1 h-3.5 w-3.5" /> Mencionar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {members.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhum membro disponível.
                  </p>
                )}
                {members.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => insertMention(m.name)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {m.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            className="h-8"
            onClick={handleSubmit}
            disabled={!body.trim() || createComment.isPending}
          >
            {createComment.isPending && (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            )}
            Comentar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum comentário ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.author.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {c.author.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </span>
                  {currentUser?.id === c.author.id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      aria-label="Excluir comentário"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {renderBody(c.body, c.mentions)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
