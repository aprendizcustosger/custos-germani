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
Tabela **auxiliar** que armazena produtos e pode receber categorização derivada de `mapa_produtos`.

> **Importante:** `dicionario_produtos` **não é** a fonte principal de categorização.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo_produto` | Text (PK) | Código identificador único da Germani. |
| `origem_id` | UUID (FK) | Pode ser preenchido a partir de `mapa_produtos.origem_id`. |
| `familia_id` | UUID (FK) | Pode ser preenchido a partir de `mapa_produtos.familia_id`. |
| `agrupamento_cod` | Text | Pode ser preenchido a partir de `mapa_produtos.agrupamento_cod`. |


### 3.1) `dicionario_master_produtos`
Tabela **fonte única de verdade** para categorização automática de produtos durante importação.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo_produto` | Text (PK) | Código identificador único do produto. |
| `descricao` | Text | Descrição oficial do produto. |
| `familia_cod` | Text | Código de negócio da família (convertido para UUID em runtime). |
| `origem_cod` | Text | Código de negócio da origem (convertido para UUID em runtime). |

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

### 5) `mapa_produtos` (Tabela de apoio para agrupamento)
Tabela auxiliar para manter `agrupamento_cod` e legados operacionais.

Responsável por ligar (quando disponível):

`produto → agrupamento`

A categorização obrigatória de origem/família vem de `dicionario_master_produtos` + tabelas de categorias.

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
2. **Validação em `dicionario_master_produtos`** pelo `codigo_produto`.
3. **Conversão obrigatória** de `origem_cod/familia_cod` para UUID em `categorias_origem`/`categorias_familia`.
4. **Upsert em `dicionario_produtos`** com `descricao`, `origem_id`, `familia_id` e `agrupamento_cod` com prioridade:
   - `dicionario_produtos.agrupamento_cod` (valor já conhecido);
   - `dicionario_master_produtos.agrupamento_cod` (quando disponível);
   - `NULL` (não bloqueia importação).
5. **Inserção em `historico_custos`** somente para produtos válidos no dicionário mestre.
6. **Consulta de filtros** baseada em produtos com custo real (join `historico_custos` + `dicionario_produtos` + `categorias_agrupamento`).

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
  mp.agrupamento_cod,
  co.descricao AS origem,
  cf.descricao AS familia
FROM historico_custos h
LEFT JOIN mapa_produtos mp
  ON h.codigo_produto = mp.codigo_produto
LEFT JOIN categorias_origem co
  ON mp.origem_id = co.id
LEFT JOIN categorias_familia cf
  ON mp.familia_id = cf.id
WHERE h.data_referencia BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY h.data_referencia ASC;
```

---

## ✅ Resumo de Garantias do Modelo

- Histórico temporal consistente por produto/data.
- Categorização obrigatória centralizada em `dicionario_master_produtos` (com conversão para UUID).
- `dicionario_produtos` com papel auxiliar e derivado.
- Integridade por FKs com UUID e prevenção de erros de tipo.
- Boa performance para consultas de auditoria.



## 🧪 Query-base dos filtros (somente dados reais)

Os filtros devem listar apenas categorias/produtos efetivamente importados em `historico_custos`.

```sql
SELECT DISTINCT
  co.descricao AS origem
FROM historico_custos h
JOIN dicionario_produtos d ON h.codigo_produto = d.codigo_produto
JOIN categorias_origem co ON d.origem_id = co.id
WHERE d.origem_id IS NOT NULL;
```

Regras:
- não mostrar categorias sem dados;
- não mostrar produto só existente no dicionário mestre;
- não mostrar `NULL`/`undefined`.
