"""Run the local, offline MRI trainer. No external services or API keys."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import webbrowser


class MRIHandler(SimpleHTTPRequestHandler):
    # Persistent connections avoid a fresh socket for each ES module/volume.
    protocol_version = 'HTTP/1.1'


class MRIServer(ThreadingHTTPServer):
    # Browsers request modules, MRI and meshes together; the default backlog is 5.
    request_queue_size = 128


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int, default=8091)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = partial(MRIHandler, directory=str(root))
    try:
        server = MRIServer(('127.0.0.1', args.port), handler)
    except OSError:
        server = MRIServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'MRI Tutor: {url}\n사용 중 이 서버를 유지하세요. 종료하려면 Ctrl+C를 누르세요.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
