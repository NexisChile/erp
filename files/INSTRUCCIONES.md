# Glomax S.A. — Guía de Instalación & Motor Ultrarrápido 0ms

Dashboard de análisis de ventas interactivo que corre en tu `localhost` y se conecta con Google Sheets con **carga instantánea (0 ms)** y tecnología de sincronización en segundo plano (Stale-While-Revalidate + IndexedDB).

---

## 🚀 Innovaciones de Conexión & Business Intelligence Suite

1. **Carga Instantánea 0 ms (IndexedDB `GlomaxDB`)**: La aplicación abre y renderiza inmediatamente con los datos locales previamente guardados sin esperar a la red.
2. **Actualización Optimista**: Al guardar una venta, la UI responde en **0 ms** e inserta la fila localmente mientras sincroniza en segundo plano.
3. **Glomax BI Analytics Studio (Pestaña BI)**:
   - **Simulador de Escenarios "What-If"**: Deslizadores en tiempo real para simular el impacto financiero de variaciones de precio, volumen y costo.
   - **Análisis de Pareto 80/20**: Identifica qué 20% de clientes generan el 80% del ingreso total.
   - **Segmentación RFM de Clientes**: Clasifica automáticamente a la cartera en *👑 VIP Champions*, *⭐ Leales*, *⚠️ En Riesgo* y *🌱 Nuevos*.
   - **Cross-Filtering Drill-Down**: Hacer clic en cualquier gráfico filtra instantáneamente todo el dashboard por esa dimensión.
   - **Resumen Ejecutivo Inteligente**: Generador automático de diagnósticos de negocio en lenguaje natural.
4. **Command Palette Omnibox (`Ctrl + K` / `Cmd + K`)**: Buscador flotante para ejecutar comandos, filtrar por folio/cliente o cambiar de vista usando solo el teclado.
5. **Efectos de Audio WebAudio FX**: Confirmaciones sonoras sutiles sintetizadas en tiempo real (con botón ON/OFF en la cabecera).

---

## 1. Crea el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja nueva (o usa la que ya tengas con tus datos de ventas).
2. Renombra la pestaña donde están tus datos a **`Ventas`** (exactamente así).
3. En la fila 1, deja estos encabezados exactos, uno por columna (A a AG):

   ```
   FOLIO | TIPO | FECHA | CODIGO | DESCRIPCION | CANTFACTURADA | CODBODE | NVNUMERO |
   CLIENTE | CODVENDENDOR | SISTEMA | GRUPO | RUT | PREUNI | NETO | GLOSA | FAMILIA |
   CATEGORIA | LINEA | MARCA | CANAL FINAL | TIENDA FINAL | MES | # MES | AÑO | COSTOS |
   COSTO TOTAL NET | ($) UTILIDAD | ACUMULADO | ACUMULADO HOY() | QUARTER | COMUNA | REGION
   ```

## 2. Instala el Apps Script Optimizado

1. En tu Sheet, ve a **Extensiones → Apps Script**.
2. Reemplaza el contenido de `Code.gs` con el `Code.gs` actualizado (que incluye escrituras en lote de 2 columnas e impresiones ultrarrápidas).
3. Guarda el proyecto (`Ctrl+S`).

## 3. Despliega como Aplicación web

1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**.
4. **Implementar** y autoriza los permisos.
5. Copia la **URL de la aplicación web** (termina en `/exec`).

## 4. Configura el frontend (`config.js`)

Abre `config.js` y pega tu URL de Apps Script:

```js
const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";

// (Opcional) Pega el ID de tu Spreadsheet para máxima aceleración GViz (~150ms):
const SPREADSHEET_ID = "TU_SPREADSHEET_ID_AQUI";
```

## 5. Corre el servidor en localhost

Ejecuta el servidor Proxy local con Python (necesario para evitar bloqueos CORS en el computador y habilitar el canal ultrarrápido):

```bash
python server.py
```

Abre `http://localhost:8000` o `http://127.0.0.1:8000` en tu navegador.

---

## 🌐 6. Despliegue en Netlify (¡Compatibilidad 100% Automática!)

El proyecto cuenta con **Netlify Serverless Functions** (`netlify/functions/proxy.mjs` y `netlify/functions/glomax-products.mjs`) y archivo de configuración `netlify.toml` + `_redirects` integrados.

### Pasos para desplegar en Netlify:
1. Inicia sesión en [Netlify](https://app.netlify.com).
2. Arrastra y suelta la carpeta de la aplicación directamente en la sección **Sites -> Drop**.
3. ¡Listo! Netlify desplegará el sitio y activará las Serverless Functions automáticamente.
4. Las llamadas a `/api/proxy` y `/api/glomax-products` se ejecutarán en la nube de Netlify sin bloqueos CORS ni necesidad de servidor Python local.

---

## Atajos de Teclado Útiles

- **`Ctrl + K` / `Cmd + K`**: Abre la Command Palette para búsqueda y acciones rápidas.
- **`ESC`**: Cierra la Command Palette o los modales activos.


