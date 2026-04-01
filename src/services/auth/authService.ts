import type {
  ApprovalInput,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserRole,
  UserSession
} from "@/domain/types/auth";
import { createId } from "@/domain/utils/id";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";
import { authRepository } from "@/persistence/authRepository";
import { repositoryMode } from "@/persistence/repositoryMode";

const DEFAULT_ADMIN = {
  fullName: "Administrador do Sistema",
  email: "admin@app-vistoria.local",
  password: "Admin@123"
} as const;

const nowIso = (): string => new Date().toISOString();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const textEncoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const randomHex = (bytesLength: number): string => {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
};

const hashPassword = async (password: string, salt: string): Promise<string> => {
  const payload = textEncoder.encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  return toHex(hash);
};

const assertEmail = (email: string): string => {
  const normalized = normalizeEmail(email);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  if (!isEmail) {
    throw new Error("Informe um e-mail valido para autenticar.");
  }
  return normalized;
};

const assertPassword = (password: string): string => {
  const normalized = password.trim();
  if (normalized.length < 8) {
    throw new Error("A senha deve ter no minimo 8 caracteres.");
  }
  return normalized;
};

let bootstrapPromise: Promise<void> | null = null;

const ensureBootstrap = async (): Promise<void> => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const existingUsers = authRepository.listUsers();
      if (existingUsers.length > 0) {
        return;
      }

      const salt = randomHex(16);
      const admin: AuthUser = {
        id: createId("user"),
        fullName: DEFAULT_ADMIN.fullName,
        email: DEFAULT_ADMIN.email,
        passwordSalt: salt,
        passwordHash: await hashPassword(DEFAULT_ADMIN.password, salt),
        role: "admin",
        approvalStatus: "approved",
        createdAt: nowIso(),
        approvedAt: nowIso()
      };
      authRepository.writeUsers([admin]);
    })();
  }

  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
};

const isRemoteAuthMode = (): boolean => repositoryMode.getFor("auth") === "remote";

const toSession = (user: AuthUser): UserSession => ({
  userId: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  loginAt: nowIso()
});

const requireAdmin = (session: UserSession | null): UserSession => {
  if (!session || session.role !== "admin") {
    throw new Error("Apenas administradores podem executar esta operacao.");
  }
  return session;
};

const updateRole = (users: AuthUser[], userId: string, role: UserRole): AuthUser[] =>
  users.map((user) => (user.id === userId ? { ...user, role } : user));

