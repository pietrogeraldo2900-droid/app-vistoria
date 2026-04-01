import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { LoginInput, RegisterInput, UserRole, UserSession } from "@/domain/types/auth";
import { accessControlService } from "@/services/auth/accessControlService";
import { authService } from "@/services/auth/authService";
import { AppLayout } from "@/ui/layout/AppLayout";
import { AccessDeniedPage } from "@/ui/pages/AccessDeniedPage";
import { DashboardPage } from "@/ui/pages/DashboardPage";
import { HistoryPage } from "@/ui/pages/HistoryPage";
import { InspectionEditorPage } from "@/ui/pages/InspectionEditorPage";
import { LoginPage } from "@/ui/pages/LoginPage";
import { NewInspectionPage } from "@/ui/pages/NewInspectionPage";
import { ReportPreviewPage } from "@/ui/pages/ReportPreviewPage";
import { UserAccessManagementPage } from "@/ui/pages/UserAccessManagementPage";

interface ProtectedProps {
  session: UserSession | null;
  roles?: UserRole[];
  children: ReactElement;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const ProtectedRoute = ({ session, roles, children }: ProtectedProps): ReactElement => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(session.role)) {
    return <Navigate to="/access-denied" replace />;
  }
  return children;
};

export const App = (): ReactElement => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [authFeedback, setAuthFeedback] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await authService.bootstrap();
        if (!mounted) {
          return;
        }
        setSession(authService.getSession());
      } catch (error) {
        if (!mounted) {
          return;
        }
        setAuthFeedback(
          getErrorMessage(error, "Falha ao inicializar autenticacao do aplicativo.")
        );
      } finally {
        if (!mounted) {
          return;
        }
        setIsBootstrapped(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const actions = useMemo(
    () => ({
      async onLogin(input: LoginInput) {
        setAuthFeedback("");
        const nextSession = await authService.login(input);
        setSession(nextSession);
      },
      async onRegister(input: RegisterInput) {
        setAuthFeedback("");
        await authService.register(input);
      },
      async onLogout() {
        setAuthFeedback("");
        try {
          await authService.logout();
          setSession(null);
        } catch (error) {
          setAuthFeedback(
            getErrorMessage(error, "Falha ao encerrar a sessao remota.")
          );
        }
      }
    }),
    []
  );

  const defaultAdminCredentials = authService.getDefaultAdminCredentials();
  const showLocalBootstrapHint = !authService.isRemoteModeEnabled();
  const canCreateInspection = accessControlService.hasPermission(
    session,
    "inspection:create"
  );
  const canEditInspection = accessControlService.hasPermission(session, "inspection:edit");

  if (!isBootstrapped) {
    return (
      <main className="login-page">
        <section className="login-form-wrap fade-in">
          <h2>Inicializando autenticacao...</h2>
          <p>Preparando controle de acesso e sessao local.</p>
        </section>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage
              onLogin={actions.onLogin}
              onRegister={actions.onRegister}
              defaultAdminCredentials={defaultAdminCredentials}
              showLocalBootstrapHint={showLocalBootstrapHint}
            />
          )
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute session={session}>
            <AppLayout
              session={session}
              onLogout={actions.onLogout}
              authFeedback={authFeedback}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="inspection/new"
          element={
            canCreateInspection ? <NewInspectionPage /> : <Navigate to="/access-denied" replace />
          }
        />
        <Route
          path="inspection/:inspectionId/edit"
          element={
            canEditInspection ? (
              <InspectionEditorPage />
            ) : (
              <Navigate to="/access-denied" replace />
            )
          }
        />
        <Route path="inspection/:inspectionId/preview" element={<ReportPreviewPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route
          path="access/users"
          element={
            <ProtectedRoute session={session} roles={["admin"]}>
              <UserAccessManagementPage session={session as UserSession} />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
};
