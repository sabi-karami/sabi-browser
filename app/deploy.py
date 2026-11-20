#!/usr/bin/env python3
"""Deploy the Sabi Browser main worker (kitesurf-shared) from a directory containing
worker.mjs, ui.html, vazirmatn.woff2, aref-ruqaa.woff2.
Auth: set CLOUDFLARE_API_TOKEN (Workers Scripts:Edit); in 3B chat the connector injects it.
Usage: python3 deploy.py [dir]   # dir defaults to .
"""
import json,os,sys,time,urllib.request,urllib.error,uuid
D=sys.argv[1] if len(sys.argv)>1 else '.'
TOK=os.environ.get('CLOUDFLARE_API_TOKEN')
def api(m,p,data=None,hdr=None):
    h=dict(hdr or {})
    if TOK: h['Authorization']='Bearer '+TOK
    req=urllib.request.Request('https://api.cloudflare.com/client/v4'+p,data=data,method=m,headers=h)
    try: return json.loads(urllib.request.urlopen(req,timeout=40).read())
    except urllib.error.HTTPError as e: return {'http':e.code,'body':e.read().decode()[:1500]}
acct=os.environ.get('CF_ACCOUNT_ID') or api('GET','/accounts')['result'][0]['id']
S='kitesurf-shared'
meta={"main_module":"worker.mjs","compatibility_date":"2026-09-11","compatibility_flags":["global_fetch_strictly_public"],
 "bindings":[{"type":"durable_object_namespace","name":"SESSIONS","class_name":"SharedTab"},
             {"type":"service","name":"ENGINE","service":"kitesurf-upstream","environment":"production","entrypoint":"KitesurfEngine"}],
 "observability":{"enabled":True,"redact_query_string":True,"logs":{"invocation_logs":False}}}
b=uuid.uuid4().hex
def part(n,ct,body): return (f'--{b}\r\nContent-Disposition: form-data; name="{n}"; filename="{n}"\r\nContent-Type: {ct}\r\n\r\n').encode()+body+b'\r\n'
rd=lambda f:open(os.path.join(D,f),'rb').read()
body=b''.join([part('metadata','application/json',json.dumps(meta).encode()),
 part('worker.mjs','application/javascript+module',rd('worker.mjs')),
 part('ui.html','text/plain',rd('ui.html')),
 part('vazirmatn.woff2','application/octet-stream',rd('vazirmatn.woff2')),
 part('aref-ruqaa.woff2','application/octet-stream',rd('aref-ruqaa.woff2'))])+f'--{b}--\r\n'.encode()
r=api('PUT',f'/accounts/{acct}/workers/scripts/{S}',body,{'Content-Type':'multipart/form-data; boundary='+b})
print('upload success:',r.get('success'),r.get('errors') or r.get('body'))
if r.get('success'):
    time.sleep(2)
    vid=api('GET',f'/accounts/{acct}/workers/scripts/{S}/versions')['result']['items'][0]['id']
    d=api('POST',f'/accounts/{acct}/workers/scripts/{S}/deployments',json.dumps({"strategy":"percentage","versions":[{"version_id":vid,"percentage":100}]}).encode(),{'Content-Type':'application/json'})
    print('version',vid,'deploy',d.get('success'))
    print(api('POST',f'/accounts/{acct}/workers/scripts/{S}/subdomain',json.dumps({"enabled":False,"previews_enabled":False}).encode(),{'Content-Type':'application/json'}).get('result'))
