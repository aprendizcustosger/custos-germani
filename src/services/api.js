/* Responsabilidade: camada única de acesso ao Supabase (Auth + leitura + escrita). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://umpebdovrazzrdndhigc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGViZG92cmF6enJkbmRoaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODMyMjgsImV4cCI6MjA4OTg1OTIyOH0.ecAVT1-bLv3yZOp-GnyR88lpH0xSVXV2hM80rB0fm6M';

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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  if (!value) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
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

function sanitizeHierarchyRows(rows = []) {
  return rows.filter(item =>
    !isNullLike(item?.codigo_produto)
    && !isNullLike(item?.origem_id)
    && !isNullLike(item?.familia_id)
    && !isNullLike(item?.agrupamento_cod)
  );
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
    .in('codigo_produto', codigos)
    .not('origem_id', 'is', null)
    .not('familia_id', 'is', null)
    .not('agrupamento_cod', 'is', null);

  if (dicionarioError) return { data: null, error: dicionarioError };

  const dicionarioByCodigo = new Map((dicionarioRows || []).map(row => [String(row.codigo_produto), row]));

  const enrichedRows = historicoBase
    .map(item => {
      const dictionaryEntry = dicionarioByCodigo.get(String(item.codigo_produto));
      if (!dictionaryEntry) return null;
      return {
        ...item,
        descricao: dictionaryEntry.descricao || item.descricao || null,
        origem_id: dictionaryEntry.origem_id,
        familia_id: dictionaryEntry.familia_id,
        agrupamento_cod: dictionaryEntry.agrupamento_cod
      };
    })
    .filter(Boolean);

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

export const api = {
  async getMasters() {
    const [
      { data: historicoRows, error: historicoError },
      { data: origensRaw, error: origensError },
      { data: familiasRaw, error: familiasError },
      { data: agrupamentosRaw, error: agrupamentosError },
      { data: dicionarioRaw, error: dicionarioError }
    ] = await Promise.all([
      supabase.from(TABLES.historico).select('codigo_produto'),
      supabase.from(TABLES.origem).select('*').order('descricao'),
      supabase.from(TABLES.familia).select('*').order('descricao'),
      supabase.from(TABLES.agrupamento).select('*').order('descricao'),
      supabase.from(TABLES.dicionario)
        .select('codigo_produto, descricao, origem_id, familia_id, agrupamento_cod')
        .not('origem_id', 'is', null)
        .not('familia_id', 'is', null)
        .not('agrupamento_cod', 'is', null)
    ]);

    const error = historicoError || origensError || familiasError || agrupamentosError || dicionarioError;
    if (error) {
      return { origens: [], familias: [], agrupamentos: [], dicionario: [], hierarquia: [], diagnostico_sem_mapa: [], error };
    }

    const codigosComCusto = new Set((historicoRows || [])
      .map(item => item?.codigo_produto)
      .filter(value => !isNullLike(value))
      .map(value => String(value).trim()));

    const dicionarioComCusto = (dicionarioRaw || [])
      .filter(item => codigosComCusto.has(String(item?.codigo_produto || '').trim()));

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
      dicionario: dicionarioComCusto,
      hierarquia: sanitizeHierarchyRows(mapHierarchyRows(dicionarioComCusto)),
      diagnostico_sem_mapa: await runDiagnosticoSemAgrupamento(),
      error: null
    };
  },

  async upsertHistoricoCustos(payload) {
    return supabase.from(TABLES.historico).upsert(payload, { onConflict: 'codigo_produto,data_referencia' });
  },

  async signIn(login, password) {
    const email = resolveLoginToEmail(login);
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signInWithMasterBootstrap(login, password) {
    const email = resolveLoginToEmail(login);
    const loginResult = await supabase.auth.signInWithPassword({ email, password });
    if (!loginResult.error) return loginResult;

    const isMaster = login === MASTER_ADMIN.username && password === MASTER_ADMIN.password;
    if (!isMaster) return loginResult;

    await supabase.auth.signUp({ email: MASTER_ADMIN.email, password });
    return supabase.auth.signInWithPassword({ email: MASTER_ADMIN.email, password });
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
    const baseLog = {
      status: 'processando',
      total_linhas: totalLinhas,
      linhas_importadas: 0,
      linhas_erro: 0,
      iniciado_em: inicio,
      finalizado_em: null,
      data_referencia: options.dataReferencia || null
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
    const codigos = [...new Set(rows.map(row => String(row?.codigo_produto || '').trim()).filter(Boolean))];

    const { data: dicionarioRows, error: dicionarioError } = await supabase
      .from(TABLES.dicionario)
      .select('codigo_produto, origem_id, familia_id, agrupamento_cod')
      .in('codigo_produto', codigos);

    if (dicionarioError) {
      return { data: null, error: dicionarioError };
    }

    const dicionarioByCodigo = new Map((dicionarioRows || []).map(item => [String(item.codigo_produto).trim(), item]));

    const payloadValido = [];
    rows.forEach((row, index) => {
      const validacao = validateHistoricoRow(row);
      if (!validacao.valido) {
        linhasErro += 1;
        erros.push({ linha: index + 1, tipo: 'validacao', mensagem: validacao.erros.join('; '), row });
        return;
      }

      const codigo = String(row.codigo_produto || '').trim();
      const dict = dicionarioByCodigo.get(codigo);
      if (!dict || isNullLike(dict.origem_id) || isNullLike(dict.familia_id) || isNullLike(dict.agrupamento_cod)) {
        linhasErro += 1;
        erros.push({
          linha: index + 1,
          tipo: 'dicionario',
          mensagem: `Produto ${codigo} sem mapeamento completo em dicionario_produtos.`,
          row
        });
        return;
      }

      payloadValido.push({
        codigo_produto: codigo,
        descricao: row.descricao ?? null,
        custo_variavel: normalizeMoneyValue(row.custo_variavel),
        custo_direto_fixo: normalizeMoneyValue(row.custo_direto_fixo),
        custo_total: normalizeMoneyValue(row.custo_total),
        data_referencia: row.data_referencia,
        operacao_timestamp: row.operacao_timestamp ?? new Date().toISOString()
      });
    });

    if (payloadValido.length > 0) {
      const { error: upsertError } = await supabase
        .from(TABLES.historico)
        .upsert(payloadValido, { onConflict: 'codigo_produto,data_referencia' });

      if (upsertError) {
        return { data: null, error: upsertError };
      }

      linhasImportadas = payloadValido.length;
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
  }
};
