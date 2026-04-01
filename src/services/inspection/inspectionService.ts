import type {
  AddItemInput,
  AddLocationInput,
  ItemPhoto,
  CreateInspectionInput,
  InspectionItem,
  InspectionLocation,
  InspectionRecord,
  ReportLine,
  UpdateItemInput
} from "@/domain/types/inspection";
import { createId } from "@/domain/utils/id";
import {
  HttpClientResponseError,
  HttpClientTimeoutError
} from "@/infrastructure/http/httpClient";
import { inspectionRepository } from "@/persistence/inspectionRepository";
import { photoRepository } from "@/persistence/photoRepository";
import { photoRetryPayloadRepository } from "@/persistence/photoRetryPayloadRepository";
import { prtEngine } from "@/prt-engine/prtEngine";
import { inspectionValidationService } from "@/services/inspection/inspectionValidationService";

const nowIso = (): string => new Date().toISOString();

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const stableFieldSignature = (fieldValues: Record<string, string>): string =>
  Object.keys(fieldValues)
    .sort()
    .map((key) => `${key}=${fieldValues[key] ?? ""}`)
    .join("|");

const isDuplicatedItem = (
  location: InspectionLocation,
  input: Pick<AddItemInput, "itemKey" | "status" | "fieldValues">,
  ignoreItemId?: string
): boolean => {
  const nextSignature = `${input.itemKey}::${input.status}::${stableFieldSignature(
    input.fieldValues
  )}`;

  return location.items.some((item) => {
    if (ignoreItemId && item.id === ignoreItemId) {
      return false;
    }
    const currentSignature = `${item.itemKey}::${item.status}::${stableFieldSignature(
      item.fieldValues
    )}`;
    return currentSignature === nextSignature;
  });
};

const assertItemValidation = (
  inspection: InspectionRecord,
  locationName: string,
  input: Pick<AddItemInput, "itemKey" | "status" | "fieldValues">
): void => {
  const validation = inspectionValidationService.validateItemInput({
    itemKey: input.itemKey,
    status: input.status,
    state: inspection.state,
    locationName,
    fieldValues: input.fieldValues
  });
  if (!validation.isValid) {
    throw new Error(validation.issues.map((issue) => issue.message).join(" "));
  }
};

const createInspectionLocation = (input: AddLocationInput): InspectionLocation => ({
  id: createId("loc"),
  name: input.name.trim(),
  items: []
});

const createInspectionItem = (
  inspection: InspectionRecord,
  location: InspectionLocation,
  input: AddItemInput
): InspectionItem => {
  assertItemValidation(inspection, location.name, input);
  const generation = prtEngine.generate({
    itemKey: input.itemKey,
    status: input.status,
    state: inspection.state,
    locationName: location.name,
    fieldValues: input.fieldValues
  });

  return {
    id: createId("item"),
    itemKey: input.itemKey,
    status: input.status,
    fieldValues: input.fieldValues,
    generatedText: generation.text ?? "",
    photos: input.photos,
    createdAt: nowIso()
  };
};

const rehydrateGeneratedTexts = (inspection: InspectionRecord): InspectionRecord => {
  const nextLocations = inspection.locations.map((location) => ({
    ...location,
    items: location.items.map((item) => ({
      ...item,
      generatedText:
        prtEngine.generate({
          itemKey: item.itemKey,
          status: item.status,
          state: inspection.state,
          locationName: location.name,
          fieldValues: item.fieldValues
        }).text ?? ""
    }))
  }));

  return {
    ...inspection,
    locations: nextLocations,
    updatedAt: nowIso()
  };
};

const removePhotoOrThrow = async (
  storageKey: string,
  context: "item" | "local" | "foto"
): Promise<void> => {
  try {
    await photoRepository.remove(storageKey);
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Falha ao remover foto.";

    throw new Error(
      `Nao foi possivel remover foto no contexto de ${context}. Operacao cancelada para manter consistencia dos registros. Motivo: ${reason}`
    );
  }
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Nao foi possivel converter dado local da foto para reenvio.");
  }
  return response.blob();
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const classifyRetryFailure = (error: unknown): "pending" | "failed" => {
  if (error instanceof HttpClientTimeoutError) {
    return "pending";
  }

  if (error instanceof HttpClientResponseError) {
    if (error.status >= 500) {
      return "pending";
    }
    return "failed";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("network")) {
    return "pending";
  }

  return "failed";
};

