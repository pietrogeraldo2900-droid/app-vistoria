# Plano de Homologacao dos Conflitos PRT (ZIP x Base Oficial)

## Contexto
Este plano cobre os 8 conflitos identificados em `tmp_prt_docs_codex/normalized/prt_merge_suggested.md`.

A prioridade de fonte da verdade permanece:
1. `docs/prt_rules.md`
2. `data/prt_templates.json`
3. `data/inspection_items.json`
4. codigo da aplicacao

## Decisao geral
- Quando houver conflito entre o ZIP e `data/prt_templates.json`, usar o texto homologado de `docs/prt_rules.md`.
- Nao alterar regras de negocio na UI.
- Nao introduzir fallback inseguro no relatorio final.

## Matriz de homologacao (8 conflitos)

| Codigo | Item | Status | Rule | Referencia oficial | Acao proposta |
|---|---|---|---|---|---|
| SINAL_001 | sinalizacao | nao_conforme | sinalizacao_generica | `docs/prt_rules.md` secao 7.2 | Atualizar template SP/RJ para o texto homologado exato da secao 7.2. |
| SINAL_002 | sinalizacao | nao_conforme | sinalizacao_extintor_po | `docs/prt_rules.md` secao 7.3 | Criar/ajustar template SP/RJ por `rule` para o texto homologado exato da secao 7.3. |
| EXT_003 | extintor | conforme | validade_vigente | `docs/prt_rules.md` secao 7.8 | Criar template por `rule` com placeholder `[mes/ano]`, sem sobrescrever o template geral de conformidade do extintor. |
| EXT_004 | extintor | nao_conforme | validade_vencida | `docs/prt_rules.md` secao 7.9 | Criar template por `rule` com placeholder `[mes/ano]` para vencimento. |
| IE_001 | iluminacao_emergencia | conforme | - | `docs/prt_rules.md` secao 7.11 | Atualizar template SP/RJ para texto homologado exato da secao 7.11. |
| HID_001 | hidrante | nao_conforme | abrigo_incompleto | `docs/prt_rules.md` secao 7.4 | Atualizar template SP/RJ para texto homologado exato da secao 7.4. |
| HID_003 | hidrante | conforme | mangueira_teste_hidrostatico_valido | `docs/prt_rules.md` secao 7.10 | Criar template por `rule` com placeholder `[mes/ano]`, mantendo o template geral de conformidade do hidrante. |
| SPK_001 | spk | nao_conforme | spk_detector_fumaca | `docs/prt_rules.md` secao 7.12 | Atualizar template SP/RJ para incluir SPK + detector de fumaca conforme secao 7.12. |

## Regras de implementacao para a proxima etapa
1. Alterar apenas as entradas necessarias em `data/prt_templates.json`.
2. Manter formato final `Local - texto`.
3. Garantir SP com IT e RJ sem IT nos casos previstos.
4. Preservar placeholders homologados (`[mes/ano]`).
5. Manter `remoteInspectionRepository` sem binario no payload agregado de inspections.
6. Nao alterar `data/inspection_items.json` nesta etapa.

## Testes minimos obrigatorios apos aplicar o patch
1. Geracao para os 8 casos conflitantes (SP/RJ).
2. Resolucao por `rule` para:
   - `sinalizacao_extintor_po`
   - `validade_vigente`
   - `validade_vencida`
   - `mangueira_teste_hidrostatico_valido`
   - `spk_detector_fumaca`
3. Garantia de ausencia de fallback inseguro no texto final.

## Entrega desta fase
- Este arquivo documenta a homologacao item a item.
- Nenhum template oficial foi alterado nesta fase.
