import type { PhotoRetryPayloadRepositoryContract } from "@/persistence/contracts/photoRetryPayloadRepositoryContract";
import { localPhotoRetryPayloadRepository } from "@/persistence/local/localPhotoRetryPayloadRepository";

export type { PendingPhotoPayload } from "@/persistence/contracts/photoRetryPayloadRepositoryContract";
export type { PhotoRetryPayloadRepositoryContract } from "@/persistence/contracts/photoRetryPayloadRepositoryContract";

export const photoRetryPayloadRepository: PhotoRetryPayloadRepositoryContract =
  localPhotoRetryPayloadRepository;
