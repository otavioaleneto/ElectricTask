import React, { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useAddVideoLink,
  useDeleteVideoLink,
  useUpdateVideoLink,
  type VideoLink,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { FieldLabel } from "@/components/forms";

export function TaskVideoLinks({
  taskId,
  videoLinks,
  canEdit,
  onChanged,
}: {
  taskId: number;
  videoLinks: VideoLink[];
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const colors = useColors();
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
          onChanged?.();
        },
        onError: () =>
          Alert.alert("Erro", "Não foi possível adicionar o link."),
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
      { videoLinkId: editId, data: { url: u, label: editLabel.trim() || null } },
      {
        onSuccess: () => {
          setEditId(null);
          onChanged?.();
        },
        onError: () => Alert.alert("Erro", "Não foi possível salvar o link."),
      },
    );
  };

  const handleDelete = (videoLinkId: number) => {
    deleteLink.mutate(
      { videoLinkId },
      {
        onSuccess: () => {
          if (editId === videoLinkId) setEditId(null);
          onChanged?.();
        },
        onError: () => Alert.alert("Erro", "Não foi possível excluir o link."),
      },
    );
  };

  const openLink = (u: string) => {
    Linking.openURL(u).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o link."),
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Ionicons name="videocam-outline" size={16} color={colors.primary} />
        <FieldLabel>Links de vídeo</FieldLabel>
      </View>

      {videoLinks.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Nenhum link de vídeo ainda.
        </Text>
      ) : (
        videoLinks.map((l) =>
          editId === l.id ? (
            <View
              key={l.id}
              style={[
                styles.editBox,
                { borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <TextInput
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="Título (opcional)"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.editInput,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    color: colors.foreground,
                  },
                ]}
              />
              <TextInput
                value={editUrl}
                onChangeText={setEditUrl}
                placeholder="URL do vídeo"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
                style={[
                  styles.editInput,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    color: colors.foreground,
                  },
                ]}
              />
              <View style={styles.editActions}>
                <Pressable
                  onPress={handleSaveEdit}
                  disabled={!editUrl.trim() || updateLink.isPending}
                  style={[
                    styles.smallBtn,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: colors.radius,
                      opacity: !editUrl.trim() || updateLink.isPending ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.smallBtnText, { color: colors.primaryForeground }]}
                  >
                    Salvar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditId(null)}
                  style={[styles.smallBtn, { borderRadius: colors.radius }]}
                >
                  <Text style={[styles.smallBtnText, { color: colors.mutedForeground }]}>
                    Cancelar
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              key={l.id}
              style={[
                styles.linkRow,
                { borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <Ionicons
                name="videocam-outline"
                size={16}
                color={colors.mutedForeground}
              />
              <Pressable style={styles.linkLabel} onPress={() => openLink(l.url)}>
                <Text
                  numberOfLines={1}
                  style={[styles.linkText, { color: colors.foreground }]}
                >
                  {l.label || l.url}
                </Text>
              </Pressable>
              <Pressable hitSlop={6} onPress={() => openLink(l.url)}>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {canEdit ? (
                <>
                  <Pressable hitSlop={6} onPress={() => startEdit(l)}>
                    <Ionicons
                      name="pencil"
                      size={15}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                  <Pressable hitSlop={6} onPress={() => handleDelete(l.id)}>
                    <Ionicons
                      name="close"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </>
              ) : null}
            </View>
          ),
        )
      )}

      {canEdit ? (
        <View style={styles.addBox}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Título (opcional)"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.addInput,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
                color: colors.foreground,
              },
            ]}
          />
          <View style={styles.addUrlRow}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="URL do vídeo"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="url"
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              style={[
                styles.addInput,
                styles.addUrlInput,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                },
              ]}
            />
            <Pressable
              onPress={handleAdd}
              disabled={!url.trim() || addLink.isPending}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: !url.trim() || addLink.isPending ? 0.5 : 1,
                },
              ]}
              testID="video-link-add"
            >
              <Ionicons name="add" size={22} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  empty: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  linkLabel: {
    flex: 1,
  },
  linkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  editBox: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  editInput: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  addBox: {
    gap: 8,
    marginTop: 4,
  },
  addInput: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  addUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addUrlInput: {
    flex: 1,
  },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
