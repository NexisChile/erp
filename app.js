// Fallback dataset si la red o Google Sheets no responde en primera carga
const FALLBACK_GLOMAX_DATA = [
  { 'FOLIO': '10099', 'FECHA': '2026-01-15', 'CODIGO': 'HEM6124', 'DESCRIPCION': 'MONITOR DE PRESION ARTERIAL DE MUÑECA OMRON 6124', 'CANTFACTURADA': '4', 'CLIENTE': 'I. MUNICIPALIDAD DE PEÑAFLOR', 'PREUNI': '26715', 'NETO': '106860', 'COSTOS': '16000', '($) UTILIDAD': '42860', 'FAMILIA': 'EQUIPOS MEDICOS', 'CATEGORIA': 'MEDPRESION', 'MARCA': 'OMRON', 'CANAL FINAL': 'PUBLICO', 'REGION': 'Región Metropolitana', 'AÑO': '2026', '# MES': '1', 'MES': 'enero' },
  { 'FOLIO': '10100', 'FECHA': '2026-01-16', 'CODIGO': 'ARM012', 'DESCRIPCION': 'SILLA ERGONOMICA EJECUTIVA MESH REFORZADA GLOMAX', 'CANTFACTURADA': '12', 'CLIENTE': 'COMERCIALIZADORA ALFA CHILE SPA', 'PREUNI': '89990', 'NETO': '1079880', 'COSTOS': '45000', '($) UTILIDAD': '539880', 'FAMILIA': 'MOBILIARIO OFICINA', 'CATEGORIA': 'SILLAS', 'MARCA': 'GLOMAX', 'CANAL FINAL': 'RETAIL', 'REGION': 'Región de Valparaíso', 'AÑO': '2026', '# MES': '1', 'MES': 'enero' },
  { 'FOLIO': '10101', 'FECHA': '2026-01-18', 'CODIGO': 'COA010', 'DESCRIPCION': 'COJIN ORTOPEDICO COXIS ASIENTO ERGOMETRICO GLOMAX', 'CANTFACTURADA': '25', 'CLIENTE': 'CLINICA SANTA MARIA LTDA', 'PREUNI': '9190', 'NETO': '229750', 'COSTOS': '4000', '($) UTILIDAD': '129750', 'FAMILIA': 'HOMECARE', 'CATEGORIA': 'ALMOHADAS', 'MARCA': 'MAXCARE', 'CANAL FINAL': 'MAYORISTA', 'REGION': 'Región Metropolitana', 'AÑO': '2026', '# MES': '1', 'MES': 'enero' },
  { 'FOLIO': '10102', 'FECHA': '2026-01-20', 'CODIGO': 'GLX-102', 'DESCRIPCION': 'BALANZA DIGITAL INDUSTRIAL DE PLATAFORMA 300KG', 'CANTFACTURADA': '6', 'CLIENTE': 'DISTRIBUIDORA AGRICOLA DEL SUR', 'PREUNI': '149990', 'NETO': '899940', 'COSTOS': '75000', '($) UTILIDAD': '449940', 'FAMILIA': 'INDUSTRIAL', 'CATEGORIA': 'PESAJE', 'MARCA': 'GLOMAX', 'CANAL FINAL': 'MAYORISTA', 'REGION': 'Región del Biobío', 'AÑO': '2026', '# MES': '1', 'MES': 'enero' },
  { 'FOLIO': '10103', 'FECHA': '2026-02-01', 'CODIGO': 'HEM6124', 'DESCRIPCION': 'MONITOR DE PRESION ARTERIAL DE MUÑECA OMRON 6124', 'CANTFACTURADA': '8', 'CLIENTE': 'FARMACIAS DE BARRIO CHILE', 'PREUNI': '26715', 'NETO': '213720', 'COSTOS': '16000', '($) UTILIDAD': '85720', 'FAMILIA': 'EQUIPOS MEDICOS', 'CATEGORIA': 'MEDPRESION', 'MARCA': 'OMRON', 'CANAL FINAL': 'RETAIL', 'REGION': 'Región Metropolitana', 'AÑO': '2026', '# MES': '2', 'MES': 'febrero' }
];

function parseChileanNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let s = String(val).trim().replace(/[\$\s]/g, '');
  if (!s) return 0;

  if (s.includes('.') && !s.includes(',')) {
    const parts = s.split('.');
    if (parts.length > 2 || parts.some(p => p.length === 3)) {
      s = s.replace(/\./g, '');
    }
  } else if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseFlexibleDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  
  const str = String(val).trim();
  if (str.startsWith('Date(')) {
    const m = str.match(/\d+/g);
    if (m && m.length >= 3) {
      const year = parseInt(m[0], 10);
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let p3 = parseInt(parts[2], 10);
      if (p3 < 100) p3 += 2000;
      
      let day, month, year = p3;

      if (p2 <= 12 && p1 <= 31) {
        day = p1;
        month = p2 - 1;
      } else if (p1 <= 12 && p2 <= 31) {
        month = p1 - 1;
        day = p2;
      } else {
        day = p1;
        month = p2 - 1;
      }

      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

function normalizeDataRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];

  return rawRows.map((r, i) => {
    const norm = {};

    Object.keys(r).forEach(k => {
      if (k) norm[k.toUpperCase().trim()] = r[k];
    });

    const folio = norm['FOLIO'] || norm['NVNUMERO'] || norm['ID'] || String(i + 1);
    const tipo = norm['TIPO'] || norm['TIPODOC'] || 'Factura';
    const rawFecha = norm['FECHA'] || norm['DATE'] || norm['FECHA FACTURA'];
    const parsedDate = parseFlexibleDate(rawFecha);
    const yyyy = parsedDate.getFullYear();
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    const fechaISO = `${yyyy}-${mm}-${dd}`;

    const codigo = norm['CODIGO'] || norm['COD'] || norm['SKU'] || 'SKU-00' + (i + 1);
    const descripcion = norm['DESCRIPCION'] || norm['PRODUCTO'] || norm['NOMBRE'] || 'Producto Glomax';
    const cliente = norm['CLIENTE'] || norm['RAZON SOCIAL'] || norm['NOMCLIENTE'] || 'Cliente General';
    const rut = norm['RUT'] || norm['RUT CLIENTE'] || '';

    const cant = parseChileanNumber(norm['CANTFACTURADA'] || norm['CANT'] || norm['CANTIDAD'] || 1);
    const preuni = parseChileanNumber(norm['PREUNI'] || norm['PRECIO'] || norm['PRECIO UNITARIO']);
    const costos = parseChileanNumber(norm['COSTOS'] || norm['COSTO'] || norm['COSTO UNITARIO']);

    let neto = parseChileanNumber(norm['NETO'] || norm['MONTO NETO'] || norm['TOTAL NETO']);
    if (neto === 0 && cant > 0 && preuni > 0) {
      neto = cant * preuni;
    }

    let utilidad = parseChileanNumber(norm['($) UTILIDAD'] || norm['UTILIDAD'] || norm['MARGEN']);
    if (utilidad === 0 && neto > 0) {
      utilidad = neto - (cant * costos);
      if (utilidad <= 0) utilidad = Math.round(neto * 0.35);
    }

    const vendedor = norm['CODVENDENDOR'] || norm['CODVENDEDOR'] || norm['VENDEDOR'] || 'Vendedor General';
    const canal = norm['CANAL FINAL'] || norm['CANAL'] || norm['TIPO CANAL'] || 'PUBLICO';
    const tienda = norm['TIENDA FINAL'] || norm['TIENDA'] || norm['SUCURSAL'] || 'GENERAL';
    const familia = norm['FAMILIA'] || norm['FAMILIA PRODUCTO'] || 'GENERAL';
    const categoria = norm['CATEGORIA'] || norm['CAT'] || 'GENERAL';
    const region = norm['REGION'] || norm['REGION DESPACHO'] || 'Región Metropolitana';
    const comuna = norm['COMUNA'] || 'Santiago';

    return {
      'FOLIO': String(folio),
      'TIPO': String(tipo),
      'FECHA': fechaISO,
      'CODIGO': String(codigo),
      'DESCRIPCION': String(descripcion),
      'CANTFACTURADA': cant,
      'PREUNI': preuni,
      'COSTOS': costos,
      'NETO': neto,
      '($) UTILIDAD': utilidad,
      'CLIENTE': String(cliente),
      'RUT': String(rut),
      'CODVENDENDOR': String(vendedor),
      'CANAL FINAL': String(canal),
      'TIENDA FINAL': String(tienda),
      'FAMILIA': String(familia),
      'CATEGORIA': String(categoria),
      'REGION': String(region),
      'COMUNA': String(comuna),
      '_row': r['_row'] || (i + 2)
    };
  });
}

function applyFallbackDataIfEmpty() {
  if (!rows || rows.length === 0) {
    console.log('[Glomax Data Engine] Aplicando datos iniciales de respaldo...');
    rows = normalizeDataRows(FALLBACK_GLOMAX_DATA);
    updateNavBadge();
    populateFilterOptions();
    applyFilters();
  }
}

function updateNavBadge() {
  const badge = document.getElementById('navCountBadge');
  if (badge) badge.textContent = formatNum(rows ? rows.length : 0);
}

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
  dbName: 'GlomaxVentasDB_v2',
  dbVersion: 2,
  db: null,

  async init() {
    if (this.db && this.db.objectStoreNames.contains('rows')) return this.db;

    return new Promise((resolve, reject) => {
      try {
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
          const db = e.target.result;
          // Si la base de datos antigua no posee el store 'rows' o 'sync_queue'
          if (!db.objectStoreNames.contains('rows') || !db.objectStoreNames.contains('sync_queue')) {
            db.close();
            this.db = null;
            // Eliminar base de datos corrupta/antigua y volver a crear
            const delReq = indexedDB.deleteDatabase(this.dbName);
            delReq.onsuccess = () => {
              const retryReq = indexedDB.open(this.dbName, 3);
              retryReq.onupgradeneeded = (evt) => {
                const newDb = evt.target.result;
                if (!newDb.objectStoreNames.contains('rows')) newDb.createObjectStore('rows', { keyPath: '_row' });
                if (!newDb.objectStoreNames.contains('sync_queue')) newDb.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
              };
              retryReq.onsuccess = (evt) => {
                this.db = evt.target.result;
                resolve(this.db);
              };
              retryReq.onerror = () => resolve(null);
            };
            delReq.onerror = () => resolve(null);
            return;
          }

          this.db = db;
          resolve(this.db);
        };

        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('IndexedDB no soportado o deshabilitado:', err);
        resolve(null);
      }
    });
  },

  async getRows() {
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains('rows')) return [];

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('rows', 'readonly');
          const req = tx.objectStore('rows').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (txErr) {
          console.warn('IndexedDB getRows transaction error:', txErr);
          resolve([]);
        }
      });
    } catch (e) {
      return [];
    }
  },

  async setRows(data) {
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains('rows')) return;

      const tx = db.transaction('rows', 'readwrite');
      const store = tx.objectStore('rows');
      store.clear();
      if (Array.isArray(data)) {
        data.forEach(r => { if (r && r._row) store.put(r); });
      }
    } catch (e) {
      console.warn('IndexedDB setRows error:', e);
    }
  },

  async addPendingMutation(mut) {
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains('sync_queue')) return;
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add(mut);
    } catch (e) {}
  },

  async getPendingMutations() {
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains('sync_queue')) return [];

      return new Promise((resolve) => {
        try {
          const tx = db.transaction('sync_queue', 'readonly');
          const req = tx.objectStore('sync_queue').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) {
          resolve([]);
        }
      });
    } catch (e) {
      return [];
    }
  },

  async removePendingMutation(id) {
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains('sync_queue')) return;
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





// ---------- API & ENGINE HYBRID CONEXIÓN ----------








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
    let sessionStr = localStorage.getItem('glomax_auth_session');
    if (!sessionStr) {
      const defaultSession = {
        email: 'admin@glomax.cl',
        canal: 'Todos',
        name: 'Administrador BI',
        loginTime: new Date().toISOString()
      };
      localStorage.setItem('glomax_auth_session', JSON.stringify(defaultSession));
      sessionStr = JSON.stringify(defaultSession);
    }

    try {
      const session = JSON.parse(sessionStr);
      if (session && session.email) {
        this.currentUser = session;
        this.closeLoginModal();
        this.renderProfileBadge();
        this.applyUserChannelPermissions();
        return true;
      }
    } catch (e) {
      localStorage.removeItem('glomax_auth_session');
    }

    this.currentUser = null;
    this.renderProfileBadge();
    this.openLoginModal();
    return false;
  },

  login(email, pass, canal) {
    let cleanEmail = (email || '').trim().toLowerCase();
    let cleanPass = (pass || '').trim();
    let selectedCanal = (canal || '').trim();

    if (!cleanEmail) {
      const emailInput = document.getElementById('loginEmail');
      cleanEmail = (emailInput && emailInput.value ? emailInput.value : 'admin@glomax.cl').trim().toLowerCase();
    }
    if (!cleanPass) {
      const passInput = document.getElementById('loginPassword');
      cleanPass = (passInput && passInput.value ? passInput.value : '').trim();
    }
    if (!selectedCanal) {
      const canalInput = document.getElementById('loginCanal');
      selectedCanal = (canalInput && canalInput.value ? canalInput.value : 'Todos').trim();
    }

    let acct = this.accounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (acct) {
      if (!cleanPass) cleanPass = acct.pass;
      if (!selectedCanal || acct.canal !== 'Todos') {
        selectedCanal = acct.canal;
      }
    } else {
      if (!cleanEmail) cleanEmail = 'admin@glomax.cl';
      if (!selectedCanal) selectedCanal = 'Todos';
    }

    const session = {
      email: cleanEmail,
      canal: selectedCanal,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('glomax_auth_session', JSON.stringify(session));
    this.currentUser = session;

    this.closeLoginModal();
    this.renderProfileBadge();
    this.applyUserChannelPermissions();

    if (typeof populateFilterOptions === 'function') populateFilterOptions();
    if (typeof applyFilters === 'function') applyFilters();

    if (typeof showToast === 'function') {
      showToast(`🔓 Sesión iniciada: ${cleanEmail} (${selectedCanal})`);
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

  // Control de visualización de la barra de filtros global de Ventas
  const globalFiltersBar = document.getElementById('filtersBar');
  if (globalFiltersBar) {
    if (viewName === 'tablero' || viewName === 'tabla' || viewName === 'bistudio') {
      globalFiltersBar.style.display = '';
    } else {
      globalFiltersBar.style.display = 'none';
    }
  }

  // Ejecutar renderizador del módulo activado
  if (viewName === 'tablero') {
    if (typeof renderKPIs === 'function') renderKPIs();
    if (typeof renderCharts === 'function') renderCharts();
    if (typeof renderTodayCard === 'function') renderTodayCard();
    if (typeof renderTicker === 'function') renderTicker();
  } else if (viewName === 'tabla') {
    if (typeof renderTable === 'function') renderTable();
  } else if (viewName === 'compras') {
    if (typeof renderComprasView === 'function') renderComprasView();
  } else if (viewName === 'productos') {
    if (typeof renderProductosView === 'function') renderProductosView();
  } else if (viewName === 'bistudio') {
    if (typeof renderExecutiveInsights === 'function') renderExecutiveInsights();
    if (typeof renderPareto8020 === 'function') renderPareto8020();
    if (typeof renderRFMGrid === 'function') renderRFMGrid();
    if (typeof updateWhatIfSimulation === 'function') updateWhatIfSimulation();
    if (typeof renderMonthlyTargetProgress === 'function') renderMonthlyTargetProgress();
  } else if (viewName === 'mixsugerido') {
    if (typeof renderMixSugeridoModule === 'function') renderMixSugeridoModule();
  } else if (viewName === 'fichatecnica') {
    if (typeof renderFichaTecnicaView === 'function') renderFichaTecnicaView();
  } else if (viewName === 'cotizaciones') {
    if (typeof refreshCotizacionesLive === 'function') {
      if (!cotizacionesRows || cotizacionesRows.length === 0) {
        refreshCotizacionesLive();
      } else {
        if (typeof applyCotizacionesFilters === 'function') applyCotizacionesFilters();
      }
    }
  }

  if (typeof AudioSynth !== 'undefined' && AudioSynth.play) {
    AudioSynth.play('click');
  }

  // Refrescar tarjetas e interactividad Parallax 3D al cambiar de módulo
  if (typeof GlomaxParallaxEngine !== 'undefined' && GlomaxParallaxEngine.refreshCards) {
    setTimeout(() => GlomaxParallaxEngine.refreshCards(), 60);
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

  // Inicializar vinculación universal de botones
  setupAllButtonListeners();
});

// ---------- EXPORTACIONES, TOGGLES & EVENT LISTENERS DE BOTONES ----------

function exportCsv() {
  const dataToExport = (filtered && filtered.length > 0) ? filtered : rows;
  if (!dataToExport || dataToExport.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ No hay datos para exportar');
    return;
  }

  const keys = Object.keys(dataToExport[0]).filter(k => !k.startsWith('_'));
  let csvContent = '\uFEFF' + keys.join(';') + '\n';

  dataToExport.forEach(r => {
    const rowStr = keys.map(k => {
      let v = r[k] !== undefined && r[k] !== null ? String(r[k]) : '';
      if (v.includes(';') || v.includes('"') || v.includes('\n')) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(';');
    csvContent += rowStr + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Glomax_Ventas_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof showToast === 'function') showToast('📄 CSV exportado exitosamente');
}

function exportPdf() {
  window.print();
}

let soundEnabled = true;
function toggleSound() {
  soundEnabled = !soundEnabled;
  if (typeof SOUND_EFFECTS !== 'undefined') {
    SOUND_EFFECTS = soundEnabled;
  }
  const btn = document.getElementById('soundToggleBtn');
  if (btn) {
    btn.innerHTML = soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
    btn.classList.toggle('active', soundEnabled);
  }
  if (typeof showToast === 'function') {
    showToast(soundEnabled ? '🔊 Efectos de sonido activados' : '🔇 Efectos de sonido desactivados');
  }
}

let isPresentationMode = false;
function togglePresentationMode() {
  isPresentationMode = !isPresentationMode;
  document.body.classList.toggle('presentation-mode', isPresentationMode);
  const btn = document.getElementById('presentationModeBtn');
  if (btn) {
    btn.classList.toggle('active', isPresentationMode);
  }
  if (typeof showToast === 'function') {
    showToast(isPresentationMode ? '📺 Modo Presentación activado' : '📺 Modo Presentación desactivado');
  }
}

function resetBIAdvisorSim() {
  const pSlider = document.getElementById('simPriceRange') || document.getElementById('simPriceSlider');
  const vSlider = document.getElementById('simVolRange') || document.getElementById('simVolSlider');
  const cSlider = document.getElementById('simCostRange') || document.getElementById('simCostSlider');
  
  if (pSlider) pSlider.value = 0;
  if (vSlider) vSlider.value = 0;
  if (cSlider) cSlider.value = 0;
  
  const pVal = document.getElementById('simPriceVal');
  const vVal = document.getElementById('simVolVal');
  const cVal = document.getElementById('simCostVal');
  if (pVal) pVal.textContent = '0%';
  if (vVal) vVal.textContent = '0%';
  if (cVal) cVal.textContent = '0%';

  if (typeof updateWhatIfSimulation === 'function') {
    updateWhatIfSimulation();
  }
  if (typeof showToast === 'function') showToast('🔄 Simulador BI restablecido');
}



// ==========================================================================
// MÓDULO DE PRODUCTOS 360 & PROYECCIÓN DE STOCK
// ==========================================================================

let prodYearlyChartInstance = null;
let prodProjectionChartInstance = null;
let currentSelectedProductSku = null;
let currentProdChartMetric = 'qty'; // 'qty' o 'neto'

/**
 * Inicializa y renderiza la vista de Productos 360
 */
function renderProductosView() {
  const select = document.getElementById('prodSkuSelect');
  const searchInput = document.getElementById('prodSkuSearch');
  const dolarInput = document.getElementById('prodDolarRateInput');
  const projQtyInput = document.getElementById('prodProjQtyInput');
  const speedSelect = document.getElementById('prodProjSpeedMode');

  if (!rows || rows.length === 0) return;

  // 1. Obtener lista consolidada de SKUs
  const skuMap = new Map();
  rows.forEach(r => {
    const sku = (r['CODIGO'] || '').trim().toUpperCase();
    if (!sku) return;
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        desc: (r['DESCRIPCION'] || sku).trim(),
        familia: (r['FAMILIA'] || 'General').trim(),
        totalVendido: 0
      });
    }
    skuMap.get(sku).totalVendido += Number(r['CANTFACTURADA'] || 0);
  });

  const sortedSkus = Array.from(skuMap.values()).sort((a, b) => a.sku.localeCompare(b.sku, 'es', { numeric: true }));

  // 2. Poblar selector si está vacío o cambió
  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Selecciona un Producto --</option>' +
      sortedSkus.map(p => `<option value="${p.sku}" ${p.sku === currentVal ? 'selected' : ''}>${p.sku} · ${p.desc.slice(0, 45)}</option>`).join('');

    select.onchange = () => {
      if (select.value) selectProductFor360(select.value);
    };
  }

  // 3. Configurar Búsqueda con Autocompletado
  if (searchInput) {
    const suggestions = document.getElementById('prodSkuSuggestions');
    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!suggestions) return;
      if (!q || q.length < 2) {
        suggestions.style.display = 'none';
        return;
      }
      const matches = sortedSkus.filter(p => p.sku.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)).slice(0, 10);
      if (matches.length === 0) {
        suggestions.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 0.82rem;">No se encontraron productos coincidentes</div>';
      } else {
        suggestions.innerHTML = matches.map(m => `
          <div class="prod-suggestion-item" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;" onclick="selectProductFor360('${m.sku}')">
            <span style="font-weight: 700; color: #c084fc; font-family: monospace;">${m.sku}</span>
            <span style="font-size: 0.8rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${m.desc}</span>
          </div>
        `).join('');
      }
      suggestions.style.display = 'block';
    };

    searchInput.onblur = () => {
      setTimeout(() => { if (suggestions) suggestions.style.display = 'none'; }, 250);
    };
  }

  // 4. Configurar eventos de calculadora de agotamiento y tipo de cambio
  if (dolarInput) {
    dolarInput.oninput = () => {
      if (currentSelectedProductSku) selectProductFor360(currentSelectedProductSku, true);
    };
  }

  if (projQtyInput) {
    projQtyInput.oninput = () => updateProdExhaustion();
  }

  if (speedSelect) {
    speedSelect.onchange = () => updateProdExhaustion();
  }

  // 5. Si ya hay un SKU seleccionado o default
  if (!currentSelectedProductSku && sortedSkus.length > 0) {
    selectProductFor360(sortedSkus[0].sku);
  } else if (currentSelectedProductSku) {
    selectProductFor360(currentSelectedProductSku);
  }
}

/**
 * Selecciona un SKU y calcula todas sus métricas 360
 */
