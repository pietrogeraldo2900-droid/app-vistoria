import type {
  InspectionFieldValues,
  InspectionStatus,
  StateCode
} from "@/domain/types/inspection";
import { prtEngine } from "@/prt-engine/prtEngine";

type ExpectedCondition = "sim" | "nao" | "month_valid" | "required";

interface ItemValidationRule {
  requiredByStatus: Partial<Record<InspectionStatus, string[]>>;
  conformExpectations?: Record<string, ExpectedCondition>;
}

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

interface ValidateItemInput {
  itemKey: string;
  status: InspectionStatus;
  state: StateCode;
  locationName: string;
  fieldValues: InspectionFieldValues;
}

const itemRules: Record<string, ItemValidationRule> = {
  extintor: {
    requiredByStatus: {
      conforme: ["lacrado", "conforme_pressao", "selo_inmetro", "validade_recarga"],
      nao_conforme: [
        "lacrado",
        "conforme_pressao",
        "selo_inmetro",
        "validade_recarga"
      ]
    },
    conformExpectations: {
      lacrado: "sim",
      conforme_pressao: "sim",
      selo_inmetro: "sim",
      validade_recarga: "month_valid"
    }
  },
  hidrante: {
    requiredByStatus: {
      conforme: [
        "possui_esguicho",
        "possui_chave_storz",
        "possui_registro",
        "sinalizacao_instalada",
        "mangueira_teste_hidrostatico_validade"
      ],
      nao_conforme: [
        "possui_esguicho",
        "possui_chave_storz",
        "possui_registro",
        "sinalizacao_instalada",
        "mangueira_teste_hidrostatico_validade"
      ]
    },
    conformExpectations: {
      possui_esguicho: "sim",
      possui_chave_storz: "sim",
      possui_registro: "sim",
      sinalizacao_instalada: "sim",
      mangueira_teste_hidrostatico_validade: "month_valid",
      abrigo_incompleto: "nao"
    }
  },
  detector_fumaca: {
    requiredByStatus: {
      conforme: ["instalado"],
      nao_conforme: ["instalado"]
    },
    conformExpectations: {
      instalado: "sim"
    }
  },
  detector_calor: {
    requiredByStatus: {
      conforme: ["instalado"],
      nao_conforme: ["instalado"]
    },
    conformExpectations: {
      instalado: "sim"
    }
  },
  central_alarme: {
    requiredByStatus: {
      conforme: ["painel_ativo", "sirene_operante", "bateria_backup_ok"],
      nao_conforme: ["painel_ativo", "sirene_operante", "bateria_backup_ok"]
    },
    conformExpectations: {
      painel_ativo: "sim",
      sirene_operante: "sim",
      bateria_backup_ok: "sim"
    }
  },
  acionador_manual: {
    requiredByStatus: {
      conforme: ["instalado", "sinalizado", "funcionamento_ok"],
      nao_conforme: ["instalado", "sinalizado", "funcionamento_ok"]
    },
    conformExpectations: {
      instalado: "sim",
      sinalizado: "sim",
      funcionamento_ok: "sim"
    }
  },
  iluminacao_emergencia: {
    requiredByStatus: {
      conforme: ["funcionamento_ok"],
      nao_conforme: ["funcionamento_ok"]
    },
    conformExpectations: {
      funcionamento_ok: "sim"
    }
  },
  sinalizacao: {
    requiredByStatus: {
      conforme: ["instalada", "tipo_fotoluminescente"],
      nao_conforme: ["instalada", "tipo_fotoluminescente"]
    },
    conformExpectations: {
      instalada: "sim",
      tipo_fotoluminescente: "sim"
    }
  },
  recalque: {
    requiredByStatus: {
      conforme: ["valvula_funcional", "tampa_presente", "sinalizacao_instalada"],
      nao_conforme: ["valvula_funcional", "tampa_presente", "sinalizacao_instalada"]
    },
    conformExpectations: {
      valvula_funcional: "sim",
      tampa_presente: "sim",
      sinalizacao_instalada: "sim"
    }
  },
  bomba_principal: {
    requiredByStatus: {
      conforme: ["funcionamento_ok", "pressao_adequada", "acionamento_automatico_ok"],
      nao_conforme: ["funcionamento_ok", "pressao_adequada", "acionamento_automatico_ok"]
    },
    conformExpectations: {
      funcionamento_ok: "sim",
      pressao_adequada: "sim",
      acionamento_automatico_ok: "sim"
    }
  },
  bomba_jockey: {
    requiredByStatus: {
      conforme: ["funcionamento_ok", "pressao_adequada"],
      nao_conforme: ["funcionamento_ok", "pressao_adequada"]
    },
    conformExpectations: {
      funcionamento_ok: "sim",
      pressao_adequada: "sim"
    }
  },
  spk: {
    requiredByStatus: {
      conforme: ["instalado"],
      nao_conforme: ["instalado"]
    },
    conformExpectations: {
      instalado: "sim"
    }
  },
  pcf: {
    requiredByStatus: {
      conforme: ["fechamento_automatico", "sem_obstrucao", "sinalizacao_instalada"],
      nao_conforme: ["fechamento_automatico", "sem_obstrucao", "sinalizacao_instalada"]
    },
    conformExpectations: {
      fechamento_automatico: "sim",
      sem_obstrucao: "sim",
      sinalizacao_instalada: "sim"
    }
  },
  eletroima: {
    requiredByStatus: {
      conforme: ["retencao_porta_ok", "libera_no_alarme"],
      nao_conforme: ["retencao_porta_ok", "libera_no_alarme"]
    },
    conformExpectations: {
      retencao_porta_ok: "sim",
      libera_no_alarme: "sim"
    }
  },
  shaft_incendio: {
    requiredByStatus: {
      conforme: ["obstruido"],
      nao_conforme: ["obstruido"]
    },
    conformExpectations: {
      obstruido: "nao"
    }
  },
  escada_pressurizada: {
    requiredByStatus: {
      conforme: ["pressurizacao_ok", "porta_estanque_ok"],
      nao_conforme: ["pressurizacao_ok", "porta_estanque_ok"]
    },
    conformExpectations: {
      pressurizacao_ok: "sim",
      porta_estanque_ok: "sim"
    }
  },
  rti: {
    requiredByStatus: {
      conforme: ["volume_reserva_ok", "acesso_desobstruido"],
      nao_conforme: ["volume_reserva_ok", "acesso_desobstruido"]
    },
    conformExpectations: {
      volume_reserva_ok: "sim",
      acesso_desobstruido: "sim"
    }
  }
};

