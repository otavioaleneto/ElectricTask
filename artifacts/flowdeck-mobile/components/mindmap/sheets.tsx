import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getListTasksQueryKey,
  useListTasks,
  type Mindmap,
  type MindmapEdge,
  type MindmapNode,
  type Project,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";
import {
  FieldLabel,
  LabeledInput,
  SelectField,
  SheetModal,
  type SelectOption,
} from "@/components/forms";

import { NODE_COLORS, stripHtml, typeLabel, type NodeType } from "./shared";

type Colors = ReturnType<typeof useColors>;

export type AddNodeSpec =
  | { type: "text" | "label" | "hotspot" | "light" }
  | { type: "project"; projectId: number; label: string; color: string }
  | { type: "task"; projectId: number; taskId: number; label: string }
  | { type: "mindmap"; mindmapId: number; label: string };

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (color: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <FieldLabel>Cor</FieldLabel>
      <View style={styles.swatchRow}>
        {NODE_COLORS.map((c) => {
          const active = value === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderColor: active ? colors.foreground : "transparent",
                },
              ]}
            >
              {active ? (
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "label", label: "Rótulo" },
  { value: "hotspot", label: "Ponto" },
  { value: "light", label: "Ponto de luz" },
  { value: "project", label: "Projeto" },
  { value: "task", label: "Tarefa" },
  { value: "mindmap", label: "Mapa mental" },
];

export function AddNodeSheet({
  visible,
  onClose,
  projects,
  mindmaps,
  currentMindmapId,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  projects: Project[];
  mindmaps: Mindmap[];
  currentMindmapId: number;
  onAdd: (spec: AddNodeSpec) => void;
}) {
  const [type, setType] = useState<NodeType>("text");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [taskProjectId, setTaskProjectId] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [mindmapId, setMindmapId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setType("text");
      setProjectId(null);
      setTaskProjectId(null);
      setTaskId(null);
      setMindmapId(null);
    }
  }, [visible]);

  const tasksQuery = useListTasks(taskProjectId ?? 0, undefined, {
    query: {
      enabled: !!taskProjectId,
      queryKey: getListTasksQueryKey(taskProjectId ?? 0),
    },
  });
  const tasks = tasksQuery.data ?? [];

  const projectOptions: SelectOption[] = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
    color: p.accentColor,
  }));
  const taskOptions: SelectOption[] = tasks.map((t) => ({
    value: String(t.id),
    label: t.title,
  }));
  const mindmapOptions: SelectOption[] = mindmaps
    .filter((m) => m.id !== currentMindmapId)
    .map((m) => ({ value: String(m.id), label: m.name }));

  const canConfirm = (() => {
    if (type === "project") return projectId != null;
    if (type === "task") return taskProjectId != null && taskId != null;
    if (type === "mindmap") return mindmapId != null;
    return true;
  })();

  const confirm = () => {
    if (type === "project") {
      const p = projects.find((x) => x.id === projectId);
      if (!p) return;
      onAdd({ type: "project", projectId: p.id, label: p.name, color: p.accentColor });
    } else if (type === "task") {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      onAdd({ type: "task", projectId: t.projectId, taskId: t.id, label: t.title });
    } else if (type === "mindmap") {
      const m = mindmaps.find((x) => x.id === mindmapId);
      if (!m) return;
      onAdd({ type: "mindmap", mindmapId: m.id, label: m.name });
    } else {
      onAdd({ type });
    }
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Adicionar nó"
      footer={
        <Button
          label="Adicionar"
          icon="add"
          onPress={confirm}
          disabled={!canConfirm}
        />
      }
    >
      <SelectField
        label="Tipo"
        options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={type}
        onSelect={(v) => setType(v as NodeType)}
      />

      {type === "project" ? (
        <SelectField
          label="Projeto"
          placeholder="Selecionar projeto"
          options={projectOptions}
          value={projectId != null ? String(projectId) : null}
          onSelect={(v) => setProjectId(Number(v))}
        />
      ) : null}

      {type === "task" ? (
        <>
          <SelectField
            label="Projeto"
            placeholder="Selecionar projeto"
            options={projectOptions}
            value={taskProjectId != null ? String(taskProjectId) : null}
            onSelect={(v) => {
              setTaskProjectId(Number(v));
              setTaskId(null);
            }}
          />
          {taskProjectId != null ? (
            <SelectField
              label="Tarefa"
              placeholder={
                tasksQuery.isLoading ? "Carregando..." : "Selecionar tarefa"
              }
              options={taskOptions}
              value={taskId != null ? String(taskId) : null}
              onSelect={(v) => setTaskId(Number(v))}
            />
          ) : null}
        </>
      ) : null}

      {type === "mindmap" ? (
        <SelectField
          label="Mapa mental"
          placeholder="Selecionar mapa"
          options={mindmapOptions}
          value={mindmapId != null ? String(mindmapId) : null}
          onSelect={(v) => setMindmapId(Number(v))}
        />
      ) : null}
    </SheetModal>
  );
}

