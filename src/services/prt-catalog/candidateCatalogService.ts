import inspectionItemsData from "@data/inspection_items.json";
import candidateCatalogData from "@data/prt_catalog_candidates.json";
import type { InspectionStatus, StateCode } from "@/domain/types/inspection";
import type {
  CandidateCatalogNormalizationResult,
  NormalizedCandidateStatusEntry,
  NormalizedHomologatedCandidateTemplate,
  PRTCatalogCandidatesFile,
  RecurringCandidateEntry,
  UnsupportedCandidateStatusEntry
} from "@/domain/types/prtCatalogCandidate";

interface InspectionItemsJson {
  statuses: InspectionStatus[];
}

interface CandidateCatalogServiceDependencies {
  inspectionItems: InspectionItemsJson;
  candidateCatalog: PRTCatalogCandidatesFile;
}

const normalizeRule = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeState = (value: string): StateCode => {
  return value === "RJ" ? "RJ" : "SP";
};

const normalizeTemplateText = (template: string): string => {
  const trimmed = template.trim();
  if (!trimmed.startsWith("Local - ")) {
    return `Local - ${trimmed}`;
  }

  return trimmed;
};

const normalizeVariables = (variables?: string[]): string[] => {
  if (!Array.isArray(variables)) {
    return [];
  }

  return [...new Set(variables.map((variable) => variable.trim()).filter(Boolean))];
};

export const toTemplateKey = (template: {
  item: string;
  status: InspectionStatus;
  state: StateCode;
  rule?: string;
}): string => {
  return [template.item, template.status, template.state, template.rule ?? ""].join("|");
};

export const buildCandidateCatalogService = (
  dependencies: CandidateCatalogServiceDependencies
) => {
  const supportedStatusSet = new Set(dependencies.inspectionItems.statuses);

  const normalizeStatuses = (): {
    normalizedStatuses: NormalizedCandidateStatusEntry[];
    unsupportedStatuses: UnsupportedCandidateStatusEntry[];
  } => {
    const normalizedStatuses: NormalizedCandidateStatusEntry[] = [];
    const unsupportedStatuses: UnsupportedCandidateStatusEntry[] = [];

    for (const statusCandidate of dependencies.candidateCatalog.status_candidates) {
      if (!statusCandidate.mapped_mvp_status) {
        unsupportedStatuses.push({
          sourceCode: statusCandidate.codigo_status,
          mappedStatus: null,
          approved: statusCandidate.approved,
          reason: "missing_mapping"
        });
        continue;
      }

      if (!supportedStatusSet.has(statusCandidate.mapped_mvp_status)) {
        unsupportedStatuses.push({
          sourceCode: statusCandidate.codigo_status,
          mappedStatus: statusCandidate.mapped_mvp_status,
          approved: statusCandidate.approved,
          reason: "mapped_status_not_supported_by_inspection_catalog"
        });
        continue;
      }

      normalizedStatuses.push({
        sourceCode: statusCandidate.codigo_status,
        mappedStatus: statusCandidate.mapped_mvp_status,
        approved: statusCandidate.approved
      });
    }

    return { normalizedStatuses, unsupportedStatuses };
  };

  const normalizeHomologatedTemplates = (): {
    homologatedTemplates: NormalizedHomologatedCandidateTemplate[];
    duplicatedTemplateKeys: string[];
  } => {
    const homologatedTemplates: NormalizedHomologatedCandidateTemplate[] = [];
    const duplicatedTemplateKeys: string[] = [];
    const keySet = new Set<string>();

    for (const candidate of dependencies.candidateCatalog.homologated_candidates) {
      const normalizedTemplate: NormalizedHomologatedCandidateTemplate = {
        code: candidate.codigo,
        category: candidate.categoria,
        source: "homologado",
        approved: candidate.approved,
        item: candidate.item,
        status: candidate.status,
        state: normalizeState(candidate.state),
        rule: normalizeRule(candidate.rule),
        template: normalizeTemplateText(candidate.template),
        usesVariables: normalizeVariables(candidate.uses_variables)
      };

      const key = toTemplateKey(normalizedTemplate);
      if (keySet.has(key)) {
        duplicatedTemplateKeys.push(key);
      } else {
        keySet.add(key);
      }

      homologatedTemplates.push(normalizedTemplate);
    }

    return { homologatedTemplates, duplicatedTemplateKeys };
  };

  return {
    getRawCatalog(): PRTCatalogCandidatesFile {
      return dependencies.candidateCatalog;
    },

    normalize(): CandidateCatalogNormalizationResult {
      const { normalizedStatuses, unsupportedStatuses } = normalizeStatuses();
      const { homologatedTemplates, duplicatedTemplateKeys } =
        normalizeHomologatedTemplates();

      const recurringItems: RecurringCandidateEntry[] = [
        ...dependencies.candidateCatalog.recurring_candidates
      ];

      return {
        normalizedStatuses,
        unsupportedStatuses,
        homologatedTemplates,
        recurringItems,
        duplicatedTemplateKeys
      };
    }
  };
};

export const candidateCatalogService = buildCandidateCatalogService({
  inspectionItems: inspectionItemsData as InspectionItemsJson,
  candidateCatalog: candidateCatalogData as PRTCatalogCandidatesFile
});
