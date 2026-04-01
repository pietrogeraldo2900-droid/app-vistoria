import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_HOMOLOGATED_CODES,
  REQUIRED_TEMPLATE_TARGETS
} from "./prt-homologation-targets.mjs";

const rootDir = process.cwd();
const candidatePath = path.join(rootDir, "data", "prt_catalog_candidates.json");
const templatesPath = path.join(rootDir, "data", "prt_templates.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const toTemplateKey = (template) =>
  [template.item, template.status, template.state, template.rule ?? ""].join("|");

const upsertTemplate = (templates, target) => {
  const key = toTemplateKey(target);
  const existingIndex = templates.findIndex((template) => toTemplateKey(template) === key);

  if (existingIndex >= 0) {
    templates[existingIndex] = { ...target };
    return { action: "updated", key };
  }

  templates.push({ ...target });
  return { action: "created", key };
};

const ensureNoDuplicateKeys = (templates) => {
  const keys = new Set();
  const duplicates = [];

  for (const template of templates) {
    const key = toTemplateKey(template);
    if (keys.has(key)) {
      duplicates.push(key);
      continue;
    }
    keys.add(key);
  }

  return duplicates;
};

const candidateData = readJson(candidatePath);
const templateData = readJson(templatesPath);

const approvedCodeSet = new Set(APPROVED_HOMOLOGATED_CODES);
let approvedCount = 0;

candidateData.homologated_candidates = candidateData.homologated_candidates.map((candidate) => {
  const approved = approvedCodeSet.has(candidate.codigo);
  if (approved) {
    approvedCount += 1;
  }
  return {
    ...candidate,
    approved
  };
});

const patchResults = REQUIRED_TEMPLATE_TARGETS.map((target) =>
  upsertTemplate(templateData.templates, target)
);

const duplicates = ensureNoDuplicateKeys(templateData.templates);
if (duplicates.length > 0) {
  throw new Error(`Templates duplicados detectados: ${duplicates.join(", ")}`);
}

writeJson(candidatePath, candidateData);
writeJson(templatesPath, templateData);

const updatedCount = patchResults.filter((result) => result.action === "updated").length;
const createdCount = patchResults.filter((result) => result.action === "created").length;

console.log(`Candidatos homologados aprovados: ${approvedCount}`);
console.log(`Templates atualizados: ${updatedCount}`);
console.log(`Templates criados: ${createdCount}`);
