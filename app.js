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

  if (str.startsWith('Date(')) {
    const match = str.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]), Number(match[3]));
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parts = str.split(/[\/\-\.\s]+/);
  if (parts.length >= 3) {
    const p0 = Number(parts[0]);
    const p1 = Number(parts[1]);
    const p2 = Number(parts[2]);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (p2 > 1000) {
        const d = new Date(p2, p1 - 1, p0);
        if (!isNaN(d.getTime())) return d;
      } else if (p0 > 1000) {
        const d = new Date(p0, p1 - 1, p2);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
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

// // ---------- PARSERS DE ALTO RENDIMIENTO ----------

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentVal);
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal);
    lines.push(row);
  }
  return lines;
}

function parseNumberClean(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;
  
  let str = String(val).trim().replace(/[\$\s]/g, '');
  if (!str) return 0;

  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, '');
  } else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }

  const n = Number(str);
  if (isNaN(n)) return 0;
  return isNegative ? -n : n;
}

function parseRowDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (str.startsWith('Date(')) {
    const match = str.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]), Number(match[3]));
    }
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? val : d;
}
function parseFechaString(val) { return parseRowDate(val); }

// ---------- API & ENGINE HYBRID CONEXIÓN ----------

function normalizeRow(obj) {
  if (!obj) return null;

  const desc = String(obj['DESCRIPCION'] ?? obj['Descripcion'] ?? obj['GLOSA'] ?? '').trim();
  const codigo = String(obj['CODIGO'] ?? obj['Codigo'] ?? obj['SKU'] ?? '').trim();
  const familia = String(obj['FAMILIA'] ?? obj['Familia'] ?? obj['Grupo'] ?? 'General').trim();

  // Excluir automáticamente todos los productos/servicios de despacho o flete
  const descLower = desc.toLowerCase();
  const codeLower = codigo.toLowerCase();
  const famLower = familia.toLowerCase();
  if (descLower.includes('despacho') || codeLower.includes('despacho') || famLower.includes('despacho')) {
    return null;
  }

  if (obj._normalized) return obj;

  const cant = parseNumberClean(obj['CANTFACTURADA'] ?? obj['CantFacturada'] ?? obj['CANT'] ?? 0);
  const preuni = parseNumberClean(obj['PREUNI'] ?? obj['PreUni'] ?? 0);
  const costos = parseNumberClean(obj['COSTOS'] ?? obj['Costos'] ?? 0);
  
  let neto = obj['NETO'] !== undefined && obj['NETO'] !== '' ? parseNumberClean(obj['NETO']) : (cant * preuni);
  let costoTotalNet = obj['COSTO TOTAL NET'] !== undefined && obj['COSTO TOTAL NET'] !== '' ? parseNumberClean(obj['COSTO TOTAL NET']) : (cant * costos);
  let utilidad = obj['($) UTILIDAD'] !== undefined && obj['($) UTILIDAD'] !== '' ? parseNumberClean(obj['($) UTILIDAD']) : (neto - costoTotalNet);

  const fechaRaw = obj['FECHA'] ?? obj['Fecha'] ?? '';
  const dObj = parseRowDate(fechaRaw);

  const folio = String(obj['FOLIO'] ?? obj['Folio'] ?? '').trim();
  const cliente = String(obj['CLIENTE'] ?? obj['Cliente'] ?? '').trim();
  const canal = String(obj['CANAL FINAL'] ?? obj['Canal Final'] ?? '').trim();
  const tienda = String(obj['TIENDA FINAL'] ?? obj['Tienda Final'] ?? '').trim();
  const vendedor = String(obj['CODVENDENDOR'] ?? obj['CodVendedor'] ?? '').trim();
  const categoria = String(obj['CATEGORIA'] ?? obj['Categoria'] ?? obj['Linea'] ?? 'General').trim();
  const region = String(obj['REGION'] ?? obj['Region'] ?? '').trim();

  const norm = {
    ...obj,
    FOLIO: folio,
    FECHA: dObj || fechaRaw,
    CODIGO: codigo,
    DESCRIPCION: desc,
    CANTFACTURADA: cant,
    PREUNI: preuni,
    COSTOS: costos,
    NETO: neto,
    'COSTO TOTAL NET': costoTotalNet,
    '($) UTILIDAD': utilidad,
    FAMILIA: familia,
    CATEGORIA: categoria,
    'CANAL FINAL': canal,
    'TIENDA FINAL': tienda,
    CODVENDENDOR: vendedor,
    REGION: region,

    _time: dObj ? dObj.getTime() : 0,
    _canal: canal.toLowerCase(),
    _tienda: tienda.toLowerCase(),
    _vendedor: vendedor.toLowerCase(),
    _familia: familia.toLowerCase(),
    _categoria: categoria.toLowerCase(),
    _region: region.toLowerCase(),
    _searchHaystack: `${folio} ${cliente} ${codigo} ${desc}`.toLowerCase(),
    _normalized: true
  };

  return norm;
}

async function fetchGVizData() {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) return null;

  const gid = (typeof SPREADSHEET_GID !== 'undefined' && SPREADSHEET_GID) ? SPREADSHEET_GID : '999482111';

  // ---------- Shared CSV parser (used by proxy and direct CSV channels) ----------
  function parseCsvText(csvText) {
    if (!csvText || csvText.trim().length === 0) return null;
    const rawRows = parseCSV(csvText);
    if (rawRows.length < 2) return null;
    const headers = rawRows[0].map(h => String(h || '').trim());
    const findIdx = (name, alt) => {
      let i = headers.indexOf(name);
      if (i === -1 && alt) i = headers.indexOf(alt);
      return i;
    };
    const idxFolio = findIdx('Folio', 'FOLIO');
    const idxFecha = findIdx('Fecha', 'FECHA');
    const idxCodigo = findIdx('Codigo', 'CODIGO');
    const idxDesc = findIdx('Descripcion', 'DESCRIPCION');
    const idxCant = findIdx('CantFacturada', 'CANTFACTURADA');
    const idxPreUni = findIdx('PreUni', 'PREUNI');
    const idxNeto = findIdx('Neto', 'NETO');
    const idxCostos = findIdx('Costos', 'COSTOS');
    const idxCostoNet = findIdx('Costo Total Net', 'COSTO TOTAL NET');
    const idxUtilidad = findIdx('($) Utilidad', '($) UTILIDAD');
    const idxCliente = findIdx('Cliente', 'CLIENTE');
    const idxVendedor = findIdx('CodVendedor', 'CODVENDENDOR');
    const idxFamilia = findIdx('Familia', 'FAMILIA');
    const idxCategoria = findIdx('Categoria', 'CATEGORIA');
    const idxCanal = findIdx('Canal Final', 'CANAL FINAL');
    const idxTienda = findIdx('Tienda Final', 'TIENDA FINAL');
    const idxRegion = findIdx('Region', 'REGION');
    const data = [];
    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length === 0 || (r.length === 1 && !r[0])) continue;
      const obj = {
        FOLIO: idxFolio >= 0 && idxFolio < r.length ? r[idxFolio] : '',
        FECHA: idxFecha >= 0 && idxFecha < r.length ? r[idxFecha] : '',
        CODIGO: idxCodigo >= 0 && idxCodigo < r.length ? r[idxCodigo] : '',
        DESCRIPCION: idxDesc >= 0 && idxDesc < r.length ? r[idxDesc] : '',
        CANTFACTURADA: idxCant >= 0 && idxCant < r.length ? r[idxCant] : '',
        PREUNI: idxPreUni >= 0 && idxPreUni < r.length ? r[idxPreUni] : '',
        NETO: idxNeto >= 0 && idxNeto < r.length ? r[idxNeto] : '',
        COSTOS: idxCostos >= 0 && idxCostos < r.length ? r[idxCostos] : '',
        'COSTO TOTAL NET': idxCostoNet >= 0 && idxCostoNet < r.length ? r[idxCostoNet] : '',
        '($) UTILIDAD': idxUtilidad >= 0 && idxUtilidad < r.length ? r[idxUtilidad] : '',
        CLIENTE: idxCliente >= 0 && idxCliente < r.length ? r[idxCliente] : '',
        CODVENDENDOR: idxVendedor >= 0 && idxVendedor < r.length ? r[idxVendedor] : '',
        FAMILIA: idxFamilia >= 0 && idxFamilia < r.length ? r[idxFamilia] : '',
        CATEGORIA: idxCategoria >= 0 && idxCategoria < r.length ? r[idxCategoria] : '',
        'CANAL FINAL': idxCanal >= 0 && idxCanal < r.length ? r[idxCanal] : '',
        'TIENDA FINAL': idxTienda >= 0 && idxTienda < r.length ? r[idxTienda] : '',
        REGION: idxRegion >= 0 && idxRegion < r.length ? r[idxRegion] : '',
        _row: i + 1
      };
      const norm = normalizeRow(obj);
      if (norm && (norm.FOLIO || norm.FECHA || norm.CODIGO || norm.DESCRIPCION || norm.CLIENTE || norm.NETO || norm.CANTFACTURADA)) {
        data.push(norm);
      }
    }
    return data.length > 0 ? data : null;
  }

  // ---------- Canal 1: Proxy Local (más rápido, sin CORS) ----------
  async function tryLocalProxy() {
    try {
      const origin = window.location.origin;
      if (!origin || origin.startsWith('file:')) return null;
      const proxyUrl = `${origin}/api/proxy`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) return null;
      const csvText = await res.text();
      const data = parseCsvText(csvText);
      if (data && data.length > 0) {
        console.log(`✅ Canal Proxy Local: ${data.length} filas`);
        return data;
      }
    } catch (e) {
      console.warn('Proxy local no disponible:', e.message);
    }
    return null;
  }

  // ---------- Canal 2: JSONP (sin CORS, compatible con file:// y http://) ----------
  async function tryJSONP() {
    try {
      const jsonpData = await new Promise((resolve, reject) => {
        const cbName = 'gviz_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
        const timer = setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, 45000);
        function cleanup() {
          clearTimeout(timer);
          delete window[cbName];
          const s = document.getElementById(cbName);
          if (s) s.remove();
        }
        window[cbName] = function(json) {
          cleanup();
          try {
            if (!json || !json.table) return resolve(null);
            const cols = (json.table.cols || []).map(c => c ? (c.label || c.id || '') : '');
            const rowsData = (json.table.rows || []).map((row, i) => {
              const obj = {};
              if (row && row.c) {
                cols.forEach((colName, j) => {
                  if (colName && row.c[j] !== undefined && row.c[j] !== null) {
                    let val = row.c[j].v !== null && row.c[j].v !== undefined ? row.c[j].v : '';
                    if (typeof val === 'string' && val.startsWith('Date(')) {
                      const match = val.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
                      if (match) val = new Date(Number(match[1]), Number(match[2]), Number(match[3]));
                    } else if (row.c[j].f !== undefined && (val === '' || val === null)) {
                      val = row.c[j].f;
                    }
                    obj[colName] = val;
                  }
                });
              }
              obj['_row'] = i + 2;
              return normalizeRow(obj);
            });
            const filtered = rowsData.filter(n => n && (n.FOLIO || n.FECHA || n.CODIGO || n.DESCRIPCION || n.CLIENTE || n.NETO || n.CANTFACTURADA));
            resolve(filtered.length > 0 ? filtered : null);
          } catch (err) { reject(err); }
        };
        const script = document.createElement('script');
        script.id = cbName;
        script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${cbName}&gid=${gid}&headers=1&_=${Date.now()}`;
        script.onerror = () => { cleanup(); reject(new Error('JSONP script load error')); };
        document.head.appendChild(script);
      });
      if (jsonpData && jsonpData.length > 0) {
        console.log(`✅ Canal JSONP GViz: ${jsonpData.length} filas`);
        return jsonpData;
      }
    } catch (err) {
      console.warn('JSONP error:', err.message);
    }
    return null;
  }

  // ---------- Canal 3: CSV Directo (fallback final) ----------
  async function tryCSV() {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`;
      const res = await fetch(csvUrl, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) return null;
      const csvText = await res.text();
      const data = parseCsvText(csvText);
      if (data && data.length > 0) {
        console.log(`✅ Canal CSV Directo: ${data.length} filas`);
        return data;
      }
    } catch (csvErr) {
      console.warn('CSV directo error:', csvErr.message);
    }
    return null;
  }

  // Intenta canales en orden de prioridad
  let result = await tryLocalProxy();
  if (!result) result = await tryJSONP();
  if (!result) result = await tryCSV();
  return result;
}

async function apiGet() {

  const res = await fetch(API_URL, { method: 'GET' });

  const json = await res.json();

  if (!json.ok) throw new Error(json.error || 'Error al leer datos');

  return Array.isArray(json.data) ? json.data.map(normalizeRow) : json.data;

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

  // 1. CARGA INSTANTÁNEA (0ms) DESDE CACHÉ INDEXEDDB LOCAL
  let hasLocalCache = false;
  if (typeof ENABLE_LOCAL_CACHE === 'undefined' || ENABLE_LOCAL_CACHE) {
    const cachedRows = await GlomaxDB.getRows();
    if (cachedRows && cachedRows.length > 0) {
      hasLocalCache = true;
      rows = cachedRows.map(normalizeRow).filter(Boolean);
      setSyncStatus('ok');
      if (latencyBadge) latencyBadge.innerHTML = `⚡ 0ms (Caché Local)`;
      updateNavBadge();
      populateFilterOptions();
      applyFilters();
    }
  }

  if (!hasLocalCache && showLoadingState) {
    setSyncStatus('loading');
  }

  // 2. REVALIDACIÓN EN SEGUNDO PLANO (NON-BLOCKING)
  const fetchNetworkData = async () => {
    try {
      let freshRows = null;
      let modeLabel = 'Apps Script';

      if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
        try {
          freshRows = await fetchGVizData();
          modeLabel = 'GViz FastChannel';
        } catch (gvizErr) {
          console.warn('GViz fallback', gvizErr);
        }
      }

      if (!freshRows && (!rows || rows.length === 0)) {
        try {
          freshRows = await apiGet();
        } catch (apiErr) {
          console.warn('Apps Script apiGet fallback', apiErr);
        }
      }

      const elapsed = Math.round(performance.now() - startTime);

      if (freshRows && Array.isArray(freshRows) && freshRows.length > 0) {
        rows = freshRows.map(normalizeRow).filter(Boolean);
        GlomaxDB.setRows(rows);
        setSyncStatus('ok');
        if (latencyBadge) {
          latencyBadge.innerHTML = `⚡ ${elapsed}ms (${modeLabel})`;
          latencyBadge.classList.remove('syncing');
        }
        updateNavBadge();
        populateFilterOptions();
        applyFilters();
      } else if (rows && rows.length > 0) {
        setSyncStatus('ok');
        if (latencyBadge) latencyBadge.innerHTML = `⚡ 0ms (Caché Local)`;
      }
      processSyncQueue();
    } catch (err) {
      console.warn('Background sync note:', err);
      if (rows && rows.length > 0) {
        setSyncStatus('ok');
        if (latencyBadge) latencyBadge.innerHTML = `⚡ 0ms (Caché Local)`;
      } else {
        setSyncStatus('error');
        if (latencyBadge) latencyBadge.innerHTML = `⚠️ Sin conexión`;
      }
    }
  };

  if (hasLocalCache) {
    // Si tenemos datos locales (0ms), revalidar en segundo plano sin congelar la pantalla
    setTimeout(fetchNetworkData, 400);
  } else {
    // Primera carga sin caché previa: esperar a red
    await fetchNetworkData();
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

function updateNavBadge() {

  const badge = document.getElementById('navCountBadge');

  if (badge) badge.textContent = formatNum(rows.length);

}

// ---------- Filtros & Atajos ----------

function cleanValStr(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).trim();
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s;
}

