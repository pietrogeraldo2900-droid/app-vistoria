import type {
  PendingPhotoPayload,
  PhotoRetryPayloadRepositoryContract
} from "@/persistence/contracts/photoRetryPayloadRepositoryContract";

const DB_NAME = "app-vistoria-photo-retry";
const DB_VERSION = 1;
const STORE_NAME = "retry-payloads";

interface StoredRetryPayload extends PendingPhotoPayload {}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB nao disponivel neste ambiente."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "photoId" });
      }
    };
  });

const runReadOnly = async <T>(
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

const runReadWrite = async <T>(
  handler: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

export const localPhotoRetryPayloadRepository: PhotoRetryPayloadRepositoryContract = {
  async save(payload) {
    const record: StoredRetryPayload = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    await runReadWrite((store) => store.put(record));
    return record;
  },

  async get(photoId) {
    const record = await runReadOnly<StoredRetryPayload | undefined>((store) =>
      store.get(photoId)
    );
    return record ?? null;
  },

  async remove(photoId) {
    await runReadWrite((store) => store.delete(photoId));
  }
};
