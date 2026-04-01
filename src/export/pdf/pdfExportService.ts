import inspectionItemsData from "@data/inspection_items.json";
import type {
  InspectionRecord,
  InspectionStatus,
  ItemPhoto,
  ReportLine
} from "@/domain/types/inspection";
import { photoRepository } from "@/persistence/photoRepository";

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

interface InspectionItemsJson {
  items: Array<{
    key: string;
    label: string;
  }>;
}

interface PhotoEvidenceEntry {
  locationName: string;
  itemKey: string;
  itemLabel: string;
  status: InspectionStatus;
  statusLabel: string;
  photoName: string;
  photoDataUrl: string;
  mimeType: string;
}

interface PhotoEvidenceSkip {
  locationName: string;
  itemLabel: string;
  statusLabel: string;
  photoName: string;
  reason: string;
}

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_Y = 14;
const PAGE_BOTTOM = 284;
const MAX_LINE_WIDTH = 178;
const LINE_HEIGHT = 5.4;

const PHOTO_GRID_COLUMNS = 2;
const PHOTO_GRID_GAP_X = 6;
const PHOTO_GRID_GAP_Y = 6;
const PHOTO_CARD_HEIGHT = 82;
const PHOTO_THUMB_HEIGHT = 56;
const PHOTO_CARD_PADDING = 2;

const inspectionTypeLabelMap = {
  inicial: "Inicial",
  periodica: "Periodica",
  retorno: "Retorno",
  extraordinaria: "Extraordinaria"
} as const;

const statusLabelMap: Record<InspectionStatus, string> = {
  conforme: "Conforme",
  nao_conforme: "Nao conforme",
  em_manutencao: "Em manutencao",
  sem_acesso: "Sem acesso",
  nao_testado: "Nao testado"
};

const inspectionCatalog = inspectionItemsData as InspectionItemsJson;
const itemLabelByKey = new Map<string, string>(
  inspectionCatalog.items.map((item) => [item.key, item.label])
);

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

const formatInspectionDate = (value: string): string => {
  if (!value || !value.trim()) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
};

const resolveItemLabel = (itemKey: string): string => itemLabelByKey.get(itemKey) ?? itemKey;

const resolvePhotoSkipReason = (photo: ItemPhoto): string => {
  if (photo.syncStatus === "pending") {
    return photo.syncErrorMessage?.trim() || "Foto pendente de sincronizacao remota.";
  }

  if (photo.syncStatus === "failed") {
    return photo.syncErrorMessage?.trim() || "Falha de sincronizacao remota da foto.";
  }

  return "Foto sem sincronizacao confirmada para evidencia final.";
};

