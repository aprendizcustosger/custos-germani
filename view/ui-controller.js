/* Responsabilidade: controle de interface, auto-auth, eventos e gráficos. */
import { api } from '../src/services/api.js';
import { readWorkbook, scanHeaders, mapRowsToPayload, countValidMappedColumns, REQUIRED_FIELDS } from '../core/spreadsheet-engine.js';
import { fillSelect, calculateCascadeOptions, buildReportRows, calculateKpis } from '../core/report-engine.js';

const state = {
  user: null,
  masters: { origens: [], familias: [], agrupamentos: [], dicionario: [], hierarquia: [] },
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
  selI: document.getElementById('selI'),
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
  autoAuthenticate();
  await loadMasters({ force: true });
  await fetchMetadata();
}

function autoAuthenticate() {
  state.user = { id: null, email: 'modo_local' };
  dom.userBox.textContent = 'Usuário: modo local';
}

async function loadMasters(options = {}) {
  const { force = false } = options;
  const masters = await api.getMasters();
  if (masters.error) {
    showToast('error', `Falha ao carregar tabelas de apoio: ${masters.error.message}`);
  }

  if (!force && state.masters.dicionario.length && !masters.dicionario?.length) return;

  state.masters = {
    origens: masters.origens || [],
    familias: masters.familias || [],
    agrupamentos: masters.agrupamentos || [],
    dicionario: masters.dicionario || [],
    hierarquia: masters.hierarquia || []
  };
  if (masters.diagnostico_sem_mapa?.length) {
    console.warn(`Diagnóstico: ${masters.diagnostico_sem_mapa.length} produto(s) sem registro em mapa_produtos.`);
  }
  fillSelect(dom.selO, state.masters.origens.map(x => ({ value: String(x.id), label: x.descricao })), { value: 'TODAS', label: 'TODAS' }, dom.selO.value || 'TODAS');
  refreshCascade();
}

async function fetchMetadata() {
  await loadMasters({ force: true });
  fillSelect(
    dom.selO,
    state.masters.origens.map(item => ({ value: String(item.id), label: item.nome || item.descricao || String(item.id) })),
    { value: 'TODAS', label: 'TODAS' },
    dom.selO.value || 'TODAS'
  );
  fillSelect(
    dom.selF,
    state.masters.familias.map(item => ({ value: String(item.id), label: item.nome || item.descricao || String(item.id) })),
    { value: 'TODAS', label: 'TODAS' },
    dom.selF.value || 'TODAS'
  );
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
      if (view === 'report') {
        fetchMetadata();
      }
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
  dom.selA.addEventListener('change', () => refreshCascade('agrupamento'));
  dom.selI.addEventListener('change', () => autoRefreshReport());
  [dom.dtStart, dom.dtEnd].forEach(input => input.addEventListener('change', () => autoRefreshReport()));
  dom.analyzeBtn.addEventListener('click', runReport);
}

function refreshCascade(trigger) {
  const currentFamily = dom.selF.value || 'TODAS';
  const currentGroup = dom.selA.value || 'TODOS';
  const currentItem = dom.selI.value || 'TODOS';

  if (trigger === 'origem') {
    dom.selF.value = 'TODAS';
    dom.selA.value = 'TODOS';
    dom.selI.value = 'TODOS';
  }
  if (trigger === 'familia') {
    dom.selA.value = 'TODOS';
    dom.selI.value = 'TODOS';
  }
  if (trigger === 'agrupamento') {
    dom.selI.value = 'TODOS';
  }

  const familyValue = trigger === 'origem' ? 'TODAS' : currentFamily;
  const { familyOptions } = calculateCascadeOptions({ origem: dom.selO.value, familia: familyValue }, state.masters);
  fillSelect(dom.selF, familyOptions, { value: 'TODAS', label: 'TODAS' }, familyValue);

  const { groupOptions, productOptions } = calculateCascadeOptions({
    origem: dom.selO.value,
    familia: dom.selF.value || 'TODAS',
    agrupamento: dom.selA.value || 'TODOS'
  }, state.masters);
  const groupValue = ['origem', 'familia'].includes(trigger) ? 'TODOS' : currentGroup;
  const itemValue = ['origem', 'familia', 'agrupamento'].includes(trigger) ? 'TODOS' : currentItem;
  fillSelect(dom.selA, groupOptions, { value: 'TODOS', label: 'TODOS' }, groupValue);
  fillSelect(dom.selI, productOptions, { value: 'TODOS', label: 'TODOS' }, itemValue);
  autoRefreshReport();
}

