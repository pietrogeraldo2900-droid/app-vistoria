import type {
  AddItemInput,
  CreateInspectionInput,
  InspectionFieldValues,
  InspectionStatus,
  StateCode
} from "@/domain/types/inspection";
import { createId } from "@/domain/utils/id";
import { photoRepository } from "@/persistence/photoRepository";
import { repositoryMode } from "@/persistence/repositoryMode";
import { STORAGE_KEYS } from "@/persistence/storageKeys";
import { inspectionService } from "@/services/inspection/inspectionService";

interface DemoPhotoSpec {
  name: string;
  tone: string;
}

interface DemoItemSpec {
  itemKey: string;
  status: InspectionStatus;
  fieldValues: InspectionFieldValues;
  photos: DemoPhotoSpec[];
}

interface DemoLocationSpec {
  name: string;
  items: DemoItemSpec[];
}

interface DemoInspectionSpec {
  inspection: CreateInspectionInput;
  locations: DemoLocationSpec[];
}

interface DemoSetupSummary {
  inspectionsCreated: number;
  locationsCreated: number;
  itemsCreated: number;
  photosCreated: number;
}

interface DemoAvailability {
  available: boolean;
  reason?: string;
}

const MEDIA_DB_NAME = "app-vistoria-media";
const RETRY_DB_NAME = "app-vistoria-photo-retry";
const FALLBACK_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2sQx0AAAAASUVORK5CYII=";

const normalizeFileName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const shiftMonth = (current: Date, monthOffset: number): Date =>
  new Date(current.getFullYear(), current.getMonth() + monthOffset, 1);

