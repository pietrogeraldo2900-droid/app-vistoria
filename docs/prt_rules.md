# Regras de PRT

## Finalidade
Este documento consolida as regras de geração dos textos de PRT utilizados no aplicativo de vistoria técnica.

O objetivo é transformar dados estruturados de campo em apontamentos técnicos padronizados.

---

## 1. Formato base
Sempre que aplicável, o texto final deve seguir o padrão:

`Local - texto`

Exemplo:
`Sala de saúde preventiva - Deverá ser feita a instalação de detector de fumaça, conforme IT 19/2025 do Corpo de Bombeiros.`

---

## 2. Padrão de linguagem
Os textos devem seguir estas características:
- tom técnico
- tom impessoal
- objetividade
- padronização
- sem floreios
- sem linguagem informal
- sem reescrita desnecessária quando já houver texto homologado

---

## 3. Regra geográfica
### São Paulo
Para vistorias em São Paulo, citar as ITs aplicáveis quando houver modelo homologado com norma.

### Rio de Janeiro
Para vistorias no Rio de Janeiro, não citar ITs no texto final, mesmo quando a regra em São Paulo citar.

---

## 4. Regra de local
Quando a referência de local iniciar com `G`, substituir por `Galpão` quando aplicável.

Exemplo:
- `G1` -> `Galpão 1`
- `G2` -> `Galpão 2`

---

## 5. Status suportados
Cada item vistoriado deve aceitar, no mínimo:
- conforme
- não conforme
- em manutenção
- sem acesso
- não testado

Cada status pode gerar:
- texto automático direto
- exigência de campo complementar
- texto técnico parametrizado

---

## 6. Campos complementares por tipo
### Extintores
Campos possíveis:
- lacrado: sim/não
- validade_recarga: mm/aaaa
- conforme_pressao: sim/não
- selo_inmetro: sim/não

### Hidrantes
Campos possíveis:
- possui_esguicho: sim/não
- possui_chave_storz: sim/não
- possui_registro: sim/não
- sinalizacao_instalada: sim/não
- mangueira_teste_hidrostatico_validade: mm/aaaa
- abrigo_incompleto: sim/não

### Detector de fumaça
Campos possíveis:
- instalado: sim/não

### Iluminação de emergência
Campos possíveis:
- funcionamento_ok: sim/não

### Sinalização
Campos possíveis:
- instalada: sim/não
- tipo_fotoluminescente: sim/não

### Shaft de incêndio
Campos possíveis:
- obstruido: sim/não

### SPK
Campos possíveis:
- instalado: sim/não

---

## 7. Textos homologados

### 7.1 Detector de fumaça
#### São Paulo
`Local - Deverá ser feita a instalação de detector de fumaça, conforme IT 19/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - Deverá ser feita a instalação de detector de fumaça.`

---

### 7.2 Sinalização genérica
#### São Paulo
`Local - Deverá ser realizada a sinalização conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa, conforme IT 20/2025.`

#### Rio de Janeiro
`Local - Deverá ser realizada a sinalização conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa.`

---

### 7.3 Sinalização do extintor de pó
#### São Paulo
`Local - Deverá ser instalada a sinalização do extintor de pó, conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa, conforme IT 20/2025.`

#### Rio de Janeiro
`Local - Deverá ser instalada a sinalização do extintor de pó, conforme a norma no que tange a informações, modelo fotoluminescente, com indicação de nome/CNPJ do fabricante, tempo de atenuação e intensidade luminosa.`

---

### 7.4 Hidrante não conforme
#### São Paulo
`Local - O hidrante deverá ser regularizado, pois o abrigo encontra-se incompleto, faltando os seguintes itens obrigatórios: esguicho regulável e chave Storz, além da ausência da sinalização. A ausência desses itens compromete a eficácia do sistema de combate a incêndio e deve ser corrigida para atender às normas de segurança aplicáveis, conforme a IT 22/2025 e 20/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - O hidrante deverá ser regularizado, pois o abrigo encontra-se incompleto, faltando os seguintes itens obrigatórios: esguicho regulável e chave Storz, além da ausência da sinalização. A ausência desses itens compromete a eficácia do sistema de combate a incêndio e deve ser corrigida para atender às normas de segurança aplicáveis.`

---

### 7.5 Hidrante conforme
#### São Paulo
`Local - O hidrante encontra-se em conformidade, com todos os itens obrigatórios presentes no abrigo: esguicho regulável, mangueira com teste hidrostático válido, chave Storz e registro. Além disso, a sinalização está instalada de forma adequada. O conjunto atende aos requisitos estabelecidos pela IT 22/2025 e IT 20/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - O hidrante encontra-se em conformidade, com todos os itens obrigatórios presentes no abrigo: esguicho regulável, mangueira com teste hidrostático válido, chave Storz e registro. Além disso, a sinalização está instalada de forma adequada.`

---

### 7.6 Extintor sem lacre
#### São Paulo
`Local - Todos os extintores devem estar lacrados, com a pressão adequada para garantir seu devido funcionamento, conforme IT 21/2025.`

#### Rio de Janeiro
`Local - Todos os extintores devem estar lacrados, com a pressão adequada para garantir seu devido funcionamento.`

---

### 7.7 Extintor conforme
#### São Paulo
`Local - Os extintores estão em conformidade com os requisitos estabelecidos na IT 21/2025 do Corpo de Bombeiros, atendendo aos critérios de pressurização, lacre de segurança, prazo de validade e identificação do selo de recarga do INMETRO.`

