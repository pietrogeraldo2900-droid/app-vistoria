import type {
  ApprovalInput,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserRole,
  UserSession
} from "@/domain/types/auth";

export interface RemoteAuthLoginResult {
  session: UserSession;
}

export interface RemoteAuthRegisterResult {
  userId: string;
}

export interface AuthRepositoryContract {
  listUsers(): AuthUser[];
  getUserById(userId: string): AuthUser | undefined;
  getUserByEmail(email: string): AuthUser | undefined;
  upsertUser(user: AuthUser): AuthUser;
  writeUsers(users: AuthUser[]): void;
  getSession(): UserSession | null;
  writeSession(session: UserSession | null): void;
  loginRemote(input: LoginInput): Promise<RemoteAuthLoginResult>;
  registerRequestRemote(input: RegisterInput): Promise<RemoteAuthRegisterResult>;
  logoutRemote(session: UserSession | null): Promise<void>;
  listUsersRemote(): Promise<AuthUser[]>;
  approveUserRemote(input: ApprovalInput): Promise<AuthUser>;
  rejectUserRemote(userId: string): Promise<AuthUser>;
  updateUserRoleRemote(userId: string, role: UserRole): Promise<AuthUser>;
}
