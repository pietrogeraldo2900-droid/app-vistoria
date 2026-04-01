# Arquitetura de Autenticacao e Controle de Acesso

## Objetivo
Evoluir o MVP de autenticacao local para uma arquitetura preparada para backend, mantendo modo local funcional e comutacao controlada para modo remoto.

## Camadas
- `src/ui`: telas de login/cadastro e controle de acessos.
- `src/services/auth`: regras de autenticacao, aprovacao e autorizacao.
- `src/persistence/contracts/authRepositoryContract.ts`: contrato de repositorio.
- `src/persistence/local/localAuthRepository.ts`: implementacao local atual.
- `src/persistence/remote/remoteAuthRepository.ts`: integracao remota por fatia.
- `src/domain/types/auth.ts`: contratos de dados de autenticacao.

## Modelagem principal
- `AuthUser`: usuario persistido com hash de senha, status de aprovacao e perfil (modo local).
- `UserSession`: sessao ativa com `userId`, `fullName`, `email`, `role`, `loginAt` e metadados opcionais de remoto.
- `UserRole`: `admin`, `inspector`, `viewer`.
- `UserApprovalStatus`: `pending`, `approved`, `rejected`.

Campos de sessao remota:
- `authMode`: `local | remote`
- `accessToken`
- `refreshToken`
- `expiresIn`

## Modo local (MVP)
1. Usuario solicita cadastro em `LoginPage`.
2. `authService.register` grava usuario como `pending`.
3. Admin acessa `Acessos` e aprova/rejeita cadastro.
4. Usuario aprovado autentica via `authService.login`.
5. Sessao e usuarios ficam em `localStorage`, com senha em hash + salt.

## Modo remoto (fatia atual)
Operacoes ja integradas:
- `POST /auth/login`
- `POST /users/register-request`
- `POST /auth/logout`
- `GET /users?status=...`
- `POST /users/{id}/approve`
- `POST /users/{id}/reject`
- `PATCH /users/{id}/role`

Comportamento:
- `authService.login` no modo remoto delega para `remoteAuthRepository`.
- `authService.register` no modo remoto envia solicitacao remota.
- `authService.logout` no modo remoto exige `refreshToken` e faz chamada remota antes de limpar sessao local.
- sem `VITE_API_BASE_URL`, o gateway remoto gera erro controlado explicito.
- implementacao local de referencia em `backend/` para testes de integracao sem depender de API externa.

Operacoes ainda locais nesta fase:
- bootstrap inicial do admin do MVP
- armazenamento local de sessao

No modo remoto, a tela `Acessos` opera por chamadas HTTP reais, mantendo validacoes de sessao admin no `authService`.

## Perfis e permissoes
- `admin`: cria/edita vistoria, visualiza e gerencia usuarios.
- `inspector`: cria/edita vistoria e visualiza relatorios.
- `viewer`: somente visualizacao (dashboard, historico, previa).

## Protecao de rotas
Protecao em `src/App.tsx`:
- rota privada exige sessao ativa.
- rotas sensiveis usam role guard:
  - `/inspection/new`: admin ou inspector
  - `/inspection/:id/edit`: admin ou inspector
  - `/access/users`: admin
- acesso indevido redireciona para `/access-denied`.

## Sessao e UX de falha
- Logout remoto nao usa fallback silencioso.
- Se o logout remoto falhar, a UI exibe erro explicito e mantem sessao ativa.
- Dica de credencial bootstrap local aparece apenas quando auth esta em modo local.

## Estrategia de migracao futura
1. Expandir auth remoto para refresh de token.
2. Mover validacoes sensiveis de perfil para server-side.
3. Substituir bootstrap local por bootstrap/seed de ambiente controlado em backend.

## Configuracao por modo
- `VITE_REPOSITORY_MODE_AUTH=local|remote`
- fallback por dominio: `repositoryMode.getFor("auth")`
- default do sistema: `local`
