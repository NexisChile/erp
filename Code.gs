/**
 * API para el Dashboard de Ventas.
 * Se despliega como "Aplicación web" y actúa de puente entre el
 * Google Sheet (hoja "Ventas") y el dashboard HTML en localhost.
 *
 * Estructura de columnas (A:AG) — deben existir exactamente así en la fila 1:
 * FOLIO | TIPO | FECHA | CODIGO | DESCRIPCION | CANTFACTURADA | CODBODE |
 * NVNUMERO | CLIENTE | CODVENDENDOR | SISTEMA | GRUPO | RUT | PREUNI | NETO |
 * GLOSA | FAMILIA | CATEGORIA | LINEA | MARCA | CANAL FINAL | TIENDA FINAL |
 * MES | # MES | AÑO | COSTOS | COSTO TOTAL NET | ($) UTILIDAD | ACUMULADO |
 * ACUMULADO HOY() | QUARTER | COMUNA | REGION
 *
 * Campos que el usuario llena a mano en el formulario:
 * FOLIO, TIPO, FECHA, CODIGO, DESCRIPCION, CANTFACTURADA, CODBODE, NVNUMERO,
 * CLIENTE, CODVENDENDOR, SISTEMA, GRUPO, RUT, PREUNI, GLOSA, FAMILIA,
 * CATEGORIA, LINEA, MARCA, CANAL FINAL, TIENDA FINAL, COSTOS, COMUNA, REGION
 *
 * Campos que este script calcula solo (no se editan a mano):
 * NETO = CANTFACTURADA * PREUNI
 * COSTO TOTAL NET = CANTFACTURADA * COSTOS
 * ($) UTILIDAD = NETO - COSTO TOTAL NET
 * MES, # MES, AÑO, QUARTER -> derivados de FECHA
 * ACUMULADO -> suma corrida de NETO ordenando todas las filas por FECHA
 * ACUMULADO HOY() -> suma de NETO de todas las filas con FECHA <= hoy
 *   (mismo valor para todas las filas: es un total "a la fecha de hoy").
 *   OJO: esta es una interpretación razonable pero es un supuesto —
 *   si tu lógica real de "acumulado" es distinta (ej. por vendedor,
 *   por familia, etc.), ajusta recalcAcumulados_() más abajo.
 */

const SHEET_NAME = 'Ventas';
const HEADERS = [
  'FOLIO', 'TIPO', 'FECHA', 'CODIGO', 'DESCRIPCION', 'CANTFACTURADA', 'CODBODE',
  'NVNUMERO', 'CLIENTE', 'CODVENDENDOR', 'SISTEMA', 'GRUPO', 'RUT', 'PREUNI', 'NETO',
  'GLOSA', 'FAMILIA', 'CATEGORIA', 'LINEA', 'MARCA', 'CANAL FINAL', 'TIENDA FINAL',
  'MES', '# MES', 'AÑO', 'COSTOS', 'COSTO TOTAL NET', '($) UTILIDAD', 'ACUMULADO',
  'ACUMULADO HOY()', 'QUARTER', 'COMUNA', 'REGION'
];

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COL = {}; // nombre de columna -> índice 1-based
HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseFecha_(value) {
  if (value instanceof Date) return value;
  if (!value) return null;

  // 'YYYY-MM-DD' se parsea como medianoche UTC; los getters locales del script
  // retroceden un día en zonas negativas (Chile) y corrompen MES / # MES / AÑO.
  // Se construye en horario local anclado a mediodía para evitar el desfase.
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Calcula NETO, COSTO TOTAL NET, UTILIDAD, MES, # MES, AÑO, QUARTER
// a partir de los campos que el usuario ingresó.
function computeDerivedFields_(d) {
  const cant = Number(d['CANTFACTURADA']) || 0;
  const preuni = Number(d['PREUNI']) || 0;
  const costos = Number(d['COSTOS']) || 0;

  const neto = cant * preuni;
  const costoTotal = cant * costos;
  const utilidad = neto - costoTotal;

  const fecha = parseFecha_(d['FECHA']);
  let mesNombre = '', mesNum = '', anio = '', quarter = '';
  if (fecha) {
    mesNum = fecha.getMonth() + 1;
    mesNombre = MESES_ES[fecha.getMonth()];
    anio = fecha.getFullYear();
    quarter = 'Q' + Math.ceil(mesNum / 3);
  }

  d['NETO'] = neto;
  d['COSTO TOTAL NET'] = costoTotal;
  d['($) UTILIDAD'] = utilidad;
  d['MES'] = mesNombre;
  d['# MES'] = mesNum;
  d['AÑO'] = anio;
  d['QUARTER'] = quarter;
  return d;
}

function buildRowArray_(d) {
  return HEADERS.map(function (h) {
    const v = d[h];
    return (v === undefined || v === null) ? '' : v;
  });
}

// El "id" que usa el frontend es el número de fila real en la hoja. Ese número deja de
// ser válido si otro usuario borra filas por encima mientras el modal está abierto, así
// que cuando el cliente informa el FOLIO esperado se verifica antes de escribir o borrar.
function findRowIndex_(sheet, rowNumber, expectedFolio) {
  const lastRow = sheet.getLastRow();
  const n = Number(rowNumber);
  if (!n || n < 2 || n > lastRow) return -1;

  if (expectedFolio !== undefined && expectedFolio !== null && expectedFolio !== '') {
    const actual = sheet.getRange(n, COL['FOLIO']).getValue();
    if (String(actual).trim() !== String(expectedFolio).trim()) return -1;
  }

  return n;
}

// Recalcula ACUMULADO (suma corrida por fecha) y ACUMULADO HOY()
// en una ÚNICA operación batch de alto rendimiento (2 columnas continuas).
function recalcAcumulados_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const colFechaIdx = COL['FECHA'] - 1;
  const colNetoIdx = COL['NETO'] - 1;
  
  // Obtenemos únicamente la matriz de datos necesaria para procesar velozmente
  const allData = sheet.getRange(2, 1, numRows, HEADERS.length).getValues();

  const items = new Array(numRows);
  for (let i = 0; i < numRows; i++) {
    items[i] = {
      idx: i,
      fecha: parseFecha_(allData[i][colFechaIdx]),
      neto: Number(allData[i][colNetoIdx]) || 0
    };
  }

  const ordered = items.slice().sort(function (a, b) {
    const ta = a.fecha ? a.fecha.getTime() : 0;
    const tb = b.fecha ? b.fecha.getTime() : 0;
    if (ta !== tb) return ta - tb;
    return a.idx - b.idx;
  });

  let running = 0;
  const acumuladoPorIdx = new Array(numRows);
  ordered.forEach(function (it) {
    running += it.neto;
    acumuladoPorIdx[it.idx] = running;
  });

  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  let totalHoy = 0;
  items.forEach(function (it) {
    if (it.fecha && it.fecha.getTime() <= hoy.getTime()) totalHoy += it.neto;
  });

  // ACUMULADO (Col 29) y ACUMULADO HOY() (Col 30) son continuas -> Escribimos juntas en 1 solo RPC
  const batchMatrix = new Array(numRows);
  for (let i = 0; i < numRows; i++) {
    batchMatrix[i] = [acumuladoPorIdx[i], totalHoy];
  }

  sheet.getRange(2, COL['ACUMULADO'], numRows, 2).setValues(batchMatrix);
}

