import {createServer} from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {control, publicUrl} from './control.mjs';
const ORIGIN='https://sabi-virtual.nikanesalamat.ir', HOST=new URL(ORIGIN).hostname;
const LIFE=720000, EXTEND=300000, MAX=1800000, WIDTH=1280, HEIGHT=720;
const sessions=new Map(), keys=new Map(), starts=[];let launching=false;
const sha=s=>createHash('sha256').update(s).digest('hex');
const ui=readFileSync(new URL('./ui.html',import.meta.url)), font=readFileSync(new URL('./vazirmatn.woff2',import.meta.url));
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const send=(r,status,data,h={})=>{if(r.headersSent||r.destroyed)return;r.writeHead(status,{...headers,...h});r.end(data);};
const json=(r,status,o)=>send(r,status,JSON.stringify(o),{'content-type':'application/json; charset=utf-8'});
const error=(r,status,text)=>json(r,status,{error:text});
const ended='این نشست پایان یافته است.';
async function body(req){if(req.headers['content-type']!=='application/json')throw Error();let total=0, chunks=[];for await(const c of req){total+=c.length;if(total>4096){return null;}chunks.push(c);}const v=JSON.parse(Buffer.concat(chunks).toString());return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}
async function end(s){if(s.closed)return;s.closed=true;keys.delete(s.tokenHash);keys.delete(s.viewHash);try{await s.browser?.close();}finally{sessions.delete(s.id);}}
async function start(address,ip){
 const token=randomBytes(32).toString('hex'), view=sha('view|'+token), now=Date.now();
 while(starts.length&&starts[0].at<now-3600000)starts.shift();
 if(launching||sessions.size>=2||starts.length>=30||starts.filter(x=>x.ip===ip).length>=6)return null;
 launching=true;starts.push({at:now,ip});const s={id:randomBytes(16).toString('hex'),created:now,expires:now+LIFE,tokenHash:sha(token),viewHash:sha(view),viewers:new Map(),rate:[],queue:Promise.resolve(),queued:0,revision:0,at:0};sessions.set(s.id,s);
 try{
  s.browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:14000,args:['--disable-quic','--disable-background-networking','--disable-features=DnsOverHttps','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE egress','--proxy-bypass-list=<-loopback>'],proxy:{server:'http://egress:3128'}});
  if(s.closed){await s.browser.close();throw Error();}
  s.context=await s.browser.newContext({viewport:{width:WIDTH,height:HEIGHT},acceptDownloads:false,permissions:[],serviceWorkers:'block'});
  s.page=await s.context.newPage();s.page.setDefaultTimeout(6000);
  s.context.on('page',p=>{if(p!==s.page)void p.close().catch(()=>{});});
  s.cdp=await s.context.newCDPSession(s.page);
  await s.page.goto(address,{waitUntil:'commit',timeout:8000});
  if(s.closed)throw Error();
  keys.set(s.tokenHash,{s,view:false});keys.set(s.viewHash,{s,view:true});s.browser.once('disconnected',()=>void end(s).catch(()=>{}));
  return {token,view,expires:s.expires};
 }catch(e){console.warn('browser launch/navigation failed:',e.name);await end(s).catch(()=>{});throw Error('browser');}finally{launching=false;}
}
async function capture(s){
 if(s.flight)return s.flight;
 if(s.last&&Date.now()-s.at<450)return s.last;
 s.flight=(async()=>{const url=s.page.url();const {data}=await s.cdp.send('Page.captureScreenshot',{format:'jpeg',quality:68,captureBeyondViewport:false});if(data.length>4_000_000)throw Error();let location='';try{const u=new URL(url);if(['http:','https:'].includes(u.protocol)){u.username='';u.password='';location=u.href;}}catch{}const last={jpeg:Buffer.from(data,'base64'),location,rev:++s.revision};s.at=Date.now();s.last=last;return last;})().finally(()=>{s.flight=null;});return s.flight;
}
const server=createServer({requestTimeout:10000,headersTimeout:8000,maxHeaderSize:8192},async(req,res)=>{
 try{
  if(req.headers.host!==HOST)return send(res,404,'Not found');
  const p=req.url,m=req.method;
  if(m==='GET'&&p==='/health')return json(res,200,{ok:true,engine:'chromium'});
  if(m==='GET'&&(p==='/'||p.startsWith('/?')))return send(res,200,ui,{'content-type':'text/html; charset=utf-8','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
  if(m==='GET'&&p==='/fonts/vazirmatn.woff2')return send(res,200,font,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable'});
  if(!['/api/start','/api/frame','/api/action','/api/close','/api/extend'].includes(p))return send(res,404,'Not found');
  if(p==='/api/frame'?m!=='GET':m!=='POST'||req.headers.origin!==ORIGIN||!['same-origin',undefined].includes(req.headers['sec-fetch-site']))return error(res,403,'درخواست مجاز نیست.');
  if(p==='/api/start'){
   const d=await body(req).catch(()=>null), u=publicUrl(d?.url);if(!u)return error(res,400,'آدرس عمومی معتبر وارد کن.');
   const ip=req.headers['x-sabi-client-ip']||'unknown';const info=await start(u,ip).catch(()=>false);
   if(info===null)return error(res,429,'ظرفیت مرورگر مجازی فعلاً پر است. کمی بعد دوباره امتحان کن.');
   return info?json(res,201,info):error(res,503,'صفحه باز نشد. آدرس دیگری را امتحان کن.');
  }
  const match=/^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization||'');if(!match)return error(res,401,'لینک نشست لازم است.');
  const k=keys.get(sha(match[1]));if(!k||k.s.closed||Date.now()>=k.s.expires)return error(res,410,ended);
  const {s,view}=k;if(view&&p!=='/api/frame')return error(res,403,'لینک تماشا فقط اجازهٔ دیدن دارد.');
  if(p==='/api/close'){await end(s).catch(()=>{});return send(res,204);}
  if(p==='/api/extend'){const cap=s.created+MAX, next=Math.min(s.expires+EXTEND,cap);s.expires=next;return json(res,200,{expires:next,capped:next>=cap});}
  if(p==='/api/frame'){
   if((s.frameRequests??=0)>=8)return error(res,429,'درخواست‌ها زیادند.');s.frameRequests++;
   try{const now=Date.now(), client=req.headers['x-kitesurf-client']||'';for(const [id,t] of s.viewers)if(t<now-15000)s.viewers.delete(id);if(/^[0-9a-f]{8,16}$/.test(client)&&(s.viewers.size<30||s.viewers.has(client)))s.viewers.set(client,now);
    const f=await capture(s);return send(res,200,f.jpeg,{'content-type':'image/jpeg','x-kitesurf-width':WIDTH,'x-kitesurf-height':HEIGHT,'x-kitesurf-expires':s.expires,'x-kitesurf-revision':f.rev,'x-kitesurf-location':encodeURIComponent(f.location.slice(0,1500)),'x-kitesurf-viewers':Math.max(1,s.viewers.size)});
   }catch{return error(res,503,'تصویر موقتاً آماده نیست.');}finally{s.frameRequests--;}
  }
  const now=Date.now();s.rate=s.rate.filter(t=>t>now-1000);if(s.rate.length>=14||s.queued>=10)return error(res,429,'درخواست‌ها زیادند.');s.rate.push(now);s.queued++;
  try{const d=await body(req).catch(()=>null);if(!d)return error(res,400,'فرمان نامعتبر است.');const q=s.queue.then(async()=>{if(s.closed)throw Error();await control(s,d);s.at=0;});s.queue=q.catch(()=>{});await q;return send(res,204);}catch{return error(res,400,'فرمان اجرا نشد.');}finally{s.queued--;}
 }catch{return error(res,500,'خطای موقت مرورگر مجازی.');}
});
server.on('upgrade',(req,socket)=>socket.destroy());server.maxConnections=100;server.listen(8080,'172.29.63.2');
setInterval(()=>{const now=Date.now();for(const s of sessions.values())if(s.expires<=now)void end(s).catch(()=>{});},5000).unref();
process.once('SIGTERM',()=>{server.close();Promise.allSettled([...sessions.values()].map(end)).finally(()=>process.exit(0));});