const isBlank = (value: string | undefined): boolean => !value || !value.trim();

const parseMonthValue = (value: string | undefined): { year: number; month: number } | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  }

  const brMatch = normalized.match(/^(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return { year: Number(brMatch[2]), month: Number(brMatch[1]) };
  }

  return null;
};

const isMonthValid = (value: string | undefined): boolean => {
  const parsed = parseMonthValue(value);
  if (!parsed) {
    return false;
  }
  if (parsed.month < 1 || parsed.month > 12) {
    return false;
  }

  const now = new Date();
  const currentYearMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
  const targetYearMonth = parsed.year * 100 + parsed.month;
  return targetYearMonth >= currentYearMonth;
};

const matchesCondition = (value: string | undefined, condition: ExpectedCondition): boolean => {
  if (condition === "required") {
    return !isBlank(value);
  }
  if (condition === "sim") {
    return value === "sim";
  }
  if (condition === "nao") {
    return value === "nao";
  }
  return isMonthValid(value);
};

const formatConformRuleMessage = (field: string): string =>
  `Status conforme bloqueado: criterio tecnico minimo nao atendido para o campo "${field}".`;

const formatRequiredMessage = (field: string): string =>
  `Campo obrigatorio nao preenchido para esta combinacao de item/status: "${field}".`;

const formatIncoherentNaoConformeMessage = (): string =>
  "Status nao_conforme bloqueado: nenhum criterio tecnico indica falha na avaliacao.";

const uniqueIssues = (issues: ValidationIssue[]): ValidationIssue[] => {
  const map = new Map<string, ValidationIssue>();
  for (const issue of issues) {
    const key = `${issue.code}|${issue.field ?? ""}|${issue.message}`;
    if (!map.has(key)) {
      map.set(key, issue);
    }
  }
  return [...map.values()];
};

export const inspectionValidationService = {
  getRequiredFields(itemKey: string, status: InspectionStatus): string[] {
    const rule = itemRules[itemKey];
    if (!rule) {
      return [];
    }
    return rule.requiredByStatus[status] ?? [];
  },

  validateItemInput(input: ValidateItemInput): ValidationResult {
    const issues: ValidationIssue[] = [];
    const rule = itemRules[input.itemKey];

    const requiredFields = this.getRequiredFields(input.itemKey, input.status);
    for (const field of requiredFields) {
      if (isBlank(input.fieldValues[field])) {
        issues.push({
          code: "required_field_missing",
          field,
          message: formatRequiredMessage(field)
        });
      }
    }

    if (rule?.conformExpectations && input.status === "conforme") {
      for (const [field, condition] of Object.entries(rule.conformExpectations)) {
        if (!matchesCondition(input.fieldValues[field], condition)) {
          issues.push({
            code: "conforme_criteria_not_met",
            field,
            message: formatConformRuleMessage(field)
          });
        }
      }
    }

    if (rule?.conformExpectations && input.status === "nao_conforme") {
      const expectationEntries = Object.entries(rule.conformExpectations);
      const failedAny = expectationEntries.some(([field, condition]) => {
        const value = input.fieldValues[field];
        if (isBlank(value)) {
          return false;
        }
        return !matchesCondition(value, condition);
      });

      if (!failedAny) {
        issues.push({
          code: "incoherent_nao_conforme",
          message: formatIncoherentNaoConformeMessage()
        });
      }
    }

    const generation = prtEngine.generate({
      itemKey: input.itemKey,
      status: input.status,
      state: input.state,
      locationName: input.locationName,
      fieldValues: input.fieldValues
    });

    if (generation.isTechnicalPending) {
      issues.push({
        code: "missing_homologated_template",
        message:
          "Combinacao bloqueada: nao existe template homologado para item/status/estado."
      });
    }

    const resolvedIssues = uniqueIssues(issues);
    return {
      isValid: resolvedIssues.length === 0,
      issues: resolvedIssues
    };
  }
};
