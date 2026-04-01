export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpResponseType = "auto" | "json" | "text" | "blob" | "arrayBuffer" | "void";

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  responseType?: HttpResponseType;
  signal?: AbortSignal;
}

export interface HttpClient {
  request<T>(config: HttpRequestConfig): Promise<T>;
}

export interface BackendGatewayConfig {
  baseUrl?: string;
  timeoutMs: number;
}

export class BackendGatewayUnavailableError extends Error {
  readonly scope: string;

  constructor(scope: string, message: string) {
    super(message);
    this.name = "BackendGatewayUnavailableError";
    this.scope = scope;
  }
}

export class HttpClientResponseError extends Error {
  readonly method: HttpMethod;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: unknown;

  constructor(input: {
    method: HttpMethod;
    url: string;
    status: number;
    statusText: string;
    responseBody: unknown;
  }) {
    super(`HTTP ${input.status} em ${input.method} ${input.url}`);
    this.name = "HttpClientResponseError";
    this.method = input.method;
    this.url = input.url;
    this.status = input.status;
    this.statusText = input.statusText;
    this.responseBody = input.responseBody;
  }
}

export class HttpClientTimeoutError extends Error {
  readonly method: HttpMethod;
  readonly url: string;
  readonly timeoutMs: number;

  constructor(input: { method: HttpMethod; url: string; timeoutMs: number }) {
    super(`Timeout apos ${input.timeoutMs}ms em ${input.method} ${input.url}`);
    this.name = "HttpClientTimeoutError";
    this.method = input.method;
    this.url = input.url;
    this.timeoutMs = input.timeoutMs;
  }
}

export class HttpClientParseError extends Error {
  readonly method: HttpMethod;
  readonly url: string;
  readonly responseType: Exclude<HttpResponseType, "auto">;
  readonly rawText: string;

  constructor(input: {
    method: HttpMethod;
    url: string;
    responseType: Exclude<HttpResponseType, "auto">;
    rawText: string;
  }) {
    super(`Falha ao interpretar resposta ${input.responseType} em ${input.method} ${input.url}`);
    this.name = "HttpClientParseError";
    this.method = input.method;
    this.url = input.url;
    this.responseType = input.responseType;
    this.rawText = input.rawText;
  }
}
