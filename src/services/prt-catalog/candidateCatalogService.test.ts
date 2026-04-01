import { describe, expect, it } from "vitest";
import type { PRTCatalogCandidatesFile } from "@/domain/types/prtCatalogCandidate";
import { buildCandidateCatalogService, toTemplateKey } from "@/services/prt-catalog/candidateCatalogService";

describe("candidateCatalogService.normalize", () => {
  it("normaliza status mapeados e separa status nao suportados", () => {
    const candidateCatalog: PRTCatalogCandidatesFile = {
      generated_at: "2026-04-01",
      source: "test",
      official_priority: [],
      notes: [],
      glossary: [],
      status_candidates: [
        { codigo_status: "CONFORME", mapped_mvp_status: "conforme", approved: false },
        {
          codigo_status: "EM_REGULARIZACAO",
          mapped_mvp_status: null,
          approved: false
        }
      ],
      homologated_candidates: [],
      recurring_candidates: []
    };

    const service = buildCandidateCatalogService({
      inspectionItems: {
        statuses: [
          "conforme",
          "nao_conforme",
          "em_manutencao",
          "sem_acesso",
          "nao_testado"
        ]
      },
      candidateCatalog
    });

    const output = service.normalize();

    expect(output.normalizedStatuses).toEqual([
      {
        sourceCode: "CONFORME",
        mappedStatus: "conforme",
        approved: false
      }
    ]);

    expect(output.unsupportedStatuses).toEqual([
      {
        sourceCode: "EM_REGULARIZACAO",
        mappedStatus: null,
        approved: false,
        reason: "missing_mapping"
      }
    ]);
  });

  it("normaliza templates homologados, garante Local e detecta chave duplicada", () => {
    const candidateCatalog: PRTCatalogCandidatesFile = {
      generated_at: "2026-04-01",
      source: "test",
      official_priority: [],
      notes: [],
      glossary: [],
      status_candidates: [],
      homologated_candidates: [
        {
          codigo: "SINAL_001",
          categoria: "Sinalizacao",
          subcategoria: "Geral",
          item: "sinalizacao",
          status: "nao_conforme",
          rule: null,
          state: "SP",
          template: "Deve sinalizar",
          source: "homologado",
          approved: false,
          uses_variables: ["mes_ano", "mes_ano", " "]
        },
        {
          codigo: "SINAL_001_DUP",
          categoria: "Sinalizacao",
          subcategoria: "Geral",
          item: "sinalizacao",
          status: "nao_conforme",
          rule: "",
          state: "SP",
          template: "Local - Deve sinalizar",
          source: "homologado",
          approved: false
        }
      ],
      recurring_candidates: []
    };

    const service = buildCandidateCatalogService({
      inspectionItems: {
        statuses: [
          "conforme",
          "nao_conforme",
          "em_manutencao",
          "sem_acesso",
          "nao_testado"
        ]
      },
      candidateCatalog
    });

    const output = service.normalize();
    const first = output.homologatedTemplates[0];

    expect(first.template).toBe("Local - Deve sinalizar");
    expect(first.usesVariables).toEqual(["mes_ano"]);
    expect(output.duplicatedTemplateKeys).toEqual([toTemplateKey(first)]);
  });
});
