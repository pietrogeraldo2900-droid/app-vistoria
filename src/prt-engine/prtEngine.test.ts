import { describe, expect, it } from "vitest";
import { prtEngine } from "@/prt-engine/prtEngine";
import { MISSING_HOMOLOGATED_TEMPLATE_REASON } from "@/prt-engine/fallbackTemplates";

describe("prtEngine.generate", () => {
  it("usa template homologado de SP com citacao de IT quando aplicavel", () => {
    const output = prtEngine.generate({
      itemKey: "detector_fumaca",
      status: "nao_conforme",
      state: "SP",
      locationName: "Sala de maquinas",
      fieldValues: {
        instalado: "nao"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Sala de maquinas - ")).toBe(true);
    expect(output.text).toContain("IT 19/2025");
  });

  it("usa template homologado de RJ sem citacao de IT quando aplicavel", () => {
    const output = prtEngine.generate({
      itemKey: "detector_fumaca",
      status: "nao_conforme",
      state: "RJ",
      locationName: "Sala de maquinas",
      fieldValues: {
        instalado: "nao"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Sala de maquinas - ")).toBe(true);
    expect(output.text).not.toContain("IT ");
  });

  it("normaliza local iniciado com G para Galpao", () => {
    const output = prtEngine.generate({
      itemKey: "extintor",
      status: "conforme",
      state: "SP",
      locationName: "G1 Casa de bombas",
      fieldValues: {
        lacrado: "sim",
        conforme_pressao: "sim",
        selo_inmetro: "sim",
        validade_recarga: "2099-12"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Galp\u00e3o 1 Casa de bombas - ")).toBe(true);
  });

  it("gera texto fallback seguro para status especial", () => {
    const output = prtEngine.generate({
      itemKey: "detector_fumaca",
      status: "nao_testado",
      state: "SP",
      locationName: "G2",
      fieldValues: {}
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Galp\u00e3o 2 - ")).toBe(true);
    expect(output.text).toContain("nao foi testado");
  });

  it("marca pendencia tecnica interna quando nao existe template homologado", () => {
    const output = prtEngine.generate({
      itemKey: "item_inexistente",
      status: "conforme",
      state: "SP",
      locationName: "Sala tecnica",
      fieldValues: {}
    });

    expect(output.isTechnicalPending).toBe(true);
    expect(output.text).toBe("");
    expect(output.technicalPendingReason).toBe(MISSING_HOMOLOGATED_TEMPLATE_REASON);
  });
});

