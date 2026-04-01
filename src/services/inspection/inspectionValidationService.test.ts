import { describe, expect, it } from "vitest";
import { inspectionValidationService } from "@/services/inspection/inspectionValidationService";

describe("inspectionValidationService", () => {
  it("retorna campos obrigatorios por combinacao item/status", () => {
    const required = inspectionValidationService.getRequiredFields(
      "extintor",
      "conforme"
    );

    expect(required).toEqual(
      expect.arrayContaining([
        "lacrado",
        "conforme_pressao",
        "selo_inmetro",
        "validade_recarga"
      ])
    );
  });

  it("exige campo explicito para diferenciar sinalizacao generica vs extintor de po", () => {
    const required = inspectionValidationService.getRequiredFields(
      "sinalizacao",
      "nao_conforme"
    );

    expect(required).toEqual(
      expect.arrayContaining(["instalada", "tipo_fotoluminescente", "sinalizacao_extintor_po"])
    );
  });

  it("bloqueia conforme quando criterio minimo nao e atendido", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "extintor",
      status: "conforme",
      state: "SP",
      locationName: "G1",
      fieldValues: {
        lacrado: "nao",
        conforme_pressao: "sim",
        selo_inmetro: "sim",
        validade_recarga: "2099-12"
      }
    });

    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "conforme_criteria_not_met" && issue.field === "lacrado"
      )
    ).toBe(true);
  });

  it("bloqueia quando campo obrigatorio estiver ausente", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "extintor",
      status: "conforme",
      state: "SP",
      locationName: "Sala tecnica",
      fieldValues: {
        lacrado: "sim",
        conforme_pressao: "sim",
        selo_inmetro: "sim"
      }
    });

    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "required_field_missing" && issue.field === "validade_recarga"
      )
    ).toBe(true);
  });

  it("bloqueia sinalizacao nao_conforme sem campo explicito de regra", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "sinalizacao",
      status: "nao_conforme",
      state: "SP",
      locationName: "Corredor",
      fieldValues: {
        instalada: "nao",
        tipo_fotoluminescente: "nao"
      }
    });

    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "required_field_missing" &&
          issue.field === "sinalizacao_extintor_po"
      )
    ).toBe(true);
  });

  it("bloqueia nao_conforme incoerente sem evidencia minima de falha", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "extintor",
      status: "nao_conforme",
      state: "SP",
      locationName: "Sala tecnica",
      fieldValues: {
        lacrado: "sim",
        conforme_pressao: "sim",
        selo_inmetro: "sim",
        validade_recarga: "2099-12"
      }
    });

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "incoherent_nao_conforme")).toBe(
      true
    );
  });

  it("bloqueia combinacao sem template homologado como pendencia tecnica interna", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "item_inexistente",
      status: "conforme",
      state: "SP",
      locationName: "Sala tecnica",
      fieldValues: {}
    });

    expect(result.isValid).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === "missing_homologated_template")
    ).toBe(true);
  });

  it("permite status especial com fallback tecnico seguro", () => {
    const result = inspectionValidationService.validateItemInput({
      itemKey: "central_alarme",
      status: "sem_acesso",
      state: "RJ",
      locationName: "G2",
      fieldValues: {}
    });

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
