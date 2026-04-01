import type { InspectionRecord, ItemPhoto } from "@/domain/types/inspection";
import { backendGateway } from "@/infrastructure/http/backendGateway";
import { HttpClientResponseError } from "@/infrastructure/http/httpClient";
import type { InspectionRepositoryContract } from "@/persistence/contracts/inspectionRepositoryContract";

interface ApiInspectionPhoto {
  id?: string;
  name?: string;
  mime_type?: string;
  size?: number;
  storage_key?: string;
  sync_status?: "synced" | "pending" | "failed";
  sync_error_message?: string;
}

interface ApiInspectionItem {
  id?: string;
  item_key?: string;
  status?: string;
  field_values?: Record<string, string>;
  generated_text?: string;
  photos?: ApiInspectionPhoto[];
  created_at?: string;
}

interface ApiInspectionLocation {
  id?: string;
  name?: string;
  items?: ApiInspectionItem[];
}

interface ApiInspectionRecord {
  id?: string;
  title?: string;
  company_name?: string;
  unit_name?: string;
  address?: string;
  city?: string;
  client_name?: string;
  contract_code?: string;
  inspection_type?: string;
  general_observation?: string;
  inspector_name?: string;
  state?: string;
  inspection_date?: string;
  created_at?: string;
  updated_at?: string;
  locations?: ApiInspectionLocation[];
}

interface ApiInspectionListResponse {
  items?: ApiInspectionRecord[];
}

const INSPECTION_ENDPOINTS = {
  list: { method: "GET", path: "/inspections" },
  getById: { method: "GET", path: "/inspections/{id}" },
  create: { method: "POST", path: "/inspections" },
  update: { method: "PUT", path: "/inspections/{id}" }
} as const;

const resolveState = (value: string | undefined): InspectionRecord["state"] => {
  return value === "RJ" ? "RJ" : "SP";
};

const resolveInspectionType = (value: string | undefined): InspectionRecord["inspectionType"] => {
  if (
    value === "inicial" ||
    value === "periodica" ||
    value === "retorno" ||
    value === "extraordinaria"
  ) {
    return value;
  }
  return "periodica";
};

const resolveItemStatus = (value: string | undefined): InspectionRecord["locations"][number]["items"][number]["status"] => {
  if (
    value === "conforme" ||
    value === "nao_conforme" ||
    value === "em_manutencao" ||
    value === "sem_acesso" ||
    value === "nao_testado"
  ) {
    return value;
  }
  return "nao_testado";
};

const mapApiPhotoToDomain = (photo: ApiInspectionPhoto): ItemPhoto => {
  const syncStatus = photo.sync_status ?? (photo.storage_key ? "synced" : "failed");
  return {
    id: photo.id ?? "",
    name: photo.name ?? "",
    mimeType: photo.mime_type ?? "application/octet-stream",
    size: typeof photo.size === "number" ? photo.size : 0,
    storageKey: photo.storage_key,
    syncStatus,
    syncErrorMessage: photo.sync_error_message
  };
};

const mapApiInspectionToDomain = (api: ApiInspectionRecord): InspectionRecord => {
  const locations = Array.isArray(api.locations) ? api.locations : [];

  return {
    id: api.id ?? "",
    title: api.title ?? "",
    companyName: api.company_name ?? "",
    unitName: api.unit_name ?? "",
    address: api.address ?? "",
    city: api.city ?? "",
    clientName: api.client_name ?? "",
    contractCode: api.contract_code ?? "",
    inspectionType: resolveInspectionType(api.inspection_type),
    generalObservation: api.general_observation ?? "",
    inspectorName: api.inspector_name ?? "",
    state: resolveState(api.state),
    inspectionDate: api.inspection_date ?? new Date().toISOString().slice(0, 10),
    createdAt: api.created_at ?? new Date().toISOString(),
    updatedAt: api.updated_at ?? new Date().toISOString(),
    locations: locations.map((location) => ({
      id: location.id ?? "",
      name: location.name ?? "",
      items: (Array.isArray(location.items) ? location.items : []).map((item) => ({
        id: item.id ?? "",
        itemKey: item.item_key ?? "",
        status: resolveItemStatus(item.status),
        fieldValues: item.field_values ?? {},
        generatedText: item.generated_text ?? "",
        photos: (Array.isArray(item.photos) ? item.photos : []).map(mapApiPhotoToDomain),
        createdAt: item.created_at ?? new Date().toISOString()
      }))
    }))
  };
};

const mapDomainPhotoToApi = (photo: ItemPhoto): ApiInspectionPhoto => ({
  id: photo.id,
  name: photo.name,
  mime_type: photo.mimeType,
  size: photo.size,
  storage_key: photo.storageKey,
  sync_status: photo.syncStatus,
  sync_error_message: photo.syncErrorMessage
});

const mapDomainInspectionToApi = (record: InspectionRecord): ApiInspectionRecord => {
  return {
    id: record.id,
    title: record.title,
    company_name: record.companyName,
    unit_name: record.unitName,
    address: record.address,
    city: record.city,
    client_name: record.clientName,
    contract_code: record.contractCode,
    inspection_type: record.inspectionType,
    general_observation: record.generalObservation,
    inspector_name: record.inspectorName,
    state: record.state,
    inspection_date: record.inspectionDate,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    locations: record.locations.map((location) => ({
      id: location.id,
      name: location.name,
      items: location.items.map((item) => ({
        id: item.id,
        item_key: item.itemKey,
        status: item.status,
        field_values: item.fieldValues,
        generated_text: item.generatedText,
        photos: item.photos.map(mapDomainPhotoToApi),
        created_at: item.createdAt
      }))
    }))
  };
};

export const remoteInspectionRepository: InspectionRepositoryContract = {
  async list() {
    const response = await backendGateway.request<ApiInspectionListResponse>(
      "inspection.list",
      INSPECTION_ENDPOINTS.list,
      { responseType: "json" }
    );

    const items = Array.isArray(response?.items) ? response.items : [];
    return items
      .map(mapApiInspectionToDomain)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async getById(inspectionId: string) {
    const path = INSPECTION_ENDPOINTS.getById.path.replace(
      "{id}",
      encodeURIComponent(inspectionId)
    );

    try {
      const response = await backendGateway.request<ApiInspectionRecord>(
        "inspection.getById",
        {
          method: INSPECTION_ENDPOINTS.getById.method,
          path
        },
        { responseType: "json" }
      );
      if (!response) {
        return undefined;
      }
      return mapApiInspectionToDomain(response);
    } catch (error) {
      if (error instanceof HttpClientResponseError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  },

  async upsert(record: InspectionRecord) {
    const payload = mapDomainInspectionToApi(record);
    const updatePath = INSPECTION_ENDPOINTS.update.path.replace(
      "{id}",
      encodeURIComponent(record.id)
    );

    try {
      const updated = await backendGateway.request<ApiInspectionRecord | undefined>(
        "inspection.upsert",
        {
          method: INSPECTION_ENDPOINTS.update.method,
          path: updatePath
        },
        {
          body: payload,
          responseType: "json"
        }
      );

      if (!updated) {
        return record;
      }
      return mapApiInspectionToDomain(updated);
    } catch (error) {
      if (!(error instanceof HttpClientResponseError) || error.status !== 404) {
        throw error;
      }

      const created = await backendGateway.request<ApiInspectionRecord | undefined>(
        "inspection.create",
        INSPECTION_ENDPOINTS.create,
        {
          body: payload,
          responseType: "json"
        }
      );

      if (!created) {
        return record;
      }
      return mapApiInspectionToDomain(created);
    }
  }
};
