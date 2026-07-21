import { useEffect } from "react";
import { useListWorkspaces } from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkspaceSwitcherProps {
  /** Texto exibido antes do seletor, dando contexto (ex.: "Workspace"). */
  label?: string;
  className?: string;
  triggerClassName?: string;
  /**
   * Modo controlado: valor exibido no seletor (ex.: o workspace do mapa
   * mental aberto), em vez do workspace ativo do contexto.
   */
  value?: number | null;
  /**
   * Modo controlado: chamado com o id escolhido em vez de gravar direto no
   * WorkspaceContext. Útil quando a troca precisa passar por confirmação
   * (ex.: guard de alterações não salvas).
   */
  onSelect?: (workspaceId: number) => void;
}

/**
 * Indicador + seletor do workspace ativo. Fonte única de troca de workspace:
 * lê e grava no WorkspaceContext (persistido em localStorage), então a seleção
 * fica sincronizada entre todas as páginas que o usam. Com `value`/`onSelect`
 * vira um seletor controlado que não toca o contexto por conta própria.
 */
export function WorkspaceSwitcher({
  label,
  className,
  triggerClassName,
  value,
  onSelect,
}: WorkspaceSwitcherProps) {
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { data } = useListWorkspaces();
  const workspaces = Array.isArray(data) ? data : [];
  const controlled = onSelect !== undefined;
  const selectedId = value !== undefined ? value : activeWorkspaceId;

  useEffect(() => {
    if (controlled) return;
    if (workspaces.length === 0) return;
    const stillExists = workspaces.some((ws) => ws.id === activeWorkspaceId);
    if (!activeWorkspaceId || !stillExists) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [controlled, workspaces, activeWorkspaceId, setActiveWorkspaceId]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {label && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{label}</span>
      )}
      <Select
        value={selectedId?.toString() || ""}
        onValueChange={(val) => {
          const id = parseInt(val, 10);
          if (onSelect) onSelect(id);
          else setActiveWorkspaceId(id);
        }}
      >
        <SelectTrigger
          className={triggerClassName ?? "w-[200px]"}
          aria-label="Trocar workspace"
          data-testid="select-workspace"
        >
          <SelectValue placeholder="Selecione um workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id.toString()}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: ws.color || "var(--primary)" }}
                />
                {ws.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
