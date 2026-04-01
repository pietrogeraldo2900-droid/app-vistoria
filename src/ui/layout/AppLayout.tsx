import { useState, type ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { UserSession } from "@/domain/types/auth";
import { accessControlService } from "@/services/auth/accessControlService";

interface AppLayoutProps {
  session: UserSession | null;
  onLogout: () => Promise<void>;
  authFeedback?: string;
}

const roleLabelMap = {
  admin: "Admin",
  inspector: "Inspector",
  viewer: "Viewer"
} as const;

export const AppLayout = ({
  session,
  onLogout,
  authFeedback
}: AppLayoutProps): ReactElement => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const canCreateInspection = accessControlService.hasPermission(
    session,
    "inspection:create"
  );
  const canManageUsers = accessControlService.hasPermission(
    session,
    "auth:manage-users"
  );

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoggingOut(true);
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Vistoria Tecnica</p>
          <h1>Engine de PRT</h1>
        </div>
        <div className="session-box">
          <span>
            {session?.fullName} {session ? `(${roleLabelMap[session.role]})` : ""}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              void handleLogout();
            }}
            type="button"
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      {authFeedback ? <p className="feedback-message">{authFeedback}</p> : null}

      <nav className="main-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
        >
          Dashboard
        </NavLink>
        {canCreateInspection ? (
          <NavLink
            to="/inspection/new"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            Nova vistoria
          </NavLink>
        ) : null}
        <NavLink
          to="/history"
          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
        >
          Historico
        </NavLink>
        {canManageUsers ? (
          <NavLink
            to="/access/users"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            Acessos
          </NavLink>
        ) : null}
      </nav>

      <main className="main-content fade-in">
        <Outlet />
      </main>
    </div>
  );
};
