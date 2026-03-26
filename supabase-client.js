import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://umpebdovrazzrdndhigc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGViZG92cmF6enJkbmRoaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODMyMjgsImV4cCI6MjA4OTg1OTIyOH0.ecAVT1-bLv3yZOp-GnyR88lpH0xSVXV2hM80rB0fm6M';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Carrega catálogos necessários para filtros e validação.
 * @returns {Promise<{origens:Array, familias:Array, agrupamentos:Array, dicionario:Array}>}
 */
export async function fetchMasters() {
  const [{ data: origens }, { data: familias }, { data: agrupamentos }, { data: dicionario }] = await Promise.all([
    sb.from('categorias_origem').select('*').order('descricao'),
    sb.from('categorias_familia').select('*').order('descricao'),
    sb.from('categorias_agrupamento').select('*').order('descricao'),
    sb.from('dicionario_produtos').select('*')
  ]);

  return {
    origens: origens || [],
    familias: familias || [],
    agrupamentos: agrupamentos || [],
    dicionario: dicionario || []
  };
}

/**
 * Grava lote de custos por data de referência.
 * @param {Array} payload
 */
export async function upsertHistoricoCustos(payload) {
  return sb
    .from('historico_custos')
    .upsert(payload, { onConflict: 'codigo_produto, data_referencia' });
}

/**
 * Busca custos com LEFT JOIN no dicionário para não perder histórico sem amarração.
 * @param {{start:string,end:string,origem:string,familia:string,agrupamento:string}} filters
 */
export async function fetchHistoricoComDicionario(filters) {
  let query = sb
    .from('historico_custos')
    .select('codigo_produto, descricao, custo_total, data_referencia, dicionario_produtos!left(origem_cod, familia_cod, agrupamento_cod)')
    .gte('data_referencia', filters.start)
    .lte('data_referencia', filters.end);

  if (filters.origem !== 'TODAS') query = query.eq('dicionario_produtos.origem_cod', filters.origem);
  if (filters.familia !== 'TODAS') query = query.eq('dicionario_produtos.familia_cod', filters.familia);
  if (filters.agrupamento !== 'TODOS') query = query.eq('dicionario_produtos.agrupamento_cod', filters.agrupamento);

  return query.order('data_referencia', { ascending: true });
}
