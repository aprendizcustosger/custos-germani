/* Responsabilidade: controle de interface, auto-auth, eventos e gráficos. */
import { api } from '../src/services/api.js';
import { readWorkbook, scanHeaders, countValidMappedColumns, REQUIRED_FIELDS, parseBrazilianNumber, formatBrazilianFinancial } from '../core/spreadsheet-engine.js';
import { fillSelect, calculateCascadeOptions, buildReportRows, calculateKpis } from '../core/report-engine.js';

const state = {
  user: null,
  masters: { origens: [], familias: [], agrupamentos: [], produtos: [], dicionario: [], hierarquia: [] },
  chart: null,
  trendChart: null,
  importMapping: null,
  unsubscribeFiltersRealtime: null,
  reportRows: [],
  reportView: {
    sortKey: 'variacao',
    sortDirection: 'desc',
    quickFilter: 'all'
  }
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
  kpiCards: Array.from(document.querySelectorAll('[data-kpi-filter]')),
  mainChartPanel: document.getElementById('mainChartPanel'),
  mainChart: document.getElementById('mainChart'),
  topVariationsPanel: document.getElementById('topVariationsPanel'),
  topIncreasesList: document.getElementById('topIncreasesList'),
  topReductionsList: document.getElementById('topReductionsList'),
  trendChartPanel: document.getElementById('trendChartPanel'),
  trendChart: document.getElementById('trendChart'),
  trendTitle: document.getElementById('trendTitle'),
  trendBadge: document.getElementById('trendBadge'),
  trendFallback: document.getElementById('trendFallback')
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
  bindInteractiveTableControls();

  if (state.unsubscribeFiltersRealtime) state.unsubscribeFiltersRealtime();
  state.unsubscribeFiltersRealtime = api.subscribeFiltrosRealtime(async () => {
    await fetchMetadata();
  });
}

function bindInteractiveTableControls() {
  dom.kpiCards.forEach(card => {
    card.addEventListener('click', () => {
      state.reportView.quickFilter = card.dataset.kpiFilter || 'all';
      applyTableView();
    });
  });
  document.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => {
      const nextKey = th.dataset.sortKey;
      if (state.reportView.sortKey === nextKey) {
        state.reportView.sortDirection = state.reportView.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.reportView.sortKey = nextKey;
        state.reportView.sortDirection = 'desc';
      }
      applyTableView();
    });
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

  const preview = buildImportPreview(rows, state.importMapping, state.masters.produtos || []);
  const confirmed = await confirmImportPreview(preview, countValidMappedColumns(mapping));
  if (!confirmed) {
    dom.dropZone.classList.remove('processing');
    return;
  }
  const payload = preview.validRows.map(row => ({
    codigo_produto: row.codigo_produto,
    descricao: row.descricao,
    custo_variavel: row.custo_variavel,
    custo_direto_fixo: row.custo_direto_fixo,
    custo_total: row.custo_total,
    data_referencia: refDate
  }));

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

function buildImportPreview(rows, mapping, produtos = []) {
  const produtoSet = new Set((produtos || []).map(item => String(item.codigo_produto || '').trim()).filter(Boolean));
  const statuses = { valid: 0, warning: 0, error: 0 };
  const analyzedRows = rows.map((row, index) => {
    const codigo = String(row[mapping.codigo_produto] || '').trim();
    const descricao = String(row[mapping.descricao] || '').trim();
    const custoVariavel = parseBrazilianNumber(row[mapping.custo_variavel]);
    const custoDiretoFixo = parseBrazilianNumber(row[mapping.custo_direto_fixo]);
    const custoTotal = parseBrazilianNumber(row[mapping.custo_total]);
    const issues = [];

    if (!codigo) issues.push({ level: 'error', text: 'Produto ausente' });
    if (codigo && !produtoSet.has(codigo)) issues.push({ level: 'warning', text: 'Produto não encontrado no cadastro' });
    if (!descricao) issues.push({ level: 'error', text: 'Descrição vazia' });
    if (custoVariavel < 0 || custoDiretoFixo < 0 || custoTotal < 0) issues.push({ level: 'warning', text: 'Valor negativo' });
    if (custoTotal === 0) issues.push({ level: 'warning', text: 'Custo total zerado' });
    if ((String(row[mapping.custo_total] || '').trim()) && custoTotal === 0) issues.push({ level: 'warning', text: 'Número convertido para 0' });

    const hasError = issues.some(issue => issue.level === 'error');
    const hasWarning = issues.some(issue => issue.level === 'warning');
    const status = hasError ? 'error' : (hasWarning ? 'warning' : 'valid');
    statuses[status] += 1;

    return {
      index: index + 1,
      codigo_produto: codigo,
      descricao,
      custo_variavel: custoVariavel,
      custo_direto_fixo: custoDiretoFixo,
      custo_total: custoTotal,
      status,
      issues
    };
  });

  return {
    rows: analyzedRows,
    validRows: analyzedRows.filter(row => row.status !== 'error'),
    statuses
  };
}