function uniqueValues(field) {
  const vals = rows.map(r => {
    let val = r[field];
    if (val === undefined || val === null || val === '') {
      if (field === 'CODVENDENDOR') val = r['CODVENDEDOR'] || r['CodVendedor'];
      if (field === 'FAMILIA') val = r['Familia'] || r['GRUPO'];
      if (field === 'CATEGORIA') val = r['Categoria'] || r['LINEA'];
      if (field === 'CANAL FINAL') val = r['Canal Final'];
      if (field === 'TIENDA FINAL') val = r['Tienda Final'];
      if (field === 'REGION') val = r['Region'];
    }
    return cleanValStr(val);
  }).filter(v => v !== '');
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function populateFilterOptions() {

  const map = {

    fltCanal: 'CANAL FINAL',

    fltTienda: 'TIENDA FINAL',

    fltVendedor: 'CODVENDENDOR',

    fltFamilia: 'FAMILIA',

    fltCategoria: 'CATEGORIA',

    fltRegion: 'REGION'

  };

  Object.entries(map).forEach(([selectId, field]) => {

    const select = document.getElementById(selectId);

    if (!select) return;

    const current = select.value;

    const opts = uniqueValues(field);

    select.innerHTML = `<option value="">Todas</option>` + opts.map(o => `<option value="${o}">${o}</option>`).join('');

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

    categoria: document.getElementById('fltCategoria') ? document.getElementById('fltCategoria').value : '',

    region: document.getElementById('fltRegion').value,

    search: (document.getElementById('searchBox') ? document.getElementById('searchBox').value : '').trim().toLowerCase()

  };

}

function applyFilters() {
  const f = getFilters();

  const dDesde = f.desde ? parseRowDate(f.desde) : null;
  const tDesde = dDesde ? dDesde.setHours(0, 0, 0, 0) : 0;

  const dHasta = f.hasta ? parseRowDate(f.hasta) : null;
  const tHasta = dHasta ? dHasta.setHours(23, 59, 59, 999) : 0;

  const selCanal = f.canal ? f.canal.toLowerCase() : '';
  const selTienda = f.tienda ? f.tienda.toLowerCase() : '';
  const selVendedor = f.vendedor ? f.vendedor.toLowerCase() : '';
  const selFamilia = f.familia ? f.familia.toLowerCase() : '';
  const selCategoria = f.categoria ? f.categoria.toLowerCase() : '';
  const selRegion = f.region ? f.region.toLowerCase() : '';
  const qSearch = f.search ? f.search.toLowerCase() : '';

  filtered = rows.filter(r => {
    if (!r) return false;
    if (tDesde > 0 && (r._time < tDesde || !r._time)) return false;
    if (tHasta > 0 && (r._time > tHasta || !r._time)) return false;
    if (selCanal && r._canal !== selCanal) return false;
    if (selTienda && r._tienda !== selTienda) return false;
    if (selVendedor && r._vendedor !== selVendedor) return false;
    if (selFamilia && r._familia !== selFamilia) return false;
    if (selCategoria && r._categoria !== selCategoria) return false;
    if (selRegion && r._region !== selRegion) return false;
    if (qSearch && !r._searchHaystack.includes(qSearch)) return false;
    return true;
  });

  if (currentSortField) {
    filtered.sort((a, b) => {
      let valA = a[currentSortField];
      let valB = b[currentSortField];
      if (['NETO', '($) UTILIDAD', 'CANTFACTURADA', 'PREUNI', 'COSTOS'].includes(currentSortField)) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (currentSortField === 'FECHA') {
        valA = a._time || 0;
        valB = b._time || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }
      if (valA < valB) return currentSortAsc ? -1 : 1;
      if (valA > valB) return currentSortAsc ? 1 : -1;
      return 0;
    });
  }

  currentPage = 1;
  comprasCurrentPage = 1;
  renderActiveFilterChips();
  renderAll();
}

function renderActiveFilterChips() {
  const chipsContainer = document.getElementById('activeFilterChips');
  if (!chipsContainer) return;

  const f = getFilters();
  const activeChips = [];

  if (f.desde || f.hasta) {
    activeChips.push({
      label: `Periodo: ${f.desde || 'Inicio'} → ${f.hasta || 'Hoy'}`,
      clear: () => {
        const d = document.getElementById('fltDesde'); if (d) d.value = '';
        const h = document.getElementById('fltHasta'); if (h) h.value = '';
        document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
      }
    });
  }

  const filterMap = [
    { id: 'fltCanal', name: 'Canal' },
    { id: 'fltTienda', name: 'Tienda' },
    { id: 'fltVendedor', name: 'Vendedor' },
    { id: 'fltFamilia', name: 'Familia' },
    { id: 'fltCategoria', name: 'Categoría' },
    { id: 'fltRegion', name: 'Región' }
  ];

  filterMap.forEach(item => {
    const el = document.getElementById(item.id);
    if (el && el.value) {
      activeChips.push({
        label: `${item.name}: ${el.value}`,
        clear: () => { el.value = ''; }
      });
    }
  });

  if (activeChips.length === 0) {
    chipsContainer.style.display = 'none';
    chipsContainer.innerHTML = '';
    return;
  }

  chipsContainer.style.display = 'flex';
  chipsContainer.innerHTML = `<span class="chips-label">Filtros Activos:</span>` +
    activeChips.map((chip, idx) => `
      <span class="filter-chip">
        <span>${chip.label}</span>
        <button type="button" class="chip-remove-btn" onclick="clearSingleFilter(${idx})" title="Eliminar este filtro">✕</button>
      </span>
    `).join('');

  window._activeFilterChipsList = activeChips;
}

window.clearSingleFilter = function(index) {
  if (window._activeFilterChipsList && window._activeFilterChipsList[index]) {
    window._activeFilterChipsList[index].clear();
    applyFilters();
  }
};

function getComprasProducts() {
  const map = new Map();
  const source = Array.isArray(filtered) && filtered.length > 0 ? filtered : (rows || []);

  source.forEach((r, idx) => {
    if (!r) return;
    const codeRaw = String(r['CODIGO'] || r['Codigo'] || r['SKU'] || '').trim();
    const descRaw = String(r['DESCRIPCION'] || r['Descripcion'] || r['GLOSA'] || '').trim();

    if (!codeRaw && !descRaw) return;

    const code = codeRaw ? codeRaw.toUpperCase() : descRaw.toUpperCase();
    const desc = descRaw || code;
    const familia = String(r['FAMILIA'] || r['Familia'] || r['GRUPO'] || 'General').trim();
    const categoria = String(r['CATEGORIA'] || r['Categoria'] || r['LINEA'] || 'General').trim();

    const cant = parseNumberClean(r['CANTFACTURADA']);
    const preuni = parseNumberClean(r['PREUNI']);
    const costoUnit = parseNumberClean(r['COSTOS']);
    const neto = parseNumberClean(r['NETO']);

    let costoTotalNet = r['COSTO TOTAL NET'] !== undefined && r['COSTO TOTAL NET'] !== '' ? parseNumberClean(r['COSTO TOTAL NET']) : (cant * costoUnit);
    let utilidad = r['($) UTILIDAD'] !== undefined && r['($) UTILIDAD'] !== '' ? parseNumberClean(r['($) UTILIDAD']) : (neto - costoTotalNet);

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
    if (famSelect.options.length <= 1 || famSelect.dataset.famCount !== String(familias.length)) {
      famSelect.innerHTML = `<option value="">Todas las Familias</option>` +
        familias.map(f => `<option value="${f}">${f}</option>`).join('');
      famSelect.dataset.famCount = String(familias.length);
    }
    if (currentFam && familias.includes(currentFam)) famSelect.value = currentFam;
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
    if (p.costoTotalNet > 0) {
      famMap[p.familia] = (famMap[p.familia] || 0) + p.costoTotalNet;
    }
  });

  const famList = Object.entries(famMap).sort((a, b) => b[1] - a[1]);
  const famBreakdownEl = document.getElementById('comprasFamilyBreakdown');
  if (famBreakdownEl) {
    if (!famList.length) {
      famBreakdownEl.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--ax-text-tertiary);">Sin inversión de costo en familias</p>`;
    } else {
      const colors = [
        'linear-gradient(90deg, #3b82f6, #6366f1)',
        'linear-gradient(90deg, #8b5cf6, #ec4899)',
        'linear-gradient(90deg, #10b981, #06b6d4)',
        'linear-gradient(90deg, #f59e0b, #ef4444)',
        'linear-gradient(90deg, #6366f1, #a855f7)',
        'linear-gradient(90deg, #06b6d4, #3b82f6)',
        'linear-gradient(90deg, #10b981, #84cc16)',
        'linear-gradient(90deg, #f43f5e, #fb7185)'
      ];

      famBreakdownEl.innerHTML = famList.map(([famName, famCost], idx) => {
        const pct = totalCostos > 0 ? (famCost / totalCostos) * 100 : 0;
        const grad = colors[idx % colors.length];
        const rankClass = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
        
        return `
          <div class="compras-breakdown-item">
            <div class="compras-breakdown-header">
              <div class="compras-item-left">
                <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                <span class="fam-name-title">${famName}</span>
              </div>
              <div class="compras-item-right">
                <span class="fam-cost-val">${fmtCLP(famCost)}</span>
                <span class="pct-badge-pill">${pct.toFixed(1)}%</span>
              </div>
            </div>
            <div class="compras-breakdown-bar">
              <div class="compras-breakdown-fill" style="width: ${Math.max(pct, 2)}%; background: ${grad};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const top10Cost = [...filteredProducts].filter(p => p.costoTotalNet > 0).sort((a, b) => b.costoTotalNet - a.costoTotalNet).slice(0, 10);
  const maxTopCost = top10Cost.length > 0 ? top10Cost[0].costoTotalNet : 1;
  const topCostEl = document.getElementById('comprasTopCostProducts');
  if (topCostEl) {
    if (!top10Cost.length) {
      topCostEl.innerHTML = `<p style="text-align:center; padding: 2rem; color:var(--ax-text-tertiary);">Sin productos con costo en el período</p>`;
    } else {
      topCostEl.innerHTML = top10Cost.map((p, idx) => {
        const pct = maxTopCost > 0 ? (p.costoTotalNet / maxTopCost) * 100 : 0;
        const rankClass = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
        let cleanDesc = p.descripcion;
        if (cleanDesc.startsWith(p.codigo)) {
          cleanDesc = cleanDesc.slice(p.codigo.length).trim();
        }

        return `
          <div class="compras-breakdown-item">
            <div class="compras-breakdown-header">
              <div class="compras-item-left">
                <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                <span class="sku-badge-pill">${p.codigo}</span>
                <span class="product-name-title" title="${p.descripcion}">${cleanDesc || p.descripcion}</span>
              </div>
              <div class="compras-item-right">
                <span class="product-cost-val">${fmtCLP(p.costoTotalNet)}</span>
              </div>
            </div>
            <div class="compras-breakdown-bar">
              <div class="compras-breakdown-fill bar-coral" style="width: ${Math.max(pct, 3)}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Invocar motor BI Asistente de Inversión
  renderComprasBIAdvisor();
}


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

  // Cálculo de meses proyectados para retorno de inversión (Payback Period)
  let totalMonths = 6;
  if (rows && rows.length > 0) {
    let minTime = Infinity, maxTime = -Infinity;
    rows.forEach(r => {
      if (r._time) {
        if (r._time < minTime) minTime = r._time;
        if (r._time > maxTime) maxTime = r._time;
      }
    });
    if (minTime < maxTime) {
      const days = (maxTime - minTime) / (1000 * 60 * 60 * 24);
      totalMonths = Math.max(1, days / 30.4);
    }
  }

  let basketMonthlyProfit = 0;
  basket.forEach(b => {
    const historicalMonthlyQty = Math.max(1, (b.cantTotal || 0) / totalMonths);
    const itemMonthlyProfit = historicalMonthlyQty * (b.preuni - b.costoUnit);
    basketMonthlyProfit += itemMonthlyProfit;
  });

  let paybackMonths = 0;
  if (basketMonthlyProfit > 0 && totalAllocatedCost > 0) {
    paybackMonths = totalAllocatedCost / basketMonthlyProfit;
  } else if (totalExpectedProfit > 0 && totalAllocatedCost > 0) {
    paybackMonths = totalAllocatedCost / (totalExpectedProfit / totalMonths);
  }

  const allocCostEl = document.getElementById('projAllocatedCost');
  const expRevEl = document.getElementById('projExpectedRevenue');
  const expProfEl = document.getElementById('projExpectedProfit');
  const expMargEl = document.getElementById('projExpectedMargin');
  const payMonthsEl = document.getElementById('projPaybackMonths');
  const skuBadgeEl = document.getElementById('advisorSkuCountBadge');

  const fmtCLP = (v) => '$' + Math.round(Number(v)||0).toLocaleString('es-CL');

  if (allocCostEl) allocCostEl.textContent = fmtCLP(totalAllocatedCost);
  if (expRevEl) expRevEl.textContent = fmtCLP(totalExpectedRevenue);
  if (expProfEl) expProfEl.textContent = fmtCLP(totalExpectedProfit);
  if (expMargEl) expMargEl.textContent = `${expectedMarginPct.toFixed(1)}% ROI`;

  if (payMonthsEl) {
    if (paybackMonths <= 0) {
      payMonthsEl.textContent = '0 Meses';
    } else if (paybackMonths < 1) {
      const days = Math.round(paybackMonths * 30);
      payMonthsEl.textContent = `${paybackMonths.toFixed(1)} Meses (~${days}d)`;
    } else {
      payMonthsEl.textContent = `${paybackMonths.toFixed(1)} Meses`;
    }
  }

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
          <tr class="advisor-row">
            <td style="text-align:left;"><span class="sku-badge-pill">${b.codigo}</span></td>
            <td style="text-align:left;"><strong style="color:var(--ax-text-primary); font-size:0.86rem;">${b.descripcion}</strong></td>
            <td style="text-align:left;"><span class="tag-pill">${b.familia || 'General'}</span></td>
            <td style="text-align:right;" class="num-cell">${fmtCLP(b.costoUnit)}</td>
            <td style="text-align:right;" class="num-cell">${fmtCLP(b.preuni)}</td>
            <td style="text-align:center;"><span class="badge ${b.margenPct >= 30 ? 'badge-green' : 'badge-amber'}">${b.margenPct.toFixed(1)}%</span></td>
            <td style="text-align:center;"><span class="suggested-units-pill">+${b.suggestedUnits} un.</span></td>
            <td style="text-align:right;" class="num-cell investment-cost-cell">${fmtCLP(b.allocatedCost)}</td>
            <td style="text-align:right;"><span class="expected-profit-badge">+${fmtCLP(b.expectedProfit)}</span></td>
            <td style="text-align:center;"><span class="badge ${tagClass}">${tagText}</span></td>
          </tr>
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
    comprasCurrentPage = 1;
    renderComprasView();
  };


document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {

  btn.addEventListener('click', () => {

    const preset = btn.dataset.preset;

    applyDatePreset(preset);

  });

});

function formatLocalYMD(d) {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function applyDatePreset(preset) {

  const today = getReferenceDate();

  let desde = '', hasta = '';

  if (preset === 'today') {

    desde = formatLocalYMD(today);

    hasta = desde;

  } else if (preset === '7days') {

    const past = new Date(today.getTime() - 6 * 86400000);

    desde = formatLocalYMD(past);

    hasta = formatLocalYMD(today);

  } else if (preset === 'thisMonth') {

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    desde = formatLocalYMD(firstDay);

    hasta = formatLocalYMD(today);

  } else if (preset === 'thisYear') {

    const firstDay = new Date(today.getFullYear(), 0, 1);

    desde = formatLocalYMD(firstDay);

    hasta = formatLocalYMD(today);

  } else if (preset === 'all') {

    desde = '';

    hasta = '';

  }

  document.getElementById('fltDesde').value = desde;

  document.getElementById('fltHasta').value = hasta;

  document.querySelectorAll('.preset-btn[data-preset]').forEach(b => {

    b.classList.toggle('active', b.dataset.preset === preset);

  });

  applyFilters();

}

['fltDesde', 'fltHasta', 'fltCanal', 'fltTienda', 'fltVendedor', 'fltFamilia', 'fltCategoria', 'fltRegion'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    ['change', 'input'].forEach(evt => {
      el.addEventListener(evt, () => {
        document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
        applyFilters();
      });
    });
  }
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  ['fltDesde', 'fltHasta', 'fltCanal', 'fltTienda', 'fltVendedor', 'fltFamilia', 'fltCategoria', 'fltRegion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));

  const yearBtn = document.querySelector('.preset-btn[data-preset="thisYear"]');

  if (yearBtn) yearBtn.classList.add('active');

  const sb = document.getElementById('searchBox');

  if (sb) sb.value = '';

  applyFilters();

});

// ---------- Render orquestador ----------

let monthlyTargetGoal = 100000000; // 100 Millones CLP meta por defecto

function renderAll() {
  try { renderTicker(); } catch (e) {}
  try { renderTodayCard(); } catch (e) {}
  try { renderMonthlyTargetProgress(); } catch (e) {}
  try { renderMiniKPIs(); } catch (e) {}

  const activeViewEl = document.querySelector('.view.active');
  const activeViewId = activeViewEl ? activeViewEl.id : 'view-tablero';

  if (activeViewId === 'view-tablero') {
    try { renderKPIs(); } catch (e) { console.error('renderKPIs err:', e); }
    try { renderCharts(); } catch (e) { console.error('renderCharts err:', e); }
  } else if (activeViewId === 'view-tabla') {
    try { renderTable(); } catch (e) { console.error('renderTable err:', e); }
  } else if (activeViewId === 'view-compras') {
    try { renderComprasView(); } catch (e) { console.error('renderComprasView err:', e); }
  } else if (activeViewId === 'view-bistudio') {
    try { renderBIEngine(); } catch (e) { console.error('renderBIEngine err:', e); }
  }
}

function getReferenceDate() {
  if (typeof getFilters === 'function') {
    const f = getFilters();
    if (f && f.hasta) {
      const dHasta = parseRowDate(f.hasta);
      if (dHasta) return dHasta;
    }
    if (f && f.desde) {
      const dDesde = parseRowDate(f.desde);
      if (dDesde) return dDesde;
    }
  }
  const now = new Date();
  let maxDate = null;
  if (rows && rows.length > 0) {
    for (let i = 0; i < rows.length; i++) {
      const d = parseRowDate(rows[i]['FECHA']);
      if (d && (!maxDate || d > maxDate)) maxDate = d;
    }
  }
  if (!maxDate || now >= maxDate) return now;
  return maxDate;
}

// Configuración de Metas Mensuales (Enero a Diciembre)

const TARGET_MONTH_KEYS = [

  'targetEnero', 'targetFebrero', 'targetMarzo', 'targetAbril',

  'targetMayo', 'targetJunio', 'targetJulio', 'targetAgosto',

  'targetSeptiembre', 'targetOctubre', 'targetNoviembre', 'targetDiciembre'

];

const TARGET_MONTH_NAMES = [

  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',

  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'

];

let monthlyTargets = JSON.parse(localStorage.getItem('glomax_monthly_targets') || 'null') || {

  0: 100000000, 1: 100000000, 2: 100000000, 3: 100000000,

  4: 100000000, 5: 100000000, 6: 100000000, 7: 100000000,

  8: 100000000, 9: 100000000, 10: 100000000, 11: 100000000

};

// 1. BARRA DE META DE VENTAS DEL MES (MTD GAUGE)

function renderMonthlyTargetProgress() {

  const fillEl = document.getElementById('targetProgressFill');

  const actualEl = document.getElementById('targetActualText');

  const goalEl = document.getElementById('targetGoalText');

  const pctEl = document.getElementById('targetPctBadge');

  const subEl = document.getElementById('targetProgressSub');

  if (!fillEl || !actualEl || !goalEl) return;

  const now = getReferenceDate();

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

// Panel Inline de Configuración de Metas (Enero - Diciembre)

window.toggleTargetSettingsPanel = function(state) {

  const panel = document.getElementById('targetSettingsPanel');

  if (!panel) return;

  const isVisible = state !== undefined ? state : (panel.style.display === 'none' || !panel.style.display);

  panel.style.display = isVisible ? 'block' : 'none';

  if (isVisible) {

    for (let i = 0; i < 12; i++) {

      const input = document.getElementById(`inTarget${i}`);

      if (input) input.value = monthlyTargets[i] || 100000000;

    }

  }

};

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

// Modal secundario de Configuración de Metas (Fallback)

window.openTargetModal = function() { window.toggleTargetSettingsPanel(true); };

window.closeTargetModal = function() { window.toggleTargetSettingsPanel(false); };

function openTargetModal() { window.openTargetModal(); }

function closeTargetModal() { window.closeTargetModal(); }

// 2. 4 MINI KPIS CLAVE

function renderMiniKPIs() {

  const ticketVal = document.getElementById('miniTicketVal');

  const marginVal = document.getElementById('miniMarginVal');

  const sellerVal = document.getElementById('miniTopSellerVal');

  const sellerSub = document.getElementById('miniTopSellerSub');

  const regionVal = document.getElementById('miniTopRegionVal');

  const regionSub = document.getElementById('miniTopRegionSub');

  if (!filtered || !filtered.length) return;

  const totalRev = filtered.reduce((sum, r) => sum + (Number(r['NETO']) || 0), 0);

  const totalProfit = filtered.reduce((sum, r) => sum + (Number(r['($) UTILIDAD']) || 0), 0);

  // Ticket Promedio

  const avgTicket = filtered.length > 0 ? totalRev / filtered.length : 0;

  if (ticketVal) ticketVal.textContent = formatCLP(avgTicket);

  // Margen Utilidad Promedio

  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

  if (marginVal) marginVal.textContent = `${avgMargin.toFixed(1)}%`;

  // Top Vendedor

  const sellerMap = {};

  filtered.forEach(r => {

    const s = r['CODVENDENDOR'] || 'N/A';

    sellerMap[s] = (sellerMap[s] || 0) + (Number(r['NETO']) || 0);

  });

  const topSeller = Object.entries(sellerMap).sort((a, b) => b[1] - a[1])[0];

  if (sellerVal && topSeller) {

    sellerVal.textContent = topSeller[0];

    if (sellerSub) sellerSub.textContent = `${formatCLP(topSeller[1])} facturado`;

  }

  // Top Región

  const regionMap = {};

  filtered.forEach(r => {

    const reg = r['REGION'] || 'Sin Región';

    regionMap[reg] = (regionMap[reg] || 0) + (Number(r['NETO']) || 0);

  });

  const topRegion = Object.entries(regionMap).sort((a, b) => b[1] - a[1])[0];

  if (regionVal && topRegion) {

    regionVal.textContent = topRegion[0];

    if (regionSub) regionSub.textContent = `${formatCLP(topRegion[1])} acumulado`;

  }

}

// 3. MODO PRESENTACIÓN EJECUTIVA

document.getElementById('presentationModeBtn')?.addEventListener('click', () => {

  document.body.classList.toggle('presentation-mode');

  const isPres = document.body.classList.contains('presentation-mode');

  showToast(isPres ? 'Modo Presentación Ejecutiva activado (ESC para salir)' : 'Modo Presentación desactivado');

});

document.addEventListener('keydown', (e) => {

  if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {

    document.body.classList.remove('presentation-mode');

    showToast('Modo Presentación desactivado');

  }

});

// 4. ACCIONES EN GRÁFICOS (EXPORTAR PNG & TIPO)

document.addEventListener('click', (e) => {

  const btn = e.target.closest('.chart-action-btn');

  if (!btn) return;

  const chartId = btn.dataset.chart;

  const action = btn.dataset.action;

  if (action === 'export-png') {

    const canvas = document.getElementById(chartId);

    if (canvas) {

      const link = document.createElement('a');

      link.download = `${chartId}_glomax.png`;

      link.href = canvas.toDataURL('image/png');

      link.click();

      showToast('📷 Gráfico exportado en alta resolución PNG');

    }

  } else if (action === 'toggle-type') {

    if (typeof charts !== 'undefined' && charts[chartId]) {

      const currentType = charts[chartId].config.type;

      charts[chartId].config.type = currentType === 'bar' ? 'line' : 'bar';

      charts[chartId].update();

      showToast(`Tipo de gráfico cambiado a ${charts[chartId].config.type.toUpperCase()}`);

    }

  }

});

// 5. DENSIDAD DE TABLA

let isCompactTable = false;

document.getElementById('densityToggleBtn')?.addEventListener('click', () => {

  isCompactTable = !isCompactTable;

  document.querySelector('.data-table')?.classList.toggle('table-compact', isCompactTable);

  showToast(isCompactTable ? 'Vista compacta de tabla activada' : 'Vista cómoda de tabla activada');

});

// ---------- GLOMAX BUSINESS INTELLIGENCE (BI) SUITE ----------

function renderBIEngine() {

  renderExecutiveInsights();

  renderPareto8020();

  renderRFMGrid();

  updateWhatIfSimulation();

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

  const now = getReferenceDate();

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

const resetSimBtn = document.getElementById('resetSimBtn');

if (resetSimBtn) {

  resetSimBtn.addEventListener('click', () => {

    ['simPriceRange', 'simCostRange', 'simVolRange'].forEach(id => {

      const el = document.getElementById(id);

      if (el) el.value = 0;

    });

    updateWhatIfSimulation();

    AudioSynth.play('click');

  });

}

['simPriceRange', 'simCostRange', 'simVolRange'].forEach(id => {

  const el = document.getElementById(id);

  if (el) el.addEventListener('input', updateWhatIfSimulation);

});

// ---------- GLOMAX AI PREDICTIVE ENGINE ----------

function renderAIEngine() {

  const forecastEl = document.getElementById('aiForecastValue');

  const trendEl = document.getElementById('aiTrendValue');

  const anomalyEl = document.getElementById('aiAnomalyValue');

  if (!forecastEl || !filtered.length) return;

  const now = new Date();

  const currentMonth = now.getMonth();

  const currentYear = now.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const dayOfMonth = now.getDate();

  const thisMonthRows = filtered.filter(r => {

    const d = parseRowDate(r['FECHA']);

    return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;

  });

  const monthTotal = thisMonthRows.reduce((sum, r) => sum + (Number(r['NETO']) || 0), 0);

  if (dayOfMonth > 0 && monthTotal > 0) {

    const dailyRate = monthTotal / dayOfMonth;

    const projectedTotal = dailyRate * daysInMonth;

    forecastEl.textContent = formatCLP(projectedTotal);

    trendEl.textContent = `🚀 ${formatCLP(dailyRate)}/día (Ritmo actual)`;

  } else {

    forecastEl.textContent = formatCLP(filtered.reduce((sum, r) => sum + (Number(r['NETO']) || 0), 0));

    trendEl.textContent = `⚡ Ritmo constante`;

  }

  const lowMarginRows = filtered.filter(r => {

    const neto = Number(r['NETO']) || 0;

    const ut = Number(r['($) UTILIDAD']) || 0;

    return neto > 0 && (ut / neto) < 0.05;

  });

  if (lowMarginRows.length > 0) {

    anomalyEl.innerHTML = `<span style="color:var(--ax-accent-rose); font-weight:700;">⚠️ ${lowMarginRows.length} ventas con margen baja (<5%)</span>`;

  } else {

    anomalyEl.innerHTML = `<span style="color:var(--ax-accent-emerald); font-weight:600;">✅ Operación saludable (0 alertas)</span>`;

  }

}

// ---------- Ticker ----------

function renderTicker() {

  const totalNeto = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalUtilidad = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);

  const unidades = filtered.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const folios = new Set(filtered.map(r => r['FOLIO'])).size;

  const items = [

    `VENTA NETA <span class="ticker-val">${formatCLP(totalNeto)}</span>`,

    `UTILIDAD <span class="ticker-val">${formatCLP(totalUtilidad)}</span>`,

    `UNIDADES <span class="ticker-val">${formatNum(unidades)}</span>`,

    `DOCUMENTOS <span class="ticker-val">${formatNum(folios)}</span>`

  ];

  const track = document.getElementById('tickerTrack');

  if (!track) return;

  const sep = '<span style="opacity:0.3; margin: 0 0.5rem;">❖</span>';

  const html = items.map(i => `<span>${i}</span>`).join(sep);

  track.innerHTML = html + sep + html;

}

// ---------- Venta del día ----------

function isSameDay(value, ref) {

  const d = new Date(value);

  if (isNaN(d.getTime())) return false;

  return d.getFullYear() === ref.getFullYear() &&

    d.getMonth() === ref.getMonth() &&

    d.getDate() === ref.getDate();

}

function formatHeroTrend(current, prev, labelPrev) {

  if (!prev || prev === 0) {

    if (current > 0) return `<span class="hero-compare-badge up">▲ +100% vs ${labelPrev}</span>`;

    return `<span class="hero-compare-badge">-- vs ${labelPrev}</span>`;

  }

  const pct = ((current - prev) / prev) * 100;

  const isUp = pct >= 0;

  const sign = isUp ? '▲ +' : '▼ ';

  const cls = isUp ? 'up' : 'down';

  return `<span class="hero-compare-badge ${cls}">${sign}${pct.toFixed(1)}% vs ${labelPrev} (${formatCLP(prev)})</span>`;

}

function calcMarginPercent(rowSet) {

  const totalNeto = rowSet.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  if (!totalNeto) return 0;

  const totalUtil = rowSet.reduce((a, r) => {

    let u = Number(r['($) UTILIDAD']) || Number(r['UTILIDAD']) || Number(r['MARGEN']) || 0;

    if (!u && r['COSTO'] !== undefined) {

      u = (Number(r['NETO']) || 0) - (Number(r['COSTO']) || 0);

    }

    return a + u;

  }, 0);

  return (totalUtil / totalNeto) * 100;

}

function formatMarginPair(mCurr, mPrev, yearCurr, yearPrev) {

  const cStr = mCurr.toFixed(1) + '%';

  const pStr = mPrev.toFixed(1) + '%';

  const diff = mCurr - mPrev;

  const isUp = diff >= 0;

  const color = isUp ? '#10B981' : '#F43F5E';

  const symbol = isUp ? '▲' : '▼';

  return ` · <span style="font-weight:600; color:var(--ax-text-secondary);">Margen:</span> <span style="color:${color}; font-weight:700;">${cStr} ${yearCurr}</span> <span style="opacity:0.75;">(vs ${pStr} ${yearPrev} ${symbol})</span>`;

}

const valueAnimState = {};

function animateCLPValue(elementId, targetValue, durationMs = 500) {

  const el = document.getElementById(elementId);

  if (!el) return;

  const startValue = valueAnimState[elementId] || 0;

  valueAnimState[elementId] = targetValue;

  if (startValue === targetValue || durationMs <= 0) {

    el.textContent = formatCLP(targetValue);

    return;

  }

  const startTime = performance.now();

  function update(now) {

    const elapsed = now - startTime;

    const progress = Math.min(1, elapsed / durationMs);

    const easeOut = 1 - Math.pow(1 - progress, 3);

    const currentValue = startValue + (targetValue - startValue) * easeOut;

    el.textContent = formatCLP(currentValue);

    if (progress < 1) {

      requestAnimationFrame(update);

    } else {

      el.textContent = formatCLP(targetValue);

    }

  }

  requestAnimationFrame(update);

}

function renderTodayCard() {

  const f = getFilters();

  const hoy = getReferenceDate();

  const currentYear = hoy.getFullYear();

  const prevYear = currentYear - 1;

  const currentMonth = hoy.getMonth();

  const currentDay = hoy.getDate();

  const hoyPrevYear = new Date(hoy);

  hoyPrevYear.setFullYear(prevYear);

  function matchFilters(r) {
    if (!r) return false;
    if (f.canal && cleanValStr(r['CANAL FINAL'] || r['Canal Final']).toLowerCase() !== cleanValStr(f.canal).toLowerCase()) return false;
    if (f.tienda && cleanValStr(r['TIENDA FINAL'] || r['Tienda Final']).toLowerCase() !== cleanValStr(f.tienda).toLowerCase()) return false;
    if (f.vendedor && cleanValStr(r['CODVENDENDOR'] || r['CODVENDEDOR'] || r['CodVendedor']).toLowerCase() !== cleanValStr(f.vendedor).toLowerCase()) return false;
    if (f.familia && cleanValStr(r['FAMILIA'] || r['Familia'] || r['GRUPO']).toLowerCase() !== cleanValStr(f.familia).toLowerCase()) return false;
    if (f.categoria && cleanValStr(r['CATEGORIA'] || r['Categoria'] || r['LINEA']).toLowerCase() !== cleanValStr(f.categoria).toLowerCase()) return false;
    if (f.region && cleanValStr(r['REGION'] || r['Region']).toLowerCase() !== cleanValStr(f.region).toLowerCase()) return false;
    return true;
  }

  // 1. DÍA (HOY vs MISMO DÍA AÑO ANTERIOR)

  const rowsHoy = rows.filter(r => isSameDay(r['FECHA'], hoy) && matchFilters(r));

  const rowsHoyPrev = rows.filter(r => isSameDay(r['FECHA'], hoyPrevYear) && matchFilters(r));

  const totalHoy = rowsHoy.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalHoyPrev = rowsHoyPrev.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const docsHoy = new Set(rowsHoy.map(r => r['FOLIO'])).size;

  const unidadesHoy = rowsHoy.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const marginHoyCurr = calcMarginPercent(rowsHoy);

  const marginHoyPrev = calcMarginPercent(rowsHoyPrev);

  const elTodayDate = document.getElementById('todayDateLabel');

  if (elTodayDate) elTodayDate.textContent = hoy.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

  animateCLPValue('todayValue', totalHoy);

  const elTodayComp = document.getElementById('todayCompare');

  if (elTodayComp) elTodayComp.innerHTML = formatHeroTrend(totalHoy, totalHoyPrev, `mismo día ${prevYear}`);

  const elTodaySub = document.getElementById('todaySub');

  if (elTodaySub) elTodaySub.innerHTML = `${formatNum(docsHoy)} docs · ${formatNum(unidadesHoy)} u.` + formatMarginPair(marginHoyCurr, marginHoyPrev, currentYear, prevYear);

  // 2. MES ACUMULADO (MTD - Month To Date)

  const rowsMes = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && matchFilters(r);

  });

  const rowsMesPrev = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    return d.getFullYear() === prevYear && d.getMonth() === currentMonth && d.getDate() <= currentDay && matchFilters(r);

  });

  const totalMes = rowsMes.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalMesPrev = rowsMesPrev.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const docsMes = new Set(rowsMes.map(r => r['FOLIO'])).size;

  const unidadesMes = rowsMes.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const marginMesCurr = calcMarginPercent(rowsMes);

  const marginMesPrev = calcMarginPercent(rowsMesPrev);

  const monthNameStr = hoy.toLocaleDateString('es-CL', { month: 'long' });

  const monthShortName = hoy.toLocaleDateString('es-CL', { month: 'short' });

  const elMonthDate = document.getElementById('monthDateLabel');

  if (elMonthDate) elMonthDate.textContent = `1 al ${currentDay} ${monthNameStr}`;

  animateCLPValue('monthValue', totalMes);

  const elMonthComp = document.getElementById('monthCompare');

  if (elMonthComp) elMonthComp.innerHTML = formatHeroTrend(totalMes, totalMesPrev, `MTD ${prevYear} (al ${currentDay} ${monthShortName})`);

  const elMonthSub = document.getElementById('monthSub');

  if (elMonthSub) elMonthSub.innerHTML = `${formatNum(docsMes)} docs · ${formatNum(unidadesMes)} u.` + formatMarginPair(marginMesCurr, marginMesPrev, currentYear, prevYear);

  // 3. AÑO ACUMULADO (YTD - Year To Date)

  const rowsAño = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    return d.getFullYear() === currentYear && matchFilters(r);

  });

  const rowsAñoPrev = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    if (d.getFullYear() !== prevYear) return false;

    if (d.getMonth() < currentMonth) return matchFilters(r);

    if (d.getMonth() === currentMonth && d.getDate() <= currentDay) return matchFilters(r);

    return false;

  });

  const totalAño = rowsAño.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalAñoPrev = rowsAñoPrev.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const docsAño = new Set(rowsAño.map(r => r['FOLIO'])).size;

  const unidadesAño = rowsAño.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const marginAñoCurr = calcMarginPercent(rowsAño);

  const marginAñoPrev = calcMarginPercent(rowsAñoPrev);

  const elYearDate = document.getElementById('yearDateLabel');

  if (elYearDate) elYearDate.textContent = `Al ${currentDay} ${monthShortName} ${currentYear}`;

  animateCLPValue('yearValue', totalAño);

  const elYearComp = document.getElementById('yearCompare');

  if (elYearComp) elYearComp.innerHTML = formatHeroTrend(totalAño, totalAñoPrev, `YTD ${prevYear} (al ${currentDay} ${monthShortName})`);

  const elYearSub = document.getElementById('yearSub');

  if (elYearSub) elYearSub.innerHTML = `${formatNum(docsAño)} docs · ${formatNum(unidadesAño)} u.` + formatMarginPair(marginAñoCurr, marginAñoPrev, currentYear, prevYear);

  // 4. PROYECCIONES DE CIERRE (DÍA, MES Y AÑO vs AÑO COMPLETO ANTERIOR)

  // Proyección Día

  const currentHour = hoy.getHours() + (hoy.getMinutes() / 60);

  const projRatioHoy = currentHour > 6 ? 24 / currentHour : 1;

  const projectedHoy = totalHoy * projRatioHoy;

  const elTodayProjDate = document.getElementById('todayProjDateLabel');

  if (elTodayProjDate) elTodayProjDate.textContent = `Cierre ${currentDay} ${monthShortName}`;

  animateCLPValue('todayProjValue', projectedHoy);

  const elTodayProjComp = document.getElementById('todayProjCompare');

  if (elTodayProjComp) elTodayProjComp.innerHTML = formatHeroTrend(projectedHoy, totalHoyPrev, `día ${prevYear}`);

  const elTodayProjSub = document.getElementById('todayProjSub');

  if (elTodayProjSub) elTodayProjSub.innerHTML = `Ritmo: ${formatCLP(currentHour > 0 ? totalHoy / currentHour : totalHoy)}/hr` + formatMarginPair(marginHoyCurr, marginHoyPrev, currentYear, prevYear);

  // Proyección Mes

  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const dailyRateMes = currentDay > 0 ? totalMes / currentDay : 0;

  const projectedMes = dailyRateMes * totalDaysInMonth;

  const rowsMesPrevFull = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    return d.getFullYear() === prevYear && d.getMonth() === currentMonth && matchFilters(r);

  });

  const totalMesPrevFull = rowsMesPrevFull.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const marginMesPrevFull = calcMarginPercent(rowsMesPrevFull);

  const elMonthProjDate = document.getElementById('monthProjDateLabel');

  if (elMonthProjDate) elMonthProjDate.textContent = `Cierre 31 ${monthShortName}`;

  animateCLPValue('monthProjValue', projectedMes);

  const elMonthProjComp = document.getElementById('monthProjCompare');

  if (elMonthProjComp) elMonthProjComp.innerHTML = formatHeroTrend(projectedMes, totalMesPrevFull, `mes completo ${prevYear}`);

  const elMonthProjSub = document.getElementById('monthProjSub');

  if (elMonthProjSub) elMonthProjSub.innerHTML = `${formatCLP(dailyRateMes)}/día · ${totalDaysInMonth - currentDay} días rest.` + formatMarginPair(marginMesCurr, marginMesPrevFull, currentYear, prevYear);

  // Proyección Año

  const startOfYear = new Date(currentYear, 0, 1);

  const dayOfYear = Math.max(1, Math.ceil((hoy - startOfYear) / (1000 * 60 * 60 * 24)));

  const dailyRateAño = totalAño / dayOfYear;

  const projectedAño = dailyRateAño * 365;

  const rowsAñoPrevFull = rows.filter(r => {

    const d = parseRowDate(r['FECHA']);

    if (!d) return false;

    return d.getFullYear() === prevYear && matchFilters(r);

  });

  const totalAñoPrevFull = rowsAñoPrevFull.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const marginAñoPrevFull = calcMarginPercent(rowsAñoPrevFull);

  const elYearProjDate = document.getElementById('yearProjDateLabel');

  if (elYearProjDate) elYearProjDate.textContent = `Cierre 31 Dic ${currentYear}`;

  animateCLPValue('yearProjValue', projectedAño);

  const elYearProjComp = document.getElementById('yearProjCompare');

  if (elYearProjComp) elYearProjComp.innerHTML = formatHeroTrend(projectedAño, totalAñoPrevFull, `año completo ${prevYear}`);

  const elYearProjSub = document.getElementById('yearProjSub');

  if (elYearProjSub) elYearProjSub.innerHTML = `${formatCLP(dailyRateAño)}/día · ${365 - dayOfYear} días rest.` + formatMarginPair(marginAñoCurr, marginAñoPrevFull, currentYear, prevYear);

}

