import { backendGateway } from "@/infrastructure/http/backendGateway";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";
import type {
  PhotoRepositoryContract,
  SavedPhotoMetadata
} from "@/persistence/contracts/photoRepositoryContract";

const PHOTO_ENDPOINTS = {
  save: { method: "POST", path: "/media/photos" },
  get: { method: "GET", path: "/media/photos/{storage_key}" },
  remove: { method: "DELETE", path: "/media/photos/{storage_key}" }
} as const;

export const remotePhotoRepository: PhotoRepositoryContract = {
  async save(photoId: string, blob: Blob, fileName?: string): Promise<SavedPhotoMetadata> {
    const formData = new FormData();
    const isFile = typeof File !== "undefined" && blob instanceof File;
    const effectiveName =
      fileName ?? (isFile ? blob.name : `${photoId}.bin`);

    formData.append("file", blob, effectiveName);

    const response = await backendGateway.request<
      | {
          id?: string;
          storage_key?: string;
          name?: string;
          mime_type?: string;
          size?: number;
        }
      | undefined
    >("photo.save", PHOTO_ENDPOINTS.save, {
      body: formData,
      responseType: "json"
    });

    return {
      id: response?.id ?? photoId,
      storageKey: response?.storage_key ?? photoId,
      name: response?.name ?? effectiveName,
      mimeType: response?.mime_type ?? (blob.type || "application/octet-stream"),
      size: typeof response?.size === "number" ? response.size : blob.size
    };
  },

  async get(photoStorageKey: string): Promise<Blob | null> {
    const path = PHOTO_ENDPOINTS.get.path.replace(
      "{storage_key}",
      encodeURIComponent(photoStorageKey)
    );

    try {
      return await backendGateway.request<Blob>(
        "photo.get",
        {
          method: PHOTO_ENDPOINTS.get.method,
          path
        },
        { responseType: "blob" }
      );
    } catch (error) {
      if (error instanceof HttpClientResponseError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async remove(photoStorageKey: string): Promise<void> {
    const path = PHOTO_ENDPOINTS.remove.path.replace(
      "{storage_key}",
      encodeURIComponent(photoStorageKey)
    );

    try {
      await backendGateway.request<void>(
        "photo.remove",
        {
          method: PHOTO_ENDPOINTS.remove.method,
          path
        },
        { responseType: "void" }
      );
    } catch (error) {
      if (error instanceof HttpClientResponseError && error.status === 404) {
        return;
      }
      throw error;
    }
  }
};
