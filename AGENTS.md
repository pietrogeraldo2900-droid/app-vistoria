# AGENTS.md

## Objetivo do projeto
Este projeto Ã© um aplicativo de vistoria tÃ©cnica com geraÃ§Ã£o automÃ¡tica de PRTs (PadronizaÃ§Ã£o de RelatÃ³rio TÃ©cnico) a partir de inspeÃ§Ãµes realizadas em campo.

O sistema deve permitir:
- cadastrar vistorias
- cadastrar locais vistoriados
- registrar itens de combate a incÃªndio e seguranÃ§a
- marcar status de conformidade
- anexar fotos e vÃ­deos
- gerar automaticamente textos padronizados no formato de PRT
- consolidar o relatÃ³rio final da vistoria

## Regra principal
A geraÃ§Ã£o textual Ã© parte central do produto.

Este projeto NÃƒO deve tratar o relatÃ³rio apenas como texto livre.
A lÃ³gica correta Ã©:
1. usuÃ¡rio informa local
2. usuÃ¡rio seleciona item
3. usuÃ¡rio informa status e campos complementares
4. sistema gera o texto tÃ©cnico automaticamente com base nas regras homologadas

## Fonte da verdade
A ordem de prioridade das regras do projeto Ã©:

1. `docs/prt_rules.md`
2. `data/prt_templates.json`
3. `data/inspection_items.json`
4. cÃ³digo da aplicaÃ§Ã£o

Ao implementar qualquer funcionalidade, seguir sempre essa hierarquia.

## Regras obrigatÃ³rias de escrita
1. O formato do texto deve seguir, sempre que aplicÃ¡vel:
   `Local - texto`

2. NÃ£o reescrever desnecessariamente textos homologados.

3. Manter tom tÃ©cnico, impessoal e objetivo.

4. Quando houver referÃªncia de local iniciando com `G`, substituir por `GalpÃ£o` quando aplicÃ¡vel.

5. Sempre que houver texto homologado exato no repositÃ³rio, reutilizar esse texto em vez de criar nova variaÃ§Ã£o.

6. Para vistorias no estado de SÃ£o Paulo, citar ITs aplicÃ¡veis quando previsto nas regras.

7. Para vistorias no estado do Rio de Janeiro, NÃƒO citar ITs no texto final.

## Regras de domÃ­nio
O app deve contemplar, no mÃ­nimo, os seguintes itens de vistoria:
- extintores
- hidrantes
- recalque
- mangueiras
- bomba principal
- bomba jockey
- central de alarme
- acionador manual
- detector de fumaÃ§a
- detector de calor
- iluminaÃ§Ã£o de emergÃªncia
- sinalizaÃ§Ã£o
- chuveiros automÃ¡ticos (SPK)
- porta corta-fogo (PCF)
- eletroÃ­mÃ£
- shaft de incÃªndio
- escada pressurizada
- RTI

## Status padrÃ£o dos itens
Todos os itens devem suportar, no mÃ­nimo, os seguintes status:
- conforme
- nÃ£o conforme
- em manutenÃ§Ã£o
- sem acesso
- nÃ£o testado

## PrincÃ­pios de implementaÃ§Ã£o
1. Priorizar arquitetura simples e escalÃ¡vel.
2. ComeÃ§ar por mobile-first.
3. Preferir componentes reaproveitÃ¡veis.
4. Evitar acoplamento entre interface e regras de geraÃ§Ã£o textual.
5. Centralizar a lÃ³gica de geraÃ§Ã£o dos PRTs em uma camada prÃ³pria.
6. Preparar o sistema para futura exportaÃ§Ã£o em PDF.
7. Preparar o sistema para histÃ³rico e comparaÃ§Ã£o entre vistorias.

## O que nÃ£o fazer
- NÃ£o inventar textos tÃ©cnicos fora das regras homologadas sem necessidade.
- NÃ£o alterar o padrÃ£o da linguagem dos PRTs.
- NÃ£o misturar lÃ³gica de geraÃ§Ã£o textual diretamente nas telas.
- NÃ£o depender de campos soltos sem estrutura.
- NÃ£o criar um sistema genÃ©rico de checklist que ignore a inteligÃªncia do PRT.

## Arquitetura esperada
SugestÃ£o mÃ­nima:
- camada de interface
- camada de serviÃ§os
- camada de regras de PRT
- camada de persistÃªncia
- camada de exportaÃ§Ã£o

## EntregÃ¡veis esperados do MVP
1. login
2. dashboard inicial
3. criaÃ§Ã£o de vistoria
4. cadastro de locais
5. cadastro de itens por local
6. upload de imagens
7. geraÃ§Ã£o automÃ¡tica de texto PRT
8. prÃ©-visualizaÃ§Ã£o do relatÃ³rio
9. histÃ³rico de vistorias

## Diretriz para o Codex
Ao implementar novas funcionalidades:
- ler primeiro `docs/prt_rules.md`
- usar `data/prt_templates.json` como base da geraÃ§Ã£o textual
- preservar textos homologados
- separar claramente regras de negÃ³cio, interface e persistÃªncia
- documentar novas decisÃµes de domÃ­nio antes de alterar os templates existentes

## Regra de auditoria
"sempre que eu pedir para auditar o projeto, gere primeiro um pacote limpo de auditoria contendo apenas arquivos relevantes e excluindo artefatos de build, dependencias e segredos"

## Regras obrigatorias para tarefas complexas
Quando a tarefa envolver arquitetura, persistencia, integracao remota, sincronizacao, auth, fotos, PDF ou fluxo critico de vistoria:

1. Ler obrigatoriamente:
   - `docs/architecture.md`
   - `docs/api_contracts.md`
   - `docs/prt_rules.md`
   - `data/inspection_items.json`
   - `data/prt_templates.json`

2. Fazer plano antes de implementar, identificando:
   - arquivos afetados
   - risco da alteracao
   - impacto no modo local
   - impacto no modo remoto
   - testes necessarios

3. Nao introduzir fallback silencioso em fluxos criticos.

4. Nao deixar divergencia entre:
   - codigo
   - testes
   - documentacao
   - comportamento da UI

5. Sempre que alterar comportamento critico:
   - criar ou ajustar testes
   - atualizar a documentacao correspondente

6. Preservar sempre:
   - arquitetura em camadas
   - engine de PRT fora da UI
   - modo local funcionando
   - modo remoto funcionando

7. Em fluxos remotos, tornar explicito ao usuario:
   - sucesso
   - pendencia
   - falha
   - acao necessaria

8. Nao considerar a tarefa concluida se existir:
   - comportamento ambiguo
   - dependencia fragil nao documentada
   - incompatibilidade entre modo local e remoto

