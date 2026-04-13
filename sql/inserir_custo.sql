-- Função: insere/atualiza somente dados de custo (sem categorização).
-- Observação:
--   - origem_id, familia_id e agrupamento_cod NÃO são manipulados aqui.
--   - categorização deve ser tratada separadamente via mapa_produtos/processo dedicado.
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
  v_dicionario_ok boolean := false;
  v_historico_ok boolean := false;
  v_mensagem text := '';
  v_erro text;
begin
  if v_codigo_produto is null then
    return query
    select false, 'codigo_produto vazio.'::text;
    return;
  end if;

  -- Etapa 1: garante chave de produto no dicionário (somente codigo/descricao).
  begin
    insert into public.dicionario_produtos (
      codigo_produto,
      descricao
    )
    values (
      v_codigo_produto,
      v_descricao
    )
    on conflict (codigo_produto) do update
       set descricao = coalesce(excluded.descricao, public.dicionario_produtos.descricao);

    v_dicionario_ok := true;
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      v_dicionario_ok := false;
      v_mensagem := concat_ws(' ', v_mensagem, 'Falha no dicionário:', v_erro);
  end;

  -- Etapa 2: grava histórico de custos.
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
       set custo_total = excluded.custo_total,
           descricao_na_planilha = excluded.descricao_na_planilha;

    v_historico_ok := true;
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      v_historico_ok := false;
      v_mensagem := concat_ws(' ', v_mensagem, 'Falha no histórico:', v_erro);
  end;

  if v_dicionario_ok and v_historico_ok then
    return query
    select true, 'Registro inserido/atualizado com sucesso.'::text;
  else
    if btrim(v_mensagem) = '' then
      v_mensagem := 'Falha ao inserir/atualizar custo.';
    end if;
    return query
    select false, v_mensagem;
  end if;
end;
$$;
