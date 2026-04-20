# README Técnico — Pipeline de Auditoria de Custos

## 1) Importação (regras obrigatórias)
A planilha de entrada deve conter os 5 campos obrigatórios:

- `codigo_produto`
- `descricao`
- `custo_variavel`
- `custo_direto_fixo`
- `custo_total`

Regras:
- Ignorar quaisquer colunas extras.
- Não falhar por colunas adicionais.
- Não inferir categoria por texto.

## 2) Normalização de valores
Os valores monetários usam formato brasileiro e devem seguir:

1. remover separador de milhar (`.`)
2. substituir vírgula por ponto
3. converter para número
4. arredondar para 2 casas decimais

Exemplos:
- `1.234,56` → `1234.56`
- `10,3` → `10.30`
- `10,3456` → `10.35`

## 3) Dicionário master (fonte de verdade estrutural)
Tabela: `dicionario_master_produtos`

Campos:
- `codigo_produto`
- `descricao`
- `familia_cod`
- `origem_cod`

Regra:
- Contém todos os produtos para construção estrutural do dicionário.
- Nunca inferir por descrição.

## 4) Dicionário estruturado operacional
Tabela: `dicionario_produtos`

Campos:
- `codigo_produto`
- `descricao`
- `origem_id` (UUID)
- `familia_id` (UUID)
- `agrupamento_cod` (TEXT)

Conversão obrigatória:
- `familia_cod` → `categorias_familia.codigo` → `id` (UUID)
- `origem_cod` → `categorias_origem.codigo` → `id` (UUID)

## 5) Agrupamento (regra crítica)
Agrupamento é classificação técnica, não peso/embalagem.

Exemplos:
- `M003` → BISCOITO AMANTEIGADO
- `M004` → BISCOITO APERITIVO
- `M024` → MASSA COM OVOS

Origem dos códigos: `categorias_agrupamento`.

Regras:
- não inferir por peso;
- não usar regex de gramas/kg;
- usar somente códigos existentes.

## 6) Processo de importação
Para cada linha da planilha:
1. ler `codigo_produto`
2. buscar em `dicionario_produtos`
3. obter `origem_id`, `familia_id`, `agrupamento_cod`

Se não encontrar mapeamento completo:
- rejeitar/logar erro;
- não inserir com `NULL`.

Destino: `historico_custos`.

## 7) Histórico de custos
Tabela: `historico_custos`

Campos:
- `codigo_produto`
- `descricao`
- `custo_total`
- `data_referencia`

Constraint obrigatória:
- `UNIQUE (codigo_produto, data_referencia)`

Comportamento `ON CONFLICT`:
- atualizar `custo_total`.

## 8) Auditoria (filtros)
Regra crítica:
- filtros usam apenas dados reais (`historico_custos` + `dicionario_produtos`).

Não usar:
- `dicionario_master_produtos` diretamente na auditoria;
- produtos sem custo.

## 9) Consulta padrão
```sql
SELECT
  h.codigo_produto,
  h.custo_total,
  co.descricao AS origem,
  cf.descricao AS familia,
  ca.descricao AS agrupamento
FROM historico_custos h
JOIN dicionario_produtos d ON h.codigo_produto = d.codigo_produto
JOIN categorias_origem co ON d.origem_id = co.id
JOIN categorias_familia cf ON d.familia_id = cf.id
LEFT JOIN categorias_agrupamento ca ON d.agrupamento_cod = ca.codigo;
```

## 10) Regras críticas (não violar)
- Não salvar texto em UUID.
- Não usar descrição para categorizar.
- Não permitir `NULL` em origem/família.
- Não mostrar `null` nos filtros.
- Não misturar dicionário estrutural com dados reais de custo.

## Resultado esperado
- importação automática;
- dados consistentes;
- filtros limpos;
- zero erro de tipo;
- sistema robusto.
