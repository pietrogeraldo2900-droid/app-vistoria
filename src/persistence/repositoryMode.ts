export type RepositoryMode = "local" | "remote";
export type RepositoryDomain = "auth" | "inspection" | "photo";

interface SetModeOptions {
  persist?: boolean;
}

const STORAGE_KEY = "app-vistoria::repository-mode";
const DOMAIN_STORAGE_KEYS: Record<RepositoryDomain, string> = {
  auth: "app-vistoria::repository-mode::auth",
  inspection: "app-vistoria::repository-mode::inspection",
  photo: "app-vistoria::repository-mode::photo"
};
const AVAILABLE_MODES: RepositoryMode[] = ["local", "remote"];
const AVAILABLE_DOMAINS: RepositoryDomain[] = ["auth", "inspection", "photo"];

const normalizeMode = (value: unknown): RepositoryMode => {
  if (value === "remote") {
    return "remote";
  }
  return "local";
};

const getWindowStorage = (): Storage | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

const readModeFromStorageKey = (storageKey: string): RepositoryMode | null => {
  const storage = getWindowStorage();
  if (!storage) {
    return null;
  }
  const storedMode = storage.getItem(storageKey);
  if (storedMode === null) {
    return null;
  }
  return normalizeMode(storedMode);
};

const readModeFromEnvVar = (envKey: string): RepositoryMode | null => {
  const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const processEnv =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : undefined;
  const mode = processEnv?.[envKey] ?? importMetaEnv?.[envKey];
  if (!mode) {
    return null;
  }
  return normalizeMode(mode);
};

const resolveInitialMode = (): RepositoryMode => {
  return readModeFromStorageKey(STORAGE_KEY) ?? readModeFromEnvVar("VITE_REPOSITORY_MODE") ?? "local";
};

const resolveInitialDomainOverrides = (): Partial<Record<RepositoryDomain, RepositoryMode>> => {
  const overrides: Partial<Record<RepositoryDomain, RepositoryMode>> = {};

  for (const domain of AVAILABLE_DOMAINS) {
    const fromStorage = readModeFromStorageKey(DOMAIN_STORAGE_KEYS[domain]);
    if (fromStorage) {
      overrides[domain] = fromStorage;
      continue;
    }

    const fromEnv = readModeFromEnvVar(`VITE_REPOSITORY_MODE_${domain.toUpperCase()}`);
    if (fromEnv) {
      overrides[domain] = fromEnv;
    }
  }

  return overrides;
};

let configuredRepositoryMode: RepositoryMode = resolveInitialMode();
let configuredDomainOverrides: Partial<Record<RepositoryDomain, RepositoryMode>> =
  resolveInitialDomainOverrides();

export const repositoryMode = {
  get(): RepositoryMode {
    return configuredRepositoryMode;
  },

  getFor(domain: RepositoryDomain): RepositoryMode {
    return configuredDomainOverrides[domain] ?? configuredRepositoryMode;
  },

  getAvailableModes(): RepositoryMode[] {
    return [...AVAILABLE_MODES];
  },

  set(mode: RepositoryMode, options?: SetModeOptions): void {
    configuredRepositoryMode = mode;

    if (options?.persist === false) {
      return;
    }

    const storage = getWindowStorage();
    if (!storage) {
      return;
    }
    storage.setItem(STORAGE_KEY, mode);
  },

  setFor(domain: RepositoryDomain, mode: RepositoryMode, options?: SetModeOptions): void {
    configuredDomainOverrides[domain] = mode;

    if (options?.persist === false) {
      return;
    }

    const storage = getWindowStorage();
    if (!storage) {
      return;
    }

    storage.setItem(DOMAIN_STORAGE_KEYS[domain], mode);
  },

  clearFor(domain: RepositoryDomain, options?: SetModeOptions): void {
    delete configuredDomainOverrides[domain];

    if (options?.persist === false) {
      return;
    }

    const storage = getWindowStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(DOMAIN_STORAGE_KEYS[domain]);
  },

  configure(value: unknown, options?: SetModeOptions): RepositoryMode {
    const nextMode = normalizeMode(value);
    this.set(nextMode, options);
    return nextMode;
  },

  reset(): void {
    configuredRepositoryMode = "local";
    configuredDomainOverrides = {};
  }
};
