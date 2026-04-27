-- Ajusta precisão de custos para 4 casas decimais e garante tipo numérico.
alter table if exists public.historico_custos
  alter column custo_variavel type numeric(18,4) using round(custo_variavel::numeric, 4),
  alter column custo_direto_fixo type numeric(18,4) using round(custo_direto_fixo::numeric, 4),
  alter column custo_total type numeric(18,4) using round(custo_total::numeric, 4);
