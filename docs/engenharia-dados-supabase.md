# 🗄️ Documentação de Engenharia de Dados — Supabase (PostgreSQL)

Este documento descreve a estrutura de tabelas, relacionamentos, regras de identidade e fluxo real de dados do sistema de auditoria de custos da Germani.

> **Compromisso de documentação:** toda mudança de engenharia de dados deve atualizar este arquivo (e/ou docs correlatas) no mesmo ciclo de entrega.

## 🏗️ Arquitetura de Dados

O banco foi desenhado com lógica de **Snowflake Schema**, separando dimensões (categorias) da tabela de fatos (histórico).

### 1) `categorias_origem`
Base da pirâmide de filtros.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único gerado automaticamente. |
| `codigo` | Text (único) | Código de negócio (ex.: `400`). |
| `descricao` | Text | Nome da Origem (ex.: Moagem, Massas, Biscoitos). |

### 2) `categorias_familia`
Segundo nível da hierarquia.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificador único. |
| `codigo` | Text (único) | Código de negócio (ex.: `40001`). |
| `descricao` | Text | Nome da Família (ex.: Farinhas, Massas Ovos, Recheados). |

### 3) `dicionario_produtos`
Tabela de referência operacional para importação automática.

> **Importante:** a importação de custos só é aceita para produtos já presentes em `dicionario_produtos` com `origem_id` e `familia_id` válidos.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo_produto` | Text (PK) | Código identificador único da Germani. |
| `origem_id` | UUID (FK) | Pode ser preenchido a partir de `mapa_produtos.origem_id`. |
| `familia_id` | UUID (FK) | Pode ser preenchido a partir de `mapa_produtos.familia_id`. |
| `agrupamento_cod` | Text | Pode ser preenchido a partir de `mapa_produtos.agrupamento_cod`. |

### 4) `historico_custos` (Tabela de Fatos)
Armazena os dados importados das planilhas semanais.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | BigInt | ID sequencial. |
| `codigo_produto` | Text (FK) | Referência do item de custo importado. |
| `descricao` | Text | Nome do produto no momento da importação. |
| `custo_total` | Numeric | Valor financeiro já normalizado (sem `R$`). |
| `data_referencia` | Date | Data escolhida no calendário da aplicação. |
| `criado_em` | Timestamp | Registro automático da data/hora do upload. |

### 5) `mapa_produtos` (Tabela de Mapeamento)
Fonte **única de verdade** da categorização.

Responsável por ligar:

`produto → origem → familia → agrupamento`

Sem `mapa_produtos`, os produtos ficam sem categorização confiável para auditoria.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo_produto` | Text (PK) | Código do produto que será categorizado. |
| `origem_id` | UUID (FK) | FK para `categorias_origem.id`. |
| `familia_id` | UUID (FK) | FK para `categorias_familia.id`. |
| `agrupamento_cod` | Text | Código lógico/operacional de agrupamento. |

---

## 🔄 Fluxo de Dados

Fluxo real utilizado no sistema:

1. **Upload da planilha** na aplicação.
2. **Validação linha a linha em `dicionario_produtos`** por `codigo_produto`.
3. **Rejeição da linha** quando `origem_id` ou `familia_id` estiver ausente.
4. **UPSERT em `historico_custos`** com `ON CONFLICT (codigo_produto, data_referencia) DO UPDATE SET custo_total = EXCLUDED.custo_total`.
5. **Consulta via JOIN para auditoria** usando `historico_custos` + `dicionario_produtos` + tabelas de categoria.

---

## 🆔 Regra de Identidade (Crítica)

- Tabelas de categoria usam **UUID** como chave primária (`id`).
- Também possuem campo **`codigo`** (ex.: `400`, `40001`, `M024`) para referência de negócio.
- A tabela `mapa_produtos` usa sempre **UUID (`id`)** nas FKs (`origem_id`, `familia_id`) e **nunca código direto** nessas colunas.

---

## ✅ Regra de Consistência de JOINs

- **Nunca** usar números/códigos de negócio (`400`, `40001`) diretamente em joins finais.
- **Sempre** converter via tabelas de categorias (`codigo` → `id`) antes de persistir/referenciar.
- Isso evita erros de tipo e de integridade (`uuid` vs `text`).

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
- `idx_mapa_hierarquia`: acelera filtros em cascata (`origem_id`, `familia_id`, `agrupamento_cod`).

Exemplo:

```sql
create index if not exists idx_historico_data
  on historico_custos (data_referencia);

create index if not exists idx_mapa_hierarquia
  on mapa_produtos (origem_id, familia_id, agrupamento_cod);
```

---

## 💻 Query de Referência (Join de Auditoria)

Consulta padrão para relatórios de variação no período:

```sql
SELECT
  h.codigo_produto,
  h.descricao,
  h.custo_total,
  h.data_referencia,
  dp.agrupamento_cod,
  co.descricao AS origem,
  cf.descricao AS familia
FROM historico_custos h
JOIN dicionario_produtos dp
  ON h.codigo_produto = dp.codigo_produto
JOIN categorias_origem co
  ON dp.origem_id = co.id
JOIN categorias_familia cf
  ON dp.familia_id = cf.id
WHERE h.data_referencia BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY h.data_referencia ASC;
```

---

## ✅ Resumo de Garantias do Modelo

- Histórico temporal consistente por produto/data.
- Categorização oficial centralizada em `mapa_produtos`.
- `dicionario_produtos` com papel auxiliar e derivado.
- Integridade por FKs com UUID e prevenção de erros de tipo.
- Boa performance para consultas de auditoria.
