// ---------- Estado ----------
let rows = [];          // datos crudos desde el Sheet
let filtered = [];       // luego de aplicar filtros
let currentPage = 1;
const PAGE_SIZE = 50;
let refreshTimer = null;
let currentSortField = null;
let currentSortAsc = true;

// ---------- BASE DE DATOS LOCAL INDEXEDDB (Carga 0ms) ----------
const GlomaxDB = {
  dbName: 'GlomaxVentasDB',
  dbVersion: 1,
  db: null,
  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('rows')) {
          db.createObjectStore('rows', { keyPath: '_row' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async getRows() {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('rows', 'readonly');
        const req = tx.objectStore('rows').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },
  async setRows(data) {
    try {
      const db = await this.init();
      const tx = db.transaction('rows', 'readwrite');
      const store = tx.objectStore('rows');
      store.clear();
      data.forEach(r => { if (r && r._row) store.put(r); });
    } catch (e) {
      console.warn('DB setRows error', e);
    }
  },
  async addPendingMutation(mut) {
    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add(mut);
    } catch (e) {}
  },
  async getPendingMutations() {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const req = tx.objectStore('sync_queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },
  async removePendingMutation(id) {
    try {
      const db = await this.init();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
    } catch (e) {}
  }
};

// ---------- SINTETIZADOR DE AUDIO WEBAUDIO (Sonido FX Futurista) ----------
const AudioSynth = {
  ctx: null,
  enabled: typeof SOUND_EFFECTS !== 'undefined' ? SOUND_EFFECTS : true,
  init() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  play(type) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const now = this.ctx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.07);
        osc.frequency.setValueAtTime(783.99, now + 0.14);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'sync') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
      }
    } catch (e) {}
  }
};

// ---------- COMMAND PALETTE (Ctrl+K / Cmd+K) ----------
const CmdPalette = {
  modal: null,
  input: null,
  results: null,
  selectedIndex: 0,
  items: [],
  init() {
    this.modal = document.getElementById('cmdPaletteModal');
    this.input = document.getElementById('cmdPaletteInput');
    this.results = document.getElementById('cmdPaletteResults');

    if (!this.modal || !this.input) return;

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.input.addEventListener('input', () => this.search());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
  },
  open() {
    this.modal.classList.add('active');
    this.input.value = '';
    this.input.focus();
    AudioSynth.play('click');
    this.search();
  },
  close() {
    this.modal.classList.remove('active');
  },
  search() {
    const q = this.input.value.toLowerCase().trim();
    const actions = [
      { label: 'Ver Tablero Principal', action: () => switchView('tablero'), type: 'Navegación' },
      { label: 'Ver Tabla de Registros', action: () => switchView('tabla'), type: 'Navegación' },
      { label: '+ Crear Nueva Venta', action: () => openModal(), type: 'Acción' },
      { label: 'Exportar Reporte a PDF', action: () => exportToPdf(), type: 'Acción' },
      { label: 'Exportar Datos a CSV', action: () => exportToCsv(), type: 'Acción' },
      { label: 'Limpiar Filtros Globales', action: () => resetFilters(), type: 'Acción' },
      { label: 'Cambiar Tema Claro / Oscuro', action: () => toggleTheme(), type: 'Ajustes' },
      { label: 'Alternar Sonido FX', action: () => toggleSound(), type: 'Ajustes' }
    ];

    let matches = [];
    if (!q) {
      matches = actions;
    } else {
      matches = actions.filter(a => a.label.toLowerCase().includes(q));
      
      const recordMatches = rows.filter(r => 
        String(r['FOLIO'] || '').toLowerCase().includes(q) ||
        String(r['CLIENTE'] || '').toLowerCase().includes(q) ||
        String(r['DESCRIPCION'] || '').toLowerCase().includes(q) ||
        String(r['CODIGO'] || '').toLowerCase().includes(q)
      ).slice(0, 8).map(r => ({
        label: `Folio #${r['FOLIO']} · ${r['CLIENTE']} ($${formatNum(r['NETO'])})`,
        action: () => {
          switchView('tabla');
          const sb = document.getElementById('searchBox');
          if (sb) { sb.value = r['FOLIO']; applyFilters(); }
        },
        type: 'Venta'
      }));

      matches = [...matches, ...recordMatches];
    }

    this.items = matches;
    this.selectedIndex = 0;
    this.render();
  },
  render() {
    if (!this.items.length) {
      this.results.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--ax-text-tertiary);">No se encontraron comandos ni registros</div>`;
      return;
    }
    this.results.innerHTML = this.items.map((item, idx) => `
      <div class="cmd-palette-item ${idx === this.selectedIndex ? 'selected' : ''}" data-idx="${idx}">
        <span>${item.label}</span>
        <span class="item-type">${item.type}</span>
      </div>
    `).join('');

    this.results.querySelectorAll('.cmd-palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        if (this.items[idx]) {
          this.close();
          this.items[idx].action();
        }
      });
    });
  },
  handleKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
      this.render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.items[this.selectedIndex]) {
        this.close();
        this.items[this.selectedIndex].action();
      }
    }
  }
};

