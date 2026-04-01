export interface SavedPhotoMetadata {
  id: string;
  storageKey: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface PhotoRepositoryContract {
  save(photoId: string, blob: Blob, fileName?: string): Promise<SavedPhotoMetadata>;
  get(photoId: string): Promise<Blob | null>;
  remove(photoId: string): Promise<void>;
}
