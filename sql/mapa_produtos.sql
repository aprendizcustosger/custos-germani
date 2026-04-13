-- Tabela de mapeamento para lookup de categorização na importação.
create table if not exists public.mapa_produtos (
  codigo_produto text primary key,
  origem_id uuid,
  familia_id uuid,
  agrupamento_cod text
);

-- Garante categorização automática no mapa após inserção/atualização no dicionário.
-- Regras:
-- 1) Nunca grava código numérico em campo UUID: converte via tabelas de categorias.
-- 2) Exige mapeamento completo (origem/família/agrupamento) para evitar NULL no mapa.
-- 3) Faz UPSERT por codigo_produto.
create or replace function public.sync_mapa_produto_por_dicionario()
returns trigger
language plpgsql
as $$
declare
  v_origem_id uuid;
  v_familia_id uuid;
  v_agrupamento_cod text;
begin
  select co.id, cf.id, nullif(btrim(new.agrupamento_cod), '')
    into v_origem_id, v_familia_id, v_agrupamento_cod
  from public.categorias_origem co
  join public.categorias_familia cf
    on cf.codigo = new.familia_cod
  where co.codigo = new.origem_cod;

  if v_origem_id is null then
    raise exception using
      message = format(
        'Não foi possível categorizar %s: origem_cod %s não encontrada em categorias_origem.',
        new.codigo_produto,
        coalesce(new.origem_cod, '<NULL>')
      );
  end if;

  if v_familia_id is null then
    raise exception using
      message = format(
        'Não foi possível categorizar %s: familia_cod %s não encontrada em categorias_familia.',
        new.codigo_produto,
        coalesce(new.familia_cod, '<NULL>')
      );
  end if;

  if v_agrupamento_cod is null then
    raise exception using
      message = format(
        'Não foi possível categorizar %s: agrupamento_cod ausente no dicionario_produtos.',
        new.codigo_produto
      );
  end if;

  insert into public.mapa_produtos (codigo_produto, origem_id, familia_id, agrupamento_cod)
  values (new.codigo_produto, v_origem_id, v_familia_id, v_agrupamento_cod)
  on conflict (codigo_produto)
  do update set
    origem_id = excluded.origem_id,
    familia_id = excluded.familia_id,
    agrupamento_cod = excluded.agrupamento_cod;

  return new;
end;
$$;

drop trigger if exists trg_sync_mapa_produtos_dicionario on public.dicionario_produtos;
create trigger trg_sync_mapa_produtos_dicionario
after insert or update of origem_cod, familia_cod, agrupamento_cod, codigo_produto
on public.dicionario_produtos
for each row
execute function public.sync_mapa_produto_por_dicionario();

-- Backfill/ressincronização em lote para dados já existentes no dicionário.
insert into public.mapa_produtos (codigo_produto, origem_id, familia_id, agrupamento_cod)
select
  dp.codigo_produto,
  co.id as origem_id,
  cf.id as familia_id,
  dp.agrupamento_cod
from public.dicionario_produtos dp
join public.categorias_origem co
  on dp.origem_cod = co.codigo
join public.categorias_familia cf
  on dp.familia_cod = cf.codigo
where nullif(btrim(dp.agrupamento_cod), '') is not null
on conflict (codigo_produto)
do update set
  origem_id = excluded.origem_id,
  familia_id = excluded.familia_id,
  agrupamento_cod = excluded.agrupamento_cod;
