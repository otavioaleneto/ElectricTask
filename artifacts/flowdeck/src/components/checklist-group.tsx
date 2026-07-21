import { useState, useEffect } from "react";
import {
  useUpdateChecklist,
  useDeleteChecklist,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
} from "@workspace/api-client-react";
import type { Checklist, ChecklistItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2 } from "lucide-react";

export function ChecklistGroup({
  checklist,
  onChanged,
}: {
  checklist: Checklist;
  onChanged: () => void;
}) {
  const updateChecklist = useUpdateChecklist();
  const deleteChecklist = useDeleteChecklist();
  const createItem = useCreateChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();

  const [title, setTitle] = useState(checklist.title);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setTitle(checklist.title);
  }, [checklist.title]);

  const items = checklist.items
    .slice()
    .sort((a, b) => a.position - b.position);
  const total = items.length;
  const done = items.filter((i) => i.done).length;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === checklist.title) {
      setTitle(checklist.title);
      return;
    }
    updateChecklist.mutate(
      { checklistId: checklist.id, data: { title: trimmed } },
      { onSuccess: onChanged },
    );
  };

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    createItem.mutate(
      { checklistId: checklist.id, data: { content: newItem.trim() } },
      {
        onSuccess: () => {
          setNewItem("");
          onChanged();
        },
      },
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-8 flex-1 border-transparent px-2 font-medium hover:border-input focus-visible:border-input"
          placeholder="Nome da checklist"
        />
        {total > 0 && (
          <Badge variant="secondary">
            {done}/{total}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() =>
            deleteChecklist.mutate(
              { checklistId: checklist.id },
              { onSuccess: onChanged },
            )
          }
          aria-label="Excluir checklist"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <Checkbox
              checked={item.done}
              onCheckedChange={(c) =>
                updateItem.mutate(
                  { itemId: item.id, data: { done: !!c } },
                  { onSuccess: onChanged },
                )
              }
            />
            <ChecklistItemContent item={item} onChanged={onChanged} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() =>
                deleteItem.mutate(
                  { itemId: item.id },
                  { onSuccess: onChanged },
                )
              }
              aria-label="Excluir item"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          placeholder="Adicionar item..."
          className="h-8"
        />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={handleAddItem}
          aria-label="Adicionar item"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ChecklistItemContent({
  item,
  onChanged,
}: {
  item: ChecklistItem;
  onChanged: () => void;
}) {
  const updateItem = useUpdateChecklistItem();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);

  const startEditing = () => {
    setContent(item.content);
    setEditing(true);
  };

  const cancel = () => {
    setContent(item.content);
    setEditing(false);
  };

  const save = () => {
    const trimmed = content.trim();
    setEditing(false);
    if (!trimmed || trimmed === item.content) {
      setContent(item.content);
      return;
    }
    updateItem.mutate(
      { itemId: item.id, data: { content: trimmed } },
      { onSuccess: onChanged, onError: () => setContent(item.content) },
    );
  };

  if (editing) {
    return (
      <Input
        value={content}
        autoFocus
        onChange={(e) => setContent(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="h-7 flex-1 px-2 text-sm"
        aria-label="Renomear item"
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEditing();
        }
      }}
      title="Clique para renomear"
      className={`flex-1 cursor-text rounded px-1 text-sm hover:bg-muted/60 ${
        item.done ? "line-through text-muted-foreground" : ""
      }`}
    >
      {item.content}
    </span>
  );
}