export function NodeEditorSheet({
  node,
  nodes,
  edges,
  onClose,
  onApply,
  onDelete,
  onStartConnect,
  onRemoveEdge,
  onOpenLink,
}: {
  node: MindmapNode | null;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  onClose: () => void;
  onApply: (
    id: string,
    patch: { label: string; color: string | null; details?: string | null },
  ) => void;
  onDelete: (id: string) => void;
  onStartConnect: (sourceId: string, directed: boolean) => void;
  onRemoveEdge: (edgeId: string) => void;
  onOpenLink: (node: MindmapNode) => void;
}) {
  const colors = useColors();
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [originalDetails, setOriginalDetails] = useState("");

  useEffect(() => {
    if (node) {
      setLabel(node.label ?? "");
      const stripped = stripHtml(node.details);
      setDetails(stripped);
      setOriginalDetails(stripped);
      setColor(node.color ?? null);
    }
  }, [node]);

  const isLinked =
    node?.type === "project" || node?.type === "task" || node?.type === "mindmap";
  const supportsDetails = node?.type === "text" || node?.type === "hotspot";

  const connections = useMemo(() => {
    if (!node) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const otherId = e.source === node.id ? e.target : e.source;
        return { edge: e, other: byId.get(otherId) };
      });
  }, [node, nodes, edges]);

  const apply = () => {
    if (!node) return;
    const patch: {
      label: string;
      color: string | null;
      details?: string | null;
    } = { label, color };
    if (supportsDetails && details !== originalDetails) {
      patch.details = details.length > 0 ? details : null;
    }
    onApply(node.id, patch);
  };

  const handleConnect = (directed: boolean) => {
    if (!node) return;
    apply();
    onStartConnect(node.id, directed);
  };

  const handleDelete = () => {
    if (!node) return;
    Alert.alert("Excluir nó", "Deseja remover este nó do mapa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => onDelete(node.id),
      },
    ]);
  };

  return (
    <SheetModal
      visible={!!node}
      onClose={() => {
        apply();
        onClose();
      }}
      title={node ? typeLabel(node.type as NodeType) : "Nó"}
      footer={
        <View style={styles.footerRow}>
          <View style={styles.footerFlex}>
            <Button
              label="Excluir"
              variant="destructive"
              icon="trash-outline"
              onPress={handleDelete}
            />
          </View>
          <View style={styles.footerFlex}>
            <Button
              label="Concluir"
              icon="checkmark"
              onPress={() => {
                apply();
                onClose();
              }}
            />
          </View>
        </View>
      }
    >
      {node ? (
        <>
          <LabeledInput
            label={node.type === "label" ? "Texto" : "Título"}
            value={label}
            onChangeText={setLabel}
            placeholder="Sem título"
          />

          {supportsDetails ? (
            <LabeledInput
              label="Detalhes"
              value={details}
              onChangeText={setDetails}
              placeholder="Notas ou descrição"
              multiline
            />
          ) : null}

          <ColorPicker value={color} onChange={(c) => setColor(c)} />

          {isLinked ? (
            <View style={styles.field}>
              <Button
                label="Abrir item vinculado"
                variant="secondary"
                icon="open-outline"
                onPress={() => {
                  apply();
                  onOpenLink(node);
                }}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <FieldLabel>Conexões</FieldLabel>
            {connections.length === 0 ? (
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                Nenhuma conexão ainda.
              </Text>
            ) : (
              connections.map(({ edge, other }) => (
                <View
                  key={edge.id}
                  style={[styles.connRow, { borderColor: colors.border }]}
                >
                  <Ionicons
                    name={edge.directed ? "arrow-forward" : "remove-outline"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.connText, { color: colors.foreground }]}
                  >
                    {other?.label || "Nó removido"}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => onRemoveEdge(edge.id)}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.destructive}
                    />
                  </Pressable>
                </View>
              ))
            )}
            <View style={styles.connectButtons}>
              <View style={styles.footerFlex}>
                <Button
                  label="Conectar"
                  variant="secondary"
                  icon="git-compare-outline"
                  onPress={() => handleConnect(false)}
                />
              </View>
              <View style={styles.footerFlex}>
                <Button
                  label="Conectar com seta"
                  variant="secondary"
                  icon="arrow-forward"
                  onPress={() => handleConnect(true)}
                />
              </View>
            </View>
          </View>
        </>
      ) : null}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
  },
  footerFlex: {
    flex: 1,
  },
  muted: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  connRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
  },
  connText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  connectButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
});
