/* Responsabilidade: cálculos analíticos e lógica de cascata (Origem -> Família -> Agrupamento). */

export function fillSelect(select, options, first) {
  select.innerHTML = `<option value="${first.value}">${first.label}</option>`;
  options.forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
  });
}

export function calculateCascadeOptions(state, masters) {
  const byOrigem = masters.dicionario.filter(item =>
    state.origem === 'TODAS' || String(item.origem_id) === String(state.origem)
  );

  const familyIds = [...new Set(byOrigem.map(x => String(x.familia_id)).filter(Boolean))];
  const familyOptions = familyIds.map(id => {
    const fam = masters.familias.find(f => String(f.id) === id);
    return { value: id, label: fam?.descricao || id };
  });

  const byFamilia = byOrigem.filter(item =>
    state.familia === 'TODAS' || String(item.familia_id) === String(state.familia)
  );

  const groupIds = [...new Set(byFamilia.map(x => String(x.agrupamento_cod)).filter(Boolean))];
  const groupOptions = groupIds.map(id => {
    const grp = masters.agrupamentos.find(g => String(g.id) === id);
    return { value: id, label: grp?.descricao || id };
  });

  return { familyOptions, groupOptions };
}

export function buildReportRows(historico, masters = { origens: [], familias: [], agrupamentos: [] }) {
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
    const origemCod = String(dict.origem_id || '');
    const familiaCod = String(dict.familia_id || '');
    const agrupamentoCod = String(dict.agrupamento_cod || '');

    const origem = masters.origens.find(item => String(item.id) === origemCod)?.descricao || dict.origem_id || '-';
    const familia = masters.familias.find(item => String(item.id) === familiaCod)?.descricao || dict.familia_id || '-';
    const agrupamento = masters.agrupamentos.find(item => String(item.id) === agrupamentoCod)?.descricao || dict.agrupamento_cod || '-';

    return {
      codigo: first.codigo_produto,
      descricao: last.descricao || '-',
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
