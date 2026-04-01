import type { AuthUser, UserSession } from "@/domain/types/auth";
import type { AuthRepositoryContract } from "@/persistence/contracts/authRepositoryContract";
import { STORAGE_KEYS } from "@/persistence/storageKeys";

const safeJsonParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const readUsers = (): AuthUser[] => {
  const parsed = safeJsonParse<AuthUser[]>(
    window.localStorage.getItem(STORAGE_KEYS.authUsers),
    []
  );
  return Array.isArray(parsed) ? parsed : [];
};

const writeUsers = (users: AuthUser[]): void => {
  window.localStorage.setItem(STORAGE_KEYS.authUsers, JSON.stringify(users));
};

const readSession = (): UserSession | null => {
  const parsed = safeJsonParse<UserSession | null>(
    window.localStorage.getItem(STORAGE_KEYS.session),
    null
  );
  if (!parsed) {
    return null;
  }
  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.role !== "string"
  ) {
    return null;
  }
  return parsed;
};

const writeSession = (session: UserSession | null): void => {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
};

const failRemoteOperation = (operation: string): never => {
  throw new Error(
    `Operacao remota de auth nao disponivel no repository local: ${operation}.`
  );
};

export const localAuthRepository: AuthRepositoryContract = {
  listUsers(): AuthUser[] {
    return readUsers().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  getUserById(userId: string): AuthUser | undefined {
    return readUsers().find((user) => user.id === userId);
  },

  getUserByEmail(email: string): AuthUser | undefined {
    const normalized = email.trim().toLowerCase();
    return readUsers().find((user) => user.email === normalized);
  },

  upsertUser(user: AuthUser): AuthUser {
    const users = readUsers();
    const index = users.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeUsers(users);
    return user;
  },

  writeUsers(users: AuthUser[]): void {
    writeUsers(users);
  },

  getSession(): UserSession | null {
    return readSession();
  },

  writeSession(session: UserSession | null): void {
    writeSession(session);
  },

  async loginRemote() {
    return failRemoteOperation("loginRemote");
  },

  async registerRequestRemote() {
    return failRemoteOperation("registerRequestRemote");
  },

  async logoutRemote() {
    return failRemoteOperation("logoutRemote");
  },

  async listUsersRemote() {
    return failRemoteOperation("listUsersRemote");
  },

  async approveUserRemote() {
    return failRemoteOperation("approveUserRemote");
  },

  async rejectUserRemote() {
    return failRemoteOperation("rejectUserRemote");
  },

  async updateUserRoleRemote() {
    return failRemoteOperation("updateUserRoleRemote");
  }
};
