import type { InspectionRecord } from "@/domain/types/inspection";
import type { InspectionRepositoryContract } from "@/persistence/contracts/inspectionRepositoryContract";
import { STORAGE_KEYS } from "@/persistence/storageKeys";

type RawInspection = Partial<InspectionRecord> & { id?: string };

const normalizeInspectionRecord = (raw: RawInspection): InspectionRecord | null => {
  if (!raw.id) {
    return null;
  }

  return {
    id: raw.id,
    title: raw.title ?? "",
    companyName: raw.companyName ?? "",
    unitName: raw.unitName ?? "",
    address: raw.address ?? "",
    city: raw.city ?? "",
    clientName: raw.clientName ?? "",
    contractCode: raw.contractCode ?? "",
    inspectionType: raw.inspectionType ?? "periodica",
    generalObservation: raw.generalObservation ?? "",
    inspectorName: raw.inspectorName ?? "",
    state: raw.state === "RJ" ? "RJ" : "SP",
    inspectionDate: raw.inspectionDate ?? new Date().toISOString().slice(0, 10),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    locations: Array.isArray(raw.locations) ? raw.locations : []
  };
};

const readInspections = (): InspectionRecord[] => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.inspections);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RawInspection[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeInspectionRecord(entry))
      .filter((entry): entry is InspectionRecord => entry !== null);
  } catch {
    return [];
  }
};

const writeInspections = (inspections: InspectionRecord[]): void => {
  window.localStorage.setItem(STORAGE_KEYS.inspections, JSON.stringify(inspections));
};

export const localInspectionRepository: InspectionRepositoryContract = {
  async list(): Promise<InspectionRecord[]> {
    return readInspections().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async getById(inspectionId: string): Promise<InspectionRecord | undefined> {
    return readInspections().find((inspection) => inspection.id === inspectionId);
  },

  async upsert(record: InspectionRecord): Promise<InspectionRecord> {
    const inspections = readInspections();
    const index = inspections.findIndex((inspection) => inspection.id === record.id);
    if (index >= 0) {
      inspections[index] = record;
    } else {
      inspections.push(record);
    }
    writeInspections(inspections);
    return record;
  }
};
