# Roadmap Estratégico — Kustos Germani

> Princípio do roadmap: toda feature deve acelerar investigação, reduzir cliques, melhorar contexto ou destacar risco. Funcionalidades decorativas não entram.

---

## FASE 1 — CONSOLIDAÇÃO OPERACIONAL

**Status: CONCLUÍDA**

Objetivo: garantir robustez operacional total na importação e análise básica.

### Entregues

- Importação resiliente com Smart Scraper de cabeçalhos
- Preview linha a linha antes de gravar (🟢 válida / 🟡 atenção / 🔴 erro)
- Mapeamento manual de colunas com fuzzy matching
- Parsing numérico brasileiro robusto
- Auto-criação de produtos no dicionário em import
- Filtros em cascata (Origem → Família → Agrupamento → Produto)
- Ordenação interativa por coluna
- KPIs de itens analisados e alertas

---

## FASE 2 — INVESTIGAÇÃO ANALÍTICA

**Status: CONCLUÍDA**

Objetivo: transformar o sistema de dashboard em motor de investigação.

### Entregues

- Score de instabilidade com classificação automática (ESTÁVEL / OSCILANDO / MUITO INSTÁVEL)
- Alertas automáticos (variação > 5% entre importações)
- TOP VARIAÇÕES entre últimas 2 importações
- Evolução temporal de custos com gráfico de linha
- Badge de tendência (🟢 Estável / 🔺 Alta / 🔻 Queda)
- Tooltip com variação vs. ponto anterior no gráfico
- Auto-refresh ao alterar filtros (elimina necessidade de clicar "Analisar")
- Exportação do relatório para Excel (.xlsx)

### Entregues na revisão arquitetural (mai/2026)

- **Busca direta por produto**: bypass completo da hierarquia, 1 interação para chegar à análise
- **Drill-through de eventos**: histórico completo de importações por produto com `data_referencia` (competência) e `criado_em` (importação) claramente separados, e delta monetário/percentual por registro
- **Detecção de mudança de regime**: 4º KPI — identifica produtos que eram ESTÁVEL e ficaram instáveis no período
- **Coluna "Regime"** na tabela analítica com badge visual
- **Coluna "Competência"** separando claramente data de vigência do custo vs. data de importação
- **Banner de órfãos**: alerta visível quando há produtos sem categorização no dicionário
- **Debounce de 2s** no listener de real-time (evita reloads em cascata durante imports)
- **Segurança**: remoção de credenciais hardcoded do código-fonte

---

## FASE 3 — MEMÓRIA OPERACIONAL

**Status: PRÓXIMA**

Objetivo: registrar comportamento histórico e identificar padrões.

### Funcionalidades planejadas

- Histórico de alertas por produto (quando foi alertado, com que frequência)
- Detecção de reincidência (produto que voltou a oscilar após período estável)
- Linha do tempo de regime: quando um produto mudou de ESTÁVEL → INSTÁVEL → ESTÁVEL
- Comparação entre períodos equivalentes (este mês vs. mesmo mês do ano anterior)
- Exportação de drill-through individual por produto

### Decisões de arquitetura a tomar

- Manter cálculo client-side ou migrar para views Supabase para períodos mais longos
- Estratégia de retenção para `log_importacao` (hoje cresce sem cleanup)
- Indexação em `historico_custos(codigo_produto, data_referencia)` para queries de drill-through

---

## FASE 4 — INTELIGÊNCIA OPERACIONAL

**Status: FUTURO**

Objetivo: antecipar investigação humana.

### Funcionalidades planejadas

- Ranking automático de risco (score composto: variação + instabilidade + mudança de regime)
- Sugestão de próximos produtos a investigar
- Detecção de sazonalidade vs. ruptura (produto que sobe todo trimestre vs. ruptura inesperada)
- Insights textuais operacionais ("produto X oscilou 4 meses consecutivos")
- Previsão de tendência por regressão simples

---

## NÃO PRIORIZAR (anti-roadmap)

- Features decorativas sem valor operacional
- Burocracia administrativa (multi-tenant, RBAC complexo enquanto for uso interno)
- Abstrações excessivas / overengineering
- Dashboards genéricos estilo Power BI
- Microserviços desnecessários
- IA genérica sem valor específico de auditoria de custos
