import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { repositoryMode } from "@/persistence/repositoryMode";
import { authService } from "@/services/auth/authService";

interface MemoryStorage extends Storage {
  clear(): void;
}

const createMemoryStorage = (): MemoryStorage => {
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

const installRuntimeMocks = (): void => {
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: createMemoryStorage()
    },
    configurable: true
  });

  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true
  });
};

const loginAsDefaultAdmin = async () => {
  const credentials = authService.getDefaultAdminCredentials();
  return authService.login({
    email: credentials.email,
    password: credentials.password
  });
};

describe("authService", () => {
  beforeEach(async () => {
    repositoryMode.reset();
    repositoryMode.set("local", { persist: false });
    installRuntimeMocks();
    await authService.bootstrap();
    await authService.logout();
  });

  it("cria cadastro pendente por padrao", async () => {
    const output = await authService.register({
      fullName: "Usuario Pendente",
      email: "pendente@empresa.com.br",
      password: "Senha@123"
    });

    const created = authService.listUsers().find((user) => user.id === output.userId);
    expect(created?.approvalStatus).toBe("pending");
    expect(created?.role).toBe("viewer");
  });

  it("aprova cadastro pendente com perfil definido", async () => {
    const { userId } = await authService.register({
      fullName: "Usuario Aprovado",
      email: "aprovado@empresa.com.br",
      password: "Senha@123"
    });
    const adminSession = await loginAsDefaultAdmin();

    const approved = authService.approveUser({
      userId,
      role: "inspector",
      approverUserId: adminSession.userId
    });

    expect(approved.approvalStatus).toBe("approved");
    expect(approved.role).toBe("inspector");
  });

  it("rejeita cadastro pendente", async () => {
    const { userId } = await authService.register({
      fullName: "Usuario Rejeitado",
      email: "rejeitado@empresa.com.br",
      password: "Senha@123"
    });
    const adminSession = await loginAsDefaultAdmin();

    const rejected = authService.rejectUser(userId, adminSession.userId);
    expect(rejected.approvalStatus).toBe("rejected");
  });

  it("realiza login com senha correta para usuario aprovado", async () => {
    const { userId } = await authService.register({
      fullName: "Inspetor",
      email: "inspetor@empresa.com.br",
      password: "Senha@123"
    });
    const adminSession = await loginAsDefaultAdmin();
    authService.approveUser({
      userId,
      role: "inspector",
      approverUserId: adminSession.userId
    });
    await authService.logout();

    const session = await authService.login({
      email: "inspetor@empresa.com.br",
      password: "Senha@123"
    });

    expect(session.email).toBe("inspetor@empresa.com.br");
    expect(session.role).toBe("inspector");
  });

  it("bloqueia login com senha incorreta", async () => {
    const credentials = authService.getDefaultAdminCredentials();

    await expect(
      authService.login({
        email: credentials.email,
        password: "senha_errada"
      })
    ).rejects.toThrow("Credenciais invalidas.");
  });

  it("bloqueia login de usuario pendente ou rejeitado", async () => {
    const pendingEmail = "pendente-bloqueio@empresa.com.br";
    await authService.register({
      fullName: "Pendente Bloqueado",
      email: pendingEmail,
      password: "Senha@123"
    });

    await expect(
      authService.login({
        email: pendingEmail,
        password: "Senha@123"
      })
    ).rejects.toThrow("Cadastro pendente de aprovacao pelo administrador.");

    const rejectedEmail = "rejeitado-bloqueio@empresa.com.br";
    const { userId } = await authService.register({
      fullName: "Rejeitado Bloqueado",
      email: rejectedEmail,
      password: "Senha@123"
    });
    const adminSession = await loginAsDefaultAdmin();
    authService.rejectUser(userId, adminSession.userId);
    await authService.logout();

    await expect(
      authService.login({
        email: rejectedEmail,
        password: "Senha@123"
      })
    ).rejects.toThrow("Cadastro reprovado. Solicite nova liberacao ao administrador.");
  });

  it("permite alteracao de perfil para usuario aprovado", async () => {
    const { userId } = await authService.register({
      fullName: "Usuario Perfil",
      email: "perfil@empresa.com.br",
      password: "Senha@123"
    });
    const adminSession = await loginAsDefaultAdmin();
    authService.approveUser({
      userId,
      role: "viewer",
      approverUserId: adminSession.userId
    });

    const updated = authService.updateUserRole(userId, "inspector", adminSession.userId);
    expect(updated.role).toBe("inspector");
  });

  it("impede admin de remover o proprio perfil admin", async () => {
    const adminSession = await loginAsDefaultAdmin();

    expect(() =>
      authService.updateUserRole(adminSession.userId, "viewer", adminSession.userId)
    ).toThrow("Nao e permitido remover o proprio perfil de administrador.");
  });
});
