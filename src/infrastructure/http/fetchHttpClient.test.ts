import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFetchHttpClient } from "@/infrastructure/http/fetchHttpClient";
import { HttpClientResponseError, HttpClientTimeoutError } from "@/infrastructure/http/httpClient";

describe("fetchHttpClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serializa objeto para JSON e define Content-Type quando aplicavel", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = createFetchHttpClient();
    const response = await client.request<{ ok: boolean }>({
      method: "POST",
      url: "https://api.app-vistoria.test/items",
      body: { id: "1" }
    });

    expect(response).toEqual({ ok: true });

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.app-vistoria.test/items");
    expect(requestInit.body).toBe(JSON.stringify({ id: "1" }));

    const headers = new Headers(requestInit.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("nao forca Content-Type ao enviar FormData", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const formData = new FormData();
    formData.append("file", new Blob(["abc"], { type: "text/plain" }), "file.txt");

    const client = createFetchHttpClient();
    await client.request({
      method: "POST",
      url: "https://api.app-vistoria.test/upload",
      body: formData
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);

    expect(requestInit.body).toBe(formData);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("mantem Blob como body sem serializar para JSON", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const fileBlob = new Blob(["binary-data"], { type: "application/octet-stream" });
    const client = createFetchHttpClient();

    await client.request({
      method: "PUT",
      url: "https://api.app-vistoria.test/blob",
      body: fileBlob
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);

    expect(requestInit.body).toBe(fileBlob);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("retorna undefined para resposta vazia", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createFetchHttpClient();
    const output = await client.request<void>({
      method: "DELETE",
      url: "https://api.app-vistoria.test/resource/1"
    });

    expect(output).toBeUndefined();
  });

  it("retorna Blob para resposta binaria em modo automatico", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      })
    );

    const client = createFetchHttpClient();
    const output = await client.request<Blob>({
      method: "GET",
      url: "https://api.app-vistoria.test/file/1"
    });

    expect(output).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await output.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it("lanca HttpClientResponseError para HTTP nao sucesso", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "invalid_request" }), {
        status: 400,
        statusText: "Bad Request",
        headers: { "content-type": "application/json" }
      })
    );

    const client = createFetchHttpClient();

    await expect(
      client.request({
        method: "GET",
        url: "https://api.app-vistoria.test/failure"
      })
    ).rejects.toBeInstanceOf(HttpClientResponseError);
  });

  it("lanca HttpClientTimeoutError quando excede timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        (init?.signal as AbortSignal).addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const client = createFetchHttpClient();
    const requestPromise = client.request({
      method: "GET",
      url: "https://api.app-vistoria.test/slow",
      timeoutMs: 25
    });

    const assertion = expect(requestPromise).rejects.toBeInstanceOf(HttpClientTimeoutError);
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
  });
});
