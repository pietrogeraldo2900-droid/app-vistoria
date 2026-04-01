# Playbook de Apresentacao ao Cliente

## Objetivo
Garantir uma demonstracao previsivel do app-vistoria, com base consistente de dados, fluxo operacional completo e exportacao PDF.

## Escopo deste playbook
- Preparar ambiente de demo sem acoplamento a backend real.
- Carregar dados de demonstracao de forma padronizada.
- Executar roteiro comercial de 10 minutos.
- Validar pontos criticos antes da reuniao.

## Pre-condicoes do ambiente
1. Projeto atualizado e buildavel.
2. Modo local ativo para `inspection` e `photo`.
3. Usuario admin logado no app.

Configuracao recomendada para demo local:
```env
VITE_REPOSITORY_MODE=local
VITE_REPOSITORY_MODE_AUTH=local
VITE_REPOSITORY_MODE_INSPECTION=local
VITE_REPOSITORY_MODE_PHOTO=local
VITE_API_BASE_URL=
```

## Preparar base de demonstracao
1. Abrir Dashboard.
2. Clicar em `Preparar demo`.
3. Confirmar mensagem de sucesso com total de:
   - vistorias
   - locais
   - itens
   - fotos sincronizadas

Resultado esperado:
- 3 vistorias de exemplo (SP e RJ)
- itens com texto PRT homologado
- fotos sincronizadas para evidencia no PDF

## Roteiro comercial (10 minutos)
1. Login e visao geral (1 min)
   - Mostrar acesso por perfil e painel com metricas.
2. Fluxo de vistoria (3 min)
   - Entrar em uma vistoria de demo.
   - Mostrar locais, itens e status.
   - Destacar que nao e checklist generico: cada item gera texto tecnico.
3. Regras de PRT (2 min)
   - Mostrar um caso SP com IT.
   - Mostrar um caso RJ sem IT.
   - Mostrar padrao `Local - texto` e normalizacao de `G` para `Galpao`.
4. Evidencias fotograficas (2 min)
   - Abrir item com fotos.
   - Mostrar estado de sincronizacao visivel no fluxo.
5. Previa e PDF (2 min)
   - Abrir `Previa`.
   - Exportar PDF.
   - Mostrar:
     - metadados da vistoria
     - apontamentos finais
     - grid de evidencias
     - pendencias fora do texto final

## Checklist pre-demo (go/no-go)
1. `npm run demo:check` sem falhas.
3. Dashboard abre sem erro e botao `Preparar demo` funciona.
4. Previa da vistoria abre com linhas finais homologadas.
5. PDF exporta localmente.
6. PDF contem secao de evidencias fotograficas.
7. Nao ha texto de fallback inseguro no relatorio final.

Se qualquer item acima falhar, nao apresentar como versao final.

## Fallback de apresentacao (se internet falhar)
1. Rodar localmente com `npm run dev`.
2. Recarregar base com `Preparar demo`.
3. Executar o mesmo roteiro em rede local.

## Mensagem de posicionamento para o cliente
- O MVP ja demonstra o ciclo fim a fim de vistoria tecnica com PRT.
- O modo local existe para acelerar operacao e validacao de processo.
- A evolucao natural apos a demo e ampliar integracao backend para autenticacao e governanca corporativa.
