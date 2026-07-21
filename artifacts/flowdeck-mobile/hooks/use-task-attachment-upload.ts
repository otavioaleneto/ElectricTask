import { useQueryClient } from "@tanstack/react-query";
import {
  useRequestUploadUrl,
  useRegisterAttachment,
  getListAttachmentsQueryKey,
  type Attachment,
} from "@workspace/api-client-react";

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;

// Em modo de armazenamento local o servidor devolve uma URL relativa
// (/api/storage/local-upload/…); o fetch do React Native exige URL absoluta.
function absoluteUploadUrl(uploadURL: string): string {
  return uploadURL.startsWith("/") ? `${API_BASE}${uploadURL}` : uploadURL;
}

export interface LocalFile {
  uri: string;
  name: string;
  contentType: string;
  size: number;
}

export function useTaskAttachmentUpload(taskId: number) {
  const queryClient = useQueryClient();
  const requestUploadUrl = useRequestUploadUrl();
  const registerAttachment = useRegisterAttachment();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListAttachmentsQueryKey(taskId),
    });
  };

  const uploadOne = async (file: LocalFile): Promise<Attachment> => {
    const contentType = file.contentType || "application/octet-stream";

    // Read the local file into a blob so it can be PUT to the signed URL.
    const fileRes = await fetch(file.uri);
    const blob = await fileRes.blob();
    const size = file.size || blob.size;

    if (size === 0) throw new Error(`"${file.name}" está vazio`);
    if (size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`"${file.name}" excede o tamanho máximo de 25 MB`);
    }

    const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
      data: { name: file.name, size, contentType },
    });

    const putRes = await fetch(absoluteUploadUrl(uploadURL), {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) throw new Error(`Falha ao enviar "${file.name}"`);

    return registerAttachment.mutateAsync({
      taskId,
      data: { name: file.name, contentType, size, objectPath },
    });
  };

  return { uploadOne, invalidate };
}
