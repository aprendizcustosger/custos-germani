-- Normalização de categorização (fonte única: mapa_produtos)
-- Objetivos:
-- 1) Garantir que mapa_produtos use UUID nas FKs (origem_id/familia_id).
-- 2) Impedir joins finais baseados em códigos de negócio (400, 40001, M024).
-- 3) Popular/atualizar mapa_produtos a partir de staging com conversão codigo -> UUID.
-- 4) Sincronizar dicionario_produtos como tabela auxiliar.

create table if not exists public.mapa_produtos (
  codigo_produto text primary key,
  origem_id uuid,
  familia_id uuid,
  agrupamento_cod text
);

create index if not exists idx_mapa_hierarquia
  on public.mapa_produtos (origem_id, familia_id, agrupamento_cod);

-- UPSERT oficial a partir de staging (stg_mapa_produtos)
-- Campos esperados em staging: codigo_produto, origem_cod, familia_cod, agrupamento_cod.
with fonte as (
  select
    trim(s.codigo_produto) as codigo_produto,
    trim(s.origem_cod) as origem_cod,
    trim(s.familia_cod) as familia_cod,
    nullif(trim(s.agrupamento_cod), '') as agrupamento_cod
  from public.stg_mapa_produtos s
  where nullif(trim(s.codigo_produto), '') is not null
),
normalizada as (
  select distinct on (f.codigo_produto)
    f.codigo_produto,
    f.origem_cod,
    f.familia_cod,
    f.agrupamento_cod
  from fonte f
  order by f.codigo_produto
),
convertida as (
  select
    n.codigo_produto,
    co.id as origem_id,
    cf.id as familia_id,
    n.agrupamento_cod
  from normalizada n
  join public.categorias_origem co
    on co.codigo = n.origem_cod
  join public.categorias_familia cf
    on cf.codigo = n.familia_cod
  left join public.categorias_agrupamento ca
    on ca.id::text = n.agrupamento_cod
  where n.agrupamento_cod is null or ca.id is not null
)
insert into public.mapa_produtos (
  codigo_produto,
  origem_id,
  familia_id,
  agrupamento_cod
)
select
  c.codigo_produto,
  c.origem_id,
  c.familia_id,
  c.agrupamento_cod
from convertida c
on conflict (codigo_produto)
do update set
  origem_id = excluded.origem_id,
  familia_id = excluded.familia_id,
  agrupamento_cod = excluded.agrupamento_cod;

-- Sincronização auxiliar: dicionario_produtos herda categorização do mapa (não é fonte da verdade).
update public.dicionario_produtos dp
set
  origem_id = mp.origem_id,
  familia_id = mp.familia_id,
  agrupamento_cod = mp.agrupamento_cod
from public.mapa_produtos mp
where dp.codigo_produto = mp.codigo_produto
  and (
    dp.origem_id is distinct from mp.origem_id or
    dp.familia_id is distinct from mp.familia_id or
    dp.agrupamento_cod is distinct from mp.agrupamento_cod
  );

-- Diagnóstico obrigatório: produtos no dicionário sem mapeamento oficial.
select dp.codigo_produto
from public.dicionario_produtos dp
left join public.mapa_produtos mp
  on dp.codigo_produto = mp.codigo_produto
where mp.codigo_produto is null;