function doGet(e) {
  try {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonOut_({ ok: true, data: [], timestamp: Date.now() });

    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const data = values.map(function (row, i) {
      const obj = {};
      HEADERS.forEach(function (h, j) { obj[h] = row[j]; });
      obj['_row'] = i + 2; // fila real en la hoja, usada como id
      return obj;
    });
    return jsonOut_({ ok: true, data: data, timestamp: Date.now() });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet = getSheet_();
    let result = { ok: true, timestamp: Date.now() };

    if (action === 'add') {
      const d = computeDerivedFields_(body.data || {});
      sheet.appendRow(buildRowArray_(d));
      recalcAcumulados_(sheet);
      result.row = sheet.getLastRow();

    } else if (action === 'update') {
      const row = findRowIndex_(sheet, body.row, body.expectedFolio);
      if (row === -1) { result = { ok: false, error: 'El registro cambió de posición o ya no existe. Actualiza la vista e intenta otra vez.' }; }
      else {
        const d = computeDerivedFields_(body.data || {});
        sheet.getRange(row, 1, 1, HEADERS.length).setValues([buildRowArray_(d)]);
        recalcAcumulados_(sheet);
      }

    } else if (action === 'delete') {
      const row = findRowIndex_(sheet, body.row, body.expectedFolio);
      if (row === -1) { result = { ok: false, error: 'El registro cambió de posición o ya no existe. Actualiza la vista e intenta otra vez.' }; }
      else {
        sheet.deleteRow(row);
        recalcAcumulados_(sheet);
      }

    } else if (action === 'batch_sync') {
      // Permite sincronizar múltiples operaciones en una sola petición.
      // Los índices de fila que envía el cliente corresponden al estado de la hoja
      // ANTES del lote, así que se aplican en un orden que no los invalide:
      // primero las actualizaciones, luego los borrados de mayor a menor fila
      // (borrar la fila N desplaza hacia arriba todas las siguientes), y por
      // último los agregados, que solo escriben al final.
      const ops = body.operations || [];
      const updates = [], deletes = [], adds = [];
      ops.forEach(function (op) {
        if (op.action === 'update') updates.push(op);
        else if (op.action === 'delete') deletes.push(op);
        else if (op.action === 'add') adds.push(op);
      });

      updates.forEach(function (op) {
        const row = findRowIndex_(sheet, op.row);
        if (row !== -1) {
          const d = computeDerivedFields_(op.data || {});
          sheet.getRange(row, 1, 1, HEADERS.length).setValues([buildRowArray_(d)]);
        }
      });

      deletes.sort(function (a, b) { return Number(b.row) - Number(a.row); });
      deletes.forEach(function (op) {
        const row = findRowIndex_(sheet, op.row);
        if (row !== -1) sheet.deleteRow(row);
      });

      adds.forEach(function (op) {
        const d = computeDerivedFields_(op.data || {});
        sheet.appendRow(buildRowArray_(d));
      });

      recalcAcumulados_(sheet);
      result.processed = ops.length;
    } else {
      result = { ok: false, error: 'Accion desconocida: ' + action };
    }

    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}
