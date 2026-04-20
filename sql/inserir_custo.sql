-- Função: insere/atualiza custos aplicando categorização automática via dicionário mestre.
-- Regras críticas:
--   - Fonte única de categorização: dicionario_master_produtos.
--   - familia/origem são obrigatórios; se não houver mapeamento válido, não grava histórico.
--   - agrupamento é opcional (NULL permitido), com tentativa de leitura em mapa_produtos.
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
  v_descricao_planilha text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_descricao_master text;
  v_origem_cod text;
  v_familia_cod text;
  v_origem_id uuid;
  v_familia_id uuid;
  v_agrupamento_cod text;
  v_erro text;
begin
  if v_codigo_produto is null then
    return query select false, 'codigo_produto vazio.'::text;
    return;
  end if;

  -- Etapa 1: busca obrigatória no dicionário mestre.
  select
    dmp.descricao,
    dmp.origem_cod,
    dmp.familia_cod
  into
    v_descricao_master,
    v_origem_cod,
    v_familia_cod
  from public.dicionario_master_produtos dmp
  where dmp.codigo_produto = v_codigo_produto;

  if v_descricao_master is null or v_origem_cod is null or v_familia_cod is null then
    return query
    select false, format('Produto %s não encontrado no dicionario_master_produtos.', v_codigo_produto);
    return;
  end if;

  -- Etapa 2: converte códigos de negócio para UUID (obrigatório).
  select co.id into v_origem_id
  from public.categorias_origem co
  where co.codigo = v_origem_cod;

  select cf.id into v_familia_id
  from public.categorias_familia cf
  where cf.codigo = v_familia_cod;

  if v_origem_id is null or v_familia_id is null then
    return query
    select false, format(
      'Conversão de categoria inválida para %s (origem_cod=%s, familia_cod=%s).',
      v_codigo_produto,
      coalesce(v_origem_cod, 'NULL'),
      coalesce(v_familia_cod, 'NULL')
    );
    return;
  end if;

  -- Etapa 3: agrupamento opcional (não bloqueante).
  select mp.agrupamento_cod
  into v_agrupamento_cod
  from public.mapa_produtos mp
  where mp.codigo_produto = v_codigo_produto;

  -- Etapa 4: atualiza dicionário auxiliar a partir do mestre.
  begin
    insert into public.dicionario_produtos (
      codigo_produto,
      descricao,
      origem_id,
      familia_id,
      agrupamento_cod
    )
    values (
      v_codigo_produto,
      v_descricao_master,
      v_origem_id,
      v_familia_id,
      v_agrupamento_cod
    )
    on conflict (codigo_produto) do update
       set descricao = excluded.descricao,
           origem_id = excluded.origem_id,
           familia_id = excluded.familia_id,
           agrupamento_cod = excluded.agrupamento_cod;
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      return query select false, concat('Falha ao atualizar dicionario_produtos: ', v_erro);
      return;
  end;

  -- Etapa 5: grava histórico de custos.
  begin
    insert into public.historico_custos (
      codigo_produto,
      descricao_na_planilha,
      custo_total,
      data_referencia
    )
    values (
      v_codigo_produto,
      coalesce(v_descricao_planilha, v_descricao_master),
      p_custo_total,
      p_data_referencia
    )
    on conflict (codigo_produto, data_referencia)
    do update
       set custo_total = excluded.custo_total,
           descricao_na_planilha = excluded.descricao_na_planilha;
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
