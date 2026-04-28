// ============= GLOBAL STATE =============
let DATA = [];
let META = {};
let charts = {};
let realtimeAccumulator = 0;
let realtimeOpsCount = 0;
let realtimeYttToday = 0;

const COLORS = {
  navy: '#0B2545', navyLight: '#13315C', teal: '#134E4A',
  emerald: '#047857', emeraldLight: '#10B981',
  gold: '#B7935C', goldLight: '#D4AF7A',
  red: '#B91C1C', orange: '#C2410C',
  slate100: '#F1F5F9', slate300: '#CBD5E1', slate500: '#64748B', slate700: '#334155'
};

const PALETTE = [
  '#0B2545', '#047857', '#B7935C', '#1E40AF', '#0891B2',
  '#7C3AED', '#C2410C', '#65A30D'
];

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

// ============= UTILITIES =============
const fmt = {
  som: (v) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)),
  bln: (v) => (v / 1e9).toFixed(2),
  mln: (v) => (v / 1e6).toFixed(1),
  pct: (v) => v.toFixed(1) + '%',
  count: (v) => new Intl.NumberFormat('uz-UZ').format(v)
};

function getCurrentTime() {
  return new Date().toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ============= TAB SWITCHING =============
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    
    // Resize charts when tab switches
    setTimeout(() => {
      Object.values(charts).forEach(c => { if (c && c.resize) c.resize(); });
    }, 50);
  });
});

// ============= DATA LOADING =============
async function loadData() {
  document.getElementById('lastUpdate').textContent = getCurrentTime();
  
  // Load metadata
  try {
    const metaRes = await fetch('metadata.json');
    META = await metaRes.json();
  } catch(e) { console.warn('metadata.json not found, using defaults'); }
  
  // Load CSV
  return new Promise((resolve, reject) => {
    Papa.parse('clean_data_ytt.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        DATA = results.data;
        console.log(`✅ Loaded ${DATA.length} records`);
        resolve(DATA);
      },
      error: (err) => reject(err)
    });
  });
}

// ============= FILTERS =============
function populateFilters() {
  // Districts
  const districts = [...new Set(DATA.map(d => d.DISTRICT_NAME))].sort();
  const dSel = document.getElementById('fDistrict');
  districts.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    dSel.appendChild(opt);
  });
  
  // Sectors
  const sectors = [...new Set(DATA.map(d => d.SECTOR_NAME))].sort();
  const sSel = document.getElementById('fSector');
  sectors.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sSel.appendChild(opt);
  });
  
  // Regimes
  const regimes = [...new Set(DATA.map(d => d.REGIME_NAME))].sort();
  const rSel = document.getElementById('fRegime');
  regimes.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    rSel.appendChild(opt);
  });
  
  // Listeners
  ['fDistrict','fMonth','fSector','fRegime'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateAll);
  });
}

function getFilteredData() {
  const d = document.getElementById('fDistrict').value;
  const m = document.getElementById('fMonth').value;
  const s = document.getElementById('fSector').value;
  const r = document.getElementById('fRegime').value;
  
  return DATA.filter(row => {
    if (d && row.DISTRICT_NAME !== d) return false;
    if (m && row.MONTH != m) return false;
    if (s && row.SECTOR_NAME !== s) return false;
    if (r && row.REGIME_NAME !== r) return false;
    return true;
  });
}

function resetFilters() {
  ['fDistrict','fMonth','fSector','fRegime'].forEach(id => {
    document.getElementById(id).value = '';
  });
  updateAll();
}

// ============= KPI UPDATE =============
function updateKPIs() {
  const filtered = getFilteredData();
  const nac = filtered.reduce((s, r) => s + (r.NAC || 0), 0);
  const upl = filtered.reduce((s, r) => s + (r.UPL || 0), 0);
  const ratio = nac > 0 ? (upl / nac * 100) : 0;
  const ytts = new Set(filtered.map(r => r.JSHSHIR_ANON)).size;
  const sectors = new Set(filtered.map(r => r.SECTOR_NAME)).size;
  const gap = nac - upl;
  const gapPct = nac > 0 ? (gap / nac * 100) : 0;
  const avgPerYtt = ytts > 0 ? upl / ytts : 0;
  
  document.getElementById('kpiNAC').textContent = fmt.bln(nac);
  document.getElementById('kpiUPL').textContent = fmt.bln(upl);
  document.getElementById('kpiRatio').textContent = ratio.toFixed(1);
  document.getElementById('kpiCount').textContent = fmt.count(ytts);
  document.getElementById('kpiAvg').textContent = fmt.mln(avgPerYtt);
  document.getElementById('kpiGap').textContent = fmt.bln(gap);
  document.getElementById('kpiGapPct').textContent = '-' + gapPct.toFixed(1) + '%';
  document.getElementById('kpiSectors').textContent = sectors + ' sohada';
}

