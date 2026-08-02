// Pega aquí la URL de tu Apps Script desplegado como "Aplicación web".



const API_URL = "https://script.google.com/macros/s/AKfycbyMDMYwtWnKRDQ-iixHPKhzTMaBMyb4R8mwRSuE9vWiUX1dybmmT1BhxR9Tt40C5b3vPw/exec";







// (Opcional) ID de tu Google Spreadsheet para activación del canal ultrarrápido GViz (~150ms)



// Ejemplo: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"



const SPREADSHEET_ID = "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ";
const SPREADSHEET_GID = "999482111";







// Configuración de Motor Ultrarrápido & Sincronización



const REFRESH_INTERVAL_MS = 15000;



const ENABLE_LOCAL_CACHE = true;      // Carga instantánea 0ms desde IndexedDB



const ENABLE_OPTIMISTIC_UPDATES = true; // Ediciones e inserciones instantáneas 0ms



const SOUND_EFFECTS = true;             // Efectos sonoros sintetizados por Web Audio