const resolveRetryDataAvailability = async (photo: ItemPhoto): Promise<boolean> => {
  if (photo.syncStatus === "synced") {
    return false;
  }

  if (photo.dataUrl && photo.dataUrl.trim().length > 0) {
    return true;
  }

  try {
    const retryPayload = await photoRetryPayloadRepository.get(photo.id);
    return retryPayload !== null;
  } catch {
    return false;
  }
};

const hydrateInspectionRetryState = async (
  inspection: InspectionRecord
): Promise<InspectionRecord> => {
  const nextLocations = await Promise.all(
    inspection.locations.map(async (location) => {
      const nextItems = await Promise.all(
        location.items.map(async (item) => {
          const nextPhotos = await Promise.all(
            item.photos.map(async (photo) => ({
              ...photo,
              retryDataAvailable: await resolveRetryDataAvailability(photo)
            }))
          );

          return {
            ...item,
            photos: nextPhotos
          };
        })
      );

      return {
        ...location,
        items: nextItems
      };
    })
  );

  return {
    ...inspection,
    locations: nextLocations
  };
};

const hydrateInspectionRetryStateOptional = async (
  inspection: InspectionRecord | undefined
): Promise<InspectionRecord | undefined> => {
  if (!inspection) {
    return undefined;
  }

  return hydrateInspectionRetryState(inspection);
};

const upsertAndHydrateInspection = async (
  inspection: InspectionRecord
): Promise<InspectionRecord> => {
  const persisted = await inspectionRepository.upsert(inspection);
  return hydrateInspectionRetryState(persisted);
};

