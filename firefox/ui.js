(function(){
if(window.__sabiRestart)return;window.__sabiRestart=1;
var css=document.createElement('style');
css.textContent='@font-face{font-family:SabiV;src:url(/__sabi/vazirmatn.woff2) format("woff2");font-weight:100 900}@font-face{font-family:SabiR;src:url(/__sabi/aref-ruqaa.woff2) format("woff2");font-weight:700}'+
'#sabi-rs,#sabi-rs *{box-sizing:border-box;font-family:SabiV,system-ui,sans-serif}'+
'#sabi-rs-btn{position:fixed;z-index:2147483000;right:14px;bottom:14px;display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border:1px solid rgba(255,194,77,.5);border-radius:999px;background:rgba(9,10,32,.86);color:#ffe9b8;font-size:13.5px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);opacity:.45;transition:opacity .15s,transform .15s,background .15s;direction:rtl}'+
'#sabi-rs-btn:hover,#sabi-rs-btn:focus-visible{opacity:1;background:rgba(22,20,58,.97);border-color:#ffc24d;box-shadow:0 0 24px rgba(255,176,59,.35);transform:translateY(-1px)}'+
'#sabi-rs-btn svg{width:16px;height:16px}'+
'#sabi-rs-ov{position:fixed;inset:0;z-index:2147483001;display:none;place-items:center;background:rgba(4,5,17,.74);backdrop-filter:blur(7px);direction:rtl}'+
'#sabi-rs-ov.on{display:grid}'+
'#sabi-rs-card{width:min(380px,92vw);padding:28px 24px 22px;border-radius:24px;background:#0a0c26;border:1px solid rgba(255,194,77,.4);color:#f7f1e3;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 70px -25px rgba(255,176,59,.5)}'+
'#sabi-rs-card h2{margin:0 0 8px;font:700 28px/1.5 SabiR,SabiV,serif;color:#ffc24d}#sabi-rs-card p{margin:0 0 20px;font-size:14px;line-height:1.9;color:#c6c2dc}'+
'#sabi-rs-card .row{display:flex;gap:10px}#sabi-rs-card button{flex:1;height:44px;border-radius:12px;border:1px solid rgba(243,230,200,.25);background:transparent;color:#f7f1e3;font-size:15px;font-weight:600;cursor:pointer}'+
'#sabi-rs-card button.go{border:0;color:#1a1200;background:linear-gradient(120deg,#ffd37a,#ffb03b 55%,#ff9d3d)}'+
'#sabi-rs-spin{width:46px;height:46px;margin:0 auto 16px;border-radius:50%;border:4px solid rgba(255,255,255,.14);border-top-color:#ffc24d;animation:sabirs 1s linear infinite}'+
'@keyframes sabirs{to{transform:rotate(360deg)}}';
document.head.appendChild(css);
var root=document.createElement('div');root.id='sabi-rs';
root.innerHTML='<button id="sabi-rs-btn" type="button" title="بستن کامل و اجرای دوبارهٔ فایرفاکس"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>ری‌استارت فایرفاکس</button>'+
'<div id="sabi-rs-ov" role="dialog" aria-modal="true"><div id="sabi-rs-card"></div></div>';
document.body.appendChild(root);
var ov=document.getElementById('sabi-rs-ov'),card=document.getElementById('sabi-rs-card');
function ask(){card.innerHTML='<h2>ری‌استارت فایرفاکس</h2><p>فایرفاکس کاملاً بسته و دوباره اجرا می‌شود. کارهای ذخیره‌نشده از بین می‌رود؛ افزونه‌ها، بوکمارک‌ها و رمزها می‌مانند.</p><div class="row"><button type="button" id="sabi-no">انصراف</button><button type="button" class="go" id="sabi-yes">ری‌استارت</button></div>';ov.classList.add('on');
document.getElementById('sabi-no').onclick=function(){ov.classList.remove('on')};
document.getElementById('sabi-yes').onclick=go;}
function busy(t){card.innerHTML='<div id="sabi-rs-spin"></div><h2>'+t+'</h2><p>چند ثانیه صبر کنید؛ صفحه خودکار دوباره باز می‌شود.</p>';}
function fail(m){card.innerHTML='<h2>خطا</h2><p>'+m+'</p><div class="row"><button type="button" id="sabi-ok">بستن</button></div>';document.getElementById('sabi-ok').onclick=function(){ov.classList.remove('on')};}
function poll(n){fetch('/__sabi/status',{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.ok?r.json():{ready:false}}).catch(function(){return{ready:false}}).then(function(j){
 if(j.ready){setTimeout(function(){location.reload()},1500)}else if(n>0){setTimeout(function(){poll(n-1)},2000)}else{fail('راه‌اندازی بیش از حد طول کشید. صفحه را دستی تازه کنید.')}})}
function go(){busy('در حال بستن و اجرای دوبارهٔ فایرفاکس…');
 fetch('/__sabi/restart',{method:'POST',headers:{'X-Sabi-Action':'restart'},credentials:'same-origin'}).then(function(r){
  if(r.status===202){poll(60)}else if(r.status===429){fail('ری‌استارت قبلی هنوز در حال انجام است. چند ثانیه بعد دوباره امتحان کنید.')}else if(r.status===401){location.href='/__sabi/login'}else{fail('درخواست انجام نشد.')}
 }).catch(function(){fail('ارتباط با سرور برقرار نشد.')});}
document.getElementById('sabi-rs-btn').onclick=ask;
})();
