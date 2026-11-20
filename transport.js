// GitHub Pages -> Apps Script HTML-service bridge. No JSONP or no-cors writes.
(() => {
  'use strict';
  const methods = new Set(['getKioskConfig','getManagedImage','getLoginParams','loginAdmin','logoutAdmin','getMenuEditor','saveMenus']);
  const pending = new Map();
  let frame=null, peer=null, peerOrigin='', channel='', connecting=null, rejectConnect=null, connectTimer=0;
  function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join(''); }
  function googleOrigin(origin) { return origin === 'https://script.google.com' || /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(origin); }
  function descendant(source, root, depth=0) {
    if (!source || !root || depth>5) return false;
    if (source===root) return true;
    try { for(let i=0;i<Math.min(root.length,20);i++) if(descendant(source,root.frames[i],depth+1)) return true; } catch (_) {}
    return false;
  }
  function reset(error) {
    clearTimeout(connectTimer);
    const reject=rejectConnect; rejectConnect=null;
    peer=null; peerOrigin=''; connecting=null; channel='';
    if(frame) frame.remove(); frame=null;
    if(reject) reject(error);
    for(const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  }
  function connect() {
    if(peer) return Promise.resolve();
    if(connecting) return connecting;
    let url;
    try {
      url=new URL(window.CHEONGAM_KIOSK?.backendUrl || '');
      if(url.origin!=='https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) throw Error();
      if(location.protocol!=='https:' && !['localhost','127.0.0.1'].includes(location.hostname)) throw Error();
    } catch (_) { return Promise.reject(new Error('데이터 연결 주소를 설정해주세요. 설치 안내의 config.js 설정을 확인하세요.')); }
    channel=token(); url.search=''; url.hash='';
    url.searchParams.set('mode','bridge'); url.searchParams.set('parentOrigin',location.origin); url.searchParams.set('channel',channel);
    const promise=new Promise((resolve,reject)=>{
      rejectConnect=reject;
      frame=document.createElement('iframe'); frame.id='kioskDataBridge'; frame.hidden=true; frame.title='학교 안내 데이터 연결';
      frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.addEventListener('error',()=>reset(new Error('데이터 연결에 실패했습니다. 배포 주소와 접근 권한을 확인해주세요.')));
      frame._resolveReady=resolve;
      connectTimer=setTimeout(()=>reset(new Error('데이터 연결 시간이 초과되었습니다. Apps Script 배포와 인터넷 연결을 확인해주세요.')),30000);
      frame.src=url.href; document.body.append(frame);
    });
    connecting=promise;
    return promise;
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(!frame || !data || data.protocol!=='CHEONGAM_DATA_V1' || data.channel!==channel || !googleOrigin(event.origin)) return;
    if(data.type==='READY') {
      if(peer || !descendant(event.source,frame.contentWindow)) return;
      peer=event.source; peerOrigin=event.origin; clearTimeout(connectTimer); rejectConnect=null;
      const resolve=frame._resolveReady; delete frame._resolveReady; resolve();
      return;
    }
    if(data.type!=='RESULT' || event.source!==peer || event.origin!==peerOrigin) return;
    const entry=pending.get(data.id); if(!entry) return;
    pending.delete(data.id); clearTimeout(entry.timer);
    if(data.ok===true) entry.resolve(data.value);
    else entry.reject(new Error(typeof data.error==='string' ? data.error : '요청을 처리하지 못했습니다.'));
  });
  async function call(method,...args) {
    if(!methods.has(method)) throw new Error('허용되지 않은 요청입니다.');
    await connect();
    if(pending.size>=20) throw new Error('요청이 많습니다. 잠시 후 다시 시도해주세요.');
    return new Promise((resolve,reject)=>{
      const id=token();
      const timer=setTimeout(()=>reset(new Error('응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.')),45000);
      pending.set(id,{resolve,reject,timer});
      try { peer.postMessage({protocol:'CHEONGAM_DATA_V1',type:'CALL',channel,id,method,args},peerOrigin); }
      catch (_) { reset(new Error('데이터 연결이 끊어졌습니다. 다시 시도해주세요.')); }
    });
  }
  window.KioskAPI=Object.freeze({call});
})();
