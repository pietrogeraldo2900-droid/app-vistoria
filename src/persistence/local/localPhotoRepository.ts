import type {
  PhotoRepositoryContract,
  SavedPhotoMetadata
} from "@/persistence/contracts/photoRepositoryContract";

const DB_NAME = "app-vistoria-media";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

interface StoredPhoto {
  id: string;
  blob: Blob;
  createdAt: string;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB nao disponivel neste ambiente."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
    };
  });

const runReadWrite = async <T>(
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    const request = handler(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

const runReadOnly = async <T>(
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const store = tx.objectStore(PHOTO_STORE);
    const request = handler(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

export const localPhotoRepository: PhotoRepositoryContract = {
  async save(
    photoId: string,
    blob: Blob,
    fileName?: string
  ): Promise<SavedPhotoMetadata> {
    const payload: StoredPhoto = {
      id: photoId,
      blob,
      createdAt: new Date().toISOString()
    };
    await runReadWrite((store) => store.put(payload));

    return {
      id: photoId,
      storageKey: photoId,
      name: fileName ?? `${photoId}.bin`,
      mimeType: blob.type || "application/octet-stream",
      size: blob.size
    };
  },

  async get(photoId: string): Promise<Blob | null> {
    const record = await runReadOnly<StoredPhoto | undefined>((store) =>
      store.get(photoId)
    );
    if (!record) {
      return null;
    }
    return record.blob;
  },

  async remove(photoId: string): Promise<void> {
    await runReadWrite((store) => store.delete(photoId));
  }
};
