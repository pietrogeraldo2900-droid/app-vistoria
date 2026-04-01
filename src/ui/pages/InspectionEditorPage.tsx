import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ReactElement
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  AddItemInput,
  InspectionType,
  InspectionRecord,
  StateCode,
  UpdateItemInput
} from "@/domain/types/inspection";
import { formatDateTime } from "@/domain/utils/format";
import { catalogService } from "@/services/inspection/catalogService";
import { inspectionService } from "@/services/inspection/inspectionService";
import { AddItemForm } from "@/ui/components/AddItemForm";
import { EditItemForm } from "@/ui/components/EditItemForm";
import { ItemPhotoTile } from "@/ui/components/ItemPhotoTile";
import { SectionPanel } from "@/ui/components/SectionPanel";
import { StatusBadge } from "@/ui/components/StatusBadge";

interface EditingItemState {
  locationId: string;
  itemId: string;
}

const inspectionTypeOptions: { value: InspectionType; label: string }[] = [
  { value: "inicial", label: "Inicial" },
  { value: "periodica", label: "Periodica" },
  { value: "retorno", label: "Retorno" },
  { value: "extraordinaria", label: "Extraordinaria" }
];

const commonLocationSuggestions = [
  "G1",
  "G2",
  "Casa de bombas",
  "Shaft de incendio",
  "Escada pressurizada"
] as const;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export const InspectionEditorPage = (): ReactElement => {
  const { inspectionId } = useParams();
  const navigate = useNavigate();

  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [isLoadingInspection, setIsLoadingInspection] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);
  const [feedback, setFeedback] = useState<string>("");

  const [detailsForm, setDetailsForm] = useState(() => ({
    title: inspection?.title ?? "",
    companyName: inspection?.companyName ?? "",
    unitName: inspection?.unitName ?? "",
    address: inspection?.address ?? "",
    city: inspection?.city ?? "",
    clientName: inspection?.clientName ?? "",
    contractCode: inspection?.contractCode ?? "",
    inspectionType: inspection?.inspectionType ?? ("periodica" as InspectionType),
    generalObservation: inspection?.generalObservation ?? "",
    inspectorName: inspection?.inspectorName ?? "",
    state: inspection?.state ?? ("SP" as StateCode),
    inspectionDate: inspection?.inspectionDate ?? new Date().toISOString().slice(0, 10)
  }));

  useEffect(() => {
    if (!inspection) {
      return;
    }
    setDetailsForm({
      title: inspection.title,
      companyName: inspection.companyName,
      unitName: inspection.unitName,
      address: inspection.address,
      city: inspection.city,
      clientName: inspection.clientName,
      contractCode: inspection.contractCode,
      inspectionType: inspection.inspectionType,
      generalObservation: inspection.generalObservation,
      inspectorName: inspection.inspectorName,
      state: inspection.state,
      inspectionDate: inspection.inspectionDate
    });
  }, [inspection]);

  useEffect(() => {
    if (!inspectionId) {
      setInspection(null);
      setIsLoadingInspection(false);
      return;
    }

    let isMounted = true;
    setIsLoadingInspection(true);
    void inspectionService
      .getInspectionById(inspectionId)
      .then((record) => {
        if (isMounted) {
          setInspection(record ?? null);
          setIsLoadingInspection(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setInspection(null);
          setIsLoadingInspection(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [inspectionId]);

  const itemDefinitions = catalogService.getItems();
  const statuses = catalogService.getStatuses();

  const totalItems = useMemo(() => {
    return (
      inspection?.locations.reduce(
        (acc, location) => acc + location.items.length,
        0
      ) ?? 0
    );
  }, [inspection]);

  const unsyncedPhotoSummary = useMemo(() => {
    if (!inspection) {
      return {
        total: 0,
        pending: 0,
        failed: 0,
        items: 0,
        noRetryData: 0
      };
    }

    let total = 0;
    let pending = 0;
    let failed = 0;
    let items = 0;
    let noRetryData = 0;

    for (const location of inspection.locations) {
      for (const item of location.items) {
        const unsyncedPhotos = item.photos.filter((photo) => photo.syncStatus !== "synced");
        if (unsyncedPhotos.length > 0) {
          items += 1;
          total += unsyncedPhotos.length;
          pending += unsyncedPhotos.filter((photo) => photo.syncStatus === "pending").length;
          failed += unsyncedPhotos.filter((photo) => photo.syncStatus === "failed").length;
          noRetryData += unsyncedPhotos.filter((photo) => photo.retryDataAvailable === false).length;
        }
      }
    }

    return { total, pending, failed, items, noRetryData };
  }, [inspection]);

  const reloadInspection = async (): Promise<void> => {
    if (!inspectionId) {
      setInspection(null);
      setIsLoadingInspection(false);
      return;
    }
    try {
      setIsLoadingInspection(true);
      const record = await inspectionService.getInspectionById(inspectionId);
      setInspection(record ?? null);
    } catch {
      setInspection(null);
      setFeedback("Falha ao recarregar vistoria.");
    } finally {
      setIsLoadingInspection(false);
    }
  };

  const handleUpdateDetails = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!inspectionId) {
      return;
    }
    const next = await inspectionService.updateInspectionDetails(inspectionId, detailsForm);
    if (next) {
      setInspection(next);
      setFeedback("Dados da vistoria atualizados.");
    }
  };

  const handleAddLocation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!inspection || !inspectionId || !locationName.trim()) {
      return;
    }

    const before = inspection.locations.length;
    const next = await inspectionService.addLocation(inspectionId, {
      name: locationName.trim()
    });
    if (!next) {
      return;
    }

    setInspection(next);
    if (next.locations.length === before) {
      setFeedback("Local duplicado ignorado.");
      return;
    }
    setLocationName("");
    setFeedback("Local adicionado.");
  };

  const handleQuickAddLocation = async (name: string): Promise<void> => {
    if (!inspection || !inspectionId) {
      return;
    }

    const before = inspection.locations.length;
    const next = await inspectionService.addLocation(inspectionId, { name });
    if (!next) {
      return;
    }

    setInspection(next);
    if (next.locations.length === before) {
      setFeedback(`Local "${name}" ja estava cadastrado.`);
      return;
    }
    setLocationName("");
    setFeedback(`Local rapido "${name}" adicionado.`);
  };

  const handleUpdateLocation = async (locationId: string): Promise<void> => {
    if (!inspectionId || !inspection) {
      return;
    }
    const draft = locationDrafts[locationId];
    if (!draft?.trim()) {
      return;
    }

    const beforeNames = inspection.locations.map((location) => location.name);
    const next = await inspectionService.updateLocationName(
      inspectionId,
      locationId,
      draft.trim()
    );
    if (!next) {
      return;
    }
    setInspection(next);
    const afterNames = next.locations.map((location) => location.name);
    if (beforeNames.join("|") === afterNames.join("|")) {
      setFeedback("Nome duplicado. Atualizacao de local ignorada.");
      return;
    }
    setFeedback("Local atualizado.");
  };

  const handleDeleteLocation = async (locationId: string): Promise<void> => {
    if (!inspectionId) {
      return;
    }
    const confirmed = window.confirm(
      "Deseja realmente excluir este local e todos os itens cadastrados nele?"
    );
    if (!confirmed) {
      return;
    }

    try {
      const next = await inspectionService.deleteLocation(inspectionId, locationId);
      if (next) {
        setInspection(next);
        setFeedback("Local removido.");
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, "Falha ao remover local."));
    }
  };

  const handleAddItem = async (
    locationId: string,
    input: AddItemInput
  ): Promise<boolean> => {
    if (!inspectionId || !inspection) {
      return false;
    }

    try {
      const before = inspection.locations.find((location) => location.id === locationId)?.items
        .length;
      const next = await inspectionService.addItemToLocation(inspectionId, locationId, input);
      if (!next) {
        return false;
      }
      setInspection(next);

      const after = next.locations.find((location) => location.id === locationId)?.items
        .length;
      const inserted = before !== after;
      if (!inserted) {
        setFeedback("Item duplicado ignorado.");
        return inserted;
      }

      const notSyncedPhotos = input.photos.filter((photo) => photo.syncStatus !== "synced");
      if (notSyncedPhotos.length > 0) {
        setFeedback(
          `Item adicionado com ${notSyncedPhotos.length} foto(s) nao sincronizada(s). Verifique o status exibido no card da foto.`
        );
        return inserted;
      }

      setFeedback("Item adicionado.");
      return inserted;
    } catch (error) {
      setFeedback(
        getErrorMessage(error, "Nao foi possivel adicionar o item com os criterios informados.")
      );
      return false;
    }
  };

  const handleUpdateItem = async (
    locationId: string,
    itemId: string,
    input: UpdateItemInput
  ): Promise<void> => {
    if (!inspectionId || !inspection) {
      return;
    }

    try {
      const before = inspection.locations
        .find((location) => location.id === locationId)
        ?.items.find((item) => item.id === itemId);

      const next = await inspectionService.updateItemInLocation(
        inspectionId,
        locationId,
        itemId,
        input
      );
      if (!next) {
        return;
      }

      setInspection(next);
      setEditingItem(null);

      const after = next.locations
        .find((location) => location.id === locationId)
        ?.items.find((item) => item.id === itemId);

      if (JSON.stringify(before) === JSON.stringify(after)) {
        setFeedback("Edicao duplicada ignorada.");
        return;
      }
      setFeedback("Item atualizado.");
    } catch (error) {
      setFeedback(
        getErrorMessage(error, "Nao foi possivel salvar o item com os criterios informados.")
      );
    }
  };

  const handleDeleteItem = async (
    locationId: string,
    itemId: string
  ): Promise<void> => {
    if (!inspectionId) {
      return;
    }

    const confirmed = window.confirm("Deseja excluir este item da vistoria?");
    if (!confirmed) {
      return;
    }

    try {
      const next = await inspectionService.deleteItemFromLocation(
        inspectionId,
        locationId,
        itemId
      );
      if (next) {
        setInspection(next);
        setEditingItem(null);
        setFeedback("Item removido.");
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, "Falha ao remover item."));
    }
  };

  const handleRemovePhoto = async (
    locationId: string,
    itemId: string,
    photoId: string
  ): Promise<void> => {
    if (!inspectionId) {
      return;
    }
    try {
      const next = await inspectionService.removePhotoFromItem(
        inspectionId,
        locationId,
        itemId,
        photoId
      );
      if (next) {
        setInspection(next);
        setFeedback("Foto removida.");
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, "Falha ao remover foto."));
    }
  };

  const handleRetryPhotoSync = async (
    locationId: string,
    itemId: string,
    photoId: string
  ): Promise<void> => {
    if (!inspectionId) {
      return;
    }

    try {
      const next = await inspectionService.retryPhotoSync(
        inspectionId,
        locationId,
        itemId,
        photoId
      );
      if (next) {
        setInspection(next);
        const nextPhoto = next.locations
          .find((location) => location.id === locationId)
          ?.items.find((item) => item.id === itemId)
          ?.photos.find((photo) => photo.id === photoId);

        if (nextPhoto?.syncStatus === "synced") {
          setFeedback("Foto sincronizada com sucesso.");
          return;
        }

        if (nextPhoto?.retryDataAvailable === false) {
          setFeedback("Falha de sincronizacao sem dado local para retry. Reanexe a foto.");
          return;
        }

        if (nextPhoto?.syncStatus === "pending") {
          setFeedback("Foto segue pendente. Tente reenviar novamente em instantes.");
          return;
        }

        setFeedback("Falha ao sincronizar foto. Reenvio manual ainda disponivel.");
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, "Falha ao reenviar foto."));
    }
  };

  if (isLoadingInspection) {
    return (
      <div className="page-grid">
        <SectionPanel
          title="Carregando vistoria"
          subtitle="Aguarde a carga dos dados da vistoria."
        >
          <p className="empty-state">Buscando registro da vistoria...</p>
        </SectionPanel>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="page-grid">
        <SectionPanel
          title="Vistoria nao encontrada"
          subtitle="Verifique se o ID ainda existe no historico local."
        >
          <div className="inline-actions">
            <Link className="btn btn-primary" to="/history">
              Ir para historico
            </Link>
            <Link className="btn btn-ghost" to="/inspection/new">
              Criar nova vistoria
            </Link>
          </div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <SectionPanel
        title="Dados da vistoria"
        subtitle={`Atualizado em ${formatDateTime(inspection.updatedAt)} · ${totalItems} itens cadastrados`}
        delayMs={60}
        actions={
          <div className="inline-actions compact">
            <button className="btn btn-outline" onClick={reloadInspection} type="button">
              Atualizar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/inspection/${inspection.id}/preview`)}
              type="button"
            >
              Gerar previa do relatorio
            </button>
          </div>
        }
      >
        {feedback ? <p className="feedback-message">{feedback}</p> : null}
        {unsyncedPhotoSummary.total > 0 ? (
          <div className="photo-sync-overview">
            <strong>Fotos nao sincronizadas na vistoria: {unsyncedPhotoSummary.total}</strong>
            <p>
              {unsyncedPhotoSummary.items} item(ns) com pendencia.
              {" "}
              {unsyncedPhotoSummary.pending} pendente(s) e {unsyncedPhotoSummary.failed} com
              falha de sincronizacao.
              {" "}
              {unsyncedPhotoSummary.noRetryData} sem dado local para reenvio.
            </p>
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleUpdateDetails}>
          <label>
            Titulo
            <input
              type="text"
              value={detailsForm.title}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Tipo de vistoria
            <select
              value={detailsForm.inspectionType}
              onChange={(event) =>
                setDetailsForm((prev) => ({
                  ...prev,
                  inspectionType: event.target.value as InspectionType
                }))
              }
            >
              {inspectionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Empresa / local
            <input
              type="text"
              value={detailsForm.companyName}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, companyName: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Unidade
            <input
              type="text"
              value={detailsForm.unitName}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, unitName: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Endereco
            <input
              type="text"
              value={detailsForm.address}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, address: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Cidade
            <input
              type="text"
              value={detailsForm.city}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, city: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Cliente / contratante
            <input
              type="text"
              value={detailsForm.clientName}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, clientName: event.target.value }))
              }
            />
          </label>

          <label>
            Contrato / OS
            <input
              type="text"
              value={detailsForm.contractCode}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, contractCode: event.target.value }))
              }
            />
          </label>

          <label>
            Responsavel tecnico
            <input
              type="text"
              value={detailsForm.inspectorName}
              onChange={(event) =>
                setDetailsForm((prev) => ({
                  ...prev,
                  inspectorName: event.target.value
                }))
              }
              required
            />
          </label>

          <label>
            Estado
            <select
              value={detailsForm.state}
              onChange={(event) =>
                setDetailsForm((prev) => ({
                  ...prev,
                  state: event.target.value as StateCode
                }))
              }
            >
              <option value="SP">SP</option>
              <option value="RJ">RJ</option>
            </select>
          </label>

          <label>
            Data da vistoria
            <input
              type="date"
              value={detailsForm.inspectionDate}
              onChange={(event) =>
                setDetailsForm((prev) => ({
                  ...prev,
                  inspectionDate: event.target.value
                }))
              }
              required
            />
          </label>

          <label className="textarea-span">
            Observacao geral
            <textarea
              value={detailsForm.generalObservation}
              onChange={(event) =>
                setDetailsForm((prev) => ({
                  ...prev,
                  generalObservation: event.target.value
                }))
              }
              rows={3}
              placeholder="Observacoes gerais da vistoria e contexto de campo."
            />
          </label>

          <button className="btn btn-primary" type="submit">
            Salvar dados da vistoria
          </button>
        </form>
      </SectionPanel>

      <SectionPanel
        title="Locais vistoriados"
        subtitle="Cadastro e manutencao dos locais com itens, status e fotos."
        delayMs={120}
      >
        <form className="inline-form" onSubmit={handleAddLocation}>
          <input
            type="text"
            placeholder="Ex: G1, Casa de bombas, Sala eletrica..."
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            Adicionar local
          </button>
        </form>

        <div className="inline-actions compact">
          {commonLocationSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="btn btn-ghost"
              type="button"
              onClick={() => handleQuickAddLocation(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {inspection.locations.length === 0 ? (
          <p className="empty-state">
            Nenhum local cadastrado ainda. Adicione o primeiro local para iniciar os
            itens da vistoria.
          </p>
        ) : (
          <div className="locations-stack">
            {inspection.locations.map((location) => (
              <article className="location-block" key={location.id}>
                <header className="location-head">
                  <div>
                    <h3>{location.name}</h3>
                    <p>{location.items.length} item(ns) cadastrado(s)</p>
                  </div>
                  <div className="inline-actions compact">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [location.id]: location.name
                        }))
                      }
                    >
                      Editar local
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => handleDeleteLocation(location.id)}
                    >
                      Excluir local
                    </button>
                  </div>
                </header>

                {locationDrafts[location.id] !== undefined ? (
                  <div className="inline-form location-edit-form">
                    <input
                      type="text"
                      value={locationDrafts[location.id]}
                      onChange={(event) =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [location.id]: event.target.value
                        }))
                      }
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleUpdateLocation(location.id)}
                    >
                      Salvar local
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() =>
                        setLocationDrafts((prev) => {
                          const next = { ...prev };
                          delete next[location.id];
                          return next;
                        })
                      }
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}

                <AddItemForm
                  itemDefinitions={itemDefinitions}
                  statuses={statuses}
                  onAddItem={(input) => handleAddItem(location.id, input)}
                />

                {location.items.length === 0 ? (
                  <p className="empty-state small">
                    Sem itens nesse local. Use o formulario acima para cadastrar.
                  </p>
                ) : (
                  <ul className="item-list">
                    {location.items.map((item) => {
                      const isEditing =
                        editingItem?.locationId === location.id &&
                        editingItem?.itemId === item.id;
                      const unsyncedPhotos = item.photos.filter(
                        (photo) => photo.syncStatus !== "synced"
                      );
                      const photosWithoutRetryData = unsyncedPhotos.filter(
                        (photo) => photo.retryDataAvailable === false
                      );

                      return (
                        <li key={item.id}>
                          <div className="item-list-head">
                            <h4>
                              {catalogService.getItemByKey(item.itemKey)?.label ?? item.itemKey}
                            </h4>
                            <StatusBadge status={item.status} />
                          </div>

                          <p className="generated-text">
                            {item.generatedText ||
                              "Pendencia tecnica interna: sem template homologado."}
                          </p>
                          {unsyncedPhotos.length > 0 ? (
                            <p className="item-sync-alert">
                              Este item possui {unsyncedPhotos.length} foto(s) sem sincronizacao.
                              {photosWithoutRetryData.length > 0
                                ? ` ${photosWithoutRetryData.length} exigem reanexo por falta de dado local para retry.`
                                : " Reenvio manual disponivel para as pendencias."}
                            </p>
                          ) : null}

                          <div className="inline-actions compact">
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() =>
                                setEditingItem({ locationId: location.id, itemId: item.id })
                              }
                            >
                              Editar item
                            </button>
                            <button
                              className="btn btn-outline"
                              type="button"
                              onClick={() => handleDeleteItem(location.id, item.id)}
                            >
                              Excluir item
                            </button>
                          </div>

                          {isEditing ? (
                            <EditItemForm
                              itemDefinitions={itemDefinitions}
                              statuses={statuses}
                              item={item}
                              onSave={(input) =>
                                handleUpdateItem(location.id, item.id, input)
                              }
                              onCancel={() => setEditingItem(null)}
                            />
                          ) : null}

                          {item.photos.length > 0 ? (
                            <div className="photo-row">
                              {item.photos.map((photo) => (
                                <ItemPhotoTile
                                  key={photo.id}
                                  photo={photo}
                                  onRemove={() =>
                                    handleRemovePhoto(location.id, item.id, photo.id)
                                  }
                                  onRetry={() =>
                                    handleRetryPhotoSync(location.id, item.id, photo.id)
                                  }
                                />
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
};
