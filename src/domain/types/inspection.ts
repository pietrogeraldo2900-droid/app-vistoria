export type InspectionStatus =
  | "conforme"
  | "nao_conforme"
  | "em_manutencao"
  | "sem_acesso"
  | "nao_testado";

export type StateCode = "SP" | "RJ";
export type YesNoValue = "sim" | "nao";
export type InspectionType = "inicial" | "periodica" | "retorno" | "extraordinaria";
export type PhotoSyncStatus = "synced" | "pending" | "failed";

export interface InspectionItemDefinition {
  key: string;
  label: string;
  fields: string[];
}

export interface InspectionFieldValues {
  [fieldName: string]: string;
}

export interface ItemPhoto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  syncStatus: PhotoSyncStatus;
  retryDataAvailable?: boolean;
  syncErrorMessage?: string;
  storageKey?: string;
  dataUrl?: string;
}

export interface InspectionItem {
  id: string;
  itemKey: string;
  status: InspectionStatus;
  fieldValues: InspectionFieldValues;
  generatedText: string;
  photos: ItemPhoto[];
  createdAt: string;
}

export interface InspectionLocation {
  id: string;
  name: string;
  items: InspectionItem[];
}

export interface InspectionRecord {
  id: string;
  title: string;
  companyName: string;
  unitName: string;
  address: string;
  city: string;
  clientName: string;
  contractCode: string;
  inspectionType: InspectionType;
  generalObservation: string;
  inspectorName: string;
  state: StateCode;
  inspectionDate: string;
  createdAt: string;
  updatedAt: string;
  locations: InspectionLocation[];
}

export interface CreateInspectionInput {
  title: string;
  companyName: string;
  unitName: string;
  address: string;
  city: string;
  clientName: string;
  contractCode: string;
  inspectionType: InspectionType;
  generalObservation: string;
  inspectorName: string;
  state: StateCode;
  inspectionDate: string;
}

export interface AddLocationInput {
  name: string;
}

export interface AddItemInput {
  itemKey: string;
  status: InspectionStatus;
  fieldValues: InspectionFieldValues;
  photos: ItemPhoto[];
}

export interface UpdateItemInput {
  itemKey: string;
  status: InspectionStatus;
  fieldValues: InspectionFieldValues;
}

export interface ReportLine {
  locationId: string;
  locationName: string;
  itemId: string;
  itemKey: string;
  status: InspectionStatus;
  text: string;
  isTechnicalPending?: boolean;
  technicalPendingReason?: string;
}
