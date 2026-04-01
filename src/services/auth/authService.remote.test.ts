import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessControlService } from "@/services/auth/accessControlService";
import { authService } from "@/services/auth/authService";
import {
  BackendGatewayUnavailableError,
  HttpClientResponseError
} from "@/infrastructure/http/httpClient";
import { repositoryMode } from "@/persistence/repositoryMode";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/infrastructure/http/backendGateway", () => ({
  backendGateway: {
    request: requestMock
  }
}));

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

describe("authService (remote mode)", () => {
  beforeEach(async () => {
    requestMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createMemoryStorage()
      },
      configurable: true
    });
    repositoryMode.set("local", { persist: false });
    repositoryMode.setFor("auth", "remote", { persist: false });
    await authService.bootstrap();
  });

  it("realiza login remoto e preserva compatibilidade com controle de perfil", async () => {
    requestMock.mockResolvedValueOnce({
      access_token: "token-access",
      refresh_token: "token-refresh",
      expires_in: 3600,
      user: {
        id: "user_remote_1",
        full_name: "Inspetor remoto",
        email: "inspetor@empresa.com.br",
        role: "inspector"
      }
    });

    const session = await authService.login({
      email: "inspetor@empresa.com.br",
      password: "Senha@123"
    });

    expect(session).toEqual(
      expect.objectContaining({
        userId: "user_remote_1",
        role: "inspector",
        authMode: "remote"
      })
    );
    expect(accessControlService.hasPermission(session, "inspection:create")).toBe(true);
    expect(accessControlService.hasPermission(session, "auth:manage-users")).toBe(false);
    expect(authService.getSession()?.userId).toBe("user_remote_1");
  });

  it("mapeia 401 remoto para mensagem funcional de credenciais invalidas", async () => {
    requestMock.mockRejectedValueOnce(
      new HttpClientResponseError({
        method: "POST",
        url: "https://api.app-vistoria.test/auth/login",
        status: 401,
        statusText: "Unauthorized",
        responseBody: { code: "invalid_credentials" }
      })
    );

    await expect(
      authService.login({
        email: "inspetor@empresa.com.br",
        password: "senha_errada"
      })
    ).rejects.toThrow("Credenciais invalidas.");
  });

  it("mantem erro controlado quando gateway remoto nao esta configurado", async () => {
    requestMock.mockRejectedValueOnce(
      new BackendGatewayUnavailableError(
        "auth.login",
        "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
      )
    );

    await expect(
      authService.login({
        email: "inspetor@empresa.com.br",
        password: "Senha@123"
      })
    ).rejects.toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
  });

  it("mantem erro controlado na listagem remota de usuarios sem gateway", async () => {
    requestMock.mockRejectedValueOnce(
      new BackendGatewayUnavailableError(
        "auth.listUsers",
        "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
      )
    );

    await expect(authService.listUsersManaged()).rejects.toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
  });

  it("executa solicitacao de cadastro remota", async () => {
    requestMock.mockResolvedValueOnce({
      id: "user_remote_2",
      approval_status: "pending"
    });

    const output = await authService.register({
      fullName: "Novo Remoto",
      email: "novo@empresa.com.br",
      password: "Senha@123"
    });

    expect(output).toEqual({ userId: "user_remote_2" });
    expect(requestMock).toHaveBeenCalledWith(
      "auth.registerRequest",
      { method: "POST", path: "/users/register-request" },
      {
        body: {
          full_name: "Novo Remoto",
          email: "novo@empresa.com.br",
          password: "Senha@123"
        },
        responseType: "json"
      }
    );
  });

  it("lista usuarios para gestao remota agregando status", async () => {
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
        items: []
      });

    const users = await authService.listUsersManaged();

    expect(users).toHaveLength(2);
    expect(users.map((user) => user.id)).toEqual(["user_admin", "user_pending"]);
  });

  it("aprova cadastro remoto mantendo validacao de sessao admin", async () => {
    requestMock
      .mockResolvedValueOnce({
        access_token: "token-access",
        refresh_token: "token-refresh",
        expires_in: 3600,
        user: {
          id: "user_admin",
          full_name: "Admin remoto",
          email: "admin@empresa.com.br",
          role: "admin"
        }
      })
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
            full_name: "Admin remoto",
            email: "admin@empresa.com.br",
            role: "admin",
            approval_status: "approved",
            created_at: "2026-04-01T11:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        items: []
      })
      .mockResolvedValueOnce({
        id: "user_pending",
        full_name: "Usuario Pendente",
        email: "pendente@empresa.com.br",
        role: "inspector",
        approval_status: "approved",
        created_at: "2026-04-01T10:00:00.000Z"
      });

    const session = await authService.login({
      email: "admin@empresa.com.br",
      password: "Senha@123"
    });

    const output = await authService.approveUserManaged({
      userId: "user_pending",
      role: "inspector",
      approverUserId: session.userId
    });

    expect(output.approvalStatus).toBe("approved");
    expect(output.role).toBe("inspector");
    expect(requestMock).toHaveBeenLastCalledWith(
      "auth.approveUser",
      { method: "POST", path: "/users/user_pending/approve" },
      {
        body: {
          role: "inspector"
        },
        responseType: "json"
      }
    );
  });

  it("impede auto-remocao de perfil admin no fluxo remoto", async () => {
    requestMock
      .mockResolvedValueOnce({
        access_token: "token-access",
        refresh_token: "token-refresh",
        expires_in: 3600,
        user: {
          id: "user_admin",
          full_name: "Admin remoto",
          email: "admin@empresa.com.br",
          role: "admin"
        }
      })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [
          {
            id: "user_admin",
            full_name: "Admin remoto",
            email: "admin@empresa.com.br",
            role: "admin",
            approval_status: "approved",
            created_at: "2026-04-01T11:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({ items: [] });

    const session = await authService.login({
      email: "admin@empresa.com.br",
      password: "Senha@123"
    });

    await expect(
      authService.updateUserRoleManaged(session.userId, "viewer", session.userId)
    ).rejects.toThrow("Nao e permitido remover o proprio perfil de administrador.");
  });

  it("nao faz fallback silencioso quando logout remoto falha", async () => {
    requestMock.mockResolvedValueOnce({
      access_token: "token-access",
      refresh_token: "token-refresh",
      expires_in: 3600,
      user: {
        id: "user_remote_3",
        full_name: "Admin remoto",
        email: "admin@empresa.com.br",
        role: "admin"
      }
    });

    await authService.login({
      email: "admin@empresa.com.br",
      password: "Senha@123"
    });

    requestMock.mockRejectedValueOnce(
      new Error("Falha de rede no logout remoto.")
    );

    await expect(authService.logout()).rejects.toThrow("Falha de rede no logout remoto.");
    expect(authService.getSession()).not.toBeNull();
  });
});
