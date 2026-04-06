-- Função: calcula variação percentual de custo por produto entre duas datas.
-- Compatível com Supabase (PostgreSQL).
create or replace function public.calcular_variacao_percentual_produto(
  p_codigo_produto text,
  p_data_atual date,
  p_data_anterior date
)
returns table (
  codigo_produto text,
  custo_atual numeric,
  custo_anterior numeric,
  variacao_percentual numeric
)
language plpgsql
stable
as $$
declare
  v_custo_atual numeric;
  v_custo_anterior numeric;
begin
  -- Busca o custo do produto na data atual.
  select h.custo_total
    into v_custo_atual
  from public.historico_custos h
  where h.codigo_produto = p_codigo_produto
    and h.data_referencia = p_data_atual
  limit 1;

  -- Busca o custo do produto na data anterior.
  select h.custo_total
    into v_custo_anterior
  from public.historico_custos h
  where h.codigo_produto = p_codigo_produto
    and h.data_referencia = p_data_anterior
  limit 1;

  -- Regra: se não existe custo anterior OU custo anterior = 0,
  -- a variação percentual deve retornar NULL (evita divisão por zero).
  if v_custo_anterior is null or v_custo_anterior = 0 then
    return query
    select
      p_codigo_produto,
      v_custo_atual,
      v_custo_anterior,
      null::numeric as variacao_percentual;
    return;
  end if;

  return query
  select
    p_codigo_produto,
    v_custo_atual,
    v_custo_anterior,
    round(((v_custo_atual - v_custo_anterior) / v_custo_anterior) * 100, 2) as variacao_percentual;
end;
$$;


-- Query: lista todos os produtos com variação > 10% ou < -10%
-- entre duas datas de referência.
with produtos_periodo as (
  select distinct h.codigo_produto
  from public.historico_custos h
  where h.data_referencia in ('2026-04-01'::date, '2026-03-01'::date)
), variacoes as (
  select
    v.codigo_produto,
    v.custo_atual,
    v.custo_anterior,
    v.variacao_percentual
  from produtos_periodo p
  cross join lateral public.calcular_variacao_percentual_produto(
    p.codigo_produto,
    '2026-04-01'::date,
    '2026-03-01'::date
  ) v
)
select *
from variacoes
where variacao_percentual > 10
   or variacao_percentual < -10
order by variacao_percentual desc nulls last;


-- Query: ranking dos 10 produtos com maior aumento de custo no período
-- (considera apenas produtos com custo nas duas datas).
with custo_inicio as (
  select
    h.codigo_produto,
    max(h.descricao) as descricao,
    max(h.custo_total) as custo_inicio
  from public.historico_custos h
  where h.data_referencia = :data_inicio
  group by h.codigo_produto
),
custo_fim as (
  select
    h.codigo_produto,
    max(h.custo_total) as custo_fim
  from public.historico_custos h
  where h.data_referencia = :data_fim
  group by h.codigo_produto
),
base as (
  select
    i.codigo_produto,
    i.descricao,
    i.custo_inicio,
    f.custo_fim
  from custo_inicio i
  inner join custo_fim f
    on f.codigo_produto = i.codigo_produto
)
select
  b.codigo_produto,
  b.descricao,
  b.custo_inicio,
  b.custo_fim,
  round(((b.custo_fim - b.custo_inicio) / nullif(b.custo_inicio, 0)) * 100, 2) as variacao_percentual
from base b
where b.custo_inicio > 0
order by variacao_percentual desc
limit 10;
