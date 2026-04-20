-- Tabela mestre de categorização (fonte única de verdade).
create table if not exists public.dicionario_master_produtos (
  codigo_produto text primary key,
  descricao text not null,
  familia_cod text not null,
  origem_cod text not null,
  agrupamento_cod text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_dicionario_master_origem_cod
  on public.dicionario_master_produtos (origem_cod);

create index if not exists idx_dicionario_master_familia_cod
  on public.dicionario_master_produtos (familia_cod);

create index if not exists idx_dicionario_master_agrupamento_cod
  on public.dicionario_master_produtos (agrupamento_cod);

-- Trigger simples para manter atualizado_em.
create or replace function public.touch_dicionario_master_produtos()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_dicionario_master_produtos on public.dicionario_master_produtos;
create trigger trg_touch_dicionario_master_produtos
before update on public.dicionario_master_produtos
for each row
execute function public.touch_dicionario_master_produtos();

-- Staging para importação do arquivo "Banco de Dados.txt".
create table if not exists public.stg_dicionario_master_produtos (
  codigo_produto text,
  descricao text,
  familia_cod text,
  origem_cod text,
  agrupamento_cod text
);

-- Exemplo de carga local (psql):
-- \copy public.stg_dicionario_master_produtos (codigo_produto, descricao, familia_cod, origem_cod, agrupamento_cod)
-- from 'Banco de Dados.txt' with (format csv, delimiter E'\t', header true, encoding 'LATIN1');

insert into public.dicionario_master_produtos (
  codigo_produto,
  descricao,
  familia_cod,
  origem_cod,
  agrupamento_cod
)
select distinct on (trim(codigo_produto))
  trim(codigo_produto) as codigo_produto,
  trim(descricao) as descricao,
  trim(familia_cod) as familia_cod,
  trim(origem_cod) as origem_cod,
  nullif(trim(agrupamento_cod), '') as agrupamento_cod
from public.stg_dicionario_master_produtos
where nullif(trim(codigo_produto), '') is not null
  and nullif(trim(descricao), '') is not null
  and nullif(trim(familia_cod), '') is not null
  and nullif(trim(origem_cod), '') is not null
order by trim(codigo_produto)
on conflict (codigo_produto)
do update set
  descricao = excluded.descricao,
  familia_cod = excluded.familia_cod,
  origem_cod = excluded.origem_cod,
  agrupamento_cod = excluded.agrupamento_cod,
  atualizado_em = now();
