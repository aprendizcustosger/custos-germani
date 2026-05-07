/* Responsabilidade: cálculos analíticos e lógica de cascata (Origem -> Família -> Agrupamento -> Item). */

export function fillSelect(select, options, first, selectedValue = null) {
  select.innerHTML = `<option value="${first.value}">${first.label}</option>`;
  options
    .filter(opt => !isNullLike(opt?.value) && !isNullLike(opt?.label))
    .forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
    });

  if (selectedValue !== null) {
    const hasOption = [first.value, ...options.map(opt => opt.value)].includes(String(selectedValue));
    select.value = hasOption ? String(selectedValue) : String(first.value);
  }
}

function isNullLike(value) {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return !normalized || normalized === 'null' || normalized === 'undefined';
}

export function calculateCascadeOptions(state, masters) {
  const hierarchySource = (masters.hierarquia || []).length ? masters.hierarquia : (masters.dicionario || []);
  const dictionary = hierarchySource.map(item => ({
    ...item,
    codigo_produto: item?.codigo_produto ?? item?.produto ?? item?.codigo ?? null,
    descricao: item?.descricao ?? item?.nome ?? item?.produto_descricao ?? null
  }))
    .filter(item => !isNullLike(item?.codigo_produto));

  const byOrigem = dictionary.filter(item =>
    state.origem === 'TODAS' || String(item.origem_id) === String(state.origem)
  );

  const familyIds = [...new Set(byOrigem
    .map(x => x?.familia_id)
    .filter(id => !isNullLike(id))
    .map(id => String(id).trim())
    .filter(id => !isNullLike(id)))];
  const familyOptions = familyIds.map(id => {
    const fam = masters.familias.find(f => String(f.id) === id);
    return { value: id, label: fam?.descricao };
  })
    .filter(item => !isNullLike(item.label))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const byFamilia = byOrigem.filter(item =>
    state.familia === 'TODAS' || String(item.familia_id) === String(state.familia)
  );

  const groupIds = [...new Set(byFamilia
    .map(x => x?.agrupamento_cod)
    .filter(id => !isNullLike(id))
    .map(id => String(id).trim())
    .filter(id => !isNullLike(id)))];
  const groupOptions = groupIds.map(id => {
    const grp = masters.agrupamentos.find(g => String(g.id) === id);
    return { value: id, label: grp?.descricao };
  })
    .filter(item => !isNullLike(item.label))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const allProducts = (masters.produtos || [])
    .map(item => ({
      codigo_produto: String(item?.codigo_produto || '').trim(),
      descricao: item?.descricao || '-'
    }))
    .filter(item => !isNullLike(item?.codigo_produto));

  const selectedAnyFilter = state.origem !== 'TODAS' || state.familia !== 'TODAS' || state.agrupamento !== 'TODOS';
  const productCodesByCascade = new Set(byFamilia
    .filter(item => state.agrupamento === 'TODOS' || String(item.agrupamento_cod) === String(state.agrupamento))
    .map(item => String(item?.codigo_produto || '').trim())
    .filter(Boolean));
  const productBase = selectedAnyFilter
    ? allProducts.filter(item => productCodesByCascade.has(item.codigo_produto))
    : allProducts;

  const productMap = new Map();
  productBase.forEach(item => {
    if (!item.codigo_produto) return;
    const codigo = String(item.codigo_produto).trim();
    if (!productMap.has(codigo)) {
      productMap.set(codigo, { value: codigo, label: `${codigo} - ${item.descricao || '-'}` });
    }
  });
  const productOptions = [...productMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return { familyOptions, groupOptions, productOptions };
}

export function buildReportRows(historico, masters = { origens: [], familias: [], agrupamentos: [] }) {
  const grouped = {};
  historico.forEach(item => {
    if (!grouped[item.codigo_produto]) grouped[item.codigo_produto] = [];
    grouped[item.codigo_produto].push(item);
  });

  return Object.values(grouped).map(items => {
    const byPeriodo = [...items].sort((a, b) => String(a.data_referencia || '').localeCompare(String(b.data_referencia || '')));
    const first = byPeriodo[0];
    const last = byPeriodo[byPeriodo.length - 1];
    const ini = Number(first?.custo_total || 0);
    const fim = Number(last?.custo_total || 0);
    const variacao = ini > 0 ? ((fim - ini) / ini) * 100 : 0;

    const byCriadoEm = [...items].sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    const ultimo = byCriadoEm[0] || null;
    const penultimo = byCriadoEm[1] || null;
    const ultimoCusto = Number(ultimo?.custo_total || 0);
    const penultimoCusto = Number(penultimo?.custo_total || 0);
    const diferenca = ultimo ? (ultimoCusto - penultimoCusto) : 0;
    const variacaoTemporal = penultimoCusto > 0 ? ((ultimoCusto - penultimoCusto) / penultimoCusto) * 100 : 0;

    return {
      codigo: first.codigo_produto,
      descricao: last.descricao || '-',
      ultimoCusto: ultimo ? ultimoCusto : null,
      penultimoCusto: penultimo ? penultimoCusto : null,
      diferenca: ultimo ? diferenca : null,
      variacaoTemporal: ultimo ? variacaoTemporal : null,
      ultimaAtualizacao: ultimo?.criado_em || null,
      inicial: ini,
      final: fim,
      variacao,
      alert: variacao > 5
    };
  });
}

export function calculateKpis(rows) {
  const totalItens = rows.length;
  const totalAlertas = rows.filter(r => r.alert).length;
  const mediaVariacao = totalItens ? rows.reduce((acc, cur) => acc + cur.variacao, 0) / totalItens : 0;
  return { totalItens, totalAlertas, mediaVariacao };
}
