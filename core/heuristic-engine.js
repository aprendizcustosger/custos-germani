/* Responsabilidade: auto-classificação de produtos novos por heurística (SAP/Industrial). */
import { normalizeText } from './spreadsheet-engine.js';

const KEYWORDS = {
  moagem: ['trigo', 'farinha', 'farelo'],
  biscoitos: ['recheado', 'laminado', 'wafer', 'maria', 'maisena'],
  massas: ['espaguete', 'parafuso', 'ninho', 'ovos']
};

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

  const origemHint = inferOrigem(normalizedDesc, codigoProduto);
  const familiaHint = origemHint;
  const agrupamentoHint = inferAgrupamento(normalizedDesc, origemHint);

  const origem_cod = findMasterIdByDescription(masters.origens, origemHint);
  const familia_cod = findMasterIdByDescription(masters.familias, familiaHint);
  const agrupamento_cod = findMasterIdByDescription(masters.agrupamentos, agrupamentoHint);

  return {
    origem_cod: origem_cod || null,
    familia_cod: familia_cod || null,
    agrupamento_cod: agrupamento_cod || null,
    origem_hint: origemHint,
    familia_hint: familiaHint,
    agrupamento_hint: agrupamentoHint,
    status: origem_cod && familia_cod && (agrupamento_cod || agrupamentoHint === 'PENDENTE') ? 'SUGERIDO' : 'PENDENTE'
  };
}

export function splitImportRows(rows, masters = { dicionario: [] }) {
  const dictByCode = new Map((masters.dicionario || []).map(item => [normalizeProductCode(item.codigo_produto), item]));
  const pendingOrigem = findMasterIdByDescription(masters.origens, 'PENDENTE');
  const pendingFamilia = findMasterIdByDescription(masters.familias, 'PENDENTE');
  const pendingAgrupamento = findMasterIdByDescription(masters.agrupamentos, 'PENDENTE');

  const validos = [];
  const novos_dicionario = [];
  const novosPorOrigem = {};

  rows.forEach(item => {
    const codigo = normalizeProductCode(item.codigo_produto);
    const normalizedItem = { ...item, codigo_produto: codigo };
    validos.push(normalizedItem);

    if (dictByCode.has(codigo)) return;
    if (novos_dicionario.some(x => normalizeProductCode(x.codigo_produto) === codigo)) return;

    const suggestion = suggestCategory(normalizedItem, masters);
    novosPorOrigem[suggestion.origem_hint] = (novosPorOrigem[suggestion.origem_hint] || 0) + 1;

    novos_dicionario.push({
      codigo_produto: codigo,
      descricao: String(normalizedItem.descricao || '').replace(/\s+/g, ' ').trim(),
      origem_cod: suggestion.origem_cod || pendingOrigem,
      familia_cod: suggestion.familia_cod || pendingFamilia,
      agrupamento_cod: suggestion.agrupamento_cod || pendingAgrupamento || 'PENDENTE',
      sugestao_origem: suggestion.origem_hint,
      sugestao_familia: suggestion.familia_hint,
      sugestao_agrupamento: suggestion.agrupamento_hint,
      status_classificacao: suggestion.status
    });
  });

  return { validos, novos_dicionario, novos_por_origem: novosPorOrigem };
}
