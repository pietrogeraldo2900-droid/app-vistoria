import { FormEvent, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import type { InspectionType, StateCode } from "@/domain/types/inspection";
import { inspectionService } from "@/services/inspection/inspectionService";
import { SectionPanel } from "@/ui/components/SectionPanel";

interface InspectionFormValues {
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

const inspectionTypeOptions: { value: InspectionType; label: string }[] = [
  { value: "inicial", label: "Inicial" },
  { value: "periodica", label: "Periodica" },
  { value: "retorno", label: "Retorno" },
  { value: "extraordinaria", label: "Extraordinaria" }
];

const createDefaultForm = (): InspectionFormValues => ({
  title: "",
  companyName: "",
  unitName: "",
  address: "",
  city: "",
  clientName: "",
  contractCode: "",
  inspectionType: "periodica",
  generalObservation: "",
  inspectorName: "",
  state: "SP",
  inspectionDate: new Date().toISOString().slice(0, 10)
});

export const NewInspectionPage = (): ReactElement => {
  const navigate = useNavigate();
  const [form, setForm] = useState<InspectionFormValues>(createDefaultForm);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const record = await inspectionService.createInspection(form);
    navigate(`/inspection/${record.id}/edit`);
  };

  return (
    <div className="page-grid">
      <SectionPanel
        title="Nova vistoria"
        subtitle="Preencha os metadados da vistoria para melhorar rastreabilidade, PDF e operacao de campo."
        delayMs={60}
      >
        <form className="form-grid inspection-details-grid" onSubmit={handleSubmit}>
          <label>
            Titulo da vistoria
            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Ex: Vistoria mensal - Unidade Norte"
              required
            />
          </label>

          <label>
            Tipo de vistoria
            <select
              value={form.inspectionType}
              onChange={(event) =>
                setForm((prev) => ({
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
            Empresa / local vistoriado
            <input
              type="text"
              value={form.companyName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, companyName: event.target.value }))
              }
              placeholder="Ex: Centro Empresarial Atlas"
              required
            />
          </label>

          <label>
            Unidade
            <input
              type="text"
              value={form.unitName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, unitName: event.target.value }))
              }
              placeholder="Ex: Unidade Paulista"
              required
            />
          </label>

          <label>
            Endereco
            <input
              type="text"
              value={form.address}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, address: event.target.value }))
              }
              placeholder="Ex: Av. Paulista, 1000"
              required
            />
          </label>

          <label>
            Cidade
            <input
              type="text"
              value={form.city}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, city: event.target.value }))
              }
              placeholder="Ex: Sao Paulo"
              required
            />
          </label>

          <label>
            Cliente / responsavel contratante
            <input
              type="text"
              value={form.clientName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clientName: event.target.value }))
              }
              placeholder="Ex: Atlas Facilities"
            />
          </label>

          <label>
            Contrato / OS
            <input
              type="text"
              value={form.contractCode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contractCode: event.target.value }))
              }
              placeholder="Ex: CTR-2026-0142"
            />
          </label>

          <label>
            Responsavel tecnico
            <input
              type="text"
              value={form.inspectorName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, inspectorName: event.target.value }))
              }
              placeholder="Ex: Carlos Oliveira"
              required
            />
          </label>

          <label>
            Estado da vistoria
            <select
              value={form.state}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, state: event.target.value as StateCode }))
              }
            >
              <option value="SP">Sao Paulo (SP)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
            </select>
          </label>

          <label>
            Data da vistoria
            <input
              type="date"
              value={form.inspectionDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, inspectionDate: event.target.value }))
              }
              required
            />
          </label>

          <label className="textarea-span">
            Observacao geral
            <textarea
              value={form.generalObservation}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, generalObservation: event.target.value }))
              }
              placeholder="Observacoes gerais da vistoria, escopo especial ou restricoes de acesso."
              rows={4}
            />
          </label>

          <button className="btn btn-primary details-save-btn" type="submit">
            Criar vistoria e iniciar cadastro de locais
          </button>
        </form>
      </SectionPanel>
    </div>
  );
};
