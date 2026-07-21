import { useState } from "react";
import {
  useAddVideoLink,
  useUpdateVideoLink,
  useDeleteVideoLink,
} from "@workspace/api-client-react";
import type { VideoLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Plus, X, ExternalLink, Pencil } from "lucide-react";

export function TaskVideoLinks({
  taskId,
  videoLinks,
  onChanged,
}: {
  taskId: number;
  videoLinks: VideoLink[];
  onChanged: () => void;
}) {
  const addLink = useAddVideoLink();
  const updateLink = useUpdateVideoLink();
  const deleteLink = useDeleteVideoLink();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const handleAdd = () => {
    const u = url.trim();
    if (!u) return;
    addLink.mutate(
      { taskId, data: { url: u, label: label.trim() || null } },
      {
        onSuccess: () => {
          setUrl("");
          setLabel("");
          onChanged();
        },
      },
    );
  };

  const startEdit = (l: VideoLink) => {
    setEditId(l.id);
    setEditUrl(l.url);
    setEditLabel(l.label || "");
  };

  const handleSaveEdit = () => {
    const u = editUrl.trim();
    if (!u || editId == null) return;
    updateLink.mutate(
      {
        videoLinkId: editId,
        data: { url: u, label: editLabel.trim() || null },
      },
      {
        onSuccess: () => {
          setEditId(null);
          onChanged();
        },
      },
    );
  };

  const handleDelete = (videoLinkId: number) => {
    deleteLink.mutate(
      { videoLinkId },
      {
        onSuccess: () => {
          if (editId === videoLinkId) setEditId(null);
          onChanged();
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-base">
        <Video className="h-4 w-4 text-primary" /> Links de vídeo
      </Label>
      <div className="space-y-2">
        {videoLinks.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum link de vídeo ainda.
          </p>
        )}
        {videoLinks.map((l) =>
          editId === l.id ? (
            <div key={l.id} className="space-y-1.5 rounded-md border p-2">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Título (opcional)"
                className="h-8 text-sm"
              />
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="URL do vídeo"
                className="h-8 text-sm"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveEdit}
                  disabled={!editUrl.trim() || updateLink.isPending}
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setEditId(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded-md border border-border p-2"
            >
              <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm hover:underline"
              >
                {l.label || l.url}
              </a>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Abrir vídeo"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => startEdit(l)}
                aria-label="Editar link"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(l.id)}
                aria-label="Excluir link"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        )}
      </div>
      <div className="space-y-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Título (opcional)"
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="URL do vídeo"
            className="h-8 text-sm"
          />
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            onClick={handleAdd}
            disabled={!url.trim() || addLink.isPending}
            aria-label="Adicionar link de vídeo"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