const resolveImageFormat = (mimeType: string): "PNG" | "JPEG" => {
  if (mimeType.toLowerCase().includes("png")) {
    return "PNG";
  }

  return "JPEG";
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  const maybeBuffer = (globalThis as unknown as {
    Buffer?: {
      from(input: string, encoding: string): { toString(encoding: string): string };
    };
  }).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(binary, "binary").toString("base64");
  }

  throw new Error("Nao foi possivel codificar blob em base64 para exportacao.");
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  if (typeof FileReader !== "undefined") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao processar blob da foto para PDF."));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  }

  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${base64}`;
};

const createPdfCoverDataUrl = async (
  dataUrl: string,
  mimeType: string,
  targetRatio: number
): Promise<string> => {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.width <= 0 || image.height <= 0 || !Number.isFinite(targetRatio) || targetRatio <= 0) {
        resolve(dataUrl);
        return;
      }

      const canvasWidth = 1200;
      const canvasHeight = Math.max(1, Math.round(canvasWidth / targetRatio));
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }

      const scale = Math.max(canvasWidth / image.width, canvasHeight / image.height);
      const renderWidth = image.width * scale;
      const renderHeight = image.height * scale;
      const offsetX = (canvasWidth - renderWidth) / 2;
      const offsetY = (canvasHeight - renderHeight) / 2;

      context.drawImage(image, offsetX, offsetY, renderWidth, renderHeight);

      const format = resolveImageFormat(mimeType);
      const outputMimeType = format === "PNG" ? "image/png" : "image/jpeg";
      resolve(
        canvas.toDataURL(outputMimeType, format === "PNG" ? undefined : 0.9)
      );
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
};

const collectPhotoEvidence = async (
  inspection: InspectionRecord
): Promise<{ evidences: PhotoEvidenceEntry[]; skipped: PhotoEvidenceSkip[] }> => {
  const evidences: PhotoEvidenceEntry[] = [];
  const skipped: PhotoEvidenceSkip[] = [];

  for (const location of inspection.locations) {
    for (const item of location.items) {
      const itemLabel = resolveItemLabel(item.itemKey);
      const statusLabel = statusLabelMap[item.status];

      for (const photo of item.photos) {
        const baseSkipContext = {
          locationName: location.name,
          itemLabel,
          statusLabel,
          photoName: photo.name
        };

        if (photo.syncStatus !== "synced") {
          skipped.push({
            ...baseSkipContext,
            reason: resolvePhotoSkipReason(photo)
          });
          continue;
        }

        const photoStorageKey = photo.storageKey || photo.id;
        if (!photoStorageKey) {
          skipped.push({
            ...baseSkipContext,
            reason: "Foto sem chave de armazenamento para recuperacao."
          });
          continue;
        }

        try {
          const blob = await photoRepository.get(photoStorageKey);
          if (!blob) {
            skipped.push({
              ...baseSkipContext,
              reason: "Arquivo da foto nao encontrado no repositiorio de midia."
            });
            continue;
          }

          const photoDataUrl = await blobToDataUrl(blob);
          evidences.push({
            locationName: location.name,
            itemKey: item.itemKey,
            itemLabel,
            status: item.status,
            statusLabel,
            photoName: photo.name,
            photoDataUrl,
            mimeType: photo.mimeType || blob.type || "image/jpeg"
          });
        } catch (error) {
          const reason =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Falha ao carregar foto para evidência no PDF.";

          skipped.push({
            ...baseSkipContext,
            reason
          });
        }
      }
    }
  }

  return { evidences, skipped };
};

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
    const photoEvidence = await collectPhotoEvidence(payload.inspection);

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      format: "a4",
      orientation: "portrait",
      unit: "mm"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const photoCardWidth =
      (pageWidth - PAGE_MARGIN_X * 2 - PHOTO_GRID_GAP_X * (PHOTO_GRID_COLUMNS - 1)) /
      PHOTO_GRID_COLUMNS;

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

    cursorY += 2;
    writeWrappedText("EVIDENCIAS FOTOGRAFICAS", {
      bold: true,
      size: 11.5,
      color: [15, 118, 110],
      after: 1
    });

    if (photoEvidence.evidences.length === 0) {
      writeWrappedText(
        "Nenhuma evidencia fotografica sincronizada foi encontrada para esta vistoria.",
        {
          size: 10,
          after: 1
        }
      );
    } else {
      let activeRowTop = cursorY;
      let activeColumn = 0;

      for (const evidence of photoEvidence.evidences) {
        if (activeColumn === 0) {
          ensureSpace(PHOTO_CARD_HEIGHT + PHOTO_GRID_GAP_Y);
          activeRowTop = cursorY;
        }

        const cardX =
          PAGE_MARGIN_X + activeColumn * (photoCardWidth + PHOTO_GRID_GAP_X);
        const cardY = activeRowTop;

        doc.setDrawColor(215, 220, 224);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(cardX, cardY, photoCardWidth, PHOTO_CARD_HEIGHT, 1.5, 1.5, "FD");

        const imageX = cardX + PHOTO_CARD_PADDING;
        const imageY = cardY + PHOTO_CARD_PADDING;
        const imageWidth = photoCardWidth - PHOTO_CARD_PADDING * 2;
        const imageHeight = PHOTO_THUMB_HEIGHT;

        doc.setFillColor(245, 246, 247);
        doc.rect(imageX, imageY, imageWidth, imageHeight, "F");

        try {
          const coverDataUrl = await createPdfCoverDataUrl(
            evidence.photoDataUrl,
            evidence.mimeType,
            imageWidth / imageHeight
          );

          doc.addImage(
            coverDataUrl,
            resolveImageFormat(evidence.mimeType),
            imageX,
            imageY,
            imageWidth,
            imageHeight
          );
        } catch {
          doc.setTextColor(142, 142, 142);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.8);
          doc.text("Falha ao renderizar foto", imageX + 2, imageY + 7);
        }

        const legend = [
          evidence.locationName,
          evidence.itemLabel,
          evidence.statusLabel,
          formatInspectionDate(payload.inspection.inspectionDate)
        ].join(" | ");

        doc.setTextColor(56, 58, 61);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);

        const legendLines = doc.splitTextToSize(legend, imageWidth);
        const legendY = imageY + imageHeight + 4;
        const maxLegendLines = 3;

        legendLines.slice(0, maxLegendLines).forEach((line: string, index: number) => {
          doc.text(line, imageX, legendY + index * 3.8);
        });

        doc.setTextColor(108, 117, 125);
        doc.setFontSize(8);
        const photoNameLines = doc.splitTextToSize(evidence.photoName, imageWidth);
        doc.text(photoNameLines[0] ?? evidence.photoName, imageX, cardY + PHOTO_CARD_HEIGHT - 3);

        if (activeColumn === PHOTO_GRID_COLUMNS - 1) {
          cursorY = activeRowTop + PHOTO_CARD_HEIGHT + PHOTO_GRID_GAP_Y;
          activeColumn = 0;
        } else {
          activeColumn += 1;
        }
      }

      if (activeColumn !== 0) {
        cursorY = activeRowTop + PHOTO_CARD_HEIGHT + PHOTO_GRID_GAP_Y;
      }
    }

    if (photoEvidence.skipped.length > 0) {
      cursorY += 1;
      writeWrappedText("PENDENCIAS DE EVIDENCIA FOTOGRAFICA", {
        bold: true,
        size: 11,
        color: [180, 83, 9],
        after: 0.8
      });
      writeWrappedText(
        "Fotos sem sincronizacao confirmada nao foram incluidas como evidencia final neste relatorio.",
        {
          size: 9.8,
          after: 1
        }
      );

      for (const skippedPhoto of photoEvidence.skipped) {
        writeWrappedText(
          `- ${skippedPhoto.locationName} | ${skippedPhoto.itemLabel} | ${skippedPhoto.statusLabel} | ${skippedPhoto.photoName}: ${skippedPhoto.reason}`,
          { size: 9.3, after: 0.4 }
        );
      }
    }

    const fileName = buildPdfFileName(payload.inspection);
    doc.save(fileName);

    return {
      fileName,
      exportedLines: finalLines.length
    };
  }
};
