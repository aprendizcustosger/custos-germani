# Capítulo 1 — Visão Geral

O sistema audita variação de custos por produto a partir de importação de planilhas e consulta histórica no Supabase.

## Objetivo
- Automatizar auditoria de custos.
- Consolidar dados de planilhas de origem ERP/SAP.
- Oferecer análise com filtros dinâmicos em cascata.

## Fluxo operacional real
1. Upload de planilha `.xlsx` com 5 colunas obrigatórias.
2. Normalização e validação dos dados.
3. Persistência em `historico_custos`.
4. Consulta por período com filtros: Origem → Família → Agrupamento → Produto.

## Público principal
- Controladoria
- Custos industriais
- Coordenação operacional