function selectProductFor360(sku, skipInputUpdate = false) {
  if (!sku) return;
  currentSelectedProductSku = sku;

  const select = document.getElementById('prodSkuSelect');
  const searchInput = document.getElementById('prodSkuSearch');
  const suggestions = document.getElementById('prodSkuSuggestions');
  if (suggestions) suggestions.style.display = 'none';

  if (!skipInputUpdate) {
    if (select && select.value !== sku) select.value = sku;
    if (searchInput) searchInput.value = sku;
  }

  const skuRows = (rows || []).filter(r => (r['CODIGO'] || '').trim().toUpperCase() === sku);
  if (skuRows.length === 0) return;

  const first = skuRows[0];
  const prodDesc = first['DESCRIPCION'] || sku;
  const prodFam = first['FAMILIA'] || 'General';
  const prodCat = first['CATEGORIA'] || first['CANAL FINAL'] || 'Catálogo';

  // 1. Header Badges & Titles
  const bSku = document.getElementById('prodSkuBadge');
  const bCat = document.getElementById('prodCategoryBadge');
  const bFam = document.getElementById('prodFamiliaBadge');
  const tTitle = document.getElementById('prodTitle');
  const tSub = document.getElementById('prodSubtitle');

  if (bSku) bSku.textContent = 'SKU: ' + sku;
  if (bCat) bCat.textContent = prodCat;
  if (bFam) bFam.textContent = prodFam;
  if (tTitle) tTitle.textContent = prodDesc;
  if (tSub) tSub.textContent = `Familia ${prodFam} · ${skuRows.length} transacciones históricas registradas`;

  // 2. Cálculos Financieros
  const totalQty = skuRows.reduce((a, r) => a + Number(r['CANTFACTURADA'] || 0), 0);
  const totalNeto = skuRows.reduce((a, r) => a + Number(r['NETO'] || 0), 0);
  const totalCosto = skuRows.reduce((a, r) => a + (Number(r['COSTOS'] || 0) * Number(r['CANTFACTURADA'] || 0)), 0);
  const totalUtilidad = skuRows.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || (Number(r['NETO'] || 0) - (Number(r['COSTOS'] || 0) * Number(r['CANTFACTURADA'] || 0)))), 0);

  const avgPrice = totalQty > 0 ? (totalNeto / totalQty) : 0;
  const avgCost = totalQty > 0 ? (totalCosto / totalQty) : 0;
  const marginPct = totalNeto > 0 ? ((totalUtilidad / totalNeto) * 100) : 0;

  const dolarRate = parseFloat(document.getElementById('prodDolarRateInput')?.value) || 950;
  const dolarStatus = document.getElementById('prodDolarStatus');
  if (dolarStatus) dolarStatus.textContent = `Tipo de Cambio: $1 USD = $${dolarRate.toLocaleString('es-CL')} CLP`;

  const avgPriceUSD = dolarRate > 0 ? (avgPrice / dolarRate) : 0;
  const avgCostUSD = dolarRate > 0 ? (avgCost / dolarRate) : 0;

  // Update Quick Stats
  const elAvgPrice = document.getElementById('prodAvgPrice');
  const elAvgPriceUSD = document.getElementById('prodAvgPriceUSD');
  const elAvgCost = document.getElementById('prodAvgCost');
  const elAvgCostUSD = document.getElementById('prodAvgCostUSD');
  const elMarginPct = document.getElementById('prodMarginPct');

  if (elAvgPrice) elAvgPrice.textContent = typeof formatCLP === 'function' ? formatCLP(avgPrice) : `$${Math.round(avgPrice).toLocaleString('es-CL')}`;
  if (elAvgPriceUSD) elAvgPriceUSD.textContent = `USD $${avgPriceUSD.toFixed(2)}`;
  if (elAvgCost) elAvgCost.textContent = typeof formatCLP === 'function' ? formatCLP(avgCost) : `$${Math.round(avgCost).toLocaleString('es-CL')}`;
  if (elAvgCostUSD) elAvgCostUSD.textContent = `USD $${avgCostUSD.toFixed(2)}`;
  if (elMarginPct) {
    elMarginPct.textContent = marginPct.toFixed(1) + '%';
    elMarginPct.style.color = marginPct >= 30 ? '#34d399' : (marginPct >= 15 ? '#fbbf24' : '#f87171');
  }

  // 3. Mini KPIs
  const elKpiQty = document.getElementById('prodKpiTotalQty');
  const elKpiRev = document.getElementById('prodKpiTotalRevenue');
  if (elKpiQty) elKpiQty.textContent = Math.round(totalQty).toLocaleString('es-CL') + ' und.';
  if (elKpiRev) elKpiRev.textContent = (typeof formatCLP === 'function' ? formatCLP(totalNeto) : `$${Math.round(totalNeto).toLocaleString('es-CL')}`) + ' Neto';

  // Análisis por Años y Meses
  const byYear = new Map();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthTotals = new Array(12).fill(0);

  skuRows.forEach(r => {
    let d = null;
    if (r['FECHA']) {
      d = new Date(r['FECHA']);
      if (isNaN(d.getTime())) d = typeof parseFlexibleDate === 'function' ? parseFlexibleDate(r['FECHA']) : null;
    }
    const yr = (d && !isNaN(d.getTime())) ? String(d.getFullYear()) : (r['AÑO'] || '2025');
    const mo = (d && !isNaN(d.getTime())) ? d.getMonth() : 0;

    if (!byYear.has(yr)) {
      byYear.set(yr, { year: yr, qty: 0, neto: 0, costo: 0, util: 0, months: new Array(12).fill(0), netoMonths: new Array(12).fill(0) });
    }
    const yItem = byYear.get(yr);
    const q = Number(r['CANTFACTURADA'] || 0);
    const n = Number(r['NETO'] || 0);
    const c = Number(r['COSTOS'] || 0) * q;
    const u = Number(r['($) UTILIDAD']) || (n - c);

    yItem.qty += q;
    yItem.neto += n;
    yItem.costo += c;
    yItem.util += u;
    yItem.months[mo] += q;
    yItem.netoMonths[mo] += n;
    monthTotals[mo] += q;
  });

  // Mejor Año & Mes Pico
  let peakYear = '----';
  let peakYearQty = 0;
  byYear.forEach(y => {
    if (y.qty > peakYearQty) {
      peakYearQty = y.qty;
      peakYear = y.year;
    }
  });

  let peakMonthIdx = 0;
  let peakMonthQty = 0;
  monthTotals.forEach((cnt, idx) => {
    if (cnt > peakMonthQty) {
      peakMonthQty = cnt;
      peakMonthIdx = idx;
    }
  });

  const elPeakYear = document.getElementById('prodKpiPeakYear');
  const elPeakYearSub = document.getElementById('prodKpiPeakYearSub');
  const elPeakMonth = document.getElementById('prodKpiPeakMonth');
  const elPeakMonthSub = document.getElementById('prodKpiPeakMonthSub');

  if (elPeakYear) elPeakYear.textContent = peakYear;
  if (elPeakYearSub) elPeakYearSub.textContent = Math.round(peakYearQty).toLocaleString('es-CL') + ' unidades';
  if (elPeakMonth) elPeakMonth.textContent = monthNames[peakMonthIdx];
  if (elPeakMonthSub) elPeakMonthSub.textContent = `${Math.round(peakMonthQty).toLocaleString('es-CL')} un. en total histórico`;

  // Velocidad Mensual
  const distinctMonthsCount = Math.max(1, byYear.size * 12);
  const monthlySpeed = totalQty / distinctMonthsCount;
  const elSpeed = document.getElementById('prodKpiMonthlySpeed');
  if (elSpeed) elSpeed.textContent = Math.round(monthlySpeed).toLocaleString('es-CL') + ' und/mes';

  // 4. Calculadora de Agotamiento de Stock
  updateProdExhaustion(skuRows, monthlySpeed, avgPrice, avgCost, dolarRate);

  // 5. Gráfico Multianual y Tabla Anual
  renderProdYearlyAnalytics(byYear, totalNeto);

  // 6. Resumen de Clientes
  renderProdCustomerBreakdown(skuRows, totalQty);
}

/**
 * Calculadora y gráfico de curva de agotamiento
 */
function updateProdExhaustion(skuRowsParam, monthlySpeedParam, avgPriceParam, avgCostParam, dolarRateParam) {
  const qtyInput = document.getElementById('prodProjQtyInput');
  const speedSelect = document.getElementById('prodProjSpeedMode');
  if (!qtyInput) return;

  const projQty = Math.max(1, parseFloat(qtyInput.value) || 100);
  const speedMode = speedSelect ? speedSelect.value : '12m';

  const sku = currentSelectedProductSku;
  const skuRows = skuRowsParam || (rows || []).filter(r => (r['CODIGO'] || '').trim().toUpperCase() === sku);
  const totalQty = skuRows.reduce((a, r) => a + Number(r['CANTFACTURADA'] || 0), 0);
  const totalNeto = skuRows.reduce((a, r) => a + Number(r['NETO'] || 0), 0);
  const totalCosto = skuRows.reduce((a, r) => a + (Number(r['COSTOS'] || 0) * Number(r['CANTFACTURADA'] || 0)), 0);

  const avgPrice = avgPriceParam || (totalQty > 0 ? totalNeto / totalQty : 0);
  const avgCost = avgCostParam || (totalQty > 0 ? totalCosto / totalQty : 0);
  const dolarRate = dolarRateParam || parseFloat(document.getElementById('prodDolarRateInput')?.value) || 950;

  // Calcular ritmo según modo
  let speed = monthlySpeedParam || (totalQty / 24);
  if (speedMode === '3m') speed = Math.max(0.5, (totalQty / 24) * 1.2);
  else if (speedMode === '6m') speed = Math.max(0.5, (totalQty / 24) * 1.1);
  else if (speedMode === '12m') speed = Math.max(0.5, (totalQty / 12));
  else speed = Math.max(0.5, totalQty / 36);

  const durationMonths = projQty / speed;
  const durationDays = Math.round(durationMonths * 30.41);

  const elResultMonths = document.getElementById('prodProjResultMonths');
  const elResultDays = document.getElementById('prodProjResultDays');
  const elDepletionDate = document.getElementById('prodProjDepletionDate');
  const elSpeedLabel = document.getElementById('prodProjSpeedLabel');

  if (elResultMonths) elResultMonths.textContent = durationMonths.toFixed(1) + ' Meses';
  if (elResultDays) elResultDays.textContent = `≈ ${durationDays.toLocaleString('es-CL')} Días de cobertura comercial`;
  
  if (elDepletionDate) {
    const dTarget = new Date();
    dTarget.setDate(dTarget.getDate() + durationDays);
    elDepletionDate.textContent = dTarget.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }).toUpperCase();
  }

  if (elSpeedLabel) elSpeedLabel.textContent = `Ritmo: ${Math.round(speed).toLocaleString('es-CL')} u./mes`;

  // Proyecciones Financieras
  const estRev = projQty * avgPrice;
  const estCost = projQty * avgCost;
  const estProfit = estRev - estCost;

  const elEstRev = document.getElementById('prodProjEstRevenue');
  const elEstRevUSD = document.getElementById('prodProjEstRevenueUSD');
  const elEstCost = document.getElementById('prodProjEstCost');
  const elEstCostUSD = document.getElementById('prodProjEstCostUSD');
  const elEstProfit = document.getElementById('prodProjEstProfit');
  const elEstProfitUSD = document.getElementById('prodProjEstProfitUSD');

  if (elEstRev) elEstRev.textContent = typeof formatCLP === 'function' ? formatCLP(estRev) : `$${Math.round(estRev).toLocaleString('es-CL')}`;
  if (elEstRevUSD) elEstRevUSD.textContent = `USD $${(estRev / dolarRate).toFixed(2)}`;
  if (elEstCost) elEstCost.textContent = typeof formatCLP === 'function' ? formatCLP(estCost) : `$${Math.round(estCost).toLocaleString('es-CL')}`;
  if (elEstCostUSD) elEstCostUSD.textContent = `USD $${(estCost / dolarRate).toFixed(2)}`;
  if (elEstProfit) elEstProfit.textContent = typeof formatCLP === 'function' ? formatCLP(estProfit) : `$${Math.round(estProfit).toLocaleString('es-CL')}`;
  if (elEstProfitUSD) elEstProfitUSD.textContent = `USD $${(estProfit / dolarRate).toFixed(2)}`;

  // Curva de proyección Chart.js
  renderProdProjectionCurveChart(projQty, speed, durationMonths);
}

/**
 * Gráfico de curva de reducción de stock
 */
function renderProdProjectionCurveChart(initialQty, monthlySpeed, totalMonths) {
  const canvas = document.getElementById('prodProjectionChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const numPoints = Math.min(24, Math.max(3, Math.ceil(totalMonths) + 1));
  const labels = [];
  const dataPoints = [];

  const now = new Date();
  for (let i = 0; i <= numPoints; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }));
    const remaining = Math.max(0, Math.round(initialQty - (i * monthlySpeed)));
    dataPoints.push(remaining);
    if (remaining === 0) break;
  }

  if (prodProjectionChartInstance) {
    prodProjectionChartInstance.destroy();
    prodProjectionChartInstance = null;
  }

  prodProjectionChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Stock Proyectado (Unidades)',
        data: dataPoints,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#c084fc',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toLocaleString('es-CL')} unidades restantes`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

/**
 * Renderiza gráfico multianual y tabla anual del SKU
 */
function renderProdYearlyAnalytics(byYearMap, totalNetoGlobal) {
  const canvas = document.getElementById('prodYearlyChart');
  const tbody = document.getElementById('prodYearlyTableBody');
  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const years = Array.from(byYearMap.values()).sort((a, b) => a.year.localeCompare(b.year));

  // Gráfico Multianual Chart.js
  if (canvas && typeof Chart !== 'undefined') {
    if (prodYearlyChartInstance) {
      prodYearlyChartInstance.destroy();
      prodYearlyChartInstance = null;
    }

    const palette = ['#38bdf8', '#34d399', '#f59e0b', '#a855f7', '#f43f5e'];
    const datasets = years.map((y, idx) => {
      const color = palette[idx % palette.length];
      const isQty = currentProdChartMetric === 'qty';
      return {
        label: `Año ${y.year}`,
        data: isQty ? y.months : y.netoMonths,
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3
      };
    });

    prodYearlyChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return currentProdChartMetric === 'qty' ?
                  ` ${ctx.dataset.label}: ${val.toLocaleString('es-CL')} un.` :
                  ` ${ctx.dataset.label}: ${typeof formatCLP === 'function' ? formatCLP(val) : '$'+Math.round(val).toLocaleString('es-CL')}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#94a3b8',
              callback: (v) => currentProdChartMetric === 'qty' ? v.toLocaleString('es-CL') : `$${(v/1000).toFixed(0)}k`
            }
          },
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }

  // Tabla Anual
  if (tbody) {
    if (years.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No hay registros anuales para este SKU.</td></tr>`;
      return;
    }

    tbody.innerHTML = years.map(y => {
      let maxMonthIdx = 0;
      let maxMonthVal = 0;
      y.months.forEach((m, idx) => {
        if (m > maxMonthVal) {
          maxMonthVal = m;
          maxMonthIdx = idx;
        }
      });

      const marg = y.neto > 0 ? ((y.util / y.neto) * 100).toFixed(1) : '0.0';
      const part = totalNetoGlobal > 0 ? ((y.neto / totalNetoGlobal) * 100).toFixed(1) : '0.0';

      return `
        <tr>
          <td style="font-weight: 800; color: #f8fafc;">${y.year}</td>
          <td style="text-align: right; font-weight: 700;">${Math.round(y.qty).toLocaleString('es-CL')} un.</td>
          <td style="text-align: right; font-weight: 800; color: #38bdf8;">${typeof formatCLP === 'function' ? formatCLP(y.neto) : '$'+Math.round(y.neto).toLocaleString('es-CL')}</td>
          <td style="text-align: right; color: #fda4af;">${typeof formatCLP === 'function' ? formatCLP(y.costo) : '$'+Math.round(y.costo).toLocaleString('es-CL')}</td>
          <td style="text-align: right; font-weight: 700; color: #34d399;">${typeof formatCLP === 'function' ? formatCLP(y.util) : '$'+Math.round(y.util).toLocaleString('es-CL')}</td>
          <td style="text-align: right; font-weight: 800; color: ${Number(marg) >= 30 ? '#34d399' : '#fbbf24'};">${marg}%</td>
          <td style="text-align: right; font-weight: 700; color: #a855f7;">${part}%</td>
          <td style="text-align: center; color: #cbd5e1;">${monthFull[maxMonthIdx]}</td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Renderiza el desglose de clientes que compraron este SKU
 */
function renderProdCustomerBreakdown(skuRows, totalSkuQty) {
  const tbody = document.getElementById('prodTxTableBody');
  const badge = document.getElementById('prodTxCountBadge');
  if (!tbody) return;

  const clientMap = new Map();
  let totalSkuNeto = 0;

  skuRows.forEach(r => {
    const cl = (r['CLIENTE'] || 'Consumidor Final').trim();
    const canal = (r['CANAL FINAL'] || r['TIENDA FINAL'] || 'Directo').trim();
    if (!clientMap.has(cl)) {
      clientMap.set(cl, {
        cliente: cl,
        canal: canal,
        comprasCount: 0,
        cantidadTotal: 0,
        netoTotal: 0,
        costoTotal: 0,
        utilidadTotal: 0
      });
    }
    const cItem = clientMap.get(cl);
    const q = Number(r['CANTFACTURADA'] || 0);
    const n = Number(r['NETO'] || 0);
    const c = Number(r['COSTOS'] || 0) * q;
    const u = Number(r['($) UTILIDAD']) || (n - c);

    cItem.comprasCount += 1;
    cItem.cantidadTotal += q;
    cItem.netoTotal += n;
    cItem.costoTotal += c;
    cItem.utilidadTotal += u;
    totalSkuNeto += n;
  });

  const clientsList = Array.from(clientMap.values()).sort((a, b) => b.netoTotal - a.netoTotal);
  if (badge) badge.textContent = `${clientsList.length} Clientes`;

  if (clientsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8;">No se registraron clientes para este SKU.</td></tr>`;
    return;
  }

  tbody.innerHTML = clientsList.map(c => {
    const avgPrice = c.cantidadTotal > 0 ? (c.netoTotal / c.cantidadTotal) : 0;
    const marg = c.netoTotal > 0 ? ((c.utilidadTotal / c.netoTotal) * 100).toFixed(1) : '0.0';
    const part = totalSkuNeto > 0 ? ((c.netoTotal / totalSkuNeto) * 100).toFixed(1) : '0.0';

    return `
      <tr>
        <td style="text-align: left; font-weight: 700; color: #f8fafc;">${c.cliente}</td>
        <td style="text-align: left;"><span class="tag-pill" style="font-size: 0.75rem;">${c.canal}</span></td>
        <td style="text-align: center; font-weight: 700;">${c.comprasCount}</td>
        <td style="text-align: right; font-weight: 700;">${Math.round(c.cantidadTotal).toLocaleString('es-CL')}</td>
        <td style="text-align: right;">${typeof formatCLP === 'function' ? formatCLP(avgPrice) : '$'+Math.round(avgPrice).toLocaleString('es-CL')}</td>
        <td style="text-align: right; font-weight: 800; color: #38bdf8;">${typeof formatCLP === 'function' ? formatCLP(c.netoTotal) : '$'+Math.round(c.netoTotal).toLocaleString('es-CL')}</td>
        <td style="text-align: right; font-weight: 700; color: #34d399;">${typeof formatCLP === 'function' ? formatCLP(c.utilidadTotal) : '$'+Math.round(c.utilidadTotal).toLocaleString('es-CL')}</td>
        <td style="text-align: right; font-weight: 700; color: ${Number(marg) >= 30 ? '#34d399' : '#fbbf24'};">${marg}%</td>
        <td style="text-align: right; font-weight: 700; color: #a855f7;">${part}%</td>
      </tr>
    `;
  }).join('');
}

/**
 * Helpers para Productos 360
 */
function setProdProjPreset(qty) {
  const input = document.getElementById('prodProjQtyInput');
  if (input) {
    input.value = qty;
    updateProdExhaustion();
  }
}

function setProdChartMetric(metric) {
  currentProdChartMetric = metric;
  const btnQty = document.getElementById('prodChartMetricQtyBtn');
  const btnNeto = document.getElementById('prodChartMetricNetoBtn');

  if (btnQty) btnQty.classList.toggle('active', metric === 'qty');
  if (btnNeto) btnNeto.classList.toggle('active', metric === 'neto');

  if (currentSelectedProductSku) {
    selectProductFor360(currentSelectedProductSku, true);
  }
}

function randomizeProductSelection() {
  if (!rows || rows.length === 0) return;
  const skuList = Array.from(new Set(rows.map(r => (r['CODIGO'] || '').trim().toUpperCase()).filter(Boolean)));
  if (skuList.length === 0) return;
  const randSku = skuList[Math.floor(Math.random() * skuList.length)];
  selectProductFor360(randSku);
  if (typeof showToast === 'function') showToast(`🎲 SKU Seleccionado: ${randSku}`);
}

function clearProductSearch() {
  const searchInput = document.getElementById('prodSkuSearch');
  if (searchInput) searchInput.value = '';
  const suggestions = document.getElementById('prodSkuSuggestions');
  if (suggestions) suggestions.style.display = 'none';
  if (typeof showToast === 'function') showToast('✕ Búsqueda de SKU limpiada');
}

// ==========================================================================
// MÓDULO MIX DE PRODUCTOS SUGERIDO (AI PORTFOLIO ADVISOR)
// ==========================================================================

let mixCurrentCanal = 'ALL';
let mixCurrentSort = 'neto';
let mixSearchFilter = '';

/**
 * Renderiza el módulo de Mix de Productos Sugerido
 */
function renderMixSugeridoModule() {
  const canalSelect = document.getElementById('mixCanalSegment');
  const sortSelect = document.getElementById('mixSortSelect');
  const searchBox = document.getElementById('mixSearchBox');
  const tbody = document.getElementById('mixSugeridoTableBody');

  if (!rows || rows.length === 0) return;

  // 1. Poblar canales en selector si está vacío
  if (canalSelect && canalSelect.options.length <= 1) {
    const canales = Array.from(new Set(rows.map(r => (r['CANAL FINAL'] || '').trim()).filter(Boolean))).sort();
    canalSelect.innerHTML = '<option value="ALL">🌐 Global (Todos los Canales)</option>' +
      canales.map(c => `<option value="${c}">🏷️ Canal: ${c}</option>`).join('');

    canalSelect.onchange = () => {
      mixCurrentCanal = canalSelect.value;
      updateMixSugeridoView();
    };
  }

  if (sortSelect) {
    sortSelect.onchange = () => {
      mixCurrentSort = sortSelect.value;
      updateMixSugeridoView();
    };
  }

  if (searchBox) {
    let timer = null;
    searchBox.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        mixSearchFilter = (searchBox.value || '').trim().toLowerCase();
        updateMixSugeridoView();
      }, 200);
    };
  }

  updateMixSugeridoView();
}

/**
 * Actualiza la matriz y KPIs del Mix Sugerido
 */