// ---------- Insights Widget ----------

function renderInsights() {

  const elCliente = document.getElementById('insTopCliente');

  const elFamilia = document.getElementById('insTopFamilia');

  const elCategoria = document.getElementById('insTopCategoria');

  const elDia = document.getElementById('insTopDia');

  const elMargen = document.getElementById('insMargenProm');

  if (!elCliente) return;

  if (!filtered.length) {

    elCliente.textContent = '-';

    elFamilia.textContent = '-';

    if (elCategoria) elCategoria.textContent = '-';

    elDia.textContent = '-';

    elMargen.textContent = '-';

    return;

  }

  const clientMap = groupSum('CLIENTE', 'NETO');

  const topClient = Object.entries(clientMap).sort((a, b) => b[1] - a[1])[0];

  elCliente.textContent = topClient ? `${topClient[0]} (${formatCLP(topClient[1])})` : '-';

  const famMap = groupSum('FAMILIA', 'NETO');

  const topFam = Object.entries(famMap).sort((a, b) => b[1] - a[1])[0];

  elFamilia.textContent = topFam ? `${topFam[0]} (${formatCLP(topFam[1])})` : '-';

  if (elCategoria) {

    const catMap = groupSum('CATEGORIA', 'NETO');

    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

    elCategoria.textContent = topCat ? `${topCat[0]} (${formatCLP(topCat[1])})` : '-';

  }

  const dayMap = {};

  filtered.forEach(r => {

    const d = toDateInputValue(r['FECHA']);

    if (d) dayMap[d] = (dayMap[d] || 0) + (Number(r['NETO']) || 0);

  });

  const topDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

  if (topDay) {

    const dateObj = new Date(topDay[0] + 'T00:00:00');

    elDia.textContent = `${dateObj.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })} (${formatCLP(topDay[1])})`;

  } else {

    elDia.textContent = '-';

  }

  const totalNeto = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalUtilidad = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);

  const margin = totalNeto ? Math.round((totalUtilidad / totalNeto) * 100) : 0;

  elMargen.textContent = margin + '%';

}

