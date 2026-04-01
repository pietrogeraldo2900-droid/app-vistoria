import type { PhotoRepositoryContract } from "@/persistence/contracts/photoRepositoryContract";
import { createPhotoRepository } from "@/persistence/factories/createPhotoRepository";

export type { PhotoRepositoryContract } from "@/persistence/contracts/photoRepositoryContract";

const resolveRepository = (): PhotoRepositoryContract => createPhotoRepository();

export const photoRepository: PhotoRepositoryContract = {
  save(photoId: string, blob: Blob, fileName?: string) {
    return resolveRepository().save(photoId, blob, fileName);
  },

  get(photoId: string): Promise<Blob | null> {
    return resolveRepository().get(photoId);
  },

  remove(photoId: string): Promise<void> {
    return resolveRepository().remove(photoId);
  }
};
