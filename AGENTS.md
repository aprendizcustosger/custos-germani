Você está trabalhando no projeto **Kustos Germani**, um motor de investigação operacional de custos.

O sistema NÃO é:

* ERP genérico
* CRUD administrativo
* dashboard decorativo
* réplica de Power BI ou Metabase

O sistema É:

* ferramenta de investigação operacional de custos
* camada analítica sobre dados ERP/SAP
* cockpit de auditoria investigativa
* motor de detecção de anomalias operacionais

---

# PRINCÍPIO MAIS IMPORTANTE

## Velocidade de investigação acima de tudo.

Toda mudança deve responder:

> "isso ajuda a encontrar problemas mais rápido?"

Se não ajudar: não implemente, simplifique ou remova.

---

# ARQUITETURA DE DADOS (NÃO VIOLAR)

## Separação FATO × DIMENSÃO é obrigatória

### Tabela fato:
* `historico_custos`

### Dimensões:
* `dicionario_produtos`
* `categorias_origem`
* `categorias_familia`
* `categorias_agrupamento`

NUNCA misturar lógica temporal com categorização.

---

# SEMÂNTICA TEMPORAL (CRÍTICO)

O sistema tem dois eixos de tempo. Nunca confundir:

| Campo | Significado | Uso |
|---|---|---|
| `data_referencia` | Competência operacional | Quando o custo é válido (mês de referência ERP) |
| `criado_em` | Evento de importação | Quando o dado entrou no sistema |

### Regras:
- `data_referencia` é usado para análise de período e drill-through temporal
- `criado_em` é usado para identificar "última importação" e "penúltima importação"
- A UI deve sempre rotular explicitamente qual eixo está sendo exibido
- Nunca exibir "Última Atualização" sem especificar se é competência ou importação

---

# REGRAS TÉCNICAS OBRIGATÓRIAS

* NÃO usar RPC
* NÃO executar SQL bruto no frontend
* Usar apenas `supabase.from()`
* Frontend exibe `descricao` (nunca UUID como semântica de negócio)
* Backend usa `codigo`/FK
* UUID é chave técnica, nunca semântica de negócio
* NÃO usar descrição textual para lógica de categorização
* NÃO armazenar credenciais em código-fonte

---

# IMPORTAÇÃO

A importação deve ser:

* resiliente
* tolerante a erros linha a linha
* tolerante a colunas extras
* validada antes de gravar
* registrada em `log_importacao`

Falha de linha NÃO deve derrubar lote inteiro.

Produto novo importado sem categoria deve ser sinalizado no banner de órfãos — não silenciado.

---

# UX INVESTIGATIVA

## Busca direta é prioridade

O investigador deve poder digitar um código de produto e chegar à análise sem navegar pela hierarquia Origem → Família → Agrupamento.

## Drill-through é obrigatório

Clicar em qualquer produto deve abrir o histórico completo de eventos de custo:
- competência de cada registro
- data de importação de cada registro
- delta monetário e percentual vs. registro anterior
- destaque visual para variações relevantes (≥5%)

## Detecção de mudança de regime

Produto que era ESTÁVEL e ficou instável = anomalia operacional prioritária.
Deve aparecer como KPI e como coluna na tabela.

## Filtros

Filtros devem:
* ser rápidos
* ser em cascata
* mostrar apenas dados reais existentes
* nunca mostrar null/undefined
* auto-atualizar o relatório ao mudar (sem necessidade de clicar "Analisar" após primeiro run)

---

# PERFORMANCE

Preferir:
* processamento local quando o dataset couber em memória razoavelmente
* datasets já carregados (evitar re-fetch do que já está em state)
* debounce em listeners de real-time (evitar loops de reload durante imports em lote)

Evitar:
* loops com múltiplas chamadas Supabase sequenciais por linha
* recálculo desnecessário em dados já processados
* renderizações excessivas de Chart.js (destruir e recriar apenas quando necessário)

---

# MÓDULOS DO SISTEMA

| Arquivo | Responsabilidade |
|---|---|
| `view/ui-controller.js` | Eventos de UI, orquestração de fluxos, gráficos |
| `core/spreadsheet-engine.js` | Parsing de planilhas, detecção de colunas, normalização numérica |
| `core/report-engine.js` | Cálculos analíticos, cascata, detecção de regime |
| `src/services/api.js` | Camada única de acesso Supabase (I/O) |
| `services/api.js` | Shim de compatibilidade de import (re-exporta de src/services/api.js) |
| `core/heuristic-engine.js` | Módulo de sugestão de categoria (não conectado ao fluxo principal ainda) |

---

# DIREÇÃO DO PRODUTO

O sistema deve evoluir para:
* motor de investigação operacional
* detecção automática de anomalias
* priorização de risco por produto
* análise comportamental temporal

E NÃO para:
* ERP administrativo
* sistema burocrático
* CRUD complexo

---

# DOCUMENTAÇÃO

SEMPRE atualizar ao fazer mudanças relevantes:
* `README.md`
* `VISION.md`
* `ROADMAP.md`
* `AGENTS.md` (este arquivo)
* `docs/` conforme aplicável

Toda mudança de comportamento temporal, de filtro ou de modelo de dados DEVE ser documentada com a distinção `data_referencia` vs. `criado_em`.

- Atualização 2026-05-11: credenciais Supabase devem entrar via config de ambiente/runtime; `autoAuthenticate` está proibido.
