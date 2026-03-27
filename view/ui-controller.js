/* Responsabilidade: controle de interface, auto-auth, eventos e gráficos. */
import { api, MASTER_ADMIN } from '../src/services/api.js';
import { readWorkbook, scanHeaders, mapRowsToPayload, countValidMappedColumns, REQUIRED_FIELDS } from '../core/spreadsheet-engine.js';
import { fillSelect, calculateCascadeOptions, buildReportRows, calculateKpis } from '../core/report-engine.js';

const state = {
  user: null,
  masters: { origens: [], familias: [], agrupamentos: [], dicionario: [] },
  chart: null,
  trendChart: null
};

const dom = {
  userBox: document.getElementById('userBox'),
  navItems: Array.from(document.querySelectorAll('[data-view-trigger]')),
  views: {
    import: document.getElementById('view-import'),
    report: document.getElementById('view-report')
  },
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  importDate: document.getElementById('importDate'),
  dtStart: document.getElementById('dtStart'),
  dtEnd: document.getElementById('dtEnd'),
  selO: document.getElementById('selO'),
  selF: document.getElementById('selF'),
  selA: document.getElementById('selA'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  reportContent: document.getElementById('reportContent'),
  tableBody: document.getElementById('tableBody'),
  kpiItens: document.getElementById('kpiItens'),
  kpiAlertas: document.getElementById('kpiAlertas'),
  kpiMedia: document.getElementById('kpiMedia'),
  mainChart: document.getElementById('mainChart'),
  trendChart: document.getElementById('trendChart')
};

async function init() {
  bindNavigation();
  bindUpload();
  bindFilters();
  await autoAuthenticate();
  await loadMasters();
}

async function autoAuthenticate() {
  const session = await api.signInWithMasterBootstrap(MASTER_ADMIN.username, MASTER_ADMIN.password);
  if (!session.error && session.data?.user) {
    state.user = session.data.user;
    dom.userBox.textContent = `Usuário: ${state.user.email}`;
    return;
  }

  state.user = { id: 'PEDROK_LOCAL', email: MASTER_ADMIN.username };
  dom.userBox.textContent = 'Usuário: PedroK (modo local)';
  showToast('warning', 'Sem sessão Supabase. Operando com usuário local.');
}

async function loadMasters() {
  state.masters = await api.getMasters();
  fillSelect(dom.selO, state.masters.origens.map(x => ({ value: String(x.id), label: x.descricao })), { value: 'TODAS', label: 'TODAS' });
  refreshCascade();
}

function bindNavigation() {
  dom.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.viewTrigger;
      dom.navItems.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      Object.values(dom.views).forEach(v => v.classList.add('hidden'));
      dom.views[view].classList.remove('hidden');
    });
  });
}

