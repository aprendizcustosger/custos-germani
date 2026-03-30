# Capítulo 7 — Views do Banco

## 7.1 Situação atual
O projeto não versiona views SQL no repositório.

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Views físicas | Não documentadas no repositório | Administração no Supabase |
| Consumo da aplicação | Consulta direta em tabelas | Simplicidade operacional |

## 7.2 VW_custos_periodo (recomendada)
Esta view recomendada facilita auditorias recorrentes.

**Propósito:** consolidar histórico com classificação por produto.

**Tabelas envolvidas:**
- `historico_custos` — fatos de custo
- `dicionario_produtos` — chaves de classificação

**Campos retornados:**
| Campo | Origem | Descrição |
|-------|--------|-----------|
| codigo_produto | historico_custos | Produto |
| data_referencia | historico_custos | Data |
| custo_total | historico_custos | Valor |
| origem_id | dicionario_produtos | Origem |
| familia_id | dicionario_produtos | Família |
| agrupamento_cod | dicionario_produtos | Agrupamento |
