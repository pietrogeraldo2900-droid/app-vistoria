import type { InspectionRecord, ReportLine } from "@/domain/types/inspection";

export interface PdfExportPayload {
  inspection: InspectionRecord;
  reportLines: ReportLine[];
}

export interface PdfExportResult {
  fileName: string;
  exportedLines: number;
}

interface GroupedLines {
  locationName: string;
  lines: ReportLine[];
}

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_Y = 14;
const PAGE_BOTTOM = 284;
const MAX_LINE_WIDTH = 178;
const LINE_HEIGHT = 5.4;

const inspectionTypeLabelMap = {
  inicial: "Inicial",
  periodica: "Periodica",
  retorno: "Retorno",
  extraordinaria: "Extraordinaria"
} as const;

const sanitizeFileNameSegment = (value: string): string => {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalized || "vistoria";
};

const buildPdfFileName = (inspection: InspectionRecord): string => {
  const company = sanitizeFileNameSegment(inspection.companyName);
  const unit = sanitizeFileNameSegment(inspection.unitName || "unidade");
  const date = sanitizeFileNameSegment(inspection.inspectionDate || "sem_data");
  return `relatorio_prt_${company}_${unit}_${date}.pdf`;
};

const resolveFinalLines = (reportLines: ReportLine[]): ReportLine[] =>
  reportLines.filter((line) => !line.isTechnicalPending && line.text.trim().length > 0);

const groupLinesByLocation = (lines: ReportLine[]): GroupedLines[] => {
  const groups = new Map<string, GroupedLines>();
  for (const line of lines) {
    const existing = groups.get(line.locationName);
    if (existing) {
      existing.lines.push(line);
      continue;
    }
    groups.set(line.locationName, {
      locationName: line.locationName,
      lines: [line]
    });
  }
  return [...groups.values()];
};

const formatNow = (): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());

export const pdfExportService = {
  preparePayload(inspection: InspectionRecord, reportLines: ReportLine[]): PdfExportPayload {
    return {
      inspection,
      reportLines
    };
  },

  async exportInspectionToPdf(payload: PdfExportPayload): Promise<PdfExportResult> {
    const finalLines = resolveFinalLines(payload.reportLines);
    if (finalLines.length === 0) {
      throw new Error("Nao ha linhas finais homologadas disponiveis para exportacao em PDF.");
    }

    const groupedLines = groupLinesByLocation(finalLines);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      format: "a4",
      orientation: "portrait",
      unit: "mm"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = PAGE_MARGIN_Y;

    const ensureSpace = (requiredHeight: number): void => {
      if (cursorY + requiredHeight <= PAGE_BOTTOM) {
        return;
      }
      doc.addPage();
      cursorY = PAGE_MARGIN_Y;
    };

    const writeWrappedText = (
      text: string,
      options?: { bold?: boolean; size?: number; color?: [number, number, number]; after?: number }
    ): void => {
      const fontSize = options?.size ?? 10.5;
      const after = options?.after ?? 0;
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      if (options?.color) {
        doc.setTextColor(options.color[0], options.color[1], options.color[2]);
      } else {
        doc.setTextColor(33, 37, 41);
      }

      const lines = doc.splitTextToSize(text, MAX_LINE_WIDTH);
      ensureSpace(lines.length * LINE_HEIGHT + after);
      for (const line of lines) {
        doc.text(line, PAGE_MARGIN_X, cursorY);
        cursorY += LINE_HEIGHT;
      }
      cursorY += after;
    };

    const writeMetaLine = (label: string, value: string): void => {
      writeWrappedText(`${label}: ${value || "-"}`, { size: 10.2, after: 0.2 });
    };

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("RELATORIO TECNICO DE VISTORIA - PRT", PAGE_MARGIN_X, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    doc.text(`Gerado em ${formatNow()}`, PAGE_MARGIN_X, 17);

    cursorY = 30;
    doc.setDrawColor(205, 219, 232);
    doc.setFillColor(248, 251, 252);
    doc.roundedRect(PAGE_MARGIN_X, cursorY - 4, pageWidth - PAGE_MARGIN_X * 2, 72, 2, 2, "FD");
    cursorY += 1;

    writeWrappedText("METADADOS DA VISTORIA", {
      bold: true,
      size: 11,
      color: [15, 118, 110],
      after: 1
    });
    writeMetaLine("Titulo", payload.inspection.title);
    writeMetaLine("Empresa", payload.inspection.companyName);
    writeMetaLine("Unidade", payload.inspection.unitName);
    writeMetaLine("Endereco", payload.inspection.address);
    writeMetaLine("Cidade", payload.inspection.city);
    writeMetaLine("Cliente / Contratante", payload.inspection.clientName);
    writeMetaLine("Contrato / OS", payload.inspection.contractCode);
    writeMetaLine(
      "Tipo de vistoria",
      inspectionTypeLabelMap[payload.inspection.inspectionType]
    );
    writeMetaLine("Responsavel tecnico", payload.inspection.inspectorName);
    writeMetaLine("Estado", payload.inspection.state);
    writeMetaLine("Data da vistoria", payload.inspection.inspectionDate);
    if (payload.inspection.generalObservation.trim()) {
      writeMetaLine("Observacao geral", payload.inspection.generalObservation);
    }

    cursorY += 2;
    writeWrappedText("APONTAMENTOS TECNICOS FINAIS", {
      bold: true,
      size: 11.5,
      color: [15, 118, 110],
      after: 1
    });

    let globalIndex = 1;
    for (const group of groupedLines) {
      ensureSpace(12);
      doc.setFillColor(229, 243, 240);
      doc.roundedRect(PAGE_MARGIN_X, cursorY - 4, pageWidth - PAGE_MARGIN_X * 2, 8, 1.5, 1.5, "F");
      writeWrappedText(`Local: ${group.locationName}`, {
        bold: true,
        size: 10.8,
        color: [11, 94, 89],
        after: 2
      });

      for (const line of group.lines) {
        writeWrappedText(`${globalIndex}. ${line.text}`, { size: 10.2, after: 1.2 });
        globalIndex += 1;
      }
      cursorY += 1;
    }

    const fileName = buildPdfFileName(payload.inspection);
    doc.save(fileName);

    return {
      fileName,
      exportedLines: finalLines.length
    };
  }
};

