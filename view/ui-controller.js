/* Responsabilidade: controle de interface, auto-auth, eventos e gráficos. */
import { api } from '../src/services/api.js';
import { readWorkbook, scanHeaders, mapRowsToPayload, countValidMappedColumns, REQUIRED_FIELDS } from '../core/spreadsheet-engine.js';
import { fillSelect, calculateCascadeOptions, buildReportRows, calculateKpis } from '../core/report-engine.js';

const state = {
  user: null,
  masters: { origens: [], familias: [], agrupamentos: [], produtos: [], dicionario: [], hierarquia: [] },
  chart: null,
  trendChart: null,
  importMapping: null,
  unsubscribeFiltersRealtime: null
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
  tablePanel: document.getElementById('tablePanel'),
  tableBody: document.getElementById('tableBody'),
  kpiItens: document.getElementById('kpiItens'),
  kpiAlertas: document.getElementById('kpiAlertas'),
  kpiMedia: document.getElementById('kpiMedia'),
  mainChartPanel: document.getElementById('mainChartPanel'),
  mainChart: document.getElementById('mainChart'),
  topVariationsPanel: document.getElementById('topVariationsPanel'),
  topIncreasesList: document.getElementById('topIncreasesList'),
  topReductionsList: document.getElementById('topReductionsList'),
  trendChartPanel: document.getElementById('trendChartPanel'),
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
    produtos: masters.produtos || [],
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
  fillSelect(
    dom.selI,
    state.masters.produtos.map(item => ({ value: String(item.codigo_produto), label: `${String(item.codigo_produto)} - ${item.descricao || '-'}` })),
    { value: 'TODOS', label: 'TODOS' },
    dom.selI.value || 'TODOS'
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

  if (state.unsubscribeFiltersRealtime) state.unsubscribeFiltersRealtime();
  state.unsubscribeFiltersRealtime = api.subscribeFiltrosRealtime(async () => {
    await fetchMetadata();
  });
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
  const { headers, mapping: detectedMapping } = scanHeaders(rows);
  const mapping = await confirmColumnMapping(headers, detectedMapping);
  if (!mapping) {
    dom.dropZone.classList.remove('processing');
    return;
  }
  state.importMapping = { ...mapping };

  if (countValidMappedColumns(mapping) < REQUIRED_FIELDS.length) {
    dom.dropZone.classList.remove('processing');
    showToast('error', 'Todos os 5 campos obrigatórios devem ser mapeados antes do envio.');
    return;
  }

  const payload = mapRowsToPayload(rows, state.importMapping, refDate);
  const confirmed = await confirmImport(payload.length, countValidMappedColumns(mapping));
  if (!confirmed) {
    dom.dropZone.classList.remove('processing');
    return;
  }

  const { data: resultadoImportacao, error } = await api.importarHistoricoCustosComLog(payload, {
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

  await fetchMetadata();
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

function getFieldLabel(field) {
  const labels = {
    codigo_produto: 'Produto',
    descricao: 'Descrição',
    custo_variavel: 'Custo Variável',
    custo_direto_fixo: 'Custo Direto Fixo',
    custo_total: 'Custo Total'
  };
  return labels[field] || field;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildMappingSelect(field, headers = []) {
  const options = headers
    .map(header => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`)
    .join('');

  return `
    <div style="text-align:left; margin-bottom: 10px;">
      <label for="map_${field}" style="display:block; font-weight:600; margin-bottom:4px;">
        ${getFieldLabel(field)}
      </label>
      <select id="map_${field}" class="swal2-select" style="width:100%; margin:0;">
        <option value="">Selecione uma coluna</option>
        ${options}
      </select>
    </div>
  `;
}

async function confirmColumnMapping(headers, detectedMapping) {
  if (!headers.length) {
    showToast('error', 'Nenhum cabeçalho foi encontrado na planilha.');
    return null;
  }

  const html = REQUIRED_FIELDS.map(field => buildMappingSelect(field, headers)).join('');
  const result = await Swal.fire({
    icon: 'info',
    title: 'Confirmar mapeamento de colunas',
    html,
    confirmButtonText: 'Confirmar mapeamento',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: () => {
      REQUIRED_FIELDS.forEach(field => {
        const select = document.getElementById(`map_${field}`);
        if (select && detectedMapping[field]) {
          select.value = detectedMapping[field];
        }
      });
    },
    preConfirm: () => {
      const mapping = REQUIRED_FIELDS.reduce((acc, field) => {
        const select = document.getElementById(`map_${field}`);
        acc[field] = select?.value || null;
        return acc;
      }, {});

      const missingFields = REQUIRED_FIELDS.filter(field => !mapping[field]);
      if (missingFields.length) {
        Swal.showValidationMessage(`Preencha todos os campos: ${missingFields.map(getFieldLabel).join(', ')}.`);
        return false;
      }
      return mapping;
    }
  });

  return result.isConfirmed ? result.value : null;
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
  const hasSingleItemAnalysis = rows.length === 1;
  const kpis = calculateKpis(rows);

  dom.kpiItens.textContent = kpis.totalItens;
  dom.kpiAlertas.textContent = kpis.totalAlertas;
  dom.kpiMedia.textContent = `${kpis.mediaVariacao.toFixed(2).replace('.', ',')}%`;

  const hasImportComparison = await renderImportComparisonChart({
    start,
    end,
    origem: dom.selO.value,
    familia: dom.selF.value,
    agrupamento: dom.selA.value,
    item: dom.selI.value
  });
  await renderTopVariationsPanel({
    start,
    end,
    origem: dom.selO.value,
    familia: dom.selF.value,
    agrupamento: dom.selA.value,
    item: dom.selI.value
  });
  renderTable(rows, { hasSingleItemAnalysis });
  const hasTrendData = await renderTrendByFilters(data);
  applyReportLayout({ hasSingleItemAnalysis, hasImportComparison, hasTrendData });
  dom.reportContent.classList.remove('hidden');
}

async function renderTopVariationsPanel(filters) {
  const { data, error } = await api.getTopVariacoesImportacao(filters);
  if (error) {
    showToast('error', 'Falha ao calcular TOP VARIAÇÕES.');
    dom.topVariationsPanel.classList.add('hidden');
    return;
  }

  const aumentos = data?.aumentos || [];
  const reducoes = data?.reducoes || [];
  if (!aumentos.length && !reducoes.length) {
    dom.topVariationsPanel.classList.add('hidden');
    return;
  }

  dom.topIncreasesList.innerHTML = renderTopVariationItems(aumentos, 'increase');
  dom.topReductionsList.innerHTML = renderTopVariationItems(reducoes, 'reduction');
  dom.topVariationsPanel.classList.remove('hidden');
}

function renderTopVariationItems(items, type) {
  if (!items.length) {
    return '<li><span class="product">Sem dados comparáveis entre as 2 últimas importações.</span><span class="variation">-</span></li>';
  }
  return items.map(item => `
    <li class="${type}">
      <span class="product" title="${item.codigo_produto} - ${item.descricao}">${item.codigo_produto} - ${item.descricao}</span>
      <span class="variation">${item.variacao_percentual >= 0 ? '+' : ''}${item.variacao_percentual.toFixed(2)}%</span>
    </li>
  `).join('');
}

function applyReportLayout({ hasSingleItemAnalysis, hasImportComparison, hasTrendData }) {
  dom.reportContent.classList.toggle('single-item-mode', hasSingleItemAnalysis);
  dom.mainChartPanel.classList.toggle('hidden', hasSingleItemAnalysis || !hasImportComparison);
  dom.trendChartPanel.classList.toggle('hidden', !hasTrendData);
}

function renderTable(rows, options = {}) {
  const { hasSingleItemAnalysis = false } = options;
  dom.tableBody.innerHTML = rows.map(row => `
    <tr class="${row.alert ? 'row-alert' : ''}" data-codigo="${row.codigo}">
      <td>${row.codigo}</td>
      <td>${row.descricao}</td>
      <td>${formatCurrencyCell(row.ultimoCusto)}</td>
      <td>${formatCurrencyCell(row.penultimoCusto)}</td>
      <td>${formatDiffCell(row.diferenca, row.variacaoTemporal)}</td>
      <td>${formatDateTimeBR(row.ultimaAtualizacao)}</td>
      <td>R$ ${formatCurrencyBRL(row.inicial)}</td>
      <td>R$ ${formatCurrencyBRL(row.final)}</td>
      <td>${row.variacao.toFixed(2)}%</td>
      <td><span class="badge ${row.alert ? 'alert' : 'ok'}" title="${row.motivoAlerta || 'Sem variação relevante entre importações'}">${row.alert ? 'ALERTA' : 'OK'}</span></td>
    </tr>
  `).join('');

  const tableRows = dom.tableBody.querySelectorAll('tr');
  tableRows.forEach(tr => {
    tr.addEventListener('click', async () => {
      await renderTrendChart(tr.dataset.codigo);
      dom.trendChartPanel.classList.remove('hidden');
    });
  });

  if (hasSingleItemAnalysis && rows[0]?.codigo) {
    renderTrendChart(rows[0].codigo);
  }
}

function formatCurrencyCell(value) {
  if (value === null || value === undefined) return '-';
  return `R$ ${formatCurrencyBRL(value)}`;
}

function formatDiffCell(diferenca, variacao) {
  if (diferenca === null || diferenca === undefined) return '-';
  const variacaoText = Number.isFinite(variacao) ? ` (${variacao.toFixed(2)}%)` : '';
  return `${diferenca >= 0 ? '+' : '-'}R$ ${formatCurrencyBRL(Math.abs(diferenca))}${variacaoText}`;
}

function formatDateTimeBR(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
}

async function renderImportComparisonChart(filters) {
  const { data, error } = await api.getLatestImportComparison(filters);
  if (error) {
    showToast('error', 'Falha ao buscar comparação entre importações.');
    return;
  }

  const imports = data?.imports || [];
  if (imports.length < 2) {
    if (state.chart) state.chart.destroy();
    return false;
  }

  const labels = imports.map(item => new Date(item.criado_em).toLocaleString('pt-BR'));
  const values = imports.map(item => Number(item.media || 0));
  const counts = imports.map(item => Number(item.quantidade || 0));
  const variacao = Number(data?.resumo?.variacao_percentual_media || 0);

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(dom.mainChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Custo médio por importação', data: values, backgroundColor: ['#0ea5e9', '#6366f1'] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: value => `R$ ${formatCurrencyBRL(value)}`
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: items => {
              const idx = items?.[0]?.dataIndex ?? 0;
              return idx === 0 ? 'Última importação' : 'Importação anterior';
            },
            label: context => {
              const idx = context.dataIndex;
              return `R$ ${formatCurrencyBRL(context.parsed.y)} · ${counts[idx]} item(ns)`;
            },
            afterBody: items => {
              const idx = items?.[0]?.dataIndex ?? 0;
              if (idx !== 0) return '';
              return `Variação média vs anterior: ${variacao.toFixed(2)}%`;
            }
          }
        }
      }
    }
  });
  return true;
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: value => formatCurrencyBRL(value)
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `R$ ${formatCurrencyBRL(context.parsed.y)}`
          }
        }
      }
    }
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
  if (labels.length < 2) {
    if (state.trendChart) state.trendChart.destroy();
    return false;
  }
  const values = labels.map(label => {
    const entry = groupedByDate[label];
    return Number((entry.total / Math.max(entry.count, 1)).toFixed(4));
  });

  if (state.trendChart) state.trendChart.destroy();
  state.trendChart = new Chart(dom.trendChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Histórico de custo médio', data: values, backgroundColor: '#38bdf8' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: value => formatCurrencyBRL(value)
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `R$ ${formatCurrencyBRL(context.parsed.y)}`
          }
        }
      }
    }
  });
  return true;
}

function formatCurrencyBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

function showToast(icon, text) {
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, showConfirmButton: false, icon, text });
}

init();