// ---------- KPIs ----------

function getPrevYearMetrics() {

  const f = getFilters();

  function matchNonDate(r) {

    if (f.canal && r['CANAL FINAL'] !== f.canal) return false;

    if (f.tienda && r['TIENDA FINAL'] !== f.tienda) return false;

    if (f.vendedor && r['CODVENDENDOR'] !== f.vendedor) return false;

    if (f.familia && r['FAMILIA'] !== f.familia) return false;

    if (f.categoria && r['CATEGORIA'] !== f.categoria) return false;

    if (f.region && r['REGION'] !== f.region) return false;

    return true;

  }

  let prevRows = [];

  if (f.desde || f.hasta) {

    let prevDesde = null;

    let prevHasta = null;

    if (f.desde) {

      const d = new Date(f.desde);

      if (!isNaN(d.getTime())) {

        d.setFullYear(d.getFullYear() - 1);

        prevDesde = d;

      }

    }

    if (f.hasta) {

      const h = new Date(f.hasta + 'T23:59:59');

      if (!isNaN(h.getTime())) {

        h.setFullYear(h.getFullYear() - 1);

        prevHasta = h;

      }

    }

    prevRows = rows.filter(r => {

      if (!matchNonDate(r)) return false;

      const d = new Date(r['FECHA']);

      if (isNaN(d.getTime())) return false;

      if (prevDesde && d < prevDesde) return false;

      if (prevHasta && d > prevHasta) return false;

      return true;

    });

  } else {

    // Si no hay rango de fecha fijo, busca el año máximo de los datos filtrados y toma (añoMáximo - 1)

    const years = filtered.map(r => Number(r['AÑO']) || (r['FECHA'] ? new Date(r['FECHA']).getFullYear() : null)).filter(Boolean);

    if (years.length) {

      const maxYear = Math.max(...years);

      const targetPrevYear = maxYear - 1;

      prevRows = rows.filter(r => {

        if (!matchNonDate(r)) return false;

        const rYear = Number(r['AÑO']) || (r['FECHA'] ? new Date(r['FECHA']).getFullYear() : null);

        return rYear === targetPrevYear;

      });

    }

  }

  const prevNeto = prevRows.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const prevUtilidad = prevRows.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);

  const prevUnidades = prevRows.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const prevFolios = new Set(prevRows.map(r => r['FOLIO'])).size;

  const prevMargen = prevNeto ? Math.round((prevUtilidad / prevNeto) * 100) : 0;

  const prevTicketProm = prevFolios ? prevNeto / prevFolios : 0;

  return { prevNeto, prevUtilidad, prevUnidades, prevFolios, prevMargen, prevTicketProm, hasPrevData: prevRows.length > 0 };

}

