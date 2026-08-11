
// ==========================================================================
// MÓDULO DE AUTENTICACIÓN Y CONTROL DE ACCESO (AuthManager)
// ==========================================================================
const AuthManager = {
  accounts: [
    { email: 'ccoxhead@gmail.com', pass: '123456', canal: 'Público', name: 'C. Coxhead' },
    { email: 'admin@glomax.cl', pass: 'admin123', canal: 'Todos', name: 'Administrador BI' },
    { email: 'retail@glomax.cl', pass: '123456', canal: 'Retail', name: 'Ventas Retail' },
    { email: 'mayorista@glomax.cl', pass: '123456', canal: 'Mayorista', name: 'Ventas Mayorista' }
  ],
  
  currentUser: null,

  init() {
    this.bindEvents();
    this.checkSession();
  },

  openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  },

  closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  },

  checkSession() {
    const sessionStr = localStorage.getItem('glomax_auth_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.email && session.canal) {
          this.currentUser = session;
          this.closeLoginModal();
          this.renderProfileBadge();
          this.applyUserChannelPermissions();
          return true;
        }
      } catch (e) {
        localStorage.removeItem('glomax_auth_session');
      }
    }
    this.currentUser = null;
    this.renderProfileBadge();
    this.openLoginModal();
    return false;
  },

  login(email, pass, canal) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (pass || '').trim();
    let selectedCanal = (canal || '').trim();

    if (!cleanEmail || !cleanPass) {
      this.showError('Por favor ingresa tu correo y contraseña.');
      return false;
    }

    let acct = this.accounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (acct) {
      if (acct.pass !== cleanPass) {
        this.showError('Contraseña incorrecta. Por favor verifica tus datos.');
        return false;
      }
      if (!selectedCanal || acct.canal !== 'Todos') {
        selectedCanal = acct.canal;
      }
    } else {
      if (cleanPass.length < 4) {
        this.showError('La contraseña debe tener al menos 4 caracteres.');
        return false;
      }
      if (!selectedCanal) selectedCanal = 'Público';
    }

    const session = {
      email: cleanEmail,
      canal: selectedCanal,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('glomax_auth_session', JSON.stringify(session));
    this.currentUser = session;

    if (typeof AudioSynth !== 'undefined' && AudioSynth.play) {
      AudioSynth.play('sync');
    }

    this.closeLoginModal();
    this.renderProfileBadge();
    this.applyUserChannelPermissions();

    if (typeof populateFilterOptions === 'function') {
      populateFilterOptions();
    }
    if (typeof applyFilters === 'function') {
      applyFilters();
    }

    return true;
  },

  logout() {
    localStorage.removeItem('glomax_auth_session');
    this.currentUser = null;
    
    const select = document.getElementById('fltCanal');
    if (select) {
      select.disabled = false;
      select.classList.remove('locked-channel');
      select.value = '';
    }

    this.renderProfileBadge();
    this.openLoginModal();

    if (typeof applyFilters === 'function') {
      applyFilters();
    }
  },

  renderProfileBadge() {
    const badge = document.getElementById('userProfileBadge');
    const headerBtn = document.getElementById('headerLoginBtn');
    const avatar = document.getElementById('userAvatar');
    const emailBadge = document.getElementById('userEmailBadge');
    const channelBadge = document.getElementById('userChannelBadge');
    const sidebarLabel = document.getElementById('sidebarAuthLabel');
    const sidebarBadge = document.getElementById('sidebarAuthBadge');

    if (!this.currentUser) {
      if (badge) badge.style.display = 'none';
      if (headerBtn) headerBtn.style.display = 'flex';
      if (sidebarLabel) sidebarLabel.textContent = 'Iniciar Sesión / Canal';
      if (sidebarBadge) sidebarBadge.textContent = 'Login';
      return;
    }

    if (badge) badge.style.display = 'flex';
    if (headerBtn) headerBtn.style.display = 'none';
    if (avatar) avatar.textContent = (this.currentUser.email[0] || 'U').toUpperCase();
    if (emailBadge) emailBadge.textContent = this.currentUser.email;
    if (channelBadge) channelBadge.textContent = `Canal: ${this.currentUser.canal}`;
    if (sidebarLabel) sidebarLabel.textContent = `${this.currentUser.email}`;
    if (sidebarBadge) sidebarBadge.textContent = `${this.currentUser.canal}`;
  },

  applyUserChannelPermissions() {
    if (!this.currentUser) return;

    const select = document.getElementById('fltCanal');
    const isRestricted = this.currentUser.canal && this.currentUser.canal.toLowerCase() !== 'todos';

    if (select) {
      if (isRestricted) {
        let matchOpt = Array.from(select.options).find(opt => typeof normalizeChannelStr === 'function' ? normalizeChannelStr(opt.value) === normalizeChannelStr(this.currentUser.canal) : opt.value.toLowerCase() === this.currentUser.canal.toLowerCase());
        if (matchOpt) {
          select.value = matchOpt.value;
        } else {
          const newOpt = document.createElement('option');
          newOpt.value = this.currentUser.canal;
          newOpt.textContent = this.currentUser.canal;
          select.appendChild(newOpt);
          select.value = this.currentUser.canal;
        }
        select.disabled = true;
        select.classList.add('locked-channel');
        select.title = `Acceso restringido únicamente al canal ${this.currentUser.canal}`;
      } else {
        select.disabled = false;
        select.classList.remove('locked-channel');
        select.title = '';
      }
    }
  },

  bindEvents() {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value;
        const pass = document.getElementById('loginPassword')?.value;
        const canal = document.getElementById('loginCanal')?.value;
        this.login(email, pass, canal);
      });
    }

    const togglePw = document.getElementById('loginTogglePw');
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        const passInput = document.getElementById('loginPassword');
        if (passInput) {
          const isPw = passInput.type === 'password';
          passInput.type = isPw ? 'text' : 'password';
        }
      });
    }

    const logoutBtn = document.getElementById('btnLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const email = pill.dataset.email;
        const pass = pill.dataset.pass;
        const canal = pill.dataset.canal;
        
        const emailIn = document.getElementById('loginEmail');
        const passIn = document.getElementById('loginPassword');
        const canalIn = document.getElementById('loginCanal');
        
        if (emailIn) emailIn.value = email;
        if (passIn) passIn.value = pass;
        if (canalIn && canal) canalIn.value = canal;

        this.login(email, pass, canal);
      });
    });
  },

  showError(msg) {
    const errBox = document.getElementById('loginErrorMsg');
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthManager.init());
} else {
  AuthManager.init();
}


