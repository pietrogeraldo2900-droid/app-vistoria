import type { UserRole, UserSession } from "@/domain/types/auth";

export type AccessPermission =
  | "inspection:create"
  | "inspection:edit"
  | "inspection:view"
  | "auth:manage-users";

const rolePermissions: Record<UserRole, AccessPermission[]> = {
  admin: ["inspection:create", "inspection:edit", "inspection:view", "auth:manage-users"],
  inspector: ["inspection:create", "inspection:edit", "inspection:view"],
  viewer: ["inspection:view"]
};

export const accessControlService = {
  hasPermission(
    session: UserSession | null,
    permission: AccessPermission
  ): boolean {
    if (!session) {
      return false;
    }
    return rolePermissions[session.role].includes(permission);
  },

  canAny(session: UserSession | null, permissions: AccessPermission[]): boolean {
    return permissions.some((permission) => this.hasPermission(session, permission));
  }
};