function renderKPIs() {

  const totalNeto = filtered.reduce((a, r) => a + (Number(r['NETO']) || 0), 0);

  const totalUtilidad = filtered.reduce((a, r) => a + (Number(r['($) UTILIDAD']) || 0), 0);

  const unidades = filtered.reduce((a, r) => a + (Number(r['CANTFACTURADA']) || 0), 0);

  const folios = new Set(filtered.map(r => r['FOLIO'])).size;

  const margen = totalNeto ? Math.round((totalUtilidad / totalNeto) * 100) : 0;

  const ticketProm = folios ? totalNeto / folios : 0;

  const { prevNeto, prevUtilidad, prevUnidades, prevFolios, prevMargen, prevTicketProm, hasPrevData } = getPrevYearMetrics();

  function formatTrend(current, prev, isCurrency = true) {

    if (!hasPrevData && prev === 0) {

      return `

        <div class="kpi-sub">

          <div class="kpi-sub-row">

            <span class="kpi-sub-label">Año anterior:</span>

            <span class="kpi-sub-val">-</span>

          </div>

          <div class="kpi-sub-badge-row"></div>

        </div>

      `;

    }

    const formattedPrev = isCurrency ? formatCLP(prev) : formatNum(prev);

    if (prev > 0) {

      const pct = Math.round(((current - prev) / prev) * 100);

      const trendClass = pct >= 0 ? 'trend-up' : 'trend-down';

      const trendSign = pct >= 0 ? '▲ +' : '▼ ';

      return `

        <div class="kpi-sub">

          <div class="kpi-sub-row">

            <span class="kpi-sub-label">Año anterior:</span>

            <span class="kpi-sub-val">${formattedPrev}</span>

          </div>

          <div class="kpi-sub-badge-row">

            <span class="kpi-trend ${trendClass}">${trendSign}${pct}%</span>

          </div>

        </div>

      `;

    }

    return `

      <div class="kpi-sub">

        <div class="kpi-sub-row">

          <span class="kpi-sub-label">Año anterior:</span>

          <span class="kpi-sub-val">${formattedPrev}</span>

        </div>

        <div class="kpi-sub-badge-row"></div>

      </div>

    `;

  }

  function formatMargenTrend(currentM, prevM) {

    if (!hasPrevData && prevM === 0) {

      return `

        <div class="kpi-sub">

          <div class="kpi-sub-row">

            <span class="kpi-sub-label">Año anterior:</span>

            <span class="kpi-sub-val">-</span>

          </div>

          <div class="kpi-sub-badge-row"></div>

        </div>

      `;

    }

    if (prevM > 0) {

      const diff = currentM - prevM;

      const trendClass = diff >= 0 ? 'trend-up' : 'trend-down';

      const trendSign = diff >= 0 ? '▲ +' : '▼ ';

      return `

        <div class="kpi-sub">

          <div class="kpi-sub-row">

            <span class="kpi-sub-label">Año anterior:</span>

            <span class="kpi-sub-val">${prevM}%</span>

          </div>

          <div class="kpi-sub-badge-row">

            <span class="kpi-trend ${trendClass}">${trendSign}${Math.abs(diff)}%</span>

          </div>

        </div>

      `;

    }

    return `

      <div class="kpi-sub">

        <div class="kpi-sub-row">

          <span class="kpi-sub-label">Año anterior:</span>

          <span class="kpi-sub-val">${prevM}%</span>

        </div>

        <div class="kpi-sub-badge-row"></div>

      </div>

    `;

  }

  const kpis = [

    {

      label: 'Venta neta',

      value: formatCLP(totalNeto),

      subHtml: formatTrend(totalNeto, prevNeto, true),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    },

    {

      label: 'Utilidad',

      value: formatCLP(totalUtilidad),

      subHtml: formatTrend(totalUtilidad, prevUtilidad, true),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 6h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    },

    {

      label: 'Margen',

      value: margen + '%',

      subHtml: formatMargenTrend(margen, prevMargen),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    },

    {

      label: 'Unidades vendidas',

      value: formatNum(unidades),

      subHtml: formatTrend(unidades, prevUnidades, false),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    },

    {

      label: 'Ticket promedio',

      value: formatCLP(ticketProm),

      subHtml: formatTrend(ticketProm, prevTicketProm, true),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke-linecap="round"/><path d="M22 10H2M12 15a2 2 0 100-4 2 2 0 000 4z" stroke-linecap="round"/></svg>`

    },

    {

      label: 'Documentos',

      value: formatNum(folios),

      subHtml: formatTrend(folios, prevFolios, false),

      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-linecap="round"/></svg>`

    }

  ];

  document.getElementById('kpiGrid').innerHTML = kpis.map(k => `

    <div class="kpi">

      <div class="kpi-header">

        <span class="label">${k.label}</span>

        <div class="kpi-icon">${k.icon}</div>

      </div>

      <div class="value">${k.value}</div>

      ${k.subHtml || ''}

    </div>

  `).join('');

}

// ---------- Charts ----------

let chartMes, chartCanal, chartVendedor, chartFamilia, chartProducto, chartCategoria;

const goldPalette = ['#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#06B6D4', '#F43F5E', '#8E7CC3', '#FBBF24'];

function groupSum(field, valueField) {

  const map = {};

  filtered.forEach(r => {

    const key = r[field] || '(sin dato)';

    map[key] = (map[key] || 0) + (Number(r[valueField]) || 0);

  });

  return map;

}

function renderCharts() {

  const isPdf = document.documentElement.classList.contains('is-pdf-export');

  const isLight = document.documentElement.getAttribute('data-ax-theme') === 'light' || isPdf;

  const tickColor = isLight ? '#334155' : '#94A3B8';

  const labelColor = isLight ? '#0F172A' : '#CBD5E1';

  const gridColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.06)';

  const doughnutBorder = isLight ? '#FFFFFF' : '#0B0F19';

  Chart.defaults.font.family = "'Inter', sans-serif";

  Chart.defaults.color = tickColor;

  // Venta neta por mes (Comparativa Sales Statistics - Réplica Exacta)

  const monthMapActual = {};

  const monthMapPrev = {};

  const yearsInFiltered = filtered.map(r => getRowMonthAndYear(r).year).filter(Boolean);

  const currentYear = yearsInFiltered.length ? Math.max(...yearsInFiltered) : new Date().getFullYear();

  const prevYear = currentYear - 1;

  filtered.forEach(r => {

    const { month } = getRowMonthAndYear(r);

    if (!month) return;

    monthMapActual[month] = (monthMapActual[month] || 0) + (Number(r['NETO']) || 0);

  });

  const f = getFilters();

  rows.forEach(r => {

    if (f.canal && cleanValStr(r['CANAL FINAL'] || r['Canal Final']).toLowerCase() !== cleanValStr(f.canal).toLowerCase()) return;
    if (f.tienda && cleanValStr(r['TIENDA FINAL'] || r['Tienda Final']).toLowerCase() !== cleanValStr(f.tienda).toLowerCase()) return;
    if (f.vendedor && cleanValStr(r['CODVENDENDOR'] || r['CODVENDEDOR'] || r['CodVendedor']).toLowerCase() !== cleanValStr(f.vendedor).toLowerCase()) return;
    if (f.familia && cleanValStr(r['FAMILIA'] || r['Familia'] || r['GRUPO']).toLowerCase() !== cleanValStr(f.familia).toLowerCase()) return;
    if (f.categoria && cleanValStr(r['CATEGORIA'] || r['Categoria'] || r['LINEA']).toLowerCase() !== cleanValStr(f.categoria).toLowerCase()) return;
    if (f.region && cleanValStr(r['REGION'] || r['Region']).toLowerCase() !== cleanValStr(f.region).toLowerCase()) return;

    const { month, year } = getRowMonthAndYear(r);

    if (year !== prevYear || !month) return;

    monthMapPrev[month] = (monthMapPrev[month] || 0) + (Number(r['NETO']) || 0);

  });

  const displayMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const chartLabels = displayMonths.map(m => String(m));

  const dataActual = displayMonths.map(m => monthMapActual[m] || 0);

  const dataPrev = displayMonths.map(m => monthMapPrev[m] || 0);

  const ctxMes = document.getElementById('chartMes').getContext('2d');

  const gradientMesActual = ctxMes.createLinearGradient(0, 0, 0, 300);

  gradientMesActual.addColorStop(0, 'rgba(16, 185, 129, 0.28)');

  gradientMesActual.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  if (chartMes) chartMes.destroy();

  chartMes = new Chart(ctxMes, {

    type: 'line',

    data: {

      labels: chartLabels,

      datasets: [

        {

          label: `This period (${currentYear})`,

          data: dataActual,

          borderColor: '#10B981',

          borderWidth: 3,

          backgroundColor: gradientMesActual,

          pointRadius: 0,

          pointHoverRadius: 6,

          pointHoverBackgroundColor: '#10B981',

          pointHoverBorderColor: '#FFFFFF',

          pointHoverBorderWidth: 2,

          fill: true,

          tension: 0.4

        },

        {

          label: `Previous period (${prevYear})`,

          data: dataPrev,

          borderColor: '#38BDF8',

          borderWidth: 2.5,

          pointRadius: 0,

          pointHoverRadius: 6,

          pointHoverBackgroundColor: '#38BDF8',

          pointHoverBorderColor: '#FFFFFF',

          pointHoverBorderWidth: 2,

          fill: false,

          tension: 0.4

        }

      ]

    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      plugins: {

        legend: {

          display: true,

          position: 'top',

          align: 'start',

          labels: {

            color: labelColor,

            boxWidth: 10,

            usePointStyle: true,

            pointStyle: 'circle',

            padding: 20,

            font: { size: 12, weight: '600', family: "'Inter', sans-serif" }

          }

        },

        tooltip: {

          mode: 'index',

          intersect: false,

          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',

          titleColor: labelColor,

          bodyColor: tickColor,

          borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.1)',

          borderWidth: 1,

          padding: 10,

          callbacks: {

            label: function(context) {

              return ` ${context.dataset.label}: ${formatCLP(context.parsed.y)}`;

            }

          }

        }

      },

      scales: {

        x: {

          ticks: { color: tickColor, font: { family: "'Inter', sans-serif", size: 12 } },

          grid: { display: false }

        },

        y: {

          ticks: {

            color: tickColor,

            font: { family: "'JetBrains Mono', monospace", size: 11 },

            callback: function(val) {

              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';

              if (val >= 1000) return (val / 1000).toFixed(0) + 'k';

              return val;

            }

          },

          grid: { color: gridColor, borderDash: [3, 3] }

        }

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

      datasets: [{

        data: Object.values(canalMap),

        backgroundColor: goldPalette,

        borderWidth: 2,

        borderColor: doughnutBorder

      }]

    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      onClick: (evt, elements) => {

        if (elements.length > 0) {

          const idx = elements[0].index;

          const val = chartCanal.data.labels[idx];

          const select = document.getElementById('fltCanal');

          if (select) {

            select.value = select.value === val ? '' : val;

            applyFilters();

            AudioSynth.play('click');

          }

        }

      },

      plugins: {

        legend: {

          position: 'bottom',

          labels: { color: labelColor, boxWidth: 12, padding: 15, font: { size: 12 } }

        }

      }

    }

  });

  // Top vendedores

  const vendMap = groupSum('CODVENDENDOR', 'NETO');

  const vendSorted = Object.entries(vendMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctxVend = document.getElementById('chartVendedor').getContext('2d');

  const gradientVend = ctxVend.createLinearGradient(0, 0, 300, 0);

  gradientVend.addColorStop(0, '#10B981');

  gradientVend.addColorStop(1, '#059669');

  if (chartVendedor) chartVendedor.destroy();

  chartVendedor = new Chart(ctxVend, {

    type: 'bar',

    data: {

      labels: vendSorted.map(v => v[0]),

      datasets: [{

        data: vendSorted.map(v => v[1]),

        backgroundColor: gradientVend,

        borderRadius: 6,

        borderSkipped: false

      }]

    },

    options: {

      indexAxis: 'y',

      responsive: true,

      maintainAspectRatio: false,

      onClick: (evt, elements) => {

        if (elements.length > 0) {

          const idx = elements[0].index;

          const val = chartVendedor.data.labels[idx];

          const select = document.getElementById('fltVendedor');

          if (select) {

            select.value = select.value === val ? '' : val;

            applyFilters();

            AudioSynth.play('click');

          }

        }

      },

      plugins: { legend: { display: false } },

      scales: {

        x: { ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 11 } }, grid: { color: gridColor } },

        y: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } }

      }

    }

  });

  // Venta por familia

  const famMap = groupSum('FAMILIA', 'NETO');

  const famSorted = Object.entries(famMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctxFam = document.getElementById('chartFamilia').getContext('2d');

  const gradientFam = ctxFam.createLinearGradient(0, 0, 0, 260);

  gradientFam.addColorStop(0, '#3B82F6');

  gradientFam.addColorStop(1, '#1D4ED8');

  if (chartFamilia) chartFamilia.destroy();

  chartFamilia = new Chart(ctxFam, {

    type: 'bar',

    data: {

      labels: famSorted.map(v => v[0]),

      datasets: [{

        data: famSorted.map(v => v[1]),

        backgroundColor: gradientFam,

        borderRadius: 6,

        borderSkipped: false

      }]

    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      onClick: (evt, elements) => {

        if (elements.length > 0) {

          const idx = elements[0].index;

          const val = chartFamilia.data.labels[idx];

          const select = document.getElementById('fltFamilia');

          if (select) {

            select.value = select.value === val ? '' : val;

            applyFilters();

            AudioSynth.play('click');

          }

        }

      },

      plugins: { legend: { display: false } },

      scales: {

        x: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } },

        y: { ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 11 } }, grid: { color: gridColor } }

      }

    }

  });

  // Top productos (venta neta)

  const prodMap = groupSum('DESCRIPCION', 'NETO');

  const prodSorted = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctxProd = document.getElementById('chartProducto');

  if (ctxProd) {

    const ctxProd2d = ctxProd.getContext('2d');

    const gradientProd = ctxProd2d.createLinearGradient(0, 0, 300, 0);

    gradientProd.addColorStop(0, '#F59E0B');

    gradientProd.addColorStop(1, '#D97706');

    if (chartProducto) chartProducto.destroy();

    chartProducto = new Chart(ctxProd2d, {

      type: 'bar',

      data: {

        labels: prodSorted.map(v => String(v[0]).length > 22 ? String(v[0]).substring(0, 22) + '…' : v[0]),

        datasets: [{

          data: prodSorted.map(v => v[1]),

          backgroundColor: gradientProd,

          borderRadius: 6,

          borderSkipped: false

        }]

      },

      options: {

        indexAxis: 'y',

        responsive: true,

        maintainAspectRatio: false,

        plugins: { legend: { display: false } },

        scales: {

          x: { ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 11 } }, grid: { color: gridColor } },

          y: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } }

        }

      }

    });

  }

  // Venta por categoría

  const catMap = groupSum('CATEGORIA', 'NETO');

  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctxCat = document.getElementById('chartCategoria');

  if (ctxCat) {

    const ctxCat2d = ctxCat.getContext('2d');

    const gradientCat = ctxCat2d.createLinearGradient(0, 0, 0, 260);

    gradientCat.addColorStop(0, '#06B6D4');

    gradientCat.addColorStop(1, '#0284C7');

    if (chartCategoria) chartCategoria.destroy();

    chartCategoria = new Chart(ctxCat2d, {

      type: 'bar',

      data: {

        labels: catSorted.map(v => v[0]),

        datasets: [{

          data: catSorted.map(v => v[1]),

          backgroundColor: gradientCat,

          borderRadius: 6,

          borderSkipped: false

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: { legend: { display: false } },

        scales: {

          x: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } },

          y: { ticks: { color: tickColor, font: { family: "'JetBrains Mono', monospace", size: 11 } }, grid: { color: gridColor } }

        }

      }

    });

  }

}