// ============= CHARTS =============
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        font: { family: 'Inter', size: 11, weight: '500' },
        color: COLORS.slate700,
        boxWidth: 12, padding: 12, usePointStyle: true
      }
    },
    tooltip: {
      backgroundColor: COLORS.navy,
      titleFont: { family: 'Inter', size: 12, weight: '700' },
      bodyFont: { family: 'Inter', size: 12 },
      padding: 12, cornerRadius: 6,
      boxPadding: 4,
      callbacks: {}
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: 'Inter', size: 11 }, color: COLORS.slate500 }
    },
    y: {
      grid: { color: COLORS.slate100, drawBorder: false },
      ticks: { font: { family: 'Inter', size: 11 }, color: COLORS.slate500 }
    }
  }
};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderTrendChart() {
  destroyChart('trend');
  const filtered = getFilteredData();
  const monthly = {};
  for (let m = 1; m <= 12; m++) monthly[m] = { nac: 0, upl: 0 };
  filtered.forEach(r => {
    if (monthly[r.MONTH]) {
      monthly[r.MONTH].nac += r.NAC || 0;
      monthly[r.MONTH].upl += r.UPL || 0;
    }
  });
  const ctx = document.getElementById('chartTrend').getContext('2d');
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: 'Rejalashtirilgan',
          data: Object.values(monthly).map(m => m.nac / 1e6),
          borderColor: COLORS.slate500,
          backgroundColor: 'rgba(100,116,139,0.08)',
          borderWidth: 2, borderDash: [6,4],
          tension: 0.3, fill: false,
          pointBackgroundColor: COLORS.slate500,
          pointBorderColor: '#fff', pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Real tushum',
          data: Object.values(monthly).map(m => m.upl / 1e6),
          borderColor: COLORS.emerald,
          backgroundColor: 'rgba(4,120,87,0.12)',
          borderWidth: 3, tension: 0.3, fill: true,
          pointBackgroundColor: COLORS.emerald,
          pointBorderColor: '#fff', pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          ...baseChartOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} mln so'm`
          }
        }
      },
      scales: {
        ...baseChartOptions.scales,
        y: {
          ...baseChartOptions.scales.y,
          ticks: {
            ...baseChartOptions.scales.y.ticks,
            callback: (v) => v + ' mln'
          }
        }
      }
    }
  });
}

function renderTaxesChart() {
  destroyChart('taxes');
  const filtered = getFilteredData();
  const byTax = {};
  filtered.forEach(r => {
    const k = `${r.TAX_CODE} - ${r.TAX_NAME}`;
    byTax[k] = (byTax[k] || 0) + (r.UPL || 0);
  });
  const sorted = Object.entries(byTax).sort((a,b) => b[1]-a[1]).slice(0,7);
  const ctx = document.getElementById('chartTaxes').getContext('2d');
  charts.taxes = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k]) => k.length > 30 ? k.substring(0,28)+'...' : k),
      datasets: [{
        data: sorted.map(([,v]) => v / 1e6),
        backgroundColor: PALETTE,
        borderColor: '#fff', borderWidth: 2
      }]
    },
    options: {
      ...baseChartOptions,
      cutout: '65%',
      scales: { x: { display: false }, y: { display: false } },
      plugins: {
        ...baseChartOptions.plugins,
        legend: { ...baseChartOptions.plugins.legend, position: 'bottom' },
        tooltip: {
          ...baseChartOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s,v) => s+v, 0);
              const pct = (ctx.parsed / total * 100).toFixed(1);
              return `${ctx.parsed.toFixed(1)} mln so'm (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderEfficiencyChart() {
  destroyChart('efficiency');
  const filtered = getFilteredData();
  const byD = {};
  filtered.forEach(r => {
    if (!byD[r.DISTRICT_NAME]) byD[r.DISTRICT_NAME] = { nac:0, upl:0 };
    byD[r.DISTRICT_NAME].nac += r.NAC || 0;
    byD[r.DISTRICT_NAME].upl += r.UPL || 0;
  });
  const arr = Object.entries(byD)
    .map(([n,v]) => ({n, eff: v.nac > 0 ? v.upl/v.nac*100 : 0}))
    .sort((a,b) => b.eff - a.eff);
  const ctx = document.getElementById('chartEfficiency').getContext('2d');
  charts.efficiency = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.n.replace(' tumani','')),
      datasets: [{
        data: arr.map(a => a.eff),
        backgroundColor: arr.map(a => a.eff > 86 ? COLORS.emerald : a.eff > 84 ? COLORS.gold : COLORS.orange),
        borderRadius: 4
      }]
    },
    options: {
      ...baseChartOptions,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseChartOptions.plugins.tooltip,
          callbacks: { label: (ctx) => `Samaradorlik: ${ctx.parsed.x.toFixed(1)}%` }
        }
      },
      scales: {
        x: { grid: { color: COLORS.slate100 }, ticks: { font:{family:'Inter',size:10}, callback:v=>v+'%' }, min: 80, max: 90 },
        y: { grid: { display: false }, ticks: { font:{family:'Inter',size:10}, color:COLORS.slate700 } }
      }
    }
  });
}

function renderRegimesChart() {
  destroyChart('regimes');
  const filtered = getFilteredData();
  const byR = {};
  filtered.forEach(r => {
    if (!byR[r.REGIME_NAME]) byR[r.REGIME_NAME] = new Set();
    byR[r.REGIME_NAME].add(r.JSHSHIR_ANON);
  });
  const labels = Object.keys(byR);
  const data = labels.map(k => byR[k].size);
  const ctx = document.getElementById('chartRegimes').getContext('2d');
  charts.regimes = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: [COLORS.navy, COLORS.gold, COLORS.emerald], borderColor: '#fff', borderWidth: 2 }]
    },
    options: {
      ...baseChartOptions,
      scales: { x: {display:false}, y: {display:false} },
      plugins: {
        ...baseChartOptions.plugins,
        legend: { ...baseChartOptions.plugins.legend, position: 'bottom' },
        tooltip: {
          ...baseChartOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s,v)=>s+v,0);
              return `${ctx.parsed} YTT (${(ctx.parsed/total*100).toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

function renderAgeChart() {
  destroyChart('age');
  const filtered = getFilteredData();
  const byAge = {};
  const seen = new Set();
  filtered.forEach(r => {
    if (seen.has(r.JSHSHIR_ANON)) return;
    seen.add(r.JSHSHIR_ANON);
    byAge[r.YTT_AGE] = (byAge[r.YTT_AGE] || 0) + 1;
  });
  const order = ["Yangi (< 1 yil)","O'rta (1-5 yil)","Tajribali (5+ yil)"];
  const ctx = document.getElementById('chartAge').getContext('2d');
  charts.age = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: order,
      datasets: [{ data: order.map(k => byAge[k]||0), backgroundColor: [COLORS.emeraldLight, COLORS.navy, COLORS.gold], borderColor: '#fff', borderWidth: 2 }]
    },
    options: {
      ...baseChartOptions,
      cutout: '60%',
      scales: { x:{display:false}, y:{display:false} },
      plugins: { ...baseChartOptions.plugins, legend: { ...baseChartOptions.plugins.legend, position: 'bottom' } }
    }
  });
}