// ---------- Estado ----------
let rows = [];          // datos crudos desde el Sheet
let filtered = [];       // luego de aplicar filtros
let currentPage = 1;
const PAGE_SIZE = 50;
let refreshTimer = null;

// ---------- Utilidades ----------
function formatCLP(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}
function formatNum(n) {
  return (Number(n) || 0).toLocaleString('es-CL');
}
function toDateInputValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (state === 'ok') el.innerHTML = '<span class="dot"></span> Sincronizado';
  else if (state === 'loading') el.innerHTML = '<span class="dot"></span> Sincronizando…';
  else el.innerHTML = '<span class="dot" style="background:var(--red)"></span> Sin conexión';
}

// ---------- API ----------
async function apiGet() {
  const res = await fetch(API_URL, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al leer datos');
  return json.data;
}
async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS con Apps Script
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al guardar');
  return json;
}

async function loadData(showLoadingState = true) {
  if (showLoadingState) setSyncStatus('loading');
  try {
    rows = await apiGet();
    setSyncStatus('ok');
    populateFilterOptions();
    applyFilters();
  } catch (err) {
    setSyncStatus('error');
    console.error(err);
    if (API_URL.includes('PEGA_AQUI')) showToast('Configura tu URL de Apps Script en config.js');
    else showToast('No se pudo conectar con el Sheet');
  }
}

// ---------- Filtros ----------
function uniqueValues(field) {
  return [...new Set(rows.map(r => r[field]).filter(v => v !== undefined && v !== null && v !== ''))].sort();
}

function populateFilterOptions() {
  const map = {
    fltCanal: 'CANAL FINAL',
    fltTienda: 'TIENDA FINAL',
    fltVendedor: 'CODVENDENDOR',
    fltFamilia: 'FAMILIA',
    fltRegion: 'REGION'
  };
  Object.entries(map).forEach(([selectId, field]) => {
    const select = document.getElementById(selectId);
    const current = select.value;
    const opts = uniqueValues(field);
    select.innerHTML = `<option value="">Todos</option>` + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    if (opts.includes(current)) select.value = current;
  });

  renderCanalSubmenu();
}

// ---------- Sidebar: submenú de Canal ----------
function renderCanalSubmenu() {
  const submenu = document.getElementById('canalSubmenu');
  const canales = uniqueValues('CANAL FINAL');
  const canalActivo = document.getElementById('fltCanal').value;

  submenu.innerHTML = canales.map(c => `
    <button class="nav-subitem ${c === canalActivo ? 'active' : ''}" data-canal="${c}">${c}</button>
  `).join('');

  submenu.querySelectorAll('.nav-subitem').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('fltCanal').value = btn.dataset.canal;
      applyFilters();
      renderCanalSubmenu();
      // Cambia a la vista de Tablero para ver el resultado del filtro
      document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('.nav-item[data-view="tablero"]').classList.add('active');
      document.getElementById('view-tablero').classList.add('active');
    });
  });
}

document.getElementById('canalToggle').addEventListener('click', () => {
  document.getElementById('canalToggle').classList.toggle('expanded');
  document.getElementById('canalSubmenu').classList.toggle('open');
});

function getFilters() {
  return {
    desde: document.getElementById('fltDesde').value,
    hasta: document.getElementById('fltHasta').value,
    canal: document.getElementById('fltCanal').value,
    tienda: document.getElementById('fltTienda').value,
    vendedor: document.getElementById('fltVendedor').value,
    familia: document.getElementById('fltFamilia').value,
    region: document.getElementById('fltRegion').value,
    search: (document.getElementById('searchBox') ? document.getElementById('searchBox').value : '').trim().toLowerCase()
  };
}

