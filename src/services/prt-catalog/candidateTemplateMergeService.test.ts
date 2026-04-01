import { describe, expect, it } from "vitest";
import type {
  NormalizedHomologatedCandidateTemplate
} from "@/domain/types/prtCatalogCandidate";
import type { TemplateCollection } from "@/domain/types/template";
import { toTemplateKey } from "@/services/prt-catalog/candidateCatalogService";
import { candidateTemplateMergeService } from "@/services/prt-catalog/candidateTemplateMergeService";

const officialTemplates: TemplateCollection = {
  templates: [
    {
      item: "extintor",
      status: "conforme",
      state: "SP",
      template: "Local - Texto oficial SP extintor conforme."
    }
  ]
};

const makeCandidate = (
  overrides: Partial<NormalizedHomologatedCandidateTemplate>
): NormalizedHomologatedCandidateTemplate => ({
  code: "CAND_001",
  category: "Teste",
  source: "homologado",
  approved: false,
  item: "extintor",
  status: "conforme",
  state: "SP",
  template: "Local - Texto oficial SP extintor conforme.",
  usesVariables: [],
  ...overrides
});

describe("candidateTemplateMergeService.buildMergePlan", () => {
  it("nao sobrescreve conflito sem aprovacao explicita", () => {
    const candidate = makeCandidate({
      code: "CAND_CONFLICT_PENDING",
      template: "Local - Texto candidato diferente.",
      approved: false
    });

    const plan = candidateTemplateMergeService.buildMergePlan(officialTemplates, [candidate]);

    expect(plan.pendingConflicts).toHaveLength(1);
    expect(plan.approvedConflicts).toHaveLength(0);
    expect(plan.approvedCreates).toHaveLength(0);
    expect(plan.sameAsOfficial).toHaveLength(0);
  });

  it("separa conflitos aprovados e criacoes aprovadas", () => {
    const approvedConflict = makeCandidate({
      code: "CAND_CONFLICT_APPROVED",
      template: "Local - Texto candidato aprovado.",
      approved: true
    });

    const approvedCreate = makeCandidate({
      code: "CAND_CREATE_APPROVED",
      approved: true,
      item: "detector_fumaca",
      status: "nao_conforme",
      state: "RJ",
      template: "Local - Texto novo aprovado."
    });

    const plan = candidateTemplateMergeService.buildMergePlan(officialTemplates, [
      approvedConflict,
      approvedCreate
    ]);

    expect(plan.approvedConflicts).toHaveLength(1);
    expect(plan.approvedCreates).toHaveLength(1);
    expect(plan.pendingConflicts).toHaveLength(0);
    expect(plan.pendingCreates).toHaveLength(0);
  });
});

describe("candidateTemplateMergeService.applyApprovedCandidates", () => {
  it("aplica somente candidatos aprovados", () => {
    const approvedConflict = makeCandidate({
      code: "CAND_CONFLICT_APPROVED",
      template: "Local - Texto candidato aprovado.",
      approved: true
    });

    const pendingCreate = makeCandidate({
      code: "CAND_CREATE_PENDING",
      item: "hidrante",
      status: "nao_conforme",
      state: "RJ",
      template: "Local - Texto novo pendente.",
      approved: false
    });

    const approvedCreate = makeCandidate({
      code: "CAND_CREATE_APPROVED",
      item: "hidrante",
      status: "nao_conforme",
      state: "SP",
      template: "Local - Texto novo aprovado.",
      approved: true
    });

    const plan = candidateTemplateMergeService.buildMergePlan(officialTemplates, [
      approvedConflict,
      pendingCreate,
      approvedCreate
    ]);

    const output = candidateTemplateMergeService.applyApprovedCandidates(
      officialTemplates,
      plan
    );

    const conflictKey = toTemplateKey(approvedConflict);
    const approvedCreateKey = toTemplateKey(approvedCreate);
    const pendingCreateKey = toTemplateKey(pendingCreate);

    expect(output.updatedKeys).toContain(conflictKey);
    expect(output.createdKeys).toContain(approvedCreateKey);
    expect(output.createdKeys).not.toContain(pendingCreateKey);

    const resultingIndex = new Map(
      output.templates.templates.map((template) => [toTemplateKey(template), template])
    );

    expect(resultingIndex.get(conflictKey)?.template).toBe(
      "Local - Texto candidato aprovado."
    );
    expect(resultingIndex.get(approvedCreateKey)?.template).toBe(
      "Local - Texto novo aprovado."
    );
    expect(resultingIndex.has(pendingCreateKey)).toBe(false);
  });
});
