import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWorkspaceSummaryQueryKey,
  getListProjectsQueryKey,
  useCreateProject,
  type ProjectInputPlatform,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";
import {
  FieldLabel,
  LabeledInput,
  Segmented,
  SelectField,
  SheetModal,
  type SelectOption,
} from "@/components/forms";

type ProjectType = "social" | "development";

const TYPE_OPTIONS: { label: string; value: ProjectType }[] = [
  { label: "Social", value: "social" },
  { label: "Desenvolvimento", value: "development" },
];

const PLATFORM_OPTIONS: SelectOption[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitch", label: "Twitch" },
  { value: "generic", label: "Genérico" },
];

const ACCENT_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

export function CreateProjectSheet({
  visible,
  workspaceId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  workspaceId: number;
  onClose: () => void;
  onCreated?: (projectId: number) => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("social");
  const [platform, setPlatform] = useState<ProjectInputPlatform>("youtube");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setDescription("");
    setType("social");
    setPlatform("youtube");
    setAccentColor(ACCENT_COLORS[0]);
  }, [visible]);

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: (project) => {
        queryClient.invalidateQueries({
          queryKey: getListProjectsQueryKey(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceSummaryQueryKey(workspaceId),
        });
        onClose();
        onCreated?.(project.id);
      },
      onError: () =>
        Alert.alert("Erro", "Não foi possível criar o projeto."),
    },
  });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || workspaceId <= 0) return;
    createMutation.mutate({
      workspaceId,
      data: {
        name: trimmed,
        description: description.trim() || undefined,
        type,
        platform: type === "development" ? "generic" : platform,
        accentColor,
      },
    });
  };

  const footer = (
    <Button
      label="Criar projeto"
      icon="checkmark"
      onPress={save}
      loading={createMutation.isPending}
      disabled={!name.trim() || createMutation.isPending}
      testID="project-save"
    />
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Novo projeto"
      footer={footer}
    >
      <LabeledInput
        label="Nome"
        value={name}
        onChangeText={setName}
        placeholder="Nome do projeto"
        autoFocus
        testID="project-name"
      />
      <LabeledInput
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        placeholder="Sobre o que é este projeto (opcional)"
        multiline
      />
      <Segmented
        label="Tipo"
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
      />
      {type === "social" ? (
        <SelectField
          label="Plataforma"
          options={PLATFORM_OPTIONS}
          value={platform}
          onSelect={(v) => setPlatform(v as ProjectInputPlatform)}
          testID="project-platform"
        />
      ) : null}
      <FieldLabel>Cor de destaque</FieldLabel>
      <View style={styles.swatchRow}>
        {ACCENT_COLORS.map((c) => {
          const active = c === accentColor;
          return (
            <Pressable
              key={c}
              onPress={() => setAccentColor(c)}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderColor: active ? colors.foreground : "transparent",
                },
              ]}
            >
              {active ? (
                <Ionicons name="checkmark" size={18} color="#ffffff" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
