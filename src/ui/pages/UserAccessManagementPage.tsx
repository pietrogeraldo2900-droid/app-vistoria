import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement
} from "react";
import type { AuthUser, UserRole, UserSession } from "@/domain/types/auth";
import { authService } from "@/services/auth/authService";
import { SectionPanel } from "@/ui/components/SectionPanel";

interface UserAccessManagementPageProps {
  session: UserSession;
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "viewer", label: "Viewer (somente leitura)" },
  { value: "inspector", label: "Inspector (operacao de vistoria)" },
  { value: "admin", label: "Admin (controle de acesso)" }
];

const roleLabelMap: Record<UserRole, string> = {
  admin: "Admin",
  inspector: "Inspector",
  viewer: "Viewer"
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export const UserAccessManagementPage = ({
  session
}: UserAccessManagementPageProps): ReactElement => {
  const [feedback, setFeedback] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const output = await authService.listUsersManaged();
      setUsers(output);
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel carregar usuarios."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const pendingUsers = useMemo(
    () => users.filter((user) => user.approvalStatus === "pending"),
    [users]
  );
  const approvedUsers = useMemo(
    () => users.filter((user) => user.approvalStatus === "approved"),
    [users]
  );

  const resolveDraftRole = (userId: string, fallback: UserRole): UserRole =>
    roleDrafts[userId] ?? fallback;

  const handleApprove = async (userId: string): Promise<void> => {
    const role = resolveDraftRole(userId, "inspector");
    try {
      setIsSubmitting(true);
      await authService.approveUserManaged({
        userId,
        role,
        approverUserId: session.userId
      });
      await loadUsers();
      setFeedback("Cadastro aprovado com sucesso.");
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel aprovar o cadastro."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (userId: string): Promise<void> => {
    try {
      setIsSubmitting(true);
      await authService.rejectUserManaged(userId, session.userId);
      await loadUsers();
      setFeedback("Cadastro rejeitado.");
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel rejeitar o cadastro."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (userId: string): Promise<void> => {
    const role = resolveDraftRole(userId, "viewer");
    try {
      setIsSubmitting(true);
      await authService.updateUserRoleManaged(userId, role, session.userId);
      await loadUsers();
      setFeedback("Perfil atualizado.");
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel atualizar o perfil."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-grid">
      <SectionPanel
        title="Controle de acesso"
        subtitle="Aprovacao de cadastros pendentes e administracao de perfis."
      >
        {feedback ? <p className="feedback-message">{feedback}</p> : null}

        <h3>Cadastros pendentes</h3>
        {isLoading ? (
          <p className="empty-state">Carregando usuarios...</p>
        ) : pendingUsers.length === 0 ? (
          <p className="empty-state">Nao ha solicitacoes pendentes de aprovacao.</p>
        ) : (
          <ul className="simple-list">
            {pendingUsers.map((user) => (
              <li key={user.id}>
                <div>
                  <h3>{user.fullName}</h3>
                  <p>{user.email}</p>
                </div>
                <label>
                  Perfil na aprovacao
                  <select
                    value={resolveDraftRole(user.id, "inspector")}
                    onChange={(event) =>
                      setRoleDrafts((prev) => ({
                        ...prev,
                        [user.id]: event.target.value as UserRole
                      }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="inline-actions compact">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      void handleApprove(user.id);
                    }}
                    disabled={isSubmitting || isLoading}
                  >
                    Aprovar
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => {
                      void handleReject(user.id);
                    }}
                    disabled={user.id === session.userId || isSubmitting || isLoading}
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      <SectionPanel
        title="Usuarios aprovados"
        subtitle="Gestao de papeis para operacao e governanca."
        delayMs={100}
      >
        {isLoading ? (
          <p className="empty-state">Carregando usuarios...</p>
        ) : approvedUsers.length === 0 ? (
          <p className="empty-state">Nao existem usuarios aprovados.</p>
        ) : (
          <ul className="simple-list">
            {approvedUsers.map((user) => (
              <li key={user.id}>
                <div>
                  <h3>{user.fullName}</h3>
                  <p>{user.email}</p>
                  <p>Perfil atual: {roleLabelMap[user.role]}</p>
                </div>
                <label>
                  Alterar perfil
                  <select
                    value={resolveDraftRole(user.id, user.role)}
                    onChange={(event) =>
                      setRoleDrafts((prev) => ({
                        ...prev,
                        [user.id]: event.target.value as UserRole
                      }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    void handleChangeRole(user.id);
                  }}
                  disabled={
                    (user.id === session.userId &&
                      resolveDraftRole(user.id, user.role) !== "admin") ||
                    isSubmitting ||
                    isLoading
                  }
                >
                  Salvar perfil
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
};
