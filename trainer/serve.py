"""Run the local, offline MRI trainer. No external services or API keys."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import errno
import sys
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
    if not 1 <= args.port <= 65535:
        parser.error('--port는 1~65535 사이의 고정 포트여야 합니다.')
    root = Path(__file__).resolve().parent
    handler = partial(MRIHandler, directory=str(root))
    try:
        server = MRIServer(('0.0.0.0', args.port), handler)
    except OSError as error:
        if error.errno == errno.EADDRINUSE:
            print(f'포트 {args.port}가 이미 사용 중입니다. 포트는 자동으로 변경하지 않습니다.\n'
                  f'MRI Tutor가 이미 실행 중이면 http://127.0.0.1:{args.port}/ 에 접속하세요.\n'
                  f'다른 프로그램이 사용 중이면 해당 프로그램을 종료한 뒤 다시 실행하세요.\n'
                  f'사용 중인 프로세스 확인: lsof -nP -iTCP:{args.port} -sTCP:LISTEN', file=sys.stderr)
        else:
            print(f'0.0.0.0:{args.port}에서 서버를 시작할 수 없습니다: {error}', file=sys.stderr)
        return 1
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'네트워크 수신: 0.0.0.0:{server.server_port} (다른 기기에서는 이 컴퓨터의 IP 주소로 접속)', flush=True)
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
    sys.exit(main())
