import type { InspectionRepositoryContract } from "@/persistence/contracts/inspectionRepositoryContract";
import { localInspectionRepository } from "@/persistence/local/localInspectionRepository";
import { repositoryMode } from "@/persistence/repositoryMode";
import { remoteInspectionRepository } from "@/persistence/remote/remoteInspectionRepository";

export const createInspectionRepository = (): InspectionRepositoryContract => {
  if (repositoryMode.getFor("inspection") === "remote") {
    return remoteInspectionRepository;
  }
  return localInspectionRepository;
};
