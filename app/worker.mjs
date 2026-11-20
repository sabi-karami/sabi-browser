import {DurableObject} from 'cloudflare:workers';
import UI from './ui.html';
import FONT from './vazirmatn.woff2';
import AREF from './aref-ruqaa.woff2';
const HOST='sabi-browser.nikanesalamat.ir', ORIGIN='https://'+HOST;
const LIFE=12*60_000, EXTEND=5*60_000, MAXLIFE=30*60_000, WINDOW=60*60_000, LIMIT=3, WIDTH=1280, HEIGHT=720;
const TXT={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const response=(body,status=200,headers={})=>new Response(body,{status,headers:{...TXT,...headers}});
const json=(data,status=200)=>response(JSON.stringify(data),status,{'content-type':'application/json; charset=utf-8'});
const hex=(bytes)=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
const sha=async(s)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const newKey=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const request=(route,data)=>new Request('https://session.internal'+route,{method:'POST',body:JSON.stringify(data),headers:{'content-type':'application/json'}});
const quota=(env)=>env.SESSIONS.get(env.SESSIONS.idFromName('kitesurf-quota-v1'));
function publicUrl(raw) {
  if(typeof raw!=='string'||raw.length>1800)return null;
  try {
    const v=raw.trim(); if(!v || v.includes('\\'))return null;
    const u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(v)?v:'https://'+v);
    const h=u.hostname.toLowerCase().replace(/\.$/,'');
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!h.includes('.')||/^\d+(?:\.\d+)+$/.test(h)||h.includes(':')||/(?:^|\.)(?:localhost|internal|local|test|invalid|onion|home|arpa)$/.test(h)||/(?:^|\.)nikanesalamat\.ir$/.test(h))return null;
    return u.href;
  } catch {return null;}
}
async function payload(req,max){
  const type=req.headers.get('content-type'); if(!type?.toLowerCase().startsWith('application/json')||!req.body)throw Error('invalid');
  if(Number(req.headers.get('content-length'))>max)throw Error('size');
  const reader=req.body.getReader();let n=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw Error('size');}chunks.push(value);}}
  finally{reader.releaseLock();} const all=new Uint8Array(n);let offset=0;for(const v of chunks){all.set(v,offset);offset+=v.length;}const out=JSON.parse(new TextDecoder().decode(all));if(!out||Array.isArray(out)||typeof out!=='object')throw Error('invalid'); return out;
}
const validOrigin=(req)=>req.headers.get('origin')===ORIGIN&&(!req.headers.get('sec-fetch-site')||req.headers.get('sec-fetch-site')==='same-origin');
const ERR={dead:'نشست پایان یافته است. یک مرورگر تازه باز کن.',limit:'ظرفیت فعلاً پر است. کمی بعد دوباره امتحان کن.',url:'یک آدرس عمومی معتبر وارد کن.',engine:'موتور مرورگر آماده نشد. دوباره تلاش کن.'};
export default {async fetch(req,env){
  const u=new URL(req.url);if(u.host!==HOST||u.protocol!=='https:')return response('Not found',404);
  if(req.headers.get('upgrade'))return response('Not found',404);
  if(u.pathname==='/fonts/vazirmatn.woff2'&&req.method==='GET')return response(FONT,200,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':ORIGIN});
  if(u.pathname==='/fonts/aref-ruqaa.woff2'&&req.method==='GET')return response(AREF,200,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':ORIGIN});
  if(u.pathname==='/'&&req.method==='GET')return response(UI,200,{'content-type':'text/html; charset=utf-8','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'x-frame-options':'DENY'});
  if(u.pathname==='/api/start'&&req.method==='POST'){
    if(!validOrigin(req))return json({error:'Origin not allowed'},403);
    let body;try{body=await payload(req,4096);}catch{return json({error:'Invalid request'},400);}
    const url=publicUrl(body.url);if(!url)return json({error:ERR.url},400);
    const token=newKey(), view=await sha('view|'+token), id=await sha('session|'+view), ip=await sha((req.headers.get('cf-connecting-ip')||'unknown')+'|'+Math.floor(Date.now()/WINDOW));
    const gate=await quota(env).fetch(request('/reserve',{id,ip}));if(gate.status!==204)return json({error:ERR.limit},429);
    try{
      const res=await env.SESSIONS.get(env.SESSIONS.idFromName(id)).fetch(request('/boot',{id,url}));
      if(!res.ok)throw Error('boot');const info=await res.json();return json({token,view,expires:info.expires},201);
    } catch {await quota(env).fetch(request('/release',{id})).catch(()=>{});return json({error:ERR.engine},503);}
  }
  if(!['/api/frame','/api/action','/api/close','/api/extend'].includes(u.pathname))return response('Not found',404);
  if((u.pathname==='/api/frame'&&req.method!=='GET')||(u.pathname!=='/api/frame'&&(req.method!=='POST'||!validOrigin(req))))return json({error:'Invalid request'},403);
  const auth=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization')||'');if(!auth)return json({error:'Session link required'},401);
  const role=req.headers.get('x-kitesurf-role')==='view'?'view':'control';
  if(role==='view'&&u.pathname!=='/api/frame')return json({error:'لینک تماشا فقط اجازهٔ دیدن دارد.'},403);
  const id=await sha('session|'+(role==='view'?auth[1]:await sha('view|'+auth[1]))),stub=env.SESSIONS.get(env.SESSIONS.idFromName(id));
  if(u.pathname==='/api/frame')return stub.fetch(new Request('https://session.internal/frame',{headers:{'x-kitesurf-client':(req.headers.get('x-kitesurf-client')||'').slice(0,16)}}));
  let body={};if(u.pathname==='/api/action'){try{body=await payload(req,4096);}catch{return json({error:'Invalid request'},400);}}
  return stub.fetch(request({'/api/action':'/action','/api/close':'/close','/api/extend':'/extend'}[u.pathname],body));
}};
export class SharedTab extends DurableObject {
  ws=null; pending=new Map(); seq=0; live=false; expires=0; id=null; lastFrame=null; flight=null; at=0; queue=Promise.resolve(); queued=0; rate=[]; frameSeq=0; lastUpdated=Date.now(); viewers=new Map();
  async fetch(req){
    const route=new URL(req.url).pathname;
    if(route==='/renew'){
      const {id,expires}=await req.json();
      return this.ctx.storage.transaction(async tx=>{const s=(await tx.get('quota'))||{active:{},starts:[]};if(s.active[id]){s.active[id]=expires;await tx.put('quota',s);}return response(null,204);});
    }
    if(route==='/reserve'||route==='/release'){
      const {id,ip}=await req.json();const now=Date.now();
      return this.ctx.storage.transaction(async tx=>{
        const s=(await tx.get('quota'))||{active:{},starts:[]};for(const k of Object.keys(s.active)){if(now>=s.active[k])delete s.active[k];}s.starts=s.starts.filter(a=>a[0]>now-WINDOW);
        if(route==='/release'){delete s.active[id];await tx.put('quota',s);return response(null,204);}
        if(Object.keys(s.active).length>=LIMIT||s.starts.length>=20||s.starts.filter(a=>a[1]===ip).length>=5)return response(null,429);
        s.active[id]=now+LIFE+30_000;s.starts.push([now,ip]);await tx.put('quota',s);return response(null,204);
      });
    }
    if(route==='/boot'){
      const {id,url}=await req.json();const born=Date.now();this.id=id;this.expires=born+LIFE;
      await this.ctx.storage.put('lease',{id,expires:this.expires,born});await this.ctx.storage.setAlarm(this.expires);
      try{
        const res=await this.env.ENGINE.fetch(new Request('https://kitesurf-engine.internal/devtools/page/kitesurf',{headers:{upgrade:'websocket'}}));
        const ws=res.webSocket;if(!ws)throw Error('engine status '+res.status);this.ws=ws;ws.accept();this.live=true;
        ws.addEventListener('message',e=>{try{const msg=JSON.parse(e.data); const job=this.pending.get(msg.id);if(job){this.pending.delete(msg.id);clearTimeout(job.timer);if(msg.error)job.reject(Error('Engine command failed'));else job.resolve(msg.result||{});}}catch{}});
        ws.addEventListener('close',()=>{ if(this.live){this.live=false;this.settle();this.ctx.waitUntil(this.finish());} });
        ws.addEventListener('error',()=>{ if(this.live){this.live=false;this.settle();this.ctx.waitUntil(this.finish());} });
        await this.send('Emulation.setDeviceMetricsOverride',{width:WIDTH,height:HEIGHT,deviceScaleFactor:1,mobile:false});
        await this.nav(url);return json({expires:this.expires});
      }catch(e){console.warn('Shared tab engine boot failed',{name:e?.name,stage:this.ws?'command':'connect'});await this.finish();return json({error:ERR.engine},502);}
    }
    if(route==='/close'){await this.finish();return response(null,204);}
    if(!this.live||Date.now()>=this.expires)return json({error:ERR.dead},410);
    if(route==='/frame'){
      const vid=req.headers.get('x-kitesurf-client')||'';const vnow=Date.now();
      if(/^[a-f0-9]{8,16}$/.test(vid))this.viewers.set(vid,vnow);
      for(const [k,t] of this.viewers)if(t<vnow-15_000)this.viewers.delete(k);
      try{
        if(!this.lastFrame||Date.now()-this.at>=450){if(!this.flight){this.flight=this.capture().finally(()=>{this.flight=null;});}await this.flight;}
        const f=this.lastFrame;if(!f)throw Error('no frame');return response(f.data,200,{'content-type':'image/jpeg','x-kitesurf-width':String(WIDTH),'x-kitesurf-height':String(HEIGHT),'x-kitesurf-revision':String(f.rev),'x-kitesurf-location':encodeURIComponent(f.url.slice(0,1700)),'x-kitesurf-expires':String(this.expires),'x-kitesurf-viewers':String(Math.max(1,this.viewers.size))});
      }catch{return json({error:'تصویر موقتاً آماده نیست.'},503);}
    }
    if(route==='/extend'){
      const lease=await this.ctx.storage.get('lease');if(!lease)return json({error:ERR.dead},410);
      const born=lease.born??(lease.expires-LIFE), cap=born+MAXLIFE;
      const next=Math.min(this.expires+EXTEND,cap);
      if(next<=this.expires)return json({expires:this.expires,capped:true});
      this.expires=next;await this.ctx.storage.put('lease',{...lease,expires:next,born});await this.ctx.storage.setAlarm(next);
      await quota(this.env).fetch(request('/renew',{id:lease.id,expires:next+30_000})).catch(()=>{});
      return json({expires:next,capped:next>=cap});
    }
    if(route!=='/action')return response('Not found',404);
    const now=Date.now();this.rate=this.rate.filter(x=>x>now-1000);if(this.queued>=12||this.rate.length>=14)return json({error:'درخواست‌ها زیادند.'},429);this.rate.push(now);
    const body=await req.json();this.queued++;
    const result=this.queue.then(async()=>{if(!this.live||Date.now()>=this.expires)throw Error('closed');await this.control(body);this.at=0;});this.queue=result.catch(()=>{});
    try{await result;return response(null,204);}catch(e){return json({error:e.message==='url'?ERR.url:'این فرمان اجرا نشد.'},400);}finally{this.queued--;}
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{if(!this.live||!this.ws)return reject(Error('closed'));const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('timeout'));},18_000);this.pending.set(id,{resolve,reject,timer});try{this.ws.send(JSON.stringify({id,method,params}));}catch(e){this.pending.delete(id);clearTimeout(timer);reject(e);}});
  }
  async nav(url){const r=await this.send('Page.navigate',{url});if(r.errorText)throw Error('navigation');}
  async capture(){
    const pic=await this.send('Page.captureScreenshot',{format:'jpeg',quality:68,captureBeyondViewport:false});if(typeof pic.data!=='string'||pic.data.length>6_000_000)throw Error('frame');
    let url=this.lastFrame?.url||'';try{const history=await this.send('Page.getNavigationHistory');url=history.entries?.[history.currentIndex]?.url||'';}catch{}
    this.lastFrame={data:Uint8Array.from(atob(pic.data),c=>c.charCodeAt(0)),url,rev:++this.frameSeq};this.at=Date.now();
  }
  async control(m){
    const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):0;
    const point={x:bounded(m.x,0,WIDTH-1),y:bounded(m.y,0,HEIGHT-1),modifiers:bounded(m.modifiers,0,15)};
    if(m.kind==='go'){const url=publicUrl(m.url);if(!url)throw Error('url');return this.nav(url);}
    if(m.kind==='reload')return this.send('Page.reload');
    if(m.kind==='back'||m.kind==='forward'){
      const h=await this.send('Page.getNavigationHistory');const e=h.entries?.[h.currentIndex+(m.kind==='back'?-1:1)];if(e)return this.send('Page.navigateToHistoryEntry',{entryId:e.id});return;
    }
    if(m.kind==='click'){const button=m.button==='right'?'right':'left', clickCount=m.count===2?2:1;await this.send('Input.dispatchMouseEvent',{...point,type:'mousePressed',button,buttons:button==='right'?2:1,clickCount});return this.send('Input.dispatchMouseEvent',{...point,type:'mouseReleased',button,buttons:0,clickCount});}
    if(m.kind==='pointer'){
      if(!['down','move','up'].includes(m.event))throw Error('command');const type={down:'mousePressed',move:'mouseMoved',up:'mouseReleased'}[m.event];const buttons=m.event==='up'?0:1;
      return this.send('Input.dispatchMouseEvent',{...point,type,button:type==='mouseMoved'?'none':'left',buttons,clickCount:1});
    }
    if(m.kind==='wheel')return this.send('Input.dispatchMouseEvent',{...point,type:'mouseWheel',deltaX:bounded(m.dx,-1100,1100),deltaY:bounded(m.dy,-1100,1100)});
    if(m.kind==='text'&&typeof m.text==='string'&&m.text.length>0&&m.text.length<=700)return this.send('Input.insertText',{text:m.text});
    if(m.kind==='key'&&typeof m.key==='string'&&m.key.length>0&&m.key.length<=35){
      const text=typeof m.text==='string'&&m.text.length<=8?m.text:'';const fields={key:m.key,code:typeof m.code==='string'&&m.code.length<40?m.code:'',windowsVirtualKeyCode:bounded(m.vk,0,255),modifiers:point.modifiers};
      await this.send('Input.dispatchKeyEvent',{...fields,type:'keyDown',text});return this.send('Input.dispatchKeyEvent',{...fields,type:'keyUp'});
    }
    throw Error('command');
  }
  settle(){for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(Error('closed'));}this.pending.clear();}
  async finish(){
    this.live=false;const s=this.ws;this.ws=null;this.lastFrame=null;this.settle();if(s)try{s.close(1000,'Session finished');}catch{}
    const lease=await this.ctx.storage.get('lease');if(!lease)return;
    await this.ctx.storage.delete('lease');await this.ctx.storage.deleteAlarm();await quota(this.env).fetch(request('/release',{id:lease.id})).catch(()=>{});
  }
  alarm(){return this.finish();}
}