export const authService = {
  async bootstrap(): Promise<void> {
    if (isRemoteAuthMode()) {
      return;
    }
    await ensureBootstrap();
  },

  isRemoteModeEnabled(): boolean {
    return isRemoteAuthMode();
  },

  getSession(): UserSession | null {
    return authRepository.getSession();
  },

  async logout(): Promise<void> {
    const session = authRepository.getSession();
    if (isRemoteAuthMode() && session?.authMode === "remote") {
      await authRepository.logoutRemote(session);
    }
    authRepository.writeSession(null);
  },

  async login(input: LoginInput): Promise<UserSession> {
    const email = assertEmail(input.email);
    const password = assertPassword(input.password);

    if (isRemoteAuthMode()) {
      try {
        const { session } = await authRepository.loginRemote({
          email,
          password
        });
        authRepository.writeSession(session);
        return session;
      } catch (error) {
        if (error instanceof HttpClientResponseError && error.status === 401) {
          throw new Error("Credenciais invalidas.");
        }
        throw error;
      }
    }

    await ensureBootstrap();
    const user = authRepository.getUserByEmail(email);

    if (!user) {
      throw new Error("Credenciais invalidas.");
    }
    if (user.approvalStatus === "pending") {
      throw new Error("Cadastro pendente de aprovacao pelo administrador.");
    }
    if (user.approvalStatus === "rejected") {
      throw new Error("Cadastro reprovado. Solicite nova liberacao ao administrador.");
    }

    const candidateHash = await hashPassword(password, user.passwordSalt);
    if (candidateHash !== user.passwordHash) {
      throw new Error("Credenciais invalidas.");
    }

    const session = toSession(user);
    authRepository.writeSession(session);
    return session;
  },

  async register(input: RegisterInput): Promise<{ userId: string }> {
    const fullName = input.fullName.trim();
    if (!fullName) {
      throw new Error("Informe o nome completo para solicitar cadastro.");
    }

    const email = assertEmail(input.email);
    const password = assertPassword(input.password);

    if (isRemoteAuthMode()) {
      return authRepository.registerRequestRemote({
        fullName,
        email,
        password
      });
    }

    await ensureBootstrap();
    const existingUser = authRepository.getUserByEmail(email);
    if (existingUser) {
      throw new Error("Ja existe cadastro para este e-mail.");
    }

    const salt = randomHex(16);
    const user: AuthUser = {
      id: createId("user"),
      fullName,
      email,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
      role: "viewer",
      approvalStatus: "pending",
      createdAt: nowIso()
    };

    authRepository.upsertUser(user);
    return { userId: user.id };
  },

  listUsers(): AuthUser[] {
    return authRepository.listUsers();
  },

  async listUsersManaged(): Promise<AuthUser[]> {
    if (isRemoteAuthMode()) {
      return authRepository.listUsersRemote();
    }
    return authRepository.listUsers();
  },

  listPendingUsers(): AuthUser[] {
    return authRepository
      .listUsers()
      .filter((user) => user.approvalStatus === "pending");
  },

  listApprovedUsers(): AuthUser[] {
    return authRepository
      .listUsers()
      .filter((user) => user.approvalStatus === "approved");
  },

  approveUser(input: ApprovalInput): AuthUser {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== input.approverUserId) {
      throw new Error("Sessao invalida para aprovacao de cadastro.");
    }

    const user = authRepository.getUserById(input.userId);
    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }
    if (user.approvalStatus === "approved") {
      return user;
    }

    const approvedUser: AuthUser = {
      ...user,
      role: input.role,
      approvalStatus: "approved",
      approvedAt: nowIso(),
      approvedByUserId: session.userId
    };
    authRepository.upsertUser(approvedUser);
    return approvedUser;
  },

  rejectUser(userId: string, approverUserId: string): AuthUser {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== approverUserId) {
      throw new Error("Sessao invalida para rejeicao de cadastro.");
    }

    const user = authRepository.getUserById(userId);
    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }
    if (user.id === session.userId) {
      throw new Error("Nao e permitido rejeitar o proprio cadastro.");
    }

    const rejectedUser: AuthUser = {
      ...user,
      approvalStatus: "rejected",
      approvedAt: nowIso(),
      approvedByUserId: session.userId
    };
    authRepository.upsertUser(rejectedUser);
    return rejectedUser;
  },

  updateUserRole(userId: string, role: UserRole, adminUserId: string): AuthUser {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== adminUserId) {
      throw new Error("Sessao invalida para alteracao de perfil.");
    }

    const users = authRepository.listUsers();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      throw new Error("Usuario nao encontrado.");
    }
    if (targetUser.id === session.userId && role !== "admin") {
      throw new Error("Nao e permitido remover o proprio perfil de administrador.");
    }
    if (targetUser.approvalStatus !== "approved") {
      throw new Error("Somente usuarios aprovados podem ter perfil alterado.");
    }

    authRepository.writeUsers(updateRole(users, userId, role));
    const updated = authRepository.getUserById(userId);
    if (!updated) {
      throw new Error("Falha ao atualizar perfil do usuario.");
    }

    const currentSession = authRepository.getSession();
    if (currentSession?.userId === updated.id) {
      authRepository.writeSession({
        ...currentSession,
        role: updated.role
      });
    }

    return updated;
  },

  async approveUserManaged(input: ApprovalInput): Promise<AuthUser> {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== input.approverUserId) {
      throw new Error("Sessao invalida para aprovacao de cadastro.");
    }

    if (!isRemoteAuthMode()) {
      return this.approveUser(input);
    }

    const users = await authRepository.listUsersRemote();
    const user = users.find((entry) => entry.id === input.userId);
    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }
    if (user.approvalStatus === "approved" && user.role === input.role) {
      return user;
    }

    return authRepository.approveUserRemote(input);
  },

  async rejectUserManaged(userId: string, approverUserId: string): Promise<AuthUser> {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== approverUserId) {
      throw new Error("Sessao invalida para rejeicao de cadastro.");
    }

    if (!isRemoteAuthMode()) {
      return this.rejectUser(userId, approverUserId);
    }

    const users = await authRepository.listUsersRemote();
    const user = users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }
    if (user.id === session.userId) {
      throw new Error("Nao e permitido rejeitar o proprio cadastro.");
    }

    return authRepository.rejectUserRemote(userId);
  },

  async updateUserRoleManaged(
    userId: string,
    role: UserRole,
    adminUserId: string
  ): Promise<AuthUser> {
    const session = requireAdmin(authRepository.getSession());
    if (session.userId !== adminUserId) {
      throw new Error("Sessao invalida para alteracao de perfil.");
    }

    if (!isRemoteAuthMode()) {
      return this.updateUserRole(userId, role, adminUserId);
    }

    const users = await authRepository.listUsersRemote();
    const targetUser = users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("Usuario nao encontrado.");
    }
    if (targetUser.id === session.userId && role !== "admin") {
      throw new Error("Nao e permitido remover o proprio perfil de administrador.");
    }
    if (targetUser.approvalStatus !== "approved") {
      throw new Error("Somente usuarios aprovados podem ter perfil alterado.");
    }

    const updated = await authRepository.updateUserRoleRemote(userId, role);
    const currentSession = authRepository.getSession();
    if (currentSession?.userId === updated.id) {
      authRepository.writeSession({
        ...currentSession,
        role: updated.role
      });
    }

    return updated;
  },

  getDefaultAdminCredentials(): { email: string; password: string } {
    return {
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password
    };
  }
};
