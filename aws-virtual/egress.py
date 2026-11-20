import ipaddress, os, re, selectors, socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DENIED = {ipaddress.ip_address(x) for x in os.getenv('SABI_DENY_IPS', '').split(',') if x}

def destination(host, port):
    host = host.rstrip('.').lower().encode('idna').decode('ascii')
    if not host or len(host) > 253 or '.' not in host or not re.fullmatch(r'[a-z0-9.-]+', host):
        raise ValueError('invalid host')
    if host == 'nikanesalamat.ir' or host.endswith(('.nikanesalamat.ir','.internal','.local','.localhost','.arpa','.test','.invalid','.home','.onion','.amazonaws.com','.amazonaws.com.cn')):
        raise ValueError('blocked hostname')
    try: ipaddress.ip_address(host)
    except ValueError: pass
    else: raise ValueError('literal blocked')
    results = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    if not results: raise ValueError('no addresses')
    for row in results:
        ip = ipaddress.ip_address(row[4][0])
        if not ip.is_global or ip.is_multicast or ip in DENIED or ip in ipaddress.ip_network('100.64.0.0/10'):
            raise ValueError('non-public destination')
    return results[0][4]

class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.0'
    def setup(self):
        super().setup(); self.connection.settimeout(8)
    def log_message(self, *args): pass
    def do_CONNECT(self):
        conn = None
        try:
            host, port = self.path.rsplit(':',1)
            if port != '443': raise ValueError('Port is not supported')
            address = destination(host, 443)
            conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM); conn.settimeout(6); conn.connect(address);conn.settimeout(15)
        except (OSError,ValueError):
            if conn: conn.close()
            return self.send_error(403)
        try:
            self.send_response_only(200, 'Connection established'); self.end_headers()
            with selectors.DefaultSelector() as sel:
                sel.register(self.connection, selectors.EVENT_READ, conn); sel.register(conn, selectors.EVENT_READ, self.connection)
                count=0
                while True:
                    ready=sel.select(45)
                    if not ready: return
                    for key, _ in ready:
                        data=key.fileobj.recv(65536)
                        if not data: return
                        count+=len(data)
                        if count>60_000_000:return
                        key.data.sendall(data)
        except OSError: pass
        finally: conn.close()
    def do_GET(self):
        # HTTP destinations are upgraded only by the application when the user omits a scheme.
        # No plaintext transport is exposed by the public browser service.
        self.send_error(403, 'HTTPS only')

class LimitedServer(ThreadingHTTPServer):
    request_queue_size=32
    def server_bind(self):
        from threading import BoundedSemaphore
        self.capacity=BoundedSemaphore(80);super().server_bind()
    def process_request(self, request, address):
        if not self.capacity.acquire(blocking=False):return self.shutdown_request(request)
        try:super().process_request(request,address)
        except: self.capacity.release();raise
    def process_request_thread(self,request,address):
        try:super().process_request_thread(request,address)
        finally:self.capacity.release()

if __name__=='__main__':
    LimitedServer(('172.29.63.3',3128),Handler).serve_forever()
