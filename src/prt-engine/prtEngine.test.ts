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

  it("prioriza template de validade vigente para extintor conforme", () => {
    const output = prtEngine.generate({
      itemKey: "extintor",
      status: "conforme",
      state: "SP",
      locationName: "G1",
      fieldValues: {
        validade_recarga: "2099-12"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Galp")).toBe(true);
    expect(output.text).toContain("validade");
    expect(output.text).toContain("12/2099");
  });

  it("prioriza sem_lacre sobre validade_vencida em extintor nao conforme", () => {
    const output = prtEngine.generate({
      itemKey: "extintor",
      status: "nao_conforme",
      state: "SP",
      locationName: "Casa de bombas",
      fieldValues: {
        lacrado: "nao",
        validade_recarga: "01/2025"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toContain("Todos os extintores devem estar lacrados");
    expect(output.text).not.toContain("indicação VENCIDA");
  });

  it("usa template de validade vencida para extintor nao conforme quando aplicavel", () => {
    const output = prtEngine.generate({
      itemKey: "extintor",
      status: "nao_conforme",
      state: "RJ",
      locationName: "Sala tecnica",
      fieldValues: {
        lacrado: "sim",
        validade_recarga: "01/2025"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toBe(
      "Sala tecnica - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação VENCIDA em 01/2025."
    );
  });

  it("usa regra de mangueira no hidrante conforme quando houver [mes/ano]", () => {
    const output = prtEngine.generate({
      itemKey: "hidrante",
      status: "conforme",
      state: "SP",
      locationName: "G2",
      fieldValues: {
        mangueira_teste_hidrostatico_validade: "2099-12"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text.startsWith("Galp")).toBe(true);
    expect(output.text).toContain("VÁLIDO");
    expect(output.text).toContain("12/2099");
  });

  it("usa regra de mangueira vencida no hidrante nao conforme quando validade ja expirou", () => {
    const output = prtEngine.generate({
      itemKey: "hidrante",
      status: "nao_conforme",
      state: "SP",
      locationName: "Shaft de incendio",
      fieldValues: {
        possui_esguicho: "sim",
        possui_chave_storz: "sim",
        possui_registro: "sim",
        sinalizacao_instalada: "sim",
        abrigo_incompleto: "nao",
        mangueira_teste_hidrostatico_validade: "2026-01"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toContain("VENCIDO");
    expect(output.text).toContain("01/2026");
    expect(output.text).toContain("IT 22/2025");
  });

  it("usa regra SPK + detector de fumaca no nao conforme", () => {
    const output = prtEngine.generate({
      itemKey: "spk",
      status: "nao_conforme",
      state: "SP",
      locationName: "Galpao 3",
      fieldValues: {}
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toContain("chuveiros automáticos (SPK)");
    expect(output.text).toContain("instalação de detector de fumaça");
    expect(output.text).toContain("IT 23/2025");
    expect(output.text).toContain("IT 19/2025");
  });

  it("usa texto homologado completo de sinalizacao generica", () => {
    const output = prtEngine.generate({
      itemKey: "sinalizacao",
      status: "nao_conforme",
      state: "SP",
      locationName: "Corredor 1",
      fieldValues: {}
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toContain("nome/CNPJ do fabricante");
    expect(output.text).toContain("IT 20/2025");
  });

  it("usa regra de sinalizacao do extintor de po quando campo explicito for sim", () => {
    const output = prtEngine.generate({
      itemKey: "sinalizacao",
      status: "nao_conforme",
      state: "SP",
      locationName: "Hall",
      fieldValues: {
        instalada: "nao",
        tipo_fotoluminescente: "nao",
        sinalizacao_extintor_po: "sim"
      }
    });

    expect(output.isTechnicalPending).toBe(false);
    expect(output.text).toContain("sinalização do extintor de pó");
    expect(output.text).toContain("IT 20/2025");
  });
});
