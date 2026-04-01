import { FormEvent, useMemo, useState, type ReactElement } from "react";
import type {
  AddItemInput,
  InspectionFieldValues,
  InspectionItemDefinition,
  InspectionStatus
} from "@/domain/types/inspection";
import { fileService } from "@/services/inspection/fileService";
import { inspectionValidationService } from "@/services/inspection/inspectionValidationService";

interface AddItemFormProps {
  itemDefinitions: InspectionItemDefinition[];
  statuses: InspectionStatus[];
  onAddItem: (input: AddItemInput) => Promise<boolean>;
}

const fieldLabelMap: Record<string, string> = {
  lacrado: "Lacrado",
  validade_recarga: "Validade da recarga",
  conforme_pressao: "Conforme pressao",
  selo_inmetro: "Selo INMETRO",
  possui_esguicho: "Possui esguicho",
  possui_chave_storz: "Possui chave Storz",
  possui_registro: "Possui registro",
  sinalizacao_instalada: "Sinalizacao instalada",
  mangueira_teste_hidrostatico_validade: "Teste hidrostatico da mangueira",
  abrigo_incompleto: "Abrigo incompleto",
  instalado: "Instalado",
  funcionamento_ok: "Funcionamento OK",
  tipo_fotoluminescente: "Tipo fotoluminescente",
  instalada: "Instalada",
  obstruido: "Obstruido",
  painel_ativo: "Painel ativo",
  sirene_operante: "Sirene operante",
  bateria_backup_ok: "Bateria backup OK",
  sinalizado: "Sinalizado",
  valvula_funcional: "Valvula funcional",
  tampa_presente: "Tampa presente",
  pressao_adequada: "Pressao adequada",
  acionamento_automatico_ok: "Acionamento automatico OK",
  fechamento_automatico: "Fechamento automatico",
  sem_obstrucao: "Sem obstrucao",
  retencao_porta_ok: "Retencao de porta OK",
  libera_no_alarme: "Libera no alarme",
  pressurizacao_ok: "Pressurizacao OK",
  porta_estanque_ok: "Porta estanque OK",
  volume_reserva_ok: "Volume reserva OK",
  acesso_desobstruido: "Acesso desobstruido"
};

const getFieldLabel = (fieldName: string): string => {
  if (fieldLabelMap[fieldName]) {
    return fieldLabelMap[fieldName];
  }
  return fieldName
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isMonthYearField = (fieldName: string): boolean => fieldName.includes("validade");

const isBooleanField = (fieldName: string): boolean => !isMonthYearField(fieldName);

const statusLabelMap: Record<InspectionStatus, string> = {
  conforme: "Conforme",
  nao_conforme: "Nao conforme",
  em_manutencao: "Em manutencao",
  sem_acesso: "Sem acesso",
  nao_testado: "Nao testado"
};

export const AddItemForm = ({
  itemDefinitions,
  statuses,
  onAddItem
}: AddItemFormProps): ReactElement => {
  const [itemKey, setItemKey] = useState(itemDefinitions[0]?.key ?? "");
  const [status, setStatus] = useState<InspectionStatus>(statuses[0] ?? "conforme");
  const [fieldValues, setFieldValues] = useState<InspectionFieldValues>({});
  const [files, setFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => itemDefinitions.find((item) => item.key === itemKey),
    [itemDefinitions, itemKey]
  );

  const requiredFields = useMemo(
    () => new Set(inspectionValidationService.getRequiredFields(itemKey, status)),
    [itemKey, status]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!itemKey || !selectedItem) {
      return;
    }

    try {
      setIsSubmitting(true);
      const photos = await fileService.mapFilesToPhotos(files);
      const inserted = await onAddItem({
        itemKey,
        status,
        fieldValues,
        photos
      });
      if (inserted) {
        setFieldValues({});
        setFiles(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="form-grid item-form" onSubmit={handleSubmit}>
      <label>
        Item vistoriado
        <select value={itemKey} onChange={(event) => setItemKey(event.target.value)}>
          {itemDefinitions.map((item) => (
            <option value={item.key} key={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as InspectionStatus)}
        >
          {statuses.map((itemStatus) => (
            <option value={itemStatus} key={itemStatus}>
              {statusLabelMap[itemStatus]}
            </option>
          ))}
        </select>
      </label>

      {selectedItem?.fields.map((field) => (
        <label key={field}>
          {getFieldLabel(field)}
          {requiredFields.has(field) ? " *" : ""}
          {isMonthYearField(field) ? (
            <input
              type="month"
              value={fieldValues[field] ?? ""}
              onChange={(event) =>
                setFieldValues((prev) => ({ ...prev, [field]: event.target.value }))
              }
              required={requiredFields.has(field)}
            />
          ) : null}

          {isBooleanField(field) ? (
            <select
              value={fieldValues[field] ?? ""}
              onChange={(event) =>
                setFieldValues((prev) => ({ ...prev, [field]: event.target.value }))
              }
              required={requiredFields.has(field)}
            >
              <option value="">Selecione</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
          ) : null}
        </label>
      ))}

      <label>
        Fotos do item
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => setFiles(event.target.files)}
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando item..." : "Adicionar item"}
      </button>
    </form>
  );
};