function applyFilters() {
  const f = getFilters();
  filtered = rows.filter(r => {
    if (f.desde) {
      const d = new Date(r['FECHA']);
      if (isNaN(d.getTime()) || d < new Date(f.desde)) return false;
    }
    if (f.hasta) {
      const d = new Date(r['FECHA']);
      if (isNaN(d.getTime()) || d > new Date(f.hasta + 'T23:59:59')) return false;
    }
    if (f.canal && r['CANAL FINAL'] !== f.canal) return false;
    if (f.tienda && r['TIENDA FINAL'] !== f.tienda) return false;
    if (f.vendedor && r['CODVENDENDOR'] !== f.vendedor) return false;
    if (f.familia && r['FAMILIA'] !== f.familia) return false;
    if (f.region && r['REGION'] !== f.region) return false;
    if (f.search) {
      const hay = [r['FOLIO'], r['CLIENTE'], r['CODIGO'], r['DESCRIPCION']]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });
  currentPage = 1;
  renderAll();
}

['fltDesde', 'fltHasta', 'fltCanal', 'fltTienda', 'fltVendedor', 'fltFamilia', 'fltRegion'].forEach(id => {
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  ['fltDesde', 'fltHasta', 'fltCanal', 'fltTienda', 'fltVendedor', 'fltFamilia', 'fltRegion'].forEach(id => {
    document.getElementById(id).value = '';
  });
  const sb = document.getElementById('searchBox');
  if (sb) sb.value = '';
  applyFilters();
});

// ---------- Render orquestador ----------
function renderAll() {
  renderTicker();
  renderTodayCard();
  renderKPIs();
  renderCharts();
  renderTable();
}

// ---------- Ticker ----------
function renderTicker() {
  const totalNeto = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const totalUtilidad = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);
  const unidades = filtered.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);
  const folios = new Set(filtered.map(r => r['FOLIO'])).size;

  const items = [
    `VENTA NETA ${formatCLP(totalNeto)}`,
    `UTILIDAD ${formatCLP(totalUtilidad)}`,
    `UNIDADES ${formatNum(unidades)}`,
    `DOCUMENTOS ${formatNum(folios)}`
  ];
  const track = document.getElementById('tickerTrack');
  const html = items.map(i => `<span>${i}</span>`).join('<span style="opacity:0.4"> // </span>');
  track.innerHTML = html + '<span style="opacity:0.4"> // </span>' + html;
}

// ---------- Venta del día ----------
function isSameDay(value, ref) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

function renderTodayCard() {
  const f = getFilters(); // reutiliza canal, tienda, vendedor, familia, región ya seleccionados
  const hoy = new Date();

  const rowsHoy = rows.filter(r => {
    if (!isSameDay(r['FECHA'], hoy)) return false;
    if (f.canal && r['CANAL FINAL'] !== f.canal) return false;
    if (f.tienda && r['TIENDA FINAL'] !== f.tienda) return false;
    if (f.vendedor && r['CODVENDENDOR'] !== f.vendedor) return false;
    if (f.familia && r['FAMILIA'] !== f.familia) return false;
    if (f.region && r['REGION'] !== f.region) return false;
    return true;
  });

  const totalHoy = rowsHoy.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const docsHoy = new Set(rowsHoy.map(r => r['FOLIO'])).size;
  const unidadesHoy = rowsHoy.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  document.getElementById('todayDateLabel').textContent =
    hoy.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('todayValue').textContent = formatCLP(totalHoy);

  const filtrosActivos = [];
  if (f.canal) filtrosActivos.push('Canal: ' + f.canal);
  if (f.tienda) filtrosActivos.push('Tienda: ' + f.tienda);
  const sufijoFiltro = filtrosActivos.length ? ' · ' + filtrosActivos.join(' · ') : ' · todos los canales y tiendas';

  document.getElementById('todaySub').textContent =
    `${formatNum(docsHoy)} documentos · ${formatNum(unidadesHoy)} unidades${sufijoFiltro}`;
}

