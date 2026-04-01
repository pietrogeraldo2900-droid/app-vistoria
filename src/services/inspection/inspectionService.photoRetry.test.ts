import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClientTimeoutError } from "@/infrastructure/http/httpClient";
import type { InspectionRecord } from "@/domain/types/inspection";

const {
  inspectionRepositoryMock,
  photoRepositoryMock,
  photoRetryPayloadRepositoryMock
} = vi.hoisted(() => ({
  inspectionRepositoryMock: {
    list: vi.fn(),
    getById: vi.fn(),
    upsert: vi.fn()
  },
  photoRepositoryMock: {
    save: vi.fn(),
    get: vi.fn(),
    remove: vi.fn()
  },
  photoRetryPayloadRepositoryMock: {
    save: vi.fn(),
    get: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock("@/persistence/inspectionRepository", () => ({
  inspectionRepository: inspectionRepositoryMock
}));

vi.mock("@/persistence/photoRepository", () => ({
  photoRepository: photoRepositoryMock
}));

vi.mock("@/persistence/photoRetryPayloadRepository", () => ({
  photoRetryPayloadRepository: photoRetryPayloadRepositoryMock
}));

import { inspectionService } from "@/services/inspection/inspectionService";

const createInspection = (
  syncStatus: "pending" | "failed",
  options?: { includeDataUrl?: boolean }
): InspectionRecord => ({
  id: "inspection_1",
  title: "Vistoria",
  companyName: "Empresa",
  unitName: "Unidade",
  address: "Rua 1",
  city: "Sao Paulo",
  clientName: "Cliente",
  contractCode: "CTR",
  inspectionType: "periodica",
  generalObservation: "",
  inspectorName: "Tecnico",
  state: "SP",
  inspectionDate: "2026-03-31",
  createdAt: "2026-03-31T10:00:00.000Z",
  updatedAt: "2026-03-31T10:00:00.000Z",
  locations: [
    {
      id: "loc_1",
      name: "G1",
      items: [
        {
          id: "item_1",
          itemKey: "extintor",
          status: "conforme",
          fieldValues: {},
          generatedText: "Galpao 1 - Texto.",
          createdAt: "2026-03-31T10:00:00.000Z",
          photos: [
            {
              id: "photo_1",
              name: "foto.jpg",
              mimeType: "image/jpeg",
              size: 100,
              syncStatus,
              syncErrorMessage: "Falha anterior",
              ...(options?.includeDataUrl
                ? { dataUrl: "data:image/jpeg;base64,Zm90bw==" }
                : {})
            }
          ]
        }
      ]
    }
  ]
});

const pendingPayload = {
  photoId: "photo_1",
  blob: new Blob(["image"], { type: "image/jpeg" }),
  fileName: "foto.jpg",
  mimeType: "image/jpeg",
  size: 100,
  updatedAt: "2026-03-31T10:05:00.000Z"
};

describe("inspectionService retry photo sync", () => {
  beforeEach(() => {
    inspectionRepositoryMock.list.mockReset();
    inspectionRepositoryMock.getById.mockReset();
    inspectionRepositoryMock.upsert.mockReset();
    photoRepositoryMock.save.mockReset();
    photoRepositoryMock.get.mockReset();
    photoRepositoryMock.remove.mockReset();
    photoRetryPayloadRepositoryMock.save.mockReset();
    photoRetryPayloadRepositoryMock.get.mockReset();
    photoRetryPayloadRepositoryMock.remove.mockReset();

    inspectionRepositoryMock.upsert.mockImplementation(async (record) => record);
    photoRetryPayloadRepositoryMock.get.mockResolvedValue(null);
    photoRetryPayloadRepositoryMock.remove.mockResolvedValue(undefined);
  });

  it("reenvia com sucesso apos refetch sem depender de dataUrl", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("pending", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValueOnce(pendingPayload);
    photoRepositoryMock.save.mockResolvedValueOnce({
      id: "photo_1",
      storageKey: "media/photo_1",
      name: "foto.jpg",
      mimeType: "image/jpeg",
      size: 100
    });

    const output = await inspectionService.retryPhotoSync(
      "inspection_1",
      "loc_1",
      "item_1",
      "photo_1"
    );

    const photo = output?.locations[0].items[0].photos[0];
    expect(photo?.syncStatus).toBe("synced");
    expect(photo?.storageKey).toBe("media/photo_1");
    expect(photo?.dataUrl).toBeUndefined();
    expect(photo?.retryDataAvailable).toBe(false);
    expect(photoRetryPayloadRepositoryMock.remove).toHaveBeenCalledWith("photo_1");
  });

  it("marca pending com dado local disponivel ao carregar vistoria", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("pending", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValueOnce(pendingPayload);

    const output = await inspectionService.getInspectionById("inspection_1");
    const photo = output?.locations[0].items[0].photos[0];

    expect(photo?.syncStatus).toBe("pending");
    expect(photo?.retryDataAvailable).toBe(true);
  });

  it("marca failed com dado local disponivel ao carregar vistoria", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("failed", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValueOnce(pendingPayload);

    const output = await inspectionService.getInspectionById("inspection_1");
    const photo = output?.locations[0].items[0].photos[0];

    expect(photo?.syncStatus).toBe("failed");
    expect(photo?.retryDataAvailable).toBe(true);
  });

  it("marca failed sem retry quando nao ha dado local para reenvio", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("pending", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValueOnce(null);

    const output = await inspectionService.retryPhotoSync(
      "inspection_1",
      "loc_1",
      "item_1",
      "photo_1"
    );

    const photo = output?.locations[0].items[0].photos[0];
    expect(photo?.syncStatus).toBe("failed");
    expect(photo?.retryDataAvailable).toBe(false);
    expect(photo?.syncErrorMessage).toContain("Reanexe a foto");
  });

  it("transiciona failed para synced com dado local persistido", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("failed", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValueOnce(pendingPayload);
    photoRepositoryMock.save.mockResolvedValueOnce({
      id: "photo_1",
      storageKey: "media/photo_1",
      name: "foto.jpg",
      mimeType: "image/jpeg",
      size: 100
    });

    const output = await inspectionService.retryPhotoSync(
      "inspection_1",
      "loc_1",
      "item_1",
      "photo_1"
    );

    const photo = output?.locations[0].items[0].photos[0];
    expect(photo?.syncStatus).toBe("synced");
    expect(photo?.retryDataAvailable).toBe(false);
  });

  it("mantem foto pending com retry disponivel quando erro transiente persiste", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(
      createInspection("pending", { includeDataUrl: false })
    );
    photoRetryPayloadRepositoryMock.get.mockResolvedValue(pendingPayload);
    photoRepositoryMock.save.mockRejectedValueOnce(
      new HttpClientTimeoutError({
        method: "POST",
        url: "/media/photos",
        timeoutMs: 15000
      })
    );

    const output = await inspectionService.retryPhotoSync(
      "inspection_1",
      "loc_1",
      "item_1",
      "photo_1"
    );

    const photo = output?.locations[0].items[0].photos[0];
    expect(photo?.syncStatus).toBe("pending");
    expect(photo?.retryDataAvailable).toBe(true);
    expect(photo?.syncErrorMessage).toContain("Timeout");
  });
});
