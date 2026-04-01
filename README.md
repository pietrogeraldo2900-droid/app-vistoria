# App de Vistoria Tecnica (MVP)

Aplicativo mobile-first para vistoria tecnica com geracao automatica de textos PRT com base em regras homologadas.

## Requisitos
- Node.js 20+
- npm 10+

## Como rodar localmente
```bash
npm install
npm run dev
```

Abra: [http://localhost:5173](http://localhost:5173)

## Backend de integracao remota (etapa 1 real)
Foi adicionada uma API Node/Express em `backend/` com contratos de:
- auth (`/auth/login`, `/auth/refresh`, `/auth/logout`)
- users/acessos (`/users/register-request`, `/users`, `/users/{id}`, `/approve`, `/reject`, `/role`)
- inspections agregadas (`/inspections`, `/inspections/{id}`)
- photos binarias (`/media/photos`)

Rodar frontend + backend local:
1. terminal A:
```bash
npm run backend:dev
```
2. terminal B:
```bash
npm run dev
```

Para testar frontend em modo remoto local, ajuste `.env`:
```env
VITE_REPOSITORY_MODE=remote
VITE_REPOSITORY_MODE_AUTH=remote
VITE_REPOSITORY_MODE_INSPECTION=remote
VITE_REPOSITORY_MODE_PHOTO=remote
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Credencial bootstrap do backend local:
- E-mail: `admin@app-vistoria.local`
- Senha: `Admin@123`

## Modo apresentacao (cliente)
Para preparar uma demonstracao previsivel:

1. rode o app em modo local (`inspection` e `photo` em `local`)
2. faca login como admin
3. no Dashboard, clique em `Preparar demo`
4. execute o roteiro em `docs/demo_playbook.md`

O botao `Preparar demo` recarrega uma base padrao de apresentacao com:
- 3 vistorias
- locais e itens com combinacoes homologadas
- fotos sincronizadas para evidencia no PDF

Validacao rapida antes da reuniao:
```bash
npm run demo:check
```

## Autenticacao e controle de acesso
- Autenticacao local por e-mail e senha (MVP)
- Solicitacao de cadastro com aprovacao administrativa
- Perfis: `admin`, `inspector`, `viewer`
- Persistencia local no navegador (`localStorage`) para o MVP

Importante:
- Esta autenticacao e apenas para o MVP local e **nao** representa seguranca real de producao.
- Hash/salt de senha, sessao e aprovacao estao no cliente para validacao de fluxo.
- Producao exige backend com identidade centralizada, sessao/token server-side, auditoria e politicas de seguranca.

Acesso inicial de bootstrap local (somente primeiro setup do ambiente):
- E-mail: `admin@app-vistoria.local`
- Senha: `Admin@123`

Fluxo:
1. Usuario solicita cadastro em `Solicitar cadastro`
2. Admin acessa menu `Acessos` e aprova/rejeita
3. Usuario aprovado acessa o sistema conforme o perfil

## Metadados enriquecidos da vistoria (MVP local)
Novos campos no cadastro/edicao:
- unidade
- endereco
- cidade
- cliente / contratante
- contrato / OS
- tipo de vistoria
- observacao geral

## Build de producao
```bash
npm run build
npm run preview
```

## Testes automatizados
```bash
npm run test
```

Modo interativo:
```bash
npm run test:watch
```

Cobertura atual de regra de negocio:
- `prtEngine`
- `inspectionValidationService`
- normalizacao de local (`locationNormalizer`)

## Estrutura principal
- `docs/`: regras de PRT e documentacao de arquitetura.
- `data/`: itens de inspecao e templates homologados.
- `src/`: codigo da aplicacao em camadas.

Playbook comercial:
- `docs/demo_playbook.md`

## Preparacao para migracao futura a backend
- Repositorios orientados por contrato em `src/persistence/contracts`
- Implementacoes locais em `src/persistence/local`
- Adapters remotos estruturados em `src/persistence/remote`
- Fabrica de selecao em `src/persistence/factories`
- Seletor de modo em `src/persistence/repositoryMode.ts`
- Base de gateway HTTP em `src/infrastructure/http`
- Contratos HTTP esperados em `docs/api_contracts.md`

Configuracao de pre-integracao (sem API real):
- `VITE_REPOSITORY_MODE=local|remote` (padrao: `local`)
- `VITE_REPOSITORY_MODE_AUTH=local|remote` (opcional)
- `VITE_REPOSITORY_MODE_INSPECTION=local|remote` (opcional)
- `VITE_REPOSITORY_MODE_PHOTO=local|remote` (opcional)
- `VITE_API_BASE_URL=https://...` (necessario para ativar adapters remotos)
- `VITE_API_TIMEOUT_MS=15000` (opcional)

Comportamento atual em `remote`:
- `inspections`: primeira fatia integrada via `backendGateway` (`list`, `getById`, `upsert`)
- contrato remoto de `inspections` padronizado em modelo agregado (`PUT /inspections/{id}` + fallback `POST /inspections`)
- `photos`: integracao remota real via `/media/photos` (`upload`, `download`, `delete`)
- `auth`: integracao remota via `backendGateway` (`login`, `register-request`, `logout`, `list users`, `approve`, `reject`, `update role`)
- sem `VITE_API_BASE_URL`: erro controlado de gateway nao configurado

Estados de sincronizacao de foto no fluxo hibrido:
- `synced`: foto enviada e referenciada por `storage_key`
- `pending`: falha transiente no upload remoto (ex.: timeout)
- `failed`: falha definitiva de upload remoto ou armazenamento local

Regra de consistencia em remocao de foto:
- adotado modo de consistencia forte
- se a remocao remota falhar, a exclusao do registro e cancelada com aviso ao usuario

Rollout controlado recomendado:
- manter `VITE_REPOSITORY_MODE=local`
- habilitar apenas `VITE_REPOSITORY_MODE_INSPECTION=remote`
- para reduzir inconsistencia de storage, habilitar junto `VITE_REPOSITORY_MODE_PHOTO=remote`

## Persistencia no MVP
- Dados da vistoria: `localStorage`
- Fotos: `IndexedDB` (evita armazenar base64 grande no `localStorage`)

## Exportacao PDF do relatorio consolidado
1. Execute `npm run dev`
2. Abra uma vistoria e acesse `Pre-visualizacao do relatorio`
3. Clique em `Exportar PDF`

Regra da exportacao:
- somente linhas finais homologadas entram no PDF
- pendencias tecnicas internas nao entram no texto final exportado
- metadados enriquecidos da vistoria aparecem no cabecalho tecnico do PDF
- apontamentos finais sao agrupados por local para leitura operacional
- evidencias fotograficas entram em grid padronizado 2x2 com legenda (`Local | Item | Status | Data`)
- fotos `pending` ou `failed` nao entram como evidencia final; entram em secao de pendencias de evidencia fotografica

## Pacote de auditoria
Gerar pacote limpo para auditoria tecnica:

```bash
npm run audit:pack
```

Alternativas:
- Node mantendo pasta temporaria: `npm run audit:pack:node`
- PowerShell mantendo pasta temporaria: `npm run audit:pack:ps`

Saida padrao:
- zip em `audit_out/audit_bundle_YYYY-MM-DD_HH-mm.zip`
- manifesto em `audit_manifest.txt` dentro do zip
