#!/usr/bin/env python3
"""Build the Sabi design layer: injects design/parts/* into google-recovery/ui.html -> design/out/."""
import os,re,shutil
B='/storage/sabi-browser'; P=B+'/design/parts'; O=B+'/design/out'
os.makedirs(O,exist_ok=True)
r=lambda n:open(f'{P}/{n}',encoding='utf8').read()
s=open(B+'/google-recovery/ui.html',encoding='utf8').read()
assert s.count('</style>')==1
css=open(B+'/design/art.css',encoding='utf8').read()+r('art2.css')
s=s.replace('</style>','</style><style id="art">'+css+'</style>',1)
s=s.replace('as="font" type="font/woff2" crossorigin>','as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/aref-ruqaa.woff2" as="font" type="font/woff2" crossorigin>',1)
s=s.replace('<meta name="theme-color" content="#0c1018">','<meta name="theme-color" content="#070817">',1)
fav="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'%3E%3Crect width='36' height='36' rx='11' fill='%230b0d2c'/%3E%3Cpath d='M18 5.5 21 15l9.5 3-9.5 3-3 9.5-3-9.5L5.5 18 15 15z' fill='%23ffc24d'/%3E%3Ccircle cx='18' cy='18' r='2.4' fill='%230b0d2c'/%3E%3Ccircle cx='18' cy='18' r='1.2' fill='%236ff0e0'/%3E%3C/svg%3E"
s,n=re.subn(r'<link rel="icon" type="image/svg\+xml" href="[^"]*">','<link rel="icon" type="image/svg+xml" href="'+fav+'">',s,count=1); assert n==1
s=s.replace('<title>Sabi Browser | مرورگر ابری</title>','<title>صابی | Sabi Browser · مرورگر ابری</title>',1)
s=s.replace('</defs>','<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></symbol></defs>',1)
s=s.replace('<body>','<body>'+r('bg.html'),1)
a=s.index('<header>'); b=s.index('</header>')+len('</header>')
s=s[:a]+r('header.html')+s[b:]
a=s.index('<section id="welcome" class="hero">'); b=s.index('<div class="box">'); c=s.index('<div class="context">')
box=s[b:c]; e=s.index('</section>',c)+len('</section>'); rest=s[c:e]
s=s[:a]+r('hero_top.html')+box+r('recent.html')+rest+r('landing.html').replace('بدون ردپا روی دستگاه تو و با IPv6 در دسترس‌اند','با IPv6 هم در دسترس‌اند')+s[e:]
a=s.index('<footer>'); b=s.index('</footer>')+len('</footer>')
s=s[:a]+r('footer.html')+s[b:]
i=s.rindex('</body>')
s=s[:i]+r('overlay.html')+r('art.js.html')+s[i:]
open(O+'/ui.html','w',encoding='utf8').write(s)
w=open(B+'/google-recovery/worker.mjs',encoding='utf8').read()
w=w.replace("import FONT from './vazirmatn.woff2';","import FONT from './vazirmatn.woff2';\nimport AREF from './aref-ruqaa.woff2';",1)
old="if(u.pathname==='/fonts/vazirmatn.woff2'&&req.method==='GET')return response(FONT,200,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':ORIGIN});"
assert old in w
w=w.replace(old,old+"\n  if(u.pathname==='/fonts/aref-ruqaa.woff2'&&req.method==='GET')return response(AREF,200,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':ORIGIN});",1)
open(O+'/worker.mjs','w',encoding='utf8').write(w)
shutil.copy(B+'/design/arefruqaa-700.woff2',O+'/aref-ruqaa.woff2'); shutil.copy(B+'/google-recovery/vazirmatn.woff2',O+'/vazirmatn.woff2')
print('built',len(s))
