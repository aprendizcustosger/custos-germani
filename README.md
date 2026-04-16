# 📂 DOCUMENTAÇÃO TÉCNICA: MOTOR DE CUSTOS GERMANI

## 📝 Visão Geral
Este sistema foi projetado para automatizar a auditoria de custos da **Germani Alimentos**.  
O objetivo central é transformar planilhas brutas de ERP/SAP em visualizações estratégicas de histórico de custos, sem que o usuário precise tratar o Excel manualmente.

---

## 🛠️ 1. O Pacto da Importação (Tolerância Zero a Rigidez)
O motor de importação deve operar como **Filtro Seletivo**:

### As 5 colunas obrigatórias
1. **Produto** (código identificador)
2. **Descrição** (nome para categorização)
3. **Custo Variável**
4. **Custo Direto Fixo**
5. **Custo Total**

### Regra de Ouro
Ignore qualquer outra coluna (ex.: `CIF`, `Derivação`, `Data de Cadastro`).  
Se a planilha tiver 100 colunas extras, o sistema deve ignorar o “lixo” e capturar apenas as 5 colunas acima.  
**Nunca retornar erro por “coluna inválida” quando as colunas obrigatórias forem encontradas.**

---

## 🧬 2. Hierarquia de Categorização (Cascata)
Para o **Pente Fino (Auditoria)** funcionar, aplicar a lógica de afunilamento:

### A) ORIGEM (Grande Grupo)
Define a unidade de produção:
- **MOAGEM**: tudo que nasce do trigo (farinhas e misturas)
- **BISCOITOS**: linha de produção de assados
- **MASSAS**: linha de produção de massas alimentícias

### B) FAMÍLIA (Subgrupo Técnico)
O sistema usa a descrição do produto para sugerir a família:
- **M012 (Biscoito Solto Doce)**: descrição contém `BISCOITO`, `ROSQUINHA` ou `WAFER`
- **M024 (Massa com Ovos)**: descrição contém `MASSA`, `OVOS`, `ESPAGUETE` ou `PARAFUSO`
- **M000 (Misturas Gerais)**: descrição contém `FARINHA`, `TRIGO` ou `MISTURA`

### C) AGRUPAMENTO (Formato)
Define peso/tipo de embalagem (ex.: `400g`, `5kg`, `Granel`).

### D) ITEM (SKU Final)
Produto específico (ex.: `Biscoito Recheado Chocolate 400g`).

---

## 💾 3. Estrutura do Banco de Dados (Supabase)
As relações devem ser respeitadas para que os filtros da tela não fiquem vazios.

| Tabela | Função | Coluna Chave |
|---|---|---|
| `origens` | Lista as unidades (Biscoitos, Massas) | `id` (Text) |
| `familias` | Lista os tipos (M012, M024) | `id` (Text) |
| `dicionario_produtos` | Onde o produto é “batizado” e categorizado | `codigo_produto`, `origem_id`, `familia_id` |
| `historico_custos` | Onde os valores de cada mês são salvos | `produto_id`, `custo_total`, `data_importacao` |

---

## 🚩 4. Requisitos de User Experience (UX)
Para dar segurança ao usuário:

### Feedback instantâneo
Ao terminar upload, o sistema deve exibir:

> **Sucesso! [X] itens foram importados com sucesso.**

### Carga automática
Ao entrar na tela de Auditoria, o sistema deve buscar imediatamente:
- lista de **Origens**
- lista de **Famílias**

Objetivo: os `selects` nunca aparecerem vazios.

### Flexibilidade de gráfico
O gráfico de barras deve carregar mesmo com filtro parcial.  
Exemplo: apenas **Origem** selecionada já deve permitir renderização.

---

## ⚠️ Erros para Nunca Repetir
1. **Erro de UUID**  
   Nunca enviar texto `"PENDENTE"` para coluna de ID.  
   Use ID real (`M000`, `M012`, etc.) ou `null`.

2. **Erro de Sintaxe**  
   Não declarar variáveis com o mesmo nome (ex.: `suggestion`) no mesmo escopo.

3. **Erro de Cache/Atualização de dados**  
   Sempre recarregar dados do Supabase após alterações de banco para refletir na interface.

---

## ✅ Princípio Operacional
O sistema prioriza:
- robustez com dados reais de ERP/SAP,
- tolerância a planilhas imperfeitas,
- clareza de feedback para o usuário final,
- e consistência entre importação, categorização e auditoria.

---

## 🧩 Módulo: Higienização dos filtros (Origem, Família, Agrupamento)

### Objetivo
Garantir que os dropdowns exibam **somente descrições válidas**, sem:
- valores `NULL`,
- strings `"null"` / `"undefined"`,
- códigos técnicos isolados quando existir descrição cadastrada.

### Regras aplicadas
1. **Fonte da hierarquia**: a lista é derivada de `mapa_produtos` + tabelas de categorias.
2. **Família**: exibe descrição da `categorias_familia` (ex.: `1002 = ACUCARES`).
3. **Agrupamento**: exibe descrição da `categorias_agrupamento` (ex.: `M024 = MASSAS COM OVOS`).
4. **Origem**: exibe descrição da `categorias_origem` (ex.: `400 = MASSA PRODUZIDA FARDO/CX`).
5. **Frontend**: aplica filtro defensivo antes de montar qualquer `<select>`.

### Resultado esperado na UI
- `TODAS/TODOS` + apenas opções válidas.
- Nunca mostrar `"null"` como item selecionável.
- Nunca tratar `M024` como Família; `M024` pertence ao Agrupamento.

