import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "./app.mjs";

const createInspectionPayload = (id = "inspection_1") => ({
  id,
  title: "Vistoria mensal",
  company_name: "Empresa Atlas",
  unit_name: "Unidade Centro",
  address: "Rua A, 100",
  city: "Sao Paulo",
  client_name: "Cliente XPTO",
  contract_code: "CTR-01",
  inspection_type: "periodica",
  general_observation: "",
  inspector_name: "Inspetor 1",
  state: "SP",
  inspection_date: "2026-03-31",
  created_at: "2026-03-31T11:00:00.000Z",
  updated_at: "2026-03-31T11:00:00.000Z",
  locations: [
    {
      id: "loc_1",
      name: "G1",
      items: [
        {
          id: "item_1",
          item_key: "extintor",
          status: "conforme",
          field_values: {
            lacrado: "sim"
          },
          generated_text: "Galpao 1 - Os extintores estao em conformidade.",
          created_at: "2026-03-31T11:00:00.000Z",
          photos: [
            {
              id: "photo_meta_1",
              name: "foto.jpg",
              mime_type: "image/jpeg",
              size: 123,
              storage_key: "media/photo_meta_1",
              sync_status: "synced"
            }
          ]
        }
      ]
    }
  ]
});

describe("backend api", () => {
  let app;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-vistoria-backend-"));
    app = await createApiApp({ dataDir: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("executa fluxo basico de auth remoto", async () => {
    const loginAdmin = await request(app).post("/api/v1/auth/login").send({
      email: "admin@app-vistoria.local",
      password: "Admin@123"
    });

    expect(loginAdmin.status).toBe(200);
    expect(loginAdmin.body.user.email).toBe("admin@app-vistoria.local");
    expect(loginAdmin.body.refresh_token).toBeTypeOf("string");

    const register = await request(app).post("/api/v1/users/register-request").send({
      full_name: "Usuario Demo",
      email: "usuario.demo@empresa.com.br",
      password: "Senha@123"
    });

    expect(register.status).toBe(201);
    expect(register.body.approval_status).toBe("pending");

    const listPending = await request(app).get("/api/v1/users?status=pending");
    expect(listPending.status).toBe(200);
    expect(listPending.body.items.some((entry) => entry.id === register.body.id)).toBe(true);

    const approve = await request(app).post(`/api/v1/users/${register.body.id}/approve`).send({
      role: "inspector"
    });
    expect(approve.status).toBe(200);
    expect(approve.body.approval_status).toBe("approved");
    expect(approve.body.role).toBe("inspector");

    const loginUser = await request(app).post("/api/v1/auth/login").send({
      email: "usuario.demo@empresa.com.br",
      password: "Senha@123"
    });

    expect(loginUser.status).toBe(200);
    expect(loginUser.body.user.role).toBe("inspector");
  });

  it("mantem contrato agregado de inspections com validacao sem binario", async () => {
    const putNotFound = await request(app).put("/api/v1/inspections/inspection_x").send(
      createInspectionPayload("inspection_x")
    );
    expect(putNotFound.status).toBe(404);

    const createResponse = await request(app)
      .post("/api/v1/inspections")
      .send(createInspectionPayload("inspection_1"));
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBe("inspection_1");

    const listResponse = await request(app).get("/api/v1/inspections");
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.items)).toBe(true);
    expect(listResponse.body.items).toHaveLength(1);

    const updatePayload = createInspectionPayload("inspection_1");
    updatePayload.title = "Vistoria mensal atualizada";
    const updateResponse = await request(app)
      .put("/api/v1/inspections/inspection_1")
      .send(updatePayload);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.title).toBe("Vistoria mensal atualizada");

    const invalidPayload = createInspectionPayload("inspection_2");
    invalidPayload.locations[0].items[0].photos[0].data_url = "data:image/jpeg;base64,abc";
    const invalidResponse = await request(app).post("/api/v1/inspections").send(invalidPayload);
    expect(invalidResponse.status).toBe(422);
    expect(invalidResponse.body.code).toBe("invalid_photo_payload");
  });

  it("faz upload, download e remocao de foto remota", async () => {
    const uploadResponse = await request(app)
      .post("/api/v1/media/photos")
      .attach("file", Buffer.from("conteudo-foto-demo"), {
        filename: "evidencia.jpg",
        contentType: "image/jpeg"
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.storage_key).toBeTypeOf("string");

    const encodedStorageKey = encodeURIComponent(uploadResponse.body.storage_key);
    const downloadResponse = await request(app).get(`/api/v1/media/photos/${encodedStorageKey}`);
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("image/jpeg");

    const deleteResponse = await request(app).delete(
      `/api/v1/media/photos/${encodedStorageKey}`
    );
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await request(app).get(`/api/v1/media/photos/${encodedStorageKey}`);
    expect(afterDelete.status).toBe(404);
  });
});
