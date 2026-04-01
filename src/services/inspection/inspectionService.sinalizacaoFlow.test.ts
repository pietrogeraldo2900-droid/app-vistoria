import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionRecord } from "@/domain/types/inspection";

const pdfState = vi.hoisted(() => ({
  savedFiles: [] as string[],
  textCalls: [] as string[]
}));

const repositoryState = vi.hoisted(() => ({
  records: new Map<string, InspectionRecord>()
}));

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

vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210
      }
    };

    addPage(): void {}
    setFillColor(..._args: number[]): void {}
    rect(..._args: number[]): void {}
    setTextColor(..._args: number[]): void {}
    setFont(..._args: string[]): void {}
    setFontSize(..._args: number[]): void {}
    setDrawColor(..._args: number[]): void {}
    roundedRect(..._args: number[]): void {}
    addImage(..._args: unknown[]): void {}

    splitTextToSize(content: string): string[] {
      return [content];
    }

    text(content: string): void {
      pdfState.textCalls.push(content);
    }

    save(fileName: string): void {
      pdfState.savedFiles.push(fileName);
    }
  }

  return { jsPDF: MockJsPDF };
});

import { pdfExportService } from "@/export/pdf/pdfExportService";
import { inspectionService } from "@/services/inspection/inspectionService";

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("inspectionService + preview + pdf (sinalizacao extintor de po)", () => {
  beforeEach(() => {
    pdfState.savedFiles.length = 0;
    pdfState.textCalls.length = 0;
    repositoryState.records.clear();

    inspectionRepositoryMock.list.mockReset();
    inspectionRepositoryMock.getById.mockReset();
    inspectionRepositoryMock.upsert.mockReset();
    photoRepositoryMock.save.mockReset();
    photoRepositoryMock.get.mockReset();
    photoRepositoryMock.remove.mockReset();
    photoRetryPayloadRepositoryMock.save.mockReset();
    photoRetryPayloadRepositoryMock.get.mockReset();
    photoRetryPayloadRepositoryMock.remove.mockReset();

    inspectionRepositoryMock.list.mockImplementation(async () =>
      [...repositoryState.records.values()].map((record) => deepClone(record))
    );

    inspectionRepositoryMock.getById.mockImplementation(async (inspectionId: string) => {
      const record = repositoryState.records.get(inspectionId);
      return record ? deepClone(record) : undefined;
    });

    inspectionRepositoryMock.upsert.mockImplementation(async (record: InspectionRecord) => {
      const clone = deepClone(record);
      repositoryState.records.set(record.id, clone);
      return deepClone(clone);
    });

    photoRetryPayloadRepositoryMock.get.mockResolvedValue(null);
    photoRetryPayloadRepositoryMock.remove.mockResolvedValue(undefined);
    photoRepositoryMock.get.mockResolvedValue(null);
  });

  it("executa cadastro, gera preview e exporta PDF com regra sinalizacao_extintor_po", async () => {
    const inspection = await inspectionService.createInspection({
      title: "Vistoria sinalizacao",
      companyName: "Empresa Exemplo",
      unitName: "Unidade Centro",
      address: "Rua Um, 100",
      city: "Sao Paulo",
      clientName: "Cliente Exemplo",
      contractCode: "CTR-2026-04",
      inspectionType: "periodica",
      generalObservation: "",
      inspectorName: "Tecnico",
      state: "SP",
      inspectionDate: "2026-04-01"
    });

    const withLocation = await inspectionService.addLocation(inspection.id, { name: "G1" });
    expect(withLocation).toBeDefined();
    const locationId = withLocation!.locations[0].id;

    const withItem = await inspectionService.addItemToLocation(inspection.id, locationId, {
      itemKey: "sinalizacao",
      status: "nao_conforme",
      fieldValues: {
        instalada: "nao",
        tipo_fotoluminescente: "nao",
        sinalizacao_extintor_po: "sim"
      },
      photos: []
    });

    expect(withItem).toBeDefined();

    const lines = await inspectionService.generateReportLines(inspection.id);
    expect(lines).toHaveLength(1);
    expect(lines[0].isTechnicalPending).toBe(false);
    expect(lines[0].text.startsWith("Galp")).toBe(true);
    expect(lines[0].text).toContain("extintor");
    expect(lines[0].text).toContain("IT 20/2025");

    const refreshedInspection = await inspectionService.getInspectionById(inspection.id);
    expect(refreshedInspection).toBeDefined();

    const result = await pdfExportService.exportInspectionToPdf(
      pdfExportService.preparePayload(refreshedInspection!, lines)
    );

    expect(result.exportedLines).toBe(1);
    expect(pdfState.savedFiles).toHaveLength(1);
    expect(
      pdfState.textCalls.some(
        (entry) => entry.includes("extintor") && entry.includes("IT 20/2025")
      )
    ).toBe(true);
  });
});
