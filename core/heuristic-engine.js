/* Responsabilidade: auto-classificação de produtos novos por heurística (SAP/Industrial). */
import { normalizeText } from './spreadsheet-engine.js';

const KEYWORDS = {
  moagem: ['trigo', 'farinha', 'farelo'],
  biscoitos: ['recheado', 'laminado', 'wafer', 'maria', 'maisena'],
  massas: ['espaguete', 'parafuso', 'ninho', 'ovos']
};

const AUTO_FAMILY_RULES = [
  {
    origem: 'BISCOITOS',
    familiaId: 'M012',
    familiaLabel: 'BISCOITO SOLTO DOCE',
    termos: ['biscoito', 'wafer', 'recheado', 'rosquinha']
  },
  {
    origem: 'MASSAS',
    familiaId: 'M024',
    familiaLabel: 'MASSA COM OVOS',
    termos: ['espaguete', 'parafuso', 'penne', 'ovos']
  },
  {
    origem: 'MOAGEM',
    familiaId: 'M000',
    familiaLabel: 'MISTURAS GERAIS',
    termos: ['farinha', 'trigo', 'mistura']
  }
];

const PACK_REGEX = /(\d+\s?(g|kg)|cx)\b/i;

export function normalizeProductCode(value) {
  const raw = String(value || '').trim().replace(',', '.');
  if (!raw) return '';

  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num.toLocaleString('fullwide', { useGrouping: false });
  }

  return raw.replace(/\s+/g, '');
}

function findMasterIdByDescription(options, label) {
  const target = normalizeText(label);
  return (options || []).find(item => normalizeText(item.descricao) === target)?.id || null;
}

function findPendingId(options) {
  return findMasterIdByDescription(options, 'PENDENTE')
    || findMasterIdByDescription(options, 'OUTROS')
    || 'PENDENTE';
}

function findFamilyId(masters, rule) {
  const ids = new Set((masters.familias || []).map(item => String(item.id)));
  if (ids.has(String(rule.familiaId))) return rule.familiaId;
  return findMasterIdByDescription(masters.familias, rule.familiaLabel) || findPendingId(masters.familias);
}

function findAutoRule(normalizedDesc) {
  return AUTO_FAMILY_RULES.find(rule => rule.termos.some(termo => normalizedDesc.includes(termo))) || null;
}

function inferOrigem(normalizedDesc, codigoProduto) {
  if (KEYWORDS.biscoitos.some(k => normalizedDesc.includes(k))) return 'BISCOITOS';
  if (KEYWORDS.massas.some(k => normalizedDesc.includes(k))) return 'MASSAS';
  if (KEYWORDS.moagem.some(k => normalizedDesc.includes(k)) || /^1[01]/.test(codigoProduto)) return 'MOAGEM';
  return 'PENDENTE';
}

function inferAgrupamento(normalizedDesc, origemHint) {
  const pack = normalizedDesc.match(PACK_REGEX)?.[0]?.toUpperCase()?.replace(/\s+/g, '') || 'PENDENTE';

  if (origemHint === 'BISCOITOS' && normalizedDesc.includes('recheado') && pack !== 'PENDENTE') {
    return `BISCOITOS RECHEADOS ${pack}`;
  }

  if (origemHint !== 'PENDENTE' && pack !== 'PENDENTE') return `${origemHint} ${pack}`;
  if (origemHint !== 'PENDENTE') return origemHint;
  return 'PENDENTE';
}

export function suggestCategory(product, masters = { origens: [], familias: [], agrupamentos: [] }) {
  const codigoProduto = normalizeProductCode(product.codigo_produto);
  const normalizedDesc = normalizeText(product.descricao || '');

  const matchedRule = findAutoRule(normalizedDesc);
  const pendingOrigem = findPendingId(masters.origens);
  const pendingFamilia = findPendingId(masters.familias);
  const pendingAgrupamento = findPendingId(masters.agrupamentos);

  if (matchedRule) {
    const origem_id = findMasterIdByDescription(masters.origens, matchedRule.origem) || pendingOrigem;
    const familia_id = findFamilyId(masters, matchedRule);

    return {
      origem_id,
      familia_id,
      agrupamento_cod: findMasterIdByDescription(masters.agrupamentos, matchedRule.familiaLabel) || pendingAgrupamento,
      origem_hint: matchedRule.origem,
      familia_hint: matchedRule.familiaLabel,
      agrupamento_hint: matchedRule.familiaLabel,
      status: 'SUGERIDO'
    };
  }

  const origemHint = inferOrigem(normalizedDesc, codigoProduto);
  const familiaHint = origemHint;
  const agrupamentoHint = inferAgrupamento(normalizedDesc, origemHint);

  const origem_id = findMasterIdByDescription(masters.origens, origemHint) || pendingOrigem;
  const familia_id = findMasterIdByDescription(masters.familias, familiaHint) || pendingFamilia;
  const agrupamento_cod = findMasterIdByDescription(masters.agrupamentos, agrupamentoHint);

  return {
    origem_id,
    familia_id,
    agrupamento_cod: agrupamento_cod || pendingAgrupamento,
    origem_hint: origemHint,
    familia_hint: familiaHint,
    agrupamento_hint: agrupamentoHint,
    status: (origemHint === 'PENDENTE' && familiaHint === 'PENDENTE') ? 'PENDENTE' : 'SUGERIDO'
  };
}

export function splitImportRows(rows, masters = { dicionario: [] }) {
  const dictByCode = new Map((masters.dicionario || []).map(item => [normalizeProductCode(item.codigo_produto), item]));
  const pendingOrigem = findPendingId(masters.origens);
  const pendingFamilia = findPendingId(masters.familias);
  const pendingAgrupamento = findPendingId(masters.agrupamentos);

  const validos = [];
  const novos_dicionario = [];
  const novosPorOrigem = {};
  const novosPorFamilia = {};

  rows.forEach(item => {
    const codigo = normalizeProductCode(item.codigo_produto);
    const normalizedItem = { ...item, codigo_produto: codigo };
    validos.push(normalizedItem);

    if (dictByCode.has(codigo)) return;
    if (novos_dicionario.some(x => normalizeProductCode(x.codigo_produto) === codigo)) return;

    const suggestion = suggestCategory(normalizedItem, masters);
    novosPorOrigem[suggestion.origem_hint] = (novosPorOrigem[suggestion.origem_hint] || 0) + 1;
    novosPorFamilia[suggestion.familia_hint] = (novosPorFamilia[suggestion.familia_hint] || 0) + 1;

    novos_dicionario.push({
      codigo_produto: codigo,
      descricao: String(normalizedItem.descricao || '').replace(/\s+/g, ' ').trim(),
      origem_id: suggestion.origem_id || pendingOrigem,
      familia_id: suggestion.familia_id || pendingFamilia,
      agrupamento_cod: suggestion.agrupamento_cod || pendingAgrupamento || 'PENDENTE',
      sugestao_origem: suggestion.origem_hint,
      sugestao_familia: suggestion.familia_hint,
      sugestao_agrupamento: suggestion.agrupamento_hint,
      status_classificacao: suggestion.status
    });
  });

  return { validos, novos_dicionario, novos_por_origem: novosPorOrigem, novos_por_familia: novosPorFamilia };
}