async function confirmImportPreview(preview, totalColunasValidas) {
  const previewRows = preview.rows.slice(0, 20).map(row => {
    const statusIcon = row.status === 'valid' ? '🟢 válida' : row.status === 'warning' ? '🟡 atenção' : '🔴 erro';
    return `
      <tr>
        <td>${row.index}</td>
        <td>${escapeHtml(row.codigo_produto)}</td>
        <td>${escapeHtml(row.descricao)}</td>
        <td>${formatBrazilianFinancial(row.custo_variavel)}</td>
        <td>${formatBrazilianFinancial(row.custo_direto_fixo)}</td>
        <td>${formatBrazilianFinancial(row.custo_total)}</td>
        <td>${statusIcon}<br><small>${escapeHtml(row.issues.map(item => item.text).join('; ') || 'OK')}</small></td>
      </tr>
    `;
  }).join('');

  const result = await Swal.fire({
    icon: 'question',
    title: 'Preview da importação',
    width: 1100,
    html: `
      <p>Colunas válidas: <b>${totalColunasValidas}/5</b> | Linhas: <b>${preview.rows.length}</b> | 🟢 ${preview.statuses.valid} | 🟡 ${preview.statuses.warning} | 🔴 ${preview.statuses.error}</p>
      <div style="max-height:360px; overflow:auto; text-align:left;">
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead><tr><th>#</th><th>Produto</th><th>Descrição</th><th>C. Variável</th><th>C. Direto Fixo</th><th>C. Total</th><th>Status</th></tr></thead>
          <tbody>${previewRows}</tbody>
        </table>
      </div>
      <p style="margin-top:10px;">Somente linhas sem erro serão gravadas.</p>
    `,
    showCancelButton: true,
    confirmButtonText: `Confirmar importação (${preview.validRows.length} linhas)`,
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
  const { silent = false, selectedProduct = null } = options;
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

  const rows = buildReportRows(data, state.masters);
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
  state.reportRows = rows;
  applyTableView({ hasSingleItemAnalysis });
  const hasTrendData = await renderTemporalAnalysis(data, {
    origem: dom.selO.value,
    familia: dom.selF.value,
    agrupamento: dom.selA.value,
    item: selectedProduct || dom.selI.value
  });
  applyReportLayout({ hasSingleItemAnalysis, hasImportComparison, hasTrendData });
  dom.reportContent.classList.remove('hidden');
}

function applyTableView(options = {}) {
  const { hasSingleItemAnalysis = false } = options;
  const filteredRows = state.reportRows.filter(row => {
    if (state.reportView.quickFilter === 'alerts') return row.variacao > 5;
    if (state.reportView.quickFilter === 'positive') return row.variacao > 0;
    return true;
  });
  const sortedRows = [...filteredRows].sort((a, b) => compareRowsBySort(a, b, state.reportView.sortKey, state.reportView.sortDirection));
  renderTable(sortedRows, { hasSingleItemAnalysis });
  updateKpiCardState();
  updateSortHeaderState();
}

function compareRowsBySort(a, b, key, direction) {
  const order = direction === 'asc' ? 1 : -1;
  const valueA = a?.[key];
  const valueB = b?.[key];
  if (key === 'alert') return ((valueA ? 1 : 0) - (valueB ? 1 : 0)) * order;
  if (typeof valueA === 'number' || typeof valueB === 'number') return ((Number(valueA) || 0) - (Number(valueB) || 0)) * order;
  return String(valueA || '').localeCompare(String(valueB || ''), 'pt-BR') * order;
}

function updateKpiCardState() {
  dom.kpiCards.forEach(card => {
    card.classList.toggle('active', card.dataset.kpiFilter === state.reportView.quickFilter);
  });
}

function updateSortHeaderState() {
  document.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.classList.toggle('sort-active', th.dataset.sortKey === state.reportView.sortKey);
  });
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
      <td>${row.scoreInstabilidade.toFixed(2)}%</td>
      <td><span class="badge instability ${getInstabilityClass(row.classificacaoInstabilidade)}">${row.classificacaoInstabilidade}</span></td>
      <td><span class="badge ${row.alert ? 'alert' : 'ok'}" title="${row.motivoAlerta || 'Sem variação relevante entre importações'}">${row.alert ? 'ALERTA' : 'OK'}</span></td>
    </tr>
  `).join('');

  const tableRows = dom.tableBody.querySelectorAll('tr');
  tableRows.forEach(tr => {
    tr.addEventListener('click', async () => {
      const selected = tr.dataset.codigo;
      await runReport({ silent: true, selectedProduct: selected });
    });
  });

}

function getInstabilityClass(classificacao) {
  if (classificacao === 'ESTÁVEL') return 'stable';
  if (classificacao === 'OSCILANDO') return 'oscillating';
  return 'unstable';
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


const chartA11yTheme = {
  textColor: '#FFFFFF',
  gridColor: 'rgba(255,255,255,0.22)',
  gridBorderColor: 'rgba(255,255,255,0.4)',
  tooltipBg: 'rgba(15,23,42,0.95)'
};

function getReadableChartOptions() {
  return {
    color: chartA11yTheme.textColor,
    plugins: {
      legend: { labels: { color: chartA11yTheme.textColor, usePointStyle: true } },
      tooltip: {
        titleColor: chartA11yTheme.textColor,
        bodyColor: chartA11yTheme.textColor,
        backgroundColor: chartA11yTheme.tooltipBg,
        borderColor: chartA11yTheme.gridBorderColor,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: chartA11yTheme.textColor },
        grid: { color: chartA11yTheme.gridColor, borderColor: chartA11yTheme.gridBorderColor }
      },
      y: {
        ticks: { color: chartA11yTheme.textColor },
        grid: { color: chartA11yTheme.gridColor, borderColor: chartA11yTheme.gridBorderColor }
      }
    }
  };
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
  const baseA11yOptions = getReadableChartOptions();

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(dom.mainChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Custo médio por importação', data: values, backgroundColor: ['#0ea5e9', '#6366f1'] }]
    },
    options: {
      ...baseA11yOptions,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        ...baseA11yOptions.scales,
        y: {
          ...baseA11yOptions.scales.y,
          ticks: {
            ...baseA11yOptions.scales.y.ticks,
            callback: value => `R$ ${formatCurrencyBRL(value)}`
          }
        }
      },
      plugins: {
        ...baseA11yOptions.plugins,
        tooltip: {
          ...baseA11yOptions.plugins.tooltip,
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


function buildTemporalSeries(rows = [], filters = {}) {
  const grouped = new Map();
  (rows || []).forEach(row => {
    const key = row.data_referencia;
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, { sum: 0, count: 0 });
    const entry = grouped.get(key);
    entry.sum += Number(row.custo_total || 0);
    entry.count += 1;
  });

  const mode = filters.item && filters.item !== 'TODOS' ? 'produto' : 'agregado';
  const labels = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const values = labels.map(label => {
    const entry = grouped.get(label);
    return mode === 'produto' ? Number(entry.sum.toFixed(4)) : Number((entry.sum / Math.max(entry.count, 1)).toFixed(4));
  });

  return { labels, values, mode };
}

function getTrendStatus(values = []) {
  if (values.length < 2) return { text: '🟢 Estável', className: 'stable' };
  const first = Number(values[0] || 0);
  const last = Number(values[values.length - 1] || 0);
  const variation = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
  if (variation > 1) return { text: '🔺 Tendência de Alta', className: 'up' };
  if (variation < -1) return { text: '🔻 Tendência de Queda', className: 'down' };
  return { text: '🟢 Estável', className: 'stable' };
}

async function renderTemporalAnalysis(data, filters) {
  const { labels, values, mode } = buildTemporalSeries(data, filters);
  if (labels.length < 2) {
    if (state.trendChart) state.trendChart.destroy();
    dom.trendFallback.textContent = 'Histórico insuficiente para análise temporal';
    dom.trendFallback.classList.remove('hidden');
    dom.trendChart.classList.add('hidden');
    dom.trendBadge.textContent = '🟢 Estável';
    dom.trendBadge.className = 'badge trend stable';
    return false;
  }

  const avg = values.reduce((acc, cur) => acc + Number(cur || 0), 0) / values.length;
  const trend = getTrendStatus(values);
  dom.trendTitle.textContent = 'Evolução Temporal de Custos';
  dom.trendBadge.textContent = trend.text;
  dom.trendBadge.className = `badge trend ${trend.className}`;
  dom.trendFallback.classList.add('hidden');
  dom.trendChart.classList.remove('hidden');
  const baseA11yOptions = getReadableChartOptions();

  if (state.trendChart) state.trendChart.destroy();
  state.trendChart = new Chart(dom.trendChart, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: mode === 'produto' ? 'Custo do produto' : 'Custo médio agregado', data: values, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.14)', fill: true, tension: 0.25 },
        { label: 'Média histórica', data: labels.map(() => avg), borderColor: '#f59e0b', borderDash: [6, 6], pointRadius: 0, fill: false }
      ]
    },
    options: {
      ...baseA11yOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...baseA11yOptions.plugins,
        tooltip: {
          ...baseA11yOptions.plugins.tooltip,
          callbacks: {
            title: items => new Date(items?.[0]?.label || '').toLocaleDateString('pt-BR'),
            label: ctx => `R$ ${formatCurrencyBRL(ctx.parsed.y)}`,
            afterLabel: ctx => {
              if (ctx.dataIndex === 0 || ctx.datasetIndex > 0) return '';
              const prev = Number(values[ctx.dataIndex - 1] || 0);
              const curr = Number(values[ctx.dataIndex] || 0);
              const delta = prev === 0 ? 0 : ((curr - prev) / Math.abs(prev)) * 100;
              return `Variação vs anterior: ${delta.toFixed(2)}%`;
            }
          }
        }
      },
      scales: {
        ...baseA11yOptions.scales,
        y: {
          ...baseA11yOptions.scales.y,
          ticks: {
            ...baseA11yOptions.scales.y.ticks,
            callback: value => `R$ ${formatCurrencyBRL(value)}`
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
