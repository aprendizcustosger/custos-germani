/* Responsabilidade: parsing e normalização de planilhas XLSX (Smart Scraper). */

export const REQUIRED_FIELDS = ['codigo_produto', 'descricao', 'custo_variavel', 'custo_direto_fixo', 'custo_total'];
const ALLOWED_HEADER_MAP = {
  produto: 'codigo_produto',
  codigoproduto: 'codigo_produto',
  codigo: 'codigo_produto',
  descricao: 'descricao',
  descricaoproduto: 'descricao',
  custovariavel: 'custo_variavel',
  custovar: 'custo_variavel',
  custodiretofixo: 'custo_direto_fixo',
  custodireto: 'custo_direto_fixo',
  custototal: 'custo_total'
};

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulValue(value) {
  return normalizeText(value).length > 0;
}

function findHeaderRowIndex(matrixRows) {
  return matrixRows.findIndex(row =>
    row.some(cell => normalizeText(cell).includes('produto'))
  );
}


function normalizeCodigoProduto(value) {
  const raw = String(value || '').trim().replace(',', '.');
  if (!raw) return '';

  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num.toLocaleString('fullwide', { useGrouping: false });
  }

  return raw.replace(/\s+/g, '');
}

export function parseCurrencyBRL(input) {
  const cleaned = String(input || '0')
    .replace(/r\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

export function readWorkbook(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrixRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });

  const headerRowIndex = findHeaderRowIndex(matrixRows);
  const safeHeaderIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
  const headers = (matrixRows[safeHeaderIndex] || []).map(value => String(value || '').trim());

  return matrixRows
    .slice(safeHeaderIndex + 1)
    .filter(row => row.some(hasMeaningfulValue))
    .map(row => {
      const item = {};
      headers.forEach((header, index) => {
        if (!header) return;
        item[header] = row[index] ?? '';
      });
      return item;
    });
}

export function scanHeaders(rows) {
  const headers = [...new Set((rows || []).flatMap(row => Object.keys(row || {})))];
  const normalizedHeaders = headers.map(h => ({ original: h, key: normalizeText(h).replace(/\s+/g, '') }));
  const allowedHeaders = normalizedHeaders.filter(h => ALLOWED_HEADER_MAP[h.key]);

  const mapping = { codigo_produto: null, descricao: null, custo_variavel: null, custo_direto_fixo: null, custo_total: null };
  allowedHeaders.forEach(header => {
    const canonical = ALLOWED_HEADER_MAP[header.key];
    if (!mapping[canonical]) mapping[canonical] = header.original;
  });

  return {
    headers,
    mapping,
    rejectedHeaders: []
  };
}

export function mapRowsToPayload(rows, mapping, dataReferencia, userId) {
  return rows.map(row => ({
    codigo_produto: normalizeCodigoProduto(row[mapping.codigo_produto]),
    descricao: String(row[mapping.descricao] || '').replace(/\s+/g, ' ').trim(),
    custo_total: parseCurrencyBRL(row[mapping.custo_total]),
    data_referencia: dataReferencia,
    user_id: userId,
    operacao_timestamp: new Date().toISOString()
  })).filter(item => item.codigo_produto.length > 0);
}

export function countValidMappedColumns(mapping) {
  return REQUIRED_FIELDS.filter(key => Boolean(mapping[key])).length;
}
