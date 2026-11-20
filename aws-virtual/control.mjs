const WIDTH=1280, HEIGHT=720;
export function publicUrl(raw) {
  if(typeof raw!=='string'||raw.length>1800)return null;
  try {
    const v=raw.trim(); if(!v || v.includes('\\'))return null;
    const u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(v)?v:'https://'+v);
    const h=u.hostname.toLowerCase().replace(/\.$/,'');
    if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||/^\d+(?:\.\d+)+$/.test(h)||h.includes(':')||/(?:^|\.)(?:localhost|internal|local|test|invalid|onion|home|arpa)$/.test(h)||/(?:^|\.)nikanesalamat\.ir$/.test(h))return null;
    return u.href;
  } catch {return null;}
}
export async function control(session,m){
    const send=(method,params)=>session.cdp.send(method,params);
    const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):0;
    const point={x:bounded(m.x,0,WIDTH-1),y:bounded(m.y,0,HEIGHT-1),modifiers:bounded(m.modifiers,0,15)};
    if(m.kind==='go'){const url=publicUrl(m.url);if(!url)throw Error('url');return session.page.goto(url,{waitUntil:'commit',timeout:7000});}
    if(m.kind==='reload')return send('Page.reload');
    if(m.kind==='back'||m.kind==='forward'){
      const h=await send('Page.getNavigationHistory');const e=h.entries?.[h.currentIndex+(m.kind==='back'?-1:1)];if(e)return send('Page.navigateToHistoryEntry',{entryId:e.id});return;
    }
    if(m.kind==='click'){const button=m.button==='right'?'right':'left', clickCount=m.count===2?2:1;await send('Input.dispatchMouseEvent',{...point,type:'mousePressed',button,buttons:button==='right'?2:1,clickCount});return send('Input.dispatchMouseEvent',{...point,type:'mouseReleased',button,buttons:0,clickCount});}
    if(m.kind==='pointer'){
      if(!['down','move','up'].includes(m.event))throw Error('command');const type={down:'mousePressed',move:'mouseMoved',up:'mouseReleased'}[m.event];const buttons=m.event==='up'?0:1;
      return send('Input.dispatchMouseEvent',{...point,type,button:type==='mouseMoved'?'none':'left',buttons,clickCount:1});
    }
    if(m.kind==='wheel')return send('Input.dispatchMouseEvent',{...point,type:'mouseWheel',deltaX:bounded(m.dx,-1100,1100),deltaY:bounded(m.dy,-1100,1100)});
    if(m.kind==='text'&&typeof m.text==='string'&&m.text.length>0&&m.text.length<=700)return send('Input.insertText',{text:m.text});
    if(m.kind==='key'&&typeof m.key==='string'&&m.key.length>0&&m.key.length<=35){
      const text=typeof m.text==='string'&&m.text.length<=8?m.text:'';const fields={key:m.key,code:typeof m.code==='string'&&m.code.length<40?m.code:'',windowsVirtualKeyCode:bounded(m.vk,0,255),modifiers:point.modifiers};
      await send('Input.dispatchKeyEvent',{...fields,type:'keyDown',text});return send('Input.dispatchKeyEvent',{...fields,type:'keyUp'});
    }
    throw Error('command');
  }
