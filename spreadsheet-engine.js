/**
 * Normaliza string removendo acentos e espaços extras.
 * @param {string} value
 */
export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpeza de moeda BRL: R$ 1.234,56 -> 1234.56
 * @param {string|number} input
 */
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

/**
 * Identifica colunas automaticamente por similaridade.
 * @param {Record<string, any>} row
 */
export function detectColumns(row) {
  const headers = Object.keys(row).map((original) => ({
    original,
    key: normalizeText(original).replace(/\s+/g, '')
  }));

  const produtoCol = headers.find(h => h.key.includes('produto') || h.key.includes('codigoproduto') || h.key === 'codigo')?.original;
  const descricaoCol = headers.find(h => h.key.includes('descricao') || h.key.includes('descr'))?.original;
  const custoCol = headers.find(h => h.key.includes('custototal') || (h.key.includes('custo') && h.key.includes('total')) || h.key.includes('valorcusto'))?.original;

  return { produtoCol, descricaoCol, custoCol };
}

/**
 * Lê planilha XLSX e converte em payload para o banco.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} dataReferencia
 */
export function buildPayloadFromWorkbook(arrayBuffer, dataReferencia) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return rows
    .map((row) => {
      const { produtoCol, descricaoCol, custoCol } = detectColumns(row);
      return {
        codigo_produto: String(row[produtoCol] || '').trim(),
        descricao: String(row[descricaoCol] || '').trim(),
        custo_total: parseCurrencyBRL(row[custoCol]),
        data_referencia: dataReferencia
      };
    })
    .filter(item => item.codigo_produto.length > 1 && item.custo_total > 0);
}
