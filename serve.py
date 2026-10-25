"""開発用のサーバー。

python -m http.server は、Windows では .js を text/plain として返すことがあり、
ブラウザが画面のプログラム（ES Modules）を動かさない。また古いファイルが
キャッシュに残ると、新旧のファイルが混ざって動かなくなる。
このサーバーは .js を正しい種類で返し、キャッシュも使わせない。

使い方: python serve.py   （http://localhost:8000/ を開く）
"""
import http.server
import sys
from functools import partial
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=str(ROOT)))
    print(f'http://localhost:{PORT}/ を開いてください（止めるときは Ctrl+C）')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
