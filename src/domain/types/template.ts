import type { InspectionStatus, StateCode } from "@/domain/types/inspection";

export interface PRTTemplate {
  item: string;
  status: InspectionStatus;
  state: StateCode;
  rule?: string;
  template: string;
}

export interface TemplateCollection {
  templates: PRTTemplate[];
}