// ---------- Tema Claro / Oscuro (Unificado & Global) ----------

function initTheme() {

  const savedTheme = localStorage.getItem('glomax-theme') || 'dark';

  applyTheme(savedTheme);

}

function applyTheme(theme) {

  document.documentElement.setAttribute('data-ax-theme', theme);

  if (document.body) document.body.setAttribute('data-ax-theme', theme);

  localStorage.setItem('glomax-theme', theme);

  const themeBtn = document.getElementById('themeToggleBtn');

  if (themeBtn) {

    if (theme === 'light') {

      themeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

      themeBtn.title = "Cambiar a Modo Oscuro";

    } else {

      themeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

      themeBtn.title = "Cambiar a Modo Claro";

    }

  }

  const btnLabel = document.getElementById('themeToggleLabel');

  if (btnLabel) {

    btnLabel.textContent = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';

  }

  if (typeof renderCharts === 'function' && filtered && filtered.length > 0) {

    renderCharts();

  }

}

function toggleTheme() {

  const current = document.documentElement.getAttribute('data-ax-theme') || 'dark';

  const next = current === 'dark' ? 'light' : 'dark';

  applyTheme(next);

  if (typeof AudioSynth !== 'undefined' && AudioSynth.enabled) {

    AudioSynth.play('click');

  }

}

window.toggleTheme = toggleTheme;

window.applyTheme = applyTheme;

const themeToggleBtn = document.getElementById('themeToggleBtn');

if (themeToggleBtn) {

  themeToggleBtn.onclick = function(e) {

    e.preventDefault();

    toggleTheme();

  };

}

initTheme();

// ---------- Tabla + paginación ----------

function renderTable() {

  const body = document.getElementById('tableBody') || document.getElementById('rowsTableBody');

  const empty = document.getElementById('emptyState');

  if (!body) return;

  // Actualizar indicadores de ordenación en th

  document.querySelectorAll('th.sortable').forEach(th => {

    const field = th.dataset.sort;

    th.classList.remove('sorted-asc', 'sorted-desc');

    const icon = th.querySelector('.sort-icon');

    if (field === currentSortField) {

      if (currentSortAsc) {

        th.classList.add('sorted-asc');

        if (icon) icon.textContent = '▲';

      } else {

        th.classList.add('sorted-desc');

        if (icon) icon.textContent = '▼';

      }

    } else {

      if (icon) icon.textContent = '↕';

    }

  });

  if (!filtered.length) {

    body.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 3rem; color: var(--ax-text-tertiary);">No se encontraron registros que coincidan con los filtros.</td></tr>`;

    if (empty) empty.style.display = 'block';

    const pageInfo = document.getElementById('pageInfo');

    if (pageInfo) pageInfo.textContent = 'Página 0 de 0 (0 registros)';

    return;

  }

  if (empty) empty.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;

  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(r => {

    const util = Number(r['($) UTILIDAD']) || 0;

    const tipo = String(r['TIPO'] || 'Factura').trim();

    return `

      <tr data-row="${r['_row'] || ''}">

        <td class="font-mono">${r['FOLIO'] || ''}</td>

        <td><span class="badge-tipo">${tipo}</span></td>

        <td class="font-mono">${r['FECHA'] ? String(r['FECHA']).slice(0,10) : ''}</td>

        <td class="font-mono">${r['CODIGO'] || ''}</td>

        <td class="cell-desc" title="${r['DESCRIPCION'] || ''}">${r['DESCRIPCION'] || ''}</td>

        <td class="font-mono align-right">${formatNum(r['CANTFACTURADA'])}</td>

        <td>${r['CLIENTE'] || ''}</td>

        <td>${r['CODVENDENDOR'] || ''}</td>

        <td>${r['CANAL FINAL'] || ''}</td>

        <td>${r['TIENDA FINAL'] || ''}</td>

        <td class="font-mono align-right font-bold">${formatCLP(r['NETO'])}</td>

        <td class="font-mono align-right ${util < 0 ? 'text-danger' : 'text-success'}">${formatCLP(util)}</td>

      </tr>

    `;

  }).join('');

  body.querySelectorAll('tr').forEach(tr => {

    if (typeof openModalForEdit === 'function') {

      tr.addEventListener('click', () => openModalForEdit(tr.dataset.row));

    }

  });

  const pageInfo = document.getElementById('pageInfo');

  if (pageInfo) {

    pageInfo.textContent = `Página ${currentPage} de ${totalPages} · (${formatNum(filtered.length)} registros)`;

  }

  const prevBtn = document.getElementById('btnPrevPage') || document.getElementById('prevPage');

  const nextBtn = document.getElementById('btnNextPage') || document.getElementById('nextPage');

  if (prevBtn) {

    prevBtn.disabled = currentPage <= 1;

    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };

  }

  if (nextBtn) {

    nextBtn.disabled = currentPage >= totalPages;

    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };

  }

}

// Event Listeners para ordenación por columnas

document.querySelectorAll('th.sortable').forEach(th => {

  th.addEventListener('click', () => {

    const field = th.dataset.sort;

    if (currentSortField === field) {

      currentSortAsc = !currentSortAsc;

    } else {

      currentSortField = field;

      currentSortAsc = true;

    }

    applyFilters();

  });

});

// Event Listener Exportar a CSV

const exportBtn = document.getElementById('exportCsvBtn');

if (exportBtn) {

  exportBtn.addEventListener('click', exportToCSV);

}

function exportToCSV() {

  if (!filtered.length) {

    showToast('No hay datos para exportar');

    return;

  }

  const fields = ['FOLIO', 'TIPO', 'FECHA', 'CLIENTE', 'RUT', 'CODIGO', 'DESCRIPCION', 'CANTFACTURADA', 'PREUNI', 'NETO', 'COSTOS', 'COSTO TOTAL NET', '($) UTILIDAD', 'CODVENDENDOR', 'TIENDA FINAL', 'CANAL FINAL', 'FAMILIA', 'REGION'];

  const headers = fields.join(';');

  const rowsCsv = filtered.map(r => {

    return fields.map(f => {

      let val = r[f] !== undefined && r[f] !== null ? String(r[f]) : '';

      val = val.replace(/"/g, '""');

      return `"${val}"`;

    }).join(';');

  });

  const csvContent = '\uFEFF' + [headers, ...rowsCsv].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = `Ventas_Export_${new Date().toISOString().slice(0, 10)}.csv`;

  a.click();

  URL.revokeObjectURL(url);

  showToast('Archivo CSV descargado correctamente');

}

// ---------- Exportar Reporte a PDF ----------

async function exportToPDF() {

  showToast('Generando reporte PDF…');

  const currentTheme = document.documentElement.getAttribute('data-ax-theme') || 'dark';

  try {

    // 1. Aplicar temporalmente alto contraste e iluminación de tema claro

    document.documentElement.classList.add('is-pdf-export');

    document.documentElement.setAttribute('data-ax-theme', 'light');

    renderCharts();

    // 2. Pausa breve para renderizado de canvas en tema claro

    await new Promise(r => setTimeout(r, 350));

    const activeView = document.querySelector('.view.active') || document.getElementById('view-tablero');

    // 3. Crear clon aislado fuera de pantalla para exportación limpia

    const clone = activeView.cloneNode(true);

    clone.style.width = '1100px';

    clone.style.padding = '20px';

    clone.style.background = '#FFFFFF';

    // Eliminar botones interactivos dentro del clon

    clone.querySelectorAll('.export-pdf-btn, #openModalBtn, .ax-btn-icon').forEach(el => el.remove());

    // Reemplazar cada canvas de Chart.js por su imagen PNG en alta definición

    const cloneCanvases = clone.querySelectorAll('canvas');

    cloneCanvases.forEach(cloneCanvas => {

      const origCanvas = document.getElementById(cloneCanvas.id);

      if (origCanvas) {

        const img = document.createElement('img');

        img.src = origCanvas.toDataURL('image/png', 1.0);

        img.style.width = '100%';

        img.style.height = 'auto';

        img.style.display = 'block';

        img.style.maxHeight = '280px';

        img.style.objectFit = 'contain';

        cloneCanvas.parentNode.replaceChild(img, cloneCanvas);

      }

    });

    const container = document.createElement('div');

    container.style.position = 'fixed';

    container.style.top = '-9999px';

    container.style.left = '-9999px';

    container.style.zIndex = '-9999';

    container.appendChild(clone);

    document.body.appendChild(container);

    const filename = `Reporte_Ventas_Glomax_SA_${new Date().toISOString().slice(0, 10)}.pdf`;

    if (window.html2pdf) {

      const opt = {

        margin:       [8, 8, 8, 8],

        filename:     filename,

        image:        { type: 'jpeg', quality: 0.98 },

        html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF' },

        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },

        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }

      };

      await html2pdf().set(opt).from(clone).save();

      showToast('Reporte PDF descargado con éxito');

    } else {

      window.print();

    }

    if (document.body.contains(container)) {

      document.body.removeChild(container);

    }

  } catch (err) {

    console.error('Error al exportar PDF:', err);

    showToast('Generando vista de impresión…');

    window.print();

  } finally {

    document.documentElement.classList.remove('is-pdf-export');

    document.documentElement.setAttribute('data-ax-theme', currentTheme);

    renderCharts();

  }

}

document.querySelectorAll('.export-pdf-btn').forEach(btn => {

  btn.addEventListener('click', exportToPDF);

});

function focusGlobalSearch() {

  const tableNavBtn = document.querySelector('.ax-nav__item[data-view="tabla"]');

  if (tableNavBtn) tableNavBtn.click();

  const sb = document.getElementById('searchBox');

  if (sb) {

    sb.focus();

    sb.select();

  }

}

document.addEventListener('keydown', (e) => {

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {

    e.preventDefault();

    focusGlobalSearch();

  }

});

const headerSearchBtn = document.getElementById('headerSearchBtn');

if (headerSearchBtn) {

  headerSearchBtn.addEventListener('click', focusGlobalSearch);

}

const searchBox = document.getElementById('searchBox');

if (searchBox) {

  let searchDebounce;

  searchBox.addEventListener('input', () => {

    clearTimeout(searchDebounce);

    searchDebounce = setTimeout(applyFilters, 250);

  });

}

// ---------- Navegación ----------

document.querySelectorAll('.ax-nav__item[data-view]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const v = btn.getAttribute('data-view') || btn.dataset.view;
    if (v) switchView(v);
  });
});

// ---------- Menu Filter (Buscador de menú lateral) ----------

const menuFilterInput = document.getElementById('menuFilter');

if (menuFilterInput) {

  menuFilterInput.addEventListener('input', (e) => {

    const q = e.target.value.toLowerCase().trim();

    document.querySelectorAll('#sidebarNav .ax-nav__item').forEach(item => {

      const text = item.textContent.toLowerCase();

      item.style.display = text.includes(q) ? 'flex' : 'none';

    });

  });

}

// ---------- Cambiador de Tema (Claro / Oscuro) ----------

// Selector de periodo (Semana / Mes / Año)

document.querySelectorAll('#salesPeriodSelector .period-pill').forEach(pill => {

  pill.addEventListener('click', () => {

    document.querySelectorAll('#salesPeriodSelector .period-pill').forEach(p => p.classList.remove('active'));

    pill.classList.add('active');

    renderCharts();

  });

});

// ---------- Modal Form ----------

const modalBackdrop = document.getElementById('modalBackdrop');

const modalForm = document.getElementById('modalForm');

function openModal() {

  if (modalForm) modalForm.reset();

  const fFecha = document.getElementById('fFecha');

  if (fFecha) fFecha.value = new Date().toISOString().slice(0, 10);

  if (modalBackdrop) modalBackdrop.classList.add('show');

}

function closeModal() {

  if (modalBackdrop) modalBackdrop.classList.remove('show');

}

const openModalBtn = document.getElementById('openModalBtn');

if (openModalBtn) openModalBtn.addEventListener('click', openModal);

const closeModalBtn = document.getElementById('closeModalBtn');

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

const cancelModalBtn = document.getElementById('cancelModalBtn');

if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

if (modalBackdrop) {

  modalBackdrop.addEventListener('click', (e) => {

    if (e.target === modalBackdrop) closeModal();

  });

}

