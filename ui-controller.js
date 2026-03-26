import { fetchMasters, upsertHistoricoCustos, fetchHistoricoComDicionario } from './supabase-client.js';
import { buildPayloadFromWorkbook } from './spreadsheet-engine.js';
import { fillSelect, calculateCascadeOptions, buildReportRows, calculateKpis } from './report-engine.js';

const state = {
  masters: {
    origens: [],
    familias: [],
    agrupamentos: [],
    dicionario: []
  },
  chart: null
};

const dom = {
  views: {
    import: document.getElementById('view-import'),
    report: document.getElementById('view-report')
  },
  navItems: Array.from(document.querySelectorAll('[data-view-trigger]')),
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
  chartCanvas: document.getElementById('mainChart')
};

/**
 * Inicializa aplicação e eventos principais.
 */
async function initApp() {
  bindNavigation();
  bindUploadEvents();
  bindFilterEvents();
  await loadMasterData();
}

/**
 * Alternância de views no menu lateral.
 */
function bindNavigation() {
  dom.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.viewTrigger;
      dom.navItems.forEach(x => x.classList.remove('active'));
      item.classList.add('active');

      Object.values(dom.views).forEach(v => v.classList.add('hidden'));
      dom.views[view].classList.remove('hidden');
    });
  });
}

/**
 * Eventos de upload (click, drag/drop e teclado).
 */
function bindUploadEvents() {
  dom.dropZone.addEventListener('click', () => dom.fileInput.click());
  dom.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') dom.fileInput.click();
  });

  dom.fileInput.addEventListener('change', () => {
    const file = dom.fileInput.files?.[0];
    if (file) importSpreadsheet(file);
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dom.dropZone.addEventListener(evt, (event) => {
      event.preventDefault();
      dom.dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dom.dropZone.addEventListener(evt, (event) => {
      event.preventDefault();
      dom.dropZone.classList.remove('dragover');
    });
  });

  dom.dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files?.[0];
    if (file) importSpreadsheet(file);
  });
}

/**
 * Carrega catálogos e inicializa selects.
 */
async function loadMasterData() {
  state.masters = await fetchMasters();

  fillSelect(
    dom.selO,
    state.masters.origens.map(item => ({ value: String(item.id), label: item.descricao })),
    { value: 'TODAS', label: 'TODAS' }
  );

  refreshCascade();
}

/**
 * Eventos dos filtros + botão de análise.
 */
function bindFilterEvents() {
  dom.selO.addEventListener('change', () => refreshCascade('origem'));
  dom.selF.addEventListener('change', () => refreshCascade('familia'));
  dom.analyzeBtn.addEventListener('click', runReport);
}

/**
 * Recalcula opções da cascata garantindo vínculos corretos.
 * @param {'origem'|'familia'|undefined} trigger
 */
function refreshCascade(trigger) {
  if (trigger === 'origem') dom.selF.value = 'TODAS';

  const { familyOptions, groupOptions } = calculateCascadeOptions(
    { origem: dom.selO.value, familia: dom.selF.value },
    state.masters
  );

  fillSelect(dom.selF, familyOptions, { value: 'TODAS', label: 'TODAS' });
  if (trigger === 'origem') dom.selF.value = 'TODAS';

  const resolvedFamily = dom.selF.value || 'TODAS';
  const secondPass = calculateCascadeOptions(
    { origem: dom.selO.value, familia: resolvedFamily },
    state.masters
  );

  fillSelect(dom.selA, secondPass.groupOptions, { value: 'TODOS', label: 'TODOS' });
}

/**
 * Importa planilha e salva no histórico.
 * Exibe feedback com SweetAlert2.
 * @param {File} file
 */
