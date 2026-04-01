import { describe, expect, it } from "vitest";
import { normalizeLocationName } from "@/prt-engine/locationNormalizer";

describe("normalizeLocationName", () => {
  it("converte G seguido de numero para Galpao + numero", () => {
    expect(normalizeLocationName("G1")).toBe("Galp\u00e3o 1");
    expect(normalizeLocationName("g 2")).toBe("Galp\u00e3o 2");
  });

  it("preserva sufixo apos o numero do galpao", () => {
    expect(normalizeLocationName("G3 casa de bombas")).toBe(
      "Galp\u00e3o 3 casa de bombas"
    );
  });

  it("converte G sem numero para Galpao com sufixo quando aplicavel", () => {
    expect(normalizeLocationName("g sala tecnica")).toBe("Galp\u00e3o sala tecnica");
    expect(normalizeLocationName("g")).toBe("Galp\u00e3o");
  });

  it("mantem local sem prefixo G, aplicando trim", () => {
    expect(normalizeLocationName("  Sala eletrica  ")).toBe("Sala eletrica");
  });

  it("retorna vazio quando local informado for vazio", () => {
    expect(normalizeLocationName("   ")).toBe("");
  });
});

