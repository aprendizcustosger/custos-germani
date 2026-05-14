export function getDomRefs() {
  return {
    userBox: document.getElementById('userBox'),
    navItems: Array.from(document.querySelectorAll('[data-view-trigger]')),
    views: { import: document.getElementById('view-import'), report: document.getElementById('view-report') },
    dropZone: document.getElementById('dropZone'), fileInput: document.getElementById('fileInput'), importDate: document.getElementById('importDate'),
    orphansBanner: document.getElementById('orphansBanner'), orphansCount: document.getElementById('orphansCount'),
    searchProduct: document.getElementById('searchProduct'), productSuggestions: document.getElementById('productSuggestions'),
    dtStart: document.getElementById('dtStart'), dtEnd: document.getElementById('dtEnd'), selO: document.getElementById('selO'), selF: document.getElementById('selF'), selA: document.getElementById('selA'), selI: document.getElementById('selI'),
    analyzeBtn: document.getElementById('analyzeBtn'), exportBtn: document.getElementById('exportBtn'), activeFilterChips: document.getElementById('activeFilterChips'),
    reportContent: document.getElementById('reportContent'), tablePanel: document.getElementById('tablePanel'), tableBody: document.getElementById('tableBody'),
    kpiItens: document.getElementById('kpiItens'), kpiAlertas: document.getElementById('kpiAlertas'), kpiRegime: document.getElementById('kpiRegime'), kpiMedia: document.getElementById('kpiMedia'),
    kpiCards: Array.from(document.querySelectorAll('[data-kpi-filter]')),
    drillPanel: document.getElementById('drillPanel'), drillTitle: document.getElementById('drillTitle'), drillSubtitle: document.getElementById('drillSubtitle'), drillBody: document.getElementById('drillBody'), drillClose: document.getElementById('drillClose'),
    mainChartPanel: document.getElementById('mainChartPanel'), mainChart: document.getElementById('mainChart'),
    topVariationsPanel: document.getElementById('topVariationsPanel'), topIncreasesList: document.getElementById('topIncreasesList'), topReductionsList: document.getElementById('topReductionsList'),
    trendChartPanel: document.getElementById('trendChartPanel'), trendChart: document.getElementById('trendChart'), trendTitle: document.getElementById('trendTitle'), trendBadge: document.getElementById('trendBadge'), trendFallback: document.getElementById('trendFallback')
  };
}
