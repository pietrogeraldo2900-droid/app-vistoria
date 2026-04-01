import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionRecord, ReportLine } from "@/domain/types/inspection";

const pdfMockState = vi.hoisted(() => ({
  savedFiles: [] as string[],
  textCalls: [] as string[],
  addImageCalls: [] as Array<{ x: number; y: number; width: number; height: number }>,
  addPageCalls: 0
}));

const photoRepositoryMock = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock("@/persistence/photoRepository", () => ({
  photoRepository: {
    get: photoRepositoryMock.get
  }
}));

vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210
      }
    };

    addPage(): void {
      pdfMockState.addPageCalls += 1;
    }

    setFillColor(..._args: number[]): void {}

    rect(..._args: number[]): void {}

    setTextColor(..._args: number[]): void {}

    setFont(..._args: string[]): void {}

    setFontSize(..._args: number[]): void {}

    text(content: string): void {
      pdfMockState.textCalls.push(content);
    }

    setDrawColor(..._args: number[]): void {}

    roundedRect(..._args: number[]): void {}

    addImage(
      _data: string,
      _format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void {
      pdfMockState.addImageCalls.push({ x, y, width, height });
    }

    splitTextToSize(content: string): string[] {
      return [content];
    }

    save(fileName: string): void {
      pdfMockState.savedFiles.push(fileName);
    }
  }

  return { jsPDF: MockJsPDF };
});

import { pdfExportService } from "@/export/pdf/pdfExportService";

const createInspection = (): InspectionRecord => ({
  id: "inspection_1",
  title: "Vistoria mensal unidade centro",
  companyName: "Empresa Teste",
  unitName: "Unidade Centro",
  address: "Rua Um, 100",
  city: "Sao Paulo",
  clientName: "Cliente XPTO",
  contractCode: "CTR-01",
  inspectionType: "periodica",
  generalObservation: "Sem observacoes criticas.",
  inspectorName: "Inspetor QA",
  state: "SP",
  inspectionDate: "2026-03-31",
  createdAt: "2026-03-31T10:00:00.000Z",
  updatedAt: "2026-03-31T10:00:00.000Z",
  locations: []
});

const createBaseLine = (overrides: Partial<ReportLine>): ReportLine => ({
  locationId: "loc_1",
  locationName: "Sala tecnica",
  itemId: "item_1",
  itemKey: "detector_fumaca",
  status: "nao_conforme",
  text: "Sala tecnica - Devera ser feita a instalacao de detector de fumaca.",
  ...overrides
});

