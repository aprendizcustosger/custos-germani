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