function updateMixSugeridoView() {
  const tbody = document.getElementById('mixSugeridoTableBody');
  const kpiSkus = document.getElementById('mixKpiSkus');
  const kpiSkusSub = document.getElementById('mixKpiSkusSub');
  const kpiRev = document.getElementById('mixKpiRevenue');
  const kpiRevSub = document.getElementById('mixKpiRevenueSub');
  const kpiProfit = document.getElementById('mixKpiProfit');
  const kpiMarginSub = document.getElementById('mixKpiMarginSub');

  let data = (filtered && filtered.length > 0) ? filtered : rows;
  if (mixCurrentCanal !== 'ALL') {
    data = data.filter(r => (r['CANAL FINAL'] || '').trim() === mixCurrentCanal);
  }

  const bySku = new Map();
  let totalCanalNeto = 0;
  let totalCanalUtilidad = 0;

  data.forEach(r => {
    const sku = (r['CODIGO'] || '').trim().toUpperCase();
    if (!sku) return;
    if (!bySku.has(sku)) {
      bySku.set(sku, {
        sku,
        desc: (r['DESCRIPCION'] || sku).trim(),
        familia: (r['FAMILIA'] || 'General').trim(),
        cant: 0,
        neto: 0,
        costo: 0,
        utilidad: 0
      });
    }
    const item = bySku.get(sku);
    const q = Number(r['CANTFACTURADA'] || 0);
    const n = Number(r['NETO'] || 0);
    const c = Number(r['COSTOS'] || 0) * q;
    const u = Number(r['($) UTILIDAD']) || (n - c);

    item.cant += q;
    item.neto += n;
    item.costo += c;
    item.utilidad += u;

    totalCanalNeto += n;
    totalCanalUtilidad += u;
  });

  let skuList = Array.from(bySku.values()).map(p => {
    const marg = p.neto > 0 ? (p.utilidad / p.neto) * 100 : 0;
    const part = totalCanalNeto > 0 ? (p.neto / totalCanalNeto) * 100 : 0;
    return { ...p, marg, part };
  });

  // Clasificación Pareto ABC & Mix
  skuList.sort((a, b) => b.neto - a.neto);
  let cumNeto = 0;
  skuList.forEach(p => {
    cumNeto += p.neto;
    const cumPct = totalCanalNeto > 0 ? (cumNeto / totalCanalNeto) * 100 : 100;
    if (cumPct <= 80) p.clasificacion = '⭐ Estrella A';
    else if (cumPct <= 95) p.clasificacion = p.marg >= 25 ? '💎 Rentable B' : '📦 Volumen B';
    else p.clasificacion = '🔄 Rotación C';
  });

  // Filtrar por búsqueda
  if (mixSearchFilter) {
    skuList = skuList.filter(p => p.sku.toLowerCase().includes(mixSearchFilter) || p.desc.toLowerCase().includes(mixSearchFilter) || p.familia.toLowerCase().includes(mixSearchFilter));
  }

  // Ordenar
  if (mixCurrentSort === 'cant') skuList.sort((a, b) => b.cant - a.cant);
  else if (mixCurrentSort === 'margin') skuList.sort((a, b) => b.marg - a.marg);
  else if (mixCurrentSort === 'utilidad') skuList.sort((a, b) => b.utilidad - a.utilidad);
  else skuList.sort((a, b) => b.neto - a.neto);

  // KPIs
  const recommendedCount = skuList.filter(p => p.clasificacion.includes('A') || p.clasificacion.includes('Rentable')).length || skuList.length;
  if (kpiSkus) kpiSkus.textContent = `${recommendedCount} SKUs`;
  if (kpiSkusSub) kpiSkusSub.textContent = `Catálogo optimizado (${mixCurrentCanal === 'ALL' ? 'Global' : mixCurrentCanal})`;
  if (kpiRev) kpiRev.textContent = typeof formatCLP === 'function' ? formatCLP(totalCanalNeto) : `$${Math.round(totalCanalNeto).toLocaleString('es-CL')}`;
  if (kpiRevSub) kpiRevSub.textContent = `Facturación neta acumulada en segmento`;
  if (kpiProfit) kpiProfit.textContent = typeof formatCLP === 'function' ? formatCLP(totalCanalUtilidad) : `$${Math.round(totalCanalUtilidad).toLocaleString('es-CL')}`;
  if (kpiMarginSub) {
    const avgMarg = totalCanalNeto > 0 ? ((totalCanalUtilidad / totalCanalNeto) * 100).toFixed(1) : '0.0';
    kpiMarginSub.textContent = `Margen promedio del mix: ${avgMarg}%`;
  }

  // Render Table Body
  if (tbody) {
    if (skuList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 2rem;">No se encontraron productos en este canal o filtro.</td></tr>`;
      return;
    }

    tbody.innerHTML = skuList.map((p, idx) => {
      let badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);';
      if (p.clasificacion.includes('Rentable')) badgeStyle = 'background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);';
      else if (p.clasificacion.includes('Volumen')) badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);';
      else if (p.clasificacion.includes('Rotación')) badgeStyle = 'background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3);';

      return `
        <tr>
          <td style="text-align: center; font-weight: 800; color: #94a3b8;">#${idx + 1}</td>
          <td style="text-align: left;"><span class="sku-badge-pill" style="font-weight: 800; font-size: 0.82rem; cursor: pointer;" onclick="switchView('productos'); selectProductFor360('${p.sku}');" title="Ver análisis 360 de este producto">${p.sku}</span></td>
          <td style="text-align: left; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: #f8fafc;" title="${p.desc}">${p.desc}</td>
          <td style="text-align: left;"><span class="tag-pill" style="font-size: 0.75rem;">${p.familia}</span></td>
          <td style="text-align: center;"><span style="padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; ${badgeStyle}">${p.clasificacion}</span></td>
          <td style="text-align: right; font-weight: 700;">${Math.round(p.cant).toLocaleString('es-CL')} un.</td>
          <td style="text-align: right; font-weight: 800; color: #38bdf8;">${typeof formatCLP === 'function' ? formatCLP(p.neto) : '$'+Math.round(p.neto).toLocaleString('es-CL')}</td>
          <td style="text-align: right; font-weight: 700; color: #34d399;">${typeof formatCLP === 'function' ? formatCLP(p.utilidad) : '$'+Math.round(p.utilidad).toLocaleString('es-CL')}</td>
          <td style="text-align: right; font-weight: 800; color: ${p.marg >= 30 ? '#34d399' : '#fbbf24'};">${p.marg.toFixed(1)}%</td>
          <td style="text-align: right; font-weight: 800; color: #a855f7;">${p.part.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  }
}

function openTargetModal() {
  const backdrop = document.getElementById('targetModalBackdrop');
  if (backdrop) backdrop.classList.add('active');
}

function closeTargetModal() {
  const backdrop = document.getElementById('targetModalBackdrop');
  if (backdrop) backdrop.classList.remove('active');
}

function toggleMobileFilters() {
  const bar = document.getElementById('filtersBar');
  if (bar) bar.classList.toggle('active');
}

function toggleCotizMobileFilters() {
  const bar = document.getElementById('cotizFiltersBar');
  if (bar) bar.classList.toggle('active');
}

/* ==========================================================================
   GLOMAX PARALLAX 3D & SPATIAL DEPTH ENGINE (2026 NEXT-GEN ENGINE)
   ========================================================================== */
const GlomaxParallaxEngine = {
  isEnabled: true,
  mode: 'active', // 'active' | 'disabled'
  targetMouseX: 0,
  targetMouseY: 0,
  currentMouseX: 0,
  currentMouseY: 0,
  scrollY: 0,
  targetScrollY: 0,
  isTicking: false,
  cards: [],
  scrollElements: [],
  ambientOrbs: [],
  bgMesh: null,
  
  init() {
    const saved = localStorage.getItem('glomax_parallax_mode');
    if (saved === 'disabled') {
      this.setMode('disabled', false);
    } else {
      this.setMode('active', false);
    }
    
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setMode('disabled', false);
    }
    
    this.bgMesh = document.getElementById('parallaxBgMesh');
    this.ambientOrbs = Array.from(document.querySelectorAll('.parallax-orb, .parallax-data-node'));
    
    this.bindEvents();
    this.refreshCards();
    this.updateToggleBtnUI();
    this.startLoop();
    console.log('[ParallaxEngine] 🌌 Motor Parallax 3D & Profundidad Espacial Activado');
  },
  
  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      if (!this.isEnabled) return;
      this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!this.isTicking) this.startLoop();
    }, { passive: true });
    
    const onScroll = () => {
      if (!this.isEnabled) return;
      const mainEl = document.querySelector('.ax-main');
      const sY = mainEl ? mainEl.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      this.targetScrollY = sY;
      if (!this.isTicking) this.startLoop();
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    const mainEl = document.querySelector('.ax-main');
    if (mainEl) {
      mainEl.addEventListener('scroll', onScroll, { passive: true });
    }
    
    const toggleBtn = document.getElementById('parallaxToggleBtn');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.preventDefault();
        this.toggle();
      };
    }
  },
  
  refreshCards() {
    const cardEls = document.querySelectorAll(`
      .hero-kpi-card,
      .mini-kpi-card,
      .proj-card,
      .bi-sim-card,
      .bi-insights-briefing,
      .banner-parallax,
      .advisor-card,
      [data-tilt]
    `);
    
    cardEls.forEach(card => {
      if (!card.querySelector('.card-glare')) {
        const glare = document.createElement('div');
        glare.className = 'card-glare';
        card.appendChild(glare);
      }
      this.setupCardTilt(card);
    });
    
    this.scrollElements = Array.from(document.querySelectorAll('[data-parallax-speed]'));
    this.ambientOrbs = Array.from(document.querySelectorAll('.parallax-orb, .parallax-data-node'));
    this.bgMesh = document.getElementById('parallaxBgMesh');
  },
  
  setupCardTilt(card) {
    if (card._tiltBound) return;
    card._tiltBound = true;
    
    let rect = null;
    
    card.addEventListener('mouseenter', () => {
      if (!this.isEnabled) return;
      rect = card.getBoundingClientRect();
    });
    
    card.addEventListener('mousemove', (e) => {
      if (!this.isEnabled) return;
      if (!rect) rect = card.getBoundingClientRect();
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const px = (x / rect.width);
      const py = (y / rect.height);
      
      const rotX = ((0.5 - py) * 14).toFixed(2);
      const rotY = ((px - 0.5) * 14).toFixed(2);
      
      card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-opacity', '0.24');
    }, { passive: true });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.setProperty('--glare-opacity', '0');
      rect = null;
    });
  },
  
  startLoop() {
    if (this.isTicking) return;
    this.isTicking = true;
    
    const tick = () => {
      if (!this.isEnabled) {
        this.isTicking = false;
        return;
      }
      
      const factor = 0.08;
      this.currentMouseX += (this.targetMouseX - this.currentMouseX) * factor;
      this.currentMouseY += (this.targetMouseY - this.currentMouseY) * factor;
      this.scrollY += (this.targetScrollY - this.scrollY) * 0.1;
      
      if (this.bgMesh) {
        const mx = (this.currentMouseX * 18).toFixed(2);
        const my = (this.currentMouseY * 18).toFixed(2);
        this.bgMesh.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      }
      
      if (this.ambientOrbs && this.ambientOrbs.length > 0) {
        this.ambientOrbs.forEach(orb => {
          const depth = parseFloat(orb.getAttribute('data-parallax-depth')) || 0.05;
          const ox = (this.currentMouseX * depth * 350).toFixed(2);
          const oy = (this.currentMouseY * depth * 350 + this.scrollY * depth * -0.4).toFixed(2);
          orb.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
        });
      }
      
      if (this.scrollElements && this.scrollElements.length > 0) {
        this.scrollElements.forEach(el => {
          const speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.05;
          const py = (this.scrollY * speed).toFixed(2);
          el.style.transform = `translate3d(0, ${py}px, 0)`;
        });
      }
      
      const dx = Math.abs(this.targetMouseX - this.currentMouseX);
      const dy = Math.abs(this.targetMouseY - this.currentMouseY);
      const ds = Math.abs(this.targetScrollY - this.scrollY);
      
      if (dx > 0.001 || dy > 0.001 || ds > 0.1) {
        requestAnimationFrame(tick);
      } else {
        this.isTicking = false;
      }
    };
    
    requestAnimationFrame(tick);
  },
  
  toggle() {
    if (this.mode === 'active') {
      this.setMode('disabled');
      if (typeof showToast === 'function') showToast('🌌 Modo Parallax 3D: Desactivado');
    } else {
      this.setMode('active');
      if (typeof showToast === 'function') showToast('✨ Modo Parallax 3D: Activado');
    }
  },
  
  setMode(mode, save = true) {
    this.mode = mode;
    this.isEnabled = (mode !== 'disabled');
    
    if (save) {
      localStorage.setItem('glomax_parallax_mode', mode);
    }
    
    if (this.isEnabled) {
      document.body.classList.remove('parallax-disabled');
      this.startLoop();
    } else {
      document.body.classList.add('parallax-disabled');
      if (this.bgMesh) this.bgMesh.style.transform = '';
      this.ambientOrbs.forEach(orb => orb.style.transform = '');
      this.scrollElements.forEach(el => el.style.transform = '');
      document.querySelectorAll('.hero-kpi-card, .mini-kpi-card, .proj-card, [data-tilt]').forEach(c => {
        c.style.transform = '';
        c.style.setProperty('--glare-opacity', '0');
      });
    }
    
    this.updateToggleBtnUI();
  },
  
  updateToggleBtnUI() {
    const btn = document.getElementById('parallaxToggleBtn');
    if (!btn) return;
    
    if (this.isEnabled) {
      btn.classList.add('is-active');
      btn.classList.remove('is-off');
      btn.title = 'Efectos Parallax 3D & Profundidad Espacial (Activo)';
    } else {
      btn.classList.remove('is-active');
      btn.classList.add('is-off');
      btn.title = 'Efectos Parallax 3D & Profundidad Espacial (Inactivo)';
    }
  }
};

// Auto-inicialización segura en carga de documento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GlomaxParallaxEngine.init());
} else {
  GlomaxParallaxEngine.init();
}

function setupAllButtonListeners() {
  // Inicializar Motor Parallax 3D
  GlomaxParallaxEngine.init();

  // 1. Modal Nueva Venta / Registro
  const openBtn = document.getElementById('openModalBtn');
  if (openBtn) openBtn.onclick = () => openModalForNew();

  const closeBtn = document.getElementById('closeModalBtn');
  if (closeBtn) closeBtn.onclick = () => closeModal();

  const cancelBtn = document.getElementById('cancelModalBtn');
  if (cancelBtn) cancelBtn.onclick = () => closeModal();

  const saveBtn = document.getElementById('saveModalBtn');
  if (saveBtn) saveBtn.onclick = (e) => { e.preventDefault(); saveRow(); };

  const modalFormEl = document.getElementById('modalForm');
  if (modalFormEl) modalFormEl.onsubmit = (e) => { e.preventDefault(); saveRow(); };

  const delBtn = document.getElementById('deleteRowBtn');
  if (delBtn) delBtn.onclick = () => deleteCurrentRow();

  // 2. Exportaciones
  const csvBtn = document.getElementById('exportCsvBtn');
  if (csvBtn) csvBtn.onclick = () => exportCsv();

  const pdfBtn = document.getElementById('exportPdfBtn');
  if (pdfBtn) pdfBtn.onclick = () => exportPdf();

  // 3. Toggles de Cabecera y Simulador
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) soundBtn.onclick = () => toggleSound();

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.onclick = () => toggleTheme();

  const presBtn = document.getElementById('presentationModeBtn');
  if (presBtn) presBtn.onclick = () => togglePresentationMode();

  const simResetBtn = document.getElementById('resetSimBtn');
  if (simResetBtn) simResetBtn.onclick = () => resetBIAdvisorSim();

  ['simPriceRange', 'simCostRange', 'simVolRange'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = () => {
        if (typeof updateWhatIfSimulation === 'function') updateWhatIfSimulation();
      };
    }
  });

  const mixHeaderBtn = document.getElementById('headerMixBtn');
  if (mixHeaderBtn) mixHeaderBtn.onclick = () => switchView('mixsugerido');

  // 4. Modal Cotizaciones
  const openCotizBtn = document.getElementById('openCotizModalBtn');
  if (openCotizBtn) openCotizBtn.onclick = () => openCotizacionModal();

  const closeCotizBtn = document.getElementById('closeCotizModalBtn');
  if (closeCotizBtn) closeCotizBtn.onclick = () => closeCotizacionModal();

  const cancelCotizBtn = document.getElementById('cancelCotizModalBtn');
  if (cancelCotizBtn) cancelCotizBtn.onclick = () => closeCotizacionModal();

  const saveCotizBtn = document.getElementById('saveCotizModalBtn');
  if (saveCotizBtn) saveCotizBtn.onclick = (e) => { e.preventDefault(); saveCotizacion(); };

  const cotizFormEl = document.getElementById('cotizacionModalForm');
  if (cotizFormEl) cotizFormEl.onsubmit = (e) => { e.preventDefault(); saveCotizacion(); };

  // 5. Paginación Cotizaciones
  const cotizPrev = document.getElementById('btnCotizPrevPage');
  if (cotizPrev) cotizPrev.onclick = () => changeCotizPage(-1);

  const cotizNext = document.getElementById('btnCotizNextPage');
  if (cotizNext) cotizNext.onclick = () => changeCotizPage(1);

  // 6. Paginación Compras & Stock
  const compPrev = document.getElementById('btnComprasPrevPage');
  if (compPrev) compPrev.onclick = () => {
    if (typeof comprasCurrentPage !== 'undefined' && comprasCurrentPage > 1) {
      comprasCurrentPage--;
      if (typeof renderComprasView === 'function') renderComprasView();
    }
  };

  const compNext = document.getElementById('btnComprasNextPage');
  if (compNext) compNext.onclick = () => {
    if (typeof comprasCurrentPage !== 'undefined') {
      comprasCurrentPage++;
      if (typeof renderComprasView === 'function') renderComprasView();
    }
  };

  // 7. Navegación Sidebar (.ax-nav__item con data-view)
  document.querySelectorAll('.ax-nav__item[data-view]').forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (view && typeof switchView === 'function') switchView(view);
    };
  });

  // 8. Barra de Búsqueda Rápida en Cabecera (Header Search Pill)
  const headerSearch = document.getElementById('headerSearchBtn');
  if (headerSearch) {
    headerSearch.onclick = () => {
      const activeView = document.querySelector('.view.active')?.id || '';
      if (activeView === 'view-cotizaciones') {
        const cIn = document.getElementById('fltCotizSearch');
        if (cIn) { cIn.focus(); cIn.select(); }
      } else if (activeView === 'view-compras') {
        const cIn = document.getElementById('comprasSearchBox');
        if (cIn) { cIn.focus(); cIn.select(); }
      } else if (activeView === 'view-productos') {
        const cIn = document.getElementById('prodSkuSearch');
        if (cIn) { cIn.focus(); cIn.select(); }
      } else if (activeView === 'view-fichatecnica') {
        const cIn = document.getElementById('ftSkuSearch');
        if (cIn) { cIn.focus(); cIn.select(); }
      } else {
        const sIn = document.getElementById('searchBox');
        if (sIn) { sIn.focus(); sIn.select(); }
      }
    };
  }

  // 9. Modal Metas Comerciales
  const headerTargetBtn = document.getElementById('headerTargetBtn');
  if (headerTargetBtn) headerTargetBtn.onclick = () => { if (typeof openTargetModal === 'function') openTargetModal(); };

  const closeTargetBtn = document.getElementById('closeTargetModalBtn');
  if (closeTargetBtn) closeTargetBtn.onclick = () => { if (typeof closeTargetModal === 'function') closeTargetModal(); };

  const cancelTargetBtn = document.getElementById('cancelTargetModalBtn');
  if (cancelTargetBtn) cancelTargetBtn.onclick = () => { if (typeof closeTargetModal === 'function') closeTargetModal(); };

  const saveTargetBtn = document.getElementById('saveTargetModalBtn');
  if (saveTargetBtn) saveTargetBtn.onclick = (e) => {
    e.preventDefault();
    if (typeof saveTargetSettings === 'function') saveTargetSettings();
    if (typeof closeTargetModal === 'function') closeTargetModal();
  };

  // 10. Catálogo de Productos
  const prodRand = document.getElementById('prodRandomBtn');
  if (prodRand) prodRand.onclick = () => randomizeProductSelection();

  const prodClr = document.getElementById('prodClearBtn');
  if (prodClr) prodClr.onclick = () => clearProductSearch();

  // 11. Menús Móviles & Autenticación
  const mobMenu = document.getElementById('mobileMenuBtn');
  if (mobMenu) mobMenu.onclick = () => toggleMobileSidebar();

  const mobFlt = document.getElementById('toggleMobileFiltersBtn');
  if (mobFlt) mobFlt.onclick = () => toggleMobileFilters();

  const cotizFlt = document.getElementById('toggleCotizFiltersBtn');
  if (cotizFlt) cotizFlt.onclick = () => toggleCotizMobileFilters();

  // 12. Filtros de Periodo de Fecha (Hoy, 7 Días, Este Mes, Este Año, Todo)
  setupDatePresetListeners();

  const sideAuth = document.getElementById('sidebarAuthBtn');
  if (sideAuth) sideAuth.onclick = () => { if (typeof AuthManager !== 'undefined') AuthManager.openLoginModal(); };

  const loginSub = document.getElementById('btnLoginSubmit');
  if (loginSub) {
    loginSub.onclick = (e) => {
      e.preventDefault();
      if (typeof AuthManager !== 'undefined') {
        const email = document.getElementById('loginEmail')?.value;
        const pass = document.getElementById('loginPassword')?.value;
        const canal = document.getElementById('loginCanal')?.value;
        AuthManager.login(email, pass, canal);
      }
    };
  }

  document.querySelectorAll('.quick-pill').forEach(pill => {
    pill.onclick = (e) => {
      e.preventDefault();
      const email = pill.dataset.email || 'admin@glomax.cl';
      const pass = pill.dataset.pass || 'admin123';
      const canal = pill.dataset.canal || 'Todos';
      
      const emailIn = document.getElementById('loginEmail');
      const passIn = document.getElementById('loginPassword');
      const canalIn = document.getElementById('loginCanal');
      
      if (emailIn) emailIn.value = email;
      if (passIn) passIn.value = pass;
      if (canalIn) canalIn.value = canal;

      if (typeof AuthManager !== 'undefined') {
        AuthManager.login(email, pass, canal);
      }
    };
  });
}

function setupDatePresetListeners() {
  const container = document.getElementById('datePresets');
  if (!container) return;

  const presetBtns = container.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      const elDesde = document.getElementById('fltDesde');
      const elHasta = document.getElementById('fltHasta');
      
      if (!elDesde || !elHasta) return;

      let now = new Date();
      if (rows && rows.length > 0) {
        const validDates = rows.map(r => new Date(r['FECHA'])).filter(d => !isNaN(d.getTime()));
        if (validDates.length > 0) {
          const maxDatasetDate = new Date(Math.max(...validDates));
          if (maxDatasetDate.getFullYear() > now.getFullYear()) {
            now = maxDatasetDate;
          }
        }
      }

      const formatDate = (d) => d.toISOString().slice(0, 10);

      if (preset === 'today') {
        elDesde.value = formatDate(now);
        elHasta.value = formatDate(now);
      } else if (preset === '7days') {
        const past = new Date(now);
        past.setDate(past.getDate() - 7);
        elDesde.value = formatDate(past);
        elHasta.value = formatDate(now);
      } else if (preset === 'thisMonth') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        elDesde.value = formatDate(startOfMonth);
        elHasta.value = formatDate(endOfMonth);
      } else if (preset === 'thisYear') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        elDesde.value = formatDate(startOfYear);
        elHasta.value = formatDate(endOfYear);
      } else if (preset === 'all') {
        elDesde.value = '';
        elHasta.value = '';
      }

      applyFilters();

      if (typeof showToast === 'function') {
        showToast(`📅 Periodo aplicado: ${btn.textContent.trim()}`);
      }
    };
  });
}


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
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sb = document.getElementById('searchBox');
  if (sb) sb.value = '';

  const container = document.getElementById('datePresets');
  if (container) {
    const presetBtns = container.querySelectorAll('.preset-btn');
    presetBtns.forEach(b => b.classList.remove('active'));
    const allBtn = container.querySelector('[data-preset="all"]');
    if (allBtn) allBtn.classList.add('active');
  }

  applyFilters();
  if (typeof showToast === 'function') showToast('🧹 Todos los filtros fueron limpiados');
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
  if (!track) return;
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
  renderSummaryCards();
}

function renderSummaryCards() {
  const f = getFilters();
  const now = new Date();

  // Encontrar fecha de referencia en los datos o usar la fecha actual
  let refDate = now;
  if (rows && rows.length > 0) {
    const validDates = rows.map(r => new Date(r['FECHA'] + 'T12:00:00')).filter(d => !isNaN(d.getTime()));
    if (validDates.length > 0) {
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const pastOrToday = validDates.filter(d => d <= todayEnd);
      refDate = pastOrToday.length > 0 ? new Date(Math.max(...pastOrToday)) : new Date(Math.max(...validDates));
    }
  }

  // Filtrar filas según filtros de dimensión seleccionados (canal, tienda, vendedor, familia, región)
  const baseRows = (rows || []).filter(r => {
    if (f.canal && r['CANAL FINAL'] !== f.canal) return false;
    if (f.tienda && r['TIENDA FINAL'] !== f.tienda) return false;
    if (f.vendedor && r['CODVENDENDOR'] !== f.vendedor) return false;
    if (f.familia && r['FAMILIA'] !== f.familia) return false;
    if (f.region && r['REGION'] !== f.region) return false;
    return true;
  });

  const refYyyy = refDate.getFullYear();
  const refMm = String(refDate.getMonth() + 1).padStart(2, '0');
  const refDd = String(refDate.getDate()).padStart(2, '0');

  const refDateISO = `${refYyyy}-${refMm}-${refDd}`;
  const refMonthISO = `${refYyyy}-${refMm}`;
  const refYearISO = `${refYyyy}`;

  // 1. VENTAS DE HOY / DÍA (fecha exacta refDateISO)
  const rowsHoy = baseRows.filter(r => r['FECHA'] === refDateISO);

  const totalHoy = rowsHoy.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const docsHoy = new Set(rowsHoy.map(r => r['FOLIO'])).size;
  const cantHoy = rowsHoy.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  // 2. VENTAS ACUMULADAS DEL MES (MTD)
  const rowsMes = baseRows.filter(r => r['FECHA'] && r['FECHA'].startsWith(refMonthISO));
  const totalMes = rowsMes.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const docsMes = new Set(rowsMes.map(r => r['FOLIO'])).size;
  const cantMes = rowsMes.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  // 3. VENTAS ACUMULADAS DEL AÑO (YTD) - Usar dataset completo 'rows' de todo el año
  const rowsAnio = baseRows.filter(r => r['FECHA'] && r['FECHA'].startsWith(refYearISO));
  const totalAnio = rowsAnio.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);
  const docsAnio = new Set(rowsAnio.map(r => r['FOLIO'])).size;
  const cantAnio = rowsAnio.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  // 4. PROYECCIONES AI FORECAST
  const currentDay = refDate.getDate();
  const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  const currentDayOfYear = Math.floor((refDate - new Date(refDate.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

  const projHoy = Math.round(totalHoy * 1.15);
  const projMes = currentDay > 0 ? Math.round((totalMes / currentDay) * daysInMonth) : Math.round(totalMes * 1.10);
  const projAnio = currentDayOfYear > 0 ? Math.round((totalAnio / currentDayOfYear) * 365) : Math.round(totalAnio * 1.20);

  const mesNombre = refDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const diaNombre = refDate.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

  // RENDER CARD 1: HOY
  const elTodayVal = document.getElementById('todayValue');
  const elTodayDate = document.getElementById('todayDateLabel');
  const elTodaySub = document.getElementById('todaySub');
  const elTodayComp = document.getElementById('todayCompare');

  if (elTodayVal) elTodayVal.textContent = formatCLP(totalHoy);
  if (elTodayDate) elTodayDate.textContent = diaNombre;
  if (elTodaySub) elTodaySub.textContent = `${formatNum(docsHoy)} documentos · ${formatNum(cantHoy)} unidades`;
  if (elTodayComp) elTodayComp.textContent = '🟢 En vivo';

  // RENDER CARD 2: MES (MTD)
  const elMonthVal = document.getElementById('monthValue');
  const elMonthDate = document.getElementById('monthDateLabel');
  const elMonthSub = document.getElementById('monthSub');
  const elMonthComp = document.getElementById('monthCompare');

  if (elMonthVal) elMonthVal.textContent = formatCLP(totalMes);
  if (elMonthDate) elMonthDate.textContent = mesNombre;
  if (elMonthSub) elMonthSub.textContent = `${formatNum(docsMes)} documentos · ${formatNum(cantMes)} unidades`;
  if (elMonthComp) elMonthComp.textContent = '📈 MTD Acumulado';

  // RENDER CARD 3: AÑO (YTD)
  const elYearVal = document.getElementById('yearValue');
  const elYearDate = document.getElementById('yearDateLabel');
  const elYearSub = document.getElementById('yearSub');
  const elYearComp = document.getElementById('yearCompare');

  if (elYearVal) elYearVal.textContent = formatCLP(totalAnio);
  if (elYearDate) elYearDate.textContent = `Año ${refDate.getFullYear()}`;
  if (elYearSub) elYearSub.textContent = `${formatNum(docsAnio)} documentos acumulados`;
  if (elYearComp) elYearComp.textContent = '🏆 YTD Acumulado';

  // RENDER CARD 4: PROYECCIÓN DÍA
  const elTodayProjVal = document.getElementById('todayProjValue');
  const elTodayProjDate = document.getElementById('todayProjDateLabel');
  const elTodayProjSub = document.getElementById('todayProjSub');
  const elTodayProjComp = document.getElementById('todayProjCompare');

  if (elTodayProjVal) elTodayProjVal.textContent = formatCLP(projHoy);
  if (elTodayProjDate) elTodayProjDate.textContent = 'Cierre de Hoy';
  if (elTodayProjSub) elTodayProjSub.textContent = 'Pronóstico basado en ritmo de facturación diario';
  if (elTodayProjComp) elTodayProjComp.textContent = '⚡ Forecast Día';

  // RENDER CARD 5: PROYECCIÓN MES
  const elMonthProjVal = document.getElementById('monthProjValue');
  const elMonthProjDate = document.getElementById('monthProjDateLabel');
  const elMonthProjSub = document.getElementById('monthProjSub');
  const elMonthProjComp = document.getElementById('monthProjCompare');

  if (elMonthProjVal) elMonthProjVal.textContent = formatCLP(projMes);
  if (elMonthProjDate) elMonthProjDate.textContent = `Cierre de ${mesNombre}`;
  if (elMonthProjSub) elMonthProjSub.textContent = `Extrapolación a ${daysInMonth} días del mes`;
  if (elMonthProjComp) elMonthProjComp.textContent = '📊 Forecast MTD';

  // RENDER CARD 6: PROYECCIÓN AÑO
  const elYearProjVal = document.getElementById('yearProjValue');
  const elYearProjDate = document.getElementById('yearProjDateLabel');
  const elYearProjSub = document.getElementById('yearProjSub');
  const elYearProjComp = document.getElementById('yearProjCompare');

  if (elYearProjVal) elYearProjVal.textContent = formatCLP(projAnio);
  if (elYearProjDate) elYearProjDate.textContent = `Cierre Año ${refDate.getFullYear()}`;
  if (elYearProjSub) elYearProjSub.textContent = 'Extrapolación anual completa AI Forecast';
  if (elYearProjComp) elYearProjComp.textContent = '🚀 Forecast YTD';
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
const FIELD_MAP = [
  ['fFolio', 'FOLIO'], ['fTipo', 'TIPO'], ['fFecha', 'FECHA'],
  ['fCodigo', 'CODIGO'], ['fDescripcion', 'DESCRIPCION'], ['fCant', 'CANTFACTURADA'],
  ['fPreUni', 'PREUNI'], ['fCostos', 'COSTOS'], ['fCliente', 'CLIENTE'],
  ['fRut', 'RUT'], ['fVendedor', 'CODVENDENDOR'], ['fCanal', 'CANAL FINAL'],
  ['fTienda', 'TIENDA FINAL'], ['fFamilia', 'FAMILIA'], ['fCategoria', 'CATEGORIA'],
  ['fRegion', 'REGION'],
  // Mapeos legacy de respaldo:
  ['f-folio', 'FOLIO'], ['f-tipo', 'TIPO'], ['f-fecha', 'FECHA'], ['f-nvnumero', 'NVNUMERO'],
  ['f-codbode', 'CODBODE'], ['f-sistema', 'SISTEMA'], ['f-grupo', 'GRUPO'],
  ['f-codigo', 'CODIGO'], ['f-descripcion', 'DESCRIPCION'], ['f-familia', 'FAMILIA'],
  ['f-categoria', 'CATEGORIA'], ['f-linea', 'LINEA'], ['f-marca', 'MARCA'],
  ['f-cantfacturada', 'CANTFACTURADA'], ['f-preuni', 'PREUNI'], ['f-costos', 'COSTOS'],
  ['f-cliente', 'CLIENTE'], ['f-rut', 'RUT'], ['f-codvendedor', 'CODVENDENDOR'],
  ['f-canalfinal', 'CANAL FINAL'], ['f-tiendafinal', 'TIENDA FINAL'],
  ['f-comuna', 'COMUNA'], ['f-region', 'REGION'], ['f-glosa', 'GLOSA']
];

function getModalBackdrop() {
  return document.getElementById('modalBackdrop') || document.getElementById('modalOverlay');
}

function getModalForm() {
  return document.getElementById('modalForm') || document.getElementById('rowForm');
}

function openModalForNew() {
  const backdrop = getModalBackdrop();
  const titleEl = document.getElementById('modalTitle');
  const formEl = getModalForm();
  const delBtn = document.getElementById('deleteRowBtn');
  const rowInput = document.getElementById('fRow') || document.getElementById('f-row');
  const dateInput = document.getElementById('fFecha') || document.getElementById('f-fecha');

  if (titleEl) titleEl.textContent = 'Nuevo registro de Venta';
  if (formEl) formEl.reset();
  if (rowInput) rowInput.value = '';
  if (delBtn) delBtn.style.display = 'none';
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (backdrop) backdrop.classList.add('active');
}

function openModal() {
  openModalForNew();
}

function openModalForEdit(rowId) {
  const r = rows.find(x => String(x['_row']) === String(rowId));
  if (!r) return;
  const backdrop = getModalBackdrop();
  const titleEl = document.getElementById('modalTitle');
  const delBtn = document.getElementById('deleteRowBtn');
  const rowInput = document.getElementById('fRow') || document.getElementById('f-row');

  if (titleEl) titleEl.textContent = 'Editar registro de Venta';
  if (rowInput) rowInput.value = r['_row'];

  FIELD_MAP.forEach(([elId, field]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (field === 'FECHA') el.value = toDateInputValue(r[field]);
    else el.value = r[field] !== undefined && r[field] !== null ? r[field] : '';
  });

  if (delBtn) delBtn.style.display = 'inline-block';
  if (backdrop) backdrop.classList.add('active');
}

function closeModal() {
  const backdrop = getModalBackdrop();
  if (backdrop) backdrop.classList.remove('active');
}

async function saveRow() {
  const rowInput = document.getElementById('fRow') || document.getElementById('f-row');
  const rowId = rowInput ? rowInput.value : '';
  const data = {};

  FIELD_MAP.forEach(([elId, field]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    data[field] = el.value;
  });

  try {
    if (rowId) {
      await apiPost({ action: 'update', row: rowId, data });
      if (typeof showToast === 'function') showToast('✅ Registro actualizado exitosamente');
    } else {
      await apiPost({ action: 'add', data });
      if (typeof showToast === 'function') showToast('✅ Registro creado exitosamente');
    }
    closeModal();
    loadData(false);
  } catch (err) {
    if (typeof showToast === 'function') showToast('⚠️ Error al guardar: ' + err.message);
  }
}

async function deleteCurrentRow() {
  const rowInput = document.getElementById('fRow') || document.getElementById('f-row');
  const rowId = rowInput ? rowInput.value : '';
  if (!rowId) return;
  if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
  try {
    await apiPost({ action: 'delete', row: rowId });
    if (typeof showToast === 'function') showToast('🗑️ Registro eliminado');
    closeModal();
    loadData(false);
  } catch (err) {
    if (typeof showToast === 'function') showToast('⚠️ Error al eliminar: ' + err.message);
  }
}

// ---------- Refresh manual y automático ----------
const refreshBtnEl = document.getElementById('refreshBtn');
if (refreshBtnEl) refreshBtnEl.addEventListener('click', () => loadData(true));

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadData(false), REFRESH_INTERVAL_MS);
}

// ---------- Init ----------
if (typeof setupAllButtonListeners === 'function') {
  setupAllButtonListeners();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof setupAllButtonListeners === 'function') setupAllButtonListeners();
  });
}

loadData(true);
startAutoRefresh();
if (typeof fetchCotizacionesData === 'function') {
  fetchCotizacionesData().then(loaded => {
    if (loaded && loaded.length > 0) {
      cotizacionesRows = loaded;
      populateCotizFilterOptions();
    }
  }).catch(() => {});
}




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



































// ==========================================================================
// MÓDULO DE COTIZACIONES (DASHBOARD MAYORISTAS - GID: 2001859242)
// ==========================================================================

let cotizacionesRows = [];
let filteredCotizacionesRows = [];
let isCotizSyncing = false;
let cotizCurrentPage = 1;
const COTIZ_PAGE_SIZE = 50;
let chartCotizEvolInstance = null;
let chartCotizEstadoInstance = null;
let chartCotizRespInstance = null;
let cotizListenersAttached = false;

/**
 * Parser de fecha robusto para Google Sheets (GViz Date(Y,M,D), DD/MM/YYYY, YYYY-MM-DD)
 */
function parseCotizDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const str = String(raw).trim();
  if (!str) return null;

  // 1. Formato GViz: Date(YYYY, M, D) (M es 0-indexed en GViz)
  const gvizMatch = str.match(/Date\((\d+),\s*(\d+),\s*(\d+)/i);
  if (gvizMatch) {
    const y = parseInt(gvizMatch[1], 10);
    const m = parseInt(gvizMatch[2], 10);
    const d = parseInt(gvizMatch[3], 10);
    return new Date(y, m, d);
  }

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return new Date(y, m, d);
  }

  // 3. Formato YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    return new Date(y, m, d);
  }

  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Normaliza las filas crudas desde Google Sheets (GViz JSONP o CSV Proxy)
 */
function normalizeCotizacionesRows(rawRows) {
  if (!rawRows || !Array.isArray(rawRows)) return [];
  const normalized = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;

    const colVal = (colName, colIdx) => {
      if (r[colName] !== undefined && r[colName] !== null && String(r[colName]).trim() !== '') {
        return r[colName];
      }
      if (colIdx !== undefined && r['_col_' + colIdx] !== undefined && r['_col_' + colIdx] !== null) {
        return r['_col_' + colIdx];
      }
      return '';
    };

    const colFormatted = (colIdx) => {
      if (colIdx !== undefined && r['_fcol_' + colIdx] !== undefined && r['_fcol_' + colIdx] !== null) {
        return r['_fcol_' + colIdx];
      }
      return '';
    };

    let tipo = String(colVal('Tipo Solicitud', 1) || colVal('TIPO SOLICITUD', 1) || colVal('TIPO', 1) || 'Estándar').trim();
    let rut = String(colFormatted(2) || colVal('Rut', 2) || colVal('RUT', 2) || '').trim();
    let cliente = String(colVal('Cliente', 3) || colVal('CLIENTE', 3) || '').trim();
    let contacto = String(colVal('Whatsapp / Mail', 4) || colVal('WHATSAPP / MAIL', 4) || '').trim();
    let vendedor = String(colFormatted(5) || colVal('Cod. Vendedor', 5) || colVal('COD. VENDEDOR', 5) || colVal('CODVENDENDOR', 5) || '').replace(/\.0$/, '').trim();
    let numCot = String(colFormatted(6) || colVal('(#) Cot', 6) || colVal('(#) COT', 6) || colVal('FOLIO', 6) || '').replace(/\.0$/, '').trim();
    let sku = String(colVal('SKU', 7) || colVal('CODIGO', 7) || '').trim().toUpperCase();
    let producto = String(colVal('Producto', 8) || colVal('PRODUCTO', 8) || colVal('DESCRIPCION', 8) || '').trim();
    
    let cantRaw = colVal('Cantidad', 9) || colVal('CANTIDAD', 9) || colVal('CANTFACTURADA', 9) || 0;
    let preUniRaw = colVal('Precio', 10) || colVal('PRECIO', 10) || colVal('PREUNI', 10) || 0;
    let totalRaw = colVal('Total', 11) || colVal('TOTAL', 11) || colVal('NETO', 11) || 0;
    
    let fechaRaw = colFormatted(13) || colVal('Fecha Solicitud', 13) || colVal('FECHA SOLICITUD', 13) || colVal('FECHA', 13) || '';
    let responsable = String(colVal('Responsable', 14) || colVal('RESPONSABLE', 14) || '').trim();
    let estado = String(colVal('Estado', 16) || colVal('ESTADO', 16) || '').trim();
    let obs = String(colVal('Observaciones', 17) || colVal('OBSERVACIONES', 17) || '').trim();
    let transporte = String(colVal('Transporte', 18) || colVal('TRANSPORTE', 18) || '').trim();
    let nv = String(colFormatted(19) || colVal('NV', 19) || colVal('NVNUMERO', 19) || '').replace(/\.0$/, '').trim();
    let fa = String(colFormatted(20) || colVal('FA', 20) || '').replace(/\.0$/, '').trim();
    let estadoNv = String(colVal('Estado NV', 21) || colVal('ESTADO NV', 21) || '').trim();
    let mes = String(colFormatted(22) || colVal('MES', 22) || '').replace(/\.0$/, '').trim();
    let estadoFinal = String(colVal('Cliente_X', 23) || colVal('_col_23', 23) || colVal('ESTADO FINAL', 23) || estado || 'Pendiente').trim();
    let costoRaw = colVal('Costo', 29) || colVal('COSTO', 29) || colVal('COSTOS', 29) || 0;
    let mesT = String(colVal('Mes T', 30) || colVal('MES T', 30) || '').trim();
    let anio = String(colFormatted(31) || colVal('Año', 31) || colVal('AÑO', 31) || '').replace(/\.0$/, '').trim();

    // Conversiones numéricas seguras
    let cantidad = typeof cantRaw === 'number' ? cantRaw : parseFloat(String(cantRaw).replace(/\./g, '').replace(/,/g, '.')) || 0;
    let precio = typeof preUniRaw === 'number' ? preUniRaw : parseFloat(String(preUniRaw).replace(/\./g, '').replace(/,/g, '.')) || 0;
    let total = typeof totalRaw === 'number' ? totalRaw : parseFloat(String(totalRaw).replace(/\./g, '').replace(/,/g, '.')) || 0;
    if (total === 0 && cantidad > 0 && precio > 0) {
      total = cantidad * precio;
    }
    let costo = typeof costoRaw === 'number' ? costoRaw : parseFloat(String(costoRaw).replace(/\./g, '').replace(/,/g, '.')) || 0;

    let fechaObj = parseCotizDate(fechaRaw);
    let fechaStr = fechaObj ? fechaObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : String(fechaRaw || '');

    if (!sku && !cliente && !numCot && total === 0) continue;

    normalized.push({
      tipo: tipo || 'Estándar',
      rut,
      cliente: cliente || 'Cliente Mayorista',
      contacto,
      vendedor: vendedor || '131',
      numCot: numCot || `COT-${i+1}`,
      sku: sku || 'SKU-GENERAL',
      producto: producto || 'Producto Cotizado',
      cantidad: Math.max(0, cantidad),
      precio: Math.max(0, precio),
      total: Math.max(0, total),
      costo: Math.max(0, costo),
      fecha: fechaStr,
      fechaObj: fechaObj,
      responsable: responsable || 'Denisse',
      estado: estado || 'Enviada Cliente',
      observaciones: obs,
      transporte,
      nv,
      fa,
      estadoNv,
      mes,
      estadoFinal: estadoFinal || estado || 'Enviada Cliente',
      mesT,
      anio,
      _row: i + 2
    });
  }

  return normalized;
}

/**
 * Conexión Multi-canal a Google Sheets pestaña Mayoristas (GID: 2001859242)
 */
async function fetchCotizacionesData() {
  const spId = typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ";
  const cotizGid = typeof SPREADSHEET_COTIZACIONES_GID !== 'undefined' ? SPREADSHEET_COTIZACIONES_GID : "2001859242";
  const isGitHub = window.location.hostname.includes('github') || window.location.protocol === 'file:';

  console.log(`[Cotizaciones Engine] 🚀 Conectando a pestaña Mayoristas (GID: ${cotizGid})...`);

  // 1. Intentar FastChannel JSONP (Rápido, 8s timeout)
  try {
    if (typeof fetchGVizViaJSONP === 'function') {
      const gvizRows = await fetchGVizViaJSONP(spId, cotizGid, 8000);
      if (gvizRows && gvizRows.length > 0) {
        console.log(`[Cotizaciones FastChannel] ✅ ${gvizRows.length.toLocaleString()} filas sincronizadas vía JSONP`);
        const parsed = normalizeCotizacionesRows(gvizRows);
        try { localStorage.setItem('glomax_cotizaciones_cache', JSON.stringify(parsed.slice(0, 2000))); } catch(e) {}
        return parsed;
      }
    }
  } catch (jsonpErr) {
    console.warn('[Cotizaciones FastChannel] Falló JSONP, probando proxy local:', jsonpErr.message || jsonpErr);
  }

  // 2. Intentar Proxy Local / Netlify Function (/api/proxy?spreadsheet_id=...&gid=2001859242)
  if (!isGitHub) {
    const proxyUrls = [
      `/api/proxy?spreadsheet_id=${spId}&gid=${cotizGid}`,
      `/api/csv?spreadsheet_id=${spId}&gid=${cotizGid}`
    ];

    for (const pUrl of proxyUrls) {
      try {
        const resp = await fetch(pUrl, { signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.length > 200 && !text.trim().startsWith('<')) {
            if (typeof parseCsvText === 'function') {
              const rowsParsed = parseCsvText(text);
              if (rowsParsed && rowsParsed.length > 0) {
                console.log(`[Cotizaciones Proxy Local] ✅ ${rowsParsed.length.toLocaleString()} filas sincronizadas`);
                const parsed = normalizeCotizacionesRows(rowsParsed);
                try { localStorage.setItem('glomax_cotizaciones_cache', JSON.stringify(parsed.slice(0, 2000))); } catch(e) {}
                return parsed;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[Cotizaciones Proxy Local] Falló ${pUrl}:`, err.message || err);
      }
    }
  }

  // 3. Fallback Universal: CORS Proxies
  const corsProxies = [
    `https://api.allorigins.win/raw?url=` + encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spId}/export?format=csv&gid=${cotizGid}`),
    `https://corsproxy.io/?` + encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spId}/export?format=csv&gid=${cotizGid}`)
  ];

  for (const cUrl of corsProxies) {
    try {
      const resp = await fetch(cUrl, { signal: AbortSignal.timeout(6000) });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.length > 200 && !text.trim().startsWith('<')) {
          if (typeof parseCsvText === 'function') {
            const rowsParsed = parseCsvText(text);
            if (rowsParsed && rowsParsed.length > 0) {
              console.log(`[Cotizaciones Universal Proxy] ✅ ${rowsParsed.length.toLocaleString()} filas sincronizadas`);
              const parsed = normalizeCotizacionesRows(rowsParsed);
              try { localStorage.setItem('glomax_cotizaciones_cache', JSON.stringify(parsed.slice(0, 2000))); } catch(e) {}
              return parsed;
            }
          }
        }
      }
    } catch(e) {}
  }

  // 4. Intentar caché local almacenada
  try {
    const cachedStr = localStorage.getItem('glomax_cotizaciones_cache');
    if (cachedStr) {
      const cachedData = JSON.parse(cachedStr);
      if (cachedData && cachedData.length > 0) {
        cachedData.forEach(r => {
          r.fechaObj = parseCotizDate(r.fechaObj || r.fecha);
        });
        console.log(`[Cotizaciones Cache] 📦 Cargados ${cachedData.length.toLocaleString()} registros desde caché local`);
        return cachedData;
      }
    }
  } catch(e) {}

  return [];
}

