import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendGatewayUnavailableError } from "@/infrastructure/http/httpClient";

const { requestMock, assertConfiguredMock, describeEndpointMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  assertConfiguredMock: vi.fn(),
  describeEndpointMock: vi.fn(() => "GET /users")
}));

vi.mock("@/infrastructure/http/backendGateway", () => ({
  backendGateway: {
    request: requestMock,
    assertConfigured: assertConfiguredMock,
    describeEndpoint: describeEndpointMock
  }
}));

import { remoteAuthRepository } from "@/persistence/remote/remoteAuthRepository";

const createMemoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    }
  };
};

describe("remoteAuthRepository", () => {
  beforeEach(() => {
    requestMock.mockReset();
    assertConfiguredMock.mockReset();
    describeEndpointMock.mockReset();
    describeEndpointMock.mockReturnValue("GET /users");

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createMemoryStorage()
      },
      configurable: true
    });
  });

  it("faz login remoto e mapeia sessao com tokens", async () => {
    requestMock.mockResolvedValueOnce({
      access_token: "token-access",
      refresh_token: "token-refresh",
      expires_in: 3600,
      user: {
        id: "user_1",
        full_name: "Inspetor Remoto",
        email: "inspetor@empresa.com.br",
        role: "inspector"
      }
    });

    const output = await remoteAuthRepository.loginRemote({
      email: "  INSPETOR@empresa.com.br ",
      password: "Senha@123"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "auth.login",
      { method: "POST", path: "/auth/login" },
      {
        body: {
          email: "inspetor@empresa.com.br",
          password: "Senha@123"
        },
        responseType: "json"
      }
    );

    expect(output.session).toEqual(
      expect.objectContaining({
        userId: "user_1",
        fullName: "Inspetor Remoto",
        email: "inspetor@empresa.com.br",
        role: "inspector",
        authMode: "remote",
        accessToken: "token-access",
        refreshToken: "token-refresh",
        expiresIn: 3600
      })
    );
  });

  it("faz solicitacao remota de cadastro", async () => {
    requestMock.mockResolvedValueOnce({
      id: "user_2",
      approval_status: "pending"
    });

    const output = await remoteAuthRepository.registerRequestRemote({
      fullName: "Novo Usuario",
      email: "NOVO@empresa.com.br",
      password: "Senha@123"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "auth.registerRequest",
      { method: "POST", path: "/users/register-request" },
      {
        body: {
          full_name: "Novo Usuario",
          email: "novo@empresa.com.br",
          password: "Senha@123"
        },
        responseType: "json"
      }
    );
    expect(output).toEqual({ userId: "user_2" });
  });

  it("faz logout remoto com refresh token", async () => {
    requestMock.mockResolvedValueOnce(undefined);

    await remoteAuthRepository.logoutRemote({
      userId: "user_1",
      fullName: "Admin",
      email: "admin@empresa.com.br",
      role: "admin",
      loginAt: "2026-04-01T10:00:00.000Z",
      authMode: "remote",
      refreshToken: "token-refresh"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "auth.logout",
      { method: "POST", path: "/auth/logout" },
      {
        body: {
          refresh_token: "token-refresh"
        },
        responseType: "void"
      }
    );
  });

  it("falha com erro explicito quando sessao remota nao possui refresh token", async () => {
    await expect(
      remoteAuthRepository.logoutRemote({
        userId: "user_1",
        fullName: "Admin",
        email: "admin@empresa.com.br",
        role: "admin",
        loginAt: "2026-04-01T10:00:00.000Z",
        authMode: "remote"
      })
    ).rejects.toThrow("Sessao remota sem refresh token para logout.");
  });

  it("retorna erro controlado quando gateway nao esta configurado", () => {
    assertConfiguredMock.mockImplementationOnce(() => {
      throw new BackendGatewayUnavailableError(
        "auth.listUsers",
        "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
      );
    });

    expect(() => remoteAuthRepository.listUsers()).toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("lista usuarios remotos agregando status pendente/aprovado/rejeitado", async () => {
    requestMock
      .mockResolvedValueOnce({
        items: [
          {
            id: "user_pending",
            full_name: "Usuario Pendente",
            email: "pendente@empresa.com.br",
            role: "viewer",
            approval_status: "pending",
            created_at: "2026-04-01T10:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "user_admin",
            full_name: "Admin",
            email: "admin@empresa.com.br",
            role: "admin",
            approval_status: "approved",
            created_at: "2026-04-01T11:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "user_rejected",
            full_name: "Rejeitado",
            email: "rejeitado@empresa.com.br",
            role: "viewer",
            approval_status: "rejected",
            created_at: "2026-04-01T09:00:00.000Z"
          }
        ]
      });

    const users = await remoteAuthRepository.listUsersRemote();

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "auth.listUsers",
      { method: "GET", path: "/users" },
      { query: { status: "pending" }, responseType: "json" }
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "auth.listUsers",
      { method: "GET", path: "/users" },
      { query: { status: "approved" }, responseType: "json" }
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "auth.listUsers",
      { method: "GET", path: "/users" },
      { query: { status: "rejected" }, responseType: "json" }
    );
    expect(users.map((user) => user.id)).toEqual([
      "user_admin",
      "user_pending",
      "user_rejected"
    ]);
  });

  it("aprova usuario remoto com role definido", async () => {
    requestMock.mockResolvedValueOnce({
      id: "user_pending",
      full_name: "Usuario Pendente",
      email: "pendente@empresa.com.br",
      role: "inspector",
      approval_status: "approved",
      created_at: "2026-04-01T10:00:00.000Z"
    });

    const output = await remoteAuthRepository.approveUserRemote({
      userId: "user_pending",
      role: "inspector",
      approverUserId: "admin_1"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "auth.approveUser",
      { method: "POST", path: "/users/user_pending/approve" },
      {
        body: {
          role: "inspector"
        },
        responseType: "json"
      }
    );
    expect(output.approvalStatus).toBe("approved");
    expect(output.role).toBe("inspector");
  });

  it("rejeita usuario remoto com fallback de leitura por id", async () => {
    requestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        id: "user_pending",
        full_name: "Usuario Pendente",
        email: "pendente@empresa.com.br",
        role: "viewer",
        approval_status: "rejected",
        created_at: "2026-04-01T10:00:00.000Z"
      });

    const output = await remoteAuthRepository.rejectUserRemote("user_pending");

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "auth.rejectUser",
      { method: "POST", path: "/users/user_pending/reject" },
      { responseType: "json" }
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "auth.getUserById",
      { method: "GET", path: "/users/user_pending" },
      { responseType: "json" }
    );
    expect(output.approvalStatus).toBe("rejected");
  });

  it("altera role remoto via endpoint dedicado", async () => {
    requestMock.mockResolvedValueOnce({
      id: "user_approved",
      full_name: "Usuario Aprovado",
      email: "aprovado@empresa.com.br",
      role: "admin",
      approval_status: "approved",
      created_at: "2026-04-01T10:00:00.000Z"
    });

    const output = await remoteAuthRepository.updateUserRoleRemote(
      "user_approved",
      "admin"
    );

    expect(requestMock).toHaveBeenCalledWith(
      "auth.updateRole",
      { method: "PATCH", path: "/users/user_approved/role" },
      {
        body: {
          role: "admin"
        },
        responseType: "json"
      }
    );
    expect(output.role).toBe("admin");
  });
});
