# Capítulo 8 — Relacionamentos e Cascata

## Cadeia de categorização
**Origem → Família → Agrupamento → Produto**

## Fonte da hierarquia
- `dicionario_produtos` fornece `origem_id`, `familia_id`, `agrupamento_cod` por produto.
- `categorias_origem` e `categorias_familia` enriquecem com descrição.

## Fonte de custos
- `historico_custos` contém apenas informações de custo por produto/data.

## Regra importante
A lógica de negócio não depende de textos como `FAMILIA XXXX`; depende de códigos e referências estruturadas.
