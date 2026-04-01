import {
  HttpClientParseError,
  HttpClientResponseError,
  HttpClientTimeoutError,
  type HttpClient,
  type HttpRequestConfig,
  type HttpResponseType
} from "@/infrastructure/http/httpClient";

const DEFAULT_TIMEOUT_MS = 15000;

const buildUrlWithQuery = (
  url: string,
  query?: Record<string, string | number | boolean | undefined>
): string => {
  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  if (!queryString) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
};

const normalizeHeaders = (headers?: Record<string, string>): Headers => new Headers(headers);

const isArrayBufferView = (value: unknown): value is ArrayBufferView => ArrayBuffer.isView(value);

const isReadableStream = (value: unknown): value is ReadableStream => {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
};

const isFormData = (value: unknown): value is FormData => {
  return typeof FormData !== "undefined" && value instanceof FormData;
};

const isBlob = (value: unknown): value is Blob => {
  return typeof Blob !== "undefined" && value instanceof Blob;
};

const isUrlSearchParams = (value: unknown): value is URLSearchParams => {
  return typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams;
};

const isBodyInit = (value: unknown): value is BodyInit => {
  if (typeof value === "string") {
    return true;
  }

  if (isBlob(value) || isFormData(value) || isUrlSearchParams(value)) {
    return true;
  }

  if (value instanceof ArrayBuffer || isArrayBufferView(value) || isReadableStream(value)) {
    return true;
  }

  return false;
};

const shouldSerializeAsJson = (value: unknown): boolean => {
  if (value === null) {
    return true;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "object") {
    return !isBodyInit(value);
  }

  return false;
};

const serializeRequestBody = (body: unknown, headers: Headers): BodyInit | undefined => {
  if (body === undefined) {
    return undefined;
  }

  if (shouldSerializeAsJson(body)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return JSON.stringify(body);
  }

  if (isBodyInit(body)) {
    return body;
  }

  throw new Error("Tipo de body nao suportado para requisicao HTTP.");
};

const parseJson = async <T>(response: Response, config: HttpRequestConfig): Promise<T> => {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new HttpClientParseError({
      method: config.method,
      url: config.url,
      responseType: "json",
      rawText
    });
  }
};

const parseErrorBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  return rawBody;
};

const resolveResponseType = (response: Response, preferredType: HttpResponseType | undefined): HttpResponseType => {
  if (preferredType && preferredType !== "auto") {
    return preferredType;
  }

  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return "void";
  }

  if (response.headers.get("content-length") === "0") {
    return "void";
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return "json";
  }

  if (contentType.startsWith("text/") || contentType.includes("xml") || contentType.includes("csv")) {
    return "text";
  }

  return "blob";
};

const createAbortController = (
  timeoutMs: number,
  externalSignal?: AbortSignal
): {
  controller: AbortController;
  wasTimeout: () => boolean;
  clear: () => void;
} => {
  const controller = new AbortController();
  let timeoutTriggered = false;

  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    controller,
    wasTimeout: () => timeoutTriggered,
    clear: () => {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  };
};

export const createFetchHttpClient = (): HttpClient => ({
  async request<T>(config: HttpRequestConfig): Promise<T> {
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const headers = normalizeHeaders(config.headers);
    const body = serializeRequestBody(config.body, headers);
    const url = buildUrlWithQuery(config.url, config.query);
    const abort = createAbortController(timeoutMs, config.signal);

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body,
        signal: abort.controller.signal
      });

      if (!response.ok) {
        const responseBody = await parseErrorBody(response);
        throw new HttpClientResponseError({
          method: config.method,
          url: config.url,
          status: response.status,
          statusText: response.statusText,
          responseBody
        });
      }

      const responseType = resolveResponseType(response, config.responseType);
      if (responseType === "void") {
        return undefined as T;
      }

      if (responseType === "json") {
        return parseJson<T>(response, config);
      }

      if (responseType === "text") {
        return (await response.text()) as T;
      }

      if (responseType === "arrayBuffer") {
        return (await response.arrayBuffer()) as T;
      }

      return (await response.blob()) as T;
    } catch (error) {
      if (abort.wasTimeout()) {
        throw new HttpClientTimeoutError({
          method: config.method,
          url: config.url,
          timeoutMs
        });
      }
      throw error;
    } finally {
      abort.clear();
    }
  }
});
