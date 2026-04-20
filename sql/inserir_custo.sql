-- Função: insere/atualiza custos usando exclusivamente dicionario_produtos.
-- Regras críticas:
--   - Não inferir por descrição.
--   - Produto deve existir no dicionario_produtos com origem_id/familia_id/agrupamento_cod preenchidos.
--   - historico_custos usa UNIQUE (codigo_produto, data_referencia) com upsert de custo_total.
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
declare
  v_codigo_produto text := nullif(btrim(coalesce(p_codigo_produto, '')), '');
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_origem_id uuid;
  v_familia_id uuid;
  v_agrupamento_cod text;
  v_erro text;
begin
  if v_codigo_produto is null then
    return query select false, 'codigo_produto vazio.'::text;
    return;
  end if;

  select
    dp.origem_id,
    dp.familia_id,
    dp.agrupamento_cod
  into
    v_origem_id,
    v_familia_id,
    v_agrupamento_cod
  from public.dicionario_produtos dp
  where dp.codigo_produto = v_codigo_produto;

  if v_origem_id is null or v_familia_id is null or v_agrupamento_cod is null then
    return query
      select false, format('Produto %s sem mapeamento completo em dicionario_produtos.', v_codigo_produto);
    return;
  end if;

  begin
    insert into public.historico_custos (
      codigo_produto,
      descricao,
      custo_total,
      data_referencia
    )
    values (
      v_codigo_produto,
      v_descricao,
      p_custo_total,
      p_data_referencia
    )
    on conflict (codigo_produto, data_referencia)
    do update set
      custo_total = excluded.custo_total,
      descricao = excluded.descricao;
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      return query select false, concat('Falha no histórico: ', v_erro);
      return;
  end;

  return query
    select true, 'Registro inserido/atualizado com sucesso.'::text;
end;
$$;