function bindUpload() {
  dom.dropZone.addEventListener('click', () => dom.fileInput.click());
  dom.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') dom.fileInput.click();
  });

  dom.fileInput.addEventListener('change', async () => {
    if (dom.fileInput.files?.[0]) await handleImport(dom.fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dom.dropZone.addEventListener(evt, (e) => { e.preventDefault(); dom.dropZone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dom.dropZone.addEventListener(evt, (e) => { e.preventDefault(); dom.dropZone.classList.remove('dragover'); });
  });
  dom.dropZone.addEventListener('drop', async (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) await handleImport(file);
  });
}

function bindFilters() {
  dom.selO.addEventListener('change', () => refreshCascade('origem'));
  dom.selF.addEventListener('change', () => refreshCascade('familia'));
  dom.analyzeBtn.addEventListener('click', runReport);
}

function refreshCascade(trigger) {
  if (trigger === 'origem') dom.selF.value = 'TODAS';
  const { familyOptions } = calculateCascadeOptions({ origem: dom.selO.value, familia: dom.selF.value }, state.masters);
  fillSelect(dom.selF, familyOptions, { value: 'TODAS', label: 'TODAS' });

  const { groupOptions } = calculateCascadeOptions({ origem: dom.selO.value, familia: dom.selF.value || 'TODAS' }, state.masters);
  fillSelect(dom.selA, groupOptions, { value: 'TODOS', label: 'TODOS' });
}

async function handleImport(file) {
  const refDate = dom.importDate.value;
  if (!refDate) {
    showToast('warning', 'Selecione a data de referência.');
    return;
  }

  dom.dropZone.classList.add('processing');
  const rows = readWorkbook(await file.arrayBuffer());
  let { headers, mapping } = scanHeaders(rows);

  if (countValidMappedColumns(mapping) < 3) {
    const manualMap = await requestManualMapping(headers, mapping);
    if (!manualMap) {
      dom.dropZone.classList.remove('processing');
      return;
    }
    mapping = manualMap;
  }

  const payload = mapRowsToPayload(rows, mapping, refDate, state.user.id);
  const confirmed = await confirmImport(payload.length, countValidMappedColumns(mapping));
  if (!confirmed) {
    dom.dropZone.classList.remove('processing');
    return;
  }

  const dictCodes = new Set(state.masters.dicionario.map(x => String(x.codigo_produto).trim()));
  const missingCodes = [...new Set(payload.map(x => x.codigo_produto).filter(code => !dictCodes.has(String(code).trim())))];
  if (missingCodes.length) {
    dom.dropZone.classList.remove('processing');
    Swal.fire({
      icon: 'error',
      title: 'Produtos não cadastrados',
      html: `<p>Cadastre no dicionário antes de importar:</p><pre style="text-align:left;max-height:180px;overflow:auto;">${missingCodes.join('\n')}</pre>`
    });
    return;
  }

  const { error } = await api.upsertHistoricoCustos(payload);
  dom.dropZone.classList.remove('processing');
  if (error) {
    Swal.fire({ icon: 'error', title: 'Falha na gravação', text: error.message });
    return;
  }

  Swal.fire({ icon: 'success', title: 'Importação concluída', html: `<b>${payload.length}</b> itens salvos em <b>${refDate}</b>.` });
}

async function requestManualMapping(headers, current) {
  const options = headers.map(h => `<option value="${h}">${h}</option>`).join('');
  const result = await Swal.fire({
    title: 'Mapeamento manual de colunas',
    html: `
      <p style="margin-bottom:8px;">Não detectamos todas as colunas vitais automaticamente.</p>
      ${REQUIRED_FIELDS.map(field => `
        <label style="display:block;text-align:left;margin:6px 0 4px;">${field}</label>
        <select id="map_${field}" class="swal2-input" style="margin:0 0 8px;">${options}</select>
      `).join('')}
    `,
    focusConfirm: false,
    preConfirm: () => ({
      produto: document.getElementById('map_produto').value,
      descricao: document.getElementById('map_descricao').value,
      custo_total: document.getElementById('map_custo_total').value
    })
  });

  if (!result.isConfirmed) return null;
  return { ...current, ...result.value };
}

async function confirmImport(totalProdutos, totalColunasValidas) {
  const result = await Swal.fire({
    icon: 'question',
    title: 'Resumo da detecção',
    html: `Detectamos <b>${totalProdutos}</b> produtos e <b>${totalColunasValidas}</b> colunas válidas.<br/>Deseja prosseguir?`,
    showCancelButton: true,
    confirmButtonText: 'Prosseguir',
    cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
}

async function runReport() {
  const start = dom.dtStart.value;
  const end = dom.dtEnd.value;
  if (!start || !end) {
    showToast('warning', 'Informe período inicial e final.');
    return;
  }

  const { data, error } = await api.getHistorico({ start, end, origem: dom.selO.value, familia: dom.selF.value, agrupamento: dom.selA.value });
  if (error) {
    Swal.fire({ icon: 'error', title: 'Erro na consulta', text: error.message });
    return;
  }
  if (!data?.length) {
    showToast('info', 'Sem dados para os filtros selecionados.');
    return;
  }

  const rows = buildReportRows(data).sort((a, b) => b.variacao - a.variacao);
  const kpis = calculateKpis(rows);

  dom.kpiItens.textContent = kpis.totalItens;
  dom.kpiAlertas.textContent = kpis.totalAlertas;
  dom.kpiMedia.textContent = `${kpis.mediaVariacao.toFixed(2).replace('.', ',')}%`;

  renderMainChart(rows);
  renderTable(rows);
  dom.reportContent.classList.remove('hidden');
}

function renderTable(rows) {
  dom.tableBody.innerHTML = rows.map(row => `
    <tr class="${row.alert ? 'row-alert' : ''}" data-codigo="${row.codigo}">
      <td>${row.codigo}</td>
      <td>${row.descricao}</td>
      <td>${row.origem}</td>
      <td>${row.familia}</td>
      <td>${row.agrupamento}</td>
      <td>R$ ${row.inicial.toFixed(2)}</td>
      <td>R$ ${row.final.toFixed(2)}</td>
      <td>${row.variacao.toFixed(2)}%</td>
      <td><span class="badge ${row.alert ? 'alert' : 'ok'}">${row.alert ? 'ALTA' : 'OK'}</span></td>
    </tr>
  `).join('');

  dom.tableBody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', async () => {
      await renderTrendChart(tr.dataset.codigo);
    });
  });
}

function renderMainChart(rows) {
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(dom.mainChart, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.codigo),
      datasets: [{ label: 'Variação %', data: rows.map(r => Number(r.variacao.toFixed(2))), backgroundColor: rows.map(r => (r.variacao > 0 ? '#ef4444' : r.variacao < 0 ? '#10b981' : '#9ca3af')) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function renderTrendChart(codigo) {
  const { data, error } = await api.getTrendsByProduct(codigo);
  if (error) {
    showToast('error', 'Falha ao buscar tendência do produto.');
    return;
  }

  if (state.trendChart) state.trendChart.destroy();
  state.trendChart = new Chart(dom.trendChart, {
    type: 'line',
    data: {
      labels: (data || []).map(x => x.data_referencia),
      datasets: [{ label: `Tendência 6M - ${codigo}`, data: (data || []).map(x => Number(x.custo_total || 0)), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', tension: 0.25, fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function showToast(icon, text) {
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, showConfirmButton: false, icon, text });
}

init();
