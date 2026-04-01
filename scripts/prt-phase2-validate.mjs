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

const toTemplateKey = (template) =>
  [template.item, template.status, template.state, template.rule ?? ""].join("|");

const candidateData = readJson(candidatePath);
const templateData = readJson(templatesPath);

const failures = [];

const approvedCodeSet = new Set(APPROVED_HOMOLOGATED_CODES);
for (const code of APPROVED_HOMOLOGATED_CODES) {
  const candidate = candidateData.homologated_candidates.find(
    (entry) => entry.codigo === code
  );
  if (!candidate) {
    failures.push(`Codigo homologado ausente em candidatos: ${code}`);
    continue;
  }
  if (!candidate.approved) {
    failures.push(`Codigo homologado sem approved=true: ${code}`);
  }
}

for (const candidate of candidateData.homologated_candidates) {
  if (candidate.approved && !approvedCodeSet.has(candidate.codigo)) {
    failures.push(
      `Candidato aprovado fora da whitelist da fase 2: ${candidate.codigo}`
    );
  }
}

const templateIndex = new Map(templateData.templates.map((template) => [toTemplateKey(template), template]));

for (const target of REQUIRED_TEMPLATE_TARGETS) {
  const key = toTemplateKey(target);
  const existing = templateIndex.get(key);
  if (!existing) {
    failures.push(`Template obrigatorio ausente: ${key}`);
    continue;
  }

  if (existing.template.trim() !== target.template.trim()) {
    failures.push(`Template divergente para chave ${key}`);
  }
}

const seenKeys = new Set();
for (const template of templateData.templates) {
  const key = toTemplateKey(template);
  if (seenKeys.has(key)) {
    failures.push(`Template duplicado na colecao final: ${key}`);
  } else {
    seenKeys.add(key);
  }
}

if (failures.length > 0) {
  throw new Error(`Validacao PRT fase 2 falhou:\n- ${failures.join("\n- ")}`);
}

console.log("Validacao PRT fase 2: OK");
