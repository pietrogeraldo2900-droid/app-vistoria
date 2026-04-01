export const APPROVED_HOMOLOGATED_CODES = [
  "SINAL_001",
  "SINAL_002",
  "EXT_001",
  "EXT_002",
  "EXT_003",
  "EXT_004",
  "IE_001",
  "SDAI_001",
  "HID_001",
  "HID_002",
  "HID_003",
  "SHAFT_001",
  "SPK_001"
];

export const REQUIRED_TEMPLATE_TARGETS = [
  {
    item: "sinalizacao",
    status: "nao_conforme",
    state: "SP",
    template:
      "Local - Deverá ser realizada a sinalização conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa, conforme IT 20/2025."
  },
  {
    item: "sinalizacao",
    status: "nao_conforme",
    state: "RJ",
    template:
      "Local - Deverá ser realizada a sinalização conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa."
  },
  {
    item: "sinalizacao",
    status: "nao_conforme",
    state: "SP",
    rule: "sinalizacao_extintor_po",
    template:
      "Local - Deverá ser instalada a sinalização do extintor de pó, conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa, conforme IT 20/2025."
  },
  {
    item: "sinalizacao",
    status: "nao_conforme",
    state: "RJ",
    rule: "sinalizacao_extintor_po",
    template:
      "Local - Deverá ser instalada a sinalização do extintor de pó, conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa."
  },
  {
    item: "extintor",
    status: "conforme",
    state: "SP",
    rule: "validade_vigente",
    template:
      "Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação de validade até [mês/ano]."
  },
  {
    item: "extintor",
    status: "conforme",
    state: "RJ",
    rule: "validade_vigente",
    template:
      "Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação de validade até [mês/ano]."
  },
  {
    item: "extintor",
    status: "nao_conforme",
    state: "SP",
    rule: "validade_vencida",
    template:
      "Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação VENCIDA em [mês/ano]."
  },
  {
    item: "extintor",
    status: "nao_conforme",
    state: "RJ",
    rule: "validade_vencida",
    template:
      "Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação VENCIDA em [mês/ano]."
  },
  {
    item: "iluminacao_emergencia",
    status: "conforme",
    state: "SP",
    template:
      "Local - A iluminação de emergência (IE) está em conformidade com os requisitos da IT 18/2025 do Corpo de Bombeiros, garantindo o adequado funcionamento em situações de falta de energia."
  },
  {
    item: "iluminacao_emergencia",
    status: "conforme",
    state: "RJ",
    template:
      "Local - A iluminação de emergência (IE) está em conformidade, garantindo o adequado funcionamento em situações de falta de energia."
  },
  {
    item: "hidrante",
    status: "nao_conforme",
    state: "SP",
    rule: "abrigo_incompleto",
    template:
      "Local - O hidrante deverá ser regularizado, pois o abrigo encontra-se incompleto, faltando os seguintes itens obrigatórios: esguicho regulável e chave Storz, além da ausência da sinalização. A ausência desses itens compromete a eficácia do sistema de combate a incêndio e deve ser corrigida para atender às normas de segurança aplicáveis, conforme a IT 22/2025 e 20/2025 do Corpo de Bombeiros."
  },
  {
    item: "hidrante",
    status: "nao_conforme",
    state: "RJ",
    rule: "abrigo_incompleto",
    template:
      "Local - O hidrante deverá ser regularizado, pois o abrigo encontra-se incompleto, faltando os seguintes itens obrigatórios: esguicho regulável e chave Storz, além da ausência da sinalização. A ausência desses itens compromete a eficácia do sistema de combate a incêndio e deve ser corrigida para atender às normas de segurança aplicáveis."
  },
  {
    item: "hidrante",
    status: "conforme",
    state: "SP",
    rule: "mangueira_teste_hidrostatico_valido",
    template: "Local - Mangueira possui teste hidrostático VÁLIDO até [mês/ano]."
  },
  {
    item: "hidrante",
    status: "conforme",
    state: "RJ",
    rule: "mangueira_teste_hidrostatico_valido",
    template: "Local - Mangueira possui teste hidrostático VÁLIDO até [mês/ano]."
  },
  {
    item: "spk",
    status: "nao_conforme",
    state: "SP",
    rule: "spk_detector_fumaca",
    template:
      "Local - Deverá efetuar a instalação de chuveiros automáticos (SPK), conforme parâmetros da NBR 10897 e IT 23/2025 do Corpo de Bombeiros. Além disso, deverá ser feita a instalação de detector de fumaça, conforme IT 19/2025 do Corpo de Bombeiros."
  },
  {
    item: "spk",
    status: "nao_conforme",
    state: "RJ",
    rule: "spk_detector_fumaca",
    template:
      "Local - Deverá efetuar a instalação de chuveiros automáticos (SPK), conforme parâmetros da NBR 10897. Além disso, deverá ser feita a instalação de detector de fumaça."
  }
];
