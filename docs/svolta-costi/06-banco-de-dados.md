# Capítulo 6 — Banco de Dados

## Tabelas centrais

### `categorias_origem`
- `id` UUID (chave técnica)
- `codigo` TEXT (chave de negócio)
- `descricao` TEXT

### `categorias_familia`
- `id` UUID (chave técnica)
- `codigo` TEXT (chave de negócio)
- `descricao` TEXT

### `dicionario_produtos`
- `codigo_produto` TEXT
- `descricao` TEXT
- `origem_id` UUID
- `familia_id` UUID
- `agrupamento_cod` TEXT

### `historico_custos`
- `codigo_produto` TEXT
- `descricao` TEXT
- `custo_variavel` NUMERIC(18,4)
- `custo_direto_fixo` NUMERIC(18,4)
- `custo_total` NUMERIC(18,4)
- `data_referencia` DATE

## Regra de identidade
- Frontend usa `descricao` para exibição.
- Backend usa códigos/FKs para consistência.
- UUID é chave técnica, não semântica de negócio.
