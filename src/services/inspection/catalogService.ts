import inspectionItemsData from "@data/inspection_items.json";
import type {
  InspectionItemDefinition,
  InspectionStatus
} from "@/domain/types/inspection";

interface InspectionItemsJson {
  statuses: InspectionStatus[];
  items: InspectionItemDefinition[];
}

const inspectionCatalog = inspectionItemsData as InspectionItemsJson;

export const catalogService = {
  getStatuses(): InspectionStatus[] {
    return inspectionCatalog.statuses;
  },

  getItems(): InspectionItemDefinition[] {
    return inspectionCatalog.items;
  },

  getItemByKey(itemKey: string): InspectionItemDefinition | undefined {
    return inspectionCatalog.items.find((item) => item.key === itemKey);
  }
};
