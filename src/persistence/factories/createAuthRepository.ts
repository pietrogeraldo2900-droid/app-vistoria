import type { AuthRepositoryContract } from "@/persistence/contracts/authRepositoryContract";
import { localAuthRepository } from "@/persistence/local/localAuthRepository";
import { repositoryMode } from "@/persistence/repositoryMode";
import { remoteAuthRepository } from "@/persistence/remote/remoteAuthRepository";

export const createAuthRepository = (): AuthRepositoryContract => {
  if (repositoryMode.getFor("auth") === "remote") {
    return remoteAuthRepository;
  }
  return localAuthRepository;
};
