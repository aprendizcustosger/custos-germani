/* Responsabilidade: camada única de acesso ao Supabase (Auth + leitura + escrita). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { suggestCategory as heuristicSuggestCategory } from '../../core/heuristic-engine.js';

const SUPABASE_URL = 'https://umpebdovrazzrdndhigc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGViZG92cmF6enJkbmRoaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODMyMjgsImV4cCI6MjA4OTg1OTIyOH0.ecAVT1-bLv3yZOp-GnyR88lpH0xSVXV2hM80rB0fm6M';

const TABLES = {
  historico: 'historico_custos',
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

function resolveLoginToEmail(login) {
  return login === MASTER_ADMIN.username ? MASTER_ADMIN.email : login;
}

function isRelationshipCacheError(error) {
  return String(error?.message || '').toLowerCase().includes('could not find a relationship');
}

function applyCascadeFilterInMemory(rows, filters) {
  return (rows || []).filter(item => {
    const dict = item.dicionario_produtos;
    if (filters.origem !== 'TODAS' && String(dict?.origem_id) !== String(filters.origem)) return false;
    if (filters.familia !== 'TODAS' && String(dict?.familia_id) !== String(filters.familia)) return false;
    if (filters.agrupamento !== 'TODOS' && String(dict?.agrupamento_cod) !== String(filters.agrupamento)) return false;
    return true;
  });
}

async function getHistoricoWithClientFallback(filters) {
  const { data: historicoBase, error: historicoError } = await sb
    .from(TABLES.historico)
    .select('codigo_produto, descricao, custo_total, data_referencia, user_id, operacao_timestamp')
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end)
    .order('data_referencia', { ascending: true });

  if (historicoError) return { data: null, error: historicoError };
  if (!historicoBase?.length) return { data: [], error: null };

  const codigos = [...new Set(historicoBase.map(item => item.codigo_produto).filter(Boolean))];
  const { data: dicionarioRows, error: dicionarioError } = await sb
    .from(TABLES.dicionario)
    .select('codigo_produto, origem_id, familia_id, agrupamento_cod')
    .in('codigo_produto', codigos);

  if (dicionarioError) return { data: null, error: dicionarioError };

  const dicionarioByCodigo = new Map((dicionarioRows || []).map(row => [String(row.codigo_produto), row]));
  const enrichedRows = historicoBase.map(item => ({
    ...item,
    dicionario_produtos: dicionarioByCodigo.get(String(item.codigo_produto)) || null
  }));

  return { data: applyCascadeFilterInMemory(enrichedRows, filters), error: null };
}

async function getHistoricoWithRelations(filters) {
  let query = sb
    .from(TABLES.historico)
    .select('codigo_produto, descricao, custo_total, data_referencia, user_id, operacao_timestamp, dicionario_produtos!left(codigo_produto, origem_id, familia_id, agrupamento_cod)')
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end);

  if (filters.origem !== 'TODAS') query = query.eq('dicionario_produtos.origem_id', filters.origem);
  if (filters.familia !== 'TODAS') query = query.eq('dicionario_produtos.familia_id', filters.familia);
  if (filters.agrupamento !== 'TODOS') query = query.eq('dicionario_produtos.agrupamento_cod', filters.agrupamento);

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
    const [{ data: origens }, { data: familias }, { data: agrupamentos }, { data: dicionario }] = await Promise.all([
      sb.from(TABLES.origem).select('*').order('descricao'),
      sb.from(TABLES.familia).select('*').order('descricao'),
      sb.from(TABLES.agrupamento).select('*').order('descricao'),
      sb.from(TABLES.dicionario).select('*')
    ]);

    return {
      origens: origens || [],
      familias: familias || [],
      agrupamentos: agrupamentos || [],
      dicionario: dicionario || []
    };
  },

  async upsertHistoricoCustos(payload) {
    return sb.from(TABLES.historico).upsert(payload, { onConflict: 'codigo_produto, data_referencia' });
  },


  async upsertDicionarioProdutos(payload) {
    const sanitized = (payload || []).map(item => ({
      codigo_produto: item.codigo_produto,
      descricao: String(item.descricao || '').replace(/\s+/g, ' ').trim(),
      origem_id: item.origem_id || null,
      familia_id: item.familia_id || null,
      agrupamento_cod: item.agrupamento_cod || null
    }));

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
