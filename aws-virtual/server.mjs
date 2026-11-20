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
const MAX_TABS=4;
const push=(list,item)=>{list.push(item);if(list.length>36)list.shift();};
function hostOf(raw){try{const u=new URL(raw);return u.protocol==='https:'?u.hostname.slice(0,120):'';}catch{return '';}}
function activate(s,tab){s.active=tab.id;s.page=tab.page;s.cdp=tab.cdp;s.last=null;s.at=0;}
async function createTab(s){
 if(s.tabs.size>=MAX_TABS||s.closed)throw Error('tab-limit');
 const page=await s.context.newPage();
 try{
  const cdp=await s.context.newCDPSession(page),id=randomBytes(8).toString('hex');
  const tab={id,page,cdp,console:[],network:[],title:''};
  page.setDefaultTimeout(6000);
  page.on('popup',p=>void p.close().catch(()=>{}));
  page.on('console',m=>push(tab.console,{type:m.type(),text:m.text().slice(0,220)}));
  page.on('pageerror',()=>push(tab.console,{type:'error',text:'خطای JavaScript در صفحه'}));
  page.on('response',res=>{const host=hostOf(res.url());if(host)push(tab.network,{method:res.request().method().slice(0,10),host,status:res.status()});});
  page.on('framenavigated',frame=>{if(frame!==page.mainFrame())return;tab.title='';s.at=0;});
  page.on('domcontentloaded',()=>void page.title().then(x=>{tab.title=x.slice(0,70);}).catch(()=>{}));
  page.on('close',()=>{s.tabs.delete(id);if(!s.closed&&s.active===id){const last=[...s.tabs.values()].at(-1);if(last)activate(s,last);else void end(s).catch(()=>{});}});
  s.tabs.set(id,tab);activate(s,tab);return tab;
 }catch(e){await page.close().catch(()=>{});throw e;}
}
function listTabs(s){return [...s.tabs.values()].map(t=>({id:t.id,title:t.title||hostOf(t.page.url())||'تب جدید'}));}
function domLabels(node, depth=0, rows=[]){
 if(!node||depth>3||rows.length>=42)return rows;
 const name=String(node.nodeName||'').slice(0,45).toLowerCase();
 if(node.nodeType===1&&/^[a-z][a-z0-9:-]*$/.test(name))rows.push({name,depth});
 for(const child of node.children||[]){if(rows.length>=42)break;domLabels(child,depth+1,rows);}
 return rows;
}
async function inspect(s){
 const tab=s.tabs.get(s.active);if(!tab)throw Error('tab');
 let elements=[];try{const {root}=await tab.cdp.send('DOM.getDocument',{depth:3,pierce:false});elements=domLabels(root);}catch{}
 return {id:tab.id,elements,console:tab.console.slice(),network:tab.network.slice()};
}
async function tabAction(s,d){
 if(d.kind==='tab-new'){await createTab(s);return true;}
 if(d.kind!=='tab-select'&&d.kind!=='tab-close')return false;
 const tab=typeof d.id==='string'&&s.tabs.get(d.id);if(!tab)throw Error('tab');
 if(d.kind==='tab-select'){activate(s,tab);return true;}
 if(s.tabs.size===1)throw Error('last-tab');
 await tab.page.close();return true;
}
async function start(address,ip){
 const token=randomBytes(32).toString('hex'), view=sha('view|'+token), now=Date.now();
 while(starts.length&&starts[0].at<now-3600000)starts.shift();
 if(launching||sessions.size>=2||starts.length>=30||starts.filter(x=>x.ip===ip).length>=6)return null;
 launching=true;starts.push({at:now,ip});const s={id:randomBytes(16).toString('hex'),created:now,expires:now+LIFE,tokenHash:sha(token),viewHash:sha(view),viewers:new Map(),tabs:new Map(),rate:[],queue:Promise.resolve(),queued:0,revision:0,at:0};sessions.set(s.id,s);
 try{
  s.browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:14000,args:['--disable-quic','--disable-background-networking','--disable-features=DnsOverHttps','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE egress','--proxy-bypass-list=<-loopback>'],proxy:{server:'http://egress:3128'}});
  if(s.closed){await s.browser.close();throw Error();}
  s.context=await s.browser.newContext({viewport:{width:WIDTH,height:HEIGHT},acceptDownloads:false,permissions:[],serviceWorkers:'block'});
  await createTab(s);
  await s.page.goto(address,{waitUntil:'commit',timeout:8000});
  if(s.closed)throw Error();
  keys.set(s.tokenHash,{s,view:false});keys.set(s.viewHash,{s,view:true});s.browser.once('disconnected',()=>void end(s).catch(()=>{}));
  return {token,view,expires:s.expires};
 }catch(e){console.warn('browser launch/navigation failed:',e.name);await end(s).catch(()=>{});throw Error('browser');}finally{launching=false;}
}
async function capture(s){
 if(s.flight)return s.flight;
 if(s.last&&s.last.tabId===s.active&&Date.now()-s.at<450)return s.last;
 s.flight=(async()=>{const tab=s.tabs.get(s.active);if(!tab)throw Error('tab');const url=tab.page.url();const {data}=await tab.cdp.send('Page.captureScreenshot',{format:'jpeg',quality:68,captureBeyondViewport:false});if(data.length>4_000_000)throw Error();let location='';try{const u=new URL(url);if(['http:','https:'].includes(u.protocol)){u.username='';u.password='';location=u.href;}}catch{}const last={jpeg:Buffer.from(data,'base64'),location,tabId:tab.id,rev:++s.revision};if(s.active!==tab.id)throw Error('tab-changed');s.at=Date.now();s.last=last;return last;})().finally(()=>{s.flight=null;});return s.flight;
}
const server=createServer({requestTimeout:10000,headersTimeout:8000,maxHeaderSize:8192},async(req,res)=>{
 try{
  if(req.headers.host!==HOST)return send(res,404,'Not found');
  const p=req.url,m=req.method;
  if(m==='GET'&&p==='/health')return json(res,200,{ok:true,engine:'chromium'});
  if(m==='GET'&&(p==='/'||p.startsWith('/?')))return send(res,200,ui,{'content-type':'text/html; charset=utf-8','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
  if(m==='GET'&&p==='/fonts/vazirmatn.woff2')return send(res,200,font,{'content-type':'font/woff2','cache-control':'public, max-age=31536000, immutable'});
  if(!['/api/start','/api/frame','/api/action','/api/close','/api/extend','/api/inspect'].includes(p))return send(res,404,'Not found');
  if((p==='/api/frame'||p==='/api/inspect')?m!=='GET':m!=='POST'||req.headers.origin!==ORIGIN||!['same-origin',undefined].includes(req.headers['sec-fetch-site']))return error(res,403,'درخواست مجاز نیست.');
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
  if(p==='/api/inspect'){if(s.inspectActive||Date.now()-(s.inspectAt||0)<650)return error(res,429,'کمی صبر کن.');s.inspectActive=true;s.inspectAt=Date.now();try{return json(res,200,await inspect(s));}finally{s.inspectActive=false;}}
  if(p==='/api/frame'){
   if((s.frameRequests??=0)>=8)return error(res,429,'درخواست‌ها زیادند.');s.frameRequests++;
   try{const now=Date.now(), client=req.headers['x-kitesurf-client']||'';for(const [id,t] of s.viewers)if(t<now-15000)s.viewers.delete(id);if(/^[0-9a-f]{8,16}$/.test(client)&&(s.viewers.size<30||s.viewers.has(client)))s.viewers.set(client,now);
    const f=await capture(s);return send(res,200,f.jpeg,{'content-type':'image/jpeg','x-kitesurf-width':WIDTH,'x-kitesurf-height':HEIGHT,'x-kitesurf-expires':s.expires,'x-kitesurf-revision':f.rev,'x-sabi-active-tab':f.tabId,...(!view?{'x-sabi-tabs':encodeURIComponent(JSON.stringify(listTabs(s)))}:{}),'x-kitesurf-location':encodeURIComponent(f.location.slice(0,1500)),'x-kitesurf-viewers':Math.max(1,s.viewers.size)});
   }catch{return error(res,503,'تصویر موقتاً آماده نیست.');}finally{s.frameRequests--;}
  }
  const now=Date.now();s.rate=s.rate.filter(t=>t>now-1000);if(s.rate.length>=14||s.queued>=10)return error(res,429,'درخواست‌ها زیادند.');s.rate.push(now);s.queued++;
  try{const d=await body(req).catch(()=>null);if(!d)return error(res,400,'فرمان نامعتبر است.');const q=s.queue.then(async()=>{if(s.closed)throw Error();if(await tabAction(s,d))return;if(d.tab!==s.active)throw Error('stale-tab');await control(s,d);s.at=0;});s.queue=q.catch(()=>{});await q;return send(res,204);}catch{return error(res,400,'فرمان اجرا نشد.');}finally{s.queued--;}
 }catch{return error(res,500,'خطای موقت مرورگر مجازی.');}
});
server.on('upgrade',(req,socket)=>socket.destroy());server.maxConnections=100;server.listen(8080,'172.29.63.2');
setInterval(()=>{const now=Date.now();for(const s of sessions.values())if(s.expires<=now)void end(s).catch(()=>{});},5000).unref();
process.once('SIGTERM',()=>{server.close();Promise.allSettled([...sessions.values()].map(end)).finally(()=>process.exit(0));});
