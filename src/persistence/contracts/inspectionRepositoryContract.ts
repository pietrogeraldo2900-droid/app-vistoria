import type { InspectionRecord } from "@/domain/types/inspection";

export interface InspectionRepositoryContract {
  list(): Promise<InspectionRecord[]>;
  getById(inspectionId: string): Promise<InspectionRecord | undefined>;
  upsert(record: InspectionRecord): Promise<InspectionRecord>;
}