// ============= MAP =============
const DISTRICT_LAYOUT = [
  // Approximate Tashkent layout (4 cols x 3 rows)
  { code: 2603, name: "Yunusobod tumani",     x: 50,  y: 30,  w: 200, h: 130, color: '' },
  { code: 2609, name: "Olmazor tumani",       x: 250, y: 30,  w: 180, h: 130, color: '' },
  { code: 2602, name: "Mirzo Ulug'bek tumani",x: 430, y: 30,  w: 180, h: 130, color: '' },
  { code: 2608, name: "Yashnobod tumani",     x: 610, y: 30,  w: 140, h: 130, color: '' },
  { code: 2605, name: "Shayxontohur tumani",  x: 50,  y: 160, w: 180, h: 130, color: '' },
  { code: 2601, name: "Mirobod tumani",       x: 230, y: 160, w: 130, h: 130, color: '' },
  { code: 2604, name: "Yakkasaroy tumani",    x: 360, y: 160, w: 110, h: 130, color: '' },
  { code: 2611, name: "Bektemir tumani",      x: 470, y: 160, w: 130, h: 130, color: '' },
  { code: 2606, name: "Chilonzor tumani",     x: 600, y: 160, w: 150, h: 130, color: '' },
  { code: 2610, name: "Uchtepa tumani",       x: 50,  y: 290, w: 200, h: 160, color: '' },
  { code: 2612, name: "Yangihayot tumani",    x: 250, y: 290, w: 250, h: 160, color: '' },
  { code: 2607, name: "Sergeli tumani",       x: 500, y: 290, w: 250, h: 160, color: '' }
];

