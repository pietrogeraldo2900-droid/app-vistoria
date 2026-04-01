import type {
  ApprovalInput,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserRole,
  UserSession
} from "@/domain/types/auth";
import { createAuthRepository } from "@/persistence/factories/createAuthRepository";
import type { AuthRepositoryContract } from "@/persistence/contracts/authRepositoryContract";

export { repositoryMode } from "@/persistence/repositoryMode";
export type { AuthRepositoryContract } from "@/persistence/contracts/authRepositoryContract";

const resolveRepository = (): AuthRepositoryContract => createAuthRepository();

export const authRepository: AuthRepositoryContract = {
  listUsers(): AuthUser[] {
    return resolveRepository().listUsers();
  },

  getUserById(userId: string): AuthUser | undefined {
    return resolveRepository().getUserById(userId);
  },

  getUserByEmail(email: string): AuthUser | undefined {
    return resolveRepository().getUserByEmail(email);
  },

  upsertUser(user: AuthUser): AuthUser {
    return resolveRepository().upsertUser(user);
  },

  writeUsers(users: AuthUser[]): void {
    return resolveRepository().writeUsers(users);
  },

  getSession(): UserSession | null {
    return resolveRepository().getSession();
  },

  writeSession(session: UserSession | null): void {
    return resolveRepository().writeSession(session);
  },

  loginRemote(input: LoginInput) {
    return resolveRepository().loginRemote(input);
  },

  registerRequestRemote(input: RegisterInput) {
    return resolveRepository().registerRequestRemote(input);
  },

  logoutRemote(session: UserSession | null) {
    return resolveRepository().logoutRemote(session);
  },

  listUsersRemote() {
    return resolveRepository().listUsersRemote();
  },

  approveUserRemote(input: ApprovalInput) {
    return resolveRepository().approveUserRemote(input);
  },

  rejectUserRemote(userId: string) {
    return resolveRepository().rejectUserRemote(userId);
  },

  updateUserRoleRemote(userId: string, role: UserRole) {
    return resolveRepository().updateUserRoleRemote(userId, role);
  }
};
