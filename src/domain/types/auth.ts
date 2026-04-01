export type UserRole = "admin" | "inspector" | "viewer";
export type UserApprovalStatus = "pending" | "approved" | "rejected";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  approvalStatus: UserApprovalStatus;
  createdAt: string;
  approvedAt?: string;
  approvedByUserId?: string;
}

export interface UserSession {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  loginAt: string;
  authMode?: "local" | "remote";
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ApprovalInput {
  userId: string;
  role: UserRole;
  approverUserId: string;
}
