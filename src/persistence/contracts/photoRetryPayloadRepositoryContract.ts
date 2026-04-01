export interface PendingPhotoPayload {
  photoId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: string;
}

export interface PhotoRetryPayloadRepositoryContract {
  save(payload: Omit<PendingPhotoPayload, "updatedAt">): Promise<PendingPhotoPayload>;
  get(photoId: string): Promise<PendingPhotoPayload | null>;
  remove(photoId: string): Promise<void>;
}
