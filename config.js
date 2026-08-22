// URL de tu Google Apps Script desplegado como "Aplicación web"
const API_URL = "https://script.google.com/macros/s/AKfycbyMDMYwtWnKRDQ-iixHPKhzTMaBMyb4R8mwRSuE9vWiUX1dybmmT1BhxR9Tt40C5b3vPw/exec";

// ID de tu Google Spreadsheet y GIDs de pestañas
const SPREADSHEET_ID = "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ";
const SPREADSHEET_GID = "999482111"; // Pestaña Ventas
const SPREADSHEET_COTIZACIONES_GID = "2001859242"; // Pestaña Cotizaciones

// Configuración de Auto-Actualización y Sincronización Automática en Segundo Plano
const ENABLE_AUTO_REFRESH = true;        // Habilita auto-refresco automático
// Una recarga completa tarda ~3s por el proxy local, pero ~45s en GitHub Pages (JSONP).
// Con 15s la app quedaba descargando la hoja entera de forma continua sin llegar a
// terminar entre ciclos. Bájalo si solo usas el servidor local.
const REFRESH_INTERVAL_MS = 120000;       // Frecuencia de actualización (2 minutos)
const ENABLE_LOCAL_CACHE = true;          // Carga instantánea 0ms desde IndexedDB
const ENABLE_OPTIMISTIC_UPDATES = true;   // Ediciones e inserciones instantáneas 0ms
const SOUND_EFFECTS = true;               // Efectos sonoros sintetizados por Web Audio