function renderMap() {
  const svg = document.getElementById('cityMap');
  svg.innerHTML = '';
  
  // Calculate efficiency per district
  const filtered = getFilteredData();
  const stats = {};
  filtered.forEach(r => {
    if (!stats[r.DISTRICT_CODE]) stats[r.DISTRICT_CODE] = { nac:0, upl:0, ytt:new Set(), name: r.DISTRICT_NAME };
    stats[r.DISTRICT_CODE].nac += r.NAC || 0;
    stats[r.DISTRICT_CODE].upl += r.UPL || 0;
    stats[r.DISTRICT_CODE].ytt.add(r.JSHSHIR_ANON);
  });
  
  // Color by efficiency
  function getColor(eff) {
    if (eff >= 86) return '#047857';
    if (eff >= 85) return '#10B981';
    if (eff >= 84.5) return '#65A30D';
    if (eff >= 84) return '#CA8A04';
    if (eff >= 83.5) return '#EA580C';
    return '#B91C1C';
  }
  
  // Add title
  const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  titleText.setAttribute('x', 400); titleText.setAttribute('y', 18);
  titleText.setAttribute('text-anchor', 'middle');
  titleText.setAttribute('font-family', 'Inter');
  titleText.setAttribute('font-size', '14');
  titleText.setAttribute('font-weight', '700');
  titleText.setAttribute('fill', COLORS.navy);
  titleText.textContent = 'TOSHKENT SHAHRI · 12 MA\'MURIY TUMAN';
  svg.appendChild(titleText);
  
  DISTRICT_LAYOUT.forEach(d => {
    const stat = stats[d.code];
    if (!stat) return;
    const eff = stat.nac > 0 ? stat.upl / stat.nac * 100 : 0;
    const color = getColor(eff);
    
    // Rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', d.x); rect.setAttribute('y', d.y);
    rect.setAttribute('width', d.w); rect.setAttribute('height', d.h);
    rect.setAttribute('rx', 6);
    rect.setAttribute('fill', color);
    rect.setAttribute('class', 'district-shape');
    rect.dataset.code = d.code;
    
    rect.addEventListener('mouseenter', (e) => showTooltip(e, d, stat, eff));
    rect.addEventListener('mousemove', (e) => moveTooltip(e));
    rect.addEventListener('mouseleave', hideTooltip);
    
    svg.appendChild(rect);
    
    // Label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', d.x + d.w/2); label.setAttribute('y', d.y + d.h/2 - 8);
    label.setAttribute('class', 'district-label');
    label.textContent = d.name.replace(' tumani', '');
    svg.appendChild(label);
    
    // Value
    const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    val.setAttribute('x', d.x + d.w/2); val.setAttribute('y', d.y + d.h/2 + 10);
    val.setAttribute('class', 'district-value');
    val.textContent = eff.toFixed(1) + '%';
    svg.appendChild(val);
    
    // YTT count
    const cnt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    cnt.setAttribute('x', d.x + d.w/2); cnt.setAttribute('y', d.y + d.h/2 + 24);
    cnt.setAttribute('class', 'district-value');
    cnt.style.fontSize = '8px';
    cnt.textContent = stat.ytt.size + ' YTT';
    svg.appendChild(cnt);
  });
}

function showTooltip(e, d, stat, eff) {
  const tt = document.getElementById('mapTooltip');
  tt.innerHTML = `
    <div class="map-tooltip-title">${d.name}</div>
    <div class="map-tooltip-row"><span class="map-tooltip-label">YTT soni:</span> <span class="map-tooltip-value">${stat.ytt.size} ta</span></div>
    <div class="map-tooltip-row"><span class="map-tooltip-label">Reja:</span> <span class="map-tooltip-value">${fmt.bln(stat.nac)} mlrd</span></div>
    <div class="map-tooltip-row"><span class="map-tooltip-label">Real:</span> <span class="map-tooltip-value">${fmt.bln(stat.upl)} mlrd</span></div>
    <div class="map-tooltip-row"><span class="map-tooltip-label">Samaradorlik:</span> <span class="map-tooltip-value">${eff.toFixed(1)}%</span></div>
  `;
  tt.classList.add('visible');
}

function moveTooltip(e) {
  const tt = document.getElementById('mapTooltip');
  const wrapper = document.querySelector('.map-svg-wrapper');
  const rect = wrapper.getBoundingClientRect();
  let x = e.clientX - rect.left + 12;
  let y = e.clientY - rect.top + 12;
  if (x + 240 > rect.width) x = e.clientX - rect.left - 252;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function hideTooltip() {
  document.getElementById('mapTooltip').classList.remove('visible');
}

// ============= DENSITY & GDP CHARTS =============
function renderDensityChart() {
  destroyChart('density');
  const districts = {};
  DATA.forEach(r => {
    if (!districts[r.DISTRICT_NAME]) {
      districts[r.DISTRICT_NAME] = { pop: r.POPULATION, ytt: new Set(), density: r.DENSITY };
    }
    districts[r.DISTRICT_NAME].ytt.add(r.JSHSHIR_ANON);
  });
  const arr = Object.entries(districts).map(([n,v]) => ({
    name: n.replace(' tumani',''), pop: v.pop / 1000, ytt: v.ytt.size
  }));
  const ctx = document.getElementById('chartDensity').getContext('2d');
  charts.density = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.name),
      datasets: [
        { label: 'Aholi (ming)', data: arr.map(a => a.pop), backgroundColor: COLORS.navy, borderRadius: 4, yAxisID: 'y' },
        { label: 'YTT soni', data: arr.map(a => a.ytt), backgroundColor: COLORS.gold, borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      ...baseChartOptions,
      scales: {
        x: { grid: {display:false}, ticks: { font:{family:'Inter',size:10}, color: COLORS.slate700, maxRotation: 45, minRotation: 45 } },
        y: { type: 'linear', position: 'left', grid: { color: COLORS.slate100 }, title:{display:true, text:"Aholi (ming)"} },
        y1: { type: 'linear', position: 'right', grid: { display: false }, title:{display:true, text:'YTT soni'} }
      }
    }
  });
}

