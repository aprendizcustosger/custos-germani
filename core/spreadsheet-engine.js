/* Responsabilidade: parsing e normalização de planilhas XLSX (Smart Scraper). */

export const REQUIRED_FIELDS = ['codigo_produto', 'descricao', 'custo_variavel', 'custo_direto_fixo', 'custo_total'];
const FIELD_ALIASES = {
  codigo_produto: ['produto', 'codigo', 'cod', 'item'],
  descricao: ['descricao', 'descrição', 'desc'],
  custo_variavel: ['custo variavel', 'custo var', 'variavel'],
  custo_direto_fixo: ['fixo', 'direto fixo', 'custo fixo'],
  custo_total: ['total', 'custo total']
};

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeaderKey(value) {
  return normalizeText(value).replace(/\s+/g, '_');
}

function hasMeaningfulValue(value) {
  return normalizeText(value).length > 0;
}

function findHeaderRowIndex(matrixRows) {
  return matrixRows.findIndex(row => {
    const normalizedRow = row.map(cell => normalizeHeaderKey(cell));
    return REQUIRED_FIELDS.every(field => normalizedRow.includes(field));
  });
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map(token => token.trim())
    .filter(Boolean);
}

function bigrams(value) {
  const text = normalizeText(value).replace(/\s+/g, '');
  if (!text) return new Set();
  if (text.length === 1) return new Set([text]);
  const result = new Set();
  for (let i = 0; i < text.length - 1; i += 1) {
    result.add(text.slice(i, i + 2));
  }
  return result;
}

function calculateDiceSimilarity(a, b) {
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  setA.forEach(chunk => {
    if (setB.has(chunk)) intersection += 1;
  });
  return (2 * intersection) / (setA.size + setB.size);
}

function scoreHeaderMatch(header, aliases = []) {
  const normalizedHeader = normalizeText(header);
  const headerTokens = tokenize(header);
  let bestScore = 0;

  aliases.forEach(alias => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return;

    if (normalizedHeader === normalizedAlias) {
      bestScore = Math.max(bestScore, 1);
      return;
    }
    if (normalizedHeader.includes(normalizedAlias)) {
      bestScore = Math.max(bestScore, 0.92);
      return;
    }

    const aliasTokens = tokenize(alias);
    const tokenOverlap = aliasTokens.length > 0
      ? aliasTokens.filter(token => headerTokens.includes(token)).length / aliasTokens.length
      : 0;
    if (tokenOverlap > 0) {
      bestScore = Math.max(bestScore, 0.65 + (tokenOverlap * 0.2));
    }

    const fuzzyScore = calculateDiceSimilarity(normalizedHeader, normalizedAlias);
    if (fuzzyScore >= 0.72) {
      bestScore = Math.max(bestScore, fuzzyScore * 0.85);
    }
  });

  return bestScore;
}

function detectColumnMapping(headers = []) {
  const normalizedHeaders = headers.map((header, index) => ({
    index,
    header,
    normalized: normalizeHeaderKey(header)
  }));
  const mapping = Object.fromEntries(REQUIRED_FIELDS.map(field => [field, null]));
  const usedHeaders = new Set();

  REQUIRED_FIELDS.forEach(field => {
    const exact = normalizedHeaders.find(item => item.normalized === field && !usedHeaders.has(item.header));
    if (exact) {
      mapping[field] = exact.header;
      usedHeaders.add(exact.header);
    }
  });

  REQUIRED_FIELDS.forEach(field => {
    if (mapping[field]) return;
    const aliases = FIELD_ALIASES[field] || [];
    let best = { header: null, score: 0 };

    headers.forEach(header => {
      if (usedHeaders.has(header)) return;
      const score = scoreHeaderMatch(header, aliases);
      if (score > best.score) best = { header, score };
    });

    if (best.header && best.score >= 0.72) {
      mapping[field] = best.header;
      usedHeaders.add(best.header);
    }
  });

  return mapping;
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

function roundTo4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function parseCurrency(value) {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return roundTo4(value);
  }

  let str = String(value).trim();
  if (!str) return 0;

  str = str.replace(/\s+/g, '').replace(/[R$]/g, '');

  if (str.includes(',')) {
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(str)) return 0;

  const num = Number(str);
  if (!Number.isFinite(num)) return 0;

  return roundTo4(num);
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
  const mapping = detectColumnMapping(headers);

  return {
    headers,
    mapping,
    rejectedHeaders: headers.filter(header => !REQUIRED_FIELDS.includes(normalizeHeaderKey(header)))
  };
}

export function mapRowsToPayload(rows, mapping, dataReferencia) {
  if (!mapping || typeof mapping !== 'object') {
    console.error('Importação abortada: objeto de mapeamento inválido.', mapping);
    return [];
  }

  const requiredColumns = {
    codigo_produto: mapping.codigo_produto,
    descricao: mapping.descricao,
    custo_total: mapping.custo_total
  };

  const missingMappings = Object.entries(requiredColumns)
    .filter(([, columnName]) => !String(columnName || '').trim())
    .map(([field]) => field);

  if (missingMappings.length > 0) {
    console.error('Importação abortada: mapeamento incompleto para campos obrigatórios.', {
      missingMappings,
      mapping
    });
    return [];
  }

  return rows
    .map((row, index) => {
      const produto = row[mapping.codigo_produto];
      const descricao = row[mapping.descricao];
      const custoTotal = row[mapping.custo_total];

      console.log('ROW ORIGINAL:', row);
      console.log('MAPPING:', mapping);
      console.log('VALORES EXTRAÍDOS:', {
        produto,
        descricao,
        custoTotal
      });

      const codigoProdutoNormalizado = normalizeCodigoProduto(produto);
      const descricaoNormalizada = String(descricao || '').replace(/\s+/g, ' ').trim();
      const custoVariavelNormalizado = parseCurrency(row[mapping.custo_variavel]);
      const custoDiretoFixoNormalizado = parseCurrency(row[mapping.custo_direto_fixo]);
      const custoTotalNormalizado = parseCurrency(custoTotal);
      const custoTotalInformado = String(custoTotal ?? '').trim().length > 0;

      const camposInvalidos = [];
      if (!codigoProdutoNormalizado) camposInvalidos.push('codigo_produto');
      if (!descricaoNormalizada) camposInvalidos.push('descricao');
      if (!custoTotalInformado) camposInvalidos.push('custo_total');

      if (camposInvalidos.length > 0) {
        console.error(`Linha ${index + 1} ignorada: campos obrigatórios ausentes (${camposInvalidos.join(', ')}).`, {
          row,
          mapping
        });
        return null;
      }

      return {
        codigo_produto: codigoProdutoNormalizado,
        descricao: descricaoNormalizada,
        custo_variavel: custoVariavelNormalizado,
        custo_direto_fixo: custoDiretoFixoNormalizado,
        custo_total: custoTotalNormalizado,
        data_referencia: dataReferencia,
        operacao_timestamp: new Date().toISOString()
      };
    })
    .filter(Boolean);
}

export function countValidMappedColumns(mapping) {
  return REQUIRED_FIELDS.filter(key => Boolean(mapping[key])).length;
}
