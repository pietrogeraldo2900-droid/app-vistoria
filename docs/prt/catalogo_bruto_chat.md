# Catalogo Bruto de PRT (Origem: Conversa)

## Objetivo deste arquivo
Este arquivo consolida o texto bruto enviado em conversa para servir como material de apoio.

Importante:
- Este arquivo NAO substitui as fontes oficiais do projeto.
- Fonte oficial continua:
  1. `docs/prt_rules.md`
  2. `data/prt_templates.json`
  3. `data/inspection_items.json`

## 1) Regras gerais de padronizacao dos PRTs

### 1.1 Regra de montagem do texto
- O local sempre vem no inicio.
- O local e o texto devem ficar na mesma linha:
  - `[Local] - [Descricao padronizada]`

Exemplo:
- `Sala de saude preventiva - Devera ser feita a instalacao de detector de fumaca, conforme IT 19/2025 do Corpo de Bombeiros.`

### 1.2 Regra de linguagem
- Tom impessoal e tecnico.
- Manter estrutura aprovada, sem reescrever desnecessariamente.
- Quando houver texto homologado, usar exatamente.

### 1.3 Regra de local
- Quando aparecer `G`, substituir por `Galpao`.
- Exemplo: `G1 -> Galpao 1`

### 1.4 Regra normativa
- SP: citar IT/norma quando aplicavel.
- RJ: nao citar IT.

### 1.5 Atualizacao normativa
- Referencias `/2019` passaram para `/2025`.

### 1.6 Regra de variaveis
Variaveis citadas:
- `[mes/ano]`
- `[local]`
- `[equipamento]`
- `[pendencia]`

## 2) Siglas e nomenclaturas padronizadas
- `PRT` = Padronizacao de Relatorio Tecnico
- `SPK` = Chuveiros automaticos / sprinklers
- `IE` = Iluminacao de emergencia
- `AM` = Acionador manual
- `DF` = Detector de fumaca
- `PCF` = Porta corta-fogo
- `VGA` = Valvula de governo e alarme
- `RTI` = Reserva tecnica de incendio
- `SDAI` = Sistema de deteccao e alarme de incendio

## 3) Estrutura recomendada de banco (proposta de conversa)

### 3.1 Tabela `catalogo_itens_prt`
Campos sugeridos:
- `id`
- `codigo`
- `categoria`
- `subcategoria`
- `item`
- `descricao_curta`
- `local_obrigatorio`
- `tem_variavel_validade`
- `tem_norma`
- `norma_sp`
- `usar_norma_rj`
- `texto_padrao`
- `ativo`

### 3.2 Tabela `status_padrao`
Campos sugeridos:
- `id`
- `codigo_status`
- `nome_status`

Sugestoes de status na conversa:
- `CONFORME`
- `NAO_CONFORME`
- `EM_MANUTENCAO`
- `SEM_ACESSO`
- `PENDENTE_TESTE`
- `EM_REGULARIZACAO`
- `NAO_SE_APLICA`

### 3.3 Tabela `vistoria_itens`
Campos sugeridos:
- `id`
- `vistoria_id`
- `catalogo_item_id`
- `status`
- `local`
- `mes_ano`
- `observacao_campo`
- `texto_final`
- `foto_obrigatoria`
- `anexo_url`
- `ordem_exibicao`

## 4) Catalogo com padronizacao considerada homologada na conversa
Codigos:
- `SINAL_001`
- `SINAL_002`
- `EXT_001`
- `EXT_002`
- `EXT_003`
- `EXT_004`
- `IE_001`
- `SDAI_001`
- `HID_001`
- `HID_002`
- `HID_003`
- `SHAFT_001`
- `SPK_001`

Todos os detalhes estruturados desses codigos foram materializados em:
- `data/prt_catalog_candidates.json`

## 5) Catalogo recorrente citado (sem frase unica travada)
Grupos:
- SDAI / alarme: `SDAI_010` a `SDAI_020`
- Hidrantes / recalque: `HID_010` a `HID_023`
- Bombas: `BOM_001` a `BOM_005`
- SPK: `SPK_010` a `SPK_013`
- Sinalizacao: `SINAL_010` a `SINAL_013`
- Iluminacao de emergencia: `IE_010` a `IE_012`
- PCF / compartimentacao: `PCF_001` a `PCF_004`
- Escadas / pressurizacao: `ESC_001` a `ESC_002`
- Tubulacao: `TUB_001` a `TUB_002`
- Acesso / obstrucao / condicao operacional: `OPS_001` a `OPS_006`

Todos os detalhes estruturados desses codigos foram materializados em:
- `data/prt_catalog_candidates.json`

## 6) Status citados na conversa
- `CONFORME`
- `NAO_CONFORME`
- `EM_MANUTENCAO`
- `SEM_ACESSO`
- `PENDENTE_TESTE`
- `EM_REGULARIZACAO`
- `NAO_SE_APLICA`

Observacao:
- No MVP atual, nem todos esses status estao homologados como fonte oficial.

## 7) Recomendacao de uso deste material
1. Usar este arquivo como referencia de captura de dominio.
2. Usar `data/prt_catalog_candidates.json` como base de triagem tecnica.
3. Aplicar no produto apenas o que for homologado contra:
   - `docs/prt_rules.md`
   - `data/prt_templates.json`
   - `data/inspection_items.json`

## 8) Diretriz para execucao no Codex
Ao implementar:
- executar por fases (normalizacao -> homologacao -> patch controlado -> testes)
- sem fallback inseguro no relatorio final
- sem acoplar regras PRT direto na UI
- sem alterar textos homologados sem aprovacao explicita