#### Rio de Janeiro
`Local - Os extintores estão em conformidade, atendendo aos critérios de pressurização, lacre de segurança, prazo de validade e identificação do selo de recarga do INMETRO.`

---

### 7.8 Extintor com validade vigente
#### São Paulo
`Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação de validade até [mês/ano].`

#### Rio de Janeiro
`Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação de validade até [mês/ano].`

---

### 7.9 Extintor vencido
#### São Paulo
`Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação VENCIDA em [mês/ano].`

#### Rio de Janeiro
`Local - Os extintores de combate a incêndio possuem selo de recarga INMETRO com indicação VENCIDA em [mês/ano].`

---

### 7.10 Mangueira com teste hidrostático válido
#### São Paulo
`Local - Mangueira possui teste hidrostático VÁLIDO até [mês/ano].`

#### Rio de Janeiro
`Local - Mangueira possui teste hidrostático VÁLIDO até [mês/ano].`

---

### 7.11 Mangueira com teste hidrostático vencido
#### São Paulo
`Local - Mangueira possui teste hidrostático VENCIDO em [mês/ano], devendo ser regularizada para atendimento à IT 22/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - Mangueira possui teste hidrostático VENCIDO em [mês/ano], devendo ser regularizada.`

---

### 7.12 Iluminação de emergência conforme
#### São Paulo
`Local - A iluminação de emergência (IE) está em conformidade com os requisitos da IT 18/2025 do Corpo de Bombeiros, garantindo o adequado funcionamento em situações de falta de energia.`

#### Rio de Janeiro
`Local - A iluminação de emergência (IE) está em conformidade, garantindo o adequado funcionamento em situações de falta de energia.`

---

### 7.13 SPK + detector de fumaça
#### São Paulo
`Local - Deverá efetuar a instalação de chuveiros automáticos (SPK), conforme parâmetros da NBR 10897 e IT 23/2025 do Corpo de Bombeiros. Além disso, deverá ser feita a instalação de detector de fumaça, conforme IT 19/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - Deverá efetuar a instalação de chuveiros automáticos (SPK), conforme parâmetros da NBR 10897. Além disso, deverá ser feita a instalação de detector de fumaça.`

---

### 7.14 Shaft de incêndio obstruído
#### São Paulo
`Local - O shaft de incêndio deverá ser desobstruído, garantindo livre acesso aos equipamentos e dispositivos de combate a incêndio, conforme as exigências da IT 22/2025 do Corpo de Bombeiros.`

#### Rio de Janeiro
`Local - O shaft de incêndio deverá ser desobstruído, garantindo livre acesso aos equipamentos e dispositivos de combate a incêndio.`

---

## 8. Regras de geração
### 8.1 Prioridade
Ao gerar um texto:
1. verificar se existe texto homologado exato para combinação item + status
2. verificar se depende de estado
3. preencher placeholders
4. prefixar com o local no formato correto

### 8.2 Placeholders
Os seguintes placeholders devem ser suportados:
- `[mês/ano]`
- `Local`

### 8.3 Texto final
O sistema deve gerar sempre a versão final pronta para relatório.

Não deve gerar rascunhos como:
- "verificar item"
- "ajustar depois"
- "pendente"

---

## 9. Tratamento de estados especiais
### Em manutenção
Quando o item estiver em manutenção, preferir textos de relato, sem tratar automaticamente como não conformidade definitiva.

### Sem acesso
Gerar texto informando impossibilidade de acesso ao local ou equipamento.

### Não testado
Gerar texto informando que o item não foi testado na vistoria.

Esses textos podem ser definidos em uma camada secundária de templates.

---

## 10. Regras futuras
O sistema deve ser preparado para:
- múltiplas regras por item
- composição de textos
- checklist com fotos obrigatórias
- comparação entre vistorias
- exportação para PDF
- versão auditável do texto gerado

---

## 11. Sprint - blindagem tecnica e expansao de dominio

### 11.1 Itens adicionados ao catalogo
- central de alarme
- acionador manual
- detector de calor
- recalque
- bomba principal
- bomba jockey
- porta corta-fogo (PCF)
- eletroima
- escada pressurizada
- RTI

### 11.2 Regras de validacao tecnica
Para status `conforme`, o sistema deve bloquear salvamento quando criterios minimos do item nao forem atendidos.

Para status `nao_conforme`, o sistema deve bloquear salvamento quando nao houver evidencia minima de falha tecnica nos campos avaliados.

Campos obrigatorios passam a depender da combinacao item + status, e devem ser exigidos antes da geracao de texto.

### 11.3 Coerencia com templates homologados
Se nao existir template homologado para a combinacao item + status + estado, o cadastro deve ser bloqueado como pendencia tecnica interna.

Esse caso nao deve aparecer como texto final no relatorio.

### 11.4 Regra explicita para sinalizacao de extintor de po
Para o item `sinalizacao` em status `nao_conforme`, o fluxo deve usar o campo
complementar `sinalizacao_extintor_po` para selecionar o template:

- `sinalizacao_extintor_po = sim` -> aplicar `rule: sinalizacao_extintor_po`
- `sinalizacao_extintor_po = nao` -> aplicar template generico de sinalizacao

O campo deve ser exigido no cadastro/edicao para evitar ambiguidade.
