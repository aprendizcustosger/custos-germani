/**
 * Monta opções em um select mantendo opção padrão.
 * @param {HTMLSelectElement} select
 * @param {Array<{value:string,label:string}>} options
 * @param {{value:string,label:string}} first
 */
export function fillSelect(select, options, first) {
  select.innerHTML = `<option value="${first.value}">${first.label}</option>`;
  options.forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
  });
}

/**
 * Recalcula famílias a partir da origem e agrupamentos a partir da família.
 * @param {{origem:string,familia:string}} state
 * @param {{dicionario:Array,familias:Array,agrupamentos:Array}} masters
 */
export function calculateCascadeOptions(state, masters) {
  const dicionarioByOrigem = masters.dicionario.filter(item =>
    state.origem === 'TODAS' || String(item.origem_cod) === String(state.origem)
  );

  const familyIds = [...new Set(dicionarioByOrigem.map(x => String(x.familia_cod)).filter(Boolean))];
  const familyOptions = familyIds.map(id => {
    const found = masters.familias.find(f => String(f.id) === id);
    return { value: id, label: found?.descricao || id };
  });

  const dicionarioByFamilia = dicionarioByOrigem.filter(item =>
    state.familia === 'TODAS' || String(item.familia_cod) === String(state.familia)
  );

  const groupIds = [...new Set(dicionarioByFamilia.map(x => String(x.agrupamento_cod)).filter(Boolean))];
  const groupOptions = groupIds.map(id => {
    const found = masters.agrupamentos.find(g => String(g.id) === id);
    return { value: id, label: found?.descricao || id };
  });

  return { familyOptions, groupOptions };
}

/**
 * Agrupa histórico por produto e calcula métricas de variação.
 * @param {Array} historico
 */
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

/**
 * Calcula KPIs executivos.
 * @param {Array} rows
 */
export function calculateKpis(rows) {
  const totalItens = rows.length;
  const totalAlertas = rows.filter(r => r.alert).length;
  const mediaVariacao = totalItens ? rows.reduce((acc, cur) => acc + cur.variacao, 0) / totalItens : 0;

  return { totalItens, totalAlertas, mediaVariacao };
}
