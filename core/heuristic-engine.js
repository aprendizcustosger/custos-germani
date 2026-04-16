/* Responsabilidade: auto-classificação de produtos novos por heurística (SAP/Industrial). */
import { normalizeText } from './spreadsheet-engine.js';

const KEYWORDS = {
  moagem: ['trigo', 'farinha', 'farelo'],
  biscoitos: ['recheado', 'laminado', 'wafer', 'maria', 'maisena'],
  massas: ['espaguete', 'parafuso', 'ninho', 'ovos']
};

const GERMANI_RULES = [
  { id: 'M012', origem: 'BISCOITOS', familiaLabel: 'BISCOITO SOLTO DOCE', termos: ['biscoito', 'rosquinha'] },
  { id: 'M024', origem: 'MASSAS', familiaLabel: 'MASSA COM OVOS', termos: ['massa', 'ovos'] },
  { id: 'M000', origem: 'MOAGEM', familiaLabel: 'MISTURAS GERAIS', termos: ['mistura', 'farinha'] }
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
    || null;
}

function findMasterIdByFixedCode(options, fixedCode) {
  const target = String(fixedCode || '').trim().toUpperCase();
  return (options || []).find(item => String(item.id || '').trim().toUpperCase() === target)?.id || null;
}

function findAutoRule(normalizedDesc) {
  return GERMANI_RULES.find(rule => rule.termos.some(termo => normalizedDesc.includes(termo))) || GERMANI_RULES[2];
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
  const pendingAgrupamento = findPendingId(masters.agrupamentos);

  if (matchedRule) {
    const fixedId = findMasterIdByFixedCode(masters.origens, matchedRule.id)
      || findMasterIdByFixedCode(masters.familias, matchedRule.id);
    const origem_id = fixedId;
    const familia_id = fixedId;

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

  const origem_id = findMasterIdByDescription(masters.origens, origemHint);
  const familia_id = findMasterIdByDescription(masters.familias, familiaHint);
  const agrupamento_cod = findMasterIdByDescription(masters.agrupamentos, agrupamentoHint);

  return {
    origem_id: origem_id || null,
    familia_id: familia_id || null,
    agrupamento_cod: agrupamento_cod || null,
    origem_hint: origemHint,
    familia_hint: familiaHint,
    agrupamento_hint: agrupamentoHint,
    status: origem_id && familia_id && (agrupamento_cod || agrupamentoHint === 'PENDENTE') ? 'SUGERIDO' : 'PENDENTE'
  };
}

export function splitImportRows(rows, masters = { dicionario: [] }) {
  const dictByCode = new Map((masters.dicionario || []).map(item => [normalizeProductCode(item.codigo_produto), item]));
  const pendingAgrupamento = findPendingId(masters.agrupamentos);

  const validos = [];
  const novos_dicionario = [];
  const novosPorOrigem = {};
  const novosPorFamilia = {};

  rows.forEach(item => {
    const codigo = normalizeProductCode(item.codigo_produto);
    const normalizedItem = { ...item, codigo_produto: codigo };
    const suggestion = suggestCategory(normalizedItem, masters);
    const normalizedDesc = normalizeText(normalizedItem.descricao || '');
    validos.push(normalizedItem);

    novosPorOrigem[suggestion.origem_hint] = (novosPorOrigem[suggestion.origem_hint] || 0) + 1;
    novosPorFamilia[suggestion.familia_hint] = (novosPorFamilia[suggestion.familia_hint] || 0) + 1;

    if (dictByCode.has(codigo)) return;
    if (novos_dicionario.some(x => normalizeProductCode(x.codigo_produto) === codigo)) return;

    let origem_id = suggestion.origem_id || null;
    let familia_id = suggestion.familia_id || null;
    let sugestao_origem = suggestion.origem_hint;
    let sugestao_familia = suggestion.familia_hint;

    novos_dicionario.push({
      codigo_produto: codigo,
      origem_id,
      familia_id,
      agrupamento_cod: suggestion.agrupamento_cod || pendingAgrupamento || null,
      sugestao_origem,
      sugestao_familia,
      sugestao_agrupamento: suggestion.agrupamento_hint,
      status_classificacao: suggestion.status
    });
  });

  return { validos, novos_dicionario, novos_por_origem: novosPorOrigem, novos_por_familia: novosPorFamilia };
}
