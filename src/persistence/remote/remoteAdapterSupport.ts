import { backendGateway } from "@/infrastructure/http/backendGateway";
import type { HttpMethod } from "@/infrastructure/http/httpClient";

interface AdapterOperation {
  adapter: string;
  operation: string;
  endpoint: {
    method: HttpMethod;
    path: string;
  };
}

const buildMessage = (input: AdapterOperation): string => {
  const endpoint = backendGateway.describeEndpoint(input.endpoint);
  return [
    `Adapter remoto ${input.adapter} ainda nao conectado a API real.`,
    `Operacao: ${input.operation}.`,
    `Endpoint planejado: ${endpoint}.`,
    "Mantenha modo local no MVP ate finalizar integracao server-side."
  ].join(" ");
};

export const failRemoteAdapterOperation = (input: AdapterOperation): never => {
  backendGateway.assertConfigured(`${input.adapter}.${input.operation}`);
  throw new Error(buildMessage(input));
};

