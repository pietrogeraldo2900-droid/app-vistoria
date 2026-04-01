import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const keepTemp = args.includes("--keep-temp");
const projectRootArg = args.find((arg) => arg.startsWith("--project-root="));
const projectRoot = projectRootArg
  ? path.resolve(projectRootArg.split("=").slice(1).join("="))
  : path.resolve(__dirname, "..");
const projectRootSafeLabel = path.basename(projectRoot) || "[redacted]";

const now = new Date();
const two = (value) => String(value).padStart(2, "0");
const timestamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}_${two(now.getHours())}-${two(now.getMinutes())}`;
const bundleName = `audit_bundle_${timestamp}.zip`;
const outputRoot = path.join(projectRoot, "audit_out");
const tempRoot = path.join(outputRoot, `tmp_${timestamp}`);
const zipPath = path.join(outputRoot, bundleName);

const rootFiles = new Set([
  "AGENTS.md",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "index.html",
  ".gitignore"
]);

const includeDirs = ["docs", "data", "src", "scripts", "backend"];

const excludedDirNames = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".vite",
  "coverage",
  ".cache",
  "cache",
  "logs",
  "log"
]);

const excludedFilePatterns = [
  "*.env",
  "*.env.*",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.cache",
  "*.pid",
  "*.bak",
  "*.swp",
  "*.swo",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "pnpm-debug.log*"
];

const excludedSecretPatterns = [
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "*.crt",
  "*.cer",
  "*.secret",
  "*.secrets",
  "*.token",
  "secrets.*",
  "id_rsa",
  "id_rsa.*",
  "id_dsa",
  "id_dsa.*"
];

const excludedBinaryExtensions = new Set([
  ".zip",
  ".7z",
  ".rar",
  ".gz",
  ".tar",
  ".bin",
  ".dll",
  ".exe",
  ".iso",
  ".dmg",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv"
]);

const maxFileSizeBytes = 10 * 1024 * 1024;

const toPosix = (inputPath) => inputPath.split(path.sep).join("/");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patternToRegex = (pattern) => {
  const escaped = pattern
    .split("*")
    .map((part) => escapeRegex(part))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i");
};

const wildcardRegexes = [...excludedFilePatterns, ...excludedSecretPatterns].map(
  (pattern) => patternToRegex(pattern)
);

const pathRelativeToRoot = (absolutePath) =>
  toPosix(path.relative(projectRoot, absolutePath));

const isExcludedByDir = (relativePath) => {
  const segments = relativePath.split("/");
  return segments.some((segment) => excludedDirNames.has(segment.toLowerCase()));
};

const isExcludedByPattern = (fileName) =>
  wildcardRegexes.some((regex) => regex.test(fileName));

const isExcludedByBinaryPolicy = (filePath, stat) => {
  const extension = path.extname(filePath).toLowerCase();
  if (excludedBinaryExtensions.has(extension) && stat.size > 1024 * 1024) {
    return true;
  }
  return stat.size > maxFileSizeBytes;
};

const shouldIncludeFile = (filePath, stat) => {
  const relative = pathRelativeToRoot(filePath);
  const fileName = path.basename(filePath);
  if (isExcludedByDir(relative)) {
    return false;
  }
  if (isExcludedByPattern(fileName)) {
    return false;
  }
  if (isExcludedByBinaryPolicy(filePath, stat)) {
    return false;
  }
  return true;
};

const ensureDir = async (targetPath) => {
  await fsp.mkdir(targetPath, { recursive: true });
};

const removeIfExists = async (targetPath) => {
  try {
    await fsp.rm(targetPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
};

const exists = async (targetPath) => {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const collectFilesRecursively = async (directoryPath) => {
  const output = [];
  const entries = await fsp.readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(fullPath);
      output.push(...nested);
    } else if (entry.isFile()) {
      output.push(fullPath);
    }
  }
  return output;
};

const copyIntoTemp = async (sourcePath) => {
  const relative = pathRelativeToRoot(sourcePath);
  const destination = path.join(tempRoot, relative);
  await ensureDir(path.dirname(destination));
  await fsp.copyFile(sourcePath, destination);
  return relative;
};

const addViteConfigFiles = async () => {
  const entries = await fsp.readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith("vite.config.")) {
      rootFiles.add(entry.name);
    }
  }
};

const includePublicIfNeeded = async () => {
  const publicPath = path.join(projectRoot, "public");
  if (!(await exists(publicPath))) {
    return;
  }
  const files = await collectFilesRecursively(publicPath);
  if (files.length > 0) {
    includeDirs.push("public");
  }
};

const writeManifest = async (sortedFiles) => {
  const manifestPath = path.join(tempRoot, "audit_manifest.txt");
  const lines = [
    `bundle_name: ${bundleName}`,
    `generated_at: ${new Date().toISOString()}`,
    `project_root: ${projectRootSafeLabel}`,
    `file_count: ${sortedFiles.length}`,
    "",
    "files:",
    ...sortedFiles.map((file) => `- ${file}`)
  ];
  await fsp.writeFile(manifestPath, `${lines.join("\n")}\n`, "utf8");
};

const createZipFromTemp = async (sortedFilesWithManifest) => {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const relative of sortedFilesWithManifest) {
      const absolute = path.join(tempRoot, relative);
      archive.file(absolute, { name: toPosix(relative) });
    }

    archive.finalize().catch(reject);
  });
};

const run = async () => {
  await addViteConfigFiles();
  await includePublicIfNeeded();

  await ensureDir(outputRoot);
  await removeIfExists(tempRoot);
  await removeIfExists(zipPath);
  await ensureDir(tempRoot);

  const includedSet = new Set();

  for (const fileName of [...rootFiles].sort((a, b) => a.localeCompare(b))) {
    const absolute = path.join(projectRoot, fileName);
    if (!(await exists(absolute))) {
      continue;
    }
    const stat = await fsp.stat(absolute);
    if (!stat.isFile()) {
      continue;
    }
    if (!shouldIncludeFile(absolute, stat)) {
      continue;
    }
    includedSet.add(await copyIntoTemp(absolute));
  }

  const uniqueDirs = [...new Set(includeDirs)].sort((a, b) => a.localeCompare(b));
  for (const dirName of uniqueDirs) {
    const absoluteDir = path.join(projectRoot, dirName);
    if (!(await exists(absoluteDir))) {
      continue;
    }
    const files = await collectFilesRecursively(absoluteDir);
    for (const filePath of files) {
      const stat = await fsp.stat(filePath);
      if (!shouldIncludeFile(filePath, stat)) {
        continue;
      }
      includedSet.add(await copyIntoTemp(filePath));
    }
  }

  const sortedIncluded = [...includedSet].sort((a, b) => a.localeCompare(b));
  await writeManifest(sortedIncluded);

  const sortedWithManifest = [...sortedIncluded, "audit_manifest.txt"].sort((a, b) =>
    a.localeCompare(b)
  );
  await createZipFromTemp(sortedWithManifest);

  console.log(`AUDIT_BUNDLE_PATH=${zipPath}`);
  console.log(`AUDIT_BUNDLE_FILE_COUNT=${sortedWithManifest.length}`);
  console.log("AUDIT_BUNDLE_FILES_BEGIN");
  for (const file of sortedWithManifest) {
    console.log(file);
  }
  console.log("AUDIT_BUNDLE_FILES_END");

  if (!keepTemp) {
    await removeIfExists(tempRoot);
  }
};

run().catch((error) => {
  console.error("Falha ao gerar pacote de auditoria.");
  console.error(error);
  process.exitCode = 1;
});
