-- Tabela de mapeamento para lookup de categorização na importação.
create table if not exists public.mapa_produtos (
  codigo_produto text primary key,
  origem_id uuid,
  familia_id uuid,
  agrupamento_cod text
);
