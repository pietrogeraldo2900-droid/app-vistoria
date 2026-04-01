import { useEffect, useState, type ReactElement } from "react";
import type { InspectionRecord, ReportLine } from "@/domain/types/inspection";
import { Link, useParams } from "react-router-dom";
import { formatDate } from "@/domain/utils/format";
import { pdfExportService } from "@/export/pdf/pdfExportService";
import { catalogService } from "@/services/inspection/catalogService";
import { inspectionService } from "@/services/inspection/inspectionService";
import { SectionPanel } from "@/ui/components/SectionPanel";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const inspectionTypeLabelMap = {
  inicial: "Inicial",
  periodica: "Periodica",
  retorno: "Retorno",
  extraordinaria: "Extraordinaria"
} as const;

export const ReportPreviewPage = (): ReactElement => {
  const { inspectionId } = useParams();
  const [exportFeedback, setExportFeedback] = useState("");
  const [inspection, setInspection] = useState<InspectionRecord | undefined>(undefined);
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!inspectionId) {
      setInspection(undefined);
      setLines([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    void Promise.all([
      inspectionService.getInspectionById(inspectionId),
      inspectionService.generateReportLines(inspectionId)
    ])
      .then(([inspectionRecord, reportLines]) => {
        if (!isMounted) {
          return;
        }
        setInspection(inspectionRecord);
        setLines(reportLines);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setInspection(undefined);
        setLines([]);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inspectionId]);

  const finalLines = lines.filter(
    (line) => !line.isTechnicalPending && line.text.trim().length > 0
  );
  const groupedFinalLines = finalLines.reduce<Record<string, typeof finalLines>>(
    (acc, line) => {
      if (!acc[line.locationName]) {
        acc[line.locationName] = [];
      }
      acc[line.locationName].push(line);
      return acc;
    },
    {}
  );
  const technicalPendingLines = lines.filter((line) => line.isTechnicalPending);

  const handleExportPdf = async (): Promise<void> => {
    if (!inspection) {
      return;
    }

    try {
      const result = await pdfExportService.exportInspectionToPdf(
        pdfExportService.preparePayload(inspection, lines)
      );
      setExportFeedback(
        `PDF gerado com ${result.exportedLines} apontamento(s): ${result.fileName}.`
      );
    } catch (error) {
      setExportFeedback(
        getErrorMessage(error, "Nao foi possivel gerar o PDF desta vistoria.")
      );
    }
  };

  if (isLoading) {
    return (
      <div className="page-grid">
        <SectionPanel title="Carregando vistoria" subtitle="Aguarde a carga da previa.">
          <p className="empty-state">Buscando dados da vistoria...</p>
        </SectionPanel>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="page-grid">
        <SectionPanel title="Previa indisponivel" subtitle="Vistoria nao encontrada.">
          <Link className="btn btn-primary" to="/history">
            Ir para historico
          </Link>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <SectionPanel
        title="Pre-visualizacao do relatorio"
        subtitle="Texto final consolidado para o PRT da vistoria."
        delayMs={80}
        actions={
          <div className="inline-actions compact">
            <Link className="btn btn-ghost" to={`/inspection/${inspection.id}/edit`}>
              Voltar para edicao
            </Link>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleExportPdf}
              disabled={finalLines.length === 0}
            >
              Exportar PDF
            </button>
          </div>
        }
      >
        {exportFeedback ? <p className="feedback-message">{exportFeedback}</p> : null}

        <div className="inspection-meta">
          <p>
            <strong>Titulo:</strong> {inspection.title}
          </p>
          <p>
            <strong>Empresa:</strong> {inspection.companyName}
          </p>
          <p>
            <strong>Unidade:</strong> {inspection.unitName}
          </p>
          <p>
            <strong>Endereco:</strong> {inspection.address}
          </p>
          <p>
            <strong>Cidade:</strong> {inspection.city}
          </p>
          <p>
            <strong>Cliente / contratante:</strong> {inspection.clientName || "-"}
          </p>
          <p>
            <strong>Contrato / OS:</strong> {inspection.contractCode || "-"}
          </p>
          <p>
            <strong>Tipo:</strong> {inspectionTypeLabelMap[inspection.inspectionType]}
          </p>
          <p>
            <strong>Responsavel tecnico:</strong> {inspection.inspectorName}
          </p>
          <p>
            <strong>Estado:</strong> {inspection.state}
          </p>
          <p>
            <strong>Data:</strong> {formatDate(inspection.inspectionDate)}
          </p>
          {inspection.generalObservation.trim() ? (
            <p>
              <strong>Observacao geral:</strong> {inspection.generalObservation}
            </p>
          ) : null}
        </div>

        {finalLines.length === 0 ? (
          <p className="empty-state">
            Nenhum texto final disponivel ainda. Cadastre itens com regras homologadas.
          </p>
        ) : (
          <div className="report-lines">
            {Object.entries(groupedFinalLines).map(([locationName, locationLines]) => (
              <article key={locationName}>
                <h3>{locationName}</h3>
                {locationLines.map((line) => (
                  <p key={line.itemId}>{line.text}</p>
                ))}
              </article>
            ))}
          </div>
        )}

        {technicalPendingLines.length > 0 ? (
          <div className="technical-pending">
            <h3>Pendencias tecnicas internas</h3>
            <p>
              Os itens abaixo nao entraram no texto final porque nao ha template
              homologado para a combinacao informada.
            </p>
            <ul>
              {technicalPendingLines.map((line) => (
                <li key={`pending-${line.itemId}`}>
                  <strong>{line.locationName}</strong> -{" "}
                  {catalogService.getItemByKey(line.itemKey)?.label ?? line.itemKey} (
                  {line.status})
                  {line.technicalPendingReason
                    ? `: ${line.technicalPendingReason}.`
                    : "."}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionPanel>
    </div>
  );
};
