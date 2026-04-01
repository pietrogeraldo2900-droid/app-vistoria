import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import type { InspectionRecord } from "@/domain/types/inspection";
import { formatDate, formatDateTime } from "@/domain/utils/format";
import { accessControlService } from "@/services/auth/accessControlService";
import { authService } from "@/services/auth/authService";
import { inspectionService } from "@/services/inspection/inspectionService";
import { SectionPanel } from "@/ui/components/SectionPanel";

export const HistoryPage = (): ReactElement => {
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

  const session = authService.getSession();
  const canEditInspection = accessControlService.hasPermission(
    session,
    "inspection:edit"
  );
  const inspectionTypeLabelMap = {
    inicial: "Inicial",
    periodica: "Periodica",
    retorno: "Retorno",
    extraordinaria: "Extraordinaria"
  } as const;

  return (
    <div className="page-grid">
      <SectionPanel
        title="Historico de vistorias"
        subtitle="Consulta rapida para continuidade tecnica e emissao de relatorio."
        delayMs={70}
      >
        {inspections.length === 0 ? (
          <p className="empty-state">Ainda nao existem vistorias registradas neste dispositivo.</p>
        ) : (
          <ul className="history-list">
            {inspections.map((inspection) => {
              const itemCount = inspection.locations.reduce(
                (acc, location) => acc + location.items.length,
                0
              );
              return (
                <li key={inspection.id}>
                  <div>
                    <h3>{inspection.title}</h3>
                    <p>{inspection.companyName}</p>
                    <p>
                      Unidade: {inspection.unitName || "-"} - Tipo:{" "}
                      {inspectionTypeLabelMap[inspection.inspectionType]}
                    </p>
                    <p>
                      {inspection.state} - {formatDate(inspection.inspectionDate)} - {itemCount}{" "}
                      item(ns)
                    </p>
                    <small>Ultima atualizacao: {formatDateTime(inspection.updatedAt)}</small>
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
              );
            })}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
};
