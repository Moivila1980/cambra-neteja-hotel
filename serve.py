"""Servidor local de Cambra sense cache (evita servir fitxers antics en recarregar)."""
import http.server, socketserver, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8731


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Cambra -> http://localhost:{PORT}")
    httpd.serve_forever()
