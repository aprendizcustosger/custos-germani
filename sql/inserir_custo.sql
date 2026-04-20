-- Função: insere/atualiza custo somente para produtos já categorizados no dicionário.
-- Regra mandatória:
--   - nunca inferir categoria por descrição;
--   - nunca preencher categoria via importador;
--   - rejeitar linha quando dicionario_produtos não possuir origem_id/familia_id válidos.
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
  v_historico_ok boolean := false;
  v_erro text;
begin
  if v_codigo_produto is null then
    return query
    select false, 'codigo_produto vazio.'::text;
    return;
  end if;

  -- Etapa 1: valida se o produto já existe categorizado no dicionário.
  select dp.origem_id, dp.familia_id
    into v_origem_id, v_familia_id
  from public.dicionario_produtos dp
  where dp.codigo_produto = v_codigo_produto;

  if v_origem_id is null or v_familia_id is null then
    return query
    select false, 'produto sem categorizacao valida em dicionario_produtos (origem_id/familia_id).'::text;
    return;
  end if;

  -- Etapa 2: grava histórico de custos via UPSERT obrigatório.
  begin
    insert into public.historico_custos (
      codigo_produto,
      descricao_na_planilha,
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
    do update
       set custo_total = excluded.custo_total;

    v_historico_ok := true;
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      v_historico_ok := false;
  end;

  if v_historico_ok then
    return query
    select true, 'Registro inserido/atualizado com sucesso.'::text;
  else
    return query
    select false, coalesce(v_erro, 'Falha ao inserir/atualizar custo.');
  end if;
end;
$$;
