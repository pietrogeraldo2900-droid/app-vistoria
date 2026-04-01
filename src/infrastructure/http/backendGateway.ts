import {
  BackendGatewayUnavailableError,
  type BackendGatewayConfig,
  type HttpClient,
  type HttpMethod,
  type HttpResponseType
} from "@/infrastructure/http/httpClient";
import { createFetchHttpClient } from "@/infrastructure/http/fetchHttpClient";

const DEFAULT_TIMEOUT_MS = 15000;

const parseTimeout = (raw: string | undefined): number => {
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return parsed;
};

const readEnvValue = (key: string): string | undefined => {
  const processEnv =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : undefined;
  const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return processEnv?.[key] ?? importMetaEnv?.[key];
};

const readEnvConfig = (): BackendGatewayConfig => {
  return {
    baseUrl: readEnvValue("VITE_API_BASE_URL"),
    timeoutMs: parseTimeout(readEnvValue("VITE_API_TIMEOUT_MS"))
  };
};

interface PlannedEndpoint {
  method: HttpMethod;
  path: string;
}

interface GatewayRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  responseType?: HttpResponseType;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const joinUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim();
  if (!trimmedBase) {
    return path;
  }

  if (trimmedBase.endsWith("/") && path.startsWith("/")) {
    return `${trimmedBase.slice(0, -1)}${path}`;
  }

  if (!trimmedBase.endsWith("/") && !path.startsWith("/")) {
    return `${trimmedBase}/${path}`;
  }

  return `${trimmedBase}${path}`;
};

export class BackendGateway {
  private readonly httpClient: HttpClient;

  private readonly configProvider: () => BackendGatewayConfig;

  constructor(httpClient: HttpClient, configProvider: () => BackendGatewayConfig) {
    this.httpClient = httpClient;
    this.configProvider = configProvider;
  }

  getConfig(): BackendGatewayConfig {
    return this.configProvider();
  }

  assertConfigured(scope: string): void {
    const config = this.getConfig();
    if (!config.baseUrl || !config.baseUrl.trim()) {
      throw new BackendGatewayUnavailableError(
        scope,
        "Gateway remoto nao configurado. Defina VITE_API_BASE_URL para ativar adapters remotos."
      );
    }
  }

  describeEndpoint(endpoint: PlannedEndpoint): string {
    return `${endpoint.method} ${endpoint.path}`;
  }

  async request<T>(scope: string, endpoint: PlannedEndpoint, options?: GatewayRequestOptions): Promise<T> {
    this.assertConfigured(scope);
    const config = this.getConfig();
    const url = joinUrl(config.baseUrl!, endpoint.path);
    return this.httpClient.request<T>({
      method: endpoint.method,
      url,
      body: options?.body,
      headers: options?.headers,
      query: options?.query,
      responseType: options?.responseType,
      signal: options?.signal,
      timeoutMs: options?.timeoutMs ?? config.timeoutMs
    });
  }
}

export const backendGateway = new BackendGateway(
  createFetchHttpClient(),
  readEnvConfig
);
