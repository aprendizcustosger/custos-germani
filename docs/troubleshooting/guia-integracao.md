# Capítulo 19 — Guia de Integração

## Importação
A integração por planilha exige 5 campos obrigatórios:
- Produto
- Descrição
- Custo Variável
- Custo Direto Fixo
- Custo Total

Extras são ignorados sem falha.

## Regras numéricas
- aceitar vírgula decimal;
- converter para ponto;
- persistir até 4 casas decimais.

## Dados para auditoria
- Produto: vem de `historico_custos`.
- Origem/Família/Agrupamento: vêm de `dicionario_produtos` para produtos com custo.
- Filtros nunca devem apresentar valores nulos.
