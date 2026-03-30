/* Responsabilidade: cálculos analíticos e lógica de cascata (Origem -> Família -> Agrupamento -> Item). */

export function fillSelect(select, options, first, selectedValue = null) {
  select.innerHTML = `<option value="${first.value}">${first.label}</option>`;
  options.forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
  });

  if (selectedValue !== null) {
    const hasOption = [first.value, ...options.map(opt => opt.value)].includes(String(selectedValue));
    select.value = hasOption ? String(selectedValue) : String(first.value);
  }
}

export function calculateCascadeOptions(state, masters) {
  const dictionary = (masters.dicionario || []).map(item => ({
    ...item,
    codigo_produto: item?.codigo_produto ?? item?.produto ?? item?.codigo ?? null,
    descricao: item?.descricao ?? item?.nome ?? item?.produto_descricao ?? null
  }));

  const byOrigem = dictionary.filter(item =>
    state.origem === 'TODAS' || String(item.origem_id) === String(state.origem)
  );

  const familyIds = [...new Set(byOrigem.map(x => String(x.familia_id)).filter(Boolean))];
  const familyOptions = familyIds.map(id => {
    const fam = masters.familias.find(f => String(f.id) === id);
    return { value: id, label: fam?.descricao || id };
  }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const byFamilia = byOrigem.filter(item =>
    state.familia === 'TODAS' || String(item.familia_id) === String(state.familia)
  );

  const groupIds = [...new Set(byFamilia.map(x => String(x.agrupamento_cod)).filter(Boolean))];
  const groupOptions = groupIds.map(id => {
    const grp = masters.agrupamentos.find(g => String(g.id) === id);
    return { value: id, label: grp?.descricao || id };
  }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const productBase = byFamilia.filter(item =>
    state.agrupamento === 'TODOS' || String(item.agrupamento_cod) === String(state.agrupamento)
  );

  const productMap = new Map();
  productBase.forEach(item => {
    if (!item.codigo_produto) return;
    const codigo = String(item.codigo_produto);
    if (!productMap.has(codigo)) {
      productMap.set(codigo, { value: codigo, label: `${codigo} - ${item.descricao || '-'}` });
    }
  });
  const productOptions = [...productMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return { familyOptions, groupOptions, productOptions };
}

export function buildReportRows(historico, masters = { origens: [], familias: [], agrupamentos: [] }) {
  const getDictionary = (item) => {
    if (Array.isArray(item?.dicionario_produtos)) return item.dicionario_produtos[0] || {};
    return item?.dicionario_produtos || {};
  };

  const grouped = {};
  historico.forEach(item => {
    if (!grouped[item.codigo_produto]) grouped[item.codigo_produto] = [];
    grouped[item.codigo_produto].push(item);
  });

  return Object.values(grouped).map(items => {
    const first = items[0];
    const last = items[items.length - 1];
    const ini = Number(first.custo_total || 0);
    const fim = Number(last.custo_total || 0);
    const variacao = ini > 0 ? ((fim - ini) / ini) * 100 : 0;
    const dict = getDictionary(last);
    const origemCod = String(dict.origem_id || '');
    const familiaCod = String(dict.familia_id || '');
    const agrupamentoCod = String(dict.agrupamento_cod || '');

    const origem = masters.origens.find(item => String(item.id) === origemCod)?.descricao || dict.origem_id || '-';
    const familia = masters.familias.find(item => String(item.id) === familiaCod)?.descricao || dict.familia_id || '-';
    const agrupamento = masters.agrupamentos.find(item => String(item.id) === agrupamentoCod)?.descricao || dict.agrupamento_cod || '-';

    return {
      codigo: first.codigo_produto,
      descricao: last.descricao || dict.descricao || '-',
      origem,
      familia,
      agrupamento,
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
