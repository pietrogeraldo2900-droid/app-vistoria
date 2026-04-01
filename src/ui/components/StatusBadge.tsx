import type { ReactElement } from "react";
import type { InspectionStatus } from "@/domain/types/inspection";

interface StatusBadgeProps {
  status: InspectionStatus;
}

const statusLabels: Record<InspectionStatus, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  em_manutencao: "Em manutenção",
  sem_acesso: "Sem acesso",
  nao_testado: "Não testado"
};

export const StatusBadge = ({ status }: StatusBadgeProps): ReactElement => {
  return (
    <span className={`status-badge status-${status.replace("_", "-")}`}>
      {statusLabels[status]}
    </span>
  );
};