// ---------- KPIs ----------
function renderKPIs() {
  const totalNeto = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const totalUtilidad = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);
  const unidades = filtered.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);
  const folios = new Set(filtered.map(r => r['FOLIO'])).size;
  const margen = totalNeto ? Math.round((totalUtilidad / totalNeto) * 100) : 0;
  const ticketProm = folios ? totalNeto / folios : 0;

  const kpis = [
    { label: 'Venta neta', value: formatCLP(totalNeto) },
    { label: 'Utilidad', value: formatCLP(totalUtilidad) },
    { label: 'Margen', value: margen + '%' },
    { label: 'Unidades vendidas', value: formatNum(unidades) },
    { label: 'Ticket promedio', value: formatCLP(ticketProm) },
    { label: 'Documentos', value: formatNum(folios) }
  ];

  document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}</div>
    </div>
  `).join('');
}

// ---------- Charts ----------
let chartMes, chartCanal, chartVendedor, chartFamilia;
const goldPalette = ['#E8A33D', '#D9694F', '#4FAE8C', '#7CA6C7', '#B57F2C', '#C4C7B8', '#8E7CC3', '#5B9BD5'];

function groupSum(field, valueField) {
  const map = {};
  filtered.forEach(r => {
    const key = r[field] || '(sin dato)';
    map[key] = (map[key] || 0) + (Number(r[valueField]) || 0);
  });
  return map;
}

function renderCharts() {
  // Venta neta por mes (orden cronológico usando AÑO + # MES)
  const mesMap = {};
  filtered.forEach(r => {
    const anio = r['AÑO'] || '';
    const mesNum = r['# MES'] || 0;
    const mesNombre = r['MES'] || '';
    const key = anio + '-' + String(mesNum).padStart(2, '0');
    if (!mesMap[key]) mesMap[key] = { label: mesNombre + ' ' + anio, total: 0, order: key };
    mesMap[key].total += Number(r['NETO']) || 0;
  });
  const mesesOrdenados = Object.values(mesMap).sort((a, b) => a.order.localeCompare(b.order));

  const ctxMes = document.getElementById('chartMes').getContext('2d');
  if (chartMes) chartMes.destroy();
  chartMes = new Chart(ctxMes, {
    type: 'line',
    data: {
      labels: mesesOrdenados.map(m => m.label),
      datasets: [{
        data: mesesOrdenados.map(m => m.total),
        borderColor: '#E8A33D',
        backgroundColor: 'rgba(232,163,61,0.15)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#EDEEE9' }, grid: { display: false } },
        y: { ticks: { color: '#EDEEE9' }, grid: { color: 'rgba(237,238,233,0.08)' } }
      }
    }
  });

  // Venta por canal
  const canalMap = groupSum('CANAL FINAL', 'NETO');
  const ctxCanal = document.getElementById('chartCanal').getContext('2d');
  if (chartCanal) chartCanal.destroy();
  chartCanal = new Chart(ctxCanal, {
    type: 'doughnut',
    data: {
      labels: Object.keys(canalMap),
      datasets: [{ data: Object.values(canalMap), backgroundColor: goldPalette }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: '#EDEEE9', boxWidth: 12 } } } }
  });

  // Top vendedores
  const vendMap = groupSum('CODVENDENDOR', 'NETO');
  const vendSorted = Object.entries(vendMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ctxVend = document.getElementById('chartVendedor').getContext('2d');
  if (chartVendedor) chartVendedor.destroy();
  chartVendedor = new Chart(ctxVend, {
    type: 'bar',
    data: {
      labels: vendSorted.map(v => v[0]),
      datasets: [{ data: vendSorted.map(v => v[1]), backgroundColor: '#4FAE8C', borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#EDEEE9' }, grid: { color: 'rgba(237,238,233,0.08)' } },
        y: { ticks: { color: '#EDEEE9' }, grid: { display: false } }
      }
    }
  });

  // Venta por familia
  const famMap = groupSum('FAMILIA', 'NETO');
  const famSorted = Object.entries(famMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ctxFam = document.getElementById('chartFamilia').getContext('2d');
  if (chartFamilia) chartFamilia.destroy();
  chartFamilia = new Chart(ctxFam, {
    type: 'bar',
    data: {
      labels: famSorted.map(v => v[0]),
      datasets: [{ data: famSorted.map(v => v[1]), backgroundColor: '#7CA6C7', borderRadius: 4 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#EDEEE9' }, grid: { display: false } },
        y: { ticks: { color: '#EDEEE9' }, grid: { color: 'rgba(237,238,233,0.08)' } }
      }
    }
  });
}

// ---------- Tabla + paginación ----------
function renderTable() {
  const body = document.getElementById('rowsTableBody');
  const empty = document.getElementById('emptyState');

  if (!filtered.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(r => `
    <tr data-row="${r['_row']}">
      <td>${r['FOLIO'] || ''}</td>
      <td>${toDateInputValue(r['FECHA'])}</td>
      <td>${r['CLIENTE'] || ''}</td>
      <td>${r['CODIGO'] || ''}</td>
      <td>${r['DESCRIPCION'] || ''}</td>
      <td>${formatNum(r['CANTFACTURADA'])}</td>
      <td>${formatCLP(r['NETO'])}</td>
      <td>${formatCLP(r['($) UTILIDAD'])}</td>
      <td>${r['CODVENDENDOR'] || ''}</td>
      <td>${r['TIENDA FINAL'] || ''}</td>
    </tr>
  `).join('');

  body.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => openModalForEdit(tr.dataset.row));
  });

  const pag = document.getElementById('pagination');
  pag.innerHTML = `
    <button id="prevPage" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
    <span>Página ${currentPage} de ${totalPages} · ${filtered.length} registros</span>
    <button id="nextPage" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
  `;
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage--; renderTable(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage++; renderTable(); });
}

const searchBox = document.getElementById('searchBox');
let searchDebounce;
searchBox.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyFilters, 250);
});

// ---------- Navegación ----------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});

// ---------- Modal ----------
const overlay = document.getElementById('modalOverlay');
const form = document.getElementById('rowForm');

const FIELD_MAP = [
  ['f-folio', 'FOLIO'], ['f-tipo', 'TIPO'], ['f-fecha', 'FECHA'], ['f-nvnumero', 'NVNUMERO'],
  ['f-codbode', 'CODBODE'], ['f-sistema', 'SISTEMA'], ['f-grupo', 'GRUPO'],
  ['f-codigo', 'CODIGO'], ['f-descripcion', 'DESCRIPCION'], ['f-familia', 'FAMILIA'],
  ['f-categoria', 'CATEGORIA'], ['f-linea', 'LINEA'], ['f-marca', 'MARCA'],
  ['f-cantfacturada', 'CANTFACTURADA'], ['f-preuni', 'PREUNI'], ['f-costos', 'COSTOS'],
  ['f-cliente', 'CLIENTE'], ['f-rut', 'RUT'], ['f-codvendedor', 'CODVENDENDOR'],
  ['f-canalfinal', 'CANAL FINAL'], ['f-tiendafinal', 'TIENDA FINAL'],
  ['f-comuna', 'COMUNA'], ['f-region', 'REGION'], ['f-glosa', 'GLOSA']
];

function openModalForNew() {
  document.getElementById('modalTitle').textContent = 'Nuevo registro';
  form.reset();
  document.getElementById('f-row').value = '';
  document.getElementById('deleteRowBtn').style.display = 'none';
  document.getElementById('f-fecha').value = new Date().toISOString().slice(0, 10);
  overlay.classList.add('active');
}

function openModalForEdit(rowId) {
  const r = rows.find(x => String(x['_row']) === String(rowId));
  if (!r) return;
  document.getElementById('modalTitle').textContent = 'Editar registro';
  document.getElementById('f-row').value = r['_row'];
  FIELD_MAP.forEach(([elId, field]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (field === 'FECHA') el.value = toDateInputValue(r[field]);
    else el.value = r[field] !== undefined && r[field] !== null ? r[field] : '';
  });
  document.getElementById('deleteRowBtn').style.display = 'inline-block';
  overlay.classList.add('active');
}

function closeModal() { overlay.classList.remove('active'); }

document.getElementById('newRowBtn').addEventListener('click', openModalForNew);
document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const rowId = document.getElementById('f-row').value;
  const data = {};
  FIELD_MAP.forEach(([elId, field]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    data[field] = el.value;
  });

  try {
    if (rowId) {
      await apiPost({ action: 'update', row: rowId, data });
      showToast('Registro actualizado');
    } else {
      await apiPost({ action: 'add', data });
      showToast('Registro creado');
    }
    closeModal();
    loadData(false);
  } catch (err) {
    showToast('Error al guardar: ' + err.message);
  }
});

document.getElementById('deleteRowBtn').addEventListener('click', async () => {
  const rowId = document.getElementById('f-row').value;
  if (!rowId) return;
  if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
  try {
    await apiPost({ action: 'delete', row: rowId });
    showToast('Registro eliminado');
    closeModal();
    loadData(false);
  } catch (err) {
    showToast('Error al eliminar: ' + err.message);
  }
});

// ---------- Refresh manual y automático ----------
document.getElementById('refreshBtn').addEventListener('click', () => loadData(true));

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadData(false), REFRESH_INTERVAL_MS);
}

// ---------- Init ----------
loadData(true);
startAutoRefresh();




function applyFtUrlImport() {
  if (!lastExtractedUrlData) return;

  const sku = document.getElementById('ftImportSku').value.trim();
  const desc = document.getElementById('ftImportNombre').value.trim();
  const precio = parseFloat(document.getElementById('ftImportPrecio').value) || 0;
  const cat = document.getElementById('ftImportCategoria').value.trim();
  const marca = document.getElementById('ftImportMarca').value.trim();
  const dim = document.getElementById('ftImportDimensiones').value.trim();
  const mat = document.getElementById('ftImportMaterial').value.trim();

  if (!sku || !desc) {
    showToast('El SKU y Nombre son obligatorios ⚠️');
    return;
  }

  const existing = ftProductsMap.get(sku) || {
    sku: sku,
    descripcion: desc,
    cantTotal: 10,
    netoTotal: precio * 10,
    utilidadTotal: precio * 4,
    margenPct: 40,
    precioPromedio: precio,
    costoUnitario: Math.round(precio * 0.6)
  };

  existing.descripcion = desc;
  existing.categoria = cat;
  existing.marca = marca;
  existing.precioPromedio = precio;

  ftProductsMap.set(sku, existing);

  saveFtSpecsForSku(sku, {
    dimensiones: dim,
    material: mat,
    notas: `Información importada desde ${lastExtractedUrlData.urlOriginal}. Verificada por Glomax BI.`
  });

  closeFtUrlModal();
  showToast(`🎉 Ficha Técnica importada y aplicada para SKU ${sku}!`);

  currentFtSelectedSku = sku;
  renderFichaTecnicaView();
}

function closeCotizacionModal() {
  const backdrop = document.getElementById('cotizacionModalBackdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  }
}

function closeFtCompareModal() {
  const modal = document.getElementById('ftCompareModal');
  if (modal) modal.classList.remove('show');
}

function closeFtEditModal() {
  const modal = document.getElementById('ftEditModal');
  if (modal) modal.classList.remove('show');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

function closeTargetModal() {
  const backdrop = document.getElementById('targetModalBackdrop');
  if (backdrop) backdrop.classList.remove('show');
}

function exportFtPdf() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona un producto primero para exportar su PDF ⚠️');
    return;
  }

  const content = document.getElementById('ftContentArea');
  if (!content) return;

  showToast('📄 Generando PDF de Ficha Técnica...');

  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Ficha_Tecnica_GLOMAX_${currentFtSelectedSku}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(content).save().then(() => {
      showToast('✅ Ficha Técnica descargada en PDF con éxito!');
    }).catch(err => {
      console.warn('html2pdf fallback to print:', err);
      window.print();
    });
  } else {
    window.print();
  }
}

function lookupProductBySku(skuInput) {
  const sku = String(skuInput || '').trim().toUpperCase();
  const container = document.getElementById('cotizImageContainer');
  const descInput = document.getElementById('cDescripcion');

  if (!sku) {
    if (container) {
      container.innerHTML = `
        <div class="cotiz-image-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>Ingresa un SKU para cargar la imagen</span>
        </div>
      `;
    }
    return;
  }

  let item = productImagesMap.get(sku);
  if (!item) {
    for (let [k, v] of productImagesMap.entries()) {
      if (k.startsWith(sku) || sku.startsWith(k)) {
        item = v;
        break;
      }
    }
  }

  if (item && item.url) {
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <img src="${item.url}" alt="${sku}" class="cotiz-sku-img" onerror="this.onerror=null; this.src='https://via.placeholder.com/180?text=No+Disponible';" />
          <span class="cotiz-sku-caption">SKU: ${sku}${item.desc ? ' — ' + item.desc.slice(0, 40) : ''}</span>
        </div>
      `;
    }
    if (descInput && item.desc && (!descInput.value || descInput.value === 'Nombre o descripción detallada' || descInput.value === 'Producto Cotizado')) {
      descInput.value = item.desc;
    }
  } else {
    if (container) {
      container.innerHTML = `
        <div class="cotiz-image-placeholder" style="color: #fbbf24;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Sin imagen para SKU: <strong>${sku}</strong></span>
        </div>
      `;
    }
  }
}

