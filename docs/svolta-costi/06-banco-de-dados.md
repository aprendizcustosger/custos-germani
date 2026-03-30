# Capítulo 6 — Banco de Dados

## 6.1 Convenções de nomenclatura
As tabelas existentes não seguem prefixo de módulo, mas adotam snake_case.

| Prefixo | Módulo | Exemplos |
|---------|--------|----------|
| `categorias_` | Dimensões | `categorias_origem`, `categorias_familia` |
| `dicionario_` | Mapeamento | `dicionario_produtos` |
| `historico_` | Fato | `historico_custos` |

## 6.2 categorias_origem — Catálogo de origem
Esta tabela mantém o primeiro nível de filtro.

| Campo | Tipo | Nulo | Chave | Default | Descrição |
|-------|------|------|-------|---------|-----------|
| id | uuid | NÃO | PK | gen_random_uuid() | Identificador |
| descricao | text | NÃO | | | Nome da origem |

## 6.3 categorias_familia — Catálogo de família
Esta tabela mantém o segundo nível de filtro.

| Campo | Tipo | Nulo | Chave | Default | Descrição |
|-------|------|------|-------|---------|-----------|
| id | uuid | NÃO | PK | gen_random_uuid() | Identificador |
| descricao | text | NÃO | | | Nome da família |

## 6.4 categorias_agrupamento — Catálogo de agrupamento
Esta tabela suporta labels de agrupamento na UI.

| Campo | Tipo | Nulo | Chave | Default | Descrição |
|-------|------|------|-------|---------|-----------|
| id | uuid/text | NÃO | PK | | Identificador |
| descricao | text | NÃO | | | Nome do agrupamento |

## 6.5 dicionario_produtos — Amarração hierárquica
Esta tabela relaciona produto à hierarquia.

| Campo | Tipo | Nulo | Chave | Default | Descrição |
|-------|------|------|-------|---------|-----------|
| codigo_produto | text | NÃO | PK | | Código do produto |
| origem_id | uuid | SIM | FK | | Ref. `categorias_origem.id` |
| familia_id | uuid | SIM | FK | | Ref. `categorias_familia.id` |
| agrupamento_cod | uuid/text | SIM | FK | | Ref. agrupamento |

## 6.6 historico_custos — Fato de custos
Esta tabela armazena os valores por data de referência.

| Campo | Tipo | Nulo | Chave | Default | Descrição |
|-------|------|------|-------|---------|-----------|
| id | bigint | NÃO | PK | identity | Identificador técnico |
| codigo_produto | text | NÃO | FK | | Ref. `dicionario_produtos.codigo_produto` |
| descricao | text | SIM | | | Descrição importada |
| custo_total | numeric | SIM | | | Valor de custo |
| data_referencia | date | NÃO | UK | | Data de competência |
| user_id | uuid | SIM | FK | | Usuário do upload |
| operacao_timestamp | timestamptz | SIM | | now() | Momento da operação |

> **Importante:** a regra de negócio exige `UNIQUE (codigo_produto, data_referencia)`.
