import type { ItemPhoto } from "@/domain/types/inspection";
import { createId } from "@/domain/utils/id";
import {
  BackendGatewayUnavailableError,
  HttpClientResponseError,
  HttpClientTimeoutError
} from "@/infrastructure/http/httpClient";
import { photoRepository } from "@/persistence/photoRepository";
import { photoRetryPayloadRepository } from "@/persistence/photoRetryPayloadRepository";
import { repositoryMode } from "@/persistence/repositoryMode";

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Falha ao ler arquivo: ${file.name}`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

export const fileService = {
  async mapFilesToPhotos(files: FileList | null): Promise<ItemPhoto[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const entries = Array.from(files);
    const photos: ItemPhoto[] = [];
    const isRemoteMode = repositoryMode.getFor("photo") === "remote";

    for (const file of entries) {
      const photoId = createId("photo");
      try {
        const saved = await photoRepository.save(photoId, file, file.name);
        await photoRetryPayloadRepository.remove(photoId).catch(() => undefined);
        photos.push({
          id: saved.id,
          storageKey: saved.storageKey,
          name: saved.name,
          mimeType: saved.mimeType,
          size: saved.size,
          syncStatus: "synced",
          retryDataAvailable: false
        });
      } catch (error) {
        const syncStatus = isRemoteMode ? classifyRemoteUploadFailure(error) : "failed";
        const baseSyncErrorMessage = extractErrorMessage(
          error,
          isRemoteMode
            ? "Falha no upload remoto da foto."
            : "Falha no armazenamento local da foto."
        );

        const retryPersistence = await persistRetryPayload(photoId, file);
        let syncErrorMessage = baseSyncErrorMessage;
        let dataUrl: string | undefined;

        if (!retryPersistence.available) {
          syncErrorMessage = `${baseSyncErrorMessage} Sem dado local persistido para retry apos recarga. Reanexe a foto.`;
          try {
            dataUrl = await fileToDataUrl(file);
          } catch {
            dataUrl = undefined;
          }
        }

        photos.push({
          id: photoId,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl,
          syncStatus,
          syncErrorMessage,
          retryDataAvailable: retryPersistence.available
        });
      }
    }

    return photos;
  }
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const persistRetryPayload = async (
  photoId: string,
  file: File
): Promise<{ available: boolean }> => {
  try {
    await photoRetryPayloadRepository.save({
      photoId,
      blob: file,
      fileName: file.name,
      mimeType: file.type,
      size: file.size
    });
    return { available: true };
  } catch {
    return { available: false };
  }
};

const classifyRemoteUploadFailure = (error: unknown): "pending" | "failed" => {
  if (error instanceof HttpClientTimeoutError) {
    return "pending";
  }

  if (error instanceof HttpClientResponseError) {
    if (error.status >= 500) {
      return "pending";
    }
    return "failed";
  }

  if (error instanceof BackendGatewayUnavailableError) {
    return "failed";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("network")) {
    return "pending";
  }

  return "failed";
};