function openCotizacionModal() {
  const backdrop = document.getElementById('cotizacionModalBackdrop');
  if (!backdrop) return;

  const form = document.getElementById('cotizacionModalForm');
  if (form) form.reset();

  const titleEl = document.getElementById('cotizModalTitle');
  if (titleEl) titleEl.textContent = '📑 Nueva Cotización';

  // Generar Folio Automático
  const folioEl = document.getElementById('cFolio');
  if (folioEl) {
    const nextNum = Math.floor(Math.random() * 9000 + 1000);
    folioEl.value = `COT-2026-${nextNum}`;
  }

  // Fecha Emisión por defecto hoy
  const today = new Date().toISOString().split('T')[0];
  const fechaEl = document.getElementById('cFecha');
  if (fechaEl) fechaEl.value = today;

  // Validez 15 días
  const venc = new Date();
  venc.setDate(venc.getDate() + 15);
  const vencEl = document.getElementById('cVencimiento');
  if (vencEl) vencEl.value = venc.toISOString().split('T')[0];

  // Limpiar items y agregar 1 fila inicial
  const body = document.getElementById('cotizItemsBody');
  if (body) {
    body.innerHTML = '';
    addCotizItemRow();
  }

  backdrop.style.display = 'flex';
  backdrop.style.opacity = '1';
  backdrop.style.pointerEvents = 'auto';
}