// ---------- Helper Actions para Command Palette & Header ----------

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (backdrop) backdrop.classList.toggle('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

function switchView(viewName) {
  if (!viewName) return;
  closeMobileSidebar();
  document.querySelectorAll('.ax-nav__item[data-view]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  const btn = document.querySelector(`.ax-nav__item[data-view="${viewName}"]`);
  const targetView = document.getElementById('view-' + viewName);
  
  if (btn) btn.classList.add('active');
  if (targetView) targetView.classList.add('active');
  
  if (viewName === 'compras') {
    renderComprasView();
  } else if (viewName === 'cotizaciones') {
    renderCotizacionesView();
  } else if (viewName === 'tablero') {
    renderMonthlyTargetProgress();
    renderMiniKPIs();
    renderKPIs();
    renderCharts();
  } else if (viewName === 'tabla') {
    renderTable();
  } else if (viewName === 'bistudio') {
    renderBIEngine();
  }

  if (typeof AudioSynth !== 'undefined' && AudioSynth.enabled && AudioSynth.play) {
    AudioSynth.play('click');
  }
}

function toggleSound() {

  AudioSynth.enabled = !AudioSynth.enabled;

  const btn = document.getElementById('soundToggleBtn');

  if (btn) btn.classList.toggle('active', AudioSynth.enabled);

  showToast(AudioSynth.enabled ? 'Efectos de sonido activados 🔊' : 'Efectos de sonido desactivados 🔇');

  if (AudioSynth.enabled) AudioSynth.play('success');

}

function resetFilters() {

  ['fltDesde', 'fltHasta', 'fltCanal', 'fltTienda', 'fltVendedor', 'fltFamilia', 'fltRegion'].forEach(id => {

    const el = document.getElementById(id);

    if (el) el.value = '';

  });

  document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));

  const yearBtn = document.querySelector('.preset-btn[data-preset="thisYear"]');

  if (yearBtn) yearBtn.classList.add('active');

  const sb = document.getElementById('searchBox');

  if (sb) sb.value = '';

  applyFilters();

  AudioSynth.play('click');

}

const soundToggleBtn = document.getElementById('soundToggleBtn');

if (soundToggleBtn) {

  soundToggleBtn.addEventListener('click', toggleSound);

  if (AudioSynth.enabled) soundToggleBtn.classList.add('active');

}

// ---------- FORMULARIO CON GUARDADO OPTIMISTA (0ms) ----------

if (modalForm) {

  modalForm.addEventListener('submit', async (e) => {

    e.preventDefault();

    const cant = Number(document.getElementById('fCant').value || 0);

    const preuni = Number(document.getElementById('fPreUni').value || 0);

    const payloadData = {

      FOLIO: document.getElementById('fFolio').value,

      TIPO: document.getElementById('fTipo').value,

      FECHA: document.getElementById('fFecha').value,

      CODIGO: document.getElementById('fCodigo').value,

      DESCRIPCION: document.getElementById('fDescripcion').value,

      CANTFACTURADA: cant,

      PREUNI: preuni,

      NETO: cant * preuni,

      CLIENTE: document.getElementById('fCliente').value,

      CODVENDENDOR: document.getElementById('fVendedor').value,

      'CANAL FINAL': document.getElementById('fCanal').value,

      'TIENDA FINAL': document.getElementById('fTienda').value,

      FAMILIA: document.getElementById('fFamilia').value,

      CATEGORIA: document.getElementById('fCategoria').value,

      REGION: document.getElementById('fRegion').value

    };

    // Asignación de fila ID local y campos derivados en navegador

    const newRowId = (rows.length > 0 ? Math.max(...rows.map(r => Number(r._row) || 0)) : 1) + 1;

    payloadData._row = newRowId;

    const dDate = parseRowDate(payloadData.FECHA);

    if (dDate) {

      payloadData['# MES'] = dDate.getMonth() + 1;

      payloadData.MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][dDate.getMonth()];

      payloadData['AÑO'] = dDate.getFullYear();

      payloadData.QUARTER = 'Q' + Math.ceil((dDate.getMonth() + 1) / 3);

    }

    // 1. RESPUESTA INSTANTÁNEA (0ms) EN UI E INDEXEDDB

    rows.unshift(payloadData);

    GlomaxDB.setRows(rows);

    applyFilters();

    closeModal();

    AudioSynth.play('success');

    showToast('🚀 Venta registrada instantáneamente (0ms)');

    // 2. SINCRONIZACIÓN EN SEGUNDO PLANO

    await GlomaxDB.addPendingMutation({

      action: 'add',

      data: payloadData,

      timestamp: Date.now()

    });

    processSyncQueue();

  });

}

// ---------- Auto Refresh & Inicializaciones ----------

function startAutoRefresh() {

  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => loadData(false), 30000);

}

// Inicializar Command Palette

CmdPalette.init();

// Carga Inicial

loadData(true);

startAutoRefresh();


// ==========================================================================
// SECCIÓN DE COMPRAS & COSTOS DE PRODUCTOS (MOTOR OPTIMIZADO ROBUSTO)
// ==========================================================================
let comprasCurrentPage = 1;
const COMPRAS_PAGE_SIZE = 25;

function getRowVal(r, keys, defaultVal = '') {
  if (!r) return defaultVal;
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '') {
      return r[k];
    }
  }
  return defaultVal;
}

function getRowNum(r, keys, defaultVal = 0) {
  const val = getRowVal(r, keys, null);
  if (val === null) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? defaultVal : num;
}



function resetComprasFilters() {
  const sb = document.getElementById('comprasSearchBox');
  if (sb) sb.value = '';
  const ss = document.getElementById('comprasSortSelect');
  if (ss) ss.value = 'default';
  const ff = document.getElementById('comprasFamiliaFilter');
  if (ff) ff.value = '';
  comprasCurrentPage = 1;
  renderComprasView();
}

function initComprasListeners() {
  const sb = document.getElementById('comprasSearchBox');
  if (sb) {
    sb.addEventListener('input', () => {
      comprasCurrentPage = 1;
      renderComprasView();
    });
  }

  const ss = document.getElementById('comprasSortSelect');
  if (ss) {
    ss.addEventListener('change', () => {
      comprasCurrentPage = 1;
      renderComprasView();
    });
  }

  const ff = document.getElementById('comprasFamiliaFilter');
  if (ff) {
    ff.addEventListener('change', () => {
      comprasCurrentPage = 1;
      renderComprasView();
    });
  }

  const btnPrev = document.getElementById('btnComprasPrevPage');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (comprasCurrentPage > 1) {
        comprasCurrentPage--;
        renderComprasView();
      }
    });
  }

  const btnNext = document.getElementById('btnComprasNextPage');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      comprasCurrentPage++;
      renderComprasView();
    });
  }

  const budgetInput = document.getElementById('comprasBudgetInput');
  if (budgetInput) {
    budgetInput.addEventListener('input', () => {
      renderComprasBIAdvisor();
    });
  }

  const strategySelect = document.getElementById('comprasStrategySelect');
  if (strategySelect) {
    strategySelect.addEventListener('change', () => {
      renderComprasBIAdvisor();
    });
  }

  document.querySelectorAll('.budget-pill[data-budget]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.budget-pill[data-budget]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const budgetVal = btn.dataset.budget;
      if (budgetInput) budgetInput.value = budgetVal;
      renderComprasBIAdvisor();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initComprasListeners();
    initCotizacionesListeners();
  });
} else {
  initComprasListeners();
  initCotizacionesListeners();
}

// ==========================================================================
// DASHBOARD MAYORISTAS & MEDICIÓN DE COTIZACIONES (GOOGLE SHEETS LIVE)
// ==========================================================================

let cotizacionesRows = [];
let cotizacionesFiltered = [];
let cotizCurrentPage = 1;
const COTIZ_PAGE_SIZE = 25;

let chartCotizEvolInstance = null;
let chartCotizEstadoInstance = null;
let chartCotizRespInstance = null;

async function fetchCotizacionesData() {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) return null;
  const gid = typeof SPREADSHEET_COTIZACIONES_GID !== 'undefined' ? SPREADSHEET_COTIZACIONES_GID : '2001859242';

  try {
    const jsonpData = await new Promise((resolve, reject) => {
      const cbName = 'cotiz_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      const timer = setTimeout(() => { cleanup(); reject(new Error('Cotizaciones JSONP timeout')); }, 45000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        const s = document.getElementById(cbName);
        if (s) s.remove();
      }
      window[cbName] = function(json) {
        cleanup();
        try {
          if (!json || !json.table) return resolve(null);
          const cols = (json.table.cols || []).map(c => c ? (c.label || c.id || '') : '');
          const rowsData = (json.table.rows || []).map((row, i) => {
            const obj = {};
            if (row && row.c) {
              cols.forEach((colName, j) => {
                if (colName && row.c[j] !== undefined && row.c[j] !== null) {
                  let val = row.c[j].v !== null && row.c[j].v !== undefined ? row.c[j].v : '';
                  if (typeof val === 'string' && val.startsWith('Date(')) {
                    const match = val.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
                    if (match) val = new Date(Number(match[1]), Number(match[2]), Number(match[3]));
                  } else if (row.c[j].f !== undefined && (val === '' || val === null)) {
                    val = row.c[j].f;
                  }
                  obj[colName] = val;
                }
              });
            }
            obj['_row'] = i + 2;
            return normalizeCotizacionRow(obj);
          });
          const filtered = rowsData.filter(n => n && (n.COTIZACION || n.CLIENTE || n.TOTAL || n.SKU || n.PRODUCTO));
          resolve(filtered.length > 0 ? filtered : null);
        } catch (err) { reject(err); }
      };
      const script = document.createElement('script');
      script.id = cbName;
      script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${cbName}&gid=${gid}&headers=2&_=${Date.now()}`;
      script.onerror = () => { cleanup(); reject(new Error('Cotizaciones JSONP script error')); };
      document.head.appendChild(script);
    });
    if (jsonpData && jsonpData.length > 0) return jsonpData;
  } catch (e) {
    console.warn('Cotizaciones JSONP error:', e);
  }

  // Fallback CSV Directo
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`;
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    const csvText = await res.text();
    const rawRows = parseCSV(csvText);
    if (rawRows.length < 3) return null;
    const headers = rawRows[1].map(h => String(h || '').trim());

    const data = [];
    for (let i = 2; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length === 0) continue;
      const obj = {};
      headers.forEach((h, j) => {
        if (h && j < r.length) obj[h] = r[j];
      });
      obj['_row'] = i + 1;
      const norm = normalizeCotizacionRow(obj);
      if (norm && (norm.COTIZACION || norm.CLIENTE || norm.TOTAL || norm.SKU || norm.PRODUCTO)) {
        data.push(norm);
      }
    }
    return data.length > 0 ? data : null;
  } catch (err) {
    console.warn('Cotizaciones CSV error:', err);
  }

  return null;
}

function normalizeCotizacionRow(obj) {
  if (!obj) return null;

  const tipo = String(obj['Tipo Solicitud'] || '').trim();
  const rut = String(obj['Rut'] || '').trim();
  const cliente = String(obj['Cliente'] || '').trim();
  const cotizacion = String(obj['(#) Cot'] || obj['Cotizacion'] || '').trim();
  const sku = String(obj['SKU'] || obj['Codigo'] || '').trim();
  const producto = String(obj['Producto'] || obj['Descripcion'] || '').trim();
  const cantidad = parseNumberClean(obj['Cantidad'] || 0);
  const precio = parseNumberClean(obj['Precio'] || 0);
  const total = parseNumberClean(obj['Total'] || (cantidad * precio));
  const fechaSolRaw = obj['Fecha Solicitud'] || obj['FECHA'] || '';
  const responsable = String(obj['Responsable'] || obj['Vendedor'] || '').trim();
  const estado = String(obj['Estado'] || 'Pendiente').trim();
  const nv = String(obj['NV'] || '').trim();
  const fa = String(obj['FA'] || '').trim();
  const estadoNV = String(obj['Estado NV'] || '').trim();
  const dias = parseNumberClean(obj['Días'] || obj['Dias'] || 0);
  const fechaFactRaw = obj['Fecha Factura'] || '';
  const mesT = String(obj['Mes T'] || obj['MES'] || '').trim();
  const ano = String(obj['Año'] || obj['AÑO'] || '').trim();

  const dSol = parseRowDate(fechaSolRaw);
  const dFact = parseRowDate(fechaFactRaw);

  return {
    TIPO: tipo,
    RUT: rut,
    CLIENTE: cliente,
    COTIZACION: cotizacion,
    SKU: sku,
    PRODUCTO: producto,
    CANTIDAD: cantidad,
    PRECIO: precio,
    TOTAL: total,
    FECHA_SOLICITUD: dSol || fechaSolRaw,
    RESPONSABLE: responsable,
    ESTADO: estado,
    NV: nv,
    FA: fa,
    ESTADO_NV: estadoNV,
    DIAS: dias,
    FECHA_FACTURA: dFact || fechaFactRaw,
    MES_T: mesT,
    ANO: ano,
    _timeSol: dSol ? dSol.getTime() : 0,
    _timeFact: dFact ? dFact.getTime() : 0,
    _searchHaystack: `${cotizacion} ${cliente} ${rut} ${sku} ${producto} ${responsable} ${estado} ${nv} ${fa}`.toLowerCase()
  };
}

async function renderCotizacionesView() {
  if (!cotizacionesRows || cotizacionesRows.length === 0) {
    const loaded = await fetchCotizacionesData();
    if (loaded && loaded.length > 0) {
      cotizacionesRows = loaded;
    }
  }

  populateCotizFilterOptions();
  applyCotizacionesFilters();
}

