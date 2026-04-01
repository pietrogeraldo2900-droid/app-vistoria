import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRepository } from "@/persistence/authRepository";
import { inspectionRepository } from "@/persistence/inspectionRepository";
import { photoRepository } from "@/persistence/photoRepository";
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

describe("repository wrappers", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createMemoryStorage()
      },
      configurable: true
    });
    repositoryMode.reset();
    repositoryMode.set("local", { persist: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa comportamento local por padrao", async () => {
    expect(authRepository.listUsers()).toEqual([]);
    await expect(inspectionRepository.list()).resolves.toEqual([]);
  });

  it("alterna dinamicamente para remoto e volta para local", async () => {
    repositoryMode.set("remote", { persist: false });

    expect(() => authRepository.listUsers()).toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
    await expect(inspectionRepository.list()).rejects.toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );

    repositoryMode.set("local", { persist: false });
    expect(authRepository.listUsers()).toEqual([]);
    await expect(inspectionRepository.list()).resolves.toEqual([]);
  });

  it("mantem contrato async para foto no modo remoto", async () => {
    repositoryMode.set("remote", { persist: false });

    await expect(photoRepository.remove("photo_1")).rejects.toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
  });

  it("mantem erro controlado para login remoto sem gateway configurado", async () => {
    repositoryMode.set("remote", { persist: false });

    await expect(
      authRepository.loginRemote({
        email: "inspetor@empresa.com.br",
        password: "Senha@123"
      })
    ).rejects.toThrow(
      "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
    );
  });
});
