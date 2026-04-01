import prtTemplatesData from "@data/prt_templates.json";
import type { InspectionStatus, StateCode } from "@/domain/types/inspection";
import type { PRTTemplate, TemplateCollection } from "@/domain/types/template";

const templateCollection = prtTemplatesData as TemplateCollection;

interface FindTemplateInput {
  item: string;
  status: InspectionStatus;
  state: StateCode;
  rule?: string;
}

export const findHomologatedTemplate = (
  input: FindTemplateInput
): PRTTemplate | undefined => {
  const exactWithRule = templateCollection.templates.find((template) => {
    return (
      template.item === input.item &&
      template.status === input.status &&
      template.state === input.state &&
      template.rule !== undefined &&
      template.rule === input.rule
    );
  });

  if (exactWithRule) {
    return exactWithRule;
  }

  return templateCollection.templates.find((template) => {
    return (
      template.item === input.item &&
      template.status === input.status &&
      template.state === input.state &&
      template.rule === undefined
    );
  });
};
