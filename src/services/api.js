/* Responsabilidade: camada única de acesso ao Supabase (Auth + leitura + escrita). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://umpebdovrazzrdndhigc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGViZG92cmF6enJkbmRoaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODMyMjgsImV4cCI6MjA4OTg1OTIyOH0.ecAVT1-bLv3yZOp-GnyR88lpH0xSVXV2hM80rB0fm6M';

export const MASTER_ADMIN = {
  username: 'PedroK',
  email: 'pedrok@germani.local',
  password: 'Pedrok0206'
};

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function resolveLoginToEmail(login) {
  return login === MASTER_ADMIN.username ? MASTER_ADMIN.email : login;
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
      sb.from('categorias_origem').select('*').order('descricao'),
      sb.from('categorias_familia').select('*').order('descricao'),
      sb.from('categorias_agrupamento').select('*').order('descricao'),
      sb.from('dicionario_produtos').select('*')
    ]);

    return { origens: origens || [], familias: familias || [], agrupamentos: agrupamentos || [], dicionario: dicionario || [] };
  },

  async upsertHistoricoCustos(payload) {
    return sb.from('historico_custos').upsert(payload, { onConflict: 'codigo_produto, data_referencia' });
  },

  async getHistorico(filters) {
    let query = sb
      .from('historico_custos')
      .select('codigo_produto, descricao, custo_total, data_referencia, user_id, operacao_timestamp, dicionario_produtos!left(origem_cod, familia_cod, agrupamento_cod)')
      .gte('data_referencia', filters.start)
      .lte('data_referencia', filters.end);

    if (filters.origem !== 'TODAS') query = query.eq('dicionario_produtos.origem_cod', filters.origem);
    if (filters.familia !== 'TODAS') query = query.eq('dicionario_produtos.familia_cod', filters.familia);
    if (filters.agrupamento !== 'TODOS') query = query.eq('dicionario_produtos.agrupamento_cod', filters.agrupamento);

    return query.order('data_referencia', { ascending: true });
  },

  async getTrendsByProduct(codigoProduto) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    return sb
      .from('historico_custos')
      .select('codigo_produto, custo_total, data_referencia')
      .eq('codigo_produto', codigoProduto)
      .gte('data_referencia', startDate.toISOString().slice(0, 10))
      .lte('data_referencia', endDate.toISOString().slice(0, 10))
      .order('data_referencia', { ascending: true });
  }
};
