# Contratos de API Esperados (Preparacao para Backend)

## Objetivo
Definir os contratos HTTP esperados para a futura migracao de persistencia e autenticacao para backend, sem remover o funcionamento local do MVP.

## Convencoes gerais
- Base URL sugerida: `/api/v1`
- Formato: `application/json`
- Datas: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- Erros: objeto padrao com `code`, `message` e `details` opcional

Exemplo de erro:
```json
{
  "code": "invalid_credentials",
  "message": "Credenciais invalidas.",
  "details": {}
}
```

## 1. Autenticacao

### POST `/auth/login`
Request:
```json
{
  "email": "inspetor@empresa.com.br",
  "password": "senha"
}
```

Response 200:
```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "expires_in": 3600,
  "user": {
    "id": "user_123",
    "full_name": "Inspetor",
    "email": "inspetor@empresa.com.br",
    "role": "inspector"
  }
}
```

### POST `/auth/refresh`
Request:
```json
{
  "refresh_token": "jwt-refresh-token"
}
```

Response 200: mesmo contrato de `/auth/login`.

### POST `/auth/logout`
Request:
```json
{
  "refresh_token": "jwt-refresh-token"
}
```

Response 204 sem corpo.

## 2. Usuarios e Acessos

### POST `/users/register-request`
Request:
```json
{
  "full_name": "Novo Usuario",
  "email": "novo@empresa.com.br",
  "password": "senha-forte"
}
```

Response 201:
```json
{
  "id": "user_456",
  "approval_status": "pending"
}
```

### GET `/users?status=pending|approved|rejected`
Response 200:
```json
{
  "items": [
    {
      "id": "user_456",
      "full_name": "Novo Usuario",
      "email": "novo@empresa.com.br",
      "role": "viewer",
      "approval_status": "pending",
      "created_at": "2026-03-31T11:00:00.000Z"
    }
  ]
}
```

### POST `/users/{id}/approve`
Request:
```json
{
  "role": "inspector"
}
```

Response 200: usuario atualizado com `approval_status = approved`.

### POST `/users/{id}/reject`
Response 200: usuario atualizado com `approval_status = rejected`.

### PATCH `/users/{id}/role`
Request:
```json
{
  "role": "admin"
}
```

Response 200: usuario atualizado com novo perfil.

## 3. Vistorias

### Modelo escolhido nesta fase: agregado
- Nesta sprint, o contrato remoto de `inspections` adota **modelo agregado**.
- O backend recebe e retorna a vistoria com estrutura completa (`locations`, `items`, `photos` como metadados).
- O cliente atual nao usa endpoints granulares de `locations/items` para persistencia remota.
- Objetivo: reduzir divergencia com a arquitetura atual do MVP, que salva o agregado completo via repositorio.

### GET `/inspections`
Response 200:
```json
{
  "items": [
    {
      "id": "inspection_1",
      "title": "Vistoria mensal",
      "company_name": "Empresa",
      "unit_name": "Unidade Centro",
      "address": "Rua 1, 100",
      "city": "Sao Paulo",
      "client_name": "Cliente XPTO",
      "contract_code": "CTR-100",
      "inspection_type": "periodica",
      "general_observation": "",
      "inspector_name": "Inspetor",
      "state": "SP",
      "inspection_date": "2026-03-31",
      "created_at": "2026-03-31T11:00:00.000Z",
      "updated_at": "2026-03-31T11:00:00.000Z",
      "locations": [
        {
          "id": "loc_1",
          "name": "G1",
          "items": [
            {
              "id": "item_1",
              "item_key": "extintor",
              "status": "conforme",
              "field_values": {
                "lacrado": "sim"
              },
              "generated_text": "Galpao 1 - Os extintores estao em conformidade...",
              "created_at": "2026-03-31T11:00:00.000Z",
              "photos": [
                {
                  "id": "photo_1",
                  "name": "foto.jpg",
                  "mime_type": "image/jpeg",
                  "size": 123456,
                  "storage_key": "media/photo_1"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### POST `/inspections`
Request: mesmo shape agregado da vistoria (podendo incluir `locations/items/photos`).
Response 201: vistoria criada.

### GET `/inspections/{id}`
Response 200: vistoria agregada completa com `locations`, `items` e `photos` (metadados).

### PUT `/inspections/{id}`
Request: vistoria agregada completa (mesmo contrato da criacao, incluindo estrutura de `locations/items/photos` quando existir).
Response 200: vistoria atualizada.

### Estrategia de upsert usada pelo cliente atual
- O app usa:
  1. `PUT /inspections/{id}`
  2. se retornar `404`, fallback para `POST /inspections`
- Isso permite rollout remoto de `inspections` sem quebrar o modo local.

### Endpoints granulares (futuro)
- Endpoints separados para `locations` e `items` podem ser introduzidos depois.
- Nao fazem parte do contrato remoto ativo desta fase do cliente.

## 4. Fotos

### Status de integracao atual no cliente
- Nesta sprint, os endpoints de `media/photos` passam a ser usados de forma remota real.
- Operacoes ativas no app:
  - upload
  - download
  - remocao
- `auth` ja possui integracao remota para `login`, `register-request`, `logout`, `list users`, `approve`, `reject` e `update role`.

### POST `/media/photos`
Upload: `multipart/form-data` com campo `file`.

Response 201:
```json
{
  "id": "photo_1",
  "storage_key": "media/photo_1",
  "name": "foto.jpg",
  "mime_type": "image/jpeg",
  "size": 123456,
  "sync_status": "synced"
}
```

### GET `/media/photos/{storage_key}`
Response 200: blob binario.

### DELETE `/media/photos/{storage_key}`
Response 204.

### Relacao com o modelo agregado de inspections
- No agregado de `inspections`, o campo `photos` carrega apenas metadados (`id`, `name`, `mime_type`, `size`, `storage_key`).
- O cliente tambem suporta metadados de sincronizacao (`sync_status`, `sync_error_message`) para modo hibrido.
- Binario de imagem continua fora de `inspections`, via endpoints de `media/photos`.
- Estado local de retry (`retryDataAvailable` e cache local de blob) e interno do cliente e nao faz parte do contrato HTTP.
- Isso evita payload excessivo em `inspections` e facilita futura troca de provider de storage.

## 5. Regras de integracao com PRT
- Backend nao deve gerar texto livre para relatorio.
- Fluxo esperado continua baseado em item + status + campos complementares.
- Pendencias tecnicas internas devem permanecer fora do texto final consolidado.
