# Arquitetura do MVP

## Objetivo
Implementar um app mobile-first de vistoria tecnica com geracao automatica de PRT a partir de dados estruturados.

## Hierarquia de regras (fonte da verdade)
1. `docs/prt_rules.md`
2. `data/prt_templates.json`
3. `data/inspection_items.json`
4. codigo da aplicacao

## Camadas
- `src/ui`: interface e navegacao (sem regra de geracao textual).
- `src/services`: orquestracao dos casos de uso do MVP.
- `src/prt-engine`: engine de geracao dos textos PRT.
- `src/persistence`: contratos e implementacoes de persistencia.
- `src/export`: exportacao e formatacao do relatorio em PDF.
- `src/domain`: modelos de dados e utilitarios de dominio.
- `backend`: API Node/Express para integracao remota real por fatias.

## Governanca de catalogo candidato de PRT
- `data/prt_catalog_candidates.json` e tratado como base de trabalho para evolucao por fases.
- `src/services/prt-catalog/candidateCatalogService.ts` faz normalizacao tecnica dos candidatos:
  - status mapeados vs status suportados no MVP
  - templates homologados candidatos com formato `Local - texto`
  - deteccao de chaves de template duplicadas
- `src/services/prt-catalog/candidateTemplateMergeService.ts` gera plano de merge:
  - `sameAsOfficial`
  - `pendingConflicts`
  - `approvedConflicts`
  - `pendingCreates`
  - `approvedCreates`
- Regras de seguranca:
  - candidato sem `approved=true` nunca entra em merge aplicado
  - conflito sem aprovacao explicita nao sobrescreve template oficial
  - engine principal continua baseada em `data/prt_templates.json`
- Rotina de homologacao fase 2:
  - `npm run prt:phase2:homologate` aplica patch controlado
  - `npm run prt:phase2:validate` valida aprovacoes, chaves e templates esperados

## Persistencia por contrato
- `src/persistence/contracts`: interfaces de repositorio para auth, vistoria e fotos.
- `src/persistence/local`: implementacoes locais atuais (MVP).
- `src/persistence/remote`: adapters remotos estruturados.
- `src/persistence/factories`: selecao do driver de repositorio (local/remoto).
- `src/persistence/repositoryMode.ts`: chave de modo para rotear local ou remoto.
- `src/infrastructure/http`: base de cliente HTTP e gateway para integracoes server-side.

No estado atual, o app permanece em modo `local` por padrao.
Selecao de modo:
- prioridade 1: `localStorage` (`app-vistoria::repository-mode`)
- prioridade 2: `VITE_REPOSITORY_MODE`
- fallback: `local`
- suporte a override por dominio:
  - `app-vistoria::repository-mode::auth`
  - `app-vistoria::repository-mode::inspection`
  - `app-vistoria::repository-mode::photo`
  - `VITE_REPOSITORY_MODE_AUTH`
  - `VITE_REPOSITORY_MODE_INSPECTION`
  - `VITE_REPOSITORY_MODE_PHOTO`

Adapters remotos no estado atual:
- `inspection`: usa `backendGateway` real para `list`, `getById` e `upsert` (PUT com fallback para POST).
- `photo`: usa `backendGateway` real para `save`, `get` e `remove` via `/media/photos`.
- `auth`: usa `backendGateway` real para `login`, `register-request`, `logout`, `list users`, `approve`, `reject` e `update role`.
- sem `VITE_API_BASE_URL`, o gateway remoto segue bloqueado com erro controlado.
- objetivo: integrar por fatias sem quebrar o MVP local.

Implementacao backend atual (etapa 1):
- `backend/server.mjs`: bootstrap HTTP da API.
- `backend/app.mjs`: rotas REST em `/api/v1`.
- `backend/store.mjs`: persistencia simples em JSON (`.backend-data/db.json`).
- `backend/security.mjs`: hash/salt e tokens de sessao.
- armazenamento de fotos em `.backend-data/media`.

## Fluxo principal do MVP
1. Autenticacao (local por padrao; remota por fatia quando habilitada por modo).
2. Criacao da vistoria.
3. Cadastro de locais e itens por local.
4. Geracao automatica de texto por item na engine.
5. Pre-visualizacao consolidada do relatorio.
6. Historico de vistorias.

## Regras de PRT implementadas
- Busca de template homologado por `item + status + estado (+rule opcional)`.
- Preservacao do texto homologado de `data/prt_templates.json`.
- Placeholder `Local` e `[mes/ano]`.
- Regra de local com prefixo `G` para `Galpao` quando aplicavel.
- Regra geografica via templates homologados:
  - SP com citacao de IT quando existir no template homologado.
  - RJ sem citacao de IT quando assim definido no template homologado.