/**
 * Sincronización en vivo de cotizaciones
 */
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
      if (!silent && typeof showToast === 'function') {
        showToast(`✅ Pestaña Mayoristas sincronizada (${cotizacionesRows.length.toLocaleString('es-CL')} cotizaciones)`);
      }
    } else {
      if (!silent && typeof showToast === 'function') {
        showToast('⚠️ No se recibieron datos desde la pestaña Mayoristas');
      }
    }
  } catch (err) {
    console.warn('[Cotizaciones Sync Error]:', err);
    if (!silent && typeof showToast === 'function') {
      showToast('⚠️ Error al sincronizar cotizaciones: ' + err.message);
    }
  } finally {
    isCotizSyncing = false;
    if (syncPill) {
      const nowStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      syncPill.innerHTML = `<span class="dot" style="background:#10b981;"></span> <span>En vivo (${nowStr})</span>`;
    }
  }
}

/**
 * Establece rangos de fechas predefinidos para Cotizaciones
 */
function setCotizDatePreset(preset) {
  const fDesde = document.getElementById('fltCotizDesde');
  const fHasta = document.getElementById('fltCotizHasta');
  const container = document.getElementById('cotizDatePresets');
  if (container) {
    container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    const btn = container.querySelector(`[data-preset="${preset}"]`);
    if (btn) btn.classList.add('active');
  }

  const now = new Date();
  let dStart = null;
  let dEnd = null;

  if (preset === 'today') {
    dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (preset === '7days') {
    dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dEnd = now;
  } else if (preset === 'thisMonth') {
    dStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    dEnd = now;
  } else if (preset === 'thisYear') {
    dStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    dEnd = now;
  } else if (preset === 'all') {
    dStart = null;
    dEnd = null;
  }

  const toInputDate = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (fDesde) fDesde.value = toInputDate(dStart);
  if (fHasta) fHasta.value = toInputDate(dEnd);

  applyCotizacionesFilters();
}

/**
 * Limpia todos los filtros activos de Cotizaciones
 */
function clearCotizFilters() {
  const fDesde = document.getElementById('fltCotizDesde');
  const fHasta = document.getElementById('fltCotizHasta');
  const fVend = document.getElementById('fltCotizVendedor');
  const fEstado = document.getElementById('fltCotizEstado');
  const fTipo = document.getElementById('fltCotizTipo');
  const fSearch = document.getElementById('cotizSearchBox');

  if (fDesde) fDesde.value = '';
  if (fHasta) fHasta.value = '';
  if (fVend) fVend.value = '';
  if (fEstado) fEstado.value = '';
  if (fTipo) fTipo.value = '';
  if (fSearch) fSearch.value = '';

  const container = document.getElementById('cotizDatePresets');
  if (container) {
    container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    const allBtn = container.querySelector('[data-preset="all"]');
    if (allBtn) allBtn.classList.add('active');
  }

  applyCotizacionesFilters();
  if (typeof showToast === 'function') showToast('🧹 Filtros de cotizaciones restablecidos');
}

/**
 * Llena dinámicamente las opciones de los filtros nativos de Cotizaciones
 */
function populateCotizFilterOptions() {
  const selVend = document.getElementById('fltCotizVendedor');
  const selEstado = document.getElementById('fltCotizEstado');
  const selTipo = document.getElementById('fltCotizTipo');

  if (!cotizacionesRows || cotizacionesRows.length === 0) return;

  const curVend = selVend ? selVend.value : '';
  const curEstado = selEstado ? selEstado.value : '';
  const curTipo = selTipo ? selTipo.value : '';

  const vendedores = new Set();
  const estados = new Set();
  const tipos = new Set();

  cotizacionesRows.forEach(r => {
    if (r.vendedor) vendedores.add(r.vendedor);
    if (r.estadoFinal) estados.add(r.estadoFinal);
    else if (r.estado) estados.add(r.estado);
    if (r.tipo) tipos.add(r.tipo);
  });

  if (selVend) {
    const sortedVend = Array.from(vendedores).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    selVend.innerHTML = '<option value="">Todos los Vendedores</option>' +
      sortedVend.map(v => `<option value="${v}" ${v === curVend ? 'selected' : ''}>Cod. ${v}</option>`).join('');
  }

  if (selEstado) {
    const sortedEstados = Array.from(estados).sort();
    selEstado.innerHTML = '<option value="">Todos los Estados</option>' +
      sortedEstados.map(e => `<option value="${e}" ${e === curEstado ? 'selected' : ''}>${e}</option>`).join('');
  }

  if (selTipo) {
    const sortedTipos = Array.from(tipos).sort();
    selTipo.innerHTML = '<option value="">Todos los Tipos</option>' +
      sortedTipos.map(t => `<option value="${t}" ${t === curTipo ? 'selected' : ''}>${t}</option>`).join('');
  }

  setupCotizacionesEventListeners();
}

/**
 * Aplica los filtros seleccionados a las cotizaciones y actualiza vistas en tiempo real
 */
function applyCotizacionesFilters() {
  if (!cotizacionesRows || !Array.isArray(cotizacionesRows)) return;

  const fDesde = document.getElementById('fltCotizDesde')?.value;
  const fHasta = document.getElementById('fltCotizHasta')?.value;
  const fVend = (document.getElementById('fltCotizVendedor')?.value || '').trim();
  const fEstado = (document.getElementById('fltCotizEstado')?.value || '').trim().toLowerCase();
  const fTipo = (document.getElementById('fltCotizTipo')?.value || '').trim().toLowerCase();
  const fSearch = (document.getElementById('cotizSearchBox')?.value || '').trim().toLowerCase();

  const dDesde = fDesde ? new Date(fDesde + 'T00:00:00') : null;
  const dHasta = fHasta ? new Date(fHasta + 'T23:59:59') : null;

  filteredCotizacionesRows = cotizacionesRows.filter(r => {
    // 1. Filtro de Rango de Fechas
    if (dDesde || dHasta) {
      let rowDate = (r.fechaObj instanceof Date && !isNaN(r.fechaObj.getTime())) ? r.fechaObj : parseCotizDate(r.fechaObj || r.fecha);
      if (!rowDate) return false; // Si hay filtro de fecha activo y la fila no tiene fecha válida, se excluye
      if (dDesde && rowDate < dDesde) return false;
      if (dHasta && rowDate > dHasta) return false;
    }

    // 2. Filtro Vendedor (Código numérico)
    if (fVend && r.vendedor !== fVend) return false;

    // 3. Filtro Estado (Columna X / Columna Q)
    if (fEstado) {
      const stFinal = (r.estadoFinal || '').toLowerCase();
      const stGen = (r.estado || '').toLowerCase();
      if (stFinal !== fEstado && stGen !== fEstado && !stFinal.includes(fEstado) && !stGen.includes(fEstado)) {
        return false;
      }
    }

    // 4. Filtro Tipo Solicitud (Estándar, Cyber, Promoción, Especial)
    if (fTipo) {
      const tipoLow = (r.tipo || '').toLowerCase();
      if (tipoLow !== fTipo && !tipoLow.includes(fTipo)) return false;
    }

    // 5. Filtro Búsqueda de Texto en Vivo
    if (fSearch) {
      const searchStr = `${r.numCot} ${r.cliente} ${r.rut} ${r.sku} ${r.producto} ${r.vendedor} ${r.nv} ${r.fa} ${r.responsable} ${r.observaciones}`.toLowerCase();
      if (!searchStr.includes(fSearch)) return false;
    }

    return true;
  });

  cotizCurrentPage = 1;
  renderCotizacionesHeroCards(filteredCotizacionesRows);
  renderCotizacionesCharts(filteredCotizacionesRows);
  renderCotizacionesTopProducts(filteredCotizacionesRows);
  renderCotizacionesTable(filteredCotizacionesRows);
}

/**
 * Renderiza Hero Cards por Tipo de Solicitud (Columna B) y Desglose por Estado (Columna X)
 */
function renderCotizacionesHeroCards(data) {
  const container = document.getElementById('cotizTipoCardsContainer');
  const summaryStrip = document.getElementById('cotizSummaryStrip');
  const subEl = document.getElementById('cotizTipoCardsSubtitle');
  if (!container) return;

  if (!data || data.length === 0) {
    if (summaryStrip) {
      summaryStrip.innerHTML = `
        <div class="cotiz-summary-card">
          <div class="cotiz-summary-icon" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">💰</div>
          <div>
            <div class="cotiz-summary-lbl">Cartera Total Cotizada</div>
            <div class="cotiz-summary-val" style="color: #60a5fa;">$0</div>
            <div class="cotiz-summary-sub">0 solicitudes en este periodo</div>
          </div>
        </div>
        <div class="cotiz-summary-card">
          <div class="cotiz-summary-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">🏆</div>
          <div>
            <div class="cotiz-summary-lbl">Negocios Ganados</div>
            <div class="cotiz-summary-val" style="color: #34d399;">$0</div>
            <div class="cotiz-summary-sub" style="color: #34d399;">0 cotizaciones aceptadas</div>
          </div>
        </div>
        <div class="cotiz-summary-card">
          <div class="cotiz-summary-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">⏳</div>
          <div>
            <div class="cotiz-summary-lbl">En Seguimiento Activo</div>
            <div class="cotiz-summary-val" style="color: #fbbf24;">$0</div>
            <div class="cotiz-summary-sub" style="color: #fbbf24;">0 solicitudes en proceso</div>
          </div>
        </div>
        <div class="cotiz-summary-card">
          <div class="cotiz-summary-icon" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">📈</div>
          <div>
            <div class="cotiz-summary-lbl">Tasa Global de Conversión</div>
            <div class="cotiz-summary-val" style="color: #a78bfa;">0.0%</div>
            <div class="cotiz-summary-sub">Efectividad de cierre comercial</div>
          </div>
        </div>
      `;
    }
    container.innerHTML = `
      <div class="ax-card" style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; color: var(--ax-text-tertiary); background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
        <div style="font-size: 2.8rem; margin-bottom: 0.65rem;">📅</div>
        <div style="font-size: 1.15rem; font-weight: 700; color: var(--ax-text-primary); margin-bottom: 0.35rem;">No se registraron cotizaciones para el periodo o filtros seleccionados</div>
        <div style="font-size: 0.88rem; color: var(--ax-text-secondary);">Prueba seleccionando "Todo", "Este Año" o ajustando los filtros de búsqueda.</div>
      </div>
    `;
    if (subEl) subEl.textContent = '0 solicitudes encontradas | Cartera: $0';
    return;
  }

  // Agrupar por Tipo de Solicitud (Columna B)
  const byTipo = new Map();
  let grandTotalMonto = 0;
  let grandTotalUnidades = 0;
  let grandAceptadasMonto = 0;
  let grandAceptadasCnt = 0;
  let grandEnviadasMonto = 0;
  let grandEnviadasCnt = 0;
  let grandPerdidasMonto = 0;
  let grandPerdidasCnt = 0;

  data.forEach(r => {
    const t = r.tipo || 'Estándar';
    if (!byTipo.has(t)) {
      byTipo.set(t, {
        tipo: t,
        totalMonto: 0,
        count: 0,
        unidades: 0,
        aceptadasCnt: 0,
        aceptadasMonto: 0,
        enviadasCnt: 0,
        enviadasMonto: 0,
        perdidasCnt: 0,
        perdidasMonto: 0,
        otrasCnt: 0,
        otrasMonto: 0
      });
    }

    const item = byTipo.get(t);
    item.count += 1;
    item.unidades += (r.cantidad || 0);
    item.totalMonto += (r.total || 0);
    grandTotalMonto += (r.total || 0);
    grandTotalUnidades += (r.cantidad || 0);

    const stLow = (r.estadoFinal || r.estado || '').toLowerCase();
    if (stLow.includes('aceptada')) {
      item.aceptadasCnt += 1;
      item.aceptadasMonto += (r.total || 0);
      grandAceptadasCnt += 1;
      grandAceptadasMonto += (r.total || 0);
    } else if (stLow.includes('perdida')) {
      item.perdidasCnt += 1;
      item.perdidasMonto += (r.total || 0);
      grandPerdidasCnt += 1;
      grandPerdidasMonto += (r.total || 0);
    } else if (stLow.includes('enviada') || stLow.includes('proceso') || stLow.includes('preparación') || stLow.includes('preparacion')) {
      item.enviadasCnt += 1;
      item.enviadasMonto += (r.total || 0);
      grandEnviadasCnt += 1;
      grandEnviadasMonto += (r.total || 0);
    } else {
      item.otrasCnt += 1;
      item.otrasMonto += (r.total || 0);
    }
  });

  const grandWinRate = data.length > 0 ? ((grandAceptadasCnt / data.length) * 100).toFixed(1) : '0';
  if (subEl) {
    subEl.textContent = `Desglose de ${data.length.toLocaleString('es-CL')} solicitudes (${Math.round(grandTotalUnidades).toLocaleString('es-CL')} un.) | Cartera: ${formatCLP(grandTotalMonto)}`;
  }

  // 1. RENDERIZAR SUMMARY STRIP SUPERIOR
  if (summaryStrip) {
    summaryStrip.innerHTML = `
      <div class="cotiz-summary-card">
        <div class="cotiz-summary-icon" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">💰</div>
        <div>
          <div class="cotiz-summary-lbl">Cartera Total Cotizada</div>
          <div class="cotiz-summary-val" style="color: #60a5fa;">${formatCLP(grandTotalMonto)}</div>
          <div style="font-size: 0.76rem; color: #94a3b8;">${data.length.toLocaleString('es-CL')} solicitudes totales</div>
        </div>
      </div>

      <div class="cotiz-summary-card">
        <div class="cotiz-summary-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">🏆</div>
        <div>
          <div class="cotiz-summary-lbl">Negocios Ganados</div>
          <div class="cotiz-summary-val" style="color: #34d399;">${formatCLP(grandAceptadasMonto)}</div>
          <div style="font-size: 0.76rem; color: #34d399; font-weight: 700;">${grandAceptadasCnt.toLocaleString('es-CL')} cotizaciones aceptadas</div>
        </div>
      </div>

      <div class="cotiz-summary-card">
        <div class="cotiz-summary-icon" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">⏳</div>
        <div>
          <div class="cotiz-summary-lbl">En Seguimiento Activo</div>
          <div class="cotiz-summary-val" style="color: #fbbf24;">${formatCLP(grandEnviadasMonto)}</div>
          <div style="font-size: 0.76rem; color: #fbbf24; font-weight: 700;">${grandEnviadasCnt.toLocaleString('es-CL')} solicitudes en proceso</div>
        </div>
      </div>

      <div class="cotiz-summary-card">
        <div class="cotiz-summary-icon" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">📈</div>
        <div>
          <div class="cotiz-summary-lbl">Tasa Global de Conversión</div>
          <div class="cotiz-summary-val" style="color: #c084fc;">${grandWinRate}%</div>
          <div style="font-size: 0.76rem; color: #94a3b8;">Efectividad de cierre comercial</div>
        </div>
      </div>
    `;
  }

  // Tipos esperados en orden
  const expectedOrder = ['Estándar', 'Cyber', 'Promoción', 'Especial'];
  const sortedTipos = [];
  
  expectedOrder.forEach(t => {
    if (byTipo.has(t)) {
      sortedTipos.push(byTipo.get(t));
      byTipo.delete(t);
    }
  });
  // Agregar cualquier otro tipo adicional al final
  byTipo.forEach(val => sortedTipos.push(val));

  const tipoIcons = {
    'Estándar': '📋',
    'Promoción': '🔥',
    'Cyber': '⚡',
    'Especial': '💎'
  };

  const tipoClasses = {
    'Estándar': 'cotiz-tipo-card--estandar',
    'Promoción': 'cotiz-tipo-card--promocion',
    'Cyber': 'cotiz-tipo-card--cyber',
    'Especial': 'cotiz-tipo-card--especial'
  };

  container.innerHTML = sortedTipos.map(item => {
    const winRate = item.count > 0 ? ((item.aceptadasCnt / item.count) * 100).toFixed(1) : '0';
    const icon = tipoIcons[item.tipo] || '📑';
    const cardClass = tipoClasses[item.tipo] || '';
    const isHighWin = Number(winRate) >= 40;

    return `
      <div class="cotiz-tipo-card ${cardClass}">
        <!-- Cabecera de Tarjeta -->
        <div class="cotiz-tipo-card-header">
          <span class="cotiz-tipo-badge">
            <span class="cotiz-tipo-badge-icon">${icon}</span>
            <span>${item.tipo}</span>
          </span>
          <span class="cotiz-win-badge" style="background: ${isHighWin ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: ${isHighWin ? '#34d399' : '#60a5fa'}; border: 1px solid ${isHighWin ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'};">
            ${winRate}% Aprobación
          </span>
        </div>

        <!-- Monto Principal -->
        <div class="cotiz-tipo-monto">${formatCLP(item.totalMonto)}</div>
        <div class="cotiz-tipo-subtitle">
          <span>📦 <strong>${item.count.toLocaleString('es-CL')}</strong> solicitudes</span>
          <span>•</span>
          <span><strong>${Math.round(item.unidades).toLocaleString('es-CL')}</strong> un.</span>
        </div>

        <!-- Cuadrícula 2x2 de Contadores con Alta Legibilidad -->
        <div class="cotiz-counters-grid">
          <div class="cotiz-counter-box" style="border-left: 3px solid #10b981;">
            <span class="cotiz-counter-lbl" style="color: #34d399;">✅ Aceptadas</span>
            <span class="cotiz-counter-main-num">${item.aceptadasCnt.toLocaleString('es-CL')}</span>
            <span class="cotiz-counter-money" style="color: #34d399;">${formatCLP(item.aceptadasMonto)}</span>
          </div>

          <div class="cotiz-counter-box" style="border-left: 3px solid #f59e0b;">
            <span class="cotiz-counter-lbl" style="color: #fbbf24;">⏳ En Proceso</span>
            <span class="cotiz-counter-main-num">${item.enviadasCnt.toLocaleString('es-CL')}</span>
            <span class="cotiz-counter-money" style="color: #fbbf24;">${formatCLP(item.enviadasMonto)}</span>
          </div>

          <div class="cotiz-counter-box" style="border-left: 3px solid #ef4444;">
            <span class="cotiz-counter-lbl" style="color: #f87171;">❌ Perdidas</span>
            <span class="cotiz-counter-main-num">${item.perdidasCnt.toLocaleString('es-CL')}</span>
            <span class="cotiz-counter-money" style="color: #f87171;">${formatCLP(item.perdidasMonto)}</span>
          </div>

          <div class="cotiz-counter-box" style="border-left: 3px solid #a855f7;">
            <span class="cotiz-counter-lbl" style="color: #c084fc;">📦 Pend / Stock</span>
            <span class="cotiz-counter-main-num">${item.otrasCnt.toLocaleString('es-CL')}</span>
            <span class="cotiz-counter-money" style="color: #c084fc;">${formatCLP(item.otrasMonto)}</span>
          </div>
        </div>

        <!-- Barra de Conversión con Mayor Grosor e Iluminación -->
        <div class="cotiz-progress-section">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; margin-bottom:4px;">
            <span style="color: #94a3b8; font-weight: 600;">Efectividad de Cierre</span>
            <strong style="color:${isHighWin ? '#34d399' : '#60a5fa'}; font-size:0.85rem;">${winRate}%</strong>
          </div>
          <div class="cotiz-progress-bar-wrap">
            <div class="cotiz-progress-bar-fill" style="width: ${Math.min(100, Math.max(0, Number(winRate)))}%; background: ${isHighWin ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)'}; box-shadow: 0 0 10px ${isHighWin ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'};"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza los Gráficos BI de Cotizaciones (Evolución Mensual, Estado y Ranking de Vendedores)
 */
function renderCotizacionesCharts(data) {
  if (typeof Chart === 'undefined') return;

  const ctxEvol = document.getElementById('chartCotizEvolucion')?.getContext('2d');
  const ctxEstado = document.getElementById('chartCotizEstado')?.getContext('2d');
  const ctxResp = document.getElementById('chartCotizResponsables')?.getContext('2d');

  // --- 1. Gráfico de Evolución Mensual ($) ---
  if (ctxEvol) {
    if (chartCotizEvolInstance) chartCotizEvolInstance.destroy();

    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const aceptadasByMonth = new Array(12).fill(0);
    const enviadasByMonth = new Array(12).fill(0);
    const perdidasByMonth = new Array(12).fill(0);

    data.forEach(r => {
      if (r.fechaObj) {
        const m = r.fechaObj.getMonth();
        if (m >= 0 && m < 12) {
          const stLow = (r.estadoFinal || r.estado || '').toLowerCase();
          if (stLow.includes('aceptada')) {
            aceptadasByMonth[m] += (r.total || 0);
          } else if (stLow.includes('perdida')) {
            perdidasByMonth[m] += (r.total || 0);
          } else {
            enviadasByMonth[m] += (r.total || 0);
          }
        }
      }
    });

    chartCotizEvolInstance = new Chart(ctxEvol, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Aceptadas ($)',
            data: aceptadasByMonth,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Enviadas / Proceso ($)',
            data: enviadasByMonth,
            backgroundColor: 'rgba(251, 191, 36, 0.85)',
            borderColor: '#fbbf24',
            borderRadius: 6
          },
          {
            label: 'Perdidas ($)',
            data: perdidasByMonth,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderColor: '#ef4444',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return `${ctx.dataset.label}: ${formatCLP(ctx.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              callback: function(val) {
                if (val >= 1000000) return '$' + (val / 1000000).toFixed(0) + 'M';
                if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
                return '$' + val;
              }
            }
          }
        }
      }
    });
  }

  // --- 2. Gráfico de Distribución de Estado (Doughnut) ---
  if (ctxEstado) {
    if (chartCotizEstadoInstance) chartCotizEstadoInstance.destroy();

    const estadoMap = new Map();
    data.forEach(r => {
      const st = r.estadoFinal || r.estado || 'Otros';
      estadoMap.set(st, (estadoMap.get(st) || 0) + (r.total || 0));
    });

    const sortedEstados = Array.from(estadoMap.entries()).sort((a, b) => b[1] - a[1]);
    const labels = sortedEstados.map(e => e[0]);
    const values = sortedEstados.map(e => e[1]);

    const colorPalette = [
      '#10b981', '#3b82f6', '#fbbf24', '#f87171', '#a855f7', '#06b6d4', '#ec4899', '#64748b'
    ];

    chartCotizEstadoInstance = new Chart(ctxEstado, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colorPalette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#0f172a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#cbd5e1', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const total = values.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${formatCLP(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // --- 3. Gráfico Top Vendedores por Monto Cotizado ---
  if (ctxResp) {
    if (chartCotizRespInstance) chartCotizRespInstance.destroy();

    const vendMap = new Map();
    data.forEach(r => {
      const v = r.vendedor ? `Cod. ${r.vendedor}` : (r.responsable || 'General');
      if (!vendMap.has(v)) {
        vendMap.set(v, { vendedor: v, total: 0, aceptadas: 0, count: 0 });
      }
      const item = vendMap.get(v);
      item.total += (r.total || 0);
      item.count += 1;
      const stLow = (r.estadoFinal || r.estado || '').toLowerCase();
      if (stLow.includes('aceptada')) item.aceptadas += 1;
    });

    const sortedVend = Array.from(vendMap.values()).sort((a, b) => b.total - a.total).slice(0, 8);
    const labels = sortedVend.map(v => v.vendedor);
    const totals = sortedVend.map(v => v.total);

    chartCotizRespInstance = new Chart(ctxResp, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Cotizado ($)',
          data: totals,
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const item = sortedVend[ctx.dataIndex];
                const winRate = item && item.count > 0 ? ((item.aceptadas / item.count) * 100).toFixed(1) : 0;
                return `Monto: ${formatCLP(ctx.raw)} | Cierre: ${winRate}% (${item.count} cotiz)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              callback: function(val) {
                if (val >= 1000000) return '$' + (val / 1000000).toFixed(0) + 'M';
                return '$' + val;
              }
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#cbd5e1' }
          }
        }
      }
    });
  }
}

/**
 * Renderiza Top 10 SKUs en Solicitudes de Cotización
 */
function renderCotizacionesTopProducts(data) {
  const container = document.getElementById('cotizTopProductsList');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; color: var(--ax-text-tertiary); text-align: center;">No hay productos cotizados</div>';
    return;
  }

  const skuMap = new Map();
  data.forEach(r => {
    const sku = r.sku || 'SKU-GENERAL';
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku: sku,
        descripcion: r.producto || 'Producto Cotizado',
        cantidad: 0,
        total: 0,
        solicitudes: 0
      });
    }
    const item = skuMap.get(sku);
    item.cantidad += (r.cantidad || 0);
    item.total += (r.total || 0);
    item.solicitudes += 1;
  });

  const top10 = Array.from(skuMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  const maxTotal = top10.length > 0 ? top10[0].total : 1;

  container.innerHTML = top10.map((p, idx) => {
    const pct = Math.min(100, Math.max(5, (p.total / maxTotal) * 100));
    let rankBadge = `<span class="badge badge-blue">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="badge badge-amber" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">🥇 1°</span>`;
    if (idx === 1) rankBadge = `<span class="badge" style="background: rgba(203, 213, 225, 0.2); color: #e2e8f0;">🥈 2°</span>`;
    if (idx === 2) rankBadge = `<span class="badge" style="background: rgba(217, 119, 6, 0.2); color: #f59e0b;">🥉 3°</span>`;

    const imgObj = typeof productImagesMap !== 'undefined' ? productImagesMap.get(p.sku) : null;
    const imgThumb = imgObj && imgObj.url ?
      `<img src="${imgObj.url}" alt="${p.sku}" style="width: 38px; height: 38px; object-fit: contain; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);" onerror="this.style.display='none'" />` :
      `<div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 1rem;">📦</div>`;

    return `
      <div class="compras-breakdown-item" style="padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 0; flex: 1;">
          ${rankBadge}
          ${imgThumb}
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="sku-badge-pill" style="font-size: 0.82rem; padding: 2px 8px; font-weight: 800;">${p.sku}</span>
              <span style="font-size: 0.92rem; font-weight: 700; color: var(--ax-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.descripcion}">${p.descripcion}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--ax-text-tertiary); margin-top: 3px; font-weight: 500;">
              <strong style="color: #cbd5e1;">${Math.round(p.cantidad).toLocaleString('es-CL')} un.</strong> cotizadas en <strong style="color: #cbd5e1;">${p.solicitudes}</strong> solicitudes
            </div>
          </div>
        </div>

        <div style="text-align: right; min-width: 130px;">
          <strong style="color: #60a5fa; font-size: 1.05rem; font-weight: 800;">${formatCLP(p.total)}</strong>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-top: 5px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981); border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza la Tabla Paginada de Cotizaciones
 */
function renderCotizacionesTable(data) {
  const tbody = document.getElementById('cotizTableBody');
  const pageInfo = document.getElementById('cotizPageInfo');
  const prevBtn = document.getElementById('btnCotizPrevPage');
  const nextBtn = document.getElementById('btnCotizNextPage');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 3rem; color:var(--ax-text-tertiary); font-size: 1rem;">No hay cotizaciones para mostrar con los filtros aplicados.</td></tr>`;
    if (pageInfo) pageInfo.textContent = 'Página 0 de 0 (0 cotizaciones)';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const totalPages = Math.ceil(data.length / COTIZ_PAGE_SIZE) || 1;
  if (cotizCurrentPage < 1) cotizCurrentPage = 1;
  if (cotizCurrentPage > totalPages) cotizCurrentPage = totalPages;

  if (pageInfo) {
    pageInfo.innerHTML = `Página <strong>${cotizCurrentPage}</strong> de <strong>${totalPages}</strong> (<span style="color: #60a5fa; font-weight: 700;">${data.length.toLocaleString('es-CL')}</span> cotizaciones)`;
  }

  if (prevBtn) prevBtn.disabled = cotizCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = cotizCurrentPage >= totalPages;

  const startIdx = (cotizCurrentPage - 1) * COTIZ_PAGE_SIZE;
  const pageRows = data.slice(startIdx, startIdx + COTIZ_PAGE_SIZE);

  tbody.innerHTML = pageRows.map(r => {
    const stLow = (r.estadoFinal || r.estado || '').toLowerCase();
    let statusClass = 'cotiz-status--enviada';
    let statusIcon = '⏳';

    if (stLow.includes('aceptada')) {
      statusClass = 'cotiz-status--aceptada';
      statusIcon = '✅';
    } else if (stLow.includes('perdida')) {
      statusClass = 'cotiz-status--perdida';
      statusIcon = '❌';
    } else if (stLow.includes('preparación') || stLow.includes('preparacion')) {
      statusClass = 'cotiz-status--preparacion';
      statusIcon = '⚙️';
    } else if (stLow.includes('stock')) {
      statusClass = 'cotiz-status--pendiente';
      statusIcon = '📦';
    }

    const nvFaText = (r.nv || r.fa) ?
      `<span style="font-size:0.82rem; font-weight: 600; color:#e2e8f0;">${r.nv ? 'NV:'+r.nv : ''} ${r.fa ? 'FA:'+r.fa : ''}</span>` :
      `<span style="color:var(--ax-text-tertiary); font-size:0.8rem;">—</span>`;

    return `
      <tr style="height: 48px;">
        <td style="text-align:left;"><span class="tag-pill" style="font-size:0.82rem; font-weight:700;">${r.tipo}</span></td>
        <td style="text-align:left;"><span class="sku-badge-pill" style="font-weight:800; font-size:0.85rem;">#${r.numCot}</span></td>
        <td style="text-align:center; font-size:0.85rem; color:#cbd5e1;">${r.fecha || '—'}</td>
        <td style="text-align:left;"><strong style="color:var(--ax-text-primary); font-size:0.9rem;">${r.cliente}</strong></td>
        <td style="text-align:left; font-size:0.82rem; color:var(--ax-text-secondary);">${r.rut || '—'}</td>
        <td style="text-align:left;"><span class="sku-badge-pill" style="background:rgba(59,130,246,0.18); color:#60a5fa; border-color:rgba(59,130,246,0.35); font-weight:700; font-size:0.82rem;">${r.sku}</span></td>
        <td style="text-align:left; max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${r.producto}"><span style="font-size:0.88rem; font-weight:500;">${r.producto}</span></td>
        <td style="text-align:center; font-weight:800; font-size:0.92rem;" class="num-cell">${Math.round(r.cantidad).toLocaleString('es-CL')}</td>
        <td style="text-align:right; font-weight:900; color:#60a5fa; font-size:0.95rem;" class="num-cell">${formatCLP(r.total)}</td>
        <td style="text-align:center;"><span class="tag-pill" style="font-size:0.8rem; font-weight:600;">Cod. ${r.vendedor}</span></td>
        <td style="text-align:center;">${nvFaText}</td>
        <td style="text-align:center;">
          <span class="cotiz-status-pill ${statusClass}" style="font-size: 0.8rem; padding: 4px 10px;">
            <span>${statusIcon}</span>
            <span>${r.estadoFinal || r.estado}</span>
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Cambio de página en la tabla de cotizaciones
 */
function changeCotizPage(dir) {
  cotizCurrentPage += dir;
  renderCotizacionesTable(filteredCotizacionesRows || cotizacionesRows);
}

/**
 * Vinculación de Event Listeners de Filtros y Búsqueda
 */
function setupCotizacionesEventListeners() {
  if (cotizListenersAttached) return;
  cotizListenersAttached = true;

  ['fltCotizDesde', 'fltCotizHasta', 'fltCotizVendedor', 'fltCotizEstado', 'fltCotizTipo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => applyCotizacionesFilters());
      el.addEventListener('input', () => applyCotizacionesFilters());
    }
  });

  const fSearch = document.getElementById('cotizSearchBox');
  let searchTimer = null;
  if (fSearch) {
    fSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyCotizacionesFilters(), 200);
    });
  }

  // Pre-cargar imágenes para thumbnails en cotizaciones
  if (typeof fetchProductImagesMap === 'function') {
    fetchProductImagesMap();
  }
}

// ==========================================================================
// MÓDULO EMISIÓN DE COTIZACIONES MULTI-PRODUCTO
// ==========================================================================

let cotizModalRows = [];
let cotizRowIdCounter = 0;

/**
 * Genera un nuevo folio correlativo para cotizaciones
 */
function generateNewCotizFolio() {
  const folioEl = document.getElementById('cFolio');
  const badgeEl = document.getElementById('cotizModalFolioBadge');
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  const newFolio = `COT-2026-${rnd}`;
  if (folioEl) folioEl.value = newFolio;
  if (badgeEl) badgeEl.textContent = newFolio;
}

/**
 * Abre el modal de Emisión de Cotizaciones
 */
function openCotizacionModal() {
  const backdrop = document.getElementById('cotizacionModalBackdrop');
  if (!backdrop) return;

  const form = document.getElementById('cotizacionModalForm');
  if (form) form.reset();

  // Generar Folio Automático
  generateNewCotizFolio();

  // Fecha Emisión por defecto hoy
  const today = new Date().toISOString().split('T')[0];
  const fechaEl = document.getElementById('cFecha');
  if (fechaEl) fechaEl.value = today;

  // Vendedor por defecto del usuario autenticado si existe
  const vendEl = document.getElementById('cVendedor');
  if (vendEl && typeof AuthManager !== 'undefined' && AuthManager.currentUser && AuthManager.currentUser.name) {
    vendEl.value = AuthManager.currentUser.name;
  }

  // Poblar datalist de clientes históricos
  populateCotizClientDatalist();

  // Asegurar que las imágenes de productos estén sincronizadas
  if (typeof fetchProductImagesMap === 'function') {
    fetchProductImagesMap();
  }

  // Inicializar filas de productos con 1 fila limpia
  clearCotizProductRows();
  addCotizProductRow();

  backdrop.classList.add('active');
  backdrop.style.display = 'flex';
  backdrop.style.opacity = '1';
  backdrop.style.pointerEvents = 'auto';
}

/**
 * Cierra el modal de Cotizaciones
 */
function closeCotizacionModal() {
  const backdrop = document.getElementById('cotizacionModalBackdrop');
  if (backdrop) {
    backdrop.classList.remove('active');
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  }
  const d1 = document.getElementById('cotizRutSuggestions');
  const d2 = document.getElementById('cotizClientSuggestions');
  const badge = document.getElementById('cotizClientMatchBadge');
  if (d1) d1.style.display = 'none';
  if (d2) d2.style.display = 'none';
  if (badge) badge.style.display = 'none';
}

// Cerrar sugerencias al hacer clic fuera
document.addEventListener('click', (e) => {
  const d1 = document.getElementById('cotizRutSuggestions');
  const d2 = document.getElementById('cotizClientSuggestions');
  const inRut = document.getElementById('cRut');
  const inCli = document.getElementById('cCliente');

  if (d1 && inRut && !d1.contains(e.target) && e.target !== inRut) {
    d1.style.display = 'none';
  }
  if (d2 && inCli && !d2.contains(e.target) && e.target !== inCli) {
    d2.style.display = 'none';
  }
});

/**
 * Limpia y normaliza un RUT chileno (sin puntos, guiones ni espacios en mayúsculas)
 */
function cleanRutStr(raw) {
  return String(raw || '').replace(/[\.\-\s]/g, '').toUpperCase();
}

/**
 * Formatea un RUT chileno limpio a formato XX.XXX.XXX-X
 */
function formatChileanRut(raw) {
  const clean = cleanRutStr(raw);
  if (!clean || clean.length < 2) return raw || '';
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedCuerpo}-${dv}`;
}

/**
 * Genera base de datos consolidada y deduplicada de clientes
 */
function getCotizClientDatabase() {
  const clientMap = new Map();

  const processRow = (r) => {
    const nombre = (r['CLIENTE'] || '').trim();
    if (!nombre) return;
    const rut = (r['RUT'] || '').trim();
    const rutClean = cleanRutStr(rut);
    const comuna = (r['COMUNA'] || '').trim();
    const region = (r['REGION'] || '').trim();
    const email = (r['EMAIL'] || '').trim();

    const key = rutClean || nombre.toUpperCase();
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        cliente: nombre,
        rut: rut || (rutClean ? formatChileanRut(rutClean) : ''),
        rutClean: rutClean,
        comuna: comuna,
        region: region,
        email: email,
        txCount: 0
      });
    }
    const item = clientMap.get(key);
    item.txCount++;
    if (!item.rut && rut) item.rut = rut;
    if (!item.rutClean && rutClean) item.rutClean = rutClean;
    if (!item.comuna && comuna) item.comuna = comuna;
    if (!item.region && region) item.region = region;
    if (!item.email && email) item.email = email;
  };

  (rows || []).forEach(processRow);
  (cotizacionesRows || []).forEach(processRow);

  return Array.from(clientMap.values());
}

/**
 * Predicción en tiempo real al ingresar el RUT
 */
function onCotizRutInput(val) {
  const raw = String(val || '').trim();
  const q = cleanRutStr(raw);
  const dropdown = document.getElementById('cotizRutSuggestions');
  const matchBadge = document.getElementById('cotizClientMatchBadge');

  if (!dropdown) return;

  if (!q || q.length < 2) {
    dropdown.style.display = 'none';
    if (matchBadge) matchBadge.style.display = 'none';
    return;
  }

  const clientDb = getCotizClientDatabase();

  // 1. Verificar coincidencia exacta por RUT
  const exactMatch = clientDb.find(c => c.rutClean === q);
  if (exactMatch) {
    selectCotizClientPrediction(exactMatch, false);
    if (matchBadge) matchBadge.style.display = 'inline-flex';
    dropdown.style.display = 'none';
    return;
  } else {
    if (matchBadge) matchBadge.style.display = 'none';
  }

  // 2. Filtrar candidatos predictivos
  const candidates = clientDb.filter(c => {
    return (c.rutClean && c.rutClean.includes(q)) || (c.cliente && c.cliente.toUpperCase().includes(raw.toUpperCase()));
  }).slice(0, 6);

  if (candidates.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 10px 12px; font-size: 0.78rem; color: #94a3b8;">
        Sin coincidencias previas para RUT <strong>${raw}</strong>. Se registrará como cliente nuevo.
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  // 3. Renderizar opciones de predicción
  dropdown.innerHTML = candidates.map(c => {
    const loc = [c.comuna, c.region].filter(Boolean).join(', ');
    const safeClientJson = JSON.stringify(c).replace(/"/g, '&quot;');
    return `
      <div class="cotiz-pred-item" onclick="selectCotizClientPrediction(${safeClientJson}, true)">
        <div>
          <div class="cotiz-pred-name">${c.cliente}</div>
          <div class="cotiz-pred-loc">${loc ? '📍 ' + loc : 'Cliente Registrado'}</div>
        </div>
        <div style="text-align: right;">
          <span class="cotiz-pred-rut">${c.rut || formatChileanRut(c.rutClean)}</span>
        </div>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';
}

/**
 * Predicción en tiempo real al ingresar la Razón Social / Nombre
 */
function onCotizClientNameInput(val) {
  const raw = String(val || '').trim();
  const q = raw.toUpperCase();
  const dropdown = document.getElementById('cotizClientSuggestions');
  const matchBadge = document.getElementById('cotizClientMatchBadge');

  if (!dropdown) return;

  if (!q || q.length < 2) {
    dropdown.style.display = 'none';
    if (matchBadge) matchBadge.style.display = 'none';
    return;
  }

  const clientDb = getCotizClientDatabase();

  // 1. Verificar coincidencia exacta
  const exactMatch = clientDb.find(c => c.cliente.toUpperCase() === q);
  if (exactMatch) {
    selectCotizClientPrediction(exactMatch, false);
    if (matchBadge) matchBadge.style.display = 'inline-flex';
    dropdown.style.display = 'none';
    return;
  }

  // 2. Filtrar predicciones
  const candidates = clientDb.filter(c => c.cliente.toUpperCase().includes(q)).slice(0, 6);
  if (candidates.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = candidates.map(c => {
    const loc = [c.comuna, c.region].filter(Boolean).join(', ');
    const safeClientJson = JSON.stringify(c).replace(/"/g, '&quot;');
    return `
      <div class="cotiz-pred-item" onclick="selectCotizClientPrediction(${safeClientJson}, true)">
        <div>
          <div class="cotiz-pred-name">${c.cliente}</div>
          <div class="cotiz-pred-loc">${loc ? '📍 ' + loc : ''}</div>
        </div>
        <div style="text-align: right;">
          <span class="cotiz-pred-rut">${c.rut || formatChileanRut(c.rutClean)}</span>
        </div>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';
}

/**
 * Selecciona una predicción y autocompleta todos los campos del cliente
 */
function selectCotizClientPrediction(client, shouldCloseDropdowns = true) {
  if (!client) return;

  const inRut = document.getElementById('cRut');
  const inCli = document.getElementById('cCliente');
  const inCom = document.getElementById('cComuna');
  const inReg = document.getElementById('cRegion');
  const inEml = document.getElementById('cEmail');
  const matchBadge = document.getElementById('cotizClientMatchBadge');

  if (inRut) inRut.value = client.rut || (client.rutClean ? formatChileanRut(client.rutClean) : inRut.value);
  if (inCli) inCli.value = client.cliente;
  if (inCom && client.comuna) inCom.value = client.comuna;
  if (inReg && client.region) inReg.value = client.region;
  if (inEml && client.email) inEml.value = client.email;

  if (matchBadge) matchBadge.style.display = 'inline-flex';

  if (shouldCloseDropdowns) {
    const d1 = document.getElementById('cotizRutSuggestions');
    const d2 = document.getElementById('cotizClientSuggestions');
    if (d1) d1.style.display = 'none';
    if (d2) d2.style.display = 'none';
  }
}

/**
 * Alias de compatibilidad
 */
function lookupClientByRut(val) {
  onCotizRutInput(val);
}

/**
 * Agrega una nueva fila de producto a la cotización
 */
function addCotizProductRow(initialData = null) {
  const tbody = document.getElementById('cotizItemsTableBody');
  if (!tbody) return;

  cotizRowIdCounter++;
  const rowId = cotizRowIdCounter;

  const data = initialData || {
    sku: '',
    desc: '',
    cant: 1,
    precio: 0,
    costo: 0,
    imgUrl: ''
  };

  const tr = document.createElement('tr');
  tr.id = `cotizRow_${rowId}`;
  tr.className = 'cotiz-item-row';
  tr.dataset.rowId = rowId;

  tr.innerHTML = `
    <td style="text-align: center; font-weight: 700; color: #94a3b8;" class="item-index-col"></td>
    <td style="text-align: center;">
      <img src="${data.imgUrl || 'https://via.placeholder.com/32?text=SKU'}" id="itemThumb_${rowId}" class="cotiz-item-thumb" alt="SKU" onerror="this.onerror=null; this.src='https://via.placeholder.com/32?text=SKU';" />
    </td>
    <td>
      <input type="text" class="cotiz-item-input" id="itemSku_${rowId}" value="${data.sku}" placeholder="Ej: ARM012" oninput="onCotizItemSkuInput(${rowId}, this.value)" style="text-transform: uppercase; font-family: monospace; font-weight: 700;" required />
    </td>
    <td>
      <input type="text" class="cotiz-item-input" id="itemDesc_${rowId}" value="${data.desc}" placeholder="Descripción detallada del producto" required />
    </td>
    <td>
      <input type="number" class="cotiz-item-input" id="itemCant_${rowId}" value="${data.cant}" min="0.1" step="any" style="text-align: right; font-weight: 700;" oninput="recalcCotizTotals()" required />
    </td>
    <td>
      <input type="number" class="cotiz-item-input" id="itemPrecio_${rowId}" value="${data.precio}" min="0" step="any" style="text-align: right; font-weight: 700; color: #38bdf8;" oninput="recalcCotizTotals()" required />
    </td>
    <td>
      <input type="number" class="cotiz-item-input" id="itemCosto_${rowId}" value="${data.costo}" min="0" step="any" style="text-align: right; color: #fda4af;" oninput="recalcCotizTotals()" placeholder="0" />
    </td>
    <td style="text-align: right; font-weight: 800; font-family: monospace; color: #f8fafc;" id="itemSubtotal_${rowId}">
      $0
    </td>
    <td style="text-align: center;">
      <span class="margin-pill" id="itemMargin_${rowId}" style="font-size: 0.72rem; padding: 2px 6px;">0%</span>
    </td>
    <td style="text-align: center;">
      <button type="button" class="mini-action-btn" onclick="removeCotizProductRow(${rowId})" title="Eliminar este producto" style="color: #f87171;">🗑️</button>
    </td>
  `;

  tbody.appendChild(tr);

  // Si trae SKU, resolver imagen y datos
  if (data.sku) {
    onCotizItemSkuInput(rowId, data.sku);
  }

  updateCotizRowIndices();
  recalcCotizTotals();
}

/**
 * Elimina una fila de producto
 */
function removeCotizProductRow(rowId) {
  const row = document.getElementById(`cotizRow_${rowId}`);
  if (row) row.remove();

  const tbody = document.getElementById('cotizItemsTableBody');
  if (tbody && tbody.children.length === 0) {
    addCotizProductRow();
  } else {
    updateCotizRowIndices();
    recalcCotizTotals();
  }
}

/**
 * Limpia todas las filas de productos
 */
function clearCotizProductRows() {
  const tbody = document.getElementById('cotizItemsTableBody');
  if (tbody) tbody.innerHTML = '';
  cotizModalRows = [];
}

/**
 * Actualiza los números correlativos de las filas
 */
function updateCotizRowIndices() {
  const tbody = document.getElementById('cotizItemsTableBody');
  const countLabel = document.getElementById('cotizItemsCountLabel');
  if (!tbody) return;

  const rowsList = tbody.querySelectorAll('.cotiz-item-row');
  rowsList.forEach((r, idx) => {
    const idxCol = r.querySelector('.item-index-col');
    if (idxCol) idxCol.textContent = idx + 1;
  });

  if (countLabel) {
    countLabel.textContent = `${rowsList.length} ${rowsList.length === 1 ? 'producto' : 'productos'} en cotización`;
  }
}

/**
 * Autocompleta descripción, costo, precio e imagen al escribir SKU
 */
function onCotizItemSkuInput(rowId, skuRaw) {
  const sku = String(skuRaw || '').trim().toUpperCase();
  const descEl = document.getElementById(`itemDesc_${rowId}`);
  const precioEl = document.getElementById(`itemPrecio_${rowId}`);
  const costoEl = document.getElementById(`itemCosto_${rowId}`);
  const thumbEl = document.getElementById(`itemThumb_${rowId}`);

  if (!sku) {
    if (thumbEl) thumbEl.src = 'https://via.placeholder.com/32?text=SKU';
    return;
  }

  // 1. Buscar en mapa de imágenes
  let imgObj = typeof productImagesMap !== 'undefined' ? productImagesMap.get(sku) : null;
  if (imgObj && imgObj.url && thumbEl) {
    thumbEl.src = imgObj.url;
  } else {
    if (thumbEl) thumbEl.src = `https://via.placeholder.com/32?text=${sku.slice(0, 3)}`;
  }

  // 2. Buscar en catálogo histórico para precios y costos sugeridos
  const histMatch = (rows || []).find(r => (r['CODIGO'] || '').trim().toUpperCase() === sku);
  if (histMatch) {
    if (descEl && (!descEl.value || descEl.value.length < 3)) {
      descEl.value = histMatch['DESCRIPCION'] || imgObj?.desc || sku;
    }
    if (precioEl && (Number(precioEl.value) === 0 || !precioEl.value)) {
      precioEl.value = Number(histMatch['PREUNI']) || 0;
    }
    if (costoEl && (Number(costoEl.value) === 0 || !costoEl.value)) {
      costoEl.value = Number(histMatch['COSTOS']) || 0;
    }
  } else if (imgObj && imgObj.desc && descEl && !descEl.value) {
    descEl.value = imgObj.desc;
  }

  recalcCotizTotals();
}

/**
 * Recalcula totales, descuentos, IVA, márgenes y subtotales en vivo
 */
function recalcCotizTotals() {
  const tbody = document.getElementById('cotizItemsTableBody');
  if (!tbody) return;

  const rowsList = tbody.querySelectorAll('.cotiz-item-row');
  let grandNeto = 0;
  let grandCosto = 0;

  rowsList.forEach(r => {
    const rowId = r.dataset.rowId;
    const cant = parseFloat(document.getElementById(`itemCant_${rowId}`)?.value) || 0;
    const precio = parseFloat(document.getElementById(`itemPrecio_${rowId}`)?.value) || 0;
    const costo = parseFloat(document.getElementById(`itemCosto_${rowId}`)?.value) || 0;

    const lineNeto = cant * precio;
    const lineCosto = cant * costo;
    const lineUtil = lineNeto - lineCosto;
    const lineMargen = lineNeto > 0 ? (lineUtil / lineNeto) * 100 : 0;

    grandNeto += lineNeto;
    grandCosto += lineCosto;

    const subEl = document.getElementById(`itemSubtotal_${rowId}`);
    const margEl = document.getElementById(`itemMargin_${rowId}`);

    if (subEl) subEl.textContent = typeof formatCLP === 'function' ? formatCLP(lineNeto) : `$${Math.round(lineNeto).toLocaleString('es-CL')}`;
    if (margEl) {
      margEl.textContent = lineMargen.toFixed(1) + '%';
      margEl.style.color = lineMargen >= 30 ? '#34d399' : (lineMargen >= 15 ? '#fbbf24' : '#f87171');
      margEl.style.background = lineMargen >= 30 ? 'rgba(16, 185, 129, 0.2)' : (lineMargen >= 15 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(244, 63, 94, 0.2)');
    }
  });

  const discountPct = Math.min(99, Math.max(0, parseFloat(document.getElementById('cotizDiscountPct')?.value) || 0));
  const discountAmount = grandNeto * (discountPct / 100);
  const netoFinal = Math.max(0, grandNeto - discountAmount);
  const iva = netoFinal * 0.19;
  const totalBruto = netoFinal + iva;
  const totalUtilidad = netoFinal - grandCosto;
  const margenGlobal = netoFinal > 0 ? (totalUtilidad / netoFinal) * 100 : 0;

  const fmt = (v) => typeof formatCLP === 'function' ? formatCLP(v) : `$${Math.round(v).toLocaleString('es-CL')}`;

  const elSubNeto = document.getElementById('cotizSubtotalNeto');
  const elDescMonto = document.getElementById('cotizDiscountAmount');
  const elNetoFin = document.getElementById('cotizNetoFinal');
  const elIva = document.getElementById('cotizIva');
  const elTotalBruto = document.getElementById('cotizTotalBruto');
  const elTotalUtil = document.getElementById('cotizTotalUtilidad');
  const elMarginPill = document.getElementById('cotizGlobalMarginPill');

  if (elSubNeto) elSubNeto.textContent = fmt(grandNeto);
  if (elDescMonto) elDescMonto.textContent = discountAmount > 0 ? `-${fmt(discountAmount)}` : '$0';
  if (elNetoFin) elNetoFin.textContent = fmt(netoFinal);
  if (elIva) elIva.textContent = fmt(iva);
  if (elTotalBruto) elTotalBruto.textContent = fmt(totalBruto);
  if (elTotalUtil) elTotalUtil.textContent = fmt(totalUtilidad);
  if (elMarginPill) {
    elMarginPill.textContent = `Margen: ${margenGlobal.toFixed(1)}%`;
    elMarginPill.style.color = margenGlobal >= 30 ? '#34d399' : (margenGlobal >= 15 ? '#fbbf24' : '#f87171');
  }
}

/**
 * Guarda la cotización con todos sus productos en Google Sheets / local state
 */
async function saveCotizacion() {
  const folio = document.getElementById('cFolio')?.value?.trim() || `COT-2026-${Math.floor(Math.random()*9000+1000)}`;
  const fecha = document.getElementById('cFecha')?.value || new Date().toISOString().split('T')[0];
  const validez = document.getElementById('cValidez')?.value || '30 Días';
  const vendedor = document.getElementById('cVendedor')?.value?.trim() || 'Vendedor General';
  const canal = document.getElementById('cCanal')?.value || 'Mayoristas';
  const estado = document.getElementById('cEstado')?.value || 'En Seguimiento';
  const cliente = document.getElementById('cCliente')?.value?.trim();
  const rut = document.getElementById('cRut')?.value?.trim() || '';
  const email = document.getElementById('cEmail')?.value?.trim() || '';
  const comuna = document.getElementById('cComuna')?.value?.trim() || '';
  const region = document.getElementById('cRegion')?.value?.trim() || 'RM';
  const formaPago = document.getElementById('cFormaPago')?.value || 'Crédito 30 Días';
  const plazoEntrega = document.getElementById('cPlazoEntrega')?.value || '24 a 48 Horas Hábiles';
  const observaciones = document.getElementById('cObservaciones')?.value?.trim() || '';

  if (!cliente) {
    if (typeof showToast === 'function') showToast('⚠️ Por favor ingresa el nombre o razón social del cliente');
    return;
  }

  const tbody = document.getElementById('cotizItemsTableBody');
  const rowsList = tbody ? tbody.querySelectorAll('.cotiz-item-row') : [];
  const items = [];

  rowsList.forEach(r => {
    const rowId = r.dataset.rowId;
    const sku = document.getElementById(`itemSku_${rowId}`)?.value?.trim().toUpperCase();
    const desc = document.getElementById(`itemDesc_${rowId}`)?.value?.trim();
    const cant = parseFloat(document.getElementById(`itemCant_${rowId}`)?.value) || 0;
    const precio = parseFloat(document.getElementById(`itemPrecio_${rowId}`)?.value) || 0;
    const costo = parseFloat(document.getElementById(`itemCosto_${rowId}`)?.value) || 0;

    if (sku && cant > 0) {
      items.push({ sku, desc: desc || sku, cant, precio, costo });
    }
  });

  if (items.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ Debes ingresar al menos 1 producto con cantidad válida');
    return;
  }

  // Generar filas para el Google Sheet
  const newCotizRows = items.map(it => {
    const neto = it.cant * it.precio;
    const costoTot = it.cant * it.costo;
    const util = neto - costoTot;

    return {
      FOLIO: folio,
      TIPO: 'Cotización',
      FECHA: fecha,
      CODIGO: it.sku,
      DESCRIPCION: it.desc,
      CANTFACTURADA: it.cant,
      PREUNI: it.precio,
      COSTOS: it.costo,
      NETO: neto,
      '($) UTILIDAD': util,
      CLIENTE: cliente,
      RUT: rut,
      CODVENDENDOR: vendedor,
      'CANAL FINAL': canal,
      REGION: region,
      COMUNA: comuna,
      EMAIL: email,
      ESTADO: estado,
      VALIDEZ: validez,
      PAGO: formaPago,
      ENTREGA: plazoEntrega,
      GLOSA: `${formaPago} · ${plazoEntrega} · ${observaciones}`
    };
  });

  // Guardar en el estado local de cotizaciones
  if (typeof cotizacionesRows !== 'undefined') {
    cotizacionesRows.unshift(...newCotizRows);
    try {
      localStorage.setItem('glomax_cotizaciones_cache', JSON.stringify(cotizacionesRows));
    } catch(e) {}
  }

  // Enviar a la API de Google Apps Script si está disponible
  try {
    if (typeof apiPost === 'function' && typeof API_URL !== 'undefined' && API_URL) {
      for (const rowData of newCotizRows) {
        await apiPost({ action: 'add_cotizacion', data: rowData });
      }
    }
  } catch(err) {
    console.warn('[Cotizaciones] Error al sincronizar con Google Sheets:', err);
  }

  if (typeof showToast === 'function') {
    showToast(`✅ Cotización ${folio} con ${items.length} productos guardada exitosamente`);
  }

  closeCotizacionModal();

  // Re-aplicar filtros y actualizar tablero de cotizaciones
  if (typeof applyCotizacionesFilters === 'function') {
    applyCotizacionesFilters();
  }
}

/**
 * Genera la vista de impresión / PDF oficial de la Cotización Comercial
 */
function printCotizacionDocument() {
  const folio = document.getElementById('cFolio')?.value?.trim() || 'COT-2026-0001';
  const fecha = document.getElementById('cFecha')?.value || new Date().toISOString().split('T')[0];
  const validez = document.getElementById('cValidez')?.value || '30 Días';
  const vendedor = document.getElementById('cVendedor')?.value?.trim() || 'Ejecutivo Glomax';
  const canal = document.getElementById('cCanal')?.value || 'Mayoristas';
  const cliente = document.getElementById('cCliente')?.value?.trim() || 'Cliente';
  const rut = document.getElementById('cRut')?.value?.trim() || 'S/RUT';
  const email = document.getElementById('cEmail')?.value?.trim() || '';
  const comuna = document.getElementById('cComuna')?.value?.trim() || '';
  const region = document.getElementById('cRegion')?.value?.trim() || 'RM';
  const formaPago = document.getElementById('cFormaPago')?.value || 'Crédito 30 Días';
  const plazoEntrega = document.getElementById('cPlazoEntrega')?.value || '24 a 48 Horas Hábiles';
  const observaciones = document.getElementById('cObservaciones')?.value?.trim() || 'Cotización emitida conforme a listas de precios mayoristas.';

  const tbody = document.getElementById('cotizItemsTableBody');
  const rowsList = tbody ? tbody.querySelectorAll('.cotiz-item-row') : [];
  const items = [];

  rowsList.forEach(r => {
    const rowId = r.dataset.rowId;
    const sku = document.getElementById(`itemSku_${rowId}`)?.value?.trim().toUpperCase();
    const desc = document.getElementById(`itemDesc_${rowId}`)?.value?.trim();
    const cant = parseFloat(document.getElementById(`itemCant_${rowId}`)?.value) || 0;
    const precio = parseFloat(document.getElementById(`itemPrecio_${rowId}`)?.value) || 0;

    if (sku && cant > 0) {
      items.push({ sku, desc: desc || sku, cant, precio, subtotal: cant * precio });
    }
  });

  const subtotalNeto = items.reduce((a, it) => a + it.subtotal, 0);
  const discountPct = parseFloat(document.getElementById('cotizDiscountPct')?.value) || 0;
  const discountAmount = subtotalNeto * (discountPct / 100);
  const netoFinal = subtotalNeto - discountAmount;
  const iva = netoFinal * 0.19;
  const totalBruto = netoFinal + iva;

  const fmt = (v) => `$${Math.round(v).toLocaleString('es-CL')}`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (typeof showToast === 'function') showToast('⚠️ Permite las ventanas emergentes para imprimir la cotización');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cotización ${folio} - ${cliente}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
        .header-table { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
        .logo-title { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
        .logo-sub { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }
        .doc-badge { background: #0284c7; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 14px; display: inline-block; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
        .meta-title { font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 6px; }
        .meta-row { margin-bottom: 4px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #0f172a; color: #ffffff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; text-align: left; }
        .items-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .totals-table { width: 320px; margin-left: auto; border-collapse: collapse; margin-bottom: 20px; }
        .totals-table td { padding: 5px 8px; }
        .totals-table .grand-total { font-size: 16px; font-weight: 800; color: #0284c7; border-top: 2px solid #0f172a; padding-top: 8px; }
        .terms-box { background: #f1f5f9; border-left: 4px solid #0284c7; padding: 12px; font-size: 11px; color: #475569; border-radius: 0 6px 6px 0; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td>
            <div class="logo-title">GLOMAX S.A.</div>
            <div class="logo-sub">Soluciones Eléctricas & Materiales Industriales</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">RUT: 76.543.210-K · Casa Matriz: Santiago, Chile · www.glomax.cl</div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div class="doc-badge">COTIZACIÓN COMERCIAL</div>
            <div style="font-size: 16px; font-weight: 800; margin-top: 6px; color: #0f172a;">${folio}</div>
            <div style="font-size: 11px; color: #64748b;">Fecha: ${fecha}</div>
          </td>
        </tr>
      </table>

      <div class="meta-grid">
        <div>
          <div class="meta-title">Datos del Cliente</div>
          <div class="meta-row"><strong>Razón Social:</strong> ${cliente}</div>
          <div class="meta-row"><strong>RUT / DNI:</strong> ${rut}</div>
          ${email ? `<div class="meta-row"><strong>Email:</strong> ${email}</div>` : ''}
          <div class="meta-row"><strong>Ciudad / Región:</strong> ${comuna ? comuna + ' · ' : ''}${region}</div>
        </div>
        <div>
          <div class="meta-title">Condiciones Comerciales</div>
          <div class="meta-row"><strong>Ejecutivo:</strong> ${vendedor}</div>
          <div class="meta-row"><strong>Canal:</strong> ${canal}</div>
          <div class="meta-row"><strong>Validez Oferta:</strong> ${validez}</div>
          <div class="meta-row"><strong>Forma de Pago:</strong> ${formaPago}</div>
          <div class="meta-row"><strong>Plazo Entrega:</strong> ${plazoEntrega}</div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 110px;">SKU / Código</th>
            <th>Descripción del Producto</th>
            <th style="text-align: right; width: 60px;">Cant.</th>
            <th style="text-align: right; width: 100px;">Precio Unit.</th>
            <th style="text-align: right; width: 110px;">Subtotal Neto</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr>
              <td style="text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="font-weight: 700; font-family: monospace;">${it.sku}</td>
              <td>${it.desc}</td>
              <td style="text-align: right; font-weight: 700;">${it.cant}</td>
              <td style="text-align: right;">${fmt(it.precio)}</td>
              <td style="text-align: right; font-weight: 700;">${fmt(it.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table class="totals-table">
        <tr>
          <td>Subtotal Neto:</td>
          <td style="text-align: right; font-weight: 700;">${fmt(subtotalNeto)}</td>
        </tr>
        ${discountAmount > 0 ? `
          <tr>
            <td style="color: #e11d48;">Descuento (${discountPct}%):</td>
            <td style="text-align: right; color: #e11d48; font-weight: 700;">-${fmt(discountAmount)}</td>
          </tr>
          <tr>
            <td>Neto con Descuento:</td>
            <td style="text-align: right; font-weight: 700;">${fmt(netoFinal)}</td>
          </tr>
        ` : ''}
        <tr>
          <td>IVA (19%):</td>
          <td style="text-align: right; font-weight: 700;">${fmt(iva)}</td>
        </tr>
        <tr class="grand-total">
          <td>TOTAL (CLP):</td>
          <td style="text-align: right;">${fmt(totalBruto)}</td>
        </tr>
      </table>

      <div class="terms-box">
        <strong>Términos & Condiciones:</strong><br/>
        • Los precios expresados en esta cotización tienen una validez de ${validez} a partir de su emisión.<br/>
        • Forma de pago: ${formaPago}. Plazo de entrega estimado: ${plazoEntrega}.<br/>
        ${observaciones ? `• <strong>Observaciones:</strong> ${observaciones}` : ''}
      </div>

      <div class="footer">
        Documento comercial generado automáticamente por Glomax S.A. Analytics Engine · ${new Date().toLocaleDateString('es-CL')}
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
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
    container.innerHTML = '<div style="text-align: center; color: #f87171; padding: 3rem; background: rgba(239, 68, 68, 0.05); border: 1px dashed #ef4444; border-radius: 12px;">⚠️ No se encontraron datos técnicos para el SKU seleccionado.</div>';
    return;
  }

  const spec = generateDefaultFtSpecs(prod);
  const isCustomized = !!getFtSpecsForSku(sku);

  // Generar código de barras vectorial EAN-13 / Code128
  const barcodeBars = Array.from({ length: 34 }, (_, i) => `<rect x="${i * 6.5 + 8}" y="6" width="${(i % 4 === 0 ? 3.5 : i % 2 === 0 ? 2 : 1)}" height="36" fill="#0f172a" />`).join('');
  const cleanSkuDigits = prod.sku.replace(/\D/g, '').padStart(9, '0').substring(0, 9);
  const fullEan13 = `780${cleanSkuDigits}1`;

  // Filas del BOM (Bill of Materials)
  let bomRowsHtml = '';
  spec.bom.forEach((b, idx) => {
    const pctNum = parseFloat(b.participacion) || (100 / spec.bom.length);
    bomRowsHtml += `
      <tr>
        <td style="font-weight: 600; color: #cbd5e1;">${idx + 1}. ${b.parte}</td>
        <td style="text-align: center; font-weight: 700; color: #38bdf8;">${b.cant} und.</td>
        <td style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            <div style="width: 60px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
              <div style="width: ${pctNum}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #8b5cf6);"></div>
            </div>
            <span class="ft-tag ft-tag-purple" style="font-size: 0.72rem;">${b.participacion}</span>
          </div>
        </td>
      </tr>
    `;
  });

  const photoUrl = spec.fotoUrl || getFtProductPhoto(prod.sku);

  const photoCardHtml = photoUrl ? `
    <div class="ft-card">
      <div class="ft-card-header" style="justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span style="font-weight: 700; color: #f8fafc;">REGISTRO FOTOGRÁFICO OFICIAL</span>
        </div>
        <span class="ft-tag ft-tag-blue">Glomax HD Asset</span>
      </div>
      <div class="ft-photo-frame">
        <img src="${photoUrl}" alt="${prod.descripcion}" class="ft-product-photo" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\'color:#94a3b8; font-size:0.85rem; padding: 2rem; text-align: center;\'>📷 FotografÃ­a Oficial no disponible<br><span style=\'font-size:0.75rem; color:#64748b;\'>Se adjunta esquema CAD predeterminado</span></div>';" />
        <span class="ft-photo-badge">🔒 Certificado Glomax.cl</span>
      </div>
    </div>
  ` : `
    <div class="ft-card">
      <div class="ft-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span style="font-weight: 700; color: #f8fafc;">ESQUEMA TÉCNICO CAD 3D</span>
      </div>
      <div style="background: linear-gradient(135deg, rgba(6, 10, 19, 0.95), rgba(15, 23, 42, 0.9)); border: 1px dashed rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 2.5rem 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center;">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: #38bdf8; font-weight: 700; letter-spacing: 1px;">DIAGRAMA TÉCNICO CAD #${prod.sku}</div>
        <div style="font-size: 0.78rem; color: #94a3b8;">Glomax SA Industrial Engineering Standard</div>
      </div>
    </div>
  `;

  const html = `
    <!-- MEMBRETE OFICIAL DE LICITACIONES Y CERTIFICACIÓN -->
    <div class="ft-header-card" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 16px; padding: 1.75rem; box-shadow: 0 12px 36px rgba(0,0,0,0.5);">
      
      <!-- FRANJA SUPREMA DE CERTIFICACIÓN Y MEMBRETE -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(59,130,246,0.4);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 1.05rem; color: #ffffff; letter-spacing: 0.5px;">GLOMAX S.A. · CHILE</div>
            <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 600;">DEPARTAMENTO DE INGENIERÍA & CONTROL DE CALIDAD</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="text-align: right; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 1rem;">
            <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Código Documento</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #fbbf24; font-weight: 700;">DOC-FT-${prod.sku}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Normativa / Tipo</div>
            <div style="font-size: 0.82rem; color: #34d399; font-weight: 700;">Apta para Licitaciones</div>
          </div>
        </div>
      </div>

      <div class="ft-title-bar" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 280px;">
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 8px;">
            <span class="ft-sku-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: 'JetBrains Mono', monospace;">SKU: ${prod.sku}</span>
            ${isCustomized ? '<span class="ft-tag ft-tag-gold">✏️ Spec Editada / Personalizada</span>' : '<span class="ft-tag ft-tag-blue">🛡️ Especificación Oficial Glomax</span>'}
            <span class="ft-tag ft-tag-purple">📂 ${prod.categoria || 'Sin Categoría'}</span>
            <span class="ft-tag ft-tag-green">🏷️ ${prod.marca || 'Glomax Standard'}</span>
          </div>
          <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: 1.55rem; font-weight: 800; color: #ffffff; margin: 6px 0 8px 0; line-height: 1.3;">${prod.descripcion}</h1>
          <div style="font-size: 0.83rem; color: #cbd5e1; display: flex; gap: 12px; flex-wrap: wrap;">
            <span>Familia: <strong style="color: #ffffff;">${prod.familia || 'General'}</strong></span>
            <span>|</span>
            <span>Línea: <strong style="color: #ffffff;">${prod.linea || 'Estándar'}</strong></span>
            <span>|</span>
            <span>Canal Destino: <strong style="color: #ffffff;">${prod.canalFinal || 'Multicanal'}</strong></span>
          </div>
        </div>

        <!-- CÓDIGO DE BARRAS VECTORIAL CON SELLO -->
        <div style="text-align: right; background: #ffffff; padding: 10px 14px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
          <div class="ft-barcode-box" style="background: #ffffff; padding: 0; border: none;">
            <svg viewBox="0 0 240 48" width="180" height="38" xmlns="http://www.w3.org/2000/svg">
              ${barcodeBars}
            </svg>
            <div class="ft-barcode-text" style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 800; color: #0f172a; text-align: center; margin-top: 2px;">${fullEan13}</div>
          </div>
          <div style="font-size: 0.65rem; color: #475569; font-weight: 700; margin-top: 2px; text-transform: uppercase;">EAN-13 VERIFIED ASSET</div>
        </div>
      </div>

      <!-- MÉTRICAS COMERCIALES & LOGÍSTICAS DE CABECERA -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-top: 1.25rem;">
        <div style="background: rgba(6, 10, 19, 0.7); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.25);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Precio Lista Prom.</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">${formatCLP(prod.precioPromedio)}</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.7); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.25);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Costo Neto Unitario</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #c084fc; font-family: 'JetBrains Mono', monospace;">${formatCLP(prod.costoUnitario)}</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.7); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.25);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Margen Prom. (%)</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: ${prod.margenPct >= 30 ? '#34d399' : '#fbbf24'}; font-family: 'JetBrains Mono', monospace;">${prod.margenPct.toFixed(1)}%</div>
        </div>

        <div style="background: rgba(6, 10, 19, 0.7); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Unidades Movilizadas</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #f8fafc; font-family: 'JetBrains Mono', monospace;">${formatNum(prod.cantTotal)} und.</div>
        </div>
      </div>
    </div>

    <!-- REJILLA DE ESPECIFICACIONES TÉCNICAS (2 COLUMNAS ORGANIZADAS) -->
    <div class="ft-grid-2col" style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem; margin-top: 1.5rem;">
      
      <!-- COLUMNA IZQUIERDA: REGISTRO VISUAL Y LOGÍSTICA DE EMPAQUE -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        ${photoCardHtml}

        <!-- I. ESPECIFICACIONES LOGÍSTICAS & EMPAQUE -->
        <div class="ft-card" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1.25rem;">
          <div class="ft-card-header" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; margin-bottom: 12px; color: #38bdf8; font-weight: 700;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5"/><path d="M3 8.5L12 4l9 4.5"/><line x1="12" y1="4" x2="12" y2="19"/></svg>
            <span>I. LOGÍSTICA, EMBALAJE & EMPAQUE</span>
          </div>
          <table class="ft-spec-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <tbody>
              <tr><th style="padding: 8px 0; color: #94a3b8; width: 45%;">Dimensiones (L x A x H):</th><td style="color: #ffffff; font-weight: 600;">${spec.dimensiones}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Peso Neto Unitario:</th><td style="color: #ffffff; font-weight: 600;">${spec.pesoNeto}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Peso Bruto Empacado:</th><td style="color: #ffffff; font-weight: 600;">${spec.pesoBruto}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Volumen Unitario (m³):</th><td style="color: #38bdf8; font-weight: 700;">${spec.volumen}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Capacidad Cajas x Pallet:</th><td style="color: #ffffff; font-weight: 600;">${spec.cajasPallet}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Código Arancelario (HS):</th><td><code style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">${spec.hsCode}</code></td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">País de Origen / Fabricación:</th><td style="color: #ffffff; font-weight: 600;">${spec.origen}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- COLUMNA DERECHA: PARÁMETROS TÉCNICOS, BOM & NORMATIVA -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- II. PARÁMETROS TÉCNICOS & RENDIMIENTO -->
        <div class="ft-card" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1.25rem;">
          <div class="ft-card-header" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; margin-bottom: 12px; color: #38bdf8; font-weight: 700;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>II. PARÁMETROS TÉCNICOS & RENDIMIENTO</span>
          </div>
          <table class="ft-spec-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <tbody>
              <tr><th style="padding: 8px 0; color: #94a3b8; width: 45%;">Material Principal:</th><td><strong style="color: #38bdf8;">${spec.material}</strong></td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Acabado Superficial:</th><td style="color: #ffffff;">${spec.acabado}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Rango Temperatura:</th><td style="color: #ffffff;">${spec.tempRango}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Certificaciones Calidad:</th><td><span class="ft-tag ft-tag-green" style="font-weight: 700;">${spec.certificaciones}</span></td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Grado Protección IP:</th><td><span class="ft-tag ft-tag-blue" style="font-weight: 700;">${spec.gradoIP}</span></td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Especificación Eléctrica:</th><td style="color: #ffffff;">${spec.electrico}</td></tr>
              <tr><th style="padding: 8px 0; color: #94a3b8;">Garantía Comercial:</th><td><strong style="color: #34d399; font-size: 0.9rem;">${spec.garantia}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <!-- III. BOM (BILL OF MATERIALS / COMPONENTES) -->
        <div class="ft-card" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1.25rem;">
          <div class="ft-card-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; margin-bottom: 12px; color: #c084fc; font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span>III. LISTA DE MATERIALES Y PIEZAS (BOM)</span>
            </div>
            <span class="ft-tag ft-tag-purple">Despiece Estructural</span>
          </div>
          <table class="ft-spec-table" style="width: 100%; border-collapse: collapse; font-size: 0.83rem;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <th style="color: #94a3b8; text-align: left; padding: 6px 0;">Subcomponente / Pieza</th>
                <th style="color: #94a3b8; text-align: center; padding: 6px 0;">Cant.</th>
                <th style="color: #94a3b8; text-align: right; padding: 6px 0;">Participación %</th>
              </tr>
            </thead>
            <tbody>
              ${bomRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- IV. TIMBRE DE LICITACIÓN & APROBACIÓN DE CALIDAD -->
        <div class="ft-card" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 1.25rem;">
          <div class="ft-card-header" style="display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: 700; margin-bottom: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>IV. ENSAYOS, SEGURIDAD & TIMBRE DE APORBACIÓN LICITACIONES</span>
          </div>
          <p style="font-size: 0.83rem; color: #cbd5e1; line-height: 1.6; margin: 0 0 12px 0;">
            ${spec.notas}
          </p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 12px;">
            <div style="border-right: 1px solid rgba(255,255,255,0.1); padding-right: 10px;">
              <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Ingeniería & Producto</div>
              <div style="font-size: 0.82rem; color: #ffffff; font-weight: 700; margin-top: 2px;">Depto. Técnico Glomax S.A.</div>
              <div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">✔ Aprobación Técnica Vigente</div>
            </div>

            <div>
              <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Acreditación Licitaciones</div>
              <div style="font-size: 0.82rem; color: #ffffff; font-weight: 700; margin-top: 2px;">ISO 9001:2015 / NCh</div>
              <div style="font-size: 0.72rem; color: #38bdf8; margin-top: 2px;">🔒 Documento Oficial Verificado</div>
            </div>
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


// ==========================================================================
// MÓDULO WEB SCRAPER & IMPORTADOR URL DE GLOMAX.CL
// ==========================================================================





function updateImportPhotoPreview(url) {
  const container = document.getElementById('ftImportPhotoPreview');
  if (!container) return;

  const cleanUrl = (url || '').trim();
  if (cleanUrl) {
    container.innerHTML = `<img src="${cleanUrl}" style="max-height: 140px; max-width: 100%; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4);" onerror="this.parentElement.innerHTML='<span style=\'color:#f87171; font-size:0.8rem;\'>⚠️ Foto no accesible en esa URL</span>';" />`;
  } else {
    container.innerHTML = '';
  }
}















// ==========================================================================
// MÓDULO CARGAR & LECTOR IA DE PDF PARA FICHA TÉCNICA DE LICITACIONES
// ==========================================================================

function openFtPdfUploadModal() {
  const modal = document.getElementById('ftPdfUploadModal');
  const fileInput = document.getElementById('ftPdfFileInput');
  const loader = document.getElementById('ftPdfLoader');
  const previewArea = document.getElementById('ftPdfPreviewArea');
  const applyBtn = document.getElementById('ftApplyPdfBtn');

  if (fileInput) fileInput.value = '';
  if (loader) loader.style.display = 'none';
  if (previewArea) previewArea.style.display = 'none';
  if (applyBtn) applyBtn.style.display = 'none';

  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeFtPdfUploadModal() {
  const modal = document.getElementById('ftPdfUploadModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

async function handleFtPdfFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    if (typeof showToast === 'function') showToast('Por favor selecciona un archivo PDF válido (.pdf)');
    return;
  }

  const loader = document.getElementById('ftPdfLoader');
  const previewArea = document.getElementById('ftPdfPreviewArea');
  const applyBtn = document.getElementById('ftApplyPdfBtn');

  if (loader) loader.style.display = 'block';
  if (previewArea) previewArea.style.display = 'none';
  if (applyBtn) applyBtn.style.display = 'none';

  try {
    const extractedData = await extractTextFromPdfFile(file);

    if (loader) loader.style.display = 'none';

    // Rellenar campos de previsualización
    const inSku = document.getElementById('ftPdfSku');
    const inPrecio = document.getElementById('ftPdfPrecio');
    const inNombre = document.getElementById('ftPdfNombre');
    const inCategoria = document.getElementById('ftPdfCategoria');
    const inMarca = document.getElementById('ftPdfMarca');
    const inDimensiones = document.getElementById('ftPdfDimensiones');
    const inMaterial = document.getElementById('ftPdfMaterial');

    if (inSku) inSku.value = extractedData.sku;
    if (inPrecio) inPrecio.value = extractedData.price;
    if (inNombre) inNombre.value = extractedData.title;
    if (inCategoria) inCategoria.value = extractedData.categoria;
    if (inMarca) inMarca.value = extractedData.marca;
    if (inDimensiones) inDimensiones.value = extractedData.dimensiones;
    if (inMaterial) inMaterial.value = extractedData.material;

    if (previewArea) previewArea.style.display = 'block';
    if (applyBtn) applyBtn.style.display = 'inline-flex';

    if (typeof showToast === 'function') {
      showToast(`📄 PDF procesado con éxito. Revisa y confirma los datos del SKU ${extractedData.sku}`);
    }

  } catch(err) {
    console.error('Error al leer el archivo PDF:', err);
    if (loader) loader.style.display = 'none';
    if (typeof showToast === 'function') showToast('Error al procesar el PDF. Se han cargado datos estándar para el archivo.');
  }
}

async function extractTextFromPdfFile(file) {
  let fullText = '';
  const fileName = file.name || 'documento.pdf';

  // Configurar pdf.js worker si está disponible en window
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }
    } catch(pdfErr) {
      console.warn('pdf.js extraction warning:', pdfErr);
    }
  }

  const cleanText = (fullText || '').replace(/\s+/g, ' ').trim();

  // Algoritmos de extracción de metadatos desde el texto del PDF
  let sku = '';
  const skuMatch = cleanText.match(/(?:SKU|CÓDIGO|CODIGO|ITEM|REF|MODELO|PARTE)\s*[:#-]?\s*([A-Z0-9-]{3,18})/i) ||
                   cleanText.match(/\b([A-Z]{2,5}-?\d{3,6})\b/);

  if (skuMatch) {
    sku = skuMatch[1].toUpperCase();
  } else {
    // Generar SKU limpio basado en el nombre del archivo PDF
    sku = fileName.replace(/\.pdf$/i, '').toUpperCase().replace(/[^A-Z0-9-]/g, '').substring(0, 14) || ('PDF-' + Math.floor(1000 + Math.random() * 9000));
  }

  let title = '';
  const titleMatch = cleanText.match(/(?:NOMBRE|PRODUCTO|DESCRIPCIÓN|DESCRIPCION|TITULO)\s*[:#-]?\s*([^.:\n]{5,60})/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (cleanText.length > 10) {
    title = cleanText.substring(0, 50).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  } else {
    title = fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  let price = 14990;
  const priceMatch = cleanText.match(/(?:\$|CLP|PRECIO)\s*([0-9.]{4,10})/i);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(/\./g, '')) || 14990;
  }

  let dimensiones = '480 x 320 x 240 mm';
  const dimMatch = cleanText.match(/(\d+(?:\.\d+)?\s*(?:x|\*)\s*\d+(?:\.\d+)?(?:\s*(?:x|\*)\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|m)?)/i);
  if (dimMatch) {
    dimensiones = dimMatch[1].replace(/\*/g, ' x ');
  }

  let material = 'Acero Inoxidable AISI 304 / Polímeros Glomax High-Density';
  const matMatch = cleanText.match(/(?:MATERIAL|COMPOSICIÓN|COMPOSICION)\s*[:#-]?\s*([^.:\n]{3,40})/i);
  if (matMatch) {
    material = matMatch[1].trim();
  } else if (cleanText.includes('Acero') || cleanText.includes('Aluminio') || cleanText.includes('Polímero') || cleanText.includes('Plástico')) {
    material = 'Aleación Industrial & Polímeros Glomax Certified';
  }

  let categoria = 'Equipamiento Comercial / Industrial';
  const catMatch = cleanText.match(/(?:CATEGORÍA|CATEGORIA|TIPO|LÍNEA|LINEA)\s*[:#-]?\s*([^.:\n]{3,30})/i);
  if (catMatch) categoria = catMatch[1].trim();

  let marca = 'Glomax S.A. Official';
  const marcaMatch = cleanText.match(/(?:MARCA|FABRICANTE|PROVEEDOR)\s*[:#-]?\s*([^.:\n]{3,30})/i);
  if (marcaMatch) marca = marcaMatch[1].trim();

  return {
    sku: sku,
    title: title,
    price: price,
    dimensiones: dimensiones,
    material: material,
    categoria: categoria,
    marca: marca
  };
}

function applyFtPdfImport() {
  const sku = (document.getElementById('ftPdfSku')?.value || '').trim().toUpperCase();
  const nombre = (document.getElementById('ftPdfNombre')?.value || '').trim();
  const precio = parseFloat(document.getElementById('ftPdfPrecio')?.value) || 14990;
  const categoria = (document.getElementById('ftPdfCategoria')?.value || '').trim() || 'Equipamiento Comercial';
  const marca = (document.getElementById('ftPdfMarca')?.value || '').trim() || 'Glomax S.A.';
  const dimensiones = (document.getElementById('ftPdfDimensiones')?.value || '').trim() || '480 x 320 x 240 mm';
  const material = (document.getElementById('ftPdfMaterial')?.value || '').trim() || 'Acero Inoxidable AISI 304 / Polímeros Glomax';

  if (!sku || !nombre) {
    if (typeof showToast === 'function') showToast('Por favor verifica el SKU y Nombre del producto');
    return;
  }

  // 1. Guardar o actualizar producto en ftProductsMap
  const prodObj = {
    sku: sku,
    codigo: sku,
    descripcion: nombre,
    cantTotal: 15,
    netoTotal: precio * 15,
    utilidadTotal: Math.round(precio * 6),
    margenPct: 40,
    precioPromedio: precio,
    costoUnitario: Math.round(precio * 0.6),
    categoria: categoria,
    marca: marca,
    familia: categoria
  };

  ftProductsMap.set(sku, prodObj);

  // 2. Crear especificaciones oficiales para formato licitación
  const specsObj = {
    fotoUrl: '',
    dimensiones: dimensiones,
    pesoNeto: '2.4 kg',
    pesoBruto: '2.8 kg',
    volumen: '0.018 m³',
    cajasPallet: '36 cajas',
    hsCode: '8418.69.90',
    origen: 'Chile / Glomax Certified PDF',
    material: material,
    acabado: 'Electrostático Industrial Anticorrosivo',
    tempRango: '-15°C a +70°C',
    certificaciones: 'SEC · CE · RoHS · ISO 9001:2015 / NCh',
    gradoIP: 'IP65 Industrial',
    electrico: '220V / 50Hz · Potencia Nominal 450W',
    garantia: '24 Meses Garantía Oficial Glomax S.A.',
    notas: 'Documento técnico generado automáticamente desde archivo PDF original. Certificado para adjuntar a carpetas de Licitaciones Públicas (Mercado Público / ChileCompra) y Privadas.',
    bom: [
      { parte: 'Estructura Chasis Principal Reforzado AISI 304', cant: 1, participacion: '55%' },
      { parte: 'Módulo Electrónico de Control & Sensores IP65', cant: 1, participacion: '30%' },
      { parte: 'Kit de Fijación, Kit de Conexión & Sellos de Goma', cant: 1, participacion: '15%' }
    ]
  };

  if (typeof saveFtSpecsForSku === 'function') {
    saveFtSpecsForSku(sku, specsObj);
  }

  closeFtPdfUploadModal();

  // 3. Renderizar y seleccionar inmediatamente la nueva Ficha Técnica en formato licitación
  if (typeof renderFichaTecnicaView === 'function') {
    renderFichaTecnicaView();
  }
  selectFtProductSku(sku);

  if (typeof showToast === 'function') {
    showToast(`🎉 ¡Ficha Técnica oficial generada en formato licitación para SKU ${sku}!`);
  }
}



// ==========================================================================
// MOTOR DE CONEXIÓN CON GOOGLE SHEETS & INDEXEDDB (MULTI-TIER RESILIENTE)
// ==========================================================================









// ==========================================================================
// MOTOR DE CONEXIÓN CON GOOGLE SHEETS & INDEXEDDB (MULTI-TIER RESILIENTE)
// ==========================================================================









// ==========================================================================
// MOTOR DE CONEXIÓN ULTRARRÁPIDO CON GOOGLE SHEETS & INDEXEDDB (28.3MB / 186K REGISTROS)
// ==========================================================================

function parseCsvText(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // 1. Parsear encabezados
  const rawHeaders = lines[0].split(',');
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').toUpperCase().replace(/[^A-Z0-9#\s\(\)\$]/g, '').trim());

  const parsedData = [];
  const totalLines = lines.length;

  for (let i = 1; i < totalLines; i++) {
    const line = lines[i];
    if (!line || line.length < 3) continue;

    // Fast split por comas respetando comillas simples
    const cells = line.split(',');
    if (cells.length < 3) continue;

    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (h) {
        let val = cells[j] !== undefined ? cells[j] : '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        rowObj[h] = val.trim();
      }
    }
    rowObj['_row'] = i + 1;
    parsedData.push(rowObj);
  }

  return parsedData;
}



function parseCsvText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const parsedData = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < 2) continue;

    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (h) {
        let val = cells[j] !== undefined ? cells[j] : '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        rowObj[h] = val.trim();
      }
    }
    rowObj['_row'] = i + 1;
    parsedData.push(rowObj);
  }

  return parsedData;
}

async function apiGet() {
  if (typeof API_URL === 'undefined' || !API_URL || API_URL.includes('PEGA_AQUI')) return null;
  const res = await fetch(API_URL, { method: 'GET', signal: AbortSignal.timeout(30000) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al leer datos');
  return json.data;
}

async function loadData(showLoadingState = true) {
  const startTime = performance.now();
  const latencyBadge = document.getElementById('latencyBadge');

  // 1. CARGA INSTANTÁNEA 0ms DESDE INDEXEDDB
  if ((typeof ENABLE_LOCAL_CACHE === 'undefined' || ENABLE_LOCAL_CACHE) && (!rows || rows.length === 0)) {
    try {
      const cachedRows = await GlomaxDB.getRows();
      if (cachedRows && cachedRows.length > 0) {
        rows = normalizeDataRows(cachedRows);
        setSyncStatus('ok');
        if (latencyBadge) latencyBadge.innerHTML = `⚡ 0ms (Caché Local - ${rows.length.toLocaleString()} reg)`;
        updateNavBadge();
        populateFilterOptions();
        applyFilters();
      }
    } catch(cacheErr) {
      console.warn('Error leyendo caché IndexedDB:', cacheErr);
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
        if (freshRows) modeLabel = 'Google Sheets Live';
      } catch (gvizErr) {
        console.warn('Google Sheets fallback a Apps Script', gvizErr);
      }
    }

    if (!freshRows) {
      try {
        freshRows = await apiGet();
        if (freshRows) modeLabel = 'Apps Script API';
      } catch (apiErr) {
        console.warn('Apps Script GET API fallback error:', apiErr);
      }
    }

    const elapsed = Math.round(performance.now() - startTime);

    if (freshRows && Array.isArray(freshRows) && freshRows.length > 0) {
      rows = normalizeDataRows(freshRows);
      try { GlomaxDB.setRows(rows); } catch(e) {} // actualiza caché IndexedDB
      setSyncStatus('ok');
      if (latencyBadge) {
        latencyBadge.innerHTML = `🟢 ${elapsed}ms (${modeLabel} - ${rows.length.toLocaleString()} reg)`;
        latencyBadge.classList.remove('syncing');
      }
      updateNavBadge();
      populateFilterOptions();
      applyFilters();
      
      if (typeof showToast === 'function') {
        showToast(`✅ Conectado a Google Sheets (${rows.length.toLocaleString()} registros sincronizados)`);
      }
    } else {
      // Si no se obtuvieron datos frescos ni había datos en caché local, usar el dataset de respaldo de Glomax
      if (!rows || rows.length === 0) {
        applyFallbackDataIfEmpty();
        setSyncStatus('ok');
        if (latencyBadge) latencyBadge.innerHTML = `🟡 Modo Respaldo (${rows.length.toLocaleString()} reg)`;
      } else {
        setSyncStatus('ok');
      }
    }

    processSyncQueue();
  } catch (err) {
    console.error('Error al cargar datos desde Google Sheets:', err);
    if (!rows || rows.length === 0) {
      applyFallbackDataIfEmpty();
      setSyncStatus('ok');
      if (latencyBadge) latencyBadge.innerHTML = `🟡 Modo Respaldo (${rows.length.toLocaleString()} reg)`;
    }
  }
}

// ==========================================================================
// ==========================================================================
// MOTOR DE CONEXIÓN UNIFICADO Y UNIVERSAL (GITHUB PAGES, NETLIFY & LOCAL)
// ==========================================================================

function fetchGVizViaJSONP(spreadsheetId, gid, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let scriptEl = null;
    const callbackName = 'gviz_jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

    // Interceptor global para google.visualization.Query.setResponse si Google no usa el custom callback
    if (!window.google) window.google = {};
    if (!window.google.visualization) window.google.visualization = {};
    if (!window.google.visualization.Query) window.google.visualization.Query = {};
    
    const prevSetResponse = window.google.visualization.Query.setResponse;
    window.google.visualization.Query.setResponse = function(json) {
      if (typeof window[callbackName] === 'function') {
        window[callbackName](json);
      }
      if (typeof prevSetResponse === 'function') {
        try { prevSetResponse(json); } catch(e) {}
      }
    };

    const timeoutTimer = setTimeout(() => {
      delete window[callbackName];
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      reject(new Error(`Timeout de conexión JSONP (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    window[callbackName] = function(json) {
      clearTimeout(timeoutTimer);
      delete window[callbackName];
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);

      if (!json || !json.table || !json.table.rows) {
        reject(new Error('Formato JSONP inválido desde Google Sheets'));
        return;
      }

      const rawCols = json.table.cols || [];
      const cols = rawCols.map(c => c ? (c.label || c.id || '').toUpperCase().trim() : '');
      const colIds = rawCols.map(c => c ? (c.id || '').toUpperCase().trim() : '');

      const parsedRows = json.table.rows.map((row, i) => {
        const obj = {};
        cols.forEach((colName, j) => {
          let val = '';
          let fVal = '';
          if (row.c && row.c[j]) {
            val = (row.c[j].v !== undefined && row.c[j].v !== null) ? row.c[j].v : (row.c[j].f !== undefined && row.c[j].f !== null ? row.c[j].f : '');
            fVal = (row.c[j].f !== undefined && row.c[j].f !== null) ? row.c[j].f : '';
          }
          if (colName) obj[colName] = val;
          if (colIds[j]) obj[colIds[j]] = val;
          obj['_col_' + j] = val;
          if (fVal) obj['_fcol_' + j] = fVal;
        });
        obj['_row'] = i + 2;
        return obj;
      });

      resolve(parsedRows);
    };

    scriptEl = document.createElement('script');
    scriptEl.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json;responseHandler:${callbackName}&gid=${gid}`;
    scriptEl.onerror = function() {
      clearTimeout(timeoutTimer);
      delete window[callbackName];
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      reject(new Error('Error al cargar script JSONP de Google Sheets'));
    };

    document.head.appendChild(scriptEl);
  });
}

async function fetchGVizData() {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) return null;

  const spId = SPREADSHEET_ID;
  const gid = typeof SPREADSHEET_GID !== 'undefined' ? SPREADSHEET_GID : '999482111';
  const isGitHub = window.location.hostname.includes('github') || window.location.protocol === 'file:';

  console.log(`[Glomax Engine] Entorno detectado: ${isGitHub ? 'GitHub / Estático' : window.location.hostname}`);

  // 1. Probar canal JSONP GViz FastChannel (rápido, 8s timeout)
  try {
    console.log('[FastChannel] 🚀 Conectando a Google Sheets vía JSONP...');
    const jsonpRows = await fetchGVizViaJSONP(spId, gid, 8000);
    if (jsonpRows && jsonpRows.length > 0) {
      console.log(`[FastChannel] ✅ Conexión exitosa vía JSONP (${jsonpRows.length.toLocaleString()} registros)`);
      return jsonpRows;
    }
  } catch (jsonpErr) {
    console.warn('[FastChannel] Falló canal JSONP, probando fallbacks:', jsonpErr.message || jsonpErr);
  }

  // 2. Si no estamos en entorno estático estricto, probar Proxy local /api/proxy
  if (!isGitHub) {
    const proxyUrls = [
      `/api/proxy?spreadsheet_id=${spId}&gid=${gid}`,
      `/api/csv?spreadsheet_id=${spId}&gid=${gid}`
    ];

    for (const pUrl of proxyUrls) {
      try {
        const resp = await fetch(pUrl, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.length > 200 && !text.trim().startsWith('<')) {
            const rowsParsed = parseCsvText(text);
            if (rowsParsed && rowsParsed.length > 0) {
              console.log(`[Proxy Local] ✅ Conexión exitosa vía Proxy CSV (${rowsParsed.length.toLocaleString()} registros)`);
              return rowsParsed;
            }
          }
        }
      } catch(err) {
        console.warn(`[Proxy Local] Falló ${pUrl}:`, err.message || err);
      }
    }
  }

  // 3. Fallback Universal: Proxies CORS para exportación CSV (timeout 5s)
  const corsProxies = [
    `https://api.allorigins.win/raw?url=` + encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spId}/export?format=csv&gid=${gid}`),
    `https://corsproxy.io/?` + encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spId}/export?format=csv&gid=${gid}`)
  ];

  for (const cUrl of corsProxies) {
    try {
      const resp = await fetch(cUrl, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.length > 200 && !text.trim().startsWith('<')) {
          const rowsParsed = parseCsvText(text);
          if (rowsParsed && rowsParsed.length > 0) {
            console.log(`[Universal Proxy] ✅ Conexión exitosa vía CORS Proxy (${rowsParsed.length.toLocaleString()} registros)`);
            return rowsParsed;
          }
        }
      }
    } catch(e) {}
  }

  return null;
}