import type {
  ApprovalInput,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserApprovalStatus,
  UserRole,
  UserSession
} from "@/domain/types/auth";
import { backendGateway } from "@/infrastructure/http/backendGateway";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";
import type {
  AuthRepositoryContract,
  RemoteAuthLoginResult,
  RemoteAuthRegisterResult
} from "@/persistence/contracts/authRepositoryContract";
import { failRemoteAdapterOperation } from "@/persistence/remote/remoteAdapterSupport";
import { STORAGE_KEYS } from "@/persistence/storageKeys";

const AUTH_ENDPOINTS = {
  login: { method: "POST", path: "/auth/login" },
  logout: { method: "POST", path: "/auth/logout" },
  registerRequest: { method: "POST", path: "/users/register-request" },
  listUsers: { method: "GET", path: "/users" },
  getUserById: { method: "GET", path: "/users/{id}" },
  approveUser: { method: "POST", path: "/users/{id}/approve" },
  rejectUser: { method: "POST", path: "/users/{id}/reject" },
  updateRole: { method: "PATCH", path: "/users/{id}/role" },
  getUserByEmail: { method: "GET", path: "/users?email={email}" },
  upsertUser: { method: "POST", path: "/users/register-request" },
  writeUsers: { method: "PATCH", path: "/users/{id}/role" }
} as const;

interface ApiLoginResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    full_name?: string;
    email?: string;
    role?: string;
  };
}

interface ApiRegisterRequestResponse {
  id?: string;
  approval_status?: string;
}

interface ApiUser {
  id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  approval_status?: string;
  created_at?: string;
  approved_at?: string;
  approved_by_user_id?: string;
}

interface ApiUsersResponse {
  items?: ApiUser[];
}

const resolveRole = (value: string | undefined): UserRole => {
  if (value === "admin" || value === "inspector" || value === "viewer") {
    return value;
  }
  return "viewer";
};

const resolveApprovalStatus = (value: string | undefined): UserApprovalStatus => {
  if (value === "approved" || value === "rejected" || value === "pending") {
    return value;
  }
  return "pending";
};

const readSession = (): UserSession | null => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UserSession;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeSession = (session: UserSession | null): void => {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
};

const mapLoginToSession = (
  input: ApiLoginResponse,
  fallbackEmail: string
): UserSession => {
  if (!input.user?.id) {
    throw new Error("Resposta de login remoto invalida: campo user.id ausente.");
  }

  return {
    userId: input.user.id,
    fullName: input.user.full_name ?? "Usuario remoto",
    email: input.user.email ?? fallbackEmail.trim().toLowerCase(),
    role: resolveRole(input.user.role),
    loginAt: new Date().toISOString(),
    authMode: "remote",
    accessToken: input.access_token,
    refreshToken: input.refresh_token,
    expiresIn: input.expires_in
  };
};

const mapApiUser = (user: ApiUser): AuthUser => {
  if (!user.id) {
    throw new Error("Resposta de usuario remoto invalida: campo id ausente.");
  }
  if (!user.email) {
    throw new Error("Resposta de usuario remoto invalida: campo email ausente.");
  }

  return {
    id: user.id,
    fullName: user.full_name ?? "Usuario remoto",
    email: user.email.trim().toLowerCase(),
    passwordHash: "REMOTE_AUTH_MANAGED",
    passwordSalt: "REMOTE_AUTH_MANAGED",
    role: resolveRole(user.role),
    approvalStatus: resolveApprovalStatus(user.approval_status),
    createdAt: user.created_at ?? new Date(0).toISOString(),
    approvedAt: user.approved_at,
    approvedByUserId: user.approved_by_user_id
  };
};

