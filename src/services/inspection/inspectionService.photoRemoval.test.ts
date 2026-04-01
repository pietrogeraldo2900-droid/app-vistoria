import { beforeEach, describe, expect, it, vi } from "vitest";
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

const createInspectionRecord = (): InspectionRecord => ({
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
              storageKey: "media/photo_1",
              syncStatus: "synced"
            }
          ]
        }
      ]
    }
  ]
});

describe("inspectionService photo removal robustness", () => {
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
    photoRetryPayloadRepositoryMock.remove.mockResolvedValue(undefined);
  });

  it("cancela remocao de foto quando delete remoto falha (consistencia forte)", async () => {
    inspectionRepositoryMock.getById.mockResolvedValueOnce(createInspectionRecord());
    photoRepositoryMock.remove.mockRejectedValueOnce(new Error("remote delete failed"));

    await expect(
      inspectionService.removePhotoFromItem("inspection_1", "loc_1", "item_1", "photo_1")
    ).rejects.toThrow("Operacao cancelada para manter consistencia dos registros.");

    expect(photoRepositoryMock.remove).toHaveBeenCalledWith("media/photo_1");
    expect(inspectionRepositoryMock.upsert).not.toHaveBeenCalled();
  });
});
