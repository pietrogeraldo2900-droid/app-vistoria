import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { createStore } from "./store.mjs";
import {
  createAccessToken,
  createId,
  createRefreshToken,
  hashPassword,
  randomHex,
  verifyPassword
} from "./security.mjs";

const nowIso = () => new Date().toISOString();
const TOKEN_EXPIRES_IN_SECONDS = 3600;

const parseBoolean = (value) => value === "true" || value === "1";

const normalizeRole = (value) => {
  if (value === "admin" || value === "inspector" || value === "viewer") {
    return value;
  }
  return "viewer";
};

const normalizeApprovalStatus = (value) => {
  if (value === "approved" || value === "pending" || value === "rejected") {
    return value;
  }
  return "pending";
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const extensionByMime = (mimeType) => {
  if (!mimeType) {
    return ".bin";
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return ".jpg";
  }
  if (mimeType.includes("png")) {
    return ".png";
  }
  if (mimeType.includes("webp")) {
    return ".webp";
  }
  return ".bin";
};

const withoutSecrets = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: normalizeRole(user.role),
  approval_status: normalizeApprovalStatus(user.approval_status),
  created_at: user.created_at,
  approved_at: user.approved_at,
  approved_by_user_id: user.approved_by_user_id ?? null
});

const sendError = (res, status, code, message, details) => {
  res.status(status).json({
    code,
    message,
    details: details ?? {}
  });
};

const readString = (value) => (typeof value === "string" ? value : "");

const ensureNoInspectionBinaryFields = (inspection) => {
  const locations = Array.isArray(inspection.locations) ? inspection.locations : [];

  for (const location of locations) {
    const items = Array.isArray(location.items) ? location.items : [];
    for (const item of items) {
      const photos = Array.isArray(item.photos) ? item.photos : [];
      for (const photo of photos) {
        if (
          Object.prototype.hasOwnProperty.call(photo, "data_url") ||
          Object.prototype.hasOwnProperty.call(photo, "retry_data_available")
        ) {
          return false;
        }
      }
    }
  }

  return true;
};

const normalizeInspectionRecord = (payload, overrideId) => {
  const inspectionId = overrideId || readString(payload.id) || createId("inspection");
  const locations = Array.isArray(payload.locations) ? payload.locations : [];

  return {
    id: inspectionId,
    title: readString(payload.title),
    company_name: readString(payload.company_name),
    unit_name: readString(payload.unit_name),
    address: readString(payload.address),
    city: readString(payload.city),
    client_name: readString(payload.client_name),
    contract_code: readString(payload.contract_code),
    inspection_type:
      readString(payload.inspection_type) || "periodica",
    general_observation: readString(payload.general_observation),
    inspector_name: readString(payload.inspector_name),
    state: payload.state === "RJ" ? "RJ" : "SP",
    inspection_date:
      readString(payload.inspection_date) || new Date().toISOString().slice(0, 10),
    created_at: readString(payload.created_at) || nowIso(),
    updated_at: nowIso(),
    locations: locations.map((location) => ({
      id: readString(location.id) || createId("loc"),
      name: readString(location.name),
      items: (Array.isArray(location.items) ? location.items : []).map((item) => ({
        id: readString(item.id) || createId("item"),
        item_key: readString(item.item_key),
        status: readString(item.status) || "nao_testado",
        field_values:
          item.field_values && typeof item.field_values === "object" ? item.field_values : {},
        generated_text: readString(item.generated_text),
        photos: (Array.isArray(item.photos) ? item.photos : []).map((photo) => ({
          id: readString(photo.id),
          name: readString(photo.name),
          mime_type: readString(photo.mime_type),
          size: typeof photo.size === "number" ? photo.size : 0,
          storage_key: readString(photo.storage_key),
          sync_status:
            photo.sync_status === "pending" || photo.sync_status === "failed"
              ? photo.sync_status
              : "synced",
          sync_error_message: readString(photo.sync_error_message) || undefined
        })),
        created_at: readString(item.created_at) || nowIso()
      }))
    }))
  };
};

