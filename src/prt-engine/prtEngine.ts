import type {
  InspectionFieldValues,
  InspectionStatus,
  StateCode
} from "@/domain/types/inspection";
import {
  formatMonthYearForReport,
  isMonthYearExpired,
  isMonthYearValid
} from "@/domain/utils/monthYear";
import {
  MISSING_HOMOLOGATED_TEMPLATE_REASON,
  resolveFallbackTemplate
} from "@/prt-engine/fallbackTemplates";
import { normalizeLocationName } from "@/prt-engine/locationNormalizer";
import { findHomologatedTemplate } from "@/prt-engine/templateRepository";

interface GenerateTextInput {
  itemKey: string;
  status: InspectionStatus;
  state: StateCode;
  locationName: string;
  fieldValues: InspectionFieldValues;
}

export interface GenerateTextOutput {
  text: string;
  isTechnicalPending: boolean;
  technicalPendingReason?: string;
}

const resolveRule = (
  itemKey: string,
  status: InspectionStatus,
  fieldValues: InspectionFieldValues
): string | undefined => {
  if (
    itemKey === "extintor" &&
    status === "nao_conforme" &&
    fieldValues.lacrado === "nao"
  ) {
    return "sem_lacre";
  }

  if (
    itemKey === "extintor" &&
    status === "conforme" &&
    isMonthYearValid(fieldValues.validade_recarga)
  ) {
    return "validade_vigente";
  }

  if (
    itemKey === "extintor" &&
    status === "nao_conforme" &&
    isMonthYearExpired(fieldValues.validade_recarga)
  ) {
    return "validade_vencida";
  }

  if (
    itemKey === "hidrante" &&
    status === "nao_conforme" &&
    fieldValues.abrigo_incompleto === "sim"
  ) {
    return "abrigo_incompleto";
  }

  if (
    itemKey === "hidrante" &&
    status === "conforme" &&
    isMonthYearValid(fieldValues.mangueira_teste_hidrostatico_validade)
  ) {
    return "mangueira_teste_hidrostatico_valido";
  }

  if (
    itemKey === "hidrante" &&
    status === "nao_conforme" &&
    isMonthYearExpired(fieldValues.mangueira_teste_hidrostatico_validade)
  ) {
    return "mangueira_teste_hidrostatico_vencido";
  }

  if (
    itemKey === "sinalizacao" &&
    status === "nao_conforme" &&
    fieldValues.sinalizacao_extintor_po === "sim"
  ) {
    return "sinalizacao_extintor_po";
  }

  if (itemKey === "spk" && status === "nao_conforme") {
    return "spk_detector_fumaca";
  }

  return undefined;
};

const resolveMonthYearPlaceholder = (fieldValues: InspectionFieldValues): string => {
  const monthYearFields = [
    "validade_recarga",
    "mangueira_teste_hidrostatico_validade"
  ];

  for (const field of monthYearFields) {
    const formatted = formatMonthYearForReport(fieldValues[field]);
    if (formatted && formatted.length > 0) {
      return formatted;
    }
  }

  return "nao informado";
};

const applyTemplatePlaceholders = (
  template: string,
  locationName: string,
  fieldValues: InspectionFieldValues
): string => {
  const normalizedLocation = normalizeLocationName(locationName);
  const withLocation = template.replace(/\bLocal\b/g, normalizedLocation);
  return withLocation.replace(
    /\[(?:m[e\u00ea]s)\/ano\]/gi,
    resolveMonthYearPlaceholder(fieldValues)
  );
};

export const prtEngine = {
  generate(input: GenerateTextInput): GenerateTextOutput {
    const rule = resolveRule(input.itemKey, input.status, input.fieldValues);
    const homologated = findHomologatedTemplate({
      item: input.itemKey,
      status: input.status,
      state: input.state,
      rule
    });

    if (homologated) {
      return {
        text: applyTemplatePlaceholders(
          homologated.template,
          input.locationName,
          input.fieldValues
        ),
        isTechnicalPending: false
      };
    }

    const fallbackByStatus = resolveFallbackTemplate(input.status);
    if (fallbackByStatus) {
      return {
        text: applyTemplatePlaceholders(
          fallbackByStatus,
          input.locationName,
          input.fieldValues
        ),
        isTechnicalPending: false
      };
    }

    return {
      text: "",
      isTechnicalPending: true,
      technicalPendingReason: MISSING_HOMOLOGATED_TEMPLATE_REASON
    };
  },

  generateText(input: GenerateTextInput): string {
    return this.generate(input).text;
  }
};