function populateCotizFilterOptions() {
  const source = cotizacionesRows || [];
  
  const getUniques = (fn) => [...new Set(source.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

  const respSel = document.getElementById('fltCotizResponsable');
  if (respSel && respSel.options.length <= 1) {
    const uniques = getUniques(r => r.RESPONSABLE);
    respSel.innerHTML = `<option value="">Todos los Responsables</option>` + uniques.map(u => `<option value="${u}">${u}</option>`).join('');
  }

  const estSel = document.getElementById('fltCotizEstado');
  if (estSel && estSel.options.length <= 1) {
    const uniques = getUniques(r => r.ESTADO);
    estSel.innerHTML = `<option value="">Todos los Estados</option>` + uniques.map(u => `<option value="${u}">${u}</option>`).join('');
  }

  const tipoSel = document.getElementById('fltCotizTipo');
  if (tipoSel && tipoSel.options.length <= 1) {
    const uniques = getUniques(r => r.TIPO);
    tipoSel.innerHTML = `<option value="">Todos los Tipos</option>` + uniques.map(u => `<option value="${u}">${u}</option>`).join('');
  }
}

function applyCotizacionesFilters() {
  const dDesde = document.getElementById('fltCotizDesde')?.value ? parseRowDate(document.getElementById('fltCotizDesde').value) : null;
  const tDesde = dDesde ? dDesde.setHours(0, 0, 0, 0) : 0;

  const dHasta = document.getElementById('fltCotizHasta')?.value ? parseRowDate(document.getElementById('fltCotizHasta').value) : null;
  const tHasta = dHasta ? dHasta.setHours(23, 59, 59, 999) : 0;

  const selResp = document.getElementById('fltCotizResponsable')?.value.toLowerCase() || '';
  const selEst = document.getElementById('fltCotizEstado')?.value.toLowerCase() || '';
  const selTipo = document.getElementById('fltCotizTipo')?.value.toLowerCase() || '';
  const searchVal = document.getElementById('cotizSearchBox')?.value.trim().toLowerCase() || '';

  cotizacionesFiltered = (cotizacionesRows || []).filter(r => {
    if (!r) return false;
    if (tDesde > 0 && (r._timeSol < tDesde || !r._timeSol)) return false;
    if (tHasta > 0 && (r._timeSol > tHasta || !r._timeSol)) return false;
    if (selResp && r.RESPONSABLE.toLowerCase() !== selResp) return false;
    if (selEst && r.ESTADO.toLowerCase() !== selEst) return false;
    if (selTipo && r.TIPO.toLowerCase() !== selTipo) return false;
    if (searchVal && !r._searchHaystack.includes(searchVal)) return false;
    return true;
  });

  renderCotizacionesKPIs();
  renderCotizacionesCharts();
  renderCotizacionesTable();
}

function renderCotizacionesKPIs() {
  const source = cotizacionesFiltered || [];
  const container = document.getElementById('cotizTipoCardsContainer');
  const subtitleEl = document.getElementById('cotizTipoCardsSubtitle');
  if (!container) return;

  // Agrupar por Tipo de Solicitud (Columna B)
  const tipoMap = new Map();

  source.forEach(r => {
    const tipoName = String(r.TIPO || 'Sin Especificar').trim();
    if (!tipoMap.has(tipoName)) {
      tipoMap.set(tipoName, {
        name: tipoName,
        totalMonto: 0,
        totalCount: 0,
        aceptadasCount: 0,
        aceptadasMonto: 0,
        pendientesCount: 0,
        pendientesMonto: 0,
        perdidasCount: 0,
        perdidasMonto: 0
      });
    }

    const item = tipoMap.get(tipoName);
    const monto = r.TOTAL || 0;
    const est = (r.ESTADO || '').toLowerCase();

    item.totalCount += 1;
    item.totalMonto += monto;

    if (est.includes('aceptada') || est.includes('aprobada') || est.includes('facturada') || Boolean(r.NV) || Boolean(r.FA)) {
      item.aceptadasCount += 1;
      item.aceptadasMonto += monto;
    } else if (est.includes('perdida') || est.includes('rechazada')) {
      item.perdidasCount += 1;
      item.perdidasMonto += monto;
    } else {
      item.pendientesCount += 1;
      item.pendientesMonto += monto;
    }
  });

  const tiposList = Array.from(tipoMap.values()).sort((a, b) => b.totalMonto - a.totalMonto);

  if (subtitleEl) {
    subtitleEl.textContent = `Mostrando ${tiposList.length} tipos de solicitud (${formatNum(source.length)} cotizaciones filtradas)`;
  }

  if (tiposList.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:#94a3b8;">No se encontraron tipos de solicitud con los filtros seleccionados.</div>`;
    return;
  }

  container.innerHTML = tiposList.map(t => {
    const conversionPct = t.totalCount > 0 ? (t.aceptadasCount / t.totalCount) * 100 : 0;
    return `
      <div class="ux-tipo-card">
        <div>
          <div class="ux-card-top-row">
            <span class="ux-card-tag-pill">TIPO: ${t.name.toUpperCase()}</span>
            <span class="ux-card-count-badge">${formatNum(t.totalCount)} cotizaciones</span>
          </div>

          <div class="ux-card-val-group">
            <span class="ux-card-amount-num">$${formatNum(t.totalMonto)}</span>
            <span class="ux-card-conversion-rate">${conversionPct.toFixed(1)}% Conversión</span>
          </div>

          <div class="ux-progress-track">
            <div class="ux-progress-fill" style="width: ${Math.min(100, Math.max(0, conversionPct))}%;"></div>
          </div>
        </div>

        <div class="ux-stat-grid">
          <div class="ux-stat-col">
            <span class="ux-stat-lbl" style="color:#60a5fa;">TOTAL</span>
            <span class="ux-stat-val" style="color:#f8fafc;">${formatNum(t.totalCount)}</span>
            <span class="ux-stat-submonto">$${formatNum(t.totalMonto)}</span>
          </div>

          <div class="ux-stat-col">
            <span class="ux-stat-lbl" style="color:#34d399;">ACEPTADAS</span>
            <span class="ux-stat-val" style="color:#34d399;">${formatNum(t.aceptadasCount)}</span>
            <span class="ux-stat-submonto">$${formatNum(t.aceptadasMonto)}</span>
          </div>

          <div class="ux-stat-col">
            <span class="ux-stat-lbl" style="color:#fbbf24;">PENDIENTES</span>
            <span class="ux-stat-val" style="color:#fbbf24;">${formatNum(t.pendientesCount)}</span>
            <span class="ux-stat-submonto">$${formatNum(t.pendientesMonto)}</span>
          </div>

          <div class="ux-stat-col">
            <span class="ux-stat-lbl" style="color:#f87171;">PERDIDAS</span>
            <span class="ux-stat-val" style="color:#f87171;">${formatNum(t.perdidasCount)}</span>
            <span class="ux-stat-submonto">$${formatNum(t.perdidasMonto)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCotizacionesCharts() {
  if (typeof Chart === 'undefined') return;

  const source = cotizacionesFiltered;

  // 1. Evolución Mensual (Gráfico Lineal: Aceptadas, Pendientes y Perdidas para el Año en Curso)
  const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Determinar año en curso (ej: 2026 o el mayor año válido >= 2020)
  const validYears = source.map(r => parseInt(r.ANO)).filter(y => !isNaN(y) && y >= 2020);
  const currentYear = validYears.length > 0 ? Math.max(...validYears) : new Date().getFullYear();

  const titleEl = document.getElementById('chartCotizEvolTitle');
  if (titleEl) titleEl.textContent = `Evolución Mensual: Aceptadas, Pendientes y Perdidas (${currentYear})`;

  const yearRows = source.filter(r => {
    const y = parseInt(r.ANO);
    return y === currentYear;
  });

  const aceptadasData = new Array(12).fill(0);
  const pendientesData = new Array(12).fill(0);
  const perdidasData = new Array(12).fill(0);

  yearRows.forEach(r => {
    const mesLower = String(r.MES_T || '').trim().toLowerCase();
    const idx = MONTH_NAMES.findIndex(m => mesLower.includes(m));
    if (idx < 0) return;

    const est = (r.ESTADO || '').toLowerCase();
    const totalVal = r.TOTAL || 0;

    if (est.includes('aceptada') || est.includes('aprobada') || est.includes('facturada') || Boolean(r.NV) || Boolean(r.FA)) {
      aceptadasData[idx] += totalVal;
    } else if (est.includes('perdida') || est.includes('rechazada')) {
      perdidasData[idx] += totalVal;
    } else {
      pendientesData[idx] += totalVal;
    }
  });

  const ctxEvol = document.getElementById('chartCotizEvolucion');
  if (ctxEvol) {
    if (chartCotizEvolInstance) chartCotizEvolInstance.destroy();
    chartCotizEvolInstance = new Chart(ctxEvol, {
      type: 'line',
      data: {
        labels: MONTH_SHORT,
        datasets: [
          {
            label: '🟢 Aceptadas ($)',
            data: aceptadasData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: '🟡 Pendientes ($)',
            data: pendientesData,
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.15)',
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#fbbf24',
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: '🔴 Perdidas ($)',
            data: perdidasData,
            borderColor: '#f87171',
            backgroundColor: 'rgba(248, 113, 113, 0.15)',
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#f87171',
            pointRadius: 4,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 11, weight: 'bold' }, usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: $${formatNum(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            ticks: { color: '#94a3b8', callback: v => '$' + (v / 1000000).toFixed(1) + 'M' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.03)' }
          }
        }
      }
    });
  }

  // 2. Distribución por Estado
  const estMap = new Map();
  source.forEach(r => {
    const key = r.ESTADO || 'Sin Estado';
    estMap.set(key, (estMap.get(key) || 0) + 1);
  });

  const estLabels = Array.from(estMap.keys());
  const estValues = estLabels.map(k => estMap.get(k));

  const ctxEst = document.getElementById('chartCotizEstado');
  if (ctxEst) {
    if (chartCotizEstadoInstance) chartCotizEstadoInstance.destroy();
    chartCotizEstadoInstance = new Chart(ctxEst, {
      type: 'doughnut',
      data: {
        labels: estLabels,
        datasets: [{
          data: estValues,
          backgroundColor: ['#10b981', '#3b82f6', '#fbbf24', '#f87171', '#8b5cf6', '#ec4899'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 11 } } } }
      }
    });
  }

  // 3. Top Responsables
  const respMap = new Map();
  source.forEach(r => {
    const key = r.RESPONSABLE || 'General';
    respMap.set(key, (respMap.get(key) || 0) + (r.TOTAL || 0));
  });

  const topResp = Array.from(respMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const respLabels = topResp.map(t => t[0]);
  const respValues = topResp.map(t => t[1]);

  const ctxResp = document.getElementById('chartCotizResponsables');
  if (ctxResp) {
    if (chartCotizRespInstance) chartCotizRespInstance.destroy();
    chartCotizRespInstance = new Chart(ctxResp, {
      type: 'bar',
      data: {
        labels: respLabels,
        datasets: [{
          label: 'Total Cotizado ($)',
          data: respValues,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', callback: v => '$' + (v / 1000000).toFixed(1) + 'M' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        }
      }
    });
  }

  // 4. Top 10 Productos
  const prodMap = new Map();
  source.forEach(r => {
    if (!r.SKU && !r.PRODUCTO) return;
    const key = r.SKU ? r.SKU : r.PRODUCTO;
    if (!prodMap.has(key)) {
      prodMap.set(key, { sku: r.SKU, producto: r.PRODUCTO || r.SKU, total: 0, cant: 0 });
    }
    const item = prodMap.get(key);
    item.total += (r.TOTAL || 0);
    item.cant += (r.CANTIDAD || 0);
  });

  const topProds = Array.from(prodMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  const maxProdTotal = topProds.length > 0 ? topProds[0].total : 1;
  const prodListEl = document.getElementById('cotizTopProductsList');

  if (prodListEl) {
    if (topProds.length === 0) {
      prodListEl.innerHTML = `<p style="text-align:center; padding: 2rem; color: #94a3b8;">Sin registros de productos</p>`;
    } else {
      prodListEl.innerHTML = topProds.map((p, idx) => {
        const pct = maxProdTotal > 0 ? (p.total / maxProdTotal) * 100 : 0;
        const rankClass = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
        return `
          <div class="compras-breakdown-item">
            <div class="compras-breakdown-header">
              <div class="compras-item-left">
                <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                <span class="sku-badge-pill">${p.sku || 'SKU'}</span>
                <span class="product-name-title" title="${p.producto}">${p.producto}</span>
              </div>
              <div class="compras-item-right">
                <span class="product-cost-val">$${formatNum(p.total)}</span>
              </div>
            </div>
            <div class="compras-breakdown-bar">
              <div class="compras-breakdown-fill" style="width: ${Math.max(pct, 3)}%; background: linear-gradient(90deg, #10b981, #059669);"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderCotizacionesTable() {
  const tbody = document.getElementById('cotizTableBody');
  const pageInfo = document.getElementById('cotizPageInfo');
  if (!tbody) return;

  const totalFiltered = cotizacionesFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / COTIZ_PAGE_SIZE));
  if (cotizCurrentPage > totalPages) cotizCurrentPage = totalPages;

  const startIdx = (cotizCurrentPage - 1) * COTIZ_PAGE_SIZE;
  const endIdx = startIdx + COTIZ_PAGE_SIZE;
  const pageRows = cotizacionesFiltered.slice(startIdx, endIdx);

  if (pageInfo) pageInfo.textContent = `Página ${cotizCurrentPage} de ${totalPages} (${formatNum(totalFiltered)} cotizaciones)`;

  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: #94a3b8;">No se encontraron cotizaciones registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = pageRows.map(r => {
    let statusBadge = `<span class="cotiz-status-pill cotiz-status--pendiente">⚪ ${r.ESTADO || 'Pendiente'}</span>`;
    const estLower = (r.ESTADO || '').toLowerCase();
    if (estLower.includes('aceptada') || estLower.includes('aprobada') || estLower.includes('facturada')) {
      statusBadge = `<span class="cotiz-status-pill cotiz-status--aceptada">🟢 ${r.ESTADO}</span>`;
    } else if (estLower.includes('perdida') || estLower.includes('rechazada')) {
      statusBadge = `<span class="cotiz-status-pill cotiz-status--perdida">🔴 ${r.ESTADO}</span>`;
    } else if (estLower.includes('enviada')) {
      statusBadge = `<span class="cotiz-status-pill cotiz-status--enviada">🟡 ${r.ESTADO}</span>`;
    } else if (estLower.includes('preparación')) {
      statusBadge = `<span class="cotiz-status-pill cotiz-status--preparacion">🔵 ${r.ESTADO}</span>`;
    }

    const fechaStr = r.FECHA_SOLICITUD instanceof Date ? r.FECHA_SOLICITUD.toLocaleDateString('es-CL') : (r.FECHA_SOLICITUD || '-');
    const nvFaStr = [r.NV ? `NV: ${r.NV}` : '', r.FA ? `FA: ${r.FA}` : ''].filter(Boolean).join(' / ') || '-';

    return `
      <tr>
        <td><span class="pct-badge-pill">${r.TIPO || 'Estándar'}</span></td>
        <td><strong>#${r.COTIZACION || '-'}</strong></td>
        <td>${fechaStr}</td>
        <td><strong>${r.CLIENTE || '-'}</strong></td>
        <td>${r.RUT || '-'}</td>
        <td><span class="sku-badge-pill">${r.SKU || '-'}</span></td>
        <td><span style="font-size:0.85rem;" title="${r.PRODUCTO}">${(r.PRODUCTO || '-').slice(0, 35)}</span></td>
        <td>${formatNum(r.CANTIDAD)}</td>
        <td><strong style="color: #34d399;">$${formatNum(r.TOTAL)}</strong></td>
        <td>${r.RESPONSABLE || '-'}</td>
        <td><span style="font-size:0.8rem; color:#60a5fa;">${nvFaStr}</span></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function initCotizacionesListeners() {
  ['fltCotizDesde', 'fltCotizHasta', 'fltCotizResponsable', 'fltCotizEstado', 'fltCotizTipo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      cotizCurrentPage = 1;
      applyCotizacionesFilters();
    });
  });

  const searchBox = document.getElementById('cotizSearchBox');
  if (searchBox) {
    searchBox.addEventListener('input', () => {
      cotizCurrentPage = 1;
      applyCotizacionesFilters();
    });
  }

  const btnPrev = document.getElementById('btnCotizPrevPage');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (cotizCurrentPage > 1) {
        cotizCurrentPage--;
        renderCotizacionesTable();
      }
    });
  }

  const btnNext = document.getElementById('btnCotizNextPage');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      cotizCurrentPage++;
      renderCotizacionesTable();
    });
  }
}