export const createApiApp = async (options = {}) => {
  const store = createStore({ dataDir: options.dataDir });
  await store.initialize();

  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Number(process.env.BACKEND_MAX_UPLOAD_BYTES || 10 * 1024 * 1024)
    }
  });

  const corsOrigin = process.env.BACKEND_CORS_ORIGIN || "*";
  const exposeInternalStatus = parseBoolean(process.env.BACKEND_EXPOSE_STATUS || "true");

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", corsOrigin);
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: "8mb" }));

  app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "app-vistoria-backend"
    });
  });

  app.post("/api/v1/auth/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = readString(req.body?.password);

    if (!isValidEmail(email) || password.length < 1) {
      sendError(res, 422, "invalid_payload", "Payload de login invalido.");
      return;
    }

    const db = await store.read();
    const user = db.users.find((entry) => entry.email === email);

    if (!user || user.approval_status !== "approved") {
      sendError(res, 401, "invalid_credentials", "Credenciais invalidas.");
      return;
    }

    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      sendError(res, 401, "invalid_credentials", "Credenciais invalidas.");
      return;
    }

    const accessToken = createAccessToken();
    const refreshToken = createRefreshToken();

    await store.mutate((mutableDb) => {
      mutableDb.sessions = mutableDb.sessions.filter(
        (session) => session.user_id !== user.id
      );
      mutableDb.sessions.push({
        id: createId("session"),
        user_id: user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        created_at: nowIso(),
        expires_in: TOKEN_EXPIRES_IN_SECONDS
      });
    });

    res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: TOKEN_EXPIRES_IN_SECONDS,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: normalizeRole(user.role)
      }
    });
  });

  app.post("/api/v1/auth/refresh", async (req, res) => {
    const refreshToken = readString(req.body?.refresh_token);

    if (!refreshToken) {
      sendError(res, 422, "invalid_payload", "Campo refresh_token e obrigatorio.");
      return;
    }

    const db = await store.read();
    const session = db.sessions.find((entry) => entry.refresh_token === refreshToken);
    if (!session) {
      sendError(res, 401, "invalid_refresh_token", "Refresh token invalido.");
      return;
    }

    const user = db.users.find((entry) => entry.id === session.user_id);
    if (!user || user.approval_status !== "approved") {
      sendError(res, 401, "invalid_refresh_token", "Refresh token invalido.");
      return;
    }

    const nextAccess = createAccessToken();
    const nextRefresh = createRefreshToken();

    await store.mutate((mutableDb) => {
      const target = mutableDb.sessions.find((entry) => entry.id === session.id);
      if (!target) {
        return;
      }

      target.access_token = nextAccess;
      target.refresh_token = nextRefresh;
      target.created_at = nowIso();
      target.expires_in = TOKEN_EXPIRES_IN_SECONDS;
    });

    res.status(200).json({
      access_token: nextAccess,
      refresh_token: nextRefresh,
      expires_in: TOKEN_EXPIRES_IN_SECONDS,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: normalizeRole(user.role)
      }
    });
  });

  app.post("/api/v1/auth/logout", async (req, res) => {
    const refreshToken = readString(req.body?.refresh_token);
    if (!refreshToken) {
      sendError(res, 422, "invalid_payload", "Campo refresh_token e obrigatorio.");
      return;
    }

    await store.mutate((db) => {
      db.sessions = db.sessions.filter((entry) => entry.refresh_token !== refreshToken);
    });

    res.status(204).end();
  });

  app.post("/api/v1/users/register-request", async (req, res) => {
    const fullName = readString(req.body?.full_name).trim();
    const email = normalizeEmail(req.body?.email);
    const password = readString(req.body?.password);

    if (!fullName || !isValidEmail(email) || password.length < 8) {
      sendError(
        res,
        422,
        "invalid_payload",
        "Payload invalido. full_name, email valido e password com minimo de 8 caracteres sao obrigatorios."
      );
      return;
    }

    const existing = (await store.read()).users.find((entry) => entry.email === email);
    if (existing) {
      sendError(res, 409, "user_exists", "Ja existe cadastro para este e-mail.");
      return;
    }

    const salt = randomHex(16);
    const user = {
      id: createId("user"),
      full_name: fullName,
      email,
      password_salt: salt,
      password_hash: hashPassword(password, salt),
      role: "viewer",
      approval_status: "pending",
      created_at: nowIso(),
      approved_at: null,
      approved_by_user_id: null
    };

    await store.mutate((db) => {
      db.users.push(user);
    });

    res.status(201).json({
      id: user.id,
      approval_status: user.approval_status
    });
  });

  app.get("/api/v1/users", async (req, res) => {
    const status = readString(req.query.status);
    const email = normalizeEmail(req.query.email);
    const users = (await store.read()).users;

    let filtered = users;
    if (email) {
      filtered = filtered.filter((entry) => entry.email === email);
    }
    if (status) {
      filtered = filtered.filter((entry) => entry.approval_status === status);
    }

    filtered = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    res.status(200).json({
      items: filtered.map(withoutSecrets)
    });
  });

  app.get("/api/v1/users/:id", async (req, res) => {
    const user = (await store.read()).users.find((entry) => entry.id === req.params.id);
    if (!user) {
      sendError(res, 404, "user_not_found", "Usuario nao encontrado.");
      return;
    }

    res.status(200).json(withoutSecrets(user));
  });

  app.post("/api/v1/users/:id/approve", async (req, res) => {
    const role = normalizeRole(req.body?.role);
    let approvedUser = null;

    await store.mutate((db) => {
      const user = db.users.find((entry) => entry.id === req.params.id);
      if (!user) {
        return;
      }

      user.approval_status = "approved";
      user.role = role;
      user.approved_at = nowIso();
      approvedUser = { ...user };
    });

    if (!approvedUser) {
      sendError(res, 404, "user_not_found", "Usuario nao encontrado.");
      return;
    }

    res.status(200).json(withoutSecrets(approvedUser));
  });

  app.post("/api/v1/users/:id/reject", async (req, res) => {
    let rejectedUser = null;

    await store.mutate((db) => {
      const user = db.users.find((entry) => entry.id === req.params.id);
      if (!user) {
        return;
      }

      user.approval_status = "rejected";
      user.approved_at = nowIso();
      rejectedUser = { ...user };
    });

    if (!rejectedUser) {
      sendError(res, 404, "user_not_found", "Usuario nao encontrado.");
      return;
    }

    res.status(200).json(withoutSecrets(rejectedUser));
  });

  app.patch("/api/v1/users/:id/role", async (req, res) => {
    const role = normalizeRole(req.body?.role);
    let updatedUser = null;

    await store.mutate((db) => {
      const user = db.users.find((entry) => entry.id === req.params.id);
      if (!user) {
        return;
      }

      user.role = role;
      updatedUser = { ...user };
    });

    if (!updatedUser) {
      sendError(res, 404, "user_not_found", "Usuario nao encontrado.");
      return;
    }

    res.status(200).json(withoutSecrets(updatedUser));
  });

  app.get("/api/v1/inspections", async (_req, res) => {
    const inspections = (await store.read()).inspections;
    const ordered = [...inspections].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    res.status(200).json({ items: ordered });
  });

  app.get("/api/v1/inspections/:id", async (req, res) => {
    const inspection = (await store.read()).inspections.find((entry) => entry.id === req.params.id);
    if (!inspection) {
      sendError(res, 404, "inspection_not_found", "Vistoria nao encontrada.");
      return;
    }

    res.status(200).json(inspection);
  });

  app.post("/api/v1/inspections", async (req, res) => {
    if (!ensureNoInspectionBinaryFields(req.body ?? {})) {
      sendError(
        res,
        422,
        "invalid_photo_payload",
        "Payload de inspections deve conter apenas metadados de foto, sem binario/data_url."
      );
      return;
    }

    const input = normalizeInspectionRecord(req.body ?? {});
    const existing = (await store.read()).inspections.find((entry) => entry.id === input.id);
    if (existing) {
      sendError(
        res,
        409,
        "inspection_exists",
        "Ja existe vistoria com este id. Use PUT /inspections/{id}."
      );
      return;
    }

    await store.mutate((db) => {
      db.inspections.push(input);
    });

    res.status(201).json(input);
  });

  app.put("/api/v1/inspections/:id", async (req, res) => {
    if (!ensureNoInspectionBinaryFields(req.body ?? {})) {
      sendError(
        res,
        422,
        "invalid_photo_payload",
        "Payload de inspections deve conter apenas metadados de foto, sem binario/data_url."
      );
      return;
    }

    const inspectionId = req.params.id;
    const current = (await store.read()).inspections.find((entry) => entry.id === inspectionId);
    if (!current) {
      sendError(res, 404, "inspection_not_found", "Vistoria nao encontrada.");
      return;
    }

    const next = normalizeInspectionRecord(req.body ?? {}, inspectionId);
    next.created_at = current.created_at || next.created_at;

    await store.mutate((db) => {
      const index = db.inspections.findIndex((entry) => entry.id === inspectionId);
      if (index >= 0) {
        db.inspections[index] = next;
      }
    });

    res.status(200).json(next);
  });

  app.post("/api/v1/media/photos", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
      sendError(res, 422, "invalid_payload", "Arquivo nao informado em multipart/form-data.");
      return;
    }

    const photoId = createId("photo");
    const extension = extensionByMime(file.mimetype);
    const diskFileName = `${photoId}${extension}`;
    const storageKey = `media/${diskFileName}`;
    const filePath = path.join(store.paths.mediaDir, diskFileName);

    await fs.writeFile(filePath, file.buffer);

    await store.mutate((db) => {
      db.photos.push({
        id: photoId,
        storage_key: storageKey,
        name: file.originalname || diskFileName,
        mime_type: file.mimetype || "application/octet-stream",
        size: file.size,
        file_name: diskFileName,
        created_at: nowIso()
      });
    });

    res.status(201).json({
      id: photoId,
      storage_key: storageKey,
      name: file.originalname || diskFileName,
      mime_type: file.mimetype || "application/octet-stream",
      size: file.size,
      sync_status: "synced"
    });
  });

  app.get("/api/v1/media/photos/:storageKey", async (req, res) => {
    const storageKey = decodeURIComponent(req.params.storageKey);
    const photoMeta = (await store.read()).photos.find(
      (entry) => entry.storage_key === storageKey
    );

    if (!photoMeta) {
      sendError(res, 404, "photo_not_found", "Foto nao encontrada.");
      return;
    }

    const filePath = path.join(store.paths.mediaDir, photoMeta.file_name);

    try {
      const fileBuffer = await fs.readFile(filePath);
      res.setHeader("Content-Type", photoMeta.mime_type || "application/octet-stream");
      res.setHeader("Content-Length", String(fileBuffer.length));
      res.status(200).send(fileBuffer);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        sendError(res, 404, "photo_not_found", "Foto nao encontrada.");
        return;
      }
      throw error;
    }
  });

  app.delete("/api/v1/media/photos/:storageKey", async (req, res) => {
    const storageKey = decodeURIComponent(req.params.storageKey);
    const photoMeta = (await store.read()).photos.find(
      (entry) => entry.storage_key === storageKey
    );

    if (!photoMeta) {
      sendError(res, 404, "photo_not_found", "Foto nao encontrada.");
      return;
    }

    const filePath = path.join(store.paths.mediaDir, photoMeta.file_name);

    await store.mutate((db) => {
      db.photos = db.photos.filter((entry) => entry.storage_key !== storageKey);
    });

    await fs.rm(filePath, { force: true });
    res.status(204).end();
  });

  if (exposeInternalStatus) {
    app.get("/api/v1/_internal/status", async (_req, res) => {
      const db = await store.read();
      res.status(200).json({
        users: db.users.length,
        inspections: db.inspections.length,
        photos: db.photos.length,
        sessions: db.sessions.length
      });
    });
  }

  app.use((error, _req, res, _next) => {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Erro interno inesperado.";
    sendError(res, 500, "internal_error", message);
  });

  return app;
};
