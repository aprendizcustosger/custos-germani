# Capítulo 15 — Migrações

## 15.1 Estratégia de versionamento
As migrações SQL não estão versionadas no repositório atual. O controle ocorre no painel Supabase.

## 15.2 Scripts recomendados
Abaixo está uma proposta de baseline para consistência operacional.

```sql
-- 001_unique_historico.sql
alter table historico_custos
  add constraint uk_historico_codigo_data unique (codigo_produto, data_referencia);

-- 002_idx_historico_data.sql
create index if not exists idx_historico_data
  on historico_custos (data_referencia);

-- 003_idx_dicionario_hierarquia.sql
create index if not exists idx_dicionario_hierarquia
  on dicionario_produtos (origem_id, familia_id, agrupamento_cod);
```

## 15.3 Controle de execução

| Propriedade | Valor |
|-------------|-------|
| Ordem | Sequencial por prefixo numérico |
| Rollback | Script reverso por migração |
| Evidência | Log no changelog interno |