function openFtCompareModal() {
  const selectA = document.getElementById('ftCompareSkuA');
  const selectB = document.getElementById('ftCompareSkuB');
  if (!selectA || !selectB) return;

  const prods = Array.from(ftProductsMap.values()).sort((a, b) => b.cantTotal - a.cantTotal);
  if (prods.length === 0) {
    showToast('No hay suficientes productos para comparar ⚠️');
    return;
  }

  let htmlA = '', htmlB = '';
  prods.forEach((p, idx) => {
    const selA = (currentFtSelectedSku ? p.sku === currentFtSelectedSku : idx === 0) ? 'selected' : '';
    const selB = (idx === 1 || (idx === 0 && prods.length === 1)) ? 'selected' : '';
    htmlA += `<option value="${p.sku}" ${selA}>${p.sku} | ${p.descripcion.substring(0, 35)}</option>`;
    htmlB += `<option value="${p.sku}" ${selB}>${p.sku} | ${p.descripcion.substring(0, 35)}</option>`;
  });

  selectA.innerHTML = htmlA;
  selectB.innerHTML = htmlB;

  renderFtComparison();

  const modal = document.getElementById('ftCompareModal');
  if (modal) modal.classList.add('show');
}

function openFtEditModal() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona un producto primero para editar su Ficha Técnica ⚠️');
    return;
  }
  const prod = ftProductsMap.get(currentFtSelectedSku);
  if (!prod) return;

  const spec = generateDefaultFtSpecs(prod);

  document.getElementById('ftEditSku').value = prod.sku;
  document.getElementById('ftEditModalTitle').textContent = `✏️ Editar Ficha Técnica: ${prod.sku}`;
  document.getElementById('ftEditModalSub').textContent = prod.descripcion;

  document.getElementById('ftEditDimensiones').value = spec.dimensiones;
  document.getElementById('ftEditPesoNeto').value = spec.pesoNeto;
  document.getElementById('ftEditPesoBruto').value = spec.pesoBruto;
  document.getElementById('ftEditVolumen').value = spec.volumen;
  document.getElementById('ftEditCajasPallet').value = spec.cajasPallet;
  document.getElementById('ftEditOrigen').value = spec.origen;

  document.getElementById('ftEditMaterial').value = spec.material;
  document.getElementById('ftEditAcabado').value = spec.acabado;
  document.getElementById('ftEditTempRango').value = spec.tempRango;
  document.getElementById('ftEditCertificaciones').value = spec.certificaciones;
  document.getElementById('ftEditGradoIP').value = spec.gradoIP;
  document.getElementById('ftEditElectrico').value = spec.electrico;

  document.getElementById('ftEditGarantia').value = spec.garantia;
  document.getElementById('ftEditHSCode').value = spec.hsCode;
  document.getElementById('ftEditNotas').value = spec.notas;

  const modal = document.getElementById('ftEditModal');
  if (modal) modal.classList.add('show');
}

