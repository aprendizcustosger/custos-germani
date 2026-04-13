-- Função: insere ou atualiza um único custo por produto/data com UPSERT seguro.
create or replace function public.inserir_custo(
  p_codigo_produto text,
  p_descricao text,
  p_custo_total numeric,
  p_data_referencia date
)
returns table (
  sucesso boolean,
  mensagem text
)
language plpgsql
as $$
begin
  insert into public.dicionario_produtos (
    codigo_produto,
    descricao
  )
  values (
    p_codigo_produto,
    p_descricao
  )
  on conflict (codigo_produto) do update
     set descricao = excluded.descricao;

  insert into public.historico_custos (
    codigo_produto,
    descricao_na_planilha,
    custo_total,
    data_referencia
  )
  values (
    p_codigo_produto,
    p_descricao,
    p_custo_total,
    p_data_referencia
  )
  on conflict (codigo_produto, data_referencia)
  do update
     set custo_total = excluded.custo_total,
         descricao_na_planilha = excluded.descricao_na_planilha;

  return query
  select true, 'Registro inserido/atualizado com sucesso.'::text;
exception
  when others then
    return query
    select false, ('Erro ao inserir/atualizar custo: ' || sqlerrm)::text;
end;
$$;
