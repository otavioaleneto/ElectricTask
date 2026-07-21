import { useRef, useState } from "react";
import {
  useListAttachments,
  useDeleteAttachment,
  getListAttachmentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Loader2, FileText, Upload } from "lucide-react";
import {
  formatSize,
  isImage,
  attachmentFileUrl,
  formatAttachmentDate,
} from "@/lib/attachments";
import { useTaskAttachmentUpload } from "@/hooks/use-task-attachment-upload";

export function TaskAttachmentsGallery({ taskId }: { taskId: number }) {
  const { uploadOne, invalidate } = useTaskAttachmentUpload(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useListAttachments(taskId, {
    query: { queryKey: getListAttachmentsQueryKey(taskId) },
  });
  const deleteAttachment = useDeleteAttachment();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          await uploadOne(file);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Falha ao enviar o arquivo",
          );
        }
      }
      invalidate();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (attachmentId: number) => {
    deleteAttachment.mutate({ attachmentId }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-4 py-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Enviar arquivo
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : attachments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum anexo ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border"
            >
              <div className="flex h-32 items-center justify-center overflow-hidden bg-muted">
                {isImage(a.contentType) ? (
                  <img
                    src={attachmentFileUrl(a.id)}
                    alt={a.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="truncate text-sm font-medium" title={a.name}>
                  {a.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(a.size)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Enviado em {formatAttachmentDate(a.createdAt)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  por {a.uploaderName ?? "Desconhecido"}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <a
                    href={attachmentFileUrl(a.id, true)}
                    download={a.name}
                    aria-label={`Baixar ${a.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(a.id)}
                    aria-label={`Remover ${a.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