- Estados especiais (`em_manutencao`, `sem_acesso`, `nao_testado`) com camada secundaria de template.
- Combinacoes sem template homologado viram pendencia tecnica interna e nao entram no texto final do relatorio.

## Persistencia
- Dados da vistoria em `localStorage` (modo local) e API (modo remoto de inspections).
- Fotos locais em IndexedDB para evitar payload alto em `localStorage`.
- Fotos remotas via `/media/photos`, mantendo apenas metadados no agregado de inspections.
- Estrutura preparada para troca futura por API/banco sem acoplar as telas.

## Exportacao PDF
- Camada implementada em `src/export/pdf/pdfExportService.ts`.
- Exportacao real do relatorio consolidado em PDF a partir da tela de previa.
- Exporta somente linhas finais homologadas (sem pendencias tecnicas internas).
- Cabecalho com metadados completos da vistoria e organizacao dos apontamentos por local.
- Evidencias fotograficas em grid 2x2 com dimensao padronizada e legenda por foto.
- Fotos com `syncStatus` diferente de `synced` ficam fora da evidencia final e entram em secao de pendencias de evidencia fotografica.

## Modelo enriquecido da vistoria
Campos adicionais do cadastro:
- unidade
- endereco
- cidade
- cliente / contratante
- contrato / OS
- tipo de vistoria
- observacao geral

## Operacao do editor
- Edicao e exclusao de locais.
- Edicao e exclusao de itens.
- Remocao de fotos por item.
- Bloqueio de duplicidades basicas para local e item no mesmo contexto.

## Operacao de demonstracao comercial
- `src/services/demo/demoSetupService.ts` prepara base de apresentacao com 1 clique no Dashboard.
- O seed de demo e bloqueado fora de `inspection/photo` em modo local para evitar comportamento ambiguo em ambiente remoto.
- O fluxo de demo nao altera regras da engine PRT; apenas monta dados de exemplo coerentes para apresentacao.

## Blindagem e validacao tecnica
- `inspectionValidationService` valida item/status por regra tecnica antes de salvar.
- Bloqueio de `conforme` sem criterios minimos.
- Bloqueio de combinacoes incoerentes de `nao_conforme` sem evidencia de falha.
- Bloqueio de combinacao sem template homologado para evitar pendencia no texto final.

## Testes automatizados
- `src/prt-engine/prtEngine.test.ts`
- `src/services/inspection/inspectionValidationService.test.ts`
- `src/prt-engine/locationNormalizer.test.ts`
- `src/export/pdf/pdfExportService.test.ts`
- `src/persistence/remote/remoteInspectionRepository.test.ts`
- `src/persistence/remote/remotePhotoRepository.test.ts`

## Autenticacao e acesso
- Fluxo local do MVP com cadastro, aprovacao e perfil.
- Perfis suportados: `admin`, `inspector`, `viewer`.
- Guardas de rota por perfil em `src/App.tsx`.
- Integracao remota de auth ativa para `login`, `register-request`, `logout`, aprovacao/rejeicao e alteracao de perfil.
- Sem fallback silencioso em falha de auth remota (erro explicito na UI).
- Detalhes em `docs/auth_architecture.md`.

## Contratos de API para migracao futura
- Contratos esperados documentados em `docs/api_contracts.md` para:
  - autenticacao
  - usuarios/acessos
  - vistorias
  - fotos

## Sprint atual - fechamento do ciclo de retry de fotos remotas
- `inspectionService.retryPhotoSync` usa como fonte principal o repositorio local de retry.
- `photo.dataUrl` permanece apenas como compatibilidade legada (fonte secundaria).
- UI diferencia:
  - pendente/falha com dado local disponivel para reenvio
  - pendente/falha sem dado local (reanexar necessario)
- Contrato remoto de `inspections` permanece apenas com metadados de foto (sem binario e sem estado local de retry).

## Sprint atual - primeira integracao real (auth)
- `remoteAuthRepository` conectado ao `backendGateway` para:
  - `POST /auth/login`
  - `POST /users/register-request`
  - `POST /auth/logout`
- `GET /users?status=...` para listagem remota por status.
- `POST /users/{id}/approve` para aprovacao.
- `POST /users/{id}/reject` para rejeicao.
- `PATCH /users/{id}/role` para alteracao de perfil.
- Sessao remota suporta metadados de token (`authMode`, `accessToken`, `refreshToken`, `expiresIn`).
- `authService` opera por modo:
  - `local`: bootstrap admin, cadastro/aprovacao/login locais
  - `remote`: login/cadastro/logout e gestao de acessos remotos
- Em falha no logout remoto, o app nao conclui logout local silenciosamente.