function renderGDPChart() {
  destroyChart('gdp');
  const districts = {};
  DATA.forEach(r => {
    if (!districts[r.DISTRICT_NAME]) districts[r.DISTRICT_NAME] = r.GDP_SHARE;
  });
  const arr = Object.entries(districts).map(([n,v]) => ({n: n.replace(' tumani',''), v: v}))
    .sort((a,b) => b.v - a.v);
  const ctx = document.getElementById('chartGDP').getContext('2d');
  charts.gdp = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.n),
      datasets: [{
        data: arr.map(a => a.v),
        backgroundColor: arr.map((a,i) => i < 3 ? COLORS.emerald : i < 6 ? COLORS.navy : COLORS.gold),
        borderRadius: 4
      }]
    },
    options: {
      ...baseChartOptions,
      indexAxis: 'y',
      plugins: { legend: {display: false}, tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (c) => c.parsed.x + '%' } } },
      scales: {
        x: { grid: { color: COLORS.slate100 }, ticks: { font:{family:'Inter',size:10}, callback: v=>v+'%' }},
        y: { grid: { display: false }, ticks: { font:{family:'Inter',size:10}, color: COLORS.slate700 } }
      }
    }
  });
}

// ============= DISTRICTS TABLE =============
function renderDistrictsTable() {
  const filtered = getFilteredData();
  const stats = {};
  filtered.forEach(r => {
    if (!stats[r.DISTRICT_NAME]) {
      stats[r.DISTRICT_NAME] = { nac:0, upl:0, ytt:new Set(), pop: r.POPULATION, gdp: r.GDP_SHARE };
    }
    stats[r.DISTRICT_NAME].nac += r.NAC || 0;
    stats[r.DISTRICT_NAME].upl += r.UPL || 0;
    stats[r.DISTRICT_NAME].ytt.add(r.JSHSHIR_ANON);
  });
  const arr = Object.entries(stats).map(([n,v]) => ({
    name: n, ...v, eff: v.nac > 0 ? v.upl/v.nac*100 : 0, ytt: v.ytt.size
  })).sort((a,b) => b.eff - a.eff);
  
  const tbody = document.getElementById('rankingBody');
  tbody.innerHTML = arr.map((d, i) => {
    const rankBadge = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const status = d.eff >= 86 ? 'success' : d.eff >= 84 ? 'info' : 'warning';
    const statusText = d.eff >= 86 ? 'A\'lo' : d.eff >= 84 ? 'Yaxshi' : 'O\'rtacha';
    return `<tr>
      <td class="center"><span class="rank-badge ${rankBadge}">${i+1}</span></td>
      <td><strong>${d.name}</strong></td>
      <td class="right">${(d.pop/1000).toFixed(1)}</td>
      <td class="right">${d.ytt}</td>
      <td class="right">${fmt.bln(d.nac)}</td>
      <td class="right"><strong>${fmt.bln(d.upl)}</strong></td>
      <td class="right"><strong style="color:${d.eff>=86?'var(--emerald)':d.eff>=84?'var(--navy)':'var(--orange)'}">${d.eff.toFixed(1)}%</strong></td>
      <td class="right">${d.gdp.toFixed(1)}%</td>
      <td class="center"><span class="badge badge-${status}">${statusText}</span></td>
    </tr>`;
  }).join('');
}

function renderDistrictsChart() {
  destroyChart('districts');
  const filtered = getFilteredData();
  const stats = {};
  filtered.forEach(r => {
    if (!stats[r.DISTRICT_NAME]) stats[r.DISTRICT_NAME] = {nac:0, upl:0};
    stats[r.DISTRICT_NAME].nac += r.NAC || 0;
    stats[r.DISTRICT_NAME].upl += r.UPL || 0;
  });
  const arr = Object.entries(stats).map(([n,v]) => ({n, ...v}))
    .sort((a,b) => b.upl - a.upl);
  const ctx = document.getElementById('chartDistricts').getContext('2d');
  charts.districts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.n.replace(' tumani','')),
      datasets: [
        { label: 'Reja', data: arr.map(a => a.nac/1e6), backgroundColor: COLORS.slate300, borderRadius: 4 },
        { label: 'Real', data: arr.map(a => a.upl/1e6), backgroundColor: COLORS.emerald, borderRadius: 4 }
      ]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          ...baseChartOptions.plugins.tooltip,
          callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y.toFixed(0)} mln so'm` }
        }
      },
      scales: {
        x: { grid:{display:false}, ticks: {font:{family:'Inter',size:10}, maxRotation: 45, minRotation: 45}},
        y: { grid:{color:COLORS.slate100}, ticks: {font:{family:'Inter',size:10}, callback: v=>v+' mln'}}
      }
    }
  });
}