const findUserByIdRemote = async (userId: string): Promise<AuthUser | undefined> => {
  try {
    const output = await backendGateway.request<ApiUser>(
      "auth.getUserById",
      {
        method: AUTH_ENDPOINTS.getUserById.method,
        path: `/users/${encodeURIComponent(userId)}`
      },
      {
        responseType: "json"
      }
    );
    return mapApiUser(output);
  } catch (error) {
    if (error instanceof HttpClientResponseError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
};

const listUsersByStatusRemote = async (
  status: UserApprovalStatus
): Promise<AuthUser[]> => {
  const output = await backendGateway.request<ApiUsersResponse>(
    "auth.listUsers",
    AUTH_ENDPOINTS.listUsers,
    {
      query: {
        status
      },
      responseType: "json"
    }
  );

  const items = Array.isArray(output.items) ? output.items : [];
  return items.map(mapApiUser);
};

export const remoteAuthRepository: AuthRepositoryContract = {
  listUsers() {
    return failRemoteAdapterOperation({
      adapter: "auth",
      operation: "listUsers",
      endpoint: {
        method: AUTH_ENDPOINTS.listUsers.method,
        path: "/users?status={status}"
      }
    });
  },

  getUserById() {
    return failRemoteAdapterOperation({
      adapter: "auth",
      operation: "getUserById",
      endpoint: AUTH_ENDPOINTS.getUserById
    });
  },

  getUserByEmail() {
    return failRemoteAdapterOperation({
      adapter: "auth",
      operation: "getUserByEmail",
      endpoint: AUTH_ENDPOINTS.getUserByEmail
    });
  },

  upsertUser() {
    return failRemoteAdapterOperation({
      adapter: "auth",
      operation: "upsertUser",
      endpoint: AUTH_ENDPOINTS.upsertUser
    });
  },

  writeUsers() {
    return failRemoteAdapterOperation({
      adapter: "auth",
      operation: "writeUsers",
      endpoint: AUTH_ENDPOINTS.writeUsers
    });
  },

  getSession() {
    return readSession();
  },

  writeSession(session) {
    writeSession(session);
  },

  async loginRemote(input: LoginInput): Promise<RemoteAuthLoginResult> {
    const response = await backendGateway.request<ApiLoginResponse>(
      "auth.login",
      AUTH_ENDPOINTS.login,
      {
        body: {
          email: input.email.trim().toLowerCase(),
          password: input.password
        },
        responseType: "json"
      }
    );

    const session = mapLoginToSession(response, input.email);
    return { session };
  },

  async registerRequestRemote(
    input: RegisterInput
  ): Promise<RemoteAuthRegisterResult> {
    const response = await backendGateway.request<ApiRegisterRequestResponse>(
      "auth.registerRequest",
      AUTH_ENDPOINTS.registerRequest,
      {
        body: {
          full_name: input.fullName.trim(),
          email: input.email.trim().toLowerCase(),
          password: input.password
        },
        responseType: "json"
      }
    );

    if (!response.id) {
      throw new Error("Resposta de cadastro remoto invalida: campo id ausente.");
    }

    return { userId: response.id };
  },

  async logoutRemote(session: UserSession | null): Promise<void> {
    if (!session?.refreshToken) {
      throw new Error("Sessao remota sem refresh token para logout.");
    }

    await backendGateway.request<void>(
      "auth.logout",
      AUTH_ENDPOINTS.logout,
      {
        body: {
          refresh_token: session.refreshToken
        },
        responseType: "void"
      }
    );
  },

  async listUsersRemote(): Promise<AuthUser[]> {
    const statuses: UserApprovalStatus[] = ["pending", "approved", "rejected"];
    const usersById = new Map<string, AuthUser>();

    for (const status of statuses) {
      const users = await listUsersByStatusRemote(status);
      for (const user of users) {
        usersById.set(user.id, user);
      }
    }

    return [...usersById.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async approveUserRemote(input: ApprovalInput): Promise<AuthUser> {
    const response = await backendGateway.request<ApiUser>(
      "auth.approveUser",
      {
        method: AUTH_ENDPOINTS.approveUser.method,
        path: `/users/${encodeURIComponent(input.userId)}/approve`
      },
      {
        body: {
          role: input.role
        },
        responseType: "json"
      }
    );

    if (response.id) {
      return mapApiUser(response);
    }

    const user = await findUserByIdRemote(input.userId);
    if (!user) {
      throw new Error("Usuario aprovado, mas nao retornado pelo backend.");
    }
    return user;
  },

  async rejectUserRemote(userId: string): Promise<AuthUser> {
    const response = await backendGateway.request<ApiUser>(
      "auth.rejectUser",
      {
        method: AUTH_ENDPOINTS.rejectUser.method,
        path: `/users/${encodeURIComponent(userId)}/reject`
      },
      {
        responseType: "json"
      }
    );

    if (response.id) {
      return mapApiUser(response);
    }

    const user = await findUserByIdRemote(userId);
    if (!user) {
      throw new Error("Usuario rejeitado, mas nao retornado pelo backend.");
    }
    return user;
  },

  async updateUserRoleRemote(userId: string, role: UserRole): Promise<AuthUser> {
    const response = await backendGateway.request<ApiUser>(
      "auth.updateRole",
      {
        method: AUTH_ENDPOINTS.updateRole.method,
        path: `/users/${encodeURIComponent(userId)}/role`
      },
      {
        body: {
          role
        },
        responseType: "json"
      }
    );

    if (response.id) {
      return mapApiUser(response);
    }

    const user = await findUserByIdRemote(userId);
    if (!user) {
      throw new Error("Perfil atualizado, mas usuario nao retornado pelo backend.");
    }
    return user;
  }
};
