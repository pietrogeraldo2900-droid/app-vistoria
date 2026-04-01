import type { InspectionRecord } from "@/domain/types/inspection";
import type { InspectionRepositoryContract } from "@/persistence/contracts/inspectionRepositoryContract";
import { createInspectionRepository } from "@/persistence/factories/createInspectionRepository";

export type { InspectionRepositoryContract } from "@/persistence/contracts/inspectionRepositoryContract";

const resolveRepository = (): InspectionRepositoryContract => createInspectionRepository();

export const inspectionRepository: InspectionRepositoryContract = {
  async list(): Promise<InspectionRecord[]> {
    return resolveRepository().list();
  },

  async getById(inspectionId: string): Promise<InspectionRecord | undefined> {
    return resolveRepository().getById(inspectionId);
  },

  async upsert(record: InspectionRecord): Promise<InspectionRecord> {
    return resolveRepository().upsert(record);
  }
};
