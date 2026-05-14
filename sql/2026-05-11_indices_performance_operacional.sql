-- Índices essenciais para escala operacional investigativa.
-- Temporalidade: data_referencia (competência) e criado_em (evento de importação).

create index if not exists idx_historico_custos_codigo_produto
  on public.historico_custos (codigo_produto);

create index if not exists idx_historico_custos_data_referencia
  on public.historico_custos (data_referencia);

create index if not exists idx_historico_custos_criado_em_desc
  on public.historico_custos (criado_em desc);

create index if not exists idx_historico_custos_produto_referencia
  on public.historico_custos (codigo_produto, data_referencia);

create index if not exists idx_historico_custos_produto_importacao
  on public.historico_custos (codigo_produto, criado_em desc);
