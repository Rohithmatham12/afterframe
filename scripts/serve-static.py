"""Local static-export server with production-style compression and immutable hash caching."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, gzip, io

class Static(SimpleHTTPRequestHandler):
    def send_head(self):
        path=Path(self.translate_path(self.path))
        if path.is_dir(): path=path/'index.html'
        if not path.is_file(): return super().send_head()
        data=path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type',self.guess_type(str(path)))
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','public, max-age=31536000, immutable' if '/_next/static/' in self.path else 'no-cache')
        self.send_header('Vary','Accept-Encoding')
        if 'gzip' in self.headers.get('Accept-Encoding','') and path.suffix in ['.html','.js','.css','.json','.svg','.txt','.webmanifest']:
            data=gzip.compress(data);self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',str(len(data)));self.end_headers()
        return io.BytesIO(data)
    def log_message(self,*args): pass

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=3000);parser.add_argument('--directory',default=str(Path(__file__).resolve().parents[1]/'frontend/out'));args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),lambda *a,**kw:Static(*a,directory=args.directory,**kw))
    print(f'Afterframe static export: http://127.0.0.1:{args.port}',flush=True);server.serve_forever()