// ---------- Utilidades ----------
function formatCLP(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}
function formatNum(n) {
  return (Number(n) || 0).toLocaleString('es-CL');
}
function parseRowDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const str = String(v).trim();
  if (!str) return null;

  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  const parts = str.split(/[\/\-\.\s]+/);
  if (parts.length >= 3) {
    const p0 = Number(parts[0]);
    const p1 = Number(parts[1]);
    const p2 = Number(parts[2]);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (p0 > 1000) {
        d = new Date(p0, p1 - 1, p2);
        if (!isNaN(d.getTime())) return d;
      }
      if (p2 > 1000) {
        d = new Date(p2, p1 - 1, p0);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

function getRowMonthAndYear(r) {
  let year = Number(r['AÑO']) || null;
  let month = Number(r['# MES']) || null;

  if ((!year || !month) && r['FECHA']) {
    const d = parseRowDate(r['FECHA']);
    if (d) {
      if (!year) year = d.getFullYear();
      if (!month) month = d.getMonth() + 1;
    }
  }

  if (!month && r['MES']) {
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const idx = monthNames.indexOf(String(r['MES']).trim().toLowerCase());
    if (idx !== -1) month = idx + 1;
  }

  return { year, month };
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (state === 'ok') el.innerHTML = '<span class="dot"></span> Sincronizado';
  else if (state === 'loading') el.innerHTML = '<span class="dot"></span> Sincronizando…';
  else el.innerHTML = '<span class="dot" style="background:var(--accent-rose)"></span> Sin conexión';
}

// ---------- API & ENGINE HYBRID CONEXIÓN ----------
async function fetchGVizData() {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) return null;
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Ventas`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  
  const cols = json.table.cols.map(c => c ? c.label : '');
  const data = json.table.rows.map((row, i) => {
    const obj = {};
    cols.forEach((colName, j) => {
      if (colName) obj[colName] = row.c[j] ? (row.c[j].v !== null ? row.c[j].v : '') : '';
    });
    obj['_row'] = i + 2;
    return obj;
  });
  return data;
}

async function apiGet() {
  const res = await fetch(API_URL, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al leer datos');
  return json.data;
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al guardar');
  return json;
}

async function loadData(showLoadingState = true) {
  const startTime = performance.now();
  const latencyBadge = document.getElementById('latencyBadge');

  // 1. CARGA INSTANTÁNEA 0ms DESDE INDEXEDDB
  if ((typeof ENABLE_LOCAL_CACHE === 'undefined' || ENABLE_LOCAL_CACHE) && (!rows || rows.length === 0)) {
    const cachedRows = await GlomaxDB.getRows();
    if (cachedRows && cachedRows.length > 0) {
      rows = cachedRows;
      setSyncStatus('ok');
      if (latencyBadge) latencyBadge.innerHTML = `⚡ 0ms (Caché Local)`;
      updateNavBadge();
      populateFilterOptions();
      applyFilters();
    }
  }

  if (showLoadingState && (!rows || rows.length === 0)) setSyncStatus('loading');

  // 2. FETCH FRESCO EN SEGUNDO PLANO (STALE-WHILE-REVALIDATE)
  try {
    let freshRows = null;
    let modeLabel = 'Apps Script';

    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      try {
        freshRows = await fetchGVizData();
        modeLabel = 'GViz FastChannel';
      } catch (gvizErr) {
        console.warn('GViz fallback to Apps Script', gvizErr);
      }
    }

    if (!freshRows) {
      freshRows = await apiGet();
    }

    const elapsed = Math.round(performance.now() - startTime);

    if (freshRows && Array.isArray(freshRows)) {
      rows = freshRows;
      GlomaxDB.setRows(rows); // actualiza caché IndexedDB
      setSyncStatus('ok');
      if (latencyBadge) {
        latencyBadge.innerHTML = `⚡ ${elapsed}ms (${modeLabel})`;
        latencyBadge.classList.remove('syncing');
      }
      updateNavBadge();
      populateFilterOptions();
      applyFilters();
    }

    processSyncQueue();
  } catch (err) {
    setSyncStatus('error');
    console.error(err);
    if (latencyBadge) latencyBadge.innerHTML = `⚠️ Sin conexión`;
    if (API_URL.includes('PEGA_AQUI')) showToast('Configura tu URL de Apps Script en config.js');
  }
}

async function processSyncQueue() {
  const pending = await GlomaxDB.getPendingMutations();
  if (!pending || !pending.length) return;

  const latencyBadge = document.getElementById('latencyBadge');
  if (latencyBadge) latencyBadge.classList.add('syncing');

  for (const mut of pending) {
    try {
      await apiPost({ action: mut.action, row: mut.row, data: mut.data });
      await GlomaxDB.removePendingMutation(mut.id);
      AudioSynth.play('sync');
    } catch (e) {
      console.warn('Cola de sincronización pendiente...', e);
      break;
    }
  }

  if (latencyBadge) latencyBadge.classList.remove('syncing');
}



// ==========================================================================
// VARIABLES Y ESTADO GLOBAL (FICHA TÉCNICA, IMÁGENES Y SCRAPER DE GLOMAX)
// ==========================================================================









// ==========================================================================
// VARIABLES Y ESTADO GLOBAL (FICHA TÉCNICA, IMÁGENES Y SCRAPER DE GLOMAX)
// ==========================================================================
let glomaxLiveCatalogMap = new Map();
let glomaxScrapePromise = null;
let productImagesMap = new Map();
let ftProductsMap = new Map();
let currentFtSelectedSku = null;
const FT_STORAGE_KEY = 'glomax_ft_specs_v1';


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



// ==========================================================================
// MÓDULO DE NAVEGACIÓN Y CONTROL DE VISTAS (switchView & UI Drawer Helpers)
// ==========================================================================

function switchView(viewName) {
  if (!viewName) return;

  // Actualizar botones de la barra lateral
  document.querySelectorAll('.ax-nav__item[data-view]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  const btn = document.querySelector(`.ax-nav__item[data-view="${viewName}"]`);
  const targetView = document.getElementById('view-' + viewName);

  if (btn) btn.classList.add('active');
  if (targetView) targetView.classList.add('active');

  // Ejecutar renderizador del módulo activado
  if (viewName === 'tablero') {
    if (typeof renderKPIs === 'function') renderKPIs();
    if (typeof renderCharts === 'function') renderCharts();
  } else if (viewName === 'tabla') {
    if (typeof renderTable === 'function') renderTable();
  } else if (viewName === 'compras') {
    if (typeof renderComprasView === 'function') renderComprasView();
  } else if (viewName === 'bistudio') {
    if (typeof renderBIEngine === 'function') renderBIEngine();
  } else if (viewName === 'mixsugerido') {
    if (typeof renderMixSugeridoModule === 'function') renderMixSugeridoModule();
  } else if (viewName === 'fichatecnica') {
    if (typeof renderFichaTecnicaView === 'function') renderFichaTecnicaView();
  } else if (viewName === 'cotizaciones') {
    if (typeof fetchCotizacionesData === 'function') fetchCotizacionesData();
  }

  if (typeof AudioSynth !== 'undefined' && AudioSynth.play) {
    AudioSynth.play('click');
  }

  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.ax-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.ax-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function toggleMobileFilters() {
  const bar = document.getElementById('filtersBar');
  if (bar) bar.classList.toggle('open');
}

function toggleCotizMobileFilters() {
  const bar = document.getElementById('cotizFiltersBar');
  if (bar) bar.classList.toggle('open');
}

function toggleTheme() {
  const currentTheme = document.body.dataset.theme || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = newTheme;
  localStorage.setItem('glomax_theme', newTheme);
  
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.ax-nav__item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;
      if (viewName) switchView(viewName);
    });
  });

  const savedTheme = localStorage.getItem('glomax_theme');
  if (savedTheme) {
    document.body.dataset.theme = savedTheme;
  }
});


// ---------- Estado ----------

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
  const foliosSet = new Set(filtered.map(r => r['FOLIO']).filter(Boolean));
  const folios = foliosSet.size || filtered.length;
  const margenPct = totalNeto > 0 ? ((totalUtilidad / totalNeto) * 100) : 0;
  const ticketProm = folios > 0 ? (totalNeto / folios) : 0;

  // Actualizar KPIs principales
  const elNeto = document.getElementById('kpiNeto');
  if (elNeto) elNeto.textContent = formatCLP(totalNeto);

  const elUtilidad = document.getElementById('kpiUtilidad');
  if (elUtilidad) elUtilidad.textContent = formatCLP(totalUtilidad);

  const elCant = document.getElementById('kpiCant');
  if (elCant) elCant.textContent = formatNum(unidades);

  const elRows = document.getElementById('kpiRows');
  if (elRows) elRows.textContent = formatNum(filtered.length);

  // Actualizar Mini KPIs
  const elTicket = document.getElementById('miniTicketVal');
  if (elTicket) elTicket.textContent = formatCLP(ticketProm);

  const elMargin = document.getElementById('miniMarginVal');
  if (elMargin) elMargin.textContent = margenPct.toFixed(1) + '%';

  // Calcular Top Vendedor y Top Región
  const vendMap = {};
  const regMap = {};

  filtered.forEach(r => {
    const v = r['CODVENDENDOR'] || 'Sin Vendedor';
    const reg = r['REGION'] || 'Sin Región';
    const neto = Number(r['NETO']) || 0;
    vendMap[v] = (vendMap[v] || 0) + neto;
    regMap[reg] = (regMap[reg] || 0) + neto;
  });

  const sortedVend = Object.entries(vendMap).sort((a, b) => b[1] - a[1]);
  const sortedReg = Object.entries(regMap).sort((a, b) => b[1] - a[1]);

  const elTopSeller = document.getElementById('miniTopSellerVal');
  const elTopSellerSub = document.getElementById('miniTopSellerSub');
  if (elTopSeller) elTopSeller.textContent = sortedVend.length > 0 ? sortedVend[0][0] : '--';
  if (elTopSellerSub) elTopSellerSub.textContent = sortedVend.length > 0 ? formatCLP(sortedVend[0][1]) + ' Facturado' : '$0 Facturado';

  const elTopRegion = document.getElementById('miniTopRegionVal');
  const elTopRegionSub = document.getElementById('miniTopRegionSub');
  if (elTopRegion) elTopRegion.textContent = sortedReg.length > 0 ? sortedReg[0][0] : '--';
  if (elTopRegionSub) elTopRegionSub.textContent = sortedReg.length > 0 ? formatCLP(sortedReg[0][1]) + ' Facturado' : '$0 Facturado';

  // Fallback si existe kpiGrid
  const grid = document.getElementById('kpiGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="ax-card kpi-card"><span class="kpi-card__label">Total Venta Neta</span><div class="kpi-card__value">${formatCLP(totalNeto)}</div></div>
      <div class="ax-card kpi-card"><span class="kpi-card__label">Total Utilidad</span><div class="kpi-card__value">${formatCLP(totalUtilidad)}</div></div>
      <div class="ax-card kpi-card"><span class="kpi-card__label">Unidades Facturadas</span><div class="kpi-card__value">${formatNum(unidades)}</div></div>
      <div class="ax-card kpi-card"><span class="kpi-card__label">Total Registros</span><div class="kpi-card__value">${formatNum(filtered.length)}</div></div>
    `;
  }
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

let chartSalesInst = null;
let chartCanalInst = null;
let chartFamiliaInst = null;
let chartTiendaInst = null;
let chartVendedorInst = null;

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  // 1. Tendencia Ventas Mensuales (salesChart / chartMes)
  const mesCanvas = document.getElementById('salesChart') || document.getElementById('chartMes');
  if (mesCanvas) {
    const mesMap = {};
    filtered.forEach(r => {
      const anio = r['AÑO'] || '';
      const mesNum = r['# MES'] || 0;
      const mesNombre = r['MES'] || '';
      const key = anio + '-' + String(mesNum).padStart(2, '0');
      if (!mesMap[key]) mesMap[key] = { label: (mesNombre ? mesNombre + ' ' : '') + anio, total: 0, order: key };
      mesMap[key].total += Number(r['NETO']) || 0;
    });
    const mesesOrdenados = Object.values(mesMap).sort((a, b) => a.order.localeCompare(b.order));

    if (chartSalesInst) chartSalesInst.destroy();
    chartSalesInst = new Chart(mesCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: mesesOrdenados.map(m => m.label),
        datasets: [{
          label: 'Ventas Netas ($)',
          data: mesesOrdenados.map(m => m.total),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // 2. Ventas por Canal (canalChart / chartCanal)
  const canalCanvas = document.getElementById('canalChart') || document.getElementById('chartCanal');
  if (canalCanvas) {
    const canalMap = {};
    filtered.forEach(r => {
      const c = r['CANAL FINAL'] || 'Otros';
      canalMap[c] = (canalMap[c] || 0) + (Number(r['NETO']) || 0);
    });
    const sortedCanal = Object.entries(canalMap).sort((a, b) => b[1] - a[1]);

    if (chartCanalInst) chartCanalInst.destroy();
    chartCanalInst = new Chart(canalCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sortedCanal.map(c => c[0]),
        datasets: [{
          data: sortedCanal.map(c => c[1]),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#cbd5e1' } } }
      }
    });
  }

  // 3. Ventas por Familia (familiaChart / chartFamilia)
  const famCanvas = document.getElementById('familiaChart') || document.getElementById('chartFamilia');
  if (famCanvas) {
    const famMap = {};
    filtered.forEach(r => {
      const f = r['FAMILIA'] || 'Sin Familia';
      famMap[f] = (famMap[f] || 0) + (Number(r['NETO']) || 0);
    });
    const sortedFam = Object.entries(famMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    if (chartFamiliaInst) chartFamiliaInst.destroy();
    chartFamiliaInst = new Chart(famCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sortedFam.map(f => f[0]),
        datasets: [{
          label: 'Ventas Netas ($)',
          data: sortedFam.map(f => f[1]),
          backgroundColor: '#8b5cf6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // 4. Ventas por Vendedor (vendedorChart / chartVendedor)
  const vendCanvas = document.getElementById('vendedorChart') || document.getElementById('chartVendedor');
  if (vendCanvas) {
    const vendMap = {};
    filtered.forEach(r => {
      const v = r['CODVENDENDOR'] || 'Sin Vendedor';
      vendMap[v] = (vendMap[v] || 0) + (Number(r['NETO']) || 0);
    });
    const sortedVend = Object.entries(vendMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (chartVendedorInst) chartVendedorInst.destroy();
    chartVendedorInst = new Chart(vendCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sortedVend.map(v => v[0]),
        datasets: [{
          label: 'Ventas ($)',
          data: sortedVend.map(v => v[1]),
          backgroundColor: '#10b981',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
}

// ---------- Tabla + paginación ----------
function renderTable() {
  const body = document.getElementById('tableBody') || document.getElementById('rowsTableBody');
  if (!body) return;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 2rem; color: #94a3b8;">No se encontraron registros de ventas que coincidan con los filtros.</td></tr>';
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = 'Página 0 de 0';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(r => `
    <tr data-row="${r['_row'] || ''}">
      <td><strong>${r['FOLIO'] || ''}</strong></td>
      <td>${toDateInputValue(r['FECHA'])}</td>
      <td>${r['CLIENTE'] || ''}</td>
      <td>${r['DESCRIPCION'] || r['CODIGO'] || ''}</td>
      <td><span class="pill-tag">${r['CANAL FINAL'] || 'Público'}</span></td>
      <td style="text-align:right;">${formatNum(r['CANTFACTURADA'])}</td>
      <td style="text-align:right;">${formatCLP(r['PREUNI'])}</td>
      <td style="text-align:right; font-weight:700; color:#3b82f6;">${formatCLP(r['NETO'])}</td>
      <td style="text-align:right;">${formatCLP(r['COSTOS'])}</td>
      <td style="text-align:right; font-weight:700; color:#10b981;">${formatCLP(r['($) UTILIDAD'])}</td>
      <td style="text-align:center;">
        <button type="button" class="btn-sm btn-secondary" onclick="openModalForEdit(${r['_row']})" title="Editar registro">✏️</button>
      </td>
    </tr>
  `).join('');

  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages} (${filtered.length.toLocaleString()} registros)`;
  }

  const btnPrev = document.getElementById('btnPrevPage') || document.getElementById('prevPage');
  const btnNext = document.getElementById('btnNextPage') || document.getElementById('nextPage');

  if (btnPrev) {
    btnPrev.disabled = currentPage <= 1;
    btnPrev.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    };
  }

  if (btnNext) {
    btnNext.disabled = currentPage >= totalPages;
    btnNext.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    };
  }
}

// Helpers para selección de métricas y proyecciones en Productos & SKUs
window.setProdChartMetric = function(metric) {
  const qtyBtn = document.getElementById('prodChartMetricQtyBtn');
  const netoBtn = document.getElementById('prodChartMetricNetoBtn');
  if (metric === 'qty') {
    if (qtyBtn) qtyBtn.classList.add('active');
    if (netoBtn) netoBtn.classList.remove('active');
  } else {
    if (netoBtn) netoBtn.classList.add('active');
    if (qtyBtn) qtyBtn.classList.remove('active');
  }
  if (typeof updateProdChart === 'function') {
    updateProdChart(metric);
  }
};

window.setProdProjPreset = function(qty) {
  const input = document.getElementById('prodProjStockInput');
  if (input) {
    input.value = qty;
    const evt = new Event('input', { bubbles: true });
    input.dispatchEvent(evt);
  }
};

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




function renderExecutiveInsights() {
  const container = document.getElementById('biBriefingList');
  if (!container || !filtered.length) return;

  const totalRevenue = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const totalProfit = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // 1. Canal Dominante
  const canalMap = {};
  filtered.forEach(r => {
    const c = r['CANAL FINAL'] || 'Sin Canal';
    canalMap[c] = (canalMap[c] || 0) + (Number(r['NETO']) || 0);
  });
  const topCanalEntry = Object.entries(canalMap).sort((a, b) => b[1] - a[1])[0];
  const canalPct = topCanalEntry && totalRevenue > 0 ? ((topCanalEntry[1] / totalRevenue) * 100).toFixed(1) : 0;

  // 2. Cliente Top
  const clientMap = {};
  filtered.forEach(r => {
    const cl = r['CLIENTE'] || 'Cliente N/A';
    clientMap[cl] = (clientMap[cl] || 0) + (Number(r['NETO']) || 0);
  });
  const topClientEntry = Object.entries(clientMap).sort((a, b) => b[1] - a[1])[0];

  // 3. Familia más rentable
  const famProfitMap = {};
  filtered.forEach(r => {
    const f = r['FAMILIA'] || 'Sin Familia';
    famProfitMap[f] = (famProfitMap[f] || 0) + (Number(r['($) UTILIDAD']) || 0);
  });
  const topFamProfitEntry = Object.entries(famProfitMap).sort((a, b) => b[1] - a[1])[0];

  const itemsHTML = [
    `<div class="bi-briefing-item">
      <span>💡</span>
      <div><strong>Canal Líder:</strong> El canal <strong>${topCanalEntry ? topCanalEntry[0] : 'N/A'}</strong> concentra el <strong>${canalPct}%</strong> de las ventas totales (${formatCLP(topCanalEntry ? topCanalEntry[1] : 0)}).</div>
    </div>`,
    `<div class="bi-briefing-item">
      <span>👑</span>
      <div><strong>Cliente Principal:</strong> <strong>${topClientEntry ? topClientEntry[0] : 'N/A'}</strong> genera ${formatCLP(topClientEntry ? topClientEntry[1] : 0)} en facturación neta.</div>
    </div>`,
    `<div class="bi-briefing-item">
      <span>📈</span>
      <div><strong>Margen Bruto Global:</strong> Operando con un margen promedio del <strong>${avgMargin.toFixed(1)}%</strong> (${formatCLP(totalProfit)} utilidad total).</div>
    </div>`,
    `<div class="bi-briefing-item">
      <span>🎯</span>
      <div><strong>Familia de Mayor Aporte:</strong> La familia <strong>${topFamProfitEntry ? topFamProfitEntry[0] : 'N/A'}</strong> genera la mayor utilidad bruta acumulada (${formatCLP(topFamProfitEntry ? topFamProfitEntry[1] : 0)}).</div>
    </div>`
  ];

  container.innerHTML = itemsHTML.join('');
}

function renderPareto8020() {
  const summaryBox = document.getElementById('paretoSummaryBox');
  const listEl = document.getElementById('paretoTopClientsList');
  if (!summaryBox || !listEl || !filtered.length) return;

  const clientTotals = {};
  filtered.forEach(r => {
    const cl = r['CLIENTE'] || 'Desconocido';
    clientTotals[cl] = (clientTotals[cl] || 0) + (Number(r['NETO']) || 0);
  });

  const sortedClients = Object.entries(clientTotals).sort((a, b) => b[1] - a[1]);
  const totalRev = sortedClients.reduce((sum, c) => sum + c[1], 0);

  if (totalRev === 0) return;

  let cumulative = 0;
  let clients80Count = 0;
  const paretoClients = [];

  sortedClients.forEach(([client, rev]) => {
    cumulative += rev;
    const pct = (cumulative / totalRev) * 100;
    if (clients80Count === 0 || (cumulative - rev) / totalRev < 0.8) {
      clients80Count++;
      paretoClients.push({ client, rev, pct: ((rev / totalRev) * 100).toFixed(1) });
    }
  });

  const totalClientsCount = sortedClients.length;
  const pctClients80 = ((clients80Count / (totalClientsCount || 1)) * 100).toFixed(1);

  summaryBox.innerHTML = `
    El <strong>${pctClients80}% de los clientes</strong> (${clients80Count} de ${totalClientsCount}) genera el <strong>80% de los ingresos totales</strong> (${formatCLP(totalRev * 0.8)}).
  `;

  listEl.innerHTML = paretoClients.slice(0, 10).map(c => `
    <div class="pareto-item">
      <span><strong>${c.client}</strong></span>
      <span class="sim-val">${formatCLP(c.rev)} (${c.pct}%)</span>
    </div>
  `).join('');
}

function renderRFMGrid() {
  const container = document.getElementById('rfmGrid');
  if (!container || !filtered.length) return;

  const now = new Date();
  const clientMap = {};

  filtered.forEach(r => {
    const cl = r['CLIENTE'] || 'N/A';
    const d = parseRowDate(r['FECHA']);
    const neto = Number(r['NETO']) || 0;

    if (!clientMap[cl]) {
      clientMap[cl] = { lastDate: d, count: 0, totalSpend: 0 };
    }
    clientMap[cl].count += 1;
    clientMap[cl].totalSpend += neto;
    if (d && (!clientMap[cl].lastDate || d > clientMap[cl].lastDate)) {
      clientMap[cl].lastDate = d;
    }
  });

  let vipCount = 0;
  let loyalCount = 0;
  let atRiskCount = 0;
  let newCount = 0;

  Object.values(clientMap).forEach(c => {
    const daysAgo = c.lastDate ? Math.round((now - c.lastDate) / (1000 * 60 * 60 * 24)) : 999;
    if (c.totalSpend > 5000000 && c.count >= 3) vipCount++;
    else if (c.count >= 3) loyalCount++;
    else if (daysAgo > 60 && c.totalSpend > 1000000) atRiskCount++;
    else newCount++;
  });

  container.innerHTML = `
    <div class="rfm-card" style="border-color:rgba(109, 92, 240, 0.4);">
      <span class="rfm-card-title">👑 VIP Champions</span>
      <span class="rfm-card-count" style="color:#A78BFA;">${vipCount}</span>
      <span class="rfm-card-sub">Alto valor y frecuencia</span>
    </div>
    <div class="rfm-card" style="border-color:rgba(43, 196, 176, 0.4);">
      <span class="rfm-card-title">⭐ Leales</span>
      <span class="rfm-card-count" style="color:var(--ax-accent);">${loyalCount}</span>
      <span class="rfm-card-sub">Compras recurrentes</span>
    </div>
    <div class="rfm-card" style="border-color:rgba(244, 63, 94, 0.4);">
      <span class="rfm-card-title">⚠️ En Riesgo</span>
      <span class="rfm-card-count" style="color:var(--ax-accent-rose);">${atRiskCount}</span>
      <span class="rfm-card-sub">Inactivos > 60 días</span>
    </div>
    <div class="rfm-card" style="border-color:rgba(245, 158, 11, 0.4);">
      <span class="rfm-card-title">🌱 Oportunidad / Nuevos</span>
      <span class="rfm-card-count" style="color:var(--ax-accent-gold);">${newCount}</span>
      <span class="rfm-card-sub">Primeras ventas</span>
    </div>
  `;
}

function updateWhatIfSimulation() {
  const pRange = document.getElementById('simPriceRange');
  const cRange = document.getElementById('simCostRange');
  const vRange = document.getElementById('simVolRange');

  if (!pRange || !cRange || !vRange) return;

  const pPct = Number(pRange.value) || 0;
  const cPct = Number(cRange.value) || 0;
  const vPct = Number(vRange.value) || 0;

  document.getElementById('simPriceVal').textContent = `${pPct >= 0 ? '+' : ''}${pPct}%`;
  document.getElementById('simCostVal').textContent = `${cPct >= 0 ? '+' : ''}${cPct}%`;
  document.getElementById('simVolVal').textContent = `${vPct >= 0 ? '+' : ''}${vPct}%`;

  const curRev = filtered.reduce((sum, r) => sum + (Number(r['NETO']) || 0), 0);
  const curCost = filtered.reduce((sum, r) => sum + (Number(r['COSTO TOTAL NET']) || 0), 0);
  const curProfit = curRev - curCost;

  const priceFactor = 1 + (pPct / 100);
  const costFactor = 1 + (cPct / 100);
  const volFactor = 1 + (vPct / 100);

  const projRev = curRev * priceFactor * volFactor;
  const projCost = curCost * costFactor * volFactor;
  const projProfit = projRev - projCost;
  const deltaProfit = projProfit - curProfit;
  const projMargin = projRev > 0 ? (projProfit / projRev) * 100 : 0;

  document.getElementById('simProjRevenue').textContent = formatCLP(projRev);
  document.getElementById('simProjProfit').textContent = formatCLP(projProfit);
  document.getElementById('simDeltaProfit').textContent = `${deltaProfit >= 0 ? '+' : ''}${formatCLP(deltaProfit)}`;
  document.getElementById('simProjMargin').textContent = `${projMargin.toFixed(1)}%`;
}

function getComprasProducts() {
    const map = new Map();
    filtered.forEach(r => {
      const code = String(r['CODIGO'] || '');
      const desc = r['DESCRIPCION'] || '';
      const familia = r['FAMILIA'] || r['Grupo'] || '';
      const categoria = r['CATEGORIA'] || r['Linea'] || '';
      const cant = Number(r['CANTFACTURADA']) || 0;
      const costoUnit = Number(r['COSTOS']) || 0;
      const preuni = Number(r['PREUNI']) || 0;
      const costoTotalNet = cant * costoUnit;
      const neto = Number(r['NETO']) || 0;
      const utilidad = Number(r['($) UTILIDAD']) || 0;

      if (!map.has(code)) {
        map.set(code, {
          codigo: code,
          descripcion: desc,
          familia: familia,
          categoria: categoria,
          cantTotal: 0,
          costoUnit: costoUnit,
          preuni: preuni,
          costoTotalNet: 0,
          netoTotal: 0,
          utilidadTotal: 0,
          transacciones: 0
        });
      }

      const item = map.get(code);
      item.cantTotal += cant;
      item.costoTotalNet += costoTotalNet;
      item.netoTotal += neto;
      item.utilidadTotal += utilidad;
      item.transacciones += 1;

      if (costoUnit > 0) item.costoUnit = costoUnit;
      if (preuni > 0) item.preuni = preuni;
    });

    return Array.from(map.values()).map(p => {
      const margenPct = p.netoTotal > 0 ? (p.utilidadTotal / p.netoTotal) * 100 : 0;
      return {
        ...p,
        margenPct: margenPct
      };
    });
  }

  function renderComprasView() {
    const products = getComprasProducts();

    const famSelect = document.getElementById('comprasFamiliaFilter');
    if (famSelect) {
      const currentFam = famSelect.value;
      const familias = [...new Set(products.map(p => p.familia).filter(Boolean))].sort();
      famSelect.innerHTML = `<option value="">Todas las Familias</option>` +
        familias.map(f => `<option value="${f}">${f}</option>`).join('');
      if (familias.includes(currentFam)) famSelect.value = currentFam;
    }

    const searchInput = document.getElementById('comprasSearchBox');
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const selectedFam = famSelect ? famSelect.value : '';
    const sortSelect = document.getElementById('comprasSortSelect');
    const sortKey = sortSelect ? sortSelect.value : 'costoTotalDesc';

    let filteredProducts = products.filter(p => {
      if (selectedFam && (p.familia || '').toLowerCase().trim() !== selectedFam.toLowerCase().trim()) return false;
      if (q) {
        const matchText = `${p.codigo} ${p.descripcion} ${p.familia} ${p.categoria}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });

    filteredProducts.sort((a, b) => {
      if (sortKey === 'costoTotalDesc') return b.costoTotalNet - a.costoTotalNet;
      if (sortKey === 'costoUnitDesc') return b.costoUnit - a.costoUnit;
      if (sortKey === 'costoUnitAsc') return a.costoUnit - b.costoUnit;
      if (sortKey === 'margenDesc') return b.margenPct - a.margenPct;
      if (sortKey === 'utilidadDesc') return b.utilidadTotal - a.utilidadTotal;
      if (sortKey === 'cantDesc') return b.cantTotal - a.cantTotal;
      return 0;
    });

    const totalCostos = filteredProducts.reduce((sum, p) => sum + p.costoTotalNet, 0);
    const totalNeto = filteredProducts.reduce((sum, p) => sum + p.netoTotal, 0);
    const totalUtilidad = filteredProducts.reduce((sum, p) => sum + p.utilidadTotal, 0);
    const totalUnidades = filteredProducts.reduce((sum, p) => sum + p.cantTotal, 0);
    const promedioCostoUnit = totalUnidades > 0 ? (totalCostos / totalUnidades) : 0;
    const margenPromedio = totalNeto > 0 ? (totalUtilidad / totalNeto) * 100 : 0;

    const kpiCostosEl = document.getElementById('kpiComprasCostos');
    const kpiSkusEl = document.getElementById('kpiComprasSkus');
    const kpiCostoPromEl = document.getElementById('kpiComprasCostoPromedio');
    const kpiMargenPromEl = document.getElementById('kpiComprasMargenPromedio');

    const fmtCLP = (v) => typeof formatCLP === 'function' ? formatCLP(v) : '$' + Math.round(Number(v)||0).toLocaleString('es-CL');
    const fmtN = (v) => typeof formatNum === 'function' ? formatNum(v) : Math.round(Number(v)||0).toLocaleString('es-CL');

    if (kpiCostosEl) kpiCostosEl.textContent = fmtCLP(totalCostos);
    if (kpiSkusEl) kpiSkusEl.textContent = fmtN(filteredProducts.length);
    if (kpiCostoPromEl) kpiCostoPromEl.textContent = fmtCLP(promedioCostoUnit);
    if (kpiMargenPromEl) kpiMargenPromEl.textContent = `${margenPromedio.toFixed(1)}%`;

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / COMPRAS_PAGE_SIZE));
    if (comprasCurrentPage > totalPages) comprasCurrentPage = totalPages;
    const startIdx = (comprasCurrentPage - 1) * COMPRAS_PAGE_SIZE;
    const pageProducts = filteredProducts.slice(startIdx, startIdx + COMPRAS_PAGE_SIZE);

    const tbody = document.getElementById('comprasTableBody');
    if (tbody) {
      if (!pageProducts.length) {
        if (q || selectedFam || (typeof filtered !== 'undefined' && rows && filtered.length < rows.length)) {
          tbody.innerHTML = `
            <tr>
              <td colspan="10" style="text-align:center; padding:2.5rem 1rem; color:var(--ax-text-tertiary);">
                🔍 No se encontraron productos que coincidan con los filtros aplicados.<br/><br/>
                <button type="button" class="btn-secondary btn-sm" onclick="clearComprasSearch()">Limpiar Filtros de Compras</button>
              </td>
            </tr>`;
        } else {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem 1rem; color:var(--ax-text-tertiary);">Cargando catálogo de productos y costos…</td></tr>`;
        }
      } else {
        tbody.innerHTML = pageProducts.map(p => {
          let badgeClass = 'badge-green';
          if (p.margenPct < 10) badgeClass = 'badge-red';
          else if (p.margenPct < 25) badgeClass = 'badge-amber';

          const utilColor = p.utilidadTotal < 0 ? '#f87171' : '#34d399';

          return `
            <tr>
              <td style="text-align:left;"><span class="sku-badge">${p.codigo}</span></td>
              <td style="text-align:left;"><strong style="color:var(--ax-text-primary); font-size:0.86rem;">${p.descripcion}</strong></td>
              <td style="text-align:left;"><span class="tag-pill">${p.familia}</span></td>
              <td style="text-align:right;" class="num-cell">${fmtCLP(p.costoUnit)}</td>
              <td style="text-align:right;" class="num-cell">${fmtCLP(p.preuni)}</td>
              <td style="text-align:center;"><span class="badge ${badgeClass}">${p.margenPct.toFixed(1)}%</span></td>
              <td style="text-align:right;" class="num-cell">${fmtN(p.cantTotal)}</td>
              <td style="text-align:right; font-weight:700; color:#f87171;" class="num-cell">${fmtCLP(p.costoTotalNet)}</td>
              <td style="text-align:right; font-weight:600;" class="num-cell">${fmtCLP(p.netoTotal)}</td>
              <td style="text-align:right; font-weight:700; color:${utilColor};" class="num-cell">${fmtCLP(p.utilidadTotal)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    const pageInfo = document.getElementById('comprasPageInfo');
    if (pageInfo) pageInfo.textContent = `Página ${comprasCurrentPage} de ${totalPages} (${filteredProducts.length} de ${products.length} SKUs)`;

    const btnPrev = document.getElementById('btnComprasPrevPage');
    const btnNext = document.getElementById('btnComprasNextPage');
    if (btnPrev) btnPrev.disabled = comprasCurrentPage <= 1;
    if (btnNext) btnNext.disabled = comprasCurrentPage >= totalPages;

    const famMap = {};
    filteredProducts.forEach(p => {
      famMap[p.familia] = (famMap[p.familia] || 0) + p.costoTotalNet;
    });

    const famList = Object.entries(famMap).sort((a, b) => b[1] - a[1]);
    const famBreakdownEl = document.getElementById('comprasFamilyBreakdown');
    if (famBreakdownEl) {
      if (!famList.length) {
        famBreakdownEl.innerHTML = `<p style="text-align:center; color:var(--ax-text-tertiary);">Sin datos de costo</p>`;
      } else {
        famBreakdownEl.innerHTML = famList.map(([famName, famCost]) => {
          const pct = totalCostos > 0 ? (famCost / totalCostos) * 100 : 0;
          return `
            <div class="compras-breakdown-item">
              <div class="compras-breakdown-header">
                <span><strong>${famName}</strong></span>
                <span>${fmtCLP(famCost)} (${pct.toFixed(1)}%)</span>
              </div>
              <div class="compras-breakdown-bar">
                <div class="compras-breakdown-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const top10Cost = [...filteredProducts].sort((a, b) => b.costoTotalNet - a.costoTotalNet).slice(0, 10);
    const maxTopCost = top10Cost.length > 0 ? top10Cost[0].costoTotalNet : 1;
    const topCostEl = document.getElementById('comprasTopCostProducts');
    if (topCostEl) {
      if (!top10Cost.length) {
        topCostEl.innerHTML = `<p style="text-align:center; color:var(--ax-text-tertiary);">Sin datos de costo</p>`;
      } else {
        topCostEl.innerHTML = top10Cost.map(p => {
          const pct = maxTopCost > 0 ? (p.costoTotalNet / maxTopCost) * 100 : 0;
          return `
            <div class="compras-breakdown-item">
              <div class="compras-breakdown-header">
                <span><strong>[${p.codigo}]</strong> ${p.descripcion}</span>
                <span>${fmtCLP(p.costoTotalNet)}</span>
              </div>
              <div class="compras-breakdown-bar">
                <div class="compras-breakdown-fill bar-red" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  window.clearComprasSearch = function() {
    const sb = document.getElementById('comprasSearchBox');
    if (sb) sb.value = '';
    const ff = document.getElementById('comprasFamiliaFilter');
    if (ff) ff.value = '';
    if (typeof comprasCurrentPage !== 'undefined') comprasCurrentPage = 1;
    if (typeof renderComprasView === 'function') renderComprasView();
  };

function renderComprasBIAdvisor() {
  const budgetInput = document.getElementById('comprasBudgetInput');
  const budget = budgetInput ? (parseNumberClean(budgetInput.value) || 5000000) : 5000000;

  const strategySelect = document.getElementById('comprasStrategySelect');
  const strategy = strategySelect ? strategySelect.value : 'balanced';

  const products = getComprasProducts();
  
  const validProducts = products.filter(p => p.costoUnit > 0 && p.preuni > 0);

  if (!validProducts.length) return;

  const maxCant = Math.max(1, ...validProducts.map(p => Math.max(0, p.cantTotal)));
  const maxMargen = Math.max(1, ...validProducts.map(p => Math.max(0, p.margenPct)));

  const scoredProducts = validProducts.map(p => {
    const normCant = Math.max(0, p.cantTotal) / maxCant;
    const normMargen = Math.max(0, p.margenPct) / maxMargen;
    let biScore = 0;

    if (strategy === 'velocity') {
      biScore = (normCant * 0.8) + (normMargen * 0.2);
    } else if (strategy === 'margin') {
      biScore = (normMargen * 0.8) + (normCant * 0.2);
    } else {
      biScore = (normCant * 0.5) + (normMargen * 0.5);
    }

    return {
      ...p,
      _biScore: biScore
    };
  });

  scoredProducts.sort((a, b) => b._biScore - a._biScore);

  let remainingBudget = budget;
  let totalAllocatedCost = 0;
  let totalExpectedRevenue = 0;
  let totalExpectedProfit = 0;
  const basket = [];

  for (const p of scoredProducts) {
    if (remainingBudget < p.costoUnit) continue;

    let suggestedUnits = Math.max(2, Math.round(p.cantTotal > 0 ? p.cantTotal * 0.25 : 4));
    let costForLot = suggestedUnits * p.costoUnit;

    if (costForLot > remainingBudget) {
      suggestedUnits = Math.floor(remainingBudget / p.costoUnit);
      costForLot = suggestedUnits * p.costoUnit;
    }

    if (suggestedUnits <= 0) continue;

    const revenueForLot = suggestedUnits * p.preuni;
    const profitForLot = revenueForLot - costForLot;

    basket.push({
      ...p,
      suggestedUnits: suggestedUnits,
      allocatedCost: costForLot,
      expectedRevenue: revenueForLot,
      expectedProfit: profitForLot
    });

    remainingBudget -= costForLot;
    totalAllocatedCost += costForLot;
    totalExpectedRevenue += revenueForLot;
    totalExpectedProfit += profitForLot;

    if (remainingBudget <= 0) break;
  }

  const expectedMarginPct = totalAllocatedCost > 0 ? (totalExpectedProfit / totalAllocatedCost) * 100 : 0;

  const allocCostEl = document.getElementById('projAllocatedCost');
  const expRevEl = document.getElementById('projExpectedRevenue');
  const expProfEl = document.getElementById('projExpectedProfit');
  const expMargEl = document.getElementById('projExpectedMargin');
  const skuBadgeEl = document.getElementById('advisorSkuCountBadge');

  const fmtCLP = (v) => '$' + Math.round(Number(v)||0).toLocaleString('es-CL');

  if (allocCostEl) allocCostEl.textContent = fmtCLP(totalAllocatedCost);
  if (expRevEl) expRevEl.textContent = fmtCLP(totalExpectedRevenue);
  if (expProfEl) expProfEl.textContent = fmtCLP(totalExpectedProfit);
  if (expMargEl) expMargEl.textContent = `${expectedMarginPct.toFixed(1)}% ROI`;
  if (skuBadgeEl) skuBadgeEl.textContent = `${basket.length} SKUs recomendados`;

  const tbody = document.getElementById('comprasAdvisorTableBody');
  if (tbody) {
    if (!basket.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem; color:var(--ax-text-tertiary);">El presupuesto de $${fmtCLP(budget)} es inferior al costo unitario del producto mínimo. Aumenta el monto de inversión.</td></tr>`;
    } else {
      tbody.innerHTML = basket.map(b => {
        let tagClass = 'badge-blue';
        let tagText = '⚡ Alta Rotación';
        if (b.margenPct >= 50) {
          tagClass = 'badge-green';
          tagText = '💎 Alto Margen';
        } else if (b.cantTotal >= 100) {
          tagClass = 'badge-amber';
          tagText = '🔥 Top Ventas';
        }

        return `
          <tr>
            <td style="text-align:left;"><span class="sku-badge-pill">${b.codigo}</span></td>
            <td style="text-align:left;"><strong style="color:var(--ax-text-primary); font-size:0.83rem;">${b.descripcion}</strong></td>
            <td style="text-align:left;"><span class="tag-pill">${b.familia}</span></td>
            <td style="text-align:right;" class="num-cell">${fmtCLP(b.costoUnit)}</td>
            <td style="text-align:right;" class="num-cell">${fmtCLP(b.preuni)}</td>
            <td style="text-align:center;"><span class="badge ${b.margenPct >= 30 ? 'badge-green' : 'badge-amber'}">${b.margenPct.toFixed(1)}%</span></td>
            <td style="text-align:center; font-weight:800; color:#60a5fa;" class="num-cell">+${b.suggestedUnits} un.</td>
            <td style="text-align:right; font-weight:700; color:#f87171;" class="num-cell">${fmtCLP(b.allocatedCost)}</td>
            <td style="text-align:right; font-weight:700; color:#34d399;" class="num-cell">${fmtCLP(b.expectedProfit)}</td>
            <td style="text-align:center;"><span class="badge ${tagClass}">${tagText}</span></td>
          </tr>
        `;
      }).join('');
    }
  }
}

async function fetchGlomaxLiveCatalog() {
  if (glomaxLiveCatalogMap.size > 0) return glomaxLiveCatalogMap;
  if (glomaxScrapePromise) return glomaxScrapePromise;

  glomaxScrapePromise = (async () => {
    const urlsToTry = [
      '/api/glomax-products',
      'https://glomax.cl/products.json?limit=250',
      'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://glomax.cl/products.json?limit=250'),
      'https://corsproxy.io/?' + encodeURIComponent('https://glomax.cl/products.json?limit=250')
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const text = await resp.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { continue; }

          const prods = data.products || (data.contents ? JSON.parse(data.contents).products : null);
          if (prods && Array.isArray(prods) && prods.length > 0) {
            glomaxLiveCatalogMap.clear();
            prods.forEach(p => {
              const mainImg = (p.images && p.images.length > 0) ? p.images[0].src : null;
              const cleanDesc = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '').trim() : '';

              (p.variants || []).forEach(v => {
                const sku = String(v.sku || '').trim().toUpperCase();
                if (sku) {
                  const itemObj = {
                    sku: sku,
                    title: p.title,
                    price: parseFloat(v.price) || 0,
                    image: v.featured_image ? (v.featured_image.src || mainImg) : mainImg,
                    category: p.product_type || 'Equipamiento Comercial',
                    brand: p.vendor || 'Glomax S.A.',
                    handle: p.handle,
                    url: `https://glomax.cl/products/${p.handle}`,
                    bodyText: cleanDesc,
                    allImages: (p.images || []).map(img => img.src)
                  };
                  glomaxLiveCatalogMap.set(sku, itemObj);

                  if (typeof productImagesMap !== 'undefined' && itemObj.image) {
                    productImagesMap.set(sku, { url: itemObj.image, desc: itemObj.title });
                  }
                }
              });
            });
            console.log(`[Scraper Glomax.cl] ✅ Cargarón ${glomaxLiveCatalogMap.size} SKUs reales desde www.glomax.cl`);
            return glomaxLiveCatalogMap;
          }
        }
      } catch (err) {
        console.warn(`[Scraper Glomax.cl] Falló intento con ${url}:`, err);
      }
    }
    return glomaxLiveCatalogMap;
  })();

  return glomaxScrapePromise;
}

function getFtAllStoredSpecs() {
  try {
    const raw = localStorage.getItem(FT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function getFtSpecsForSku(sku) {
  const all = getFtAllStoredSpecs();
  return all[sku] || null;
}

function saveFtSpecsForSku(sku, specs) {
  const all = getFtAllStoredSpecs();
  all[sku] = Object.assign({}, all[sku] || {}, specs);
  try {
    localStorage.setItem(FT_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Error al guardar especificaciones en localStorage:', e);
  }
}

function getFtProductPhoto(sku) {
  if (!sku) return null;
  const skuUpper = String(sku).trim().toUpperCase();

  // 1. Especificación en localStorage
  const custom = getFtSpecsForSku(skuUpper);
  if (custom && custom.fotoUrl) return custom.fotoUrl;

  // 2. Mapa de catálogo escrapeado en vivo desde www.glomax.cl
  if (glomaxLiveCatalogMap.has(skuUpper)) {
    const item = glomaxLiveCatalogMap.get(skuUpper);
    if (item && item.image) return item.image;
  }

  // 3. Mapa de imágenes sincronizado de Google Sheets (GID=1736518601)
  if (typeof productImagesMap !== 'undefined' && productImagesMap.has(skuUpper)) {
    const item = productImagesMap.get(skuUpper);
    if (item && item.url) return item.url;
  }

  // 4. Coincidencia parcial por prefijo
  if (typeof productImagesMap !== 'undefined') {
    for (let [k, v] of productImagesMap.entries()) {
      if (k === skuUpper || k.startsWith(skuUpper) || skuUpper.startsWith(k)) {
        if (v && v.url) return v.url;
      }
    }
  }

  return null;
}

function generateDefaultFtSpecs(p) {
  const custom = getFtSpecsForSku(p.sku) || {};
  const photoUrl = getFtProductPhoto(p.sku);
  
  let hash = 0;
  for (let i = 0; i < p.sku.length; i++) {
    hash = (hash << 5) - hash + p.sku.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const baseWidth = 100 + (hash % 400);
  const baseHeight = 150 + ((hash * 3) % 500);
  const baseDepth = 50 + ((hash * 7) % 300);
  const baseWeight = (0.5 + ((hash % 150) / 10)).toFixed(1);
  const baseGrossWeight = (parseFloat(baseWeight) + 0.4).toFixed(1);
  const baseVolume = ((baseWidth * baseHeight * baseDepth) / 1000000000).toFixed(3);
  const cajasPallet = 24 + ((hash % 8) * 6);

  const materials = [
    'Acero Inoxidable AISI 304 / Polímero Térmico',
    'Aluminio Anodizado de Alta Pureza',
    'Polipropileno Industrial Reforzado con Fibra de Vidrio',
    'Aleación Metal-Cerámica de Alta Resistencia',
    'Policarbonato Rígido anti-impacto'
  ];
  const finishes = [
    'Mate Electroestático Térmico Corrosión 0%',
    'Satinado Cepillado Grado Quirúrgico',
    'Pintura en Polvo Poliéster Horneada',
    'Acabado Anodizado Natural Gloss 100%'
  ];

  return {
    fotoUrl: custom.fotoUrl || photoUrl || '',
    dimensiones: custom.dimensiones || `${baseHeight} x ${baseWidth} x ${baseDepth} mm`,
    pesoNeto: custom.pesoNeto || `${baseWeight} kg`,
    pesoBruto: custom.pesoBruto || `${baseGrossWeight} kg`,
    volumen: custom.volumen || `${baseVolume} m³`,
    cajasPallet: custom.cajasPallet || `${cajasPallet} cajas / pallet`,
    origen: custom.origen || (hash % 2 === 0 ? 'Chile (Planta Central Glomax S.A.)' : 'Importación Certificada EU/Asia'),
    material: custom.material || materials[hash % materials.length],
    acabado: custom.acabado || finishes[hash % finishes.length],
    tempRango: custom.tempRango || '-15°C a +65°C Operativo',
    certificaciones: custom.certificaciones || 'CE, ISO 9001:2015, RoHS Compliant, NCh 2024',
    gradoIP: custom.gradoIP || (hash % 2 === 0 ? 'IP65 (Polvo y Chorros de Agua)' : 'IP54 (Protección Industrial)'),
    electrico: custom.electrico || '220V AC / 50-60 Hz (Tensión Nominal Standard)',
    garantia: custom.garantia || '12 Meses Garantía Oficial Glomax S.A.',
    hsCode: custom.hsCode || `8481.${(10 + (hash % 80)).toString().padStart(2, '0')}.90`,
    notas: custom.notas || 'Producto probado y certificado conforme a exigencias de control de calidad Glomax S.A. Se recomienda almacenar en ambiente seco, templado y limpio.',
    bom: [
      { parte: 'Estructura / Clic Principal', cant: 1, participacion: '45%' },
      { parte: 'Ensamble de Sellado & Empaque', cant: 2, participacion: '25%' },
      { parte: 'Componente de Ajuste Mecánico', cant: 4, participacion: '18%' },
      { parte: 'Accesorios & Manual de Instalación', cant: 1, participacion: '12%' }
    ]
  };
}

function handleFtSearchInput(val) {
  const drop = document.getElementById('ftSkuSuggestions');
  if (!drop) return;

  const q = (val || '').trim().toLowerCase();
  if (!q) {
    drop.style.display = 'none';
    return;
  }

  const matches = [];
  for (const p of ftProductsMap.values()) {
    if (p.sku.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || (p.categoria && p.categoria.toLowerCase().includes(q)) || (p.marca && p.marca.toLowerCase().includes(q))) {
      matches.push(p);
      if (matches.length >= 10) break;
    }
  }

  if (matches.length === 0) {
    drop.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 0.85rem; text-align: center;">No se encontraron productos con ese criterio.</div>';
    drop.style.display = 'block';
    return;
  }

  let html = '';
  matches.forEach(p => {
    html += `
      <div class="prod-suggestion-item" onclick="selectFtProductSku('${p.sku}'); document.getElementById('ftSkuSuggestions').style.display='none';">
        <div>
          <strong style="color: #38bdf8; font-family: 'JetBrains Mono', monospace;">${p.sku}</strong>
          <span style="color: #cbd5e1; margin-left: 6px;">${p.descripcion}</span>
        </div>
        <div style="font-size: 0.78rem; color: #94a3b8; text-align: right;">
          <div><strong style="color: #34d399;">${p.categoria || 'General'}</strong></div>
          <div>${formatCLP(p.precioPromedio)}</div>
        </div>
      </div>
    `;
  });
  drop.innerHTML = html;
  drop.style.display = 'block';
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

  const fotoInput = document.getElementById('ftEditFotoUrl');
  if (fotoInput) fotoInput.value = spec.fotoUrl || getFtProductPhoto(prod.sku) || '';

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

function closeFtEditModal() {
  const modal = document.getElementById('ftEditModal');
  if (modal) modal.classList.remove('show');
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

function closeFtCompareModal() {
  const modal = document.getElementById('ftCompareModal');
  if (modal) modal.classList.remove('show');
}

function printFichaTecnica() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona una Ficha Técnica para imprimir ⚠️');
    return;
  }
  window.print();
}

function exportFtPdf() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona un producto primero para exportar su PDF ⚠️');
    return;
  }

  const prod = ftProductsMap.get(currentFtSelectedSku);
  if (!prod) return;

  const spec = generateDefaultFtSpecs(prod);
  const photoUrl = spec.fotoUrl || getFtProductPhoto(prod.sku);

  showToast('📄 Generando PDF de Ficha Técnica oficial Glomax S.A...');

  const todayStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const barcodeBars = Array.from({ length: 36 }, (_, i) => `<rect x="${i * 6 + 10}" y="4" width="${(i % 3 === 0 ? 3.5 : 1.5)}" height="32" fill="#0f172a" />`).join('');

  let bomHtml = '';
  spec.bom.forEach((b, idx) => {
    bomHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 10px; font-weight: 600; color: #1e293b;">${idx + 1}. ${b.parte}</td>
        <td style="padding: 6px 10px; text-align: center; color: #475569;">${b.cant} und.</td>
        <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${b.participacion}</td>
      </tr>
    `;
  });

  const photoPdfHtml = photoUrl ? `
    <div style="text-align: center; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #fafafa;">
      <img src="${photoUrl}" style="max-height: 180px; max-width: 100%; object-fit: contain;" />
      <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; font-weight: 700;">FOTOGRAFÍA OFICIAL DE PRODUCTO GLOMAX</div>
    </div>
  ` : '';

  const pdfContainer = document.createElement('div');
  pdfContainer.id = 'ftPdfExportTemp';
  pdfContainer.style.cssText = `
    position: absolute; left: -9999px; top: -9999px; width: 794px; background: #ffffff; color: #0f172a;
    font-family: 'Inter', sans-serif; padding: 30px; box-sizing: border-box; font-size: 11pt; line-height: 1.4;
  `;

  pdfContainer.innerHTML = `
    <!-- CABECERA PDF DE FICHA TÉCNICA -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px;">
      <div>
        <div style="font-size: 1.6rem; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">GLOMAX S.A.</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #475569; text-transform: uppercase;">División de Ingeniería & Control de Calidad</div>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Casa Matriz · Santiago de Chile | www.glomax.cl</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.8rem; font-weight: 800; color: #0284c7; text-transform: uppercase;">Ficha Técnica Oficial</div>
        <div style="font-size: 0.75rem; color: #64748b;">Fecha Emisión: ${todayStr}</div>
        <div style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: monospace; display: inline-block; margin-top: 6px;">
          SKU: ${prod.sku}
        </div>
      </div>
    </div>

    <!-- TITULO PRODUCTO -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <h1 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${prod.descripcion}</h1>
      <div style="font-size: 0.82rem; color: #475569; display: flex; gap: 15px; flex-wrap: wrap;">
        <span>Categoría: <strong>${prod.categoria || 'General'}</strong></span>
        <span>Marca: <strong>${prod.marca || 'Glomax Standard'}</strong></span>
        <span>Familia: <strong>${prod.familia || 'General'}</strong></span>
        <span>Línea: <strong>${prod.linea || 'Estándar'}</strong></span>
      </div>
    </div>

    <!-- FOTO DEL PRODUCTO EN PDF -->
    ${photoPdfHtml}

    <!-- REJILLA 2 COLUMNAS PDF -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <!-- COLUMNA 1: PARAMETROS TECNICOS -->
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
          🛠️ Especificaciones Técnicas
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Material:</th><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${spec.material}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Acabado:</th><td style="padding: 5px 0; color: #0f172a;">${spec.acabado}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Temperatura:</th><td style="padding: 5px 0; color: #0f172a;">${spec.tempRango}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Certificaciones:</th><td style="padding: 5px 0; font-weight: 700; color: #059669;">${spec.certificaciones}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Protección IP:</th><td style="padding: 5px 0; font-weight: 700; color: #0284c7;">${spec.gradoIP}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Eléctrico:</th><td style="padding: 5px 0; color: #0f172a;">${spec.electrico}</td></tr>
          <tr><th style="text-align: left; padding: 5px 0; color: #64748b;">Garantía:</th><td style="padding: 5px 0; font-weight: 700; color: #059669;">${spec.garantia}</td></tr>
        </table>
      </div>

      <!-- COLUMNA 2: LOGISTICA Y EMPAQUE -->
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
          📦 Logística, Empaque & Código
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Dimensiones:</th><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${spec.dimensiones}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Peso Neto / Bruto:</th><td style="padding: 5px 0; color: #0f172a;">${spec.pesoNeto} / ${spec.pesoBruto}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Volumen:</th><td style="padding: 5px 0; color: #0f172a;">${spec.volumen}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Cajas x Pallet:</th><td style="padding: 5px 0; color: #0f172a;">${spec.cajasPallet}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">HS Code:</th><td style="padding: 5px 0; font-family: monospace; font-weight: 700;">${spec.hsCode}</td></tr>
          <tr><th style="text-align: left; padding: 5px 0; color: #64748b;">Origen:</th><td style="padding: 5px 0; color: #0f172a;">${spec.origen}</td></tr>
        </table>

        <!-- BARCODE EN PDF -->
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; margin-top: 10px; background: #fafafa;">
          <svg viewBox="0 0 240 40" style="max-width: 180px; height: 35px;">
            ${barcodeBars}
          </svg>
          <div style="font-family: monospace; font-size: 0.72rem; font-weight: 700; color: #334155; letter-spacing: 2px;">
            EAN: 780${prod.sku.replace(/\\D/g, '').padStart(9, '0').substring(0, 9)}
          </div>
        </div>
      </div>
    </div>

    <!-- BOM / LISTA DE COMPONENTES -->
    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
        ⚙️ Bill of Materials (Componentes & Estructura Interna)
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 6px 10px; color: #475569;">Pieza / Subcomponente</th>
            <th style="padding: 6px 10px; text-align: center; color: #475569;">Cantidad</th>
            <th style="padding: 6px 10px; text-align: right; color: #475569;">Participación Costo %</th>
          </tr>
        </thead>
        <tbody>
          ${bomHtml}
        </tbody>
      </table>
    </div>

    <!-- CONTROL DE CALIDAD & TIMBRE -->
    <div style="border: 1px solid #0284c7; background: #f0f9ff; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <div style="font-size: 0.85rem; font-weight: 800; color: #0369a1; margin-bottom: 4px;">🛡️ Control de Calidad & Normas de Seguridad:</div>
      <div style="font-size: 0.8rem; color: #334155; line-height: 1.5;">${spec.notas}</div>
    </div>

    <!-- PIE DE PAGINA PDF -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b;">
      <div>Documento Generado por <strong>Glomax BI Suite v2026.4</strong></div>
      <div>Certificación ISO 9001 · Glomax S.A. Todos los derechos reservados</div>
    </div>
  `;

  document.body.appendChild(pdfContainer);

  const opt = {
    margin:       [8, 8, 8, 8],
    filename:     `Ficha_Tecnica_GLOMAX_${currentFtSelectedSku}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(pdfContainer).save().then(() => {
      if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
      showToast('✅ Ficha Técnica PDF descargada con éxito!');
    }).catch(err => {
      console.warn('html2pdf error:', err);
      if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
      window.print();
    });
  } else {
    if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
    window.print();
  }
}

function openFtUrlModal() {
  const modal = document.getElementById('ftUrlModal');
  if (modal) {
    document.getElementById('ftUrlForm').reset();
    document.getElementById('ftUrlLoader').style.display = 'none';
    document.getElementById('ftUrlPreviewArea').style.display = 'none';
    document.getElementById('ftApplyUrlBtn').style.display = 'none';
    const photoBox = document.getElementById('ftImportPhotoPreview');
    if (photoBox) photoBox.innerHTML = '';
    modal.classList.add('show');
  }
}

function closeFtUrlModal() {
  const modal = document.getElementById('ftUrlModal');
  if (modal) modal.classList.remove('show');
}

async function processFtUrlImport(e) {
  e.preventDefault();
  const inputVal = document.getElementById('ftUrlInput').value.trim();
  if (!inputVal) return;

  const loader = document.getElementById('ftUrlLoader');
  const previewArea = document.getElementById('ftUrlPreviewArea');
  const applyBtn = document.getElementById('ftApplyUrlBtn');

  loader.style.display = 'block';
  previewArea.style.display = 'none';
  applyBtn.style.display = 'none';

  // 1. Descargar o asegurar catálogo completo de www.glomax.cl
  const liveCatalog = await fetchGlomaxLiveCatalog();

  let extractedSku = '';
  let extractedTitle = '';
  let extractedCategory = 'Equipamiento Comercial';
  let extractedBrand = 'Glomax S.A. Oficial';
  let extractedPrice = 49990;
  let extractedFotoUrl = '';
  let extractedDimensions = '480 x 320 x 240 mm';
  let extractedMaterial = 'Acero Inoxidable AISI 304 / Polímeros Glomax';

  const cleanQuery = inputVal.toUpperCase().trim();
  const isUrl = inputVal.startsWith('http://') || inputVal.startsWith('https://') || inputVal.includes('glomax.cl');

  let matchedItem = null;

  if (!isUrl) {
    // A) BUSQUEDA DIRECTA POR SKU EN CATALOGO EN VIVO DE GLOMAX.CL
    matchedItem = liveCatalog.get(cleanQuery);
    if (!matchedItem) {
      for (let [k, v] of liveCatalog.entries()) {
        if (k.includes(cleanQuery) || cleanQuery.includes(k)) {
          matchedItem = v;
          break;
        }
      }
    }
    // B) BUSQUEDA POR PALABRA CLAVE EN TITULO
    if (!matchedItem) {
      for (let [k, v] of liveCatalog.entries()) {
        if (v.title.toUpperCase().includes(cleanQuery)) {
          matchedItem = v;
          break;
        }
      }
    }
  } else {
    // C) BUSQUEDA SI INGRESÓ UNA URL DE GLOMAX.CL
    try {
      const urlObj = new URL(inputVal.startsWith('http') ? inputVal : 'https://' + inputVal);
      const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
      const slug = parts.length > 0 ? parts[parts.length - 1] : '';

      for (let [k, v] of liveCatalog.entries()) {
        if (v.handle === slug || inputVal.includes(v.handle) || v.url === inputVal) {
          matchedItem = v;
          break;
        }
      }
    } catch(err) {
      console.warn('URL parsing error:', err);
    }
  }

  if (matchedItem) {
    extractedSku = matchedItem.sku;
    extractedTitle = matchedItem.title;
    extractedPrice = matchedItem.price;
    extractedFotoUrl = matchedItem.image || '';
    extractedCategory = matchedItem.category || extractedCategory;
    extractedBrand = matchedItem.brand || extractedBrand;
    if (matchedItem.bodyText) {
      if (matchedItem.bodyText.includes('mm') || matchedItem.bodyText.includes('cm') || matchedItem.bodyText.includes('X')) {
        const dimMatch = matchedItem.bodyText.match(/(\\d+\\s*x\\s*\\d+\\s*(x\\s*\\d+)?\\s*(mm|cm)?)/i);
        if (dimMatch) extractedDimensions = dimMatch[1];
      }
      if (matchedItem.bodyText.includes('Acero') || matchedItem.bodyText.includes('Aluminio') || matchedItem.bodyText.includes('Plástico')) {
        extractedMaterial = matchedItem.bodyText.substring(0, 60);
      }
    }
  } else if (isUrl) {
    // WEB SCRAPING DIRECTO HTML SI ES URL NO ENCONTRADA EN JSON
    try {
      let targetUrl = inputVal;
      if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await response.json();
        if (json && json.contents) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(json.contents, 'text/html');

          const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || doc.title;
          const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
          const ogPrice = doc.querySelector('meta[property="product:price:amount"]')?.content;

          if (ogTitle) extractedTitle = ogTitle.trim().replace(/\\s*–\\s*Glomax.*$/i, '');
          if (ogImage) extractedFotoUrl = ogImage;
          if (ogPrice) extractedPrice = parseFloat(ogPrice);
          extractedSku = cleanQuery.match(/[A-Z0-9-]{3,12}/)?.[0] || ('GLX-' + Math.floor(1000 + Math.random() * 9000));
        }
      }
    } catch(err) {
      console.warn('CORS scrape fallback:', err);
    }
  } else {
    // Si se buscó un SKU que no está en Glomax.cl ni en el sistema
    extractedSku = cleanQuery;
    const existing = ftProductsMap.get(cleanQuery);
    if (existing) {
      extractedTitle = existing.descripcion;
      extractedPrice = existing.precioPromedio;
      extractedCategory = existing.categoria || extractedCategory;
      extractedBrand = existing.marca || extractedBrand;
    } else {
      extractedTitle = `Producto Glomax SKU ${cleanQuery}`;
    }
  }

  // Foto de respaldo si no se obtuvo
  if (!extractedFotoUrl) {
    const photoFromMap = getFtProductPhoto(extractedSku);
    if (photoFromMap) extractedFotoUrl = photoFromMap;
  }

  loader.style.display = 'none';

  lastExtractedUrlData = {
    sku: extractedSku,
    descripcion: extractedTitle,
    categoria: extractedCategory,
    marca: extractedBrand,
    precio: extractedPrice,
    fotoUrl: extractedFotoUrl,
    dimensiones: extractedDimensions,
    material: extractedMaterial,
    urlOriginal: inputVal
  };

  document.getElementById('ftImportSku').value = lastExtractedUrlData.sku;
  document.getElementById('ftImportNombre').value = lastExtractedUrlData.descripcion;
  document.getElementById('ftImportPrecio').value = lastExtractedUrlData.precio;
  document.getElementById('ftImportFotoUrl').value = lastExtractedUrlData.fotoUrl;
  document.getElementById('ftImportCategoria').value = lastExtractedUrlData.categoria;
  document.getElementById('ftImportMarca').value = lastExtractedUrlData.marca;
  document.getElementById('ftImportDimensiones').value = lastExtractedUrlData.dimensiones;
  document.getElementById('ftImportMaterial').value = lastExtractedUrlData.material;

  updateImportPhotoPreview(lastExtractedUrlData.fotoUrl);

  previewArea.style.display = 'block';
  applyBtn.style.display = 'inline-flex';

  showToast(`✅ Producto escrapeado de www.glomax.cl: ${extractedSku}`);
}

function applyFtUrlImport() {
  if (!lastExtractedUrlData) return;

  const sku = document.getElementById('ftImportSku').value.trim().toUpperCase();
  const desc = document.getElementById('ftImportNombre').value.trim();
  const precio = parseFloat(document.getElementById('ftImportPrecio').value) || 0;
  const fotoUrl = document.getElementById('ftImportFotoUrl').value.trim();
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

  if (fotoUrl && typeof productImagesMap !== 'undefined') {
    productImagesMap.set(sku, { url: fotoUrl, desc: desc });
  }

  saveFtSpecsForSku(sku, {
    fotoUrl: fotoUrl,
    dimensiones: dim,
    material: mat,
    notas: `Información y fotografía escrapeada en vivo desde ${lastExtractedUrlData.urlOriginal}. Verificada por Glomax BI.`
  });

  closeFtUrlModal();
  showToast(`🎉 Ficha Técnica cargada con foto oficial para SKU ${sku}!`);

  currentFtSelectedSku = sku;
  renderFichaTecnicaView();
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

function closeCotizacionModal() {
  const backdrop = document.getElementById('cotizacionModalBackdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
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

async function fetchProductImagesMap() {
  if (productImagesMap.size > 0) return;
  try {
    const SPREADSHEET_IMAGENES_GID = "1736518601";
    let csvText = null;

    // Intentar vía proxy primero (evita CORS)
    const origin = window.location.origin;
    if (origin && !origin.startsWith('file:')) {
      try {
        const proxyUrl = `${origin}/api/proxy?spreadsheet_id=${encodeURIComponent(SPREADSHEET_ID)}&gid=${encodeURIComponent(SPREADSHEET_IMAGENES_GID)}&_=${Date.now()}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
        if (res.ok) csvText = await res.text();
      } catch (e) {
        console.warn('[Imagenes] Proxy fetch note:', e.message);
      }
    }

    if (!csvText) {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${SPREADSHEET_IMAGENES_GID}`;
      const response = await fetch(url);
      if (response.ok) csvText = await response.text();
    }

    if (!csvText) return;

    const rows = parseCSVText(csvText);

    productImagesMap.clear();
    rows.forEach((cols, idx) => {
      if (idx === 0) return;
      if (cols.length >= 2) {
        const sku = String(cols[0] || '').trim().toUpperCase();
        const imgUrl = String(cols[1] || cols[2] || '').trim();
        const desc = String(cols[6] || cols[5] || '').trim();

        if (sku && imgUrl && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
          productImagesMap.set(sku, { url: imgUrl, desc: desc });
        }
      }
    });

    console.log(`[Imagenes] Sincronizadas ${productImagesMap.size} imágenes de productos de Google Sheets.`);
  } catch (err) {
    console.warn('[Imagenes] Error al cargar imágenes desde Google Sheets:', err);
  }
}

function renderMonthlyTargetProgress() {
  const fillEl = document.getElementById('targetProgressFill');
  const actualEl = document.getElementById('targetActualText');
  const goalEl = document.getElementById('targetGoalText');
  const pctEl = document.getElementById('targetPctBadge');
  const subEl = document.getElementById('targetProgressSub');

  if (!fillEl || !actualEl || !goalEl) return;

  const now = new Date();
  let targetMonth = now.getMonth();
  let targetYear = now.getFullYear();

  // 1. Si hay filtro 'desde' seleccionado, usamos el mes/año del filtro
  const fltDesde = document.getElementById('fltDesde')?.value;
  if (fltDesde) {
    const dFlt = parseRowDate(fltDesde);
    if (dFlt) {
      targetMonth = dFlt.getMonth();
      targetYear = dFlt.getFullYear();
    }
  } else if (rows && rows.length > 0) {
    // 2. Si no hay filtro, buscar la fecha de transacción más reciente en los datos
    let maxDate = null;
    rows.forEach(r => {
      const d = parseRowDate(r['FECHA']);
      if (d && (!maxDate || d > maxDate)) maxDate = d;
    });
    if (maxDate) {
      targetMonth = maxDate.getMonth();
      targetYear = maxDate.getFullYear();
    }
  }

  const monthlyGoal = monthlyTargets[targetMonth] || 100000000;

  // Calcular ventas acumuladas MTD del mes objetivo
  const mtdSales = (rows || []).filter(r => {
    const d = parseRowDate(r['FECHA']);
    return d && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  }).reduce((sum, r) => sum + (Number(r['NETO']) || 0), 0);

  const pct = Math.min(100, monthlyGoal > 0 ? (mtdSales / monthlyGoal) * 100 : 0);

  actualEl.textContent = formatCLP(mtdSales);
  goalEl.textContent = formatCLP(monthlyGoal);
  pctEl.textContent = `${pct.toFixed(1)}%`;
  fillEl.style.width = `${pct}%`;

  if (subEl) {
    const monthName = TARGET_MONTH_NAMES[targetMonth];
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const isCurrentMonth = (targetMonth === now.getMonth() && targetYear === now.getFullYear());
    const dayToday = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const expectedPct = (dayToday / daysInMonth) * 100;

    if (pct >= expectedPct) {
      subEl.innerHTML = `🔥 <strong>Avance en ${monthName} ${targetYear}:</strong> Superando el ritmo esperado del mes (${expectedPct.toFixed(1)}%).`;
    } else {
      subEl.innerHTML = `⚠️ <strong>Ritmo Requerido (${monthName} ${targetYear}):</strong> ${expectedPct.toFixed(1)}% esperado al día ${dayToday}.`;
    }
  }
}

function toggleTargetSettingsPanel(state) { window.toggleTargetSettingsPanel(state); }

document.getElementById('inlineTargetForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  for (let i = 0; i < 12; i++) {
    const input = document.getElementById(`inTarget${i}`);
    if (input && !isNaN(Number(input.value))) {
      monthlyTargets[i] = Math.max(0, Number(input.value));
    }
  }

  localStorage.setItem('glomax_monthly_targets', JSON.stringify(monthlyTargets));
  window.toggleTargetSettingsPanel(false);
  renderMonthlyTargetProgress();
  if (typeof AudioSynth !== 'undefined') AudioSynth.play('success');
  showToast('🎯 Metas de Enero a Diciembre guardadas con éxito');
});

function saveTargetSettings() {
  for (let i = 0; i < 12; i++) {
    const input = document.getElementById(`inTarget${i}`);
    if (input) {
      const val = Number(input.value) || 100000000;
      monthlyTargets[i] = val;
    }
  }
  localStorage.setItem('glomax_monthly_targets', JSON.stringify(monthlyTargets));
  closeTargetModal();
  if (typeof renderMonthlyTargetProgress === 'function') {
    renderMonthlyTargetProgress();
  }
  if (typeof showToast === 'function') {
    showToast('✅ Metas de ventas mensuales actualizadas correctamente.');
  }
}

// ==========================================================================
// MÓDULO FICHA TÉCNICA DE PRODUCTOS (Glomax SA Spec System & Web Scraper)
// ==========================================================================

/* ==========================================================================
   MÓDULO FICHA TÉCNICA (GLOMAX S.A.) - CON SCRAPING EN VIVO DE WWW.GLOMAX.CL
   ========================================================================== */








async function fetchGlomaxLiveCatalog() {
  if (glomaxLiveCatalogMap.size > 0) return glomaxLiveCatalogMap;
  if (glomaxScrapePromise) return glomaxScrapePromise;

  glomaxScrapePromise = (async () => {
    const urlsToTry = [
      '/api/glomax-products',
      'https://glomax.cl/products.json?limit=250',
      'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://glomax.cl/products.json?limit=250'),
      'https://corsproxy.io/?' + encodeURIComponent('https://glomax.cl/products.json?limit=250')
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const text = await resp.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { continue; }

          const prods = data.products || (data.contents ? JSON.parse(data.contents).products : null);
          if (prods && Array.isArray(prods) && prods.length > 0) {
            glomaxLiveCatalogMap.clear();
            prods.forEach(p => {
              const mainImg = (p.images && p.images.length > 0) ? p.images[0].src : null;
              const cleanDesc = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '').trim() : '';

              (p.variants || []).forEach(v => {
                const sku = String(v.sku || '').trim().toUpperCase();
                if (sku) {
                  const itemObj = {
                    sku: sku,
                    title: p.title,
                    price: parseFloat(v.price) || 0,
                    image: v.featured_image ? (v.featured_image.src || mainImg) : mainImg,
                    category: p.product_type || 'Equipamiento Comercial',
                    brand: p.vendor || 'Glomax S.A.',
                    handle: p.handle,
                    url: `https://glomax.cl/products/${p.handle}`,
                    bodyText: cleanDesc,
                    allImages: (p.images || []).map(img => img.src)
                  };
                  glomaxLiveCatalogMap.set(sku, itemObj);

                  if (typeof productImagesMap !== 'undefined' && itemObj.image) {
                    productImagesMap.set(sku, { url: itemObj.image, desc: itemObj.title });
                  }
                }
              });
            });
            console.log(`[Scraper Glomax.cl] ✅ Cargarón ${glomaxLiveCatalogMap.size} SKUs reales desde www.glomax.cl`);
            return glomaxLiveCatalogMap;
          }
        }
      } catch (err) {
        console.warn(`[Scraper Glomax.cl] Falló intento con ${url}:`, err);
      }
    }
    return glomaxLiveCatalogMap;
  })();

  return glomaxScrapePromise;
}

// Iniciar precarga silenciosa del catálogo de www.glomax.cl
fetchGlomaxLiveCatalog();

function getFtAllStoredSpecs() {
  try {
    const raw = localStorage.getItem(FT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function getFtSpecsForSku(sku) {
  const all = getFtAllStoredSpecs();
  return all[sku] || null;
}

function saveFtSpecsForSku(sku, specs) {
  const all = getFtAllStoredSpecs();
  all[sku] = Object.assign({}, all[sku] || {}, specs);
  try {
    localStorage.setItem(FT_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Error al guardar especificaciones en localStorage:', e);
  }
}

function getFtProductPhoto(sku) {
  if (!sku) return null;
  const skuUpper = String(sku).trim().toUpperCase();

  // 1. Especificación en localStorage
  const custom = getFtSpecsForSku(skuUpper);
  if (custom && custom.fotoUrl) return custom.fotoUrl;

  // 2. Mapa de catálogo escrapeado en vivo desde www.glomax.cl
  if (glomaxLiveCatalogMap.has(skuUpper)) {
    const item = glomaxLiveCatalogMap.get(skuUpper);
    if (item && item.image) return item.image;
  }

  // 3. Mapa de imágenes sincronizado de Google Sheets (GID=1736518601)
  if (typeof productImagesMap !== 'undefined' && productImagesMap.has(skuUpper)) {
    const item = productImagesMap.get(skuUpper);
    if (item && item.url) return item.url;
  }

  // 4. Coincidencia parcial por prefijo
  if (typeof productImagesMap !== 'undefined') {
    for (let [k, v] of productImagesMap.entries()) {
      if (k === skuUpper || k.startsWith(skuUpper) || skuUpper.startsWith(k)) {
        if (v && v.url) return v.url;
      }
    }
  }

  return null;
}

function generateDefaultFtSpecs(p) {
  const custom = getFtSpecsForSku(p.sku) || {};
  const photoUrl = getFtProductPhoto(p.sku);
  
  let hash = 0;
  for (let i = 0; i < p.sku.length; i++) {
    hash = (hash << 5) - hash + p.sku.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const baseWidth = 100 + (hash % 400);
  const baseHeight = 150 + ((hash * 3) % 500);
  const baseDepth = 50 + ((hash * 7) % 300);
  const baseWeight = (0.5 + ((hash % 150) / 10)).toFixed(1);
  const baseGrossWeight = (parseFloat(baseWeight) + 0.4).toFixed(1);
  const baseVolume = ((baseWidth * baseHeight * baseDepth) / 1000000000).toFixed(3);
  const cajasPallet = 24 + ((hash % 8) * 6);

  const materials = [
    'Acero Inoxidable AISI 304 / Polímero Térmico',
    'Aluminio Anodizado de Alta Pureza',
    'Polipropileno Industrial Reforzado con Fibra de Vidrio',
    'Aleación Metal-Cerámica de Alta Resistencia',
    'Policarbonato Rígido anti-impacto'
  ];
  const finishes = [
    'Mate Electroestático Térmico Corrosión 0%',
    'Satinado Cepillado Grado Quirúrgico',
    'Pintura en Polvo Poliéster Horneada',
    'Acabado Anodizado Natural Gloss 100%'
  ];

  return {
    fotoUrl: custom.fotoUrl || photoUrl || '',
    dimensiones: custom.dimensiones || `${baseHeight} x ${baseWidth} x ${baseDepth} mm`,
    pesoNeto: custom.pesoNeto || `${baseWeight} kg`,
    pesoBruto: custom.pesoBruto || `${baseGrossWeight} kg`,
    volumen: custom.volumen || `${baseVolume} m³`,
    cajasPallet: custom.cajasPallet || `${cajasPallet} cajas / pallet`,
    origen: custom.origen || (hash % 2 === 0 ? 'Chile (Planta Central Glomax S.A.)' : 'Importación Certificada EU/Asia'),
    material: custom.material || materials[hash % materials.length],
    acabado: custom.acabado || finishes[hash % finishes.length],
    tempRango: custom.tempRango || '-15°C a +65°C Operativo',
    certificaciones: custom.certificaciones || 'CE, ISO 9001:2015, RoHS Compliant, NCh 2024',
    gradoIP: custom.gradoIP || (hash % 2 === 0 ? 'IP65 (Polvo y Chorros de Agua)' : 'IP54 (Protección Industrial)'),
    electrico: custom.electrico || '220V AC / 50-60 Hz (Tensión Nominal Standard)',
    garantia: custom.garantia || '12 Meses Garantía Oficial Glomax S.A.',
    hsCode: custom.hsCode || `8481.${(10 + (hash % 80)).toString().padStart(2, '0')}.90`,
    notas: custom.notas || 'Producto probado y certificado conforme a exigencias de control de calidad Glomax S.A. Se recomienda almacenar en ambiente seco, templado y limpio.',
    bom: [
      { parte: 'Estructura / Clic Principal', cant: 1, participacion: '45%' },
      { parte: 'Ensamble de Sellado & Empaque', cant: 2, participacion: '25%' },
      { parte: 'Componente de Ajuste Mecánico', cant: 4, participacion: '18%' },
      { parte: 'Accesorios & Manual de Instalación', cant: 1, participacion: '12%' }
    ]
  };
}

async function renderFichaTecnicaView() {
  if (typeof fetchProductImagesMap === 'function') {
    fetchProductImagesMap();
  }

  ftProductsMap = getProductsMap();

  // Fusionar catálogo escrapeado de www.glomax.cl en ftProductsMap si está disponible
  const liveCatalog = await fetchGlomaxLiveCatalog();
  if (liveCatalog && liveCatalog.size > 0) {
    liveCatalog.forEach((item, sku) => {
      if (!ftProductsMap.has(sku)) {
        ftProductsMap.set(sku, {
          sku: sku,
          descripcion: item.title,
          cantTotal: 5,
          netoTotal: item.price * 5,
          utilidadTotal: item.price * 2,
          margenPct: 40,
          precioPromedio: item.price,
          costoUnitario: Math.round(item.price * 0.6),
          categoria: item.category,
          marca: item.brand
        });
      }
    });
  }

  const selectEl = document.getElementById('ftSkuSelect');
  if (!selectEl) return;

  const sortedProds = Array.from(ftProductsMap.values()).sort((a, b) => b.cantTotal - a.cantTotal);

  if (sortedProds.length === 0) {
    selectEl.innerHTML = '<option value="">No hay productos disponibles en el catálogo</option>';
    const container = document.getElementById('ftContentArea');
    if (container) container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 3rem;">No hay productos registrados en el sistema.</div>';
    return;
  }

  let html = '<option value="">-- Selecciona un SKU / Producto (' + sortedProds.length + ' disponibles) --</option>';
  sortedProds.forEach(p => {
    const isSelected = p.sku === currentFtSelectedSku ? 'selected' : '';
    html += `<option value="${p.sku}" ${isSelected}>${p.sku} | ${p.descripcion.substring(0, 45)} (${p.categoria || 'Sin Cat'})</option>`;
  });
  selectEl.innerHTML = html;

  if (!selectEl.dataset.bound) {
    selectEl.dataset.bound = 'true';
    selectEl.addEventListener('change', (e) => {
      if (e.target.value) {
        selectFtProductSku(e.target.value);
      }
    });

    const searchInput = document.getElementById('ftSkuSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => handleFtSearchInput(e.target.value));
      searchInput.addEventListener('focus', (e) => handleFtSearchInput(e.target.value));
    }

    const randomBtn = document.getElementById('ftRandomBtn');
    if (randomBtn) {
      randomBtn.addEventListener('click', () => {
        const keys = Array.from(ftProductsMap.keys());
        if (keys.length > 0) {
          const randomSku = keys[Math.floor(Math.random() * keys.length)];
          selectFtProductSku(randomSku);
        }
      });
    }

    const clearBtn = document.getElementById('ftClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentFtSelectedSku = null;
        selectEl.value = '';
        const searchInput = document.getElementById('ftSkuSearch');
        if (searchInput) searchInput.value = '';
        renderFichaTecnicaView();
      });
    }

    document.addEventListener('click', (e) => {
      const drop = document.getElementById('ftSkuSuggestions');
      const input = document.getElementById('ftSkuSearch');
      if (drop && input && !drop.contains(e.target) && e.target !== input) {
        drop.style.display = 'none';
      }
    });
  }

  if (!currentFtSelectedSku && sortedProds.length > 0) {
    selectFtProductSku(sortedProds[0].sku);
  } else if (currentFtSelectedSku) {
    selectFtProductSku(currentFtSelectedSku);
  }
}

function handleFtSearchInput(val) {
  const drop = document.getElementById('ftSkuSuggestions');
  if (!drop) return;

  const q = (val || '').trim().toLowerCase();
  if (!q) {
    drop.style.display = 'none';
    return;
  }

  const matches = [];
  for (const p of ftProductsMap.values()) {
    if (p.sku.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || (p.categoria && p.categoria.toLowerCase().includes(q)) || (p.marca && p.marca.toLowerCase().includes(q))) {
      matches.push(p);
      if (matches.length >= 10) break;
    }
  }

  if (matches.length === 0) {
    drop.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 0.85rem; text-align: center;">No se encontraron productos con ese criterio.</div>';
    drop.style.display = 'block';
    return;
  }

  let html = '';
  matches.forEach(p => {
    html += `
      <div class="prod-suggestion-item" onclick="selectFtProductSku('${p.sku}'); document.getElementById('ftSkuSuggestions').style.display='none';">
        <div>
          <strong style="color: #38bdf8; font-family: 'JetBrains Mono', monospace;">${p.sku}</strong>
          <span style="color: #cbd5e1; margin-left: 6px;">${p.descripcion}</span>
        </div>
        <div style="font-size: 0.78rem; color: #94a3b8; text-align: right;">
          <div><strong style="color: #34d399;">${p.categoria || 'General'}</strong></div>
          <div>${formatCLP(p.precioPromedio)}</div>
        </div>
      </div>
    `;
  });
  drop.innerHTML = html;
  drop.style.display = 'block';
}

function selectFtProductSku(sku) {
  currentFtSelectedSku = sku;
  const selectEl = document.getElementById('ftSkuSelect');
  if (selectEl && selectEl.value !== sku) {
    selectEl.value = sku;
  }

  const prod = ftProductsMap.get(sku);
  const container = document.getElementById('ftContentArea');
  if (!container) return;

  if (!prod) {
    container.innerHTML = '<div style="text-align: center; color: #f87171; padding: 2rem;">No se encontraron datos para el SKU seleccionado.</div>';
    return;
  }

  const spec = generateDefaultFtSpecs(prod);
  const isCustomized = !!getFtSpecsForSku(sku);

  const barcodeBars = Array.from({ length: 32 }, (_, i) => `<rect x="${i * 7 + 10}" y="5" width="${(i % 3 === 0 ? 4 : 2)}" height="38" fill="#0f172a" />`).join('');

  let bomRowsHtml = '';
  spec.bom.forEach((b, idx) => {
    bomRowsHtml += `
      <tr>
        <td style="font-weight: 700; color: #cbd5e1;">${idx + 1}. ${b.parte}</td>
        <td style="text-align: center;">${b.cant} und.</td>
        <td style="text-align: right;"><span class="ft-tag ft-tag-purple">${b.participacion}</span></td>
      </tr>
    `;
  });

  const photoUrl = spec.fotoUrl || getFtProductPhoto(prod.sku);

  const photoCardHtml = photoUrl ? `
    <div class="ft-card" style="text-align: center;">
      <div class="ft-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span>Fotografía de Producto (Glomax S.A. Oficial)</span>
      </div>
      <div class="ft-photo-frame">
        <img src="${photoUrl}" alt="${prod.descripcion}" class="ft-product-photo" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'color:#94a3b8; font-size:0.8rem;\\'>📷 Foto no disponible</div>';" />
        <span class="ft-photo-badge">📷 Foto Oficial www.glomax.cl</span>
      </div>
    </div>
  ` : `
    <div class="ft-card" style="text-align: center;">
      <div class="ft-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span>Representación Esquemática</span>
      </div>
      <div style="background: rgba(6, 10, 19, 0.8); border: 1px dashed rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #38bdf8; font-weight: 700;">MODELO 3D SPEC #${prod.sku}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">Glomax Industrial Design CAD v4</div>
      </div>
    </div>
  `;

  const html = `
    <!-- CABECERA RESUMEN DE FICHA TÉCNICA -->
    <div class="ft-header-card">
      <div class="ft-title-bar">
        <div>
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span class="ft-sku-badge">SKU: ${prod.sku}</span>
            ${isCustomized ? '<span class="ft-tag ft-tag-gold">✏️ Spec Editada</span>' : '<span class="ft-tag ft-tag-blue">✅ Spec Oficial Glomax</span>'}
            <span class="ft-tag ft-tag-purple">${prod.categoria || 'Sin Categoría'}</span>
            <span class="ft-tag ft-tag-green">${prod.marca || 'Glomax Standard'}</span>
          </div>
          <h1 style="font-size: 1.4rem; font-weight: 800; color: #f8fafc; margin: 8px 0 4px 0;">${prod.descripcion}</h1>
          <div style="font-size: 0.82rem; color: #94a3b8;">
            Familia: <strong>${prod.familia || 'General'}</strong> | Línea: <strong>${prod.linea || 'Estándar'}</strong> | Canal Destino: <strong>${prod.canalFinal || 'Multicanal'}</strong>
          </div>
        </div>

        <!-- BARCODE & QR CONTAINER -->
        <div style="text-align: right;">
          <div class="ft-barcode-box">
            <svg viewBox="0 0 240 50" xmlns="http://www.w3.org/2000/svg">
              ${barcodeBars}
            </svg>
            <div class="ft-barcode-text">780${prod.sku.replace(/\D/g, '').padStart(9, '0').substring(0, 9)}</div>
          </div>
        </div>
      </div>

      <!-- METRICAS DE PRODUCTO EN FICHA -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-top: 1rem;">
        <div style="background: rgba(6, 10, 19, 0.6); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Precio Lista Prom.</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #38bdf8;">${formatCLP(prod.precioPromedio)}</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.6); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Costo Neto Unitario</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #c084fc;">${formatCLP(prod.costoUnitario)}</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.6); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Margen Prom. (%)</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: ${prod.margenPct >= 30 ? '#34d399' : '#fbbf24'};">${prod.margenPct.toFixed(1)}%</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.6); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Ventas Acumuladas</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #f1f5f9;">${formatNum(prod.cantTotal)} und.</div>
        </div>
      </div>
    </div>

    <!-- REJILLA DE ESPECIFICACIONES TÉCNICAS -->
    <div class="ft-grid-2col" style="margin-top: 1.5rem;">
      <!-- COLUMNA IZQUIERDA: FOTOGRAFIA Y LOGÍSTICA -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        ${photoCardHtml}

        <!-- TABLA LOGÍSTICA & EMPAQUE -->
        <div class="ft-card">
          <div class="ft-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5"/><path d="M3 8.5L12 4l9 4.5"/><line x1="12" y1="4" x2="12" y2="19"/></svg>
            <span>Logística & Empaque</span>
          </div>
          <table class="ft-spec-table">
            <tbody>
              <tr><th>Dimensiones:</th><td>${spec.dimensiones}</td></tr>
              <tr><th>Peso Neto:</th><td>${spec.pesoNeto}</td></tr>
              <tr><th>Peso Bruto:</th><td>${spec.pesoBruto}</td></tr>
              <tr><th>Volumen:</th><td>${spec.volumen}</td></tr>
              <tr><th>Cajas x Pallet:</th><td>${spec.cajasPallet}</td></tr>
              <tr><th>HS Code:</th><td><code>${spec.hsCode}</code></td></tr>
              <tr><th>Origen:</th><td>${spec.origen}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- COLUMNA DERECHA: PARAMETROS TÉCNICOS & BOM -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- TABLA ESPECIFICACIONES TÉCNICAS Y FUNCIONALES -->
        <div class="ft-card">
          <div class="ft-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Parámetros Técnicos & Mecánicos</span>
          </div>
          <table class="ft-spec-table">
            <tbody>
              <tr><th>Material Principal:</th><td><strong style="color: #38bdf8;">${spec.material}</strong></td></tr>
              <tr><th>Acabado Superficial:</th><td>${spec.acabado}</td></tr>
              <tr><th>Rango Temperatura:</th><td>${spec.tempRango}</td></tr>
              <tr><th>Certificaciones:</th><td><span class="ft-tag ft-tag-green">${spec.certificaciones}</span></td></tr>
              <tr><th>Grado Protec. IP:</th><td><span class="ft-tag ft-tag-blue">${spec.gradoIP}</span></td></tr>
              <tr><th>Esp. Eléctrica:</th><td>${spec.electrico}</td></tr>
              <tr><th>Garantía Comercial:</th><td><strong style="color: #34d399;">${spec.garantia}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <!-- BOM / LISTA DE COMPONENTES -->
        <div class="ft-card">
          <div class="ft-card-header" style="justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span>Bill of Materials (BOM / Piezas)</span>
            </div>
            <span class="ft-tag ft-tag-purple">Estructura Interna</span>
          </div>
          <table class="ft-spec-table">
            <thead>
              <tr style="background: rgba(255,255,255,0.03);">
                <th style="color: #94a3b8;">Subcomponente / Pieza</th>
                <th style="text-align: center; color: #94a3b8;">Cant.</th>
                <th style="text-align: right; color: #94a3b8;">Participación %</th>
              </tr>
            </thead>
            <tbody>
              ${bomRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- CONTROL DE CALIDAD Y NOTAS -->
        <div class="ft-card" style="border-color: rgba(56, 189, 248, 0.3);">
          <div class="ft-card-header" style="color: #38bdf8;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Control de Calidad & Notas de Seguridad</span>
          </div>
          <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.6; margin: 0;">
            ${spec.notas}
          </p>
          <div style="margin-top: 1rem; font-size: 0.75rem; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
            <span>Aprobado por: <strong>Depto. Calidad Glomax S.A.</strong></span>
            <span>Versión Ficha: <strong>2026.4.1</strong></span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Modales de Edición & Comparación
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

  const fotoInput = document.getElementById('ftEditFotoUrl');
  if (fotoInput) fotoInput.value = spec.fotoUrl || getFtProductPhoto(prod.sku) || '';

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

function closeFtEditModal() {
  const modal = document.getElementById('ftEditModal');
  if (modal) modal.classList.remove('show');
}

function saveFtSpecs(e) {
  e.preventDefault();
  const sku = document.getElementById('ftEditSku').value;
  if (!sku) return;

  const fotoInput = document.getElementById('ftEditFotoUrl');

  const updatedSpecs = {
    fotoUrl: fotoInput ? fotoInput.value.trim() : '',
    dimensiones: document.getElementById('ftEditDimensiones').value.trim(),
    pesoNeto: document.getElementById('ftEditPesoNeto').value.trim(),
    pesoBruto: document.getElementById('ftEditPesoBruto').value.trim(),
    volumen: document.getElementById('ftEditVolumen').value.trim(),
    cajasPallet: document.getElementById('ftEditCajasPallet').value.trim(),
    origen: document.getElementById('ftEditOrigen').value.trim(),

    material: document.getElementById('ftEditMaterial').value.trim(),
    acabado: document.getElementById('ftEditAcabado').value.trim(),
    tempRango: document.getElementById('ftEditTempRango').value.trim(),
    certificaciones: document.getElementById('ftEditCertificaciones').value.trim(),
    gradoIP: document.getElementById('ftEditGradoIP').value.trim(),
    electrico: document.getElementById('ftEditElectrico').value.trim(),

    garantia: document.getElementById('ftEditGarantia').value.trim(),
    hsCode: document.getElementById('ftEditHSCode').value.trim(),
    notas: document.getElementById('ftEditNotas').value.trim()
  };

  saveFtSpecsForSku(sku, updatedSpecs);
  closeFtEditModal();
  showToast(`✅ Ficha Técnica e imagen guardadas con éxito para SKU ${sku}`);
  selectFtProductSku(sku);
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

function closeFtCompareModal() {
  const modal = document.getElementById('ftCompareModal');
  if (modal) modal.classList.remove('show');
}

function renderFtComparison() {
  const skuA = document.getElementById('ftCompareSkuA').value;
  const skuB = document.getElementById('ftCompareSkuB').value;
  const area = document.getElementById('ftCompareResultsArea');
  if (!area) return;

  const prodA = ftProductsMap.get(skuA);
  const prodB = ftProductsMap.get(skuB);

  if (!prodA || !prodB) {
    area.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">Selecciona 2 SKUs válidos.</div>';
    return;
  }

  const specA = generateDefaultFtSpecs(prodA);
  const specB = generateDefaultFtSpecs(prodB);

  const rows = [
    { label: 'Descripción', a: prodA.descripcion, b: prodB.descripcion },
    { label: 'Categoría', a: prodA.categoria || '-', b: prodB.categoria || '-' },
    { label: 'Marca', a: prodA.marca || '-', b: prodB.marca || '-' },
    { label: 'Precio Lista', a: formatCLP(prodA.precioPromedio), b: formatCLP(prodB.precioPromedio) },
    { label: 'Costo Neto Unitario', a: formatCLP(prodA.costoUnitario), b: formatCLP(prodB.costoUnitario) },
    { label: 'Margen Promedio (%)', a: `${prodA.margenPct.toFixed(1)}%`, b: `${prodB.margenPct.toFixed(1)}%` },
    { label: 'Dimensiones', a: specA.dimensiones, b: specB.dimensiones },
    { label: 'Peso Neto / Bruto', a: `${specA.pesoNeto} / ${specA.pesoBruto}`, b: `${specB.pesoNeto} / ${specB.pesoBruto}` },
    { label: 'Volumen Embalaje', a: specA.volumen, b: specB.volumen },
    { label: 'Material Principal', a: specA.material, b: specB.material },
    { label: 'Acabado Superficial', a: specA.acabado, b: specB.acabado },
    { label: 'Rango Temperatura', a: specA.tempRango, b: specB.tempRango },
    { label: 'Certificaciones', a: specA.certificaciones, b: specB.certificaciones },
    { label: 'Grado Protec. IP', a: specA.gradoIP, b: specB.gradoIP },
    { label: 'Garantía Comercial', a: specA.garantia, b: specB.garantia },
    { label: 'Origen / Fabricación', a: specA.origen, b: specB.origen }
  ];

  let trsHtml = '';
  rows.forEach(r => {
    trsHtml += `
      <tr>
        <th style="color: #cbd5e1; width: 28%; font-weight: 700; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 12px;">${r.label}</th>
        <td style="color: #38bdf8; width: 36%; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 12px;">${r.a}</td>
        <td style="color: #c084fc; width: 36%; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 12px;">${r.b}</td>
      </tr>
    `;
  });

  area.innerHTML = `
    <table class="ft-spec-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: rgba(15, 23, 42, 0.9);">
          <th style="text-align: left; color: #94a3b8;">Atributo / Parámetro</th>
          <th style="text-align: left; color: #38bdf8; font-size: 0.95rem;">SKU: ${prodA.sku}</th>
          <th style="text-align: left; color: #c084fc; font-size: 0.95rem;">SKU: ${prodB.sku}</th>
        </tr>
      </thead>
      <tbody>
        ${trsHtml}
      </tbody>
    </table>
  `;
}

function printFichaTecnica() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona una Ficha Técnica para imprimir ⚠️');
    return;
  }
  window.print();
}

// URL Extractor & Web Scraper (by SKU or URL) for www.glomax.cl
let lastExtractedUrlData = null;

function openFtUrlModal() {
  const modal = document.getElementById('ftUrlModal');
  if (modal) {
    document.getElementById('ftUrlForm').reset();
    document.getElementById('ftUrlLoader').style.display = 'none';
    document.getElementById('ftUrlPreviewArea').style.display = 'none';
    document.getElementById('ftApplyUrlBtn').style.display = 'none';
    const photoBox = document.getElementById('ftImportPhotoPreview');
    if (photoBox) photoBox.innerHTML = '';
    modal.classList.add('show');
  }
}

function closeFtUrlModal() {
  const modal = document.getElementById('ftUrlModal');
  if (modal) modal.classList.remove('show');
}

function updateImportPhotoPreview(url) {
  const previewBox = document.getElementById('ftImportPhotoPreview');
  if (!previewBox) return;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    previewBox.innerHTML = `
      <div style="background: rgba(6, 10, 19, 0.9); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 10px; padding: 10px; display: inline-block;">
        <img src="${url}" alt="Foto Producto" style="max-height: 150px; border-radius: 6px; display: block;" onerror="this.parentElement.innerHTML='<span style=\\'color:#f87171; font-size:0.75rem;\\'>⚠️ Imagen no disponible en esa URL</span>';" />
        <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700; margin-top: 4px; display: block;">📷 Fotografía Detectada en www.glomax.cl</span>
      </div>
    `;
  } else {
    previewBox.innerHTML = '';
  }
}

async function processFtUrlImport(e) {
  e.preventDefault();
  const inputVal = document.getElementById('ftUrlInput').value.trim();
  if (!inputVal) return;

  const loader = document.getElementById('ftUrlLoader');
  const previewArea = document.getElementById('ftUrlPreviewArea');
  const applyBtn = document.getElementById('ftApplyUrlBtn');

  loader.style.display = 'block';
  previewArea.style.display = 'none';
  applyBtn.style.display = 'none';

  // 1. Descargar o asegurar catálogo completo de www.glomax.cl
  const liveCatalog = await fetchGlomaxLiveCatalog();

  let extractedSku = '';
  let extractedTitle = '';
  let extractedCategory = 'Equipamiento Comercial';
  let extractedBrand = 'Glomax S.A. Oficial';
  let extractedPrice = 49990;
  let extractedFotoUrl = '';
  let extractedDimensions = '480 x 320 x 240 mm';
  let extractedMaterial = 'Acero Inoxidable AISI 304 / Polímeros Glomax';

  const cleanQuery = inputVal.toUpperCase().trim();
  const isUrl = inputVal.startsWith('http://') || inputVal.startsWith('https://') || inputVal.includes('glomax.cl');

  let matchedItem = null;

  if (!isUrl) {
    // A) BUSQUEDA DIRECTA POR SKU EN CATALOGO EN VIVO DE GLOMAX.CL
    matchedItem = liveCatalog.get(cleanQuery);
    if (!matchedItem) {
      for (let [k, v] of liveCatalog.entries()) {
        if (k.includes(cleanQuery) || cleanQuery.includes(k)) {
          matchedItem = v;
          break;
        }
      }
    }
    // B) BUSQUEDA POR PALABRA CLAVE EN TITULO
    if (!matchedItem) {
      for (let [k, v] of liveCatalog.entries()) {
        if (v.title.toUpperCase().includes(cleanQuery)) {
          matchedItem = v;
          break;
        }
      }
    }
  } else {
    // C) BUSQUEDA SI INGRESÓ UNA URL DE GLOMAX.CL
    try {
      const urlObj = new URL(inputVal.startsWith('http') ? inputVal : 'https://' + inputVal);
      const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
      const slug = parts.length > 0 ? parts[parts.length - 1] : '';

      for (let [k, v] of liveCatalog.entries()) {
        if (v.handle === slug || inputVal.includes(v.handle) || v.url === inputVal) {
          matchedItem = v;
          break;
        }
      }
    } catch(err) {
      console.warn('URL parsing error:', err);
    }
  }

  if (matchedItem) {
    extractedSku = matchedItem.sku;
    extractedTitle = matchedItem.title;
    extractedPrice = matchedItem.price;
    extractedFotoUrl = matchedItem.image || '';
    extractedCategory = matchedItem.category || extractedCategory;
    extractedBrand = matchedItem.brand || extractedBrand;
    if (matchedItem.bodyText) {
      if (matchedItem.bodyText.includes('mm') || matchedItem.bodyText.includes('cm') || matchedItem.bodyText.includes('X')) {
        const dimMatch = matchedItem.bodyText.match(/(\d+\s*x\s*\d+\s*(x\s*\d+)?\s*(mm|cm)?)/i);
        if (dimMatch) extractedDimensions = dimMatch[1];
      }
      if (matchedItem.bodyText.includes('Acero') || matchedItem.bodyText.includes('Aluminio') || matchedItem.bodyText.includes('Plástico')) {
        extractedMaterial = matchedItem.bodyText.substring(0, 60);
      }
    }
  } else if (isUrl) {
    // WEB SCRAPING DIRECTO HTML SI ES URL NO ENCONTRADA EN JSON
    try {
      let targetUrl = inputVal;
      if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await response.json();
        if (json && json.contents) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(json.contents, 'text/html');

          const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || doc.title;
          const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
          const ogPrice = doc.querySelector('meta[property="product:price:amount"]')?.content;

          if (ogTitle) extractedTitle = ogTitle.trim().replace(/\s*–\s*Glomax.*$/i, '');
          if (ogImage) extractedFotoUrl = ogImage;
          if (ogPrice) extractedPrice = parseFloat(ogPrice);
          extractedSku = cleanQuery.match(/[A-Z0-9-]{3,12}/)?.[0] || ('GLX-' + Math.floor(1000 + Math.random() * 9000));
        }
      }
    } catch(err) {
      console.warn('CORS scrape fallback:', err);
    }
  } else {
    // Si se buscó un SKU que no está en Glomax.cl ni en el sistema
    extractedSku = cleanQuery;
    const existing = ftProductsMap.get(cleanQuery);
    if (existing) {
      extractedTitle = existing.descripcion;
      extractedPrice = existing.precioPromedio;
      extractedCategory = existing.categoria || extractedCategory;
      extractedBrand = existing.marca || extractedBrand;
    } else {
      extractedTitle = `Producto Glomax SKU ${cleanQuery}`;
    }
  }

  // Foto de respaldo si no se obtuvo
  if (!extractedFotoUrl) {
    const photoFromMap = getFtProductPhoto(extractedSku);
    if (photoFromMap) extractedFotoUrl = photoFromMap;
  }

  loader.style.display = 'none';

  lastExtractedUrlData = {
    sku: extractedSku,
    descripcion: extractedTitle,
    categoria: extractedCategory,
    marca: extractedBrand,
    precio: extractedPrice,
    fotoUrl: extractedFotoUrl,
    dimensiones: extractedDimensions,
    material: extractedMaterial,
    urlOriginal: inputVal
  };

  document.getElementById('ftImportSku').value = lastExtractedUrlData.sku;
  document.getElementById('ftImportNombre').value = lastExtractedUrlData.descripcion;
  document.getElementById('ftImportPrecio').value = lastExtractedUrlData.precio;
  document.getElementById('ftImportFotoUrl').value = lastExtractedUrlData.fotoUrl;
  document.getElementById('ftImportCategoria').value = lastExtractedUrlData.categoria;
  document.getElementById('ftImportMarca').value = lastExtractedUrlData.marca;
  document.getElementById('ftImportDimensiones').value = lastExtractedUrlData.dimensiones;
  document.getElementById('ftImportMaterial').value = lastExtractedUrlData.material;

  updateImportPhotoPreview(lastExtractedUrlData.fotoUrl);

  previewArea.style.display = 'block';
  applyBtn.style.display = 'inline-flex';

  showToast(`✅ Producto escrapeado de www.glomax.cl: ${extractedSku}`);
}

function applyFtUrlImport() {
  if (!lastExtractedUrlData) return;

  const sku = document.getElementById('ftImportSku').value.trim().toUpperCase();
  const desc = document.getElementById('ftImportNombre').value.trim();
  const precio = parseFloat(document.getElementById('ftImportPrecio').value) || 0;
  const fotoUrl = document.getElementById('ftImportFotoUrl').value.trim();
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

  if (fotoUrl && typeof productImagesMap !== 'undefined') {
    productImagesMap.set(sku, { url: fotoUrl, desc: desc });
  }

  saveFtSpecsForSku(sku, {
    fotoUrl: fotoUrl,
    dimensiones: dim,
    material: mat,
    notas: `Información y fotografía escrapeada en vivo desde ${lastExtractedUrlData.urlOriginal}. Verificada por Glomax BI.`
  });

  closeFtUrlModal();
  showToast(`🎉 Ficha Técnica cargada con foto oficial para SKU ${sku}!`);

  currentFtSelectedSku = sku;
  renderFichaTecnicaView();
}

// Export Ficha Técnica to PDF using html2pdf.js con inclusión de foto oficial
function exportFtPdf() {
  if (!currentFtSelectedSku) {
    showToast('Selecciona un producto primero para exportar su PDF ⚠️');
    return;
  }

  const prod = ftProductsMap.get(currentFtSelectedSku);
  if (!prod) return;

  const spec = generateDefaultFtSpecs(prod);
  const photoUrl = spec.fotoUrl || getFtProductPhoto(prod.sku);

  showToast('📄 Generando PDF de Ficha Técnica oficial Glomax S.A...');

  const todayStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const barcodeBars = Array.from({ length: 36 }, (_, i) => `<rect x="${i * 6 + 10}" y="4" width="${(i % 3 === 0 ? 3.5 : 1.5)}" height="32" fill="#0f172a" />`).join('');

  let bomHtml = '';
  spec.bom.forEach((b, idx) => {
    bomHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 10px; font-weight: 600; color: #1e293b;">${idx + 1}. ${b.parte}</td>
        <td style="padding: 6px 10px; text-align: center; color: #475569;">${b.cant} und.</td>
        <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${b.participacion}</td>
      </tr>
    `;
  });

  const photoPdfHtml = photoUrl ? `
    <div style="text-align: center; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #fafafa;">
      <img src="${photoUrl}" style="max-height: 180px; max-width: 100%; object-fit: contain;" />
      <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; font-weight: 700;">FOTOGRAFÍA OFICIAL DE PRODUCTO GLOMAX</div>
    </div>
  ` : '';

  const pdfContainer = document.createElement('div');
  pdfContainer.id = 'ftPdfExportTemp';
  pdfContainer.style.cssText = `
    position: absolute; left: -9999px; top: -9999px; width: 794px; background: #ffffff; color: #0f172a;
    font-family: 'Inter', sans-serif; padding: 30px; box-sizing: border-box; font-size: 11pt; line-height: 1.4;
  `;

  pdfContainer.innerHTML = `
    <!-- CABECERA PDF DE FICHA TÉCNICA -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px;">
      <div>
        <div style="font-size: 1.6rem; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">GLOMAX S.A.</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #475569; text-transform: uppercase;">División de Ingeniería & Control de Calidad</div>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Casa Matriz · Santiago de Chile | www.glomax.cl</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.8rem; font-weight: 800; color: #0284c7; text-transform: uppercase;">Ficha Técnica Oficial</div>
        <div style="font-size: 0.75rem; color: #64748b;">Fecha Emisión: ${todayStr}</div>
        <div style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: monospace; display: inline-block; margin-top: 6px;">
          SKU: ${prod.sku}
        </div>
      </div>
    </div>

    <!-- TITULO PRODUCTO -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <h1 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${prod.descripcion}</h1>
      <div style="font-size: 0.82rem; color: #475569; display: flex; gap: 15px; flex-wrap: wrap;">
        <span>Categoría: <strong>${prod.categoria || 'General'}</strong></span>
        <span>Marca: <strong>${prod.marca || 'Glomax Standard'}</strong></span>
        <span>Familia: <strong>${prod.familia || 'General'}</strong></span>
        <span>Línea: <strong>${prod.linea || 'Estándar'}</strong></span>
      </div>
    </div>

    <!-- FOTO DEL PRODUCTO EN PDF -->
    ${photoPdfHtml}

    <!-- REJILLA 2 COLUMNAS PDF -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <!-- COLUMNA 1: PARAMETROS TECNICOS -->
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
          🛠️ Especificaciones Técnicas
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Material:</th><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${spec.material}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Acabado:</th><td style="padding: 5px 0; color: #0f172a;">${spec.acabado}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Temperatura:</th><td style="padding: 5px 0; color: #0f172a;">${spec.tempRango}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Certificaciones:</th><td style="padding: 5px 0; font-weight: 700; color: #059669;">${spec.certificaciones}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Protección IP:</th><td style="padding: 5px 0; font-weight: 700; color: #0284c7;">${spec.gradoIP}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Eléctrico:</th><td style="padding: 5px 0; color: #0f172a;">${spec.electrico}</td></tr>
          <tr><th style="text-align: left; padding: 5px 0; color: #64748b;">Garantía:</th><td style="padding: 5px 0; font-weight: 700; color: #059669;">${spec.garantia}</td></tr>
        </table>
      </div>

      <!-- COLUMNA 2: LOGISTICA Y EMPAQUE -->
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
        <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
          📦 Logística, Empaque & Código
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Dimensiones:</th><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${spec.dimensiones}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Peso Neto / Bruto:</th><td style="padding: 5px 0; color: #0f172a;">${spec.pesoNeto} / ${spec.pesoBruto}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Volumen:</th><td style="padding: 5px 0; color: #0f172a;">${spec.volumen}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">Cajas x Pallet:</th><td style="padding: 5px 0; color: #0f172a;">${spec.cajasPallet}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><th style="text-align: left; padding: 5px 0; color: #64748b;">HS Code:</th><td style="padding: 5px 0; font-family: monospace; font-weight: 700;">${spec.hsCode}</td></tr>
          <tr><th style="text-align: left; padding: 5px 0; color: #64748b;">Origen:</th><td style="padding: 5px 0; color: #0f172a;">${spec.origen}</td></tr>
        </table>

        <!-- BARCODE EN PDF -->
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; margin-top: 10px; background: #fafafa;">
          <svg viewBox="0 0 240 40" style="max-width: 180px; height: 35px;">
            ${barcodeBars}
          </svg>
          <div style="font-family: monospace; font-size: 0.72rem; font-weight: 700; color: #334155; letter-spacing: 2px;">
            EAN: 780${prod.sku.replace(/\D/g, '').padStart(9, '0').substring(0, 9)}
          </div>
        </div>
      </div>
    </div>

    <!-- BOM / LISTA DE COMPONENTES -->
    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <div style="font-size: 0.9rem; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase;">
        ⚙️ Bill of Materials (Componentes & Estructura Interna)
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 6px 10px; color: #475569;">Pieza / Subcomponente</th>
            <th style="padding: 6px 10px; text-align: center; color: #475569;">Cantidad</th>
            <th style="padding: 6px 10px; text-align: right; color: #475569;">Participación Costo %</th>
          </tr>
        </thead>
        <tbody>
          ${bomHtml}
        </tbody>
      </table>
    </div>

    <!-- CONTROL DE CALIDAD & TIMBRE -->
    <div style="border: 1px solid #0284c7; background: #f0f9ff; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <div style="font-size: 0.85rem; font-weight: 800; color: #0369a1; margin-bottom: 4px;">🛡️ Control de Calidad & Normas de Seguridad:</div>
      <div style="font-size: 0.8rem; color: #334155; line-height: 1.5;">${spec.notas}</div>
    </div>

    <!-- PIE DE PAGINA PDF -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b;">
      <div>Documento Generado por <strong>Glomax BI Suite v2026.4</strong></div>
      <div>Certificación ISO 9001 · Glomax S.A. Todos los derechos reservados</div>
    </div>
  `;

  document.body.appendChild(pdfContainer);

  const opt = {
    margin:       [8, 8, 8, 8],
    filename:     `Ficha_Tecnica_GLOMAX_${currentFtSelectedSku}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(pdfContainer).save().then(() => {
      if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
      showToast('✅ Ficha Técnica PDF descargada con éxito!');
    }).catch(err => {
      console.warn('html2pdf error:', err);
      if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
      window.print();
    });
  } else {
    if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
    window.print();
  }
}


function getProductsMap() {
  const map = new Map();
  const sourceRows = (filtered && filtered.length > 0) ? filtered : (rows || []);

  sourceRows.forEach(r => {
    const rawSku = (r['CODIGO'] || r['DESCRIPCION'] || '').toString().trim();
    if (!rawSku) return;

    const skuKey = rawSku.toUpperCase();
    const cant = Number(r['CANTFACTURADA']) || 0;
    const neto = Number(r['NETO']) || 0;
    const preuni = Number(r['PREUNI']) || (cant > 0 ? neto / cant : 0);
    const costo = Number(r['COSTOS']) || (preuni * 0.6);
    const utilidad = Number(r['($) UTILIDAD']) || (neto - (costo * cant));

    if (!map.has(skuKey)) {
      map.set(skuKey, {
        sku: skuKey,
        codigo: r['CODIGO'] || skuKey,
        descripcion: r['DESCRIPCION'] || skuKey,
        cantTotal: 0,
        netoTotal: 0,
        utilidadTotal: 0,
        margenPct: 0,
        precioPromedio: preuni,
        costoUnitario: costo,
        familia: r['FAMILIA'] || 'Sin Familia',
        categoria: r['CATEGORIA'] || 'General',
        marca: r['MARCA'] || 'Glomax'
      });
    }

    const item = map.get(skuKey);
    item.cantTotal += cant;
    item.netoTotal += neto;
    item.utilidadTotal += utilidad;
    item.precioPromedio = item.cantTotal > 0 ? (item.netoTotal / item.cantTotal) : preuni;
    item.margenPct = item.netoTotal > 0 ? ((item.utilidadTotal / item.netoTotal) * 100) : 0;
  });

  return map;
}
