import type {
  CandidateTemplateApplyResult,
  CandidateTemplateComparison,
  CandidateTemplateMergePlan,
  NormalizedHomologatedCandidateTemplate
} from "@/domain/types/prtCatalogCandidate";
import type { PRTTemplate, TemplateCollection } from "@/domain/types/template";
import { toTemplateKey } from "@/services/prt-catalog/candidateCatalogService";

const normalizeTemplateContent = (template: string): string => {
  return template.trim();
};

const buildOfficialTemplateIndex = (templates: PRTTemplate[]): Map<string, PRTTemplate> => {
  const index = new Map<string, PRTTemplate>();

  for (const template of templates) {
    index.set(toTemplateKey(template), template);
  }

  return index;
};

export const candidateTemplateMergeService = {
  buildMergePlan(
    officialTemplates: TemplateCollection,
    candidates: NormalizedHomologatedCandidateTemplate[]
  ): CandidateTemplateMergePlan {
    const sameAsOfficial: CandidateTemplateComparison[] = [];
    const pendingConflicts: CandidateTemplateComparison[] = [];
    const approvedConflicts: CandidateTemplateComparison[] = [];
    const pendingCreates: CandidateTemplateComparison[] = [];
    const approvedCreates: CandidateTemplateComparison[] = [];

    const officialIndex = buildOfficialTemplateIndex(officialTemplates.templates);

    for (const candidate of candidates) {
      const key = toTemplateKey(candidate);
      const official = officialIndex.get(key);

      if (!official) {
        if (candidate.approved) {
          approvedCreates.push({ candidate });
        } else {
          pendingCreates.push({ candidate });
        }
        continue;
      }

      const sameTemplate =
        normalizeTemplateContent(official.template) ===
        normalizeTemplateContent(candidate.template);

      if (sameTemplate) {
        sameAsOfficial.push({ candidate, official });
        continue;
      }

      if (candidate.approved) {
        approvedConflicts.push({ candidate, official });
      } else {
        pendingConflicts.push({ candidate, official });
      }
    }

    return {
      sameAsOfficial,
      pendingConflicts,
      approvedConflicts,
      pendingCreates,
      approvedCreates
    };
  },

  applyApprovedCandidates(
    officialTemplates: TemplateCollection,
    mergePlan: CandidateTemplateMergePlan
  ): CandidateTemplateApplyResult {
    const draftTemplates = [...officialTemplates.templates];
    const templateIndex = buildOfficialTemplateIndex(draftTemplates);
    const updatedKeys: string[] = [];
    const createdKeys: string[] = [];

    const applyList = [
      ...mergePlan.approvedConflicts,
      ...mergePlan.approvedCreates
    ];

    for (const comparison of applyList) {
      const { candidate } = comparison;
      const key = toTemplateKey(candidate);
      const existing = templateIndex.get(key);

      const candidateAsTemplate: PRTTemplate = {
        item: candidate.item,
        status: candidate.status,
        state: candidate.state,
        rule: candidate.rule,
        template: candidate.template
      };

      if (existing) {
        const indexToUpdate = draftTemplates.findIndex(
          (template) => toTemplateKey(template) === key
        );
        if (indexToUpdate >= 0) {
          draftTemplates[indexToUpdate] = candidateAsTemplate;
          updatedKeys.push(key);
        }
      } else {
        draftTemplates.push(candidateAsTemplate);
        createdKeys.push(key);
      }

      templateIndex.set(key, candidateAsTemplate);
    }

    return {
      templates: {
        templates: draftTemplates
      },
      updatedKeys,
      createdKeys
    };
  }
};