function openFtUrlModal() {
  const modal = document.getElementById('ftUrlModal');
  if (modal) {
    document.getElementById('ftUrlForm').reset();
    document.getElementById('ftUrlLoader').style.display = 'none';
    document.getElementById('ftUrlPreviewArea').style.display = 'none';
    document.getElementById('ftApplyUrlBtn').style.display = 'none';
    modal.classList.add('show');
  }
}

function printFichaTecnica() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona una Ficha Técnica para imprimir ⚠️');
    return;
  }
  window.print();
}

function processFtUrlImport(e) {
  e.preventDefault();
  const urlInput = document.getElementById('ftUrlInput').value.trim();
  if (!urlInput) return;

  const loader = document.getElementById('ftUrlLoader');
  const previewArea = document.getElementById('ftUrlPreviewArea');
  const applyBtn = document.getElementById('ftApplyUrlBtn');

  loader.style.display = 'block';
  previewArea.style.display = 'none';
  applyBtn.style.display = 'none';

  setTimeout(() => {
    loader.style.display = 'none';

    let extractedSku = 'GLX-';
    let extractedTitle = 'Producto Glomax.cl';
    let extractedCategory = 'Equipamiento Comercial';
    let extractedBrand = 'Glomax S.A. Oficial';
    let extractedPrice = 49990;

    try {
      const urlObj = new URL(urlInput);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/').filter(p => p.length > 0);
      const slug = parts.length > 0 ? parts[parts.length - 1] : 'producto';

      const skuMatch = slug.match(/([a-zA-Z]{2,4}[-_\s]?\d{3,6})/);
      if (skuMatch) {
        extractedSku = skuMatch[1].toUpperCase().replace('_', '-');
      } else {
        extractedSku = 'GLX-' + Math.floor(1000 + Math.random() * 9000);
      }

      let cleanTitle = slug.replace(/[-_]/g, ' ')
                          .replace(/\b(producto|productos|item|glomax|cl|p)\b/gi, '')
                          .trim();
      if (cleanTitle.length > 3) {
        extractedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      } else {
        extractedTitle = `Producto Glomax SKU ${extractedSku}`;
      }

      if (slug.includes('silla') || slug.includes('mueble') || slug.includes('estante')) {
        extractedCategory = 'Muebles & Estructuras';
      } else if (slug.includes('motor') || slug.includes('bomba') || slug.includes('valvula')) {
        extractedCategory = 'Maquinaria & Equipos';
      } else if (slug.includes('cable') || slug.includes('panel') || slug.includes('luz')) {
        extractedCategory = 'Electricidad & Iluminación';
      }

      const existing = ftProductsMap.get(extractedSku);
      if (existing) {
        extractedTitle = existing.descripcion;
        extractedCategory = existing.categoria || extractedCategory;
        extractedBrand = existing.marca || extractedBrand;
        extractedPrice = existing.precioPromedio || extractedPrice;
      }
    } catch (err) {
      console.warn('URL parsing fallback:', err);
    }

    lastExtractedUrlData = {
      sku: extractedSku,
      descripcion: extractedTitle,
      categoria: extractedCategory,
      marca: extractedBrand,
      precio: extractedPrice,
      dimensiones: '480 x 320 x 240 mm',
      material: 'Acero Inoxidable AISI 304 / Polímeros Glomax',
      urlOriginal: urlInput
    };

    document.getElementById('ftImportSku').value = lastExtractedUrlData.sku;
    document.getElementById('ftImportNombre').value = lastExtractedUrlData.descripcion;
    document.getElementById('ftImportPrecio').value = lastExtractedUrlData.precio;
    document.getElementById('ftImportCategoria').value = lastExtractedUrlData.categoria;
    document.getElementById('ftImportMarca').value = lastExtractedUrlData.marca;
    document.getElementById('ftImportDimensiones').value = lastExtractedUrlData.dimensiones;
    document.getElementById('ftImportMaterial').value = lastExtractedUrlData.material;

    previewArea.style.display = 'block';
    applyBtn.style.display = 'inline-flex';

    showToast('✅ Información extraída de www.glomax.cl. Revisa y aplica.');
  }, 600);
}

