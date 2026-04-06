/* Responsabilidade: camada única de acesso ao Supabase (Auth + leitura + escrita). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { suggestCategory as heuristicSuggestCategory } from '../../core/heuristic-engine.js';

const SUPABASE_URL = 'https://umpebdovrazzrdndhigc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGViZG92cmF6enJkbmRoaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODMyMjgsImV4cCI6MjA4OTg1OTIyOH0.ecAVT1-bLv3yZOp-GnyR88lpH0xSVXV2hM80rB0fm6M';

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
  email: 'pedrok@germani.local',
  password: 'Pedrok0206'
};

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function resolveMasterId(row) {
  return row?.id ?? row?.codigo ?? row?.cod ?? row?.uuid ?? row?.value ?? null;
}

function resolveMasterLabel(row) {
  return row?.descricao ?? row?.nome ?? row?.label ?? row?.titulo ?? null;
}

function normalizeMasterRows(rows = []) {
  return rows
    .map(row => {
      const id = resolveMasterId(row);
      const descricao = resolveMasterLabel(row);
      if (!id || !descricao) return null;
      return { ...row, id, descricao };
    })
    .filter(Boolean);
}

function resolveLoginToEmail(login) {
  return login === MASTER_ADMIN.username ? MASTER_ADMIN.email : login;
}

function isRelationshipCacheError(error) {
  return String(error?.message || '').toLowerCase().includes('could not find a relationship');
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`column ${TABLES.historico}.${String(columnName).toLowerCase()} does not exist`);
}

function normalizeDictionaryPayloadItem(item) {
  const text = String(item?.descricao || item?.sugestao_familia || item?.sugestao_origem || '').toUpperCase();
  const normalized = {
    codigo_produto: item.codigo_produto,
    origem_id: item.origem_id,
    familia_id: item.familia_id,
    agrupamento_cod: item.agrupamento_cod || null
  };

  const isBiscoito = text.includes('BISCOITO');
  const isMassa = text.includes('MASSA');
  const keywordId = isBiscoito ? 'M012' : (isMassa ? 'M024' : 'M000');

  if (!normalized.origem_id) normalized.origem_id = keywordId;
  if (!normalized.familia_id) normalized.familia_id = keywordId;

  return normalized;
}

function applyCascadeFilterInMemory(rows, filters) {
  return (rows || []).filter(item => {
    const dict = item.dicionario_produtos;
    if (filters.origem !== 'TODAS' && String(dict?.origem_id) !== String(filters.origem)) return false;
    if (filters.familia !== 'TODAS' && String(dict?.familia_id) !== String(filters.familia)) return false;
    if (filters.agrupamento !== 'TODOS' && String(dict?.agrupamento_cod) !== String(filters.agrupamento)) return false;
    if (filters.item !== 'TODOS' && String(item.codigo_produto) !== String(filters.item)) return false;
    return true;
  });
}

function isValidDateValue(value) {
  if (!value) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
}

function validateHistoricoRow(row = {}) {
  const erros = [];

  if (!String(row?.codigo_produto || '').trim()) {
    erros.push('codigo_produto vazio');
  }

  const custo = Number(row?.custo_total);
  if (!Number.isFinite(custo)) {
    erros.push('custo_total inválido');
  }

  if (!isValidDateValue(row?.data_referencia)) {
    erros.push('data_referencia inválida');
  }

  return {
    valido: erros.length === 0,
    erros
  };
}

async function getHistoricoWithClientFallback(filters) {
  const baseQuery = sb
    .from(TABLES.historico)
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end);

  const withDescricao = await baseQuery
    .select('codigo_produto, descricao, custo_total, data_referencia, user_id, operacao_timestamp')
    .order('data_referencia', { ascending: true });

  let historicoBase = withDescricao.data;
  let historicoError = withDescricao.error;

  if (historicoError && isMissingColumnError(historicoError, 'descricao')) {
    const withoutDescricao = await sb
      .from(TABLES.historico)
      .select('codigo_produto, custo_total, data_referencia, user_id, operacao_timestamp')
      .gte('data_referencia', filters.start)
      .lte('data_referencia', filters.end)
      .order('data_referencia', { ascending: true });

    historicoBase = (withoutDescricao.data || []).map(item => ({ ...item, descricao: null }));
    historicoError = withoutDescricao.error;
  }

  if (historicoError) return { data: null, error: historicoError };
  if (!historicoBase?.length) return { data: [], error: null };

  const codigos = [...new Set(historicoBase.map(item => item.codigo_produto).filter(Boolean))];
  const { data: dicionarioRows, error: dicionarioError } = await sb
    .from(TABLES.dicionario)
    .select('codigo_produto, descricao, origem_id, familia_id, agrupamento_cod')
    .in('codigo_produto', codigos);

  if (dicionarioError) return { data: null, error: dicionarioError };

  const dicionarioByCodigo = new Map((dicionarioRows || []).map(row => [String(row.codigo_produto), row]));
  const enrichedRows = historicoBase.map(item => ({
    ...item,
    descricao: item.descricao || dicionarioByCodigo.get(String(item.codigo_produto))?.descricao || null,
    dicionario_produtos: dicionarioByCodigo.get(String(item.codigo_produto)) || null
  }));

  return { data: applyCascadeFilterInMemory(enrichedRows, filters), error: null };
}

async function getHistoricoWithRelations(filters) {
  let query = sb
    .from(TABLES.historico)
    .select('*, dicionario_produtos(origem_id, familia_id, agrupamento_cod)')
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end);

  if (filters.origem !== 'TODAS') query = query.eq('dicionario_produtos.origem_id', filters.origem);
  if (filters.familia !== 'TODAS') query = query.eq('dicionario_produtos.familia_id', filters.familia);
  if (filters.agrupamento !== 'TODOS') query = query.eq('dicionario_produtos.agrupamento_cod', filters.agrupamento);
  if (filters.item !== 'TODOS') query = query.eq('codigo_produto', filters.item);

  return query.order('data_referencia', { ascending: true });
}

export const api = {
  async signIn(login, password) {
    const email = resolveLoginToEmail(login);
    return sb.auth.signInWithPassword({ email, password });
  },

  async signInWithMasterBootstrap(login, password) {
    const email = resolveLoginToEmail(login);
    const loginResult = await sb.auth.signInWithPassword({ email, password });
    if (!loginResult.error) return loginResult;

    const isMaster = login === MASTER_ADMIN.username && password === MASTER_ADMIN.password;
    if (!isMaster) return loginResult;

    await sb.auth.signUp({ email: MASTER_ADMIN.email, password });
    return sb.auth.signInWithPassword({ email: MASTER_ADMIN.email, password });
  },

  async signOut() {
    return sb.auth.signOut();
  },

  async getCurrentUser() {
    return sb.auth.getUser();
  },

  async getMasters() {
    const [{ data: origens, error: origensError }, { data: familias, error: familiasError }, { data: agrupamentos, error: agrupamentosError }, { data: dicionario, error: dicionarioError }] = await Promise.all([
      sb.from(TABLES.origem).select('*').order('descricao'),
      sb.from(TABLES.familia).select('*').order('descricao'),
      sb.from(TABLES.agrupamento).select('*').order('descricao'),
      sb.from(TABLES.dicionario).select('*')
    ]);

    const error = origensError || familiasError || agrupamentosError || dicionarioError;
    if (error) {
      return { origens: [], familias: [], agrupamentos: [], dicionario: [], error };
    }

    const normalizedOrigens = normalizeMasterRows(origens || []);
    const normalizedFamilias = normalizeMasterRows(familias || []);
    const normalizedAgrupamentos = normalizeMasterRows(agrupamentos || []);

    const agrupamentosFromDictionary = [...new Set((dicionario || [])
      .map(item => item?.agrupamento_cod)
      .filter(Boolean)
      .map(value => String(value).trim())
      .filter(Boolean))]
      .map(id => {
        const existing = normalizedAgrupamentos.find(item => String(item.id) === id);
        if (existing) return existing;
        return { id, descricao: id };
      });

    return {
      origens: normalizedOrigens,
      familias: normalizedFamilias,
      agrupamentos: agrupamentosFromDictionary,
      dicionario: dicionario || [],
      error: null
    };
  },

  async upsertHistoricoCustos(payload) {
    return sb.from(TABLES.historico).upsert(payload, { onConflict: 'codigo_produto, data_referencia' });
  },

  async importarHistoricoCustosComLog(payload, options = {}) {
    const totalLinhas = Array.isArray(payload) ? payload.length : 0;
    const inicio = new Date().toISOString();
    const baseLog = {
      status: 'processando',
      total_linhas: totalLinhas,
      linhas_importadas: 0,
      linhas_erro: 0,
      iniciado_em: inicio,
      finalizado_em: null,
      user_id: options.userId || null,
      data_referencia: options.dataReferencia || null
    };

    const { data: createdLog, error: createLogError } = await sb
      .from(TABLES.logImportacao)
      .insert(baseLog)
      .select('*')
      .single();

    const logId = createdLog?.id ?? null;
    let linhasImportadas = 0;
    let linhasErro = 0;
    const erros = [];

    for (const [index, row] of (payload || []).entries()) {
      const validacao = validateHistoricoRow(row);
      if (!validacao.valido) {
        linhasErro += 1;
        erros.push({
          linha: index + 1,
          tipo: 'validacao',
          mensagem: validacao.erros.join('; '),
          row
        });
        continue;
      }

      const { error } = await sb
        .from(TABLES.historico)
        .upsert([row], { onConflict: 'codigo_produto, data_referencia' });

      if (error) {
        linhasErro += 1;
        erros.push({
          linha: index + 1,
          tipo: 'banco',
          mensagem: error.message || 'erro ao inserir linha',
          row
        });
        continue;
      }

      linhasImportadas += 1;
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
      const { error } = await sb
        .from(TABLES.logImportacao)
        .update(fechamentoLog)
        .eq('id', logId);
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


  async upsertDicionarioProdutos(payload) {
    const sanitized = (payload || []).map(normalizeDictionaryPayloadItem);

    const invalid = sanitized.filter(item => !item.origem_id || !item.familia_id);
    if (invalid.length) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_400',
          message: `Erro 400: origem_id e familia_id são obrigatórios antes do upsert no dicionário (${invalid.length} item(ns) inválido(s)).`
        }
      };
    }

    return sb.from(TABLES.dicionario).upsert(sanitized, { onConflict: 'codigo_produto' });
  },

  async suggestCategory(product, masters) {
    return { data: heuristicSuggestCategory(product, masters), error: null };
  },

  async getHistorico(filters) {
    const relationalResult = await getHistoricoWithRelations(filters);
    if (!relationalResult.error) return relationalResult;

    if (isRelationshipCacheError(relationalResult.error)) {
      return getHistoricoWithClientFallback(filters);
    }

    return relationalResult;
  },

  async getTrendsByProduct(codigoProduto) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    return sb
      .from(TABLES.historico)
      .select('codigo_produto, custo_total, data_referencia')
      .eq('codigo_produto', codigoProduto)
      .gte('data_referencia', startDate.toISOString().slice(0, 10))
      .lte('data_referencia', endDate.toISOString().slice(0, 10))
      .order('data_referencia', { ascending: true });
  }
};
