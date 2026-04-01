import { describe, expect, it } from "vitest";
import type { UserSession } from "@/domain/types/auth";
import { accessControlService } from "@/services/auth/accessControlService";

const baseSession = (
  role: UserSession["role"]
): UserSession => ({
  userId: "user_1",
  fullName: "Teste",
  email: "teste@empresa.com.br",
  role,
  loginAt: new Date().toISOString()
});

describe("accessControlService", () => {
  it("concede permissao total para admin", () => {
    const session = baseSession("admin");

    expect(accessControlService.hasPermission(session, "inspection:create")).toBe(true);
    expect(accessControlService.hasPermission(session, "inspection:edit")).toBe(true);
    expect(accessControlService.hasPermission(session, "inspection:view")).toBe(true);
    expect(accessControlService.hasPermission(session, "auth:manage-users")).toBe(true);
  });

  it("restringe inspector sem acesso de gestao de usuarios", () => {
    const session = baseSession("inspector");

    expect(accessControlService.hasPermission(session, "inspection:create")).toBe(true);
    expect(accessControlService.hasPermission(session, "inspection:edit")).toBe(true);
    expect(accessControlService.hasPermission(session, "inspection:view")).toBe(true);
    expect(accessControlService.hasPermission(session, "auth:manage-users")).toBe(false);
  });

  it("permite viewer somente em visualizacao", () => {
    const session = baseSession("viewer");

    expect(accessControlService.hasPermission(session, "inspection:view")).toBe(true);
    expect(accessControlService.hasPermission(session, "inspection:create")).toBe(false);
    expect(accessControlService.hasPermission(session, "inspection:edit")).toBe(false);
    expect(accessControlService.hasPermission(session, "auth:manage-users")).toBe(false);
  });

  it("nega acesso quando nao ha sessao", () => {
    expect(accessControlService.hasPermission(null, "inspection:view")).toBe(false);
  });

  it("valida qualquer permissao com canAny", () => {
    const viewer = baseSession("viewer");
    const inspector = baseSession("inspector");

    expect(accessControlService.canAny(viewer, ["inspection:create", "inspection:view"])).toBe(
      true
    );
    expect(
      accessControlService.canAny(viewer, ["inspection:create", "auth:manage-users"])
    ).toBe(false);
    expect(
      accessControlService.canAny(inspector, ["auth:manage-users", "inspection:edit"])
    ).toBe(true);
  });
});