export const inspectionService = {
  async listInspections(): Promise<InspectionRecord[]> {
    const inspections = await inspectionRepository.list();
    return Promise.all(inspections.map((inspection) => hydrateInspectionRetryState(inspection)));
  },

  async getInspectionById(
    inspectionId: string
  ): Promise<InspectionRecord | undefined> {
    const inspection = await inspectionRepository.getById(inspectionId);
    return hydrateInspectionRetryStateOptional(inspection);
  },

  async createInspection(input: CreateInspectionInput): Promise<InspectionRecord> {
    const now = nowIso();
    const record: InspectionRecord = {
      id: createId("inspection"),
      title: input.title,
      companyName: input.companyName,
      unitName: input.unitName,
      address: input.address,
      city: input.city,
      clientName: input.clientName,
      contractCode: input.contractCode,
      inspectionType: input.inspectionType,
      generalObservation: input.generalObservation,
      inspectorName: input.inspectorName,
      state: input.state,
      inspectionDate: input.inspectionDate,
      createdAt: now,
      updatedAt: now,
      locations: []
    };
    return upsertAndHydrateInspection(record);
  },

  async updateInspectionDetails(
    inspectionId: string,
    updates: Pick<
      InspectionRecord,
      | "title"
      | "companyName"
      | "unitName"
      | "address"
      | "city"
      | "clientName"
      | "contractCode"
      | "inspectionType"
      | "generalObservation"
      | "inspectorName"
      | "state"
      | "inspectionDate"
    >
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const next = rehydrateGeneratedTexts({
      ...current,
      ...updates
    });
    return upsertAndHydrateInspection(next);
  },

  async addLocation(
    inspectionId: string,
    input: AddLocationInput
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const duplicatedLocation = current.locations.some(
      (location) => normalizeKey(location.name) === normalizeKey(input.name)
    );
    if (duplicatedLocation) {
      return hydrateInspectionRetryState(current);
    }

    const next = {
      ...current,
      locations: [...current.locations, createInspectionLocation(input)],
      updatedAt: nowIso()
    };

    return upsertAndHydrateInspection(next);
  },

  async addItemToLocation(
    inspectionId: string,
    locationId: string,
    input: AddItemInput
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const nextLocations = current.locations.map((location) => {
      if (location.id !== locationId) {
        return location;
      }

      if (isDuplicatedItem(location, input)) {
        return location;
      }

      return {
        ...location,
        items: [...location.items, createInspectionItem(current, location, input)]
      };
    });

    const next = {
      ...current,
      locations: nextLocations,
      updatedAt: nowIso()
    };

    return upsertAndHydrateInspection(next);
  },

  async updateLocationName(
    inspectionId: string,
    locationId: string,
    nextName: string
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const duplicatedLocation = current.locations.some(
      (location) =>
        location.id !== locationId &&
        normalizeKey(location.name) === normalizeKey(nextName)
    );
    if (duplicatedLocation) {
      return hydrateInspectionRetryState(current);
    }

    const next = rehydrateGeneratedTexts({
      ...current,
      locations: current.locations.map((location) =>
        location.id === locationId
          ? {
              ...location,
              name: nextName.trim()
            }
          : location
      )
    });

    return upsertAndHydrateInspection(next);
  },

  async deleteLocation(
    inspectionId: string,
    locationId: string
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const toDelete = current.locations.find((location) => location.id === locationId);
    if (toDelete) {
      for (const item of toDelete.items) {
        for (const photo of item.photos) {
          if (photo.storageKey) {
            await removePhotoOrThrow(photo.storageKey, "local");
          }
          await photoRetryPayloadRepository.remove(photo.id).catch(() => undefined);
        }
      }
    }

    const next = {
      ...current,
      locations: current.locations.filter((location) => location.id !== locationId),
      updatedAt: nowIso()
    };

    return upsertAndHydrateInspection(next);
  },

  async updateItemInLocation(
    inspectionId: string,
    locationId: string,
    itemId: string,
    input: UpdateItemInput
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const location = current.locations.find((entry) => entry.id === locationId);
    if (!location) {
      return hydrateInspectionRetryState(current);
    }

    if (isDuplicatedItem(location, input, itemId)) {
      return hydrateInspectionRetryState(current);
    }

    assertItemValidation(current, location.name, input);

    const next = rehydrateGeneratedTexts({
      ...current,
      locations: current.locations.map((entry) => {
        if (entry.id !== locationId) {
          return entry;
        }
        return {
          ...entry,
          items: entry.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  itemKey: input.itemKey,
                  status: input.status,
                  fieldValues: input.fieldValues
                }
              : item
          )
        };
      })
    });

    return upsertAndHydrateInspection(next);
  },

  async deleteItemFromLocation(
    inspectionId: string,
    locationId: string,
    itemId: string
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const targetLocation = current.locations.find((location) => location.id === locationId);
    const targetItem = targetLocation?.items.find((item) => item.id === itemId);

    if (targetItem) {
      for (const photo of targetItem.photos) {
        if (photo.storageKey) {
          await removePhotoOrThrow(photo.storageKey, "item");
        }
        await photoRetryPayloadRepository.remove(photo.id).catch(() => undefined);
      }
    }

    const next = {
      ...current,
      locations: current.locations.map((location) => {
        if (location.id !== locationId) {
          return location;
        }
        return {
          ...location,
          items: location.items.filter((item) => item.id !== itemId)
        };
      }),
      updatedAt: nowIso()
    };

    return upsertAndHydrateInspection(next);
  },

  async removePhotoFromItem(
    inspectionId: string,
    locationId: string,
    itemId: string,
    photoId: string
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const targetPhoto = current.locations
      .find((location) => location.id === locationId)
      ?.items.find((item) => item.id === itemId)
      ?.photos.find((photo) => photo.id === photoId);

    if (targetPhoto?.storageKey) {
      await removePhotoOrThrow(targetPhoto.storageKey, "foto");
    }
    if (targetPhoto) {
      await photoRetryPayloadRepository.remove(targetPhoto.id).catch(() => undefined);
    }

    const next = {
      ...current,
      locations: current.locations.map((location) => {
        if (location.id !== locationId) {
          return location;
        }
        return {
          ...location,
          items: location.items.map((item) => {
            if (item.id !== itemId) {
              return item;
            }
            return {
              ...item,
              photos: item.photos.filter((photo) => photo.id !== photoId)
            };
          })
        };
      }),
      updatedAt: nowIso()
    };

    return upsertAndHydrateInspection(next);
  },

  async retryPhotoSync(
    inspectionId: string,
    locationId: string,
    itemId: string,
    photoId: string
  ): Promise<InspectionRecord | undefined> {
    const current = await inspectionRepository.getById(inspectionId);
    if (!current) {
      return undefined;
    }

    const location = current.locations.find((entry) => entry.id === locationId);
    const item = location?.items.find((entry) => entry.id === itemId);
    const photo = item?.photos.find((entry) => entry.id === photoId);

    if (!photo) {
      return hydrateInspectionRetryState(current);
    }

    const retryPayload = await photoRetryPayloadRepository.get(photo.id).catch(() => null);
    let retryBlob: Blob | undefined = retryPayload?.blob;
    const retryFileName = retryPayload?.fileName ?? photo.name;

    if (!retryBlob && photo.dataUrl) {
      try {
        retryBlob = await dataUrlToBlob(photo.dataUrl);
      } catch {
        retryBlob = undefined;
      }
    }

    if (!retryBlob) {
      const nextWithoutData: InspectionRecord = {
        ...current,
        locations: current.locations.map((entry) => {
          if (entry.id !== locationId) {
            return entry;
          }

          return {
            ...entry,
            items: entry.items.map((itemEntry) => {
              if (itemEntry.id !== itemId) {
                return itemEntry;
              }

              return {
                ...itemEntry,
                photos: itemEntry.photos.map((photoEntry) =>
                  photoEntry.id === photoId
                    ? {
                        ...photoEntry,
                        syncStatus: "failed",
                        retryDataAvailable: false,
                        syncErrorMessage: "Foto sem dado local para reenvio. Reanexe a foto."
                      }
                    : photoEntry
                )
              };
            })
          };
        }),
        updatedAt: nowIso()
      };
      return upsertAndHydrateInspection(nextWithoutData);
    }

    try {
      const saved = await photoRepository.save(photo.id, retryBlob, retryFileName);
      await photoRetryPayloadRepository.remove(photo.id).catch(() => undefined);

      const next: InspectionRecord = {
        ...current,
        locations: current.locations.map((entry) => {
          if (entry.id !== locationId) {
            return entry;
          }

          return {
            ...entry,
            items: entry.items.map((itemEntry) => {
              if (itemEntry.id !== itemId) {
                return itemEntry;
              }

              return {
                ...itemEntry,
                photos: itemEntry.photos.map((photoEntry) =>
                  photoEntry.id === photoId
                    ? {
                        ...photoEntry,
                        id: saved.id,
                        storageKey: saved.storageKey,
                        name: saved.name,
                        mimeType: saved.mimeType,
                        size: saved.size,
                        syncStatus: "synced",
                        retryDataAvailable: false,
                        syncErrorMessage: undefined,
                        dataUrl: undefined
                      }
                    : photoEntry
                )
              };
            })
          };
        }),
        updatedAt: nowIso()
      };

      return upsertAndHydrateInspection(next);
    } catch (error) {
      let retryDataAvailable = retryPayload !== null;
      if (!retryDataAvailable && photo.dataUrl) {
        try {
          const legacyBlob = await dataUrlToBlob(photo.dataUrl);
          await photoRetryPayloadRepository.save({
            photoId: photo.id,
            blob: legacyBlob,
            fileName: photo.name,
            mimeType: photo.mimeType,
            size: photo.size
          });
          retryDataAvailable = true;
        } catch {
          retryDataAvailable = false;
        }
      }

      const baseErrorMessage = getErrorMessage(error, "Falha ao reenviar foto.");
      const syncErrorMessage = retryDataAvailable
        ? baseErrorMessage
        : `${baseErrorMessage} Sem dado local para novo retry apos recarga. Reanexe a foto.`;

      const next: InspectionRecord = {
        ...current,
        locations: current.locations.map((entry) => {
          if (entry.id !== locationId) {
            return entry;
          }

          return {
            ...entry,
            items: entry.items.map((itemEntry) => {
              if (itemEntry.id !== itemId) {
                return itemEntry;
              }

              return {
                ...itemEntry,
                photos: itemEntry.photos.map((photoEntry) =>
                  photoEntry.id === photoId
                    ? {
                        ...photoEntry,
                        syncStatus: classifyRetryFailure(error),
                        retryDataAvailable,
                        syncErrorMessage
                      }
                    : photoEntry
                )
              };
            })
          };
        }),
        updatedAt: nowIso()
      };

      return upsertAndHydrateInspection(next);
    }
  },

  async generateReportLines(inspectionId: string): Promise<ReportLine[]> {
    const inspection = await inspectionRepository.getById(inspectionId);
    if (!inspection) {
      return [];
    }

    const lines: ReportLine[] = [];
    for (const location of inspection.locations) {
      for (const item of location.items) {
        const generation = prtEngine.generate({
          itemKey: item.itemKey,
          status: item.status,
          state: inspection.state,
          locationName: location.name,
          fieldValues: item.fieldValues
        });

        lines.push({
          locationId: location.id,
          locationName: location.name,
          itemId: item.id,
          itemKey: item.itemKey,
          status: item.status,
          text: generation.text,
          isTechnicalPending: generation.isTechnicalPending,
          technicalPendingReason: generation.technicalPendingReason
        });
      }
    }
    return lines;
  }
};
