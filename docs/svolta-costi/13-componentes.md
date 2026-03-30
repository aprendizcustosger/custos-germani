# Capítulo 13 — Componentes

## 13.1 Componentes principais
A interface utiliza componentes DOM com comportamento dirigido por controller.

| Componente | Tipo | Comportamento | Dependências |
|------------|------|---------------|--------------|
| DropZone | Área de upload | Drag-and-drop e clique | SheetJS, SweetAlert2 |
| Filtros (Origem/Família/Agrup.) | Selects | Cascata hierárquica | report-engine |
| Tabela de auditoria | Grid HTML | Ranking por variação | report-engine |
| Gráfico principal | Chart de barras | Variação percentual | Chart.js |
| Gráfico de tendência | Chart de linha | Série de 6 meses | Chart.js |

## 13.2 Eventos acionadores
Os eventos disparam os fluxos de negócio do sistema.

| Evento | Origem | Ação |
|--------|--------|------|
| `change` | `fileInput` | Inicia importação |
| `click` | `analyzeBtn` | Executa relatório |
| `change` | `selO`/`selF` | Recalcula cascata |
| `click` | linha da tabela | Carrega tendência |