async function refreshCotizacionesLive(silent = false) {
  if (isCotizSyncing) return;
  isCotizSyncing = true;

  const syncPill = document.getElementById('syncStatus');
  if (syncPill && !silent) {
    syncPill.innerHTML = `<span class="dot" style="background:#fbbf24;"></span> <span>Sincronizando Google Sheets...</span>`;
  }

  try {
    const loaded = await fetchCotizacionesData();
    if (loaded && loaded.length > 0) {
      cotizacionesRows = loaded;
      populateCotizFilterOptions();
      applyCotizacionesFilters();
    }
  } catch (err) {
    console.warn('Auto-sync error:', err);
  } finally {
    isCotizSyncing = false;
    if (syncPill) {
      const nowStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      syncPill.innerHTML = `<span class="dot" style="background:#10b981;"></span> <span>En vivo (${nowStr})</span>`;
    }
  }
}

function setProdChartMetric(metric) {
  prodChartMetric = metric;
  const qtyBtn = document.getElementById('prodChartMetricQtyBtn');
  const netoBtn = document.getElementById('prodChartMetricNetoBtn');

  if (qtyBtn && netoBtn) {
    qtyBtn.classList.toggle('active', metric === 'qty');
    netoBtn.classList.toggle('active', metric === 'neto');
  }

  if (currentProdSelectedSku && prodProductsMap.has(currentProdSelectedSku)) {
    renderProdYearlyChart(prodProductsMap.get(currentProdSelectedSku));
  }
}

function setProdProjPreset(qty) {
  const input = document.getElementById('prodProjQtyInput');
  if (input) {
    input.value = qty;
    updateProdProjection();
  }
}

function switchView(viewName) {
  document.querySelectorAll('.ax-nav__item[data-view]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const btn = document.querySelector(`.ax-nav__item[data-view="${viewName}"]`);
  const targetView = document.getElementById('view-' + viewName);
  if (btn) btn.classList.add('active');
  if (targetView) targetView.classList.add('active');
  AudioSynth.play('click');
}

function toggleCotizMobileFilters() {
  const controls = document.querySelector('#view-cotizaciones .filter-controls');
  const btn = document.getElementById('toggleCotizFiltersBtn');
  if (controls) {
    controls.classList.toggle('show-mobile');
    const isExpanded = controls.classList.contains('show-mobile');
    if (btn) {
      btn.classList.toggle('active', isExpanded);
      const span = btn.querySelector('span');
      if (span) span.textContent = isExpanded ? 'Filtros ▴' : 'Filtros ▾';
    }
  }
}

function toggleMobileFilters() {
  const controls = document.querySelector('.filter-controls');
  const btn = document.getElementById('toggleMobileFiltersBtn');
  if (controls) {
    controls.classList.toggle('show-mobile');
    const isExpanded = controls.classList.contains('show-mobile');
    if (btn) {
      btn.classList.toggle('active', isExpanded);
      const span = btn.querySelector('span');
      if (span) span.textContent = isExpanded ? 'Filtros ▴' : 'Filtros ▾';
    }
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (backdrop) backdrop.classList.toggle('active');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function updateImportPhotoPreview(url) {
  const previewBox = document.getElementById('ftImportPhotoPreview');
  if (!previewBox) return;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    previewBox.innerHTML = `
      <div style="background: rgba(6, 10, 19, 0.9); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 10px; padding: 10px; display: inline-block;">
        <img src="${url}" alt="Foto Producto" style="max-height: 150px; border-radius: 6px; display: block;" onerror="this.parentElement.innerHTML='<span style=\\'color:#f87171; font-size:0.75rem;\\'>⚠️ Imagen no disponible en esa URL</span>';" />
        <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700; margin-top: 4px; display: block;">📷 Fotografía Detectada</span>
      </div>
    `;
  } else {
    previewBox.innerHTML = '';
  }
}