import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/infrastructure/http/backendGateway", () => ({
  backendGateway: {
    request: requestMock
  }
}));

import { remotePhotoRepository } from "@/persistence/remote/remotePhotoRepository";

describe("remotePhotoRepository", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("faz upload via /media/photos com FormData e retorna metadados", async () => {
    requestMock.mockResolvedValueOnce({
      id: "photo_1",
      storage_key: "media/photo_1",
      name: "foto.jpg",
      mime_type: "image/jpeg",
      size: 1200
    });

    const blob = new Blob(["binary"], { type: "image/jpeg" });
    const output = await remotePhotoRepository.save("photo_local_1", blob, "foto.jpg");

    expect(requestMock).toHaveBeenCalledWith(
      "photo.save",
      { method: "POST", path: "/media/photos" },
      expect.objectContaining({
        responseType: "json",
        body: expect.any(FormData)
      })
    );

    expect(output).toEqual({
      id: "photo_1",
      storageKey: "media/photo_1",
      name: "foto.jpg",
      mimeType: "image/jpeg",
      size: 1200
    });
  });

  it("faz download binario via /media/photos/{storage_key}", async () => {
    const blob = new Blob(["file"], { type: "image/jpeg" });
    requestMock.mockResolvedValueOnce(blob);

    const output = await remotePhotoRepository.get("media/photo_1");

    expect(requestMock).toHaveBeenCalledWith(
      "photo.get",
      { method: "GET", path: "/media/photos/media%2Fphoto_1" },
      { responseType: "blob" }
    );
    expect(output).toBe(blob);
  });

  it("retorna null em download quando backend responde 404", async () => {
    requestMock.mockRejectedValueOnce(
      new HttpClientResponseError({
        method: "GET",
        url: "https://api.app-vistoria.test/media/photos/media%2Fphoto_404",
        status: 404,
        statusText: "Not Found",
        responseBody: null
      })
    );

    const output = await remotePhotoRepository.get("media/photo_404");
    expect(output).toBeNull();
  });

  it("remove foto remota e ignora 404 para delete idempotente", async () => {
    requestMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new HttpClientResponseError({
          method: "DELETE",
          url: "https://api.app-vistoria.test/media/photos/media%2Fphoto_404",
          status: 404,
          statusText: "Not Found",
          responseBody: null
        })
      );

    await expect(remotePhotoRepository.remove("media/photo_1")).resolves.toBeUndefined();
    await expect(remotePhotoRepository.remove("media/photo_404")).resolves.toBeUndefined();

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "photo.remove",
      { method: "DELETE", path: "/media/photos/media%2Fphoto_1" },
      { responseType: "void" }
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "photo.remove",
      { method: "DELETE", path: "/media/photos/media%2Fphoto_404" },
      { responseType: "void" }
    );
  });
});
