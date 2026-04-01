import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { SectionPanel } from "@/ui/components/SectionPanel";

export const AccessDeniedPage = (): ReactElement => {
  return (
    <div className="page-grid">
      <SectionPanel
        title="Acesso negado"
        subtitle="Seu perfil nao possui permissao para acessar este recurso."
      >
        <div className="inline-actions">
          <Link className="btn btn-primary" to="/dashboard">
            Voltar ao dashboard
          </Link>
        </div>
      </SectionPanel>
    </div>
  );
};

