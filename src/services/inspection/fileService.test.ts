import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClientTimeoutError } from "@/infrastructure/http/httpClient";
import { photoRepository } from "@/persistence/photoRepository";
import { photoRetryPayloadRepository } from "@/persistence/photoRetryPayloadRepository";
import { repositoryMode } from "@/persistence/repositoryMode";
import { fileService } from "@/services/inspection/fileService";

const createFileList = (files: File[]): FileList => {
  const fileListLike: Partial<FileList> & { [index: number]: File } = {
    length: files.length,
    item: (index: number) => files[index] ?? null
  };

  files.forEach((file, index) => {
    fileListLike[index] = file;
  });

  return fileListLike as FileList;
};

describe("fileService", () => {
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    vi.restoreAllMocks();
    repositoryMode.set("local", { persist: false });
    repositoryMode.clearFor("photo", { persist: false });
    vi.spyOn(photoRetryPayloadRepository, "save").mockResolvedValue({
      photoId: "photo_stub",
      blob: new Blob(["stub"], { type: "image/jpeg" }),
      fileName: "stub.jpg",
      mimeType: "image/jpeg",
      size: 4,
      updatedAt: "2026-03-31T00:00:00.000Z"
    });
    vi.spyOn(photoRetryPayloadRepository, "get").mockResolvedValue(null);
    vi.spyOn(photoRetryPayloadRepository, "remove").mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "FileReader", {
      value: originalFileReader,
      configurable: true
    });
  });

  it("usa metadados retornados por photoRepository.save no fluxo remoto", async () => {
    const saveSpy = vi.spyOn(photoRepository, "save").mockResolvedValueOnce({
      id: "photo_remote_1",
      storageKey: "media/photo_remote_1",
      name: "foto-remota.jpg",
      mimeType: "image/jpeg",
      size: 7
    });

    const file = new File(["content"], "foto-local.jpg", { type: "image/jpeg" });
    const photos = await fileService.mapFilesToPhotos(createFileList([file]));

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toMatch(/^photo_/);
    expect(saveSpy.mock.calls[0][1]).toBe(file);
    expect(saveSpy.mock.calls[0][2]).toBe("foto-local.jpg");

    expect(photos).toEqual([
      {
        id: "photo_remote_1",
        storageKey: "media/photo_remote_1",
        name: "foto-remota.jpg",
        mimeType: "image/jpeg",
        size: 7,
        syncStatus: "synced",
        retryDataAvailable: false
      }
    ]);
  });

  it("marca foto como failed quando upload remoto falha", async () => {
    repositoryMode.setFor("photo", "remote", { persist: false });
    vi.spyOn(photoRepository, "save").mockRejectedValueOnce(new Error("upload-failed"));

    const file = new File(["content"], "foto-fallback.jpg", { type: "image/jpeg" });
    const photos = await fileService.mapFilesToPhotos(createFileList([file]));

    expect(photos).toHaveLength(1);
    expect(photos[0].storageKey).toBeUndefined();
    expect(photos[0].dataUrl).toBeUndefined();
    expect(photos[0].name).toBe("foto-fallback.jpg");
    expect(photos[0].syncStatus).toBe("failed");
    expect(photos[0].syncErrorMessage).toBe("upload-failed");
    expect(photos[0].retryDataAvailable).toBe(true);
    expect(photoRetryPayloadRepository.save).toHaveBeenCalledTimes(1);
  });

  it("marca foto como pending para falha remota transiente", async () => {
    repositoryMode.setFor("photo", "remote", { persist: false });
    vi.spyOn(photoRepository, "save").mockRejectedValueOnce(
      new HttpClientTimeoutError({
        method: "POST",
        url: "/media/photos",
        timeoutMs: 15000
      })
    );

    const file = new File(["content"], "foto-pending.jpg", { type: "image/jpeg" });
    const photos = await fileService.mapFilesToPhotos(createFileList([file]));

    expect(photos).toHaveLength(1);
    expect(photos[0].syncStatus).toBe("pending");
    expect(photos[0].retryDataAvailable).toBe(true);
    expect(photos[0].dataUrl).toBeUndefined();
  });

  it("marca retry indisponivel quando persistencia local de retry falha", async () => {
    repositoryMode.setFor("photo", "remote", { persist: false });
    vi.spyOn(photoRepository, "save").mockRejectedValueOnce(new Error("upload-failed"));
    vi.spyOn(photoRetryPayloadRepository, "save").mockRejectedValueOnce(
      new Error("local-retry-cache-failed")
    );

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL(): void {
        this.result = "data:image/jpeg;base64,ZmFsbGJhY2s=";
        if (this.onload) {
          this.onload.call(
            this as unknown as FileReader,
            new Event("load") as ProgressEvent<FileReader>
          );
        }
      }
    }

    Object.defineProperty(globalThis, "FileReader", {
      value: MockFileReader,
      configurable: true
    });

    const file = new File(["content"], "foto-fallback.jpg", { type: "image/jpeg" });
    const photos = await fileService.mapFilesToPhotos(createFileList([file]));

    expect(photos).toHaveLength(1);
    expect(photos[0].retryDataAvailable).toBe(false);
    expect(photos[0].dataUrl).toBe("data:image/jpeg;base64,ZmFsbGJhY2s=");
    expect(photos[0].syncErrorMessage).toContain("Sem dado local persistido para retry");
  });
});
