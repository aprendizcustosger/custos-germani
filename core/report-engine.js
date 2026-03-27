/* Responsabilidade: cálculos analíticos e lógica de cascata (Origem -> Família -> Agrupamento). */

export function fillSelect(select, options, first) {
  select.innerHTML = `<option value="${first.value}">${first.label}</option>`;
  options.forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
  });
}

export function calculateCascadeOptions(state, masters) {
  const byOrigem = masters.dicionario.filter(item =>
    state.origem === 'TODAS' || String(item.origem_cod) === String(state.origem)
  );

  const familyIds = [...new Set(byOrigem.map(x => String(x.familia_cod)).filter(Boolean))];
  const familyOptions = familyIds.map(id => {
    const fam = masters.familias.find(f => String(f.id) === id);
    return { value: id, label: fam?.descricao || id };
  });

  const byFamilia = byOrigem.filter(item =>
    state.familia === 'TODAS' || String(item.familia_cod) === String(state.familia)
  );

  const groupIds = [...new Set(byFamilia.map(x => String(x.agrupamento_cod)).filter(Boolean))];
  const groupOptions = groupIds.map(id => {
    const grp = masters.agrupamentos.find(g => String(g.id) === id);
    return { value: id, label: grp?.descricao || id };
  });

  return { familyOptions, groupOptions };
}

export function buildReportRows(historico) {
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
    const dict = last.dicionario_produtos || {};

    return {
      codigo: first.codigo_produto,
      descricao: last.descricao || '-',
      origem: dict.origem_cod || '-',
      familia: dict.familia_cod || '-',
      agrupamento: dict.agrupamento_cod || '-',
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
