# -*- coding: utf-8 -*-
"""
Servidor simple y estable para el Dashboard.
Sirve archivos estaticos + endpoint /api/proxy para CSV de Google Sheets.
"""
import sys
import os
import socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuracion
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SPREADSHEET_ID = "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ"
SPREADSHEET_GID = "999482111"

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


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]

        # Ruta proxy: descarga CSV desde Google Sheets y lo devuelve
        if path == '/api/proxy' or path == '/api/csv':
            self._proxy_csv()
            return

        # Archivos estaticos
        if path == '/' or path == '':
            path = '/index.html'

        file_path = os.path.join(DIRECTORY, path.lstrip('/').replace('/', os.sep))
        if not os.path.isfile(file_path):
            self.send_error(404, 'Not Found')
            return

        ext = os.path.splitext(file_path)[1].lower()
        content_type = MIME_TYPES.get(ext, 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
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

        import time
        url = (
            "https://docs.google.com/spreadsheets/d/{}/export"
            "?format=csv&gid={}&_={}"
        ).format(SPREADSHEET_ID, SPREADSHEET_GID, int(time.time() * 1000))
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (compatible; DashboardProxy/1.0)'}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            msg = ("ERROR: " + str(e)).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(msg)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, fmt, *args):
        # Solo loggear errores, no cada request
        if args and len(args) >= 2 and str(args[1]).startswith(('4', '5')):
            sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))


def main():
    os.chdir(DIRECTORY)

    # Liberar puerto si ya esta en uso
    HTTPServer.allow_reuse_address = True

    server = HTTPServer(('0.0.0.0', PORT), Handler)
    host = socket.gethostname()
    print("=" * 50)
    print("  Dashboard Server iniciado")
    print("  -> http://localhost:{}".format(PORT))
    print("  -> http://127.0.0.1:{}".format(PORT))
    print("  Presiona Ctrl+C para detener")
    print("=" * 50)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()


if __name__ == '__main__':
    main()
