import React, { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  getListAttachmentsQueryKey,
  useDeleteAttachment,
  useListAttachments,
  type Attachment,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { FieldLabel } from "@/components/forms";
import { Button } from "@/components/ui";
import {
  attachmentFileUrl,
  formatAttachmentDate,
  formatSize,
  isImageType,
} from "@/lib/rich-text";
import {
  useTaskAttachmentUpload,
  type LocalFile,
} from "@/hooks/use-task-attachment-upload";

export function TaskAttachments({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const colors = useColors();
  const { uploadOne, invalidate } = useTaskAttachmentUpload(taskId);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useListAttachments(taskId, {
    query: { queryKey: getListAttachmentsQueryKey(taskId) },
  });
  const deleteAttachment = useDeleteAttachment();

  const uploadFiles = async (files: LocalFile[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        try {
          await uploadOne(file);
        } catch (e) {
          Alert.alert(
            "Erro",
            e instanceof Error ? e.message : "Falha ao enviar o arquivo",
          );
        }
      }
      invalidate();
    } finally {
      setUploading(false);
    }
  };

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;

    const files: LocalFile[] = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName ?? `imagem-${Date.now()}.jpg`,
      contentType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize ?? 0,
    }));
    await uploadFiles(files);
  };

  const pickAndUploadDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;

    const files: LocalFile[] = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name ?? `arquivo-${Date.now()}`,
      contentType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    }));
    await uploadFiles(files);
  };

  const handleDelete = (a: Attachment) => {
    Alert.alert("Remover anexo", `Remover "${a.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () =>
          deleteAttachment.mutate(
            { attachmentId: a.id },
            { onSuccess: invalidate },
          ),
      },
    ]);
  };

  const openAttachment = (a: Attachment) => {
    Linking.openURL(attachmentFileUrl(a.id, true)).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o anexo."),
    );
  };

  return (
    <View style={styles.section}>
      <FieldLabel>Anexos</FieldLabel>

      {canEdit ? (
        <View style={styles.uploadRow}>
          <Button
            label="Enviar imagem"
            variant="secondary"
            icon="image-outline"
            onPress={pickAndUpload}
            loading={uploading}
            style={styles.uploadBtn}
          />
          <Button
            label="Enviar arquivo"
            variant="secondary"
            icon="document-attach-outline"
            onPress={pickAndUploadDocuments}
            loading={uploading}
            style={styles.uploadBtn}
          />
        </View>
      ) : null}

      {isLoading ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          Carregando...
        </Text>
      ) : attachments.length === 0 ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          Nenhum anexo ainda.
        </Text>
      ) : (
        <View style={styles.list}>
          {attachments.map((a) => (
            <View
              key={a.id}
              style={[
                styles.row,
                { borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <Pressable
                style={[styles.thumb, { backgroundColor: colors.secondary }]}
                onPress={() => openAttachment(a)}
              >
                {isImageType(a.contentType) ? (
                  <Image
                    source={{ uri: attachmentFileUrl(a.id) }}
                    style={styles.thumbImg}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <Ionicons
                    name="document-text-outline"
                    size={22}
                    color={colors.mutedForeground}
                  />
                )}
              </Pressable>

              <View style={styles.meta}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.foreground }]}
                >
                  {a.name}
                </Text>
                <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
                  {formatSize(a.size)} · {formatAttachmentDate(a.createdAt)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.metaLine, { color: colors.mutedForeground }]}
                >
                  por {a.uploaderName ?? "Desconhecido"}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable hitSlop={8} onPress={() => openAttachment(a)}>
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {canEdit ? (
                  <Pressable hitSlop={8} onPress={() => handleDelete(a)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.destructive}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  uploadRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  uploadBtn: {
    flex: 1,
  },
  muted: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  metaLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },
});
