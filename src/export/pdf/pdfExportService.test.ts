import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionRecord, ReportLine } from "@/domain/types/inspection";
import { pdfExportService } from "@/export/pdf/pdfExportService";

const pdfMockState = vi.hoisted(() => ({
  savedFiles: [] as string[],
  textCalls: [] as string[]
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

    text(content: string): void {
      pdfMockState.textCalls.push(content);
    }

    setDrawColor(..._args: number[]): void {}

    roundedRect(..._args: number[]): void {}

    splitTextToSize(content: string): string[] {
      return [content];
    }

    save(fileName: string): void {
      pdfMockState.savedFiles.push(fileName);
    }
  }

  return { jsPDF: MockJsPDF };
});

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
});

