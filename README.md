# Kustos Germani — Motor de Investigação de Custos

Sistema operacional de auditoria analítica de custos. Não é um dashboard genérico.

É um cockpit investigativo que transforma planilhas ERP em velocidade de investigação.

---

## Documentos estratégicos

- `VISION.md`: identidade do produto, princípios e direção estratégica
- `ROADMAP.md`: fases entregues e próximas, com raciocínio de priorização
- `AGENTS.md`: guia para agentes e desenvolvedores (regras técnicas e de produto)
- `docs/arquitetura/indice-documentacao-kustos.md`: índice da documentação técnica

---

## 1. Visão Geral

O sistema importa planilhas de custo (origem ERP/SAP), armazena histórico temporal e oferece investigação analítica por produto com filtros em cascata e drill-through de eventos.

**Princípio central**: o investigador deve encontrar o problema em segundos, não em minutos.

---

## 2. Fluxo Operacional

### Importação

1. Selecionar data de referência (competência operacional)
2. Arrastar planilha `.xlsx` ou clicar na área de upload
3. Confirmar mapeamento de colunas (detecção automática com fuzzy matching)
4. Revisar preview linha a linha (🟢 válida / 🟡 atenção / 🔴 erro)
5. Confirmar importação — somente linhas sem erro são gravadas

### Auditoria

1. **Busca direta** (novo): digitar código ou descrição — acesso imediato sem navegar pela hierarquia
2. Ou usar filtros em cascata: Origem → Família → Agrupamento → Item
3. Definir período (dtInício + dtFim) — relatório atualiza automaticamente
4. Clicar em qualquer linha da tabela → abre **drill-through** com histórico completo de importações
5. Usar KPIs clicáveis para filtrar rapidamente:
   - **Itens analisados**: todos
   - **Alertas (>5%)**: variações relevantes entre importações
   - **Mudanças de Regime**: produtos que eram ESTÁVEL e ficaram instáveis
   - **Média de variação**: variações positivas
6. Exportar relatório para Excel

---

## 3. Arquitetura de Dados

### Separação Fato × Dimensão

**Tabela fato**: `historico_custos`
- `codigo_produto` (TEXT)
- `descricao` (TEXT) — snapshot no momento da importação
- `custo_variavel` (NUMERIC 18,4)
- `custo_direto_fixo` (NUMERIC 18,4)
- `custo_total` (NUMERIC 18,4)
- `data_referencia` (DATE) — **competência operacional** (quando o custo é válido)
- `criado_em` (TIMESTAMPTZ) — **evento de importação** (quando entrou no sistema)
- UNIQUE: `(codigo_produto, data_referencia)`

**Dimensão produtos**: `dicionario_produtos`
- `codigo_produto` (TEXT) — chave de negócio
- `origem_id` (UUID) → `categorias_origem.id`
- `familia_id` (UUID) → `categorias_familia.id`
- `agrupamento_cod` (TEXT) → `categorias_agrupamento.codigo`

**Dimensões de categoria**: `categorias_origem`, `categorias_familia`, `categorias_agrupamento`
- `id` (UUID): chave técnica de integração
- `codigo` (TEXT): chave de negócio
- `descricao` (TEXT): rótulo exibido na UI

### Semântica Temporal (importante)

O sistema tem dois eixos de tempo distintos:

| Campo | Uso |
|---|---|
| `data_referencia` | Período de competência do custo — usado para análise temporal |
| `criado_em` | Data de importação — usado para identificar "última importação" vs. "penúltima" |

Estes conceitos nunca devem ser confundidos. O drill-through exibe os dois explicitamente.

---

## 4. Capacidades Analíticas

### Score de Instabilidade

Média das variações percentuais absolutas entre pontos consecutivos no período:
- `ESTÁVEL`: score < 3%
- `OSCILANDO`: score 3–8%
- `MUITO INSTÁVEL`: score ≥ 8%

### Detecção de Mudança de Regime

Produto com ≥ 4 pontos no período: compara instabilidade da primeira metade vs. segunda metade.
- `ESTÁVEL` na primeira metade + `OSCILANDO` ou `MUITO INSTÁVEL` na segunda → `mudouRegime = true`
- Aparece como KPI "Mudanças de Regime" e coluna "⚡ Mudou" na tabela

