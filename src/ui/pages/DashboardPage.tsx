import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import type { InspectionRecord } from "@/domain/types/inspection";
import { formatDateTime } from "@/domain/utils/format";
import { accessControlService } from "@/services/auth/accessControlService";
import { authService } from "@/services/auth/authService";
import { inspectionService } from "@/services/inspection/inspectionService";
import { SectionPanel } from "@/ui/components/SectionPanel";

export const DashboardPage = (): ReactElement => {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    void inspectionService.listInspections().then((records) => {
      if (isMounted) {
        setInspections(records);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const lastInspections = inspections.slice(0, 4);
  const session = authService.getSession();
  const canCreateInspection = accessControlService.hasPermission(
    session,
    "inspection:create"
  );
  const canEditInspection = accessControlService.hasPermission(
    session,
    "inspection:edit"
  );

  const totalLocations = inspections.reduce(
    (acc, inspection) => acc + inspection.locations.length,
    0
  );
  const totalItems = inspections.reduce((acc, inspection) => {
    return (
      acc +
      inspection.locations.reduce(
        (locationAcc, location) => locationAcc + location.items.length,
        0
      )
    );
  }, 0);

  const inspectionTypeLabelMap = {
    inicial: "Inicial",
    periodica: "Periodica",
    retorno: "Retorno",
    extraordinaria: "Extraordinaria"
  } as const;

  return (
    <div className="page-grid">
      <SectionPanel
        title="Painel de operacao"
        subtitle="Resumo rapido para o time tecnico."
        delayMs={60}
      >
        <div className="stats-row">
          <article className="metric-tile">
            <span>Total de vistorias</span>
            <strong>{inspections.length}</strong>
          </article>
          <article className="metric-tile">
            <span>Locais cadastrados</span>
            <strong>{totalLocations}</strong>
          </article>
          <article className="metric-tile">
            <span>Itens registrados</span>
            <strong>{totalItems}</strong>
          </article>
        </div>
        <div className="inline-actions">
          {canCreateInspection ? (
            <Link className="btn btn-primary" to="/inspection/new">
              Criar vistoria
            </Link>
          ) : null}
          <Link className="btn btn-ghost" to="/history">
            Ver historico
          </Link>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Ultimas vistorias"
        subtitle="Acesso direto para continuidade e revisao de relatorio."
        delayMs={140}
      >
        {lastInspections.length === 0 ? (
          <p className="empty-state">
            Nenhuma vistoria registrada ainda. Crie a primeira vistoria para iniciar o
            fluxo do PRT.
          </p>
        ) : (
          <ul className="simple-list">
            {lastInspections.map((inspection) => (
              <li key={inspection.id}>
                <div>
                  <h3>{inspection.title}</h3>
                  <p>
                    {inspection.companyName} - {inspection.unitName || "-"} -{" "}
                    {inspectionTypeLabelMap[inspection.inspectionType]} - {inspection.state} -{" "}
                    {formatDateTime(inspection.updatedAt)}
                  </p>
                </div>
                <div className="inline-actions compact">
                  {canEditInspection ? (
                    <Link className="btn btn-ghost" to={`/inspection/${inspection.id}/edit`}>
                      Editar
                    </Link>
                  ) : null}
                  <Link className="btn btn-outline" to={`/inspection/${inspection.id}/preview`}>
                    Previa
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
};
