import { useQueryClient } from "@tanstack/react-query";
import {
  useRequestUploadUrl,
  useRegisterAttachment,
  getListAttachmentsQueryKey,
  type Attachment,
} from "@workspace/api-client-react";

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export function useTaskAttachmentUpload(taskId: number) {
  const queryClient = useQueryClient();
  const requestUploadUrl = useRequestUploadUrl();
  const registerAttachment = useRegisterAttachment();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListAttachmentsQueryKey(taskId),
    });
  };

  const uploadOne = async (file: File): Promise<Attachment> => {
    if (file.size === 0) {
      throw new Error(`"${file.name}" está vazio`);
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`"${file.name}" excede o tamanho máximo de 25 MB`);
    }
    const contentType = file.type || "application/octet-stream";
    const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
      data: { name: file.name, size: file.size, contentType },
    });
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) {
      throw new Error(`Falha ao enviar "${file.name}"`);
    }
    return registerAttachment.mutateAsync({
      taskId,
      data: { name: file.name, contentType, size: file.size, objectPath },
    });
  };

  return { uploadOne, invalidate };
}
