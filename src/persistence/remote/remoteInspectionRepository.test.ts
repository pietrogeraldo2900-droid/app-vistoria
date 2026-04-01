import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionRecord } from "@/domain/types/inspection";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/infrastructure/http/backendGateway", () => ({
  backendGateway: {
    request: requestMock
  }
}));

import { remoteInspectionRepository } from "@/persistence/remote/remoteInspectionRepository";

const createInspectionRecord = (): InspectionRecord => ({
  id: "inspection_1",
  title: "Vistoria mensal",
  companyName: "Empresa Atlas",
  unitName: "Unidade Centro",
  address: "Rua A, 100",
  city: "Sao Paulo",
  clientName: "Cliente XPTO",
  contractCode: "CTR-01",
  inspectionType: "periodica",
  generalObservation: "",
  inspectorName: "Inspetor 1",
  state: "SP",
  inspectionDate: "2026-03-31",
  createdAt: "2026-03-31T11:00:00.000Z",
  updatedAt: "2026-03-31T11:00:00.000Z",
  locations: []
});

describe("remoteInspectionRepository", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("lista vistorias usando endpoint remoto previsto", async () => {
    requestMock.mockResolvedValueOnce({
      items: [
        {
          id: "inspection_1",
          title: "Vistoria mensal",
          company_name: "Empresa Atlas",
          unit_name: "Unidade Centro",
          address: "Rua A, 100",
          city: "Sao Paulo",
          client_name: "Cliente XPTO",
          contract_code: "CTR-01",
          inspection_type: "periodica",
          general_observation: "",
          inspector_name: "Inspetor 1",
          state: "SP",
          inspection_date: "2026-03-31",
          created_at: "2026-03-31T11:00:00.000Z",
          updated_at: "2026-03-31T11:00:00.000Z"
        }
      ]
    });

    const output = await remoteInspectionRepository.list();

    expect(requestMock).toHaveBeenCalledWith(
      "inspection.list",
      { method: "GET", path: "/inspections" },
      { responseType: "json" }
    );
    expect(output).toHaveLength(1);
    expect(output[0].companyName).toBe("Empresa Atlas");
    expect(output[0].locations).toEqual([]);
  });

  it("retorna undefined para getById com 404", async () => {
    requestMock.mockRejectedValueOnce(
      new HttpClientResponseError({
        method: "GET",
        url: "https://api.app-vistoria.test/inspections/not-found",
        status: 404,
        statusText: "Not Found",
        responseBody: null
      })
    );

    const output = await remoteInspectionRepository.getById("not-found");

    expect(requestMock).toHaveBeenCalledWith(
      "inspection.getById",
      { method: "GET", path: "/inspections/not-found" },
      { responseType: "json" }
    );
    expect(output).toBeUndefined();
  });

  it("faz upsert com PUT e fallback para POST em 404", async () => {
    const input = createInspectionRecord();

    requestMock
      .mockRejectedValueOnce(
        new HttpClientResponseError({
          method: "PUT",
          url: "https://api.app-vistoria.test/inspections/inspection_1",
          status: 404,
          statusText: "Not Found",
          responseBody: null
        })
      )
      .mockResolvedValueOnce({
        id: "inspection_1",
        title: "Vistoria mensal",
        company_name: "Empresa Atlas",
        unit_name: "Unidade Centro",
        address: "Rua A, 100",
        city: "Sao Paulo",
        client_name: "Cliente XPTO",
        contract_code: "CTR-01",
        inspection_type: "periodica",
        general_observation: "",
        inspector_name: "Inspetor 1",
        state: "SP",
        inspection_date: "2026-03-31",
        created_at: "2026-03-31T11:00:00.000Z",
        updated_at: "2026-03-31T11:10:00.000Z",
        locations: []
      });

    const output = await remoteInspectionRepository.upsert(input);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "inspection.upsert",
      { method: "PUT", path: "/inspections/inspection_1" },
      expect.objectContaining({
        responseType: "json",
        body: expect.objectContaining({
          id: "inspection_1",
          company_name: "Empresa Atlas"
        })
      })
    );

    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "inspection.create",
      { method: "POST", path: "/inspections" },
      expect.objectContaining({
        responseType: "json"
      })
    );

    expect(output.id).toBe("inspection_1");
    expect(output.updatedAt).toBe("2026-03-31T11:10:00.000Z");
  });

  it("envia apenas metadados de foto no payload agregado de upsert", async () => {
    const input = createInspectionRecord();
    input.locations = [
      {
        id: "loc_1",
        name: "G1",
        items: [
          {
            id: "item_1",
            itemKey: "extintor",
            status: "conforme",
            fieldValues: {},
            generatedText: "Galpao 1 - Os extintores estao em conformidade.",
            createdAt: "2026-03-31T11:00:00.000Z",
            photos: [
              {
                id: "photo_1",
                name: "foto.jpg",
                mimeType: "image/jpeg",
                size: 123,
                storageKey: "media/photo_1",
                dataUrl: "data:image/jpeg;base64,abc",
                retryDataAvailable: true,
                syncStatus: "synced"
              }
            ]
          }
        ]
      }
    ];

    requestMock.mockResolvedValueOnce({
      id: "inspection_1",
      updated_at: "2026-03-31T11:11:00.000Z"
    });

    await remoteInspectionRepository.upsert(input);

    const upsertOptions = requestMock.mock.calls[0]?.[2] as
      | { body?: { locations?: Array<{ items?: Array<{ photos?: unknown[] }> }> } }
      | undefined;
    expect(upsertOptions).toBeDefined();

    const firstPhoto = upsertOptions?.body?.locations?.[0]?.items?.[0]?.photos?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(upsertOptions?.body?.locations?.[0]?.items?.[0]?.photos).toEqual([
      expect.objectContaining({
        id: "photo_1",
        name: "foto.jpg",
        mime_type: "image/jpeg",
        size: 123,
        storage_key: "media/photo_1",
        sync_status: "synced"
      })
    ]);
    expect(
      Object.prototype.hasOwnProperty.call(
        firstPhoto,
        "data_url"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        firstPhoto,
        "retry_data_available"
      )
    ).toBe(false);
  });
});
