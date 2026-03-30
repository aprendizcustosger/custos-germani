# Capítulo 5 — Frontend

## 5.1 Estrutura de diretórios
O frontend é modularizado por responsabilidade.

```text
/workspace/custos-germani/
├── index.html                     ← Entrada da aplicação
├── view/
│   └── ui-controller.js           ← Eventos, estado e renderização
├── core/
│   ├── spreadsheet-engine.js      ← Leitura e mapeamento de XLSX
│   └── report-engine.js           ← Regras analíticas e KPIs
└── assets/
    └── style.css                  ← Estilos globais
```

## 5.2 Páginas e comportamento
A navegação usa duas views principais dentro da SPA.

| Tela | Comportamento | Ações |
|------|---------------|-------|
| Importação | Upload com validação e confirmação | Selecionar data, enviar planilha |
| Auditoria | Filtros, tabela e gráficos | Definir período, analisar, abrir tendência |