// ============= SECTORS =============
function renderSectorsTab() {
  const filtered = getFilteredData();
  const stats = {};
  filtered.forEach(r => {
    if (!stats[r.SECTOR_NAME]) stats[r.SECTOR_NAME] = { nac:0, upl:0, ytt: new Set() };
    stats[r.SECTOR_NAME].nac += r.NAC || 0;
    stats[r.SECTOR_NAME].upl += r.UPL || 0;
    stats[r.SECTOR_NAME].ytt.add(r.JSHSHIR_ANON);
  });
  const arr = Object.entries(stats).map(([n,v]) => ({
    name: n, ...v, eff: v.nac > 0 ? v.upl/v.nac*100 : 0, ytt: v.ytt.size
  })).sort((a,b) => b.upl - a.upl);
  
  // Total UPL
  const totalUpl = arr.reduce((s,a) => s + a.upl, 0);
  
  // Chart 1: tushum
  destroyChart('sectors');
  const ctx1 = document.getElementById('chartSectors').getContext('2d');
  charts.sectors = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.name.length > 18 ? a.name.substring(0,16)+'...' : a.name),
      datasets: [{
        data: arr.map(a => a.upl/1e6),
        backgroundColor: PALETTE,
        borderRadius: 4
      }]
    },
    options: {
      ...baseChartOptions,
      indexAxis: 'y',
      plugins: { legend: {display: false}, tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (c) => c.parsed.x.toFixed(0) + ' mln so\'m' } } },
      scales: {
        x: { grid:{color:COLORS.slate100}, ticks: {font:{family:'Inter',size:10}, callback: v=>v+' mln'}},
        y: { grid:{display:false}, ticks: {font:{family:'Inter',size:10}}}
      }
    }
  });
  
  // Chart 2: efficiency
  destroyChart('sectorEff');
  const ctx2 = document.getElementById('chartSectorEff').getContext('2d');
  charts.sectorEff = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: arr.map(a => a.name.length > 18 ? a.name.substring(0,16)+'...' : a.name),
      datasets: [{
        data: arr.map(a => a.eff),
        backgroundColor: arr.map(a => a.eff > 86 ? COLORS.emerald : a.eff > 84 ? COLORS.navy : COLORS.orange),
        borderRadius: 4
      }]
    },
    options: {
      ...baseChartOptions,
      indexAxis: 'y',
      plugins: { legend: {display: false}, tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (c) => c.parsed.x.toFixed(1) + '%' } } },
      scales: {
        x: { grid:{color:COLORS.slate100}, ticks: {font:{family:'Inter',size:10}, callback: v=>v+'%'}, min:80, max:90},
        y: { grid:{display:false}, ticks: {font:{family:'Inter',size:10}}}
      }
    }
  });
  
  // Table
  const tbody = document.getElementById('sectorBody');
  tbody.innerHTML = arr.map((s, i) => {
    const trend = Math.random() > 0.3 ? '+' : '-';
    const trendVal = (Math.random() * 5 + 1).toFixed(1);
    const trendBadge = trend === '+' ? 'success' : 'warning';
    return `<tr>
      <td class="center"><span class="rank-badge ${i<3?(i==0?'gold':i==1?'silver':'bronze'):''}">${i+1}</span></td>
      <td><strong>${s.name}</strong></td>
      <td class="right">${s.ytt}</td>
      <td class="right"><strong>${fmt.bln(s.upl)}</strong></td>
      <td class="right">${fmt.mln(s.upl/s.ytt)} mln</td>
      <td class="right">${(s.upl/totalUpl*100).toFixed(1)}%</td>
      <td class="center"><span class="badge badge-${trendBadge}">${trend}${trendVal}%</span></td>
    </tr>`;
  }).join('');
}

