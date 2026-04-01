import type { InspectionStatus } from "@/domain/types/inspection";

const statusFallbacks: Partial<Record<InspectionStatus, string>> = {
  em_manutencao:
    "Local - Item em manutencao no momento da vistoria, com necessidade de reavaliacao apos conclusao do servico.",
  sem_acesso:
    "Local - Nao foi possivel acessar o local ou equipamento durante a vistoria para validacao tecnica.",
  nao_testado:
    "Local - O item nao foi testado durante a vistoria e permanece sem validacao operacional."
};

export const resolveFallbackTemplate = (
  status: InspectionStatus
): string | undefined => statusFallbacks[status];

export const MISSING_HOMOLOGATED_TEMPLATE_REASON =
  "combinacao de item/status sem template homologado";