describe("pdfExportService", () => {
  beforeEach(() => {
    pdfMockState.savedFiles.length = 0;
    pdfMockState.textCalls.length = 0;
    pdfMockState.addImageCalls.length = 0;
    pdfMockState.addPageCalls = 0;
    photoRepositoryMock.get.mockReset();
  });

  it("prepara payload para exportacao", () => {
    const inspection = createInspection();
    const lines = [createBaseLine({})];

    const payload = pdfExportService.preparePayload(inspection, lines);

    expect(payload.inspection).toBe(inspection);
    expect(payload.reportLines).toBe(lines);
  });

  it("bloqueia exportacao quando nao ha linhas finais homologadas", async () => {
    const inspection = createInspection();
    const lines = [
      createBaseLine({
        text: "",
        isTechnicalPending: true,
        technicalPendingReason: "sem template"
      }),
      createBaseLine({
        itemId: "item_2",
        text: "   "
      })
    ];

    await expect(
      pdfExportService.exportInspectionToPdf(
        pdfExportService.preparePayload(inspection, lines)
      )
    ).rejects.toThrow("Nao ha linhas finais homologadas disponiveis para exportacao em PDF.");
  });

  it("exporta somente linhas finais sem pendencias tecnicas internas", async () => {
    const inspection = createInspection();
    const finalLine1 =
      "Sala tecnica - Devera ser feita a instalacao de detector de fumaca, conforme IT 19/2025.";
    const finalLine2 =
      "Galpao 1 - O shaft de incendio devera ser desobstruido, garantindo livre acesso.";
    const pendingLine = "Sala tecnica - Pendencia interna sem template homologado.";

    const lines = [
      createBaseLine({ itemId: "item_final_1", text: finalLine1 }),
      createBaseLine({
        itemId: "item_pending",
        text: pendingLine,
        isTechnicalPending: true,
        technicalPendingReason: "sem template"
      }),
      createBaseLine({ itemId: "item_empty", text: " " }),
      createBaseLine({
        itemId: "item_final_2",
        locationId: "loc_2",
        locationName: "Galpao 1",
        itemKey: "shaft_incendio",
        text: finalLine2
      })
    ];

    const result = await pdfExportService.exportInspectionToPdf(
      pdfExportService.preparePayload(inspection, lines)
    );

    expect(result.exportedLines).toBe(2);
    expect(result.fileName).toBe(
      "relatorio_prt_empresa_teste_unidade_centro_2026-03-31.pdf"
    );
    expect(pdfMockState.savedFiles).toEqual([result.fileName]);

    expect(pdfMockState.textCalls.some((entry) => entry.includes(finalLine1))).toBe(true);
    expect(pdfMockState.textCalls.some((entry) => entry.includes(finalLine2))).toBe(true);
    expect(pdfMockState.textCalls.some((entry) => entry.includes(pendingLine))).toBe(false);
  });

  it("inclui fotos sincronizadas em grid padronizado e avisa fotos nao sincronizadas", async () => {
    const inspection = createInspection();
    inspection.locations = [
      {
        id: "loc_1",
        name: "Sala tecnica",
        items: [
          {
            id: "item_1",
            itemKey: "detector_fumaca",
            status: "nao_conforme",
            fieldValues: {},
            generatedText:
              "Sala tecnica - Devera ser feita a instalacao de detector de fumaca.",
            createdAt: "2026-03-31T10:00:00.000Z",
            photos: [
              {
                id: "photo_sync_1",
                storageKey: "photo_sync_1",
                name: "foto-sincronizada-1.jpg",
                mimeType: "image/jpeg",
                size: 1200,
                syncStatus: "synced"
              },
              {
                id: "photo_failed_1",
                name: "foto-falha.jpg",
                mimeType: "image/jpeg",
                size: 1200,
                syncStatus: "failed",
                syncErrorMessage: "Falha de sincronizacao no upload."
              },
              {
                id: "photo_sync_2",
                storageKey: "photo_sync_2",
                name: "foto-sincronizada-2.jpg",
                mimeType: "image/jpeg",
                size: 1300,
                syncStatus: "synced"
              }
            ]
          }
        ]
      }
    ];

    photoRepositoryMock.get.mockImplementation((storageKey: string) => {
      if (storageKey === "photo_sync_1" || storageKey === "photo_sync_2") {
        return Promise.resolve(new Blob(["fake-image"], { type: "image/jpeg" }));
      }
      return Promise.resolve(null);
    });

    const result = await pdfExportService.exportInspectionToPdf(
      pdfExportService.preparePayload(inspection, [createBaseLine({})])
    );

    expect(result.exportedLines).toBe(1);
    expect(photoRepositoryMock.get.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      "photo_sync_1",
      "photo_sync_2"
    ]);

    expect(pdfMockState.addImageCalls).toHaveLength(2);
    expect(pdfMockState.addImageCalls[0].width).toBeGreaterThan(0);
    expect(pdfMockState.addImageCalls[0].height).toBeGreaterThan(0);
    expect(pdfMockState.addImageCalls[0].width).toBe(pdfMockState.addImageCalls[1].width);
    expect(pdfMockState.addImageCalls[0].height).toBe(pdfMockState.addImageCalls[1].height);

    expect(
      pdfMockState.textCalls.some((entry) =>
        entry.includes("PENDENCIAS DE EVIDENCIA FOTOGRAFICA")
      )
    ).toBe(true);
    expect(
      pdfMockState.textCalls.some((entry) => entry.includes("foto-falha.jpg"))
    ).toBe(true);
  });
});
