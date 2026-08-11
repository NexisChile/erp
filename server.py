# -*- coding: utf-8 -*-
"""
Servidor de Alto Rendimiento para Dashboard Glomax.
Respuesta instantánea 5ms con Caché Local de Disco/RAM.
"""
import sys
import os
import time
import threading
import urllib.request
from urllib.parse import parse_qs, urlparse
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SPREADSHEET_ID = "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ"
SPREADSHEET_GID = "999482111"

CACHE_DIR = os.path.join(DIRECTORY, ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)
CSV_CACHE_FILE = os.path.join(CACHE_DIR, "ventas_cache.csv")

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.svg':  'image/svg+xml',
}

MEMORY_CSV_CACHE = None

# Cargar caché existente en disco AL INICIAR SERVIDOR
if os.path.exists(CSV_CACHE_FILE):
    try:
        with open(CSV_CACHE_FILE, 'rb') as f:
            MEMORY_CSV_CACHE = f.read()
        print(f"[Server Startup] Cache local CSV cargada ({len(MEMORY_CSV_CACHE):,} bytes)")
    except Exception as e:
        print(f"[Server Startup] Error leyendo cache disco: {e}")

def update_csv_cache_bg():
    global MEMORY_CSV_CACHE
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={SPREADSHEET_GID}&_={int(time.time()*1000)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
            if len(data) > 1000 and (b',' in data or b';' in data):
                MEMORY_CSV_CACHE = data
                with open(CSV_CACHE_FILE, 'wb') as f:
                    f.write(data)
                print(f"[BG Sync] Sincronizados {len(data):,} bytes desde Google Sheets")
    except Exception as e:
        print(f"[BG Sync] Reintento en segundo plano: {e}")

# Hilo de sincronización en segundo plano (cada 3 minutos)
def bg_thread():
    while True:
        update_csv_cache_bg()
        time.sleep(180)

t = threading.Thread(target=bg_thread, daemon=True)
t.start()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Silenciar logs repetitivos

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Endpoint /api/proxy (Respuesta instantánea < 10ms)
        if path in ['/api/proxy', '/api/csv']:
            self._proxy_csv()
            return

        # Endpoint /api/glomax-products
        if path in ['/api/glomax-products', '/api/glomax']:
            self._proxy_glomax()
            return

        # Archivos estáticos
        if path == '/' or path == '':
            path = '/index.html'

        file_p = os.path.join(DIRECTORY, path.lstrip('/').replace('/', os.sep))
        if not os.path.isfile(file_p):
            self.send_error(404, 'Not Found')
            return

        ext = os.path.splitext(file_p)[1].lower()
        content_type = MIME_TYPES.get(ext, 'application/octet-stream')

        try:
            with open(file_p, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def _proxy_csv(self):
        global MEMORY_CSV_CACHE
        data = MEMORY_CSV_CACHE

        if not data and os.path.exists(CSV_CACHE_FILE):
            with open(CSV_CACHE_FILE, 'rb') as f:
                data = f.read()

        if data:
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
                self.end_headers()
                self.wfile.write(data)
            except (ConnectionAbortedError, BrokenPipeError):
                pass
        else:
            msg = b"ERROR: Cargando datos iniciales..."
            self.send_response(503)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(msg)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(msg)

    def _proxy_glomax(self):
        msg = b'{"products":[]}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(msg)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(msg)

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, Handler)
    print(f"SERVIDO EN http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
