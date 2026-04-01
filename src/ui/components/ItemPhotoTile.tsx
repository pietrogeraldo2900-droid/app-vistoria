import { useEffect, useState, type ReactElement } from "react";
import type { ItemPhoto } from "@/domain/types/inspection";
import { photoRepository } from "@/persistence/photoRepository";
import { photoRetryPayloadRepository } from "@/persistence/photoRetryPayloadRepository";

interface ItemPhotoTileProps {
  photo: ItemPhoto;
  onRemove: () => void;
  onRetry?: () => void;
}

export const ItemPhotoTile = ({
  photo,
  onRemove,
  onRetry
}: ItemPhotoTileProps): ReactElement => {
  const [source, setSource] = useState<string | null>(photo.dataUrl ?? null);
  const syncStatus = photo.syncStatus ?? (photo.storageKey ? "synced" : "failed");
  const canRetry = syncStatus !== "synced" && photo.retryDataAvailable !== false;

  const syncLabel = {
    synced: "Sincronizada",
    pending: "Sincronizacao pendente",
    failed: "Falha de sincronizacao"
  } as const;

  const retryHint =
    syncStatus === "synced"
      ? null
      : canRetry
        ? syncStatus === "pending"
          ? "Pendente com dado local disponivel para reenvio."
          : "Falha com dado local disponivel para reenvio."
        : "Sem dado local para reenvio. Reanexe a foto.";

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (photo.dataUrl) {
      setSource(photo.dataUrl);
      return () => undefined;
    }

    const load = async (): Promise<void> => {
      if (photo.storageKey) {
        const blob = await photoRepository.get(photo.storageKey);
        if (!active || !blob) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
        return;
      }

      const retryPayload = await photoRetryPayloadRepository.get(photo.id);
      if (!active || !retryPayload) {
        setSource(null);
        return;
      }

      objectUrl = URL.createObjectURL(retryPayload.blob);
      setSource(objectUrl);
    };

    load().catch(() => setSource(null));

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photo.dataUrl, photo.storageKey]);

  return (
    <figure className="photo-tile">
      {source ? (
        <img src={source} alt={photo.name} loading="lazy" />
      ) : (
        <div className="photo-missing">Foto indisponivel</div>
      )}
      <figcaption className={`photo-sync-status status-${syncStatus}`}>
        {syncLabel[syncStatus]}
      </figcaption>
      {photo.syncErrorMessage ? (
        <p className="photo-sync-error">{photo.syncErrorMessage}</p>
      ) : null}
      {retryHint ? <p className="photo-retry-hint">{retryHint}</p> : null}
      {canRetry && onRetry ? (
        <button className="photo-retry" type="button" onClick={onRetry}>
          Reenviar
        </button>
      ) : null}
      {!canRetry && syncStatus !== "synced" ? (
        <p className="photo-retry-required">Reanexar necessario</p>
      ) : null}
      <button className="photo-remove" type="button" onClick={onRemove}>
        Remover
      </button>
    </figure>
  );
};
