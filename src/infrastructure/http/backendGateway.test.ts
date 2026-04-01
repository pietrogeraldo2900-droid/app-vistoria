import { describe, expect, it, vi } from "vitest";
import { BackendGateway } from "@/infrastructure/http/backendGateway";
import { BackendGatewayUnavailableError, type BackendGatewayConfig, type HttpClient } from "@/infrastructure/http/httpClient";

const createGateway = (config: BackendGatewayConfig) => {
  const request = vi.fn();
  const httpClient: HttpClient = { request: request as HttpClient["request"] };
  const gateway = new BackendGateway(httpClient, () => config);
  return { gateway, request };
};

describe("backendGateway", () => {
  it("falha com erro controlado quando gateway nao esta configurado", async () => {
    const { gateway, request } = createGateway({
      baseUrl: "",
      timeoutMs: 15000
    });

    await expect(
      gateway.request("inspection.list", {
        method: "GET",
        path: "/inspections"
      })
    ).rejects.toBeInstanceOf(BackendGatewayUnavailableError);

    expect(request).not.toHaveBeenCalled();
  });

  it("normaliza URL e delega request para o HttpClient", async () => {
    const { gateway, request } = createGateway({
      baseUrl: "https://api.app-vistoria.test/",
      timeoutMs: 15000
    });

    request.mockResolvedValueOnce({ ok: true });

    await gateway.request(
      "auth.login",
      {
        method: "POST",
        path: "/auth/login"
      },
      {
        body: { email: "user@test.com" },
        headers: { Authorization: "Bearer token" },
        query: { include: "profile" },
        responseType: "json",
        timeoutMs: 5000
      }
    );

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      url: "https://api.app-vistoria.test/auth/login",
      body: { email: "user@test.com" },
      headers: { Authorization: "Bearer token" },
      query: { include: "profile" },
      responseType: "json",
      timeoutMs: 5000,
      signal: undefined
    });
  });

  it("usa timeout padrao de configuracao quando nao informado por request", async () => {
    const { gateway, request } = createGateway({
      baseUrl: "https://api.app-vistoria.test",
      timeoutMs: 7000
    });
    request.mockResolvedValueOnce({});

    await gateway.request("inspection.list", {
      method: "GET",
      path: "/inspections"
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "https://api.app-vistoria.test/inspections",
        timeoutMs: 7000
      })
    );
  });
});
