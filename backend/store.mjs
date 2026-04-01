import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword, randomHex } from "./security.mjs";

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".backend-data");
const DEFAULT_DB_FILE = "db.json";
const DEFAULT_MEDIA_DIR = "media";

const nowIso = () => new Date().toISOString();

const createDefaultDatabase = () => ({
  users: [],
  sessions: [],
  inspections: [],
  photos: []
});

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const parseJsonFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultDatabase();
    }

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      inspections: Array.isArray(parsed.inspections) ? parsed.inspections : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos : []
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultDatabase();
    }
    throw error;
  }
};

const writeJsonFile = async (filePath, payload) => {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
};

export const createStore = (options = {}) => {
  const dataDir = options.dataDir || process.env.BACKEND_DATA_DIR || DEFAULT_DATA_DIR;
  const dbPath = path.join(dataDir, DEFAULT_DB_FILE);
  const mediaDir = path.join(dataDir, DEFAULT_MEDIA_DIR);
  const adminName = process.env.BACKEND_BOOTSTRAP_ADMIN_NAME || "Administrador do Sistema";
  const adminEmail = (process.env.BACKEND_BOOTSTRAP_ADMIN_EMAIL || "admin@app-vistoria.local")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.BACKEND_BOOTSTRAP_ADMIN_PASSWORD || "Admin@123";

  let mutationChain = Promise.resolve();

  const initialize = async () => {
    await ensureDirectory(dataDir);
    await ensureDirectory(mediaDir);

    const current = await parseJsonFile(dbPath);
    const hasAdmin = current.users.some((user) => user.email === adminEmail);

    if (!hasAdmin) {
      const salt = randomHex(16);
      current.users.push({
        id: `user_${randomHex(8)}`,
        full_name: adminName,
        email: adminEmail,
        password_salt: salt,
        password_hash: hashPassword(adminPassword, salt),
        role: "admin",
        approval_status: "approved",
        created_at: nowIso(),
        approved_at: nowIso(),
        approved_by_user_id: null
      });
      await writeJsonFile(dbPath, current);
    }
  };

  const read = async () => parseJsonFile(dbPath);

  const mutate = async (mutator) => {
    const runMutation = mutationChain.then(async () => {
      const db = await parseJsonFile(dbPath);
      const result = await mutator(db);
      await writeJsonFile(dbPath, db);
      return result;
    });

    mutationChain = runMutation.catch(() => undefined);
    return runMutation;
  };

  return {
    paths: {
      dataDir,
      dbPath,
      mediaDir
    },
    initialize,
    read,
    mutate
  };
};
