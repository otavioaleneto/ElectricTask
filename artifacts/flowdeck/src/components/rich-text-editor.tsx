import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List as ListIcon,
  Palette,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { sanitizeHtml } from "@/lib/sanitize";
import { attachmentFileUrl } from "@/lib/attachments";
import { useTaskAttachmentUpload } from "@/hooks/use-task-attachment-upload";

const TEXT_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export interface RichTextEditorHandle {
  isDirty: () => boolean;
  save: () => void | Promise<unknown>;
  reset: () => void;
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  {
    taskId: number;
    initialContent: string;
    onSave: (html: string) => void | Promise<unknown>;
  }
>(function RichTextEditor({ taskId, initialContent, onSave }, ref) {
  const { uploadOne, invalidate } = useTaskAttachmentUpload(taskId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef("");
  const isMountedRef = useRef(true);
  const saveRef = useRef<() => void | Promise<unknown>>(() => {});
  const insertImageRef = useRef<(file: File) => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "Adicione mais detalhes..." }),
    ],
    content: sanitizeHtml(initialContent),
    editorProps: {
      attributes: {
        class:
          "rte-content prose prose-sm dark:prose-invert max-w-none min-h-24 px-3 py-2 focus:outline-none",
      },
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const images = files
          ? Array.from(files).filter((f) => f.type.startsWith("image/"))
          : [];
        if (images.length > 0) {
          event.preventDefault();
          images.forEach((f) => insertImageRef.current(f));
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        const images = files
          ? Array.from(files).filter((f) => f.type.startsWith("image/"))
          : [];
        if (images.length > 0) {
          event.preventDefault();
          images.forEach((f) => insertImageRef.current(f));
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      lastSavedRef.current = editor.isEmpty
        ? ""
        : sanitizeHtml(editor.getHTML());
    },
  });

  const save = useCallback((): void | Promise<unknown> => {
    if (!editor || editor.isDestroyed) return;
    const html = editor.isEmpty ? "" : sanitizeHtml(editor.getHTML());
    if (html === lastSavedRef.current) return;
    const previous = lastSavedRef.current;
    lastSavedRef.current = html;
    const result = onSave(html) as unknown;
    if (result && typeof (result as { then?: unknown }).then === "function") {
      return (result as Promise<unknown>).catch((err) => {
        if (lastSavedRef.current === html) lastSavedRef.current = previous;
        throw err;
      });
    }
  }, [editor, onSave]);
  saveRef.current = save;

  useImperativeHandle(
    ref,
    () => ({
      isDirty: () => {
        if (!editor || editor.isDestroyed) return false;
        const html = editor.isEmpty ? "" : sanitizeHtml(editor.getHTML());
        return html !== lastSavedRef.current;
      },
      save: () => saveRef.current(),
      reset: () => {
        if (!editor || editor.isDestroyed) return;
        editor.commands.setContent(lastSavedRef.current || "");
      },
    }),
    [editor],
  );

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor || editor.isDestroyed) return;
      setError(null);
      setUploading(true);
      try {
        const att = await uploadOne(file);
        if (isMountedRef.current && !editor.isDestroyed) {
          editor
            .chain()
            .focus()
            .setImage({ src: attachmentFileUrl(att.id), alt: att.name })
            .run();
          void Promise.resolve(save()).catch(() => {});
        }
        invalidate();
      } catch (e) {
        if (isMountedRef.current) {
          setError(e instanceof Error ? e.message : "Falha ao enviar a imagem");
        }
      } finally {
        if (isMountedRef.current) setUploading(false);
      }
    },
    [editor, uploadOne, invalidate, save],
  );
  insertImageRef.current = insertImage;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      void Promise.resolve(saveRef.current()).catch(() => {});
    };
  }, []);

  const handleFileInput = (files: FileList | null) => {
    if (files) {
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .forEach((f) => insertImage(f));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isActive = (name: string) => editor?.isActive(name) ?? false;

  return (
    <div className="rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
        <ToolbarButton
          label="Negrito"
          active={isActive("bold")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Itálico"
          active={isActive("italic")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Sublinhado"
          active={isActive("underline")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista com marcadores"
          active={isActive("bulletList")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="h-4 w-4" />
        </ToolbarButton>

        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!editor}
              aria-label="Cor do texto"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-sm border border-border"
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                  onClick={() => {
                    editor?.chain().focus().setColor(c).run();
                    setColorOpen(false);
                  }}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 w-full text-xs"
              onClick={() => {
                editor?.chain().focus().unsetColor().run();
                setColorOpen(false);
              }}
            >
              Cor padrão
            </Button>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-5 w-px bg-border" />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileInput(e.target.files)}
        />
        <ToolbarButton
          label="Inserir imagem"
          disabled={!editor || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
});

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
