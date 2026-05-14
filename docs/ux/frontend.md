# Capítulo 5 — Frontend

## Estrutura principal
- `index.html`: layout das telas (Importação e Auditoria).
- `view/ui-controller.js`: orquestra eventos, importação, filtros e gráficos.
- `core/spreadsheet-engine.js`: parsing/mapeamento de planilha.
- `core/report-engine.js`: cascata, KPIs e linhas de relatório.

## Comportamento da UI
- Filtros dinâmicos e em cascata.
- Remoção de valores nulos/inválidos em selects.
- Atualização por realtime (histórico e dicionário).

## Auditoria temporal (novo)
- Painel: **Evolução Temporal de Custos**.
- Renderização em `Chart.js` (linha), com média histórica tracejada.
- Respeita filtros ativos: período, origem, família, agrupamento e produto.
- Processamento local da série temporal a partir do dataset já retornado por `api.getHistorico`.
- Fallback visual para histórico insuficiente (<2 pontos).


## Atualização estrutural (2026-05-14)

Para reduzir acoplamento e facilitar manutenção incremental, o frontend foi reorganizado sem alterar regras analíticas:

- `ui-controller.js`: mantém apenas orquestração de fluxo investigativo e integração entre módulos.
- `ui-state.js`: encapsula estado inicial da aplicação.
- `ui-dom.js`: centraliza seleção de elementos de interface.
- `ui-utils.js`: concentra utilitários reutilizáveis de UI (formatação, debounce, toast, escape).

A semântica temporal permanece explícita na UI: competência (`data_referencia`) separada de importação (`criado_em`).