function autoRefreshReport() {
  if (dom.dtStart.value && dom.dtEnd.value) {
    runReport({ silent: true });
  }
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

  if (countValidMappedColumns(mapping) < REQUIRED_FIELDS.length) {
    const manualMap = await requestManualMapping(headers, mapping);
    if (!manualMap) {
      dom.dropZone.classList.remove('processing');
      return;
    }
    mapping = manualMap;
  }

  const payload = mapRowsToPayload(rows, mapping, refDate, state.user?.id || null);
  const confirmed = await confirmImport(payload.length, countValidMappedColumns(mapping));
  if (!confirmed) {
    dom.dropZone.classList.remove('processing');
    return;
  }

  const { data: resultadoImportacao, error } = await api.importarHistoricoCustosComLog(payload, {
    userId: state.user?.id || null,
    dataReferencia: refDate
  });
  dom.dropZone.classList.remove('processing');
  if (error) {
    showToast('error', `Erro na importação: ${error.message}`);
    return;
  }

  const resumoImportacao = resultadoImportacao?.resumo || {
    total_linhas: payload.length,
    linhas_importadas: payload.length,
    linhas_erro: 0
  };
  if (resultadoImportacao?.log_error) {
    console.warn('Falha ao registrar log da importação:', resultadoImportacao.log_error);
  }

  const successCount = Number(resumoImportacao.linhas_importadas || 0);
  const errorCount = Number(resumoImportacao.linhas_erro || 0);
  const successMessage = `${successCount} itens importados com sucesso`;
  showToast('success', successMessage);
  await Swal.fire({
    icon: errorCount > 0 ? 'warning' : 'success',
    title: successMessage,
    html: `
      <div style="text-align:left;">
        <p><b>Total de linhas:</b> ${resumoImportacao.total_linhas}</p>
        <p><b>Importadas:</b> ${successCount}</p>
        <p><b>Falhas:</b> ${errorCount}</p>
        ${errorCount > 0 ? `<p><b>${errorCount} itens falharam</b></p>` : ''}
      </div>
    `
  });
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
      codigo_produto: document.getElementById('map_codigo_produto').value,
      descricao: document.getElementById('map_descricao').value,
      custo_variavel: document.getElementById('map_custo_variavel').value,
      custo_direto_fixo: document.getElementById('map_custo_direto_fixo').value,
      custo_total: document.getElementById('map_custo_total').value
    })
  });

  if (!result.isConfirmed) return null;
  return { ...current, ...result.value };
}

async function confirmImport(totalProdutos, totalColunasValidas, familySummary = {}) {
  const hasFamilySummary = Object.keys(familySummary).length > 0;
  const summaryHtml = Object.entries(familySummary)
    .sort((a, b) => b[1] - a[1])
    .map(([familia, total]) => `• <b>${familia}</b>: ${total}`)
    .join('<br/>');
  const familySection = hasFamilySummary
    ? `<br/><br/>Famílias categorizadas:<br/>${summaryHtml}`
    : '';

  const result = await Swal.fire({
    icon: 'question',
    title: 'Resumo da detecção',
    html: `Detectamos <b>${totalProdutos}</b> produtos e <b>${totalColunasValidas}</b> colunas válidas.${familySection}<br/><br/>Deseja prosseguir?`,
    showCancelButton: true,
    confirmButtonText: 'Prosseguir',
    cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
}

async function runReport(options = {}) {
  const { silent = false } = options;
  const start = dom.dtStart.value;
  const end = dom.dtEnd.value;
  if (!start || !end) {
    if (!silent) showToast('warning', 'Informe período inicial e final.');
    return;
  }

  const { data, error } = await api.getHistorico({
    start,
    end,
    origem: dom.selO.value,
    familia: dom.selF.value,
    agrupamento: dom.selA.value,
    item: dom.selI.value
  });
  if (error) {
    Swal.fire({ icon: 'error', title: 'Erro na consulta', text: error.message });
    return;
  }
  if (!data?.length) {
    dom.reportContent.classList.add('hidden');
    if (!silent) showToast('info', 'Sem dados para os filtros selecionados.');
    return;
  }

  const rows = buildReportRows(data, state.masters).sort((a, b) => b.variacao - a.variacao);
  const kpis = calculateKpis(rows);

  dom.kpiItens.textContent = kpis.totalItens;
  dom.kpiAlertas.textContent = kpis.totalAlertas;
  dom.kpiMedia.textContent = `${kpis.mediaVariacao.toFixed(2).replace('.', ',')}%`;

  renderMainChart(rows);
  renderTable(rows);
  await renderTrendByFilters(data);
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

async function renderTrendByFilters(data) {
  const groupedByDate = (data || []).reduce((acc, row) => {
    const key = row.data_referencia;
    if (!acc[key]) acc[key] = { total: 0, count: 0 };
    acc[key].total += Number(row.custo_total || 0);
    acc[key].count += 1;
    return acc;
  }, {});

  const labels = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));
  const values = labels.map(label => {
    const entry = groupedByDate[label];
    return Number((entry.total / Math.max(entry.count, 1)).toFixed(2));
  });

  if (state.trendChart) state.trendChart.destroy();
  state.trendChart = new Chart(dom.trendChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Histórico de custo médio', data: values, backgroundColor: '#38bdf8' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function showToast(icon, text) {
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, showConfirmButton: false, icon, text });
}

init();
