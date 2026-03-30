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
    categoriaId: 'M012',
    familiaLabel: 'BISCOITO SOLTO DOCE',
    termos: ['biscoito', 'rosquinha']
  },
  {
    origem: 'MASSAS',
    categoriaId: 'M024',
    familiaLabel: 'MASSA COM OVOS',
    termos: ['massa', 'ovos', 'espaguete']
  },
  {
    origem: 'MOAGEM',
    categoriaId: 'M000',
    familiaLabel: 'MISTURAS GERAIS',
    termos: ['mistura', 'farinha']
  }
];

const DEFAULT_CATEGORY_ID = 'M000';

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
  const categoriaId = matchedRule?.categoriaId || DEFAULT_CATEGORY_ID;
  const origemHint = matchedRule?.origem || inferOrigem(normalizedDesc, codigoProduto);
  const familiaHint = matchedRule?.familiaLabel || 'MISTURAS GERAIS';
  const agrupamentoHint = inferAgrupamento(normalizedDesc, origemHint);
  const agrupamento_cod = findMasterIdByDescription(masters.agrupamentos, agrupamentoHint) || DEFAULT_CATEGORY_ID;

  return {
    origem_id: categoriaId,
    familia_id: categoriaId,
    agrupamento_cod,
    origem_hint: origemHint,
    familia_hint: familiaHint,
    agrupamento_hint: agrupamentoHint,
    status: 'SUGERIDO'
  };
}

export function splitImportRows(rows, masters = { dicionario: [] }) {
  const dictByCode = new Map((masters.dicionario || []).map(item => [normalizeProductCode(item.codigo_produto), item]));
  const pendingOrigem = DEFAULT_CATEGORY_ID;
  const pendingFamilia = DEFAULT_CATEGORY_ID;
  const pendingAgrupamento = DEFAULT_CATEGORY_ID;

  const validos = [];
  const novos_dicionario = [];
  const novosPorOrigem = {};
  const novosPorFamilia = {};

  rows.forEach(item => {
    const codigo = normalizeProductCode(item.codigo_produto);
    const normalizedItem = { ...item, codigo_produto: codigo };
    const suggestion = suggestCategory(normalizedItem, masters);
    validos.push(normalizedItem);

    novosPorOrigem[suggestion.origem_hint] = (novosPorOrigem[suggestion.origem_hint] || 0) + 1;
    novosPorFamilia[suggestion.familia_hint] = (novosPorFamilia[suggestion.familia_hint] || 0) + 1;

    if (dictByCode.has(codigo)) return;
    if (novos_dicionario.some(x => normalizeProductCode(x.codigo_produto) === codigo)) return;

    novos_dicionario.push({
      codigo_produto: codigo,
      descricao: String(normalizedItem.descricao || '').replace(/\s+/g, ' ').trim(),
      origem_id: suggestion.origem_id || pendingOrigem,
      familia_id: suggestion.familia_id || pendingFamilia,
      agrupamento_cod: suggestion.agrupamento_cod || pendingAgrupamento,
      sugestao_origem: suggestion.origem_hint,
      sugestao_familia: suggestion.familia_hint,
      sugestao_agrupamento: suggestion.agrupamento_hint,
      status_classificacao: suggestion.status
    });
  });

  return { validos, novos_dicionario, novos_por_origem: novosPorOrigem, novos_por_familia: novosPorFamilia };
}
