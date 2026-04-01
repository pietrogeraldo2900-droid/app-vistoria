import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "tmp_prt_docs_codex", "docs", "prt");
const outputDir = path.join(rootDir, "tmp_prt_docs_codex", "normalized");

const sourceFiles = {
  catalogCsv: path.join(sourceDir, "catalogo_itens_prt_seed.csv"),
  statusCsv: path.join(sourceDir, "status_prt_seed.csv"),
  rulesMd: path.join(sourceDir, "regras_prt.md"),
  catalogMd: path.join(sourceDir, "catalogo_prt.md"),
  acceptanceMd: path.join(sourceDir, "criterios_aceite.md"),
  promptTxt: path.join(sourceDir, "prompt_codex_prt.txt"),
};

const officialFiles = {
  items: path.join(rootDir, "data", "inspection_items.json"),
  templates: path.join(rootDir, "data", "prt_templates.json"),
};

const statusMap = {
  CONFORME: "conforme",
  NAO_CONFORME: "nao_conforme",
  EM_MANUTENCAO: "em_manutencao",
  SEM_ACESSO: "sem_acesso",
  PENDENTE_TESTE: "nao_testado",
};

const homologatedRowMap = {
  SINAL_001: {
    item: "sinalizacao",
    status: "nao_conforme",
    rule: "sinalizacao_generica",
  },
  SINAL_002: {
    item: "sinalizacao",
    status: "nao_conforme",
    rule: "sinalizacao_extintor_po",
  },
  EXT_001: { item: "extintor", status: "conforme" },
  EXT_002: { item: "extintor", status: "nao_conforme", rule: "sem_lacre" },
  EXT_003: { item: "extintor", status: "conforme", rule: "validade_vigente" },
  EXT_004: {
    item: "extintor",
    status: "nao_conforme",
    rule: "validade_vencida",
  },
  IE_001: { item: "iluminacao_emergencia", status: "conforme" },
  SDAI_001: { item: "detector_fumaca", status: "nao_conforme" },
  HID_001: {
    item: "hidrante",
    status: "nao_conforme",
    rule: "abrigo_incompleto",
  },
  HID_002: { item: "hidrante", status: "conforme" },
  HID_003: {
    item: "hidrante",
    status: "conforme",
    rule: "mangueira_teste_hidrostatico_valido",
  },
  SHAFT_001: { item: "shaft_incendio", status: "nao_conforme" },
  SPK_001: { item: "spk", status: "nao_conforme", rule: "spk_detector_fumaca" },
};

function ensureExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${path.relative(rootDir, filePath)}`);
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());

  return rows
    .slice(1)
    .filter((currentRow) => currentRow.some((value) => String(value).trim().length))
    .map((currentRow) => {
      const record = {};
      for (let index = 0; index < headers.length; index += 1) {
        const key = headers[index];
        const value = (currentRow[index] ?? "").trim();
        record[key] = value;
      }
      return record;
    });
}

function normalizeTemplate(text) {
  const baseText = String(text ?? "").trim();
  if (!baseText) return "";
  return baseText.startsWith("Local - ") ? baseText : `Local - ${baseText}`;
}

function createTemplateIndex(templates) {
  const index = new Map();
  for (const template of templates) {
    const key = [template.item, template.status, template.state, template.rule ?? ""].join("|");
    index.set(key, template);
  }
  return index;
}

function findOfficialTemplate(index, lookup) {
  const exactKey = [lookup.item, lookup.status, lookup.state, lookup.rule ?? ""].join("|");
  if (index.has(exactKey)) return index.get(exactKey);

  if (lookup.rule) {
    const fallbackKey = [lookup.item, lookup.status, lookup.state, ""].join("|");
    if (index.has(fallbackKey)) return index.get(fallbackKey);
  }

  return null;
}

function toStatusReview(statusRows, allowedStatuses) {
  const mapped = [];
  const unsupported = [];

  for (const row of statusRows) {
    const code = String(row.codigo_status ?? "").trim();
    const mappedStatus = statusMap[code];
    const normalizedRecord = {
      codigo_status: code,
      nome_status: row.nome_status ?? "",
      descricao: row.descricao ?? "",
      ordem_exibicao: Number(row.ordem_exibicao ?? 0),
      ativo: parseBoolean(row.ativo),
      mapped_to: mappedStatus ?? null,
    };

    if (!mappedStatus) {
      unsupported.push({
        ...normalizedRecord,
        reason: "status_sem_mapeamento_no_mvp",
      });
      continue;
    }

    if (!allowedStatuses.has(mappedStatus)) {
      unsupported.push({
        ...normalizedRecord,
        reason: "status_mapeado_mas_nao_suportado_no_catalogo_atual",
      });
      continue;
    }

    mapped.push(normalizedRecord);
  }

  return { mapped, unsupported };
}

function createCandidateEntries(catalogRows, templateIndex, allowedItems, allowedStatuses) {
  const homologatedRows = catalogRows.filter(
    (row) =>
      String(row.status_catalogo ?? "").toLowerCase() === "homologado" &&
      String(row.texto_padrao ?? "").trim().length > 0,
  );

  const candidates = [];
  const pendings = [];

  for (const row of homologatedRows) {
    const rowCode = String(row.codigo ?? "").trim();
    const mapping = homologatedRowMap[rowCode];

    if (!mapping) {
      pendings.push({
        codigo: rowCode,
        motivo: "linha_homologada_sem_mapeamento_para_dominio_atual",
      });
      continue;
    }

    if (!allowedItems.has(mapping.item)) {
      pendings.push({
        codigo: rowCode,
        motivo: `item_nao_suportado_no_mvp_atual: ${mapping.item}`,
      });
      continue;
    }

    if (!allowedStatuses.has(mapping.status)) {
      pendings.push({
        codigo: rowCode,
        motivo: `status_nao_suportado_no_mvp_atual: ${mapping.status}`,
      });
      continue;
    }

    const sourceTemplate = normalizeTemplate(row.texto_padrao);
    const sourceHasNorm = parseBoolean(row.tem_norma) === true;
    const sourceNormSp = String(row.norma_sp ?? "").trim();

    const spLookup = {
      item: mapping.item,
      status: mapping.status,
      state: "SP",
      rule: mapping.rule,
    };
    const rjLookup = {
      item: mapping.item,
      status: mapping.status,
      state: "RJ",
      rule: mapping.rule,
    };

    const officialSp = findOfficialTemplate(templateIndex, spLookup);
    const officialRj = findOfficialTemplate(templateIndex, rjLookup);

    const spDecision = !officialSp
      ? "novo_candidato"
      : officialSp.template === sourceTemplate
        ? "reutilizar_oficial"
        : "conflito_com_oficial";

    const candidate = {
      codigo_origem: rowCode,
      item: mapping.item,
      status: mapping.status,
      rule: mapping.rule ?? null,
      source_template_sp: sourceTemplate,
      source_tem_norma: sourceHasNorm,
      source_norma_sp: sourceNormSp || null,
      sp: {
        decision: spDecision,
        official_template: officialSp ? officialSp.template : null,
      },
      rj: {
        decision: null,
        template_for_review: null,
        official_template: officialRj ? officialRj.template : null,
      },
    };

    if (officialRj) {
      candidate.rj.decision =
        candidate.source_template_sp === officialRj.template
          ? "reutilizar_oficial"
          : "reutilizar_oficial";
      candidate.rj.template_for_review = officialRj.template;
    } else if (!sourceHasNorm) {
      candidate.rj.decision = "novo_candidato_sem_norma";
      candidate.rj.template_for_review = sourceTemplate;
    } else {
      candidate.rj.decision = "pendente_homologacao_sem_it_para_rj";
      candidate.rj.template_for_review = null;
    }

    candidates.push(candidate);
  }

  return { candidates, pendings };
}

function toCatalogReviewRows(catalogRows) {
  return catalogRows.map((row) => ({
    codigo: row.codigo ?? "",
    categoria: row.categoria ?? "",
    subcategoria: row.subcategoria ?? "",
    item: row.item ?? "",
    descricao_curta: row.descricao_curta ?? "",
    local_obrigatorio: parseBoolean(row.local_obrigatorio),
    tem_variavel_validade: parseBoolean(row.tem_variavel_validade),
    tem_norma: parseBoolean(row.tem_norma),
    norma_sp: row.norma_sp ? row.norma_sp : null,
    usar_norma_rj: parseBoolean(row.usar_norma_rj),
    status_catalogo: row.status_catalogo ?? "",
    texto_padrao: row.texto_padrao ? normalizeTemplate(row.texto_padrao) : null,
    ativo: parseBoolean(row.ativo),
  }));
}

function buildSummaryMarkdown(review) {
  const statusesMapped = review.statuses.mapped.length;
  const statusesUnsupported = review.statuses.unsupported.length;
  const totalCatalogRows = review.catalog.rows.length;
  const homologatedRows = review.catalog.rows.filter(
    (row) => String(row.status_catalogo).toLowerCase() === "homologado",
  ).length;
  const recurringRows = review.catalog.rows.filter(
    (row) => String(row.status_catalogo).toLowerCase() === "recorrente",
  ).length;
  const candidates = review.templates.candidates;
  const spReuse = candidates.filter((entry) => entry.sp.decision === "reutilizar_oficial").length;
  const spConflict = candidates.filter(
    (entry) => entry.sp.decision === "conflito_com_oficial",
  ).length;
  const spNew = candidates.filter((entry) => entry.sp.decision === "novo_candidato").length;
  const rjPending = candidates.filter(
    (entry) => entry.rj.decision === "pendente_homologacao_sem_it_para_rj",
  ).length;

  const lines = [
    "# Revisao Segura do ZIP de PRT",
    "",
    `Gerado em: ${review.generated_at}`,
    "",
    "## Escopo",
    "- Conversao de encoding para leitura consistente.",
    "- Comparacao com as fontes oficiais do projeto.",
    "- Geracao de candidatos sem sobrescrever templates oficiais.",
    "",
    "## Status",
    `- Mapeados para o MVP atual: ${statusesMapped}`,
    `- Sem mapeamento ou fora do escopo atual: ${statusesUnsupported}`,
    "",
    "## Catalogo",
    `- Total de linhas: ${totalCatalogRows}`,
    `- Linhas homologadas: ${homologatedRows}`,
    `- Linhas recorrentes: ${recurringRows}`,
    "",
    "## Templates homologados (candidatos)",
    `- Reuso exato de template oficial (SP): ${spReuse}`,
    `- Conflito de texto com template oficial (SP): ${spConflict}`,
    `- Novos candidatos sem template oficial (SP): ${spNew}`,
    `- Pendencias de homologacao RJ (remocao de IT): ${rjPending}`,
    "",
    "## Arquivos de saida",
    "- prt_zip_review.json",
    "- prt_zip_review.md",
    "",
    "## Observacao",
    "- Este pacote nao altera data/prt_templates.json nem docs/prt_rules.md.",
    "- Use o JSON para aprovar item a item antes de qualquer merge no catalogo oficial.",
    "",
  ];

  return lines.join("\n");
}

function main() {
  Object.values(sourceFiles).forEach(ensureExists);
  Object.values(officialFiles).forEach(ensureExists);

  fs.mkdirSync(outputDir, { recursive: true });

  const statusRows = parseCsv(readText(sourceFiles.statusCsv));
  const catalogRows = parseCsv(readText(sourceFiles.catalogCsv));

  const officialItems = JSON.parse(fs.readFileSync(officialFiles.items, "utf8"));
  const officialTemplates = JSON.parse(fs.readFileSync(officialFiles.templates, "utf8"));

  const allowedStatuses = new Set(officialItems.statuses);
  const allowedItems = new Set(officialItems.items.map((item) => item.key));
  const templateIndex = createTemplateIndex(officialTemplates.templates);

  const statusReview = toStatusReview(statusRows, allowedStatuses);
  const catalogReviewRows = toCatalogReviewRows(catalogRows);
  const templateReview = createCandidateEntries(
    catalogRows,
    templateIndex,
    allowedItems,
    allowedStatuses,
  );

  const review = {
    generated_at: new Date().toISOString(),
    source: {
      zip_folder: path.relative(rootDir, sourceDir),
      files: Object.values(sourceFiles).map((currentPath) => path.relative(rootDir, currentPath)),
      official_reference: Object.values(officialFiles).map((currentPath) =>
        path.relative(rootDir, currentPath),
      ),
      notes: [
        "A fonte oficial do produto permanece: docs/prt_rules.md -> data/prt_templates.json -> data/inspection_items.json.",
        "Este arquivo e apenas um pacote de revisao para migracao assistida.",
      ],
    },
    statuses: statusReview,
    catalog: {
      rows: catalogReviewRows,
    },
    templates: templateReview,
    imported_docs_snapshot: {
      rules_excerpt_length: readText(sourceFiles.rulesMd).length,
      catalog_excerpt_length: readText(sourceFiles.catalogMd).length,
      acceptance_excerpt_length: readText(sourceFiles.acceptanceMd).length,
      prompt_excerpt_length: readText(sourceFiles.promptTxt).length,
    },
  };

  const jsonOutputPath = path.join(outputDir, "prt_zip_review.json");
  const mdOutputPath = path.join(outputDir, "prt_zip_review.md");

  fs.writeFileSync(jsonOutputPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdOutputPath, buildSummaryMarkdown(review), "utf8");

  console.log(`Review JSON: ${path.relative(rootDir, jsonOutputPath)}`);
  console.log(`Review MD: ${path.relative(rootDir, mdOutputPath)}`);
}

main();