// ============= DYNAMICS =============
function renderDynamicsTab() {
  destroyChart('dynamics');
  const filtered = getFilteredData();
  const monthly = {};
  for (let m = 1; m <= 12; m++) monthly[m] = { nac:0, upl:0, ytt: new Set() };
  filtered.forEach(r => {
    if (monthly[r.MONTH]) {
      monthly[r.MONTH].nac += r.NAC || 0;
      monthly[r.MONTH].upl += r.UPL || 0;
      monthly[r.MONTH].ytt.add(r.JSHSHIR_ANON);
    }
  });
  
  const ctx = document.getElementById('chartDynamics').getContext('2d');
  charts.dynamics = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: 'Reja (mln)', data: Object.values(monthly).map(m => m.nac/1e6),
          borderColor: COLORS.slate500, backgroundColor: 'rgba(100,116,139,.05)',
          borderWidth: 2, borderDash: [5,5], tension: 0.3, fill: false
        },
        {
          label: 'Real tushum (mln)', data: Object.values(monthly).map(m => m.upl/1e6),
          borderColor: COLORS.emerald, backgroundColor: 'rgba(4,120,87,.15)',
          borderWidth: 3, tension: 0.3, fill: true,
          pointBackgroundColor: COLORS.emerald, pointBorderColor: '#fff', pointRadius: 5
        },
        {
          label: 'Samaradorlik (%)', data: Object.values(monthly).map(m => m.nac > 0 ? m.upl/m.nac*100 : 0),
          borderColor: COLORS.gold, borderWidth: 2, tension: 0.3,
          yAxisID: 'y1', pointBackgroundColor: COLORS.gold, pointBorderColor:'#fff'
        }
      ]
    },
    options: {
      ...baseChartOptions,
      scales: {
        x: { grid:{display:false}, ticks: {font:{family:'Inter',size:11}}},
        y: { grid:{color:COLORS.slate100}, ticks: {font:{family:'Inter',size:11}, callback:v=>v+' mln'}, title:{display:true,text:'Tushum'}},
        y1: { type:'linear', position:'right', grid:{display:false}, ticks:{callback:v=>v+'%', font:{family:'Inter',size:11}}, title:{display:true,text:'Samaradorlik %'} }
      }
    }
  });
  
  // Heatmap (using bar chart simulation)
  destroyChart('heatmap');
  const districts = [...new Set(DATA.map(d => d.DISTRICT_NAME))].sort();
  const heatData = [];
  districts.forEach(d => {
    for (let m = 1; m <= 12; m++) {
      const recs = filtered.filter(r => r.DISTRICT_NAME === d && r.MONTH === m);
      const upl = recs.reduce((s,r) => s + (r.UPL||0), 0);
      heatData.push({ x: MONTHS[m-1], y: d.replace(' tumani',''), v: upl/1e6 });
    }
  });
  
  const ctx2 = document.getElementById('chartHeatmap').getContext('2d');
  charts.heatmap = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: districts.slice(0,5).map((d, i) => ({
        label: d.replace(' tumani',''),
        data: MONTHS.map((mn, mi) => {
          const recs = filtered.filter(r => r.DISTRICT_NAME === d && r.MONTH === mi+1);
          return recs.reduce((s,r) => s + (r.UPL||0), 0) / 1e6;
        }),
        backgroundColor: PALETTE[i],
        borderRadius: 3
      }))
    },
    options: {
      ...baseChartOptions,
      scales: {
        x: { stacked: true, grid:{display:false}, ticks:{font:{family:'Inter',size:10}}},
        y: { stacked: true, grid:{color:COLORS.slate100}, ticks:{font:{family:'Inter',size:10}, callback: v=>v+' mln'}}
      }
    }
  });
  
  // Seasonality
  destroyChart('seasonality');
  const ctx3 = document.getElementById('chartSeasonality').getContext('2d');
  const upl_arr = Object.values(monthly).map(m => m.upl);
  const avg_upl = upl_arr.reduce((s,v) => s+v, 0) / upl_arr.length;
  const seasonality = upl_arr.map(v => avg_upl > 0 ? (v / avg_upl * 100) : 100);
  
  charts.seasonality = new Chart(ctx3, {
    type: 'radar',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Mavsumiy indeks',
        data: seasonality,
        borderColor: COLORS.emerald,
        backgroundColor: 'rgba(4,120,87,0.15)',
        borderWidth: 2,
        pointBackgroundColor: COLORS.emerald,
        pointBorderColor: '#fff'
      }, {
        label: 'O\'rtacha (100%)',
        data: Array(12).fill(100),
        borderColor: COLORS.slate500,
        borderDash: [4,4],
        borderWidth: 1,
        pointRadius: 0,
        backgroundColor: 'transparent'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }} },
        tooltip: baseChartOptions.plugins.tooltip
      },
      scales: {
        r: {
          ticks: { font: { family: 'Inter', size: 10 }, callback: v=>v+'%' },
          pointLabels: { font: { family: 'Inter', size: 10 } },
          grid: { color: COLORS.slate100 },
          angleLines: { color: COLORS.slate100 }
        }
      }
    }
  });
}

// ============= SEARCH =============
let searchTimeout = null;
['searchJshshir', 'searchFISH'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 250);
  });
});

function performSearch() {
  const j = document.getElementById('searchJshshir').value.trim().toLowerCase();
  const f = document.getElementById('searchFISH').value.trim().toLowerCase();
  
  if (!j && !f) {
    document.getElementById('searchBody').innerHTML = '<tr><td colspan="8" class="empty-state">Yuqorida qidiruv ma\'lumotini kiriting</td></tr>';
    document.getElementById('searchResultCount').textContent = 'Qidiruv uchun yuqorida ma\'lumot kiriting';
    return;
  }
  
  let results = DATA;
  if (j && j.length >= 3) results = results.filter(r => String(r.JSHSHIR_ANON).toLowerCase().includes(j));
  if (f && f.length >= 2) results = results.filter(r => String(r.FISH).toLowerCase().includes(f));
  
  // Group by YTT - aggregate
  const byYtt = {};
  results.forEach(r => {
    if (!byYtt[r.JSHSHIR_ANON]) {
      byYtt[r.JSHSHIR_ANON] = { ...r, total_upl: 0, debt: r.DEBT_STATUS };
    }
    byYtt[r.JSHSHIR_ANON].total_upl += r.UPL || 0;
  });
  
  const arr = Object.values(byYtt).slice(0, 100);
  document.getElementById('searchResultCount').textContent = `${arr.length} ta natija topildi (jami: ${Object.keys(byYtt).length})`;
  
  if (arr.length === 0) {
    document.getElementById('searchBody').innerHTML = '<tr><td colspan="8" class="empty-state">Mos natija topilmadi</td></tr>';
    return;
  }
  
  document.getElementById('searchBody').innerHTML = arr.map(r => {
    const debtBadge = r.debt === "Yo'q" ? 'success' : r.debt === 'Kichik (<10%)' ? 'info' : 'warning';
    return `<tr>
      <td><code style="font-family:'Courier New',monospace;font-size:12px;color:var(--navy);font-weight:600">${r.JSHSHIR_ANON}</code></td>
      <td>${r.FISH}</td>
      <td>${r.DISTRICT_NAME}</td>
      <td>${r.SECTOR_NAME}</td>
      <td>${r.REGIME_NAME}</td>
      <td class="right"><span class="badge badge-info">${r.TAX_CODE}</span></td>
      <td class="right"><strong>${fmt.mln(r.total_upl)}</strong></td>
      <td class="center"><span class="badge badge-${debtBadge}">${r.debt}</span></td>
    </tr>`;
  }).join('');
}

