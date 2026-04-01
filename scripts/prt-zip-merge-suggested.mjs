import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const normalizedDir = path.join(rootDir, "tmp_prt_docs_codex", "normalized");
const reviewPath = path.join(normalizedDir, "prt_zip_review.json");
const outputJsonPath = path.join(normalizedDir, "prt_merge_suggested.json");
const outputMdPath = path.join(normalizedDir, "prt_merge_suggested.md");

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${path.relative(rootDir, filePath)}`);
  }
}

function sortByCode(records) {
  return [...records].sort((a, b) =>
    String(a.codigo_origem).localeCompare(String(b.codigo_origem), "pt-BR"),
  );
}

function asKey(candidate) {
  return [candidate.item, candidate.status, candidate.rule ?? ""].join("|");
}

function formatRule(rule) {
  return rule ?? "-";
}

function buildSummaryMarkdown(mergeSuggestion) {
  const lines = [
    "# Merge Sugerido do ZIP de PRT",
    "",
    `Gerado em: ${mergeSuggestion.generated_at}`,
    "",
    "## Politica aplicada",
    "- Nao altera data/prt_templates.json automaticamente.",
    "- Marca como reaproveitavel apenas o que bate com o oficial atual.",
    "- Marca como conflito o que diverge e exige homologacao tecnica.",
    "",
    `## Reaproveitaveis (${mergeSuggestion.safe_reuse.length})`,
    "",
    "| codigo_origem | item | status | rule | decisao |",
    "|---|---|---|---|---|",
  ];

  for (const row of mergeSuggestion.safe_reuse) {
    lines.push(
      `| ${row.codigo_origem} | ${row.item} | ${row.status} | ${formatRule(row.rule)} | manter_template_oficial |`,
    );
  }

  lines.push("");
  lines.push(`## Conflitantes (${mergeSuggestion.conflicts.length})`);
  lines.push("");
  lines.push("| codigo_origem | item | status | rule | tratamento |");
  lines.push("|---|---|---|---|---|");

  for (const row of mergeSuggestion.conflicts) {
    lines.push(
      `| ${row.codigo_origem} | ${row.item} | ${row.status} | ${formatRule(row.rule)} | homologacao_manual |`,
    );
  }

  lines.push("");
  lines.push("## Proximo passo recomendado");
  lines.push("1. Aprovar os 5 reaproveitaveis como referencia do catalogo.");
  lines.push(
    "2. Homologar os 8 conflitos item a item (sem alterar template oficial ate aprovacao).",
  );
  lines.push(
    "3. So depois gerar patch controlado para data/prt_templates.json com historico de decisoes.",
  );
  lines.push("");

  return lines.join("\n");
}

function main() {
  ensureFile(reviewPath);
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const candidates = review.templates?.candidates ?? [];

  const safeReuse = sortByCode(
    candidates
      .filter((candidate) => candidate.sp?.decision === "reutilizar_oficial")
      .map((candidate) => ({
        codigo_origem: candidate.codigo_origem,
        item: candidate.item,
        status: candidate.status,
        rule: candidate.rule ?? null,
        key: asKey(candidate),
        sp_official_template: candidate.sp?.official_template ?? null,
        rj_official_template: candidate.rj?.official_template ?? null,
      })),
  );

  const conflicts = sortByCode(
    candidates
      .filter((candidate) => candidate.sp?.decision === "conflito_com_oficial")
      .map((candidate) => ({
        codigo_origem: candidate.codigo_origem,
        item: candidate.item,
        status: candidate.status,
        rule: candidate.rule ?? null,
        key: asKey(candidate),
        source_template_sp: candidate.source_template_sp ?? null,
        official_template_sp: candidate.sp?.official_template ?? null,
        official_template_rj: candidate.rj?.official_template ?? null,
      })),
  );

  const mergeSuggestion = {
    generated_at: new Date().toISOString(),
    source_review: path.relative(rootDir, reviewPath),
    policy: {
      update_official_templates: false,
      safe_reuse_criteria: "sp_decision_equals_reutilizar_oficial",
      conflict_criteria: "sp_decision_equals_conflito_com_oficial",
    },
    safe_reuse: safeReuse,
    conflicts,
    pending_from_review: review.templates?.pendings ?? [],
    recommended_next_actions: [
      "Aprovar reaproveitamento dos templates oficiais para os itens safe_reuse.",
      "Homologar manualmente os itens em conflito antes de qualquer alteracao em data/prt_templates.json.",
      "Registrar as decisoes de homologacao em docs/prt_rules.md ou documento de governanca de templates.",
    ],
  };

  fs.mkdirSync(normalizedDir, { recursive: true });
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(mergeSuggestion, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputMdPath, buildSummaryMarkdown(mergeSuggestion), "utf8");

  console.log(`Merge JSON: ${path.relative(rootDir, outputJsonPath)}`);
  console.log(`Merge MD: ${path.relative(rootDir, outputMdPath)}`);
}

main();
