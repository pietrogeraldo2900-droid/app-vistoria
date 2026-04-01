import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repositoryMode } from "@/persistence/repositoryMode";

const createMemoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    }
  };
};

describe("repositoryMode", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createMemoryStorage()
      },
      configurable: true
    });
    repositoryMode.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("inicia em modo local por padrao", () => {
    expect(repositoryMode.get()).toBe("local");
  });

  it("permite alternar para remoto sem persistir", () => {
    repositoryMode.set("remote", { persist: false });
    expect(repositoryMode.get()).toBe("remote");
    expect(window.localStorage.getItem("app-vistoria::repository-mode")).toBeNull();
  });

  it("persiste modo quando solicitado", () => {
    repositoryMode.set("remote");
    expect(repositoryMode.get()).toBe("remote");
    expect(window.localStorage.getItem("app-vistoria::repository-mode")).toBe("remote");
  });

  it("normaliza configuracao invalida para local", () => {
    const mode = repositoryMode.configure("qualquer-coisa", { persist: false });
    expect(mode).toBe("local");
    expect(repositoryMode.get()).toBe("local");
  });

  it("lista modos disponiveis", () => {
    expect(repositoryMode.getAvailableModes()).toEqual(["local", "remote"]);
  });

  it("permite override por dominio sem alterar modo global", () => {
    repositoryMode.set("remote", { persist: false });
    repositoryMode.setFor("auth", "local", { persist: false });

    expect(repositoryMode.get()).toBe("remote");
    expect(repositoryMode.getFor("auth")).toBe("local");
    expect(repositoryMode.getFor("inspection")).toBe("remote");

    repositoryMode.clearFor("auth", { persist: false });
    expect(repositoryMode.getFor("auth")).toBe("remote");
  });

  it("usa variavel de ambiente quando storage nao possui modo", async () => {
    vi.stubEnv("VITE_REPOSITORY_MODE", "remote");
    vi.resetModules();
    const loaded = await import("@/persistence/repositoryMode");
    expect(loaded.repositoryMode.get()).toBe("remote");
  });

  it("prioriza storage quando storage e env existem", async () => {
    vi.stubEnv("VITE_REPOSITORY_MODE", "local");
    window.localStorage.setItem("app-vistoria::repository-mode", "remote");

    vi.resetModules();
    const loaded = await import("@/persistence/repositoryMode");
    expect(loaded.repositoryMode.get()).toBe("remote");
  });

  it("permite override por variavel de ambiente por dominio", async () => {
    vi.stubEnv("VITE_REPOSITORY_MODE", "local");
    vi.stubEnv("VITE_REPOSITORY_MODE_AUTH", "local");
    vi.stubEnv("VITE_REPOSITORY_MODE_INSPECTION", "remote");
    vi.resetModules();

    const loaded = await import("@/persistence/repositoryMode");
    expect(loaded.repositoryMode.getFor("inspection")).toBe("remote");
    expect(loaded.repositoryMode.getFor("auth")).toBe("local");
  });
});
