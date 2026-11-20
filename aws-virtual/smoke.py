#!/usr/bin/env python3
"""Verify the deployed Sabi AWS edition with a disposable session and example.org fixtures."""
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = 'https://sabi-virtual.nikanesalamat.ir'
BASE = 'https://example.org/'

def call(path, data=None, token=None):
    headers = {'User-Agent': 'SabiVirtualSmoke/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        headers.update({'Content-Type': 'application/json', 'Origin': ORIGIN})
    req = urllib.request.Request(ORIGIN + path, data=None if data is None else json.dumps(data).encode(), method='GET' if data is None else 'POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=23) as res:
            return res.status, res.headers, res.read(4_000_001)
    except urllib.error.HTTPError as e:
        return e.code, e.headers, b''

def expect(path, status, data=None, token=None):
    code, headers, body = call(path, data, token)
    if code != status:
        raise RuntimeError(f'{path}: expected HTTP {status}, got {code}')
    return headers, body

def frame(token, *, view=False, tab_id=None):
    for _ in range(9):
        code, headers, body = call('/api/frame', token=token)
        if code not in (200, 503):
            raise RuntimeError(f'Unexpected frame HTTP {code}')
        idx = headers.get('x-sabi-active-tab', '')
        if code == 200 and (tab_id is None or idx == tab_id):
            assert re.fullmatch(r'[a-f0-9]{16}', idx) and body.startswith(b'\xff\xd8')
            raw = headers.get('x-sabi-tabs')
            assert (raw is None) == view
            return idx, [] if view else json.loads(urllib.parse.unquote(raw))
        time.sleep(0.6)
    raise RuntimeError('No frame for the requested tab')

def main():
    _, ui = expect('/', 200)
    assert all(b'data-mode="' + s + b'"' in ui for s in (b'tab', b'full', b'devtools'))
    _, font = expect('/fonts/vazirmatn.woff2', 200)
    assert font.startswith(b'wOF2')
    _, payload = expect('/api/start', 201, {'url': BASE})
    d = json.loads(payload)
    token, view = d['token'], d['view']
    try:
        assert view == hashlib.sha256(('view|' + token).encode()).hexdigest()
        first, tabs = frame(token)
        assert len(tabs) == 1
        frame(view, view=True, tab_id=first)
        expect('/api/action', 403, {'kind': 'tab-new'}, view)
        expect('/api/inspect', 403, token=view)
        expect('/api/action', 204, {'kind': 'tab-new'}, token)
        second, tabs = frame(token)
        assert first != second and len(tabs) == 2
        expect('/api/action', 204, {'kind': 'go', 'tab': second, 'url': BASE}, token)
        _, inspection = expect('/api/inspect', 200, token=token)
        assert json.loads(inspection)['id'] == second
        expect('/api/action', 204, {'kind': 'tab-select', 'id': first}, token)
        frame(token, tab_id=first)
        expect('/api/action', 204, {'kind': 'tab-close', 'id': second}, token)
        _, extension = expect('/api/extend', 200, {}, token)
        assert json.loads(extension)['expires'] > d['expires']
    finally:
        expect('/api/close', 204, {}, token)
    expect('/api/frame', 410, token=view)
    print('PASS: UI, font, Chromium JPEG, tab lifecycle, passive inspection, view-only permissions, extension and cleanup')

if __name__ == '__main__':
    main()
