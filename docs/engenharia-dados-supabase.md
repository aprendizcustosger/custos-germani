# 🗄️ Documentação de Engenharia de Dados — Supabase (PostgreSQL)

Este documento descreve a estrutura de tabelas, relacionamentos e restrições (constraints) do sistema de auditoria de custos da Germani. O objetivo é garantir que o histórico de preços seja imutável, íntegro e que os filtros em cascata funcionem com precisão.

## 🏗️ Arquitetura de Dados

O banco foi desenhado com lógica de **Snowflake Schema**, separando dimensões (categorias) da tabela de fatos (histórico).

### 1) `categorias_origem`
Base da pirâmide de filtros.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único gerado automaticamente. |
| `descricao` | Text | Nome da Origem (ex.: Moagem, Massas, Biscoitos). |

### 2) `categorias_familia`
Segundo nível da hierarquia.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único. |
| `descricao` | Text | Nome da Família (ex.: Farinhas, Massas Ovos, Recheados). |

### 3) `dicionario_produtos`
Tabela mestre de amarração da hierarquia de produtos.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo_produto` | Text (PK) | Código identificador único da Germani. |
| `origem_cod` | UUID (FK) | Relaciona com `categorias_origem.id`. |
| `familia_cod` | UUID (FK) | Relaciona com `categorias_familia.id`. |
| `agrupamento_cod` | Text | Nome do agrupamento específico. |

### 4) `historico_custos` (Tabela de Fatos)
Armazena os dados importados das planilhas semanais.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | BigInt | ID sequencial. |
| `codigo_produto` | Text (FK) | Referência a `dicionario_produtos.codigo_produto`. |
| `descricao` | Text | Nome do produto no momento da importação. |
| `custo_total` | Numeric | Valor financeiro já normalizado (sem `R$`). |
| `data_referencia` | Date | Data escolhida no calendário da aplicação. |
| `criado_em` | Timestamp | Registro automático da data/hora do upload. |

---

## 🔒 Regras de Negócio e Constraints

### Chave composta para histórico limpo
A tabela `historico_custos` deve possuir a seguinte restrição de unicidade:

```sql
UNIQUE (codigo_produto, data_referencia)
```

**Efeito prático:** impede dois preços diferentes para o mesmo produto na mesma data. Isso habilita `upsert` seguro por `(codigo_produto, data_referencia)`.

### Integridade referencial (Foreign Keys)
As tabelas estão conectadas para evitar dados órfãos.

- Exclusões que quebrariam a hierarquia devem ser bloqueadas com `RESTRICT`.
- Exemplo: excluir uma origem com famílias vinculadas deve falhar.

---

## ⚡ Índices de Performance

Índices recomendados para ganho de desempenho:

- `idx_historico_data`: acelera consultas por período (`data_referencia`).
- `idx_dicionario_hierarquia`: acelera filtros em cascata (`origem_cod`, `familia_cod`, `agrupamento_cod`).

Exemplo:

```sql
create index if not exists idx_historico_data
  on historico_custos (data_referencia);

create index if not exists idx_dicionario_hierarquia
  on dicionario_produtos (origem_cod, familia_cod, agrupamento_cod);
```

---

## 💻 Query de Referência (Join)

Consulta padrão para relatórios de variação no período:

```sql
SELECT
  h.codigo_produto,
  h.descricao,
  h.custo_total,
  h.data_referencia,
  d.agrupamento_cod
FROM historico_custos h
LEFT JOIN dicionario_produtos d
  ON h.codigo_produto = d.codigo_produto
WHERE h.data_referencia BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY h.data_referencia ASC;
```

---

## 🛠️ Evolução sugerida: Auditoria por Usuário

Para rastrear quem enviou cada upload:

```sql
alter table historico_custos
  add column criado_por uuid references auth.users;
```

Com isso, cada linha de custo passa a ficar vinculada a um usuário autenticado.

---

## ✅ Resumo de Garantias do Modelo

- Histórico temporal consistente por produto/data.
- Filtros em cascata com base em dicionário central.
- Proteção contra dados órfãos via FKs.
- Boa performance para consultas de auditoria.
