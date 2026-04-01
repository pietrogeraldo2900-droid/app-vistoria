import { FormEvent, useState, type ReactElement } from "react";
import type { LoginInput, RegisterInput } from "@/domain/types/auth";

interface LoginPageProps {
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
  defaultAdminCredentials: { email: string; password: string };
  showLocalBootstrapHint: boolean;
}

type AuthMode = "login" | "register";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export const LoginPage = ({
  onLogin,
  onRegister,
  defaultAdminCredentials,
  showLocalBootstrapHint
}: LoginPageProps): ReactElement => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBootstrapCredentials, setShowBootstrapCredentials] = useState(false);

  const resetFeedback = (): void => setFeedback("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      resetFeedback();
      await onLogin({ email, password });
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel autenticar."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      resetFeedback();
      await onRegister({ fullName, email, password });
      setFeedback(
        "Solicitacao de cadastro registrada. Aguarde aprovacao de um administrador."
      );
      setMode("login");
      setPassword("");
    } catch (error) {
      setFeedback(getErrorMessage(error, "Nao foi possivel registrar o cadastro."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero fade-in">
        <p className="eyebrow">MVP - Mobile-first</p>
        <h1>App de Vistoria Tecnica</h1>
        <p>
          Gestao de vistorias com geracao automatica de PRT baseada em regras
          homologadas.
        </p>
        {showLocalBootstrapHint ? (
          <div className="login-admin-hint">
            <strong>Bootstrap local do MVP:</strong>
            <p>
              Credenciais iniciais sao apenas para primeiro acesso administrativo em
              ambiente local de desenvolvimento.
            </p>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setShowBootstrapCredentials((prev) => !prev)}
            >
              {showBootstrapCredentials
                ? "Ocultar credenciais bootstrap"
                : "Mostrar credenciais bootstrap"}
            </button>
            {showBootstrapCredentials ? (
              <span>
                {defaultAdminCredentials.email} / {defaultAdminCredentials.password}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="login-form-wrap slide-up">
        <div className="auth-mode-tabs">
          <button
            className={`btn ${mode === "login" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => {
              setMode("login");
              resetFeedback();
            }}
          >
            Entrar
          </button>
          <button
            className={`btn ${mode === "register" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => {
              setMode("register");
              resetFeedback();
            }}
          >
            Solicitar cadastro
          </button>
        </div>

        {feedback ? <p className="feedback-message">{feedback}</p> : null}

        {mode === "login" ? (
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              E-mail
              <input
                type="email"
                placeholder="ex: inspetor@empresa.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Autenticando..." : "Acessar sistema"}
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleRegister}>
            <label>
              Nome completo
              <input
                type="text"
                placeholder="ex: Joao da Silva"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                placeholder="ex: joao@empresa.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                placeholder="Minimo de 8 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Solicitar aprovacao"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