### Drill-through de Eventos

Histórico completo de importações para o produto selecionado:
- Competência (data_referencia): período de vigência
- Importado em (criado_em): data/hora da entrada no sistema
- Custo variável, direto fixo e total
- Delta monetário e percentual vs. registro anterior
- Destaque em vermelho para variações ≥ 5%

### TOP VARIAÇÕES

Compara automaticamente os dois últimos eventos de importação (`criado_em`):
- TOP 5 maiores aumentos de custo
- TOP 5 maiores reduções de custo

### Alerta de Importação

Variação > 5% entre os dois últimos imports de um produto → badge ALERTA.

---

## 5. Módulos

| Arquivo | Responsabilidade |
|---|---|
| `view/ui-controller.js` | Orquestração de UI, busca, drill-through, export, gráficos |
| `core/spreadsheet-engine.js` | Parsing de planilhas, detecção fuzzy de colunas, normalização |
| `core/report-engine.js` | Cálculos analíticos, cascata, detecção de regime |
| `src/services/api.js` | Camada única de acesso Supabase |
| `services/api.js` | Shim de compatibilidade (re-exporta de src/services) |
| `assets/style.css` | Estilos globais |
| `index.html` | Estrutura HTML e carregamento de dependências |

### Dependências externas (CDN)

- `XLSX.js`: leitura e exportação de planilhas Excel
- `Chart.js`: gráficos temporais e de comparação
- `SweetAlert2`: diálogos de confirmação e preview
- `Supabase JS v2`: acesso ao banco de dados
- `RemixIcon`: ícones

---

## 6. Regras de Identidade

- **Backend/persistência**: lógica via código de negócio + FKs técnicas
- **Frontend**: exibe `descricao` — UUID nunca é semântica de negócio na UI
- **Categorização**: nunca depende de texto livre — sempre opera por código/FK
- **Credenciais**: nunca armazenadas em código-fonte

---

## 7. Importação — Comportamento

### Colunas obrigatórias (5)

| Campo | Aliases detectados automaticamente |
|---|---|
| `codigo_produto` | produto, codigo, cod, item, cod produto |
| `descricao` | descrição, desc |
| `custo_variavel` | custo variavel, custo var, variavel |
| `custo_direto_fixo` | fixo, direto fixo, custo fixo |
| `custo_total` | total, custo total, vl total, valor total |

### Parsing numérico

- Remove separadores de milhar e símbolo R$
- Converte vírgula decimal para ponto
- Arredonda para 4 casas decimais (exibição em 2-4 casas)
- Trata notação científica em códigos de produto

### Produto novo

Se o código não existe em `dicionario_produtos`, é criado automaticamente com categorização nula.
O banner de órfãos sinaliza quantos produtos estão sem categoria.

---

## 8. Filtros em Cascata

Cascata funcional: **Origem → Família → Agrupamento → Produto**

- Apenas categorias com custo histórico real aparecem nos filtros
- Mudança de Origem reseta Família, Agrupamento e Item
- Mudança de Família reseta Agrupamento e Item
- Filtros auto-atualizam o relatório quando período está preenchido

### Busca Rápida (bypass da hierarquia)

Campo de busca aceita código puro (`M012`) ou formato `M012 - DESCRIÇÃO`.
Seta o Item diretamente e executa o relatório em 1 interação.

---

## 9. Análise Temporal

- **Modo produto** (Item selecionado): série com o custo do produto específico
- **Modo agregado** (sem Item específico): média de custo dos produtos do filtro por data
- Linha auxiliar: média histórica do período (tracejada)
- Badge de tendência: 🟢 Estável / 🔺 Alta / 🔻 Queda

---

## 10. Boas Práticas Técnicas

- `codigo` é referência de negócio em categorias; `id` UUID é referência técnica
- Nunca depender de texto livre para categorização
- `data_referencia` = competência; `criado_em` = evento de importação (não confundir)
- Real-time debounced: 2s de delay para evitar reloads em cascata durante imports
- Export via XLSX.js (mesma biblioteca já usada para leitura)