---

## 🛠️ Correção de Categorização via `mapa_produtos` (Supabase/PostgreSQL)

> **Regra mandatória de produção**:  
> `codigo_produto → mapa_produtos → categorias`  
> **Sem inferência por descrição como regra principal.**

### Escopo da correção
- Preencher `mapa_produtos` apenas com IDs válidos (`uuid`) vindos das tabelas de categoria.
- Ignorar linhas inconsistentes (código sem correspondência em categoria).
- Não sobrescrever registros já existentes em `mapa_produtos`.
- Atualizar `dicionario_produtos` exclusivamente a partir do `mapa_produtos`.
- Entregar diagnósticos para produtos sem categorização.

### Pré-condição de tipos (uuid vs text)
Se `origem_id` e `familia_id` estiverem como `text` em `dicionario_produtos`, alinhar para `uuid` **antes** dos updates finais.

```sql
-- 0) (Opcional, executar apenas se necessário)
-- Converter colunas para UUID em dicionario_produtos sem perda de consistência.
ALTER TABLE dicionario_produtos
  ALTER COLUMN origem_id TYPE uuid USING NULLIF(origem_id::text, '')::uuid,
  ALTER COLUMN familia_id TYPE uuid USING NULLIF(familia_id::text, '')::uuid;
```

### 1) SQL completo para popular `mapa_produtos` corretamente

> **Premissa:** existe uma tabela de staging (ex.: `stg_mapa_produtos`) com os campos:  
> `codigo_produto`, `origem_cod`, `familia_cod`, `agrupamento_cod`.

```sql
BEGIN;

WITH fonte AS (
  SELECT
    TRIM(s.codigo_produto)            AS codigo_produto,
    TRIM(s.origem_cod)                AS origem_cod,
    TRIM(s.familia_cod)               AS familia_cod,
    NULLIF(TRIM(s.agrupamento_cod), '') AS agrupamento_cod
  FROM stg_mapa_produtos s
  WHERE NULLIF(TRIM(s.codigo_produto), '') IS NOT NULL
),
normalizada AS (
  SELECT DISTINCT ON (f.codigo_produto)
    f.codigo_produto,
    f.origem_cod,
    f.familia_cod,
    f.agrupamento_cod
  FROM fonte f
  ORDER BY f.codigo_produto
),
convertida AS (
  SELECT
    n.codigo_produto,
    co.id AS origem_id,       -- UUID real
    cf.id AS familia_id,      -- UUID real
    n.agrupamento_cod
  FROM normalizada n
  JOIN categorias_origem  co ON co.codigo = n.origem_cod
  JOIN categorias_familia cf ON cf.codigo = n.familia_cod
  LEFT JOIN categorias_agrupamento ca ON ca.id = n.agrupamento_cod
  WHERE n.agrupamento_cod IS NULL OR ca.id IS NOT NULL
)
INSERT INTO mapa_produtos (
  codigo_produto,
  origem_id,
  familia_id,
  agrupamento_cod
)
SELECT
  c.codigo_produto,
  c.origem_id,
  c.familia_id,
  c.agrupamento_cod
FROM convertida c
ON CONFLICT (codigo_produto) DO NOTHING;

COMMIT;
```

### 2) SQL para atualizar `dicionario_produtos` com base no mapa

```sql
UPDATE dicionario_produtos dp
SET
  origem_id = mp.origem_id,
  familia_id = mp.familia_id,
  agrupamento_cod = mp.agrupamento_cod
FROM mapa_produtos mp
WHERE dp.codigo_produto = mp.codigo_produto
  AND (
    dp.origem_id IS DISTINCT FROM mp.origem_id OR
    dp.familia_id IS DISTINCT FROM mp.familia_id OR
    dp.agrupamento_cod IS DISTINCT FROM mp.agrupamento_cod
  );
```

### 3) SQL de diagnóstico (produtos sem categorização no mapa)

```sql
SELECT dp.codigo_produto
FROM dicionario_produtos dp
LEFT JOIN mapa_produtos mp
  ON dp.codigo_produto = mp.codigo_produto
WHERE mp.codigo_produto IS NULL;
```

### 4) Diagnóstico adicional de integridade (recomendado)

```sql
-- 4.1) Registros inválidos no mapa (não deveria retornar linhas)
SELECT mp.codigo_produto, mp.origem_id, mp.familia_id
FROM mapa_produtos mp
LEFT JOIN categorias_origem  co ON co.id = mp.origem_id
LEFT JOIN categorias_familia cf ON cf.id = mp.familia_id
WHERE co.id IS NULL OR cf.id IS NULL;

-- 4.2) Produtos do dicionário ainda sem origem/família após sincronização
SELECT dp.codigo_produto
FROM dicionario_produtos dp
WHERE dp.origem_id IS NULL
   OR dp.familia_id IS NULL;
```

### 5) Regras finais de produção
- Nunca gravar código (`400`, `40001`) direto em `origem_id`/`familia_id`.
- Sempre converter `codigo -> id (uuid)` via `categorias_origem` e `categorias_familia`.
- Join final de negócio sempre em tipos compatíveis:
  - `uuid ↔ uuid` para IDs.
  - `text ↔ text` para `codigo_produto` e `agrupamento_cod`.
- `descricao` não participa da regra principal de categorização.
- Para preservar dados existentes, usar `ON CONFLICT DO NOTHING` no `mapa_produtos`.
