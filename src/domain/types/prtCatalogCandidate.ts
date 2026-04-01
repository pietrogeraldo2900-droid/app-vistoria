import type { InspectionStatus, StateCode } from "@/domain/types/inspection";
import type { PRTTemplate, TemplateCollection } from "@/domain/types/template";

export interface CandidateStatusEntry {
  codigo_status: string;
  mapped_mvp_status: InspectionStatus | null;
  approved: boolean;
}

export interface HomologatedCandidateEntry {
  codigo: string;
  categoria: string;
  subcategoria: string;
  item: string;
  status: InspectionStatus;
  rule?: string | null;
  state: StateCode;
  template: string;
  source: "homologado";
  approved: boolean;
  uses_variables?: string[];
}

export interface RecurringCandidateEntry {
  codigo: string;
  categoria: string;
  item: string;
  status_hint: InspectionStatus | null;
  template: string | null;
  source: "recorrente";
  approved: boolean;
}

export interface PRTCatalogCandidatesFile {
  generated_at: string;
  source: string;
  official_priority: string[];
  notes: string[];
  glossary: Array<{ sigla: string; descricao: string }>;
  status_candidates: CandidateStatusEntry[];
  homologated_candidates: HomologatedCandidateEntry[];
  recurring_candidates: RecurringCandidateEntry[];
}

export interface NormalizedCandidateStatusEntry {
  sourceCode: string;
  mappedStatus: InspectionStatus;
  approved: boolean;
}

export interface UnsupportedCandidateStatusEntry {
  sourceCode: string;
  mappedStatus: string | null;
  approved: boolean;
  reason:
    | "missing_mapping"
    | "mapped_status_not_supported_by_inspection_catalog";
}

export interface NormalizedHomologatedCandidateTemplate extends PRTTemplate {
  code: string;
  category: string;
  source: "homologado";
  approved: boolean;
  usesVariables: string[];
}

export interface CandidateCatalogNormalizationResult {
  normalizedStatuses: NormalizedCandidateStatusEntry[];
  unsupportedStatuses: UnsupportedCandidateStatusEntry[];
  homologatedTemplates: NormalizedHomologatedCandidateTemplate[];
  recurringItems: RecurringCandidateEntry[];
  duplicatedTemplateKeys: string[];
}

export interface CandidateTemplateComparison {
  candidate: NormalizedHomologatedCandidateTemplate;
  official?: PRTTemplate;
}

export interface CandidateTemplateMergePlan {
  sameAsOfficial: CandidateTemplateComparison[];
  pendingConflicts: CandidateTemplateComparison[];
  approvedConflicts: CandidateTemplateComparison[];
  pendingCreates: CandidateTemplateComparison[];
  approvedCreates: CandidateTemplateComparison[];
}

export interface CandidateTemplateApplyResult {
  templates: TemplateCollection;
  updatedKeys: string[];
  createdKeys: string[];
}