const toYearMonth = (value: Date): string => {
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${value.getFullYear()}-${month}`;
};

const createDemoInspectionSpecs = (): DemoInspectionSpec[] => {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const nextMonth = toYearMonth(shiftMonth(now, 1));
  const twoMonths = toYearMonth(shiftMonth(now, 2));

  return [
    {
      inspection: {
        title: "Vistoria mensal - Galpao Norte",
        companyName: "Logistica Atlas",
        unitName: "Unidade Norte",
        address: "Av. Industrial, 1200",
        city: "Sao Paulo",
        clientName: "Atlas Facilities",
        contractCode: "CTR-2026-041",
        inspectionType: "periodica",
        generalObservation:
          "Amostra de vistoria para apresentacao comercial com foco em operacao e PRT.",
        inspectorName: "Equipe Tecnica Demo",
        state: "SP",
        inspectionDate: todayIso
      },
      locations: [
        {
          name: "G1",
          items: [
            {
              itemKey: "extintor",
              status: "conforme",
              fieldValues: {
                lacrado: "sim",
                conforme_pressao: "sim",
                selo_inmetro: "sim",
                validade_recarga: twoMonths
              },
              photos: [
                { name: "Extintor G1 - frente", tone: "#0f766e" },
                { name: "Extintor G1 - selo", tone: "#0c4a6e" }
              ]
            }
          ]
        },
        {
          name: "Sala eletrica",
          items: [
            {
              itemKey: "detector_fumaca",
              status: "nao_conforme",
              fieldValues: {
                instalado: "nao"
              },
              photos: [{ name: "Detector nao instalado", tone: "#b45309" }]
            }
          ]
        }
      ]
    },
    {
      inspection: {
        title: "Vistoria retorno - Unidade Leste",
        companyName: "Complexo Empresarial Orion",
        unitName: "Unidade Leste",
        address: "Rua das Oficinas, 455",
        city: "Rio de Janeiro",
        clientName: "Orion Gestao Predial",
        contractCode: "CTR-2026-057",
        inspectionType: "retorno",
        generalObservation: "Retorno tecnico para validar adequacoes prioritarias.",
        inspectorName: "Equipe Tecnica Demo",
        state: "RJ",
        inspectionDate: todayIso
      },
      locations: [
        {
          name: "G2",
          items: [
            {
              itemKey: "sinalizacao",
              status: "nao_conforme",
              fieldValues: {
                instalada: "nao",
                tipo_fotoluminescente: "sim"
              },
              photos: [{ name: "Ausencia de sinalizacao", tone: "#9a3412" }]
            }
          ]
        },
        {
          name: "Casa de bombas",
          items: [
            {
              itemKey: "shaft_incendio",
              status: "nao_conforme",
              fieldValues: {
                obstruido: "sim"
              },
              photos: [{ name: "Shaft obstruido", tone: "#7f1d1d" }]
            }
          ]
        }
      ]
    },
    {
      inspection: {
        title: "Vistoria inicial - Centro de Distribuicao Sul",
        companyName: "Rede Mercantil Nova Era",
        unitName: "CD Sul",
        address: "Rodovia BR-116, km 210",
        city: "Sao Paulo",
        clientName: "Nova Era Operacoes",
        contractCode: "CTR-2026-073",
        inspectionType: "inicial",
        generalObservation:
          "Levantamento inicial de seguranca para consolidacao de plano de regularizacao.",
        inspectorName: "Equipe Tecnica Demo",
        state: "SP",
        inspectionDate: todayIso
      },
      locations: [
        {
          name: "Doca principal",
          items: [
            {
              itemKey: "hidrante",
              status: "conforme",
              fieldValues: {
                possui_esguicho: "sim",
                possui_chave_storz: "sim",
                possui_registro: "sim",
                sinalizacao_instalada: "sim",
                mangueira_teste_hidrostatico_validade: nextMonth
              },
              photos: [{ name: "Hidrante em conformidade", tone: "#1d4ed8" }]
            }
          ]
        }
      ]
    }
  ];
};

const deleteIndexedDb = async (dbName: string): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
};

const clearDemoWorkspace = async (): Promise<void> => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEYS.inspections);
  }

  await deleteIndexedDb(MEDIA_DB_NAME);
  await deleteIndexedDb(RETRY_DB_NAME);
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : (globalThis as unknown as { Buffer?: { from(input: string, encoding: string): Uint8Array } })
          .Buffer?.from(base64, "base64")
          ?.reduce((acc, value) => acc + String.fromCharCode(value), "") ?? "";

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const createCanvasBlob = async (title: string, tone: string): Promise<Blob | null> => {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, tone);
  gradient.addColorStop(1, "#0f172a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.font = "bold 42px 'IBM Plex Sans', sans-serif";
  context.fillText("APP VISTORIA", 48, 110);
  context.font = "600 34px 'IBM Plex Sans', sans-serif";
  context.fillText(title, 48, 180);
  context.font = "500 26px 'IBM Plex Sans', sans-serif";
  context.fillText(new Date().toLocaleString("pt-BR"), 48, 240);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
};

const createDemoBlob = async (title: string, tone: string): Promise<Blob> => {
  const canvasBlob = await createCanvasBlob(title, tone);
  if (canvasBlob) {
    return canvasBlob;
  }
  return base64ToBlob(FALLBACK_PIXEL_PNG_BASE64, "image/png");
};

const createDemoPhoto = async (photo: DemoPhotoSpec): Promise<AddItemInput["photos"][number]> => {
  const photoId = createId("photo");
  const blob = await createDemoBlob(photo.name, photo.tone);
  const fileBaseName = normalizeFileName(photo.name || photoId) || photoId;
  const extension = blob.type.includes("png") ? "png" : "jpg";
  const saved = await photoRepository.save(photoId, blob, `${fileBaseName}.${extension}`);

  return {
    id: saved.id,
    storageKey: saved.storageKey,
    name: saved.name,
    mimeType: saved.mimeType,
    size: saved.size,
    syncStatus: "synced",
    retryDataAvailable: false
  };
};

const resolveLocationId = (
  inspectionId: string,
  locationName: string,
  state: StateCode
): Promise<string> =>
  inspectionService.getInspectionById(inspectionId).then((inspection) => {
    const location = inspection?.locations.find((entry) => entry.name === locationName);
    if (!location) {
      throw new Error(
        `Nao foi possivel localizar o local "${locationName}" durante preparacao da demo ${state}.`
      );
    }
    return location.id;
  });

const assertDemoMode = (): void => {
  if (repositoryMode.getFor("inspection") !== "local" || repositoryMode.getFor("photo") !== "local") {
    throw new Error(
      "Preparacao de demo disponivel somente com persistencia local (inspection/photo em local). Ajuste o modo antes de continuar."
    );
  }
};

export const demoSetupService = {
  getAvailability(): DemoAvailability {
    const inspectionMode = repositoryMode.getFor("inspection");
    const photoMode = repositoryMode.getFor("photo");

    if (inspectionMode === "local" && photoMode === "local") {
      return { available: true };
    }

    return {
      available: false,
      reason:
        "Modo demo indisponivel no ambiente remoto. Defina inspection/photo em modo local para gerar base de apresentacao."
    };
  },

  async prepareDemoWorkspace(): Promise<DemoSetupSummary> {
    assertDemoMode();
    await clearDemoWorkspace();

    const specs = createDemoInspectionSpecs();
    const summary: DemoSetupSummary = {
      inspectionsCreated: 0,
      locationsCreated: 0,
      itemsCreated: 0,
      photosCreated: 0
    };

    for (const spec of specs) {
      const createdInspection = await inspectionService.createInspection(spec.inspection);
      summary.inspectionsCreated += 1;

      for (const locationSpec of spec.locations) {
        const withLocation = await inspectionService.addLocation(createdInspection.id, {
          name: locationSpec.name
        });
        if (!withLocation) {
          throw new Error(
            `Nao foi possivel incluir o local "${locationSpec.name}" na vistoria de demo.`
          );
        }
        summary.locationsCreated += 1;

        const locationId = await resolveLocationId(
          createdInspection.id,
          locationSpec.name,
          spec.inspection.state
        );

        for (const itemSpec of locationSpec.items) {
          const photos = [];
          for (const photoSpec of itemSpec.photos) {
            photos.push(await createDemoPhoto(photoSpec));
            summary.photosCreated += 1;
          }

          const withItem = await inspectionService.addItemToLocation(
            createdInspection.id,
            locationId,
            {
              itemKey: itemSpec.itemKey,
              status: itemSpec.status,
              fieldValues: itemSpec.fieldValues,
              photos
            }
          );

          if (!withItem) {
            throw new Error(
              `Nao foi possivel incluir item "${itemSpec.itemKey}" no local "${locationSpec.name}".`
            );
          }
          summary.itemsCreated += 1;
        }
      }
    }

    return summary;
  }
};
