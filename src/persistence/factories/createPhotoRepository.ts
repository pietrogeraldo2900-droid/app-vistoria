import type { PhotoRepositoryContract } from "@/persistence/contracts/photoRepositoryContract";
import { localPhotoRepository } from "@/persistence/local/localPhotoRepository";
import { repositoryMode } from "@/persistence/repositoryMode";
import { remotePhotoRepository } from "@/persistence/remote/remotePhotoRepository";

export const createPhotoRepository = (): PhotoRepositoryContract => {
  if (repositoryMode.getFor("photo") === "remote") {
    return remotePhotoRepository;
  }
  return localPhotoRepository;
};