async function importSpreadsheet(file) {
  const dateRef = dom.importDate.value;
  if (!dateRef) {
    showToast('warning', 'Selecione a Data de Referência antes do upload.');
    return;
  }

  dom.dropZone.classList.add('processing');
  Swal.fire({
    title: 'Processando planilha...',
    text: 'Aguarde enquanto os dados são validados e preparados.',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const buffer = await file.arrayBuffer();
  const payload = buildPayloadFromWorkbook(buffer, dateRef);

  if (!payload.length) {
    dom.dropZone.classList.remove('processing');
    Swal.fire({ icon: 'error', title: 'Nenhum item válido', text: 'Verifique os cabeçalhos de Produto, Descrição e Custo Total.' });
    return;
  }

  const dictCodes = new Set(state.masters.dicionario.map(item => String(item.codigo_produto).trim()));
  const missingCodes = [...new Set(payload.map(x => x.codigo_produto).filter(code => !dictCodes.has(String(code).trim())))];

  if (missingCodes.length) {
    dom.dropZone.classList.remove('processing');
    Swal.fire({
      icon: 'error',
      title: 'Produtos não cadastrados no dicionário',
      html: `<p>Cadastre os códigos abaixo antes de importar:</p><pre style="text-align:left;max-height:160px;overflow:auto;">${missingCodes.join('\n')}</pre>`
    });
    return;
  }

  const { error } = await upsertHistoricoCustos(payload);
  dom.dropZone.classList.remove('processing');

  if (error) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao salvar no Supabase',
      text: error.message || 'Revise permissões e vínculo de dicionário.'
    });
    return;
  }

  Swal.fire({
    icon: 'success',
    title: 'Importação concluída',
    html: `<b>${payload.length}</b> itens salvos para <b>${dateRef}</b>.`
  });
}

/**
 * Executa consulta analítica e renderiza KPIs, tabela e gráfico.
 */
async function runReport() {
  const start = dom.dtStart.value;
  const end = dom.dtEnd.value;

  if (!start || !end) {
    showToast('warning', 'Informe início e fim para gerar o relatório.');
    return;
  }

  const { data, error } = await fetchHistoricoComDicionario({
    start,
    end,
    origem: dom.selO.value,
    familia: dom.selF.value,
    agrupamento: dom.selA.value
  });

  if (error) {
    Swal.fire({ icon: 'error', title: 'Erro na consulta', text: error.message });
    return;
  }

  if (!data?.length) {
    showToast('info', 'Nenhum dado encontrado para os filtros selecionados.');
    return;
  }

  const rows = buildReportRows(data).sort((a, b) => b.variacao - a.variacao);
  const kpis = calculateKpis(rows);

  renderKpis(kpis);
  renderTable(rows);
  renderChart(rows);

  dom.reportContent.classList.remove('hidden');
}

/**
 * Atualiza cartões de KPI.
 * @param {{totalItens:number,totalAlertas:number,mediaVariacao:number}} kpis
 */
function renderKpis(kpis) {
  dom.kpiItens.textContent = kpis.totalItens;
  dom.kpiAlertas.textContent = kpis.totalAlertas;
  dom.kpiMedia.textContent = `${kpis.mediaVariacao.toFixed(2).replace('.', ',')}%`;
}

/**
 * Renderiza tabela com destaque para variação > 5%.
 * @param {Array} rows
 */
function renderTable(rows) {
  dom.tableBody.innerHTML = rows.map(row => `
    <tr class="${row.alert ? 'row-alert' : ''}">
      <td>${row.codigo}</td>
      <td>${row.descricao}</td>
      <td>${row.origem}</td>
      <td>${row.familia}</td>
      <td>${row.agrupamento}</td>
      <td>R$ ${row.inicial.toFixed(2)}</td>
      <td>R$ ${row.final.toFixed(2)}</td>
      <td>${row.variacao.toFixed(2)}%</td>
      <td>
        <span class="badge ${row.alert ? 'alert' : 'ok'}">
          <i class="${row.alert ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'}"></i>
          ${row.alert ? 'ALTA' : 'OK'}
        </span>
      </td>
    </tr>
  `).join('');
}

/**
 * Renderiza gráfico de barras: alta em vermelho, queda/estável em cinza/verde.
 * @param {Array} rows
 */
function renderChart(rows) {
  if (state.chart) state.chart.destroy();

  state.chart = new Chart(dom.chartCanvas, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.codigo),
      datasets: [{
        label: 'Variação %',
        data: rows.map(r => Number(r.variacao.toFixed(2))),
        backgroundColor: rows.map(r => (r.variacao > 0 ? '#ef4444' : r.variacao < 0 ? '#10b981' : '#9ca3af')),
        borderRadius: 8,
        maxBarThickness: 26
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } },
        y: { ticks: { color: '#cbd5e1', callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.08)' } }
      },
      plugins: {
        legend: { labels: { color: '#e2e8f0' } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw}%` } }
      }
    }
  });
}

/**
 * Helper de toast curto com SweetAlert2.
 * @param {'success'|'error'|'warning'|'info'} icon
 * @param {string} text
 */
function showToast(icon, text) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    timer: 3000,
    showConfirmButton: false,
    icon,
    text
  });
}

initApp();
