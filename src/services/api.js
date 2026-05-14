/* Responsabilidade: camada única de acesso ao Supabase (Auth + leitura + escrita). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import { appConfig, debugLog } from '../config/app-config.js';

const TABLES = {
  historico: 'historico_custos',
  logImportacao: 'log_importacao',
  dicionario: 'dicionario_produtos',
  origem: 'categorias_origem',
  familia: 'categorias_familia',
  agrupamento: 'categorias_agrupamento'
};

export const MASTER_ADMIN = {
  username: 'PedroK',
  email: 'pedrok@germani.local'
  // Credenciais não armazenadas em código-fonte
};

const supabase = createClient(appConfig.supabase.url, appConfig.supabase.anonKey);
const IMPORT_CHUNK_SIZE = 400;

function resolveMasterId(row) {
  return row?.id ?? row?.codigo ?? row?.cod ?? row?.uuid ?? row?.value ?? null;
}

function resolveMasterLabel(row) {
  return row?.descricao ?? row?.nome ?? row?.label ?? row?.titulo ?? null;
}

function isNullLike(value) {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return !normalized || normalized === 'null' || normalized === 'undefined';
}

function normalizeMasterRows(rows = []) {
  return rows
    .map(row => {
      const id = resolveMasterId(row);
      const descricao = resolveMasterLabel(row);
      if (isNullLike(id) || isNullLike(descricao)) return null;
      return { ...row, id, descricao };
    })
    .filter(Boolean);
}

function resolveLoginToEmail(login) {
  return login === MASTER_ADMIN.username ? MASTER_ADMIN.email : login;
}

function applyCascadeFilterInMemory(rows, filters) {
  return (rows || []).filter(item => {
    if (filters.origem !== 'TODAS' && String(item?.origem_id) !== String(filters.origem)) return false;
    if (filters.familia !== 'TODAS' && String(item?.familia_id) !== String(filters.familia)) return false;
    if (filters.agrupamento !== 'TODOS' && String(item?.agrupamento_cod) !== String(filters.agrupamento)) return false;
    if (filters.item !== 'TODOS' && String(item.codigo_produto) !== String(filters.item)) return false;
    return true;
  });
}

function isValidDateValue(value) {
  return Boolean(normalizeISODate(value));
}

function normalizeISODate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function roundTo4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function normalizeMoneyValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return roundTo4(num);
}

function validateHistoricoRow(row = {}) {
  const erros = [];

  if (!String(row?.codigo_produto || '').trim()) erros.push('codigo_produto vazio');
  if (!String(row?.descricao || '').trim()) erros.push('descricao vazia');
  if (!String(row?.custo_total ?? '').trim()) erros.push('custo_total vazio');
  const custoVariavel = normalizeMoneyValue(row?.custo_variavel);
  const custoDiretoFixo = normalizeMoneyValue(row?.custo_direto_fixo);
  const custoTotal = normalizeMoneyValue(row?.custo_total);
  if (custoVariavel === null) erros.push('custo_variavel inválido');
  if (custoDiretoFixo === null) erros.push('custo_direto_fixo inválido');
  if (custoTotal === null) erros.push('custo_total inválido');
  if (!isValidDateValue(row?.data_referencia)) erros.push('data_referencia inválida');

  return { valido: erros.length === 0, erros };
}

function mapHierarchyRows(dicionario = []) {
  return (dicionario || [])
    .filter(item => !isNullLike(item?.codigo_produto))
    .map(item => ({
      codigo_produto: String(item.codigo_produto).trim(),
      origem_id: item?.origem_id ?? null,
      familia_id: item?.familia_id ?? null,
      agrupamento_cod: item?.agrupamento_cod ?? null,
      descricao: item?.descricao || null
    }));
}

async function getHistoricoWithClientFallback(filters) {
  const { data: historicoBase, error: historicoError } = await supabase
    .from(TABLES.historico)
    .select('*')
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end)
    .order('data_referencia', { ascending: true });

  if (historicoError) return { data: null, error: historicoError };
  if (!historicoBase?.length) return { data: [], error: null };

  const codigos = [...new Set(historicoBase.map(item => item.codigo_produto).filter(Boolean))];
  const { data: dicionarioRows, error: dicionarioError } = await supabase
    .from(TABLES.dicionario)
    .select('codigo_produto, descricao, origem_id, familia_id, agrupamento_cod')
    .in('codigo_produto', codigos);

  if (dicionarioError) return { data: null, error: dicionarioError };

  const dicionarioByCodigo = new Map((dicionarioRows || []).map(row => [String(row.codigo_produto), row]));

  const enrichedRows = historicoBase
    .map(item => {
      const dictionaryEntry = dicionarioByCodigo.get(String(item.codigo_produto));
      return {
        ...item,
        descricao: dictionaryEntry?.descricao || item.descricao || null,
        origem_id: dictionaryEntry?.origem_id ?? null,
        familia_id: dictionaryEntry?.familia_id ?? null,
        agrupamento_cod: dictionaryEntry?.agrupamento_cod ?? null
      };
    });

  return { data: applyCascadeFilterInMemory(enrichedRows, filters), error: null };
}

async function runDiagnosticoSemAgrupamento() {
  const [{ data: historicoRows, error: historicoError }, { data: dicionarioRows, error: dicionarioError }, { data: agrupamentoRows, error: agrupamentoError }] = await Promise.all([
    supabase.from(TABLES.historico).select('codigo_produto'),
    supabase.from(TABLES.dicionario).select('codigo_produto, agrupamento_cod'),
    supabase.from(TABLES.agrupamento).select('codigo')
  ]);

  if (historicoError || dicionarioError || agrupamentoError) {
    console.warn('Diagnóstico de agrupamento indisponível.', historicoError || dicionarioError || agrupamentoError);
    return [];
  }

  const codigosComHistorico = new Set((historicoRows || [])
    .map(item => String(item?.codigo_produto || '').trim())
    .filter(Boolean));
  const agrupamentosValidos = new Set((agrupamentoRows || [])
    .map(item => String(item?.codigo || '').trim())
    .filter(Boolean));

  return (dicionarioRows || [])
    .filter(item => codigosComHistorico.has(String(item?.codigo_produto || '').trim()))
    .filter(item => {
      const agrupamentoCod = String(item?.agrupamento_cod || '').trim();
      return !agrupamentoCod || !agrupamentosValidos.has(agrupamentoCod);
    })
    .map(item => ({ codigo_produto: item.codigo_produto }))
    .sort((a, b) => String(a.codigo_produto).localeCompare(String(b.codigo_produto)));
}

async function garantirProdutoNoDicionario(produto, descricao) {
  const codigoProduto = String(produto || '').trim();
  if (!codigoProduto) return { ok: false, reason: 'codigo_vazio' };

  const { data, error } = await supabase
    .from(TABLES.dicionario)
    .select('codigo_produto')
    .eq('codigo_produto', codigoProduto)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar produto no dicionário:', { codigo_produto: codigoProduto, error });
    return { ok: false, reason: 'erro_busca', error };
  }

  if (data) return { ok: true, created: false };

  const { error: insertError } = await supabase
    .from(TABLES.dicionario)
    .insert({
      codigo_produto: codigoProduto,
      descricao: String(descricao || '').trim() || null,
      origem_id: null,
      familia_id: null,
      agrupamento_cod: null
    });

  if (insertError) {
    console.error('Erro ao criar produto no dicionário:', { codigo_produto: codigoProduto, error: insertError });
    return { ok: false, reason: 'erro_insert', error: insertError };
  }

  debugLog('Produto criado no dicionário:', codigoProduto);
  return { ok: true, created: true };
}

async function garantirProdutosNoDicionarioEmLote(produtos = []) {
  const unicos = new Map();
  (produtos || []).forEach(item => {
    const codigo = String(item?.codigo_produto || '').trim();
    if (!codigo) return;
    if (!unicos.has(codigo)) {
      unicos.set(codigo, {
        codigo_produto: codigo,
        descricao: String(item?.descricao || '').trim() || null,
        origem_id: null,
        familia_id: null,
        agrupamento_cod: null
      });
    }
  });

  const codigos = [...unicos.keys()];
  if (!codigos.length) return { ok: true, inseridos: 0, erros: [] };

  const { data: existentes, error: erroExistentes } = await supabase
    .from(TABLES.dicionario)
    .select('codigo_produto')
    .in('codigo_produto', codigos);

  if (erroExistentes) {
    return { ok: false, inseridos: 0, erros: [{ tipo: 'dicionario_busca', mensagem: erroExistentes.message }] };
  }

  const existentesSet = new Set((existentes || []).map(row => String(row?.codigo_produto || '').trim()));
  const pendentes = codigos.filter(codigo => !existentesSet.has(codigo)).map(codigo => unicos.get(codigo));
  if (!pendentes.length) return { ok: true, inseridos: 0, erros: [] };

  const { error: erroInsert } = await supabase
    .from(TABLES.dicionario)
    .upsert(pendentes, { onConflict: 'codigo_produto' });

  if (erroInsert) {
    return { ok: false, inseridos: 0, erros: [{ tipo: 'dicionario_upsert', mensagem: erroInsert.message }] };
  }

  return { ok: true, inseridos: pendentes.length, erros: [] };
}

export const api = {
  async getMasters() {
    const [
      { data: historicoRows, error: historicoError },
      { data: origensRaw, error: origensError },
      { data: familiasRaw, error: familiasError },
      { data: agrupamentosRaw, error: agrupamentosError },
      { data: dicionarioRaw, error: dicionarioError }
    ] = await Promise.all([
      supabase.from(TABLES.historico).select('codigo_produto, descricao'),
      supabase.from(TABLES.origem).select('*').order('descricao'),
      supabase.from(TABLES.familia).select('*').order('descricao'),
      supabase.from(TABLES.agrupamento).select('*').order('descricao'),
      supabase.from(TABLES.dicionario)
        .select('codigo_produto, descricao, origem_id, familia_id, agrupamento_cod')
    ]);

    const error = historicoError || origensError || familiasError || agrupamentosError || dicionarioError;
    if (error) {
      return { origens: [], familias: [], agrupamentos: [], produtos: [], dicionario: [], hierarquia: [], diagnostico_sem_mapa: [], error };
    }

    const historicoNormalizado = (historicoRows || [])
      .map(item => ({
        codigo_produto: String(item?.codigo_produto || '').trim(),
        descricao: String(item?.descricao || '').trim() || null
      }))
      .filter(item => !isNullLike(item?.codigo_produto));

    const codigosComCusto = new Set(historicoNormalizado
      .map(item => item?.codigo_produto)
      .filter(value => !isNullLike(value))
      .map(value => String(value).trim()));

    const dicionarioComCusto = (dicionarioRaw || [])
      .filter(item => codigosComCusto.has(String(item?.codigo_produto || '').trim()));

    const dicionarioByCodigo = new Map((dicionarioComCusto || [])
      .filter(item => !isNullLike(item?.codigo_produto))
      .map(item => [String(item.codigo_produto).trim(), item]));

    const produtosMap = new Map();
    historicoNormalizado.forEach(item => {
      const codigo = String(item.codigo_produto).trim();
      if (!codigo || produtosMap.has(codigo)) return;
      const itemDicionario = dicionarioByCodigo.get(codigo);
      const descricao = item.descricao || itemDicionario?.descricao || '-';
      produtosMap.set(codigo, {
        codigo_produto: codigo,
        descricao
      });
    });
    const produtos = [...produtosMap.values()]
      .sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), 'pt-BR'));

    const idsPermitidos = (fieldName) => new Set(dicionarioComCusto
      .map(item => item?.[fieldName])
      .filter(value => !isNullLike(value))
      .map(value => String(value).trim()));

    const origemIdsPermitidos = idsPermitidos('origem_id');
    const familiaIdsPermitidos = idsPermitidos('familia_id');
    const agrupamentoIdsPermitidos = idsPermitidos('agrupamento_cod');

    const normalizedOrigens = normalizeMasterRows((origensRaw || [])
      .filter(row => origemIdsPermitidos.has(String(resolveMasterId(row)).trim())));
    const normalizedFamilias = normalizeMasterRows((familiasRaw || [])
      .filter(row => familiaIdsPermitidos.has(String(resolveMasterId(row)).trim())));
    const agrupamentosNormalizados = normalizeMasterRows((agrupamentosRaw || []).map(row => ({
      ...row,
      id: row?.codigo ?? resolveMasterId(row)
    })).filter(row => agrupamentoIdsPermitidos.has(String(row?.id || '').trim())));

    return {
      origens: normalizedOrigens,
      familias: normalizedFamilias,
      agrupamentos: agrupamentosNormalizados,
      produtos,
      dicionario: dicionarioComCusto,
      hierarquia: mapHierarchyRows(dicionarioComCusto),
      diagnostico_sem_mapa: await runDiagnosticoSemAgrupamento(),
      error: null
    };
  },

  subscribeFiltrosRealtime(onChange) {
    const callback = typeof onChange === 'function' ? onChange : () => {};
    const channel = supabase
      .channel('auditoria-filtros-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.historico }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.dicionario }, callback)
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.warn('Falha ao remover canal realtime de filtros.', error);
      }
    };
  },

  async upsertHistoricoCustos(payload) {
    return supabase.from(TABLES.historico).upsert(payload, { onConflict: 'codigo_produto,data_referencia' });
  },

  async signIn(login, password) {
    const email = resolveLoginToEmail(login);
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getCurrentUser() {
    return supabase.auth.getUser();
  },

  async importarHistoricoCustosComLog(payload, options = {}) {
    const totalLinhas = Array.isArray(payload) ? payload.length : 0;
    const inicio = new Date().toISOString();
    const dataReferenciaSelecionada = normalizeISODate(options.dataReferencia);
    const baseLog = {
      status: 'processando',
      total_linhas: totalLinhas,
      linhas_importadas: 0,
      linhas_erro: 0,
      iniciado_em: inicio,
      finalizado_em: null,
      data_referencia: dataReferenciaSelecionada
    };

    const { data: createdLog, error: createLogError } = await supabase
      .from(TABLES.logImportacao)
      .insert(baseLog)
      .select('*')
      .single();

    const logId = createdLog?.id ?? null;
    let linhasImportadas = 0;
    let linhasErro = 0;
    const erros = [];

    const rows = Array.isArray(payload) ? payload : [];
    const payloadValido = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const produto = String(row?.codigo_produto || '').trim();
      const custoTotal = normalizeMoneyValue(row?.custo_total);
      const dataReferencia = normalizeISODate(row?.data_referencia || dataReferenciaSelecionada);

      if (!produto || custoTotal === null || !dataReferencia) {
        console.error('DADO INVÁLIDO', { produto, custoTotal, dataReferencia });
        linhasErro += 1;
        erros.push({
          linha: index + 1,
          tipo: 'validacao',
          mensagem: 'codigo_produto, custo_total e data_referencia são obrigatórios.',
          row
        });
        continue;
      }

      const rowNormalizada = {
        ...row,
        codigo_produto: produto,
        custo_total: custoTotal,
        data_referencia: dataReferencia
      };

      const validacao = validateHistoricoRow(rowNormalizada);
      if (!validacao.valido) {
        linhasErro += 1;
        erros.push({ linha: index + 1, tipo: 'validacao', mensagem: validacao.erros.join('; '), row: rowNormalizada });
        continue;
      }

      payloadValido.push({
        codigo_produto: produto,
        descricao: rowNormalizada.descricao ?? null,
        custo_variavel: normalizeMoneyValue(rowNormalizada.custo_variavel),
        custo_direto_fixo: normalizeMoneyValue(rowNormalizada.custo_direto_fixo),
        custo_total: custoTotal,
        data_referencia: dataReferencia
      });
    }

    if (payloadValido.length > 0) {
      const dicionarioStatus = await garantirProdutosNoDicionarioEmLote(payloadValido);
      if (!dicionarioStatus.ok) {
        console.warn('Falha parcial ao garantir produtos no dicionário em lote.', dicionarioStatus.erros);
        erros.push(...(dicionarioStatus.erros || []).map(erro => ({
          linha: null,
          tipo: erro.tipo || 'dicionario',
          mensagem: erro.mensagem || 'Falha desconhecida ao preparar dicionário',
          row: null
        })));
      }
    }

    if (payloadValido.length > 0) {
      for (let i = 0; i < payloadValido.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = payloadValido.slice(i, i + IMPORT_CHUNK_SIZE);
        const { data, error } = await supabase
          .from(TABLES.historico)
          .upsert(chunk, { onConflict: 'codigo_produto,data_referencia' });

        if (error) {
          linhasErro += chunk.length;
          chunk.forEach(registro => {
            erros.push({
              linha: null,
              tipo: 'historico',
              mensagem: `Falha ao inserir produto ${registro.codigo_produto} no histórico: ${error.message || 'erro desconhecido'}`,
              row: registro
            });
          });
          console.error('Falha Supabase ao upsert histórico em chunk:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            chunkSize: chunk.length,
            data
          });
          continue;
        }

        linhasImportadas += chunk.length;
      }
    }

    const resumo = {
      total_linhas: totalLinhas,
      linhas_importadas: linhasImportadas,
      linhas_erro: linhasErro
    };

    const fechamentoLog = {
      status: 'finalizado',
      ...resumo,
      finalizado_em: new Date().toISOString()
    };

    let updateLogError = null;
    if (logId) {
      const { error } = await supabase.from(TABLES.logImportacao).update(fechamentoLog).eq('id', logId);
      updateLogError = error;
    }

    return {
      data: {
        log_id: logId,
        resumo,
        erros,
        log_error: createLogError || updateLogError || null
      },
      error: null
    };
  },

  async suggestCategory(product, masters) {
    const codigo = String(product?.codigo_produto || '').trim();
    if (!codigo) {
      return { data: { origem_id: null, familia_id: null, agrupamento_cod: null, status: 'PENDENTE' }, error: null };
    }

    const { data, error } = await supabase
      .from(TABLES.dicionario)
      .select('origem_id, familia_id, agrupamento_cod')
      .eq('codigo_produto', codigo)
      .maybeSingle();

    if (error) return { data: null, error };

    return {
      data: {
        origem_id: data?.origem_id || null,
        familia_id: data?.familia_id || null,
        agrupamento_cod: data?.agrupamento_cod || null,
        status: data?.origem_id && data?.familia_id && data?.agrupamento_cod ? 'SUGERIDO' : 'PENDENTE'
      },
      error: null
    };
  },

  async getHistorico(filters) {
    return getHistoricoWithClientFallback(filters);
  },

  async getLatestImportComparison(filters = {}) {
    const { data: importRows, error: importError } = await supabase
      .from(TABLES.historico)
      .select('criado_em')
      .order('criado_em', { ascending: false })
      .limit(1000);

    if (importError) return { data: null, error: importError };

    const latestImports = [...new Set((importRows || []).map(row => row?.criado_em).filter(Boolean))].slice(0, 2);
    if (latestImports.length < 2) {
      return { data: { imports: [], resumo: null }, error: null };
    }

    const [latestImport, previousImport] = latestImports;

    const { data: rows, error } = await supabase
      .from(TABLES.historico)
      .select('*')
      .in('criado_em', [latestImport, previousImport]);

    if (error) return { data: null, error };

    const filteredRows = applyCascadeFilterInMemory((rows || []).filter(item => {
      if (filters.start && String(item?.data_referencia || '') < String(filters.start)) return false;
      if (filters.end && String(item?.data_referencia || '') > String(filters.end)) return false;
      return true;
    }), {
      origem: filters.origem || 'TODAS',
      familia: filters.familia || 'TODAS',
      agrupamento: filters.agrupamento || 'TODOS',
      item: filters.item || 'TODOS'
    });

    const statsByImport = [latestImport, previousImport].map(importDate => {
      const importData = filteredRows.filter(row => row.criado_em === importDate);
      const total = importData.reduce((acc, row) => acc + Number(row?.custo_total || 0), 0);
      const quantidade = importData.length;
      const media = quantidade ? total / quantidade : 0;
      return { criado_em: importDate, quantidade, media: roundTo4(media) };
    });

    const latest = statsByImport[0];
    const previous = statsByImport[1];
    const variacaoPercentual = previous.media === 0 ? 0 : roundTo4(((latest.media - previous.media) / previous.media) * 100);

    return {
      data: {
        imports: statsByImport,
        resumo: {
          variacao_percentual_media: variacaoPercentual,
          delta_media: roundTo4(latest.media - previous.media)
        }
      },
      error: null
    };
  },

  async getTrendsByProduct(codigoProduto) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    return supabase
      .from(TABLES.historico)
      .select('codigo_produto, custo_total, data_referencia')
      .eq('codigo_produto', codigoProduto)
      .gte('data_referencia', startDate.toISOString().slice(0, 10))
      .lte('data_referencia', endDate.toISOString().slice(0, 10))
      .order('data_referencia', { ascending: true });
  },

  async getProductHistory(codigoProduto) {
    const { data, error } = await supabase
      .from(TABLES.historico)
      .select('codigo_produto, descricao, custo_total, custo_variavel, custo_direto_fixo, data_referencia, criado_em')
      .eq('codigo_produto', String(codigoProduto || '').trim())
      .order('data_referencia', { ascending: true })
      .order('criado_em', { ascending: true });

    if (error) return { data: null, error };

    const sorted = data || [];
    const annotated = sorted.map((row, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      const custoAtual = Number(row.custo_total || 0);
      const custoPrev = prev !== null ? Number(prev.custo_total || 0) : null;
      const delta = custoPrev !== null ? custoAtual - custoPrev : null;
      const deltaPerc = custoPrev !== null && custoPrev > 0
        ? ((custoAtual - custoPrev) / custoPrev) * 100
        : null;
      return {
        ...row,
        delta: delta !== null ? roundTo4(delta) : null,
        deltaPerc: deltaPerc !== null ? roundTo4(deltaPerc) : null
      };
    });

    return { data: annotated, error: null };
  },

  async getTopVariacoesImportacao(filters = {}) {
    const { data: importRows, error: importError } = await supabase
      .from(TABLES.historico)
      .select('criado_em')
      .order('criado_em', { ascending: false })
      .limit(1000);

    if (importError) return { data: null, error: importError };

    const latestImports = [...new Set((importRows || []).map(row => row?.criado_em).filter(Boolean))].slice(0, 2);
    if (latestImports.length < 2) return { data: { aumentos: [], reducoes: [], imports: latestImports }, error: null };

    const [ultimaImportacao, penultimaImportacao] = latestImports;

    const { data: rows, error } = await supabase
      .from(TABLES.historico)
      .select('codigo_produto, descricao, custo_total, criado_em, data_referencia')
      .in('criado_em', [ultimaImportacao, penultimaImportacao]);
    if (error) return { data: null, error };

    const rowsFiltered = applyCascadeFilterInMemory((rows || []).filter(item => {
      if (filters.start && String(item?.data_referencia || '') < String(filters.start)) return false;
      if (filters.end && String(item?.data_referencia || '') > String(filters.end)) return false;
      return true;
    }), {
      origem: filters.origem || 'TODAS',
      familia: filters.familia || 'TODAS',
      agrupamento: filters.agrupamento || 'TODOS',
      item: filters.item || 'TODOS'
    });

    const byProduct = new Map();
    rowsFiltered.forEach(row => {
      const codigo = String(row.codigo_produto || '').trim();
      if (!codigo) return;
      if (!byProduct.has(codigo)) byProduct.set(codigo, { codigo_produto: codigo, descricao: row.descricao || '-', novo: null, antigo: null });
      const bucket = byProduct.get(codigo);
      if (row.criado_em === ultimaImportacao) bucket.novo = Number(row.custo_total || 0);
      if (row.criado_em === penultimaImportacao) bucket.antigo = Number(row.custo_total || 0);
    });

    const variacoes = [...byProduct.values()]
      .filter(item => Number.isFinite(item.novo) && Number.isFinite(item.antigo) && item.antigo !== 0)
      .map(item => ({
        ...item,
        variacao_percentual: roundTo4(((item.novo - item.antigo) / item.antigo) * 100)
      }))
      .sort((a, b) => b.variacao_percentual - a.variacao_percentual);

    return {
      data: {
        imports: latestImports,
        aumentos: variacoes.filter(item => item.variacao_percentual > 0).slice(0, 5),
        reducoes: [...variacoes].reverse().filter(item => item.variacao_percentual < 0).slice(0, 5)
      },
      error: null
    };
  }
};