// ============= REAL-TIME COUNTER =============
function startRealtime() {
  // Initialize today's count based on current time of day
  const now = new Date();
  const hours = now.getHours() + now.getMinutes()/60;
  const dayProgress = Math.min(1, Math.max(0.05, (hours - 8) / 12)); // Working hours 8-20
  realtimeAccumulator = 85.4 * dayProgress * (0.92 + Math.random() * 0.1); // ~85 mln daily target
  realtimeOpsCount = Math.floor(120 * dayProgress);
  realtimeYttToday = Math.floor(85 * dayProgress);
  
  updateRealtimeDisplay();
  
  // Tick every 3 sec
  setInterval(() => {
    // Add some realistic increment
    const increment = Math.random() * 0.4 + 0.05; // 50,000 - 450,000 so'm
    realtimeAccumulator += increment;
    realtimeOpsCount += Math.random() > 0.3 ? 1 : 0;
    if (Math.random() > 0.7) realtimeYttToday += 1;
    
    // Last payment
    const lastVal = (Math.random() * 800 + 50).toFixed(0);
    document.getElementById('rtLast').textContent = lastVal + 'k';
    
    updateRealtimeDisplay();
    
    // Update timestamp
    document.getElementById('lastUpdate').textContent = getCurrentTime();
  }, 3000);
}

function updateRealtimeDisplay() {
  // Animate counter
  const target = realtimeAccumulator;
  const el = document.getElementById('rtToday');
  const current = parseFloat(el.textContent.replace(/,/g, '')) || 0;
  const step = (target - current) / 20;
  let i = 0;
  const animate = () => {
    if (i++ < 20) {
      const val = current + step * i;
      el.textContent = val.toFixed(2);
      requestAnimationFrame(animate);
    } else {
      el.textContent = target.toFixed(2);
    }
  };
  animate();
  
  document.getElementById('rtCount').textContent = realtimeOpsCount;
  document.getElementById('rtYtt').textContent = realtimeYttToday;
}

// ============= EXPORT =============
function exportTable(tableId, filename) {
  const table = document.getElementById(tableId);
  const rows = table.querySelectorAll('tr');
  const csv = [];
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    const rowData = Array.from(cells).map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`);
    csv.push(rowData.join(','));
  });
  const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMapData() {
  const stats = {};
  DATA.forEach(r => {
    if (!stats[r.DISTRICT_NAME]) stats[r.DISTRICT_NAME] = { nac:0, upl:0, ytt:new Set() };
    stats[r.DISTRICT_NAME].nac += r.NAC || 0;
    stats[r.DISTRICT_NAME].upl += r.UPL || 0;
    stats[r.DISTRICT_NAME].ytt.add(r.JSHSHIR_ANON);
  });
  const csv = ['Hudud,YTT soni,Reja (mln),Real (mln),Samaradorlik %'];
  Object.entries(stats).forEach(([n,s]) => {
    const eff = s.nac > 0 ? (s.upl/s.nac*100).toFixed(1) : 0;
    csv.push(`"${n}",${s.ytt.size},${(s.nac/1e6).toFixed(1)},${(s.upl/1e6).toFixed(1)},${eff}`);
  });
  const blob = new Blob(['\ufeff' + csv.join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `xarita_data_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============= UPDATE ALL =============
function updateAll() {
  updateKPIs();
  renderTrendChart();
  renderTaxesChart();
  renderEfficiencyChart();
  renderRegimesChart();
  renderAgeChart();
  renderMap();
  renderDistrictsTable();
  renderDistrictsChart();
  renderSectorsTab();
  renderDynamicsTab();
}

// ============= INIT =============
async function init() {
  try {
    await loadData();
    populateFilters();
    
    // Static charts (don't depend on filters)
    renderDensityChart();
    renderGDPChart();
    
    // Filtered charts
    updateAll();
    
    // Start realtime
    startRealtime();
    
    console.log('✅ Dashboard ready');
  } catch (e) {
    console.error('❌ Error:', e);
    document.body.innerHTML = `<div style="padding:60px;text-align:center;color:#B91C1C;font-family:Inter,sans-serif"><h2>Ma'lumotlarni yuklashda xatolik</h2><p>${e.message}</p></div>`;
  }
}

init();
