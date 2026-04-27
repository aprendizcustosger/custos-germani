# Engenharia de Dados — Supabase (Estado Atual)

Este documento descreve o modelo efetivamente usado pelo sistema no código atual.

## 1) Modelo de dados principal

### `categorias_origem`
- `id` (UUID, chave técnica)
- `codigo` (TEXT, chave de negócio)
- `descricao` (TEXT)

### `categorias_familia`
- `id` (UUID, chave técnica)
- `codigo` (TEXT, chave de negócio)
- `descricao` (TEXT)

### `categorias_agrupamento`
- usada para enriquecer `agrupamento_cod` com descrição.
- o frontend usa `codigo`/`id` normalizado para montar opções de filtro.

### `dicionario_produtos`
Fonte operacional da hierarquia para a auditoria:
- `codigo_produto`
- `descricao`
- `origem_id`
- `familia_id`
- `agrupamento_cod`

### `historico_custos`
Tabela fato de custos:
- `codigo_produto`
- `descricao`
- `custo_variavel`
- `custo_direto_fixo`
- `custo_total`
- `data_referencia`

Regra operacional recomendada: `UNIQUE (codigo_produto, data_referencia)`.

---

## 2) Regras de identidade

- `codigo` em categorias é a referência de negócio.
- `id` UUID é referência técnica (FK).
- Frontend exibe `descricao`; backend persiste relacionamento técnico.
- Não usar descrição textual para definir categoria.

---

## 3) Categorização e cascata

Cascata da UI:

**Origem → Família → Agrupamento → Produto**

Fonte de dados usada pelo frontend:
- `api.getMasters` carrega histórico + dicionário + categorias.
- Filtros exibem apenas valores que aparecem em produtos com custo histórico.

`historico_custos` não armazena lógica de categorização; ele armazena custo por data.

---

## 4) Importação de planilha

Campos obrigatórios:
- Produto
- Descrição
- Custo Variável
- Custo Direto Fixo
- Custo Total

Comportamento:
- aceita colunas extras;
- ignora extras sem falhar;
- normaliza números com vírgula decimal;
- trabalha com precisão de até 4 casas decimais;
- valida linha a linha.

Antes de gravar custo, o sistema tenta garantir produto em `dicionario_produtos`.

---

## 5) Princípios de robustez

- Tolerância a dados imperfeitos.
- Processamento resiliente por linha (falha parcial não interrompe lote completo).
- Remoção de valores nulos nos filtros de UI.
- Consistência entre dicionário (hierarquia) e histórico (custos).

---

## 6) Problemas já endereçados

- UUID usado indevidamente como dado de negócio.
- Divergência entre documentação e colunas reais.
- Conversão numérica inconsistente para padrão brasileiro.
- Filtros vazios com `null`/`undefined`.
- Dependência de rotulagem textual estilo `FAMILIA XXXX`.
