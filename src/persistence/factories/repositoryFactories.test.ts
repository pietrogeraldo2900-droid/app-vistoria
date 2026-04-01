import { beforeEach, describe, expect, it } from "vitest";
import { createAuthRepository } from "@/persistence/factories/createAuthRepository";
import { createInspectionRepository } from "@/persistence/factories/createInspectionRepository";
import { createPhotoRepository } from "@/persistence/factories/createPhotoRepository";
import { localAuthRepository } from "@/persistence/local/localAuthRepository";
import { localInspectionRepository } from "@/persistence/local/localInspectionRepository";
import { localPhotoRepository } from "@/persistence/local/localPhotoRepository";
import { remoteAuthRepository } from "@/persistence/remote/remoteAuthRepository";
import { remoteInspectionRepository } from "@/persistence/remote/remoteInspectionRepository";
import { remotePhotoRepository } from "@/persistence/remote/remotePhotoRepository";
import { repositoryMode } from "@/persistence/repositoryMode";

describe("repository factories", () => {
  beforeEach(() => {
    repositoryMode.reset();
    repositoryMode.set("local", { persist: false });
  });

  it("retorna implementacoes locais no modo local", () => {
    expect(createAuthRepository()).toBe(localAuthRepository);
    expect(createInspectionRepository()).toBe(localInspectionRepository);
    expect(createPhotoRepository()).toBe(localPhotoRepository);
  });

  it("retorna implementacoes remotas no modo remoto", () => {
    repositoryMode.set("remote", { persist: false });

    expect(createAuthRepository()).toBe(remoteAuthRepository);
    expect(createInspectionRepository()).toBe(remoteInspectionRepository);
    expect(createPhotoRepository()).toBe(remotePhotoRepository);
  });

  it("permite habilitar remoto apenas para inspections", () => {
    repositoryMode.set("local", { persist: false });
    repositoryMode.setFor("inspection", "remote", { persist: false });

    expect(createAuthRepository()).toBe(localAuthRepository);
    expect(createInspectionRepository()).toBe(remoteInspectionRepository);
    expect(createPhotoRepository()).toBe(localPhotoRepository);
  });
});
