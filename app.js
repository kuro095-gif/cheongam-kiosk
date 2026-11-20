// 청암 키오스크 v2.0.1: 첫 시트 응답 전에 예전 기본 주소를 실행하지 않습니다.
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const state = { screen: 'home', config: window.CHEONGAM_DEFAULT_CONFIG ? structuredClone(window.CHEONGAM_DEFAULT_CONFIG) : null, frame: null, menu: null, frameNonce: '', child: null, childOrigin: '', cooperative: false,
   lastInput: Date.now(), session: null, editor: null, dirty: false, saving: false, idleGeneration: 0, slideIndex: 0, confirmDeadline: 0, configReady: false };
 const media = new Map();
 let syncBusy = false, nextSync = 0, slideTimer = 0, toastTimer = 0, navigationBusy = false, logoKey = '', confirmResolver = null, exitResolver = null;
 let menuSignature = '', homePhotoGeneration = 0;
 const cardDetails = {
  navigation: { subtitle: '교내 위치를 한눈에 찾아보세요', photo: 'portrait' },
  meal: { subtitle: '오늘의 맛있는 한 끼', photo: 'portrait' },
  game: { subtitle: '잠깐의 도전, 새로운 기록', photo: 'portrait' },
  album: { subtitle: '함께한 순간을 만나보세요', photo: 'landscape' },
  website: { subtitle: '우리 학교의 더 많은 이야기', photo: 'landscape' }
 };
 const iconPaths = {
  navigation: '<path d="M12 22s8-7.5 8-13a8 8 0 0 0-16 0c0 5.5 8 13 8 13Z"/><circle cx="12" cy="9" r="3"/>',
  meal: '<path d="M4 2v7m4-7v7M2 2v5a4 4 0 0 0 8 0V2M6 11v11M19 2c-4 4-4 9 0 10V2Zm0 10v10"/>',
  game: '<path d="M3 15c2-5 6-7 11-5 1-5 7-6 7-1 0 2-1 4-3 5-1 7-7 9-13 6l-3 1 2-4-1-2Z"/><path d="m8 14 5 1-4 3m12-9 3 1-3 1"/>',
  album: '<rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="8" cy="8" r="2"/><path d="m3 18 6-6 4 4 3-3 6 6"/>',
  website: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/>'
 };
 function rpc(name, ...args) {
  return window.KioskAPI.call(name, ...args);
 }
 function nonce() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); }
 function notice(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
 function activity() { state.lastInput = Date.now(); }
 function closeDialogs() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
  state.confirmDeadline = 0;
 }
 function show(name) {
  ['home', 'viewer', 'idle', 'admin'].forEach(id => $(id).hidden = id !== name);
  state.screen = name;
 }
 function ask(title, text) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmDialog').showModal();
  return new Promise(resolve => confirmResolver = resolve);
 }
 function answerConfirm(value) { $('confirmDialog').close(); const resolve = confirmResolver; confirmResolver = null; if (resolve) resolve(value); }
 $('confirmYes').onclick = () => answerConfirm(true);
 $('confirmNo').onclick = () => answerConfirm(false);
 $('confirmDialog').addEventListener('cancel', e => { e.preventDefault(); answerConfirm(false); });

 function renderMenus() {
  const grid = $('menuGrid');
  const menus = state.config ? state.config.menus : [];
  const signature = JSON.stringify({ ready: state.configReady, menus });
  if (signature === menuSignature) { renderHomePhotos(); return; }
  menuSignature = signature; grid.replaceChildren();
  menus.forEach((menu, index) => {
   const button = document.createElement('button'); button.className = 'menu-card photo-surface' + (index === 0 ? ' featured' : '');
   button.disabled = !state.configReady;
   const kind = Object.hasOwn(iconPaths, menu.id) ? menu.id : 'website'; button.dataset.kind = kind;
   const detail = cardDetails[kind];
   const photo = document.createElement('img'); photo.className = 'menu-photo'; photo.alt = ''; photo.hidden = true; photo.dataset.photoRole = detail.photo;
   const icon = document.createElement('span'); icon.className = 'menu-icon'; icon.setAttribute('aria-hidden', 'true');
   icon.innerHTML = '<svg viewBox="0 0 26 26">' + iconPaths[kind] + '</svg>';
   const copy = document.createElement('span'); copy.className = 'menu-copy';
   const title = document.createElement('span'); title.className = 'menu-title'; title.textContent = menu.name;
   const sub = document.createElement('span'); sub.className = 'menu-subtitle'; sub.textContent = detail.subtitle;
   const arrow = document.createElement('span'); arrow.className = 'menu-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
   copy.append(title, sub); button.append(photo, icon, copy, arrow); button.addEventListener('click', () => openMenu(menu)); grid.append(button);
  });
  if (!menus.length) { const p = document.createElement('p'); p.className = 'notice'; p.textContent = state.config ? '안내 메뉴를 준비하고 있습니다.' : '학교 안내를 불러오는 중입니다…'; grid.append(p); }
  renderHomePhotos();
 }
 async function renderHomePhotos() {
  const generation = ++homePhotoGeneration;
  const slides = state.config?.slides || [];
  const portrait = slides.find(s => s.id === 'idle_portrait') || slides[0];
  const landscape = slides.find(s => s.id === 'idle_landscape') || slides[1] || slides[0];
  const jobs = new Map();
  const targets = [...document.querySelectorAll('[data-photo-role]')];
  await Promise.all(targets.map(async img => {
   const role = img.dataset.photoRole;
   const asset = role === 'hero' ? state.config?.hero : (role === 'portrait' ? portrait : landscape)?.asset;
   const surface = img.closest('.photo-surface');
   if (!asset) { img.hidden = true; img.removeAttribute('src'); delete img.dataset.loadedKey; surface?.classList.remove('has-photo'); return; }
   if (img.dataset.loadedKey === asset.key && !img.hidden) return;
   img.hidden = true; surface?.classList.remove('has-photo');
   try {
    if (!jobs.has(asset.key)) jobs.set(asset.key, assetUrl(asset).then(async url => { await loadedImage(url); return url; }));
    const url = await jobs.get(asset.key);
    if (generation !== homePhotoGeneration || !img.isConnected) return;
    img.src = url; img.dataset.loadedKey = asset.key; img.hidden = false; surface?.classList.add('has-photo');
   } catch (_) { if (generation === homePhotoGeneration) { img.hidden = true; delete img.dataset.loadedKey; surface?.classList.remove('has-photo'); } }
  }));
 }
 async function assetUrl(asset) {
  if (!asset) throw new Error('등록된 이미지가 없습니다.');
  // The supplied images are bundled with Pages; new Drive links are read through the server.
  if (asset.kind === 'drive' && Object.hasOwn(window.CHEONGAM_LOCAL_ASSETS || {}, asset.id)) return new URL(window.CHEONGAM_LOCAL_ASSETS[asset.id], document.baseURI).href;
  if (asset.kind === 'url') {
   const parsed = new URL(asset.url); if (parsed.protocol !== 'https:') throw new Error('이미지 주소를 확인해주세요.');
   return parsed.href;
  }
  const existing = media.get(asset.key);
  if (existing && Date.now() - existing.created < 600000) return existing.promise;
  const promise = rpc('getManagedImage', asset.id).then(result => {
   if (!/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(result.dataUrl)) throw new Error('이미지를 읽지 못했습니다.');
   return result.dataUrl;
  });
  const entry = { created: Date.now(), promise }; media.set(asset.key, entry);
  while (media.size > 6) media.delete(media.keys().next().value);
  promise.catch(() => { if (media.get(asset.key) === entry) media.delete(asset.key); });
  return promise;
 }
 function loadedImage(url) {
  return new Promise((resolve, reject) => {
   const image = new Image(); const timer = setTimeout(() => { image.src = ''; reject(new Error('이미지 연결 시간 초과')); }, 12000);
   image.onload = () => { clearTimeout(timer); resolve(image); };
   image.onerror = () => { clearTimeout(timer); reject(new Error('이미지 연결 오류')); }; image.src = url;
  });
 }
 async function renderLogo() {
  const asset = state.config.logo; const key = asset ? asset.key : '';
  if (key === logoKey) return;
  logoKey = key;
  document.querySelectorAll('.school-logo').forEach(img => { img.hidden = true; img.removeAttribute('src'); });
  document.querySelectorAll('.brand-fallback').forEach(el => el.hidden = false);
  if (!asset) return;
  try {
   const url = await assetUrl(asset); await loadedImage(url); if (key !== logoKey) return;
   document.querySelectorAll('.school-logo').forEach(img => { img.src = url; img.hidden = false; });
   document.querySelectorAll('.brand-fallback').forEach(el => el.hidden = true);
  } catch (_) { if (logoKey === key) logoKey = ''; }
 }
 async function refreshConfig(force = false) {
  if (syncBusy || (!force && Date.now() < nextSync)) return;
  syncBusy = true;
  if (!state.configReady) {
   $('menuGrid').setAttribute('aria-busy', 'true');
   $('configError').firstChild.textContent = '학교 안내를 불러오고 있어요. 잠시만 기다려주세요. ';
   $('configError').hidden = false; $('retryConfig').hidden = true;
  }
  try {
   const config = await rpc('getKioskConfig');
   if (!config || !Array.isArray(config.menus) || !Array.isArray(config.slides)) throw new Error('학교 안내 데이터 형식을 확인해주세요.');
   const previousSlides = JSON.stringify(state.config?.slides || []);
   state.config = config; state.configReady = true; $('configError').hidden = true;
   $('schoolFooter').textContent = config.schoolName; $('idleMessage').textContent = config.idleMessage;
   if (state.screen === 'home') renderMenus(); else renderHomePhotos();
   renderLogo();
   const keys = new Set([config.logo, config.hero, ...config.slides.map(s => s.asset)].filter(Boolean).map(a => a.key));
   for (const key of media.keys()) if (!keys.has(key)) media.delete(key);
   config.slides.slice(0, 2).forEach(s => assetUrl(s.asset).catch(() => {}));
   if (state.screen === 'idle' && previousSlides !== JSON.stringify(config.slides)) {
    state.idleGeneration++; state.slideIndex = 0; clearTimeout(slideTimer); $('idleImage').hidden = true; advanceSlide();
   }
  } catch (error) {
   $('configError').firstChild.textContent = state.configReady
    ? '최신 안내 정보를 업데이트하지 못했어요. 마지막으로 확인한 메뉴를 표시하고 있습니다. '
    : '학교 안내를 불러오지 못했어요. 다시 시도해주세요. ';
   $('configError').hidden = false;
  }
  finally {
   $('menuGrid').setAttribute('aria-busy', 'false'); $('retryConfig').hidden = false;
   nextSync = Date.now() + (state.config?.refreshSeconds || 60) * 1000; syncBusy = false;
  }
 }
 $('retryConfig').onclick = () => refreshConfig(true);

 async function openMenu(menu) {
  if (navigationBusy || state.screen !== 'home') return;
  if (!state.configReady) { notice('학교 안내를 불러온 뒤 메뉴를 이용해주세요.'); return; }
  // Resolve the current sheet entry at click time, even if this button was created earlier.
  menu = state.config.menus.find(current => current.id === menu.id);
  if (!menu) { notice('메뉴가 변경되었습니다. 목록을 다시 확인해주세요.'); renderMenus(); return; }
  let url; try { url = new URL(menu.url); if (url.protocol !== 'https:') throw Error(); } catch (_) { notice('메뉴 주소를 확인해주세요.'); return; }
  closeDialogs(); activity(); state.menu = menu; state.cooperative = false; state.child = null; state.childOrigin = ''; state.frameNonce = nonce();
  // Optional integration parameters for the known apps; no changes to the linked apps are made here.
  if (url.hostname === 'script.google.com' || url.hostname === 'kuro095-gif.github.io') {
   url.searchParams.set('kioskParentOrigin', location.origin); url.searchParams.set('kioskToken', state.frameNonce);
  }
  const frame = document.createElement('iframe'); frame.title = menu.name;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads');
  frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen'); frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const loading = document.createElement('div'); loading.className = 'frame-loading'; loading.textContent = '페이지를 여는 중입니다…';
  $('frameHost').replaceChildren(frame, loading); state.frame = frame; $('viewerTitle').textContent = menu.name; show('viewer');
  // load does not prove cross-origin content loaded successfully. Help remains available at all times.
  frame.addEventListener('load', () => {
   loading.remove();
   if (state.frame === frame) frame.contentWindow.postMessage({ type: 'CHEONGAM_INIT', version: 1, nonce: state.frameNonce }, url.origin);
  });
  frame.addEventListener('error', () => { loading.remove(); if (state.frame === frame) notice('연결하지 못했어요. 아래 버튼으로 돌아갈 수 있습니다.'); });
  frame.src = url.href;
  setTimeout(() => loading.remove(), 12000);
 }
 function allowedChildOrigin(origin) {
  if (!state.menu) return false;
  const expected = new URL(state.menu.url).origin;
  return origin === expected || (expected === 'https://script.google.com' && /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(origin));
 }
 function childSource(source, root, depth = 0) {
  if (!source || !root || depth > 5) return false;
  if (source === root) return true;
  try { for (let i = 0; i < Math.min(root.length, 20); i++) if (childSource(source, root.frames[i], depth + 1)) return true; } catch (_) {}
  return false;
 }
 window.addEventListener('message', event => {
  const data = event.data;
  if (!state.frame || !data || typeof data !== 'object' || data.nonce !== state.frameNonce || !allowedChildOrigin(event.origin)) return;
  if (!childSource(event.source, state.frame.contentWindow)) return;
  if (state.child && event.source !== state.child) return;
  if (data.type === 'CHEONGAM_READY' && data.version === 1) {
   state.child = event.source; state.childOrigin = event.origin; state.cooperative = data.reportsActivity === true;
   event.source.postMessage({ type: 'CHEONGAM_ACK', version: 1, nonce: state.frameNonce }, event.origin);
  } else if (data.type === 'CHEONGAM_ACTIVITY' && state.cooperative && event.source === state.child) {
   activity(); if ($('continueDialog').open) { $('continueDialog').close(); state.confirmDeadline = 0; }
  } else if (data.type === 'CHEONGAM_EXIT_ACK' && event.source === state.child && exitResolver) { exitResolver(); }
 });
 async function detachFrame() {
  const frame = state.frame;
  if (frame && state.child && state.childOrigin) {
   await new Promise(resolve => {
    const timer = setTimeout(done, 1500);
    function done() { clearTimeout(timer); exitResolver = null; resolve(); }
    exitResolver = done;
    try { state.child.postMessage({ type: 'CHEONGAM_EXIT', version: 1, nonce: state.frameNonce }, state.childOrigin); } catch (_) { done(); }
   });
  }
  if (frame) { frame.src = 'about:blank'; frame.remove(); }
  $('frameHost').replaceChildren(); state.frame = null; state.menu = null; state.child = null; state.childOrigin = ''; state.cooperative = false; state.frameNonce = '';
 }
 function clearAdmin() {
  const session = state.session; state.session = null; state.editor = null; state.dirty = false;
  $('adminRows').replaceChildren(); $('adminPassword').value = ''; $('loginStatus').textContent = '';
  if (session) rpc('logoutAdmin', session.token).catch(() => {});
 }
 async function goHome() {
  if (navigationBusy) return;
  navigationBusy = true; closeDialogs(); clearTimeout(slideTimer); state.idleGeneration++;
  try { await detachFrame(); clearAdmin(); $('idleImage').hidden = true; $('idleImage').removeAttribute('src'); show('home'); activity(); renderMenus(); refreshConfig(); }
  finally { navigationBusy = false; }
 }
 $('viewerHome').onclick = goHome; $('helpHome').onclick = goHome; $('continueHome').onclick = goHome;
 $('viewerHelp').onclick = () => $('helpDialog').showModal(); $('helpClose').onclick = () => $('helpDialog').close();
 $('reloadFrame').onclick = async () => { const menu = state.menu; await goHome(); if (menu) openMenu(menu); };

 async function advanceSlide() {
  clearTimeout(slideTimer);
  const generation = state.idleGeneration;
  const slides = state.config?.slides || [];
  if (state.screen !== 'idle') return;
  if (!slides.length) { $('idleImage').hidden = true; return; }
  const slide = slides[state.slideIndex++ % slides.length];
  try {
   const url = await assetUrl(slide.asset); await loadedImage(url);
   if (state.screen !== 'idle' || generation !== state.idleGeneration) return;
   $('idleImage').src = url; $('idleImage').alt = slide.name || '학교 홍보 이미지'; $('idleImage').hidden = false;
  } catch (_) { /* Keep the last good image, or the default welcome screen. */ }
  if (state.screen === 'idle' && generation === state.idleGeneration) slideTimer = setTimeout(advanceSlide, (state.config?.slideSeconds || 10) * 1000);
 }
 async function enterIdle() {
  if (navigationBusy || state.screen === 'idle') return;
  navigationBusy = true; closeDialogs();
  try { await detachFrame(); clearAdmin(); state.idleGeneration++; state.slideIndex = 0; $('idleImage').hidden = true; show('idle'); $('idle').focus({ preventScroll: true }); advanceSlide(); refreshConfig(); }
  finally { navigationBusy = false; }
 }
 // Consume the entire gesture that wakes the screen; it must never activate a menu underneath.
 function wake(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const shield = document.createElement('div'); shield.className = 'wake-shield'; document.body.append(shield);
  const block = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const remove = () => { document.removeEventListener('pointerup', release, true); document.removeEventListener('pointercancel', release, true); document.removeEventListener('keyup', release, true); window.removeEventListener('blur', remove); shield.remove(); };
  let timer = 0;
  const release = e => { block(e); clearTimeout(timer); timer = setTimeout(remove, 350); };
  ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach(type => shield.addEventListener(type, block, { passive: false }));
  document.addEventListener('pointerup', release, true); document.addEventListener('pointercancel', release, true); document.addEventListener('keyup', release, true);
  window.addEventListener('blur', remove, { once: true });
  goHome();
 }
 ['pointerdown', 'keydown', 'wheel'].forEach(type => document.addEventListener(type, event => {
  if (state.screen === 'idle') { if (type !== 'wheel') wake(event); else event.preventDefault(); return; }
  if (!$('continueDialog').open) activity();
 }, { capture: true, passive: false }));
 $('continueYes').onclick = () => { $('continueDialog').close(); state.confirmDeadline = 0; activity(); };
 $('continueDialog').addEventListener('cancel', e => { e.preventDefault(); $('continueYes').click(); });
 function tick() {
  refreshConfig();
  if (state.session && Date.now() >= state.session.expiresAt) { notice('관리자 로그인 시간이 만료되었습니다.'); goHome(); return; }
  if (state.screen === 'idle' || navigationBusy) return;
  if ($('continueDialog').open) {
   const seconds = Math.max(0, Math.ceil((state.confirmDeadline - Date.now()) / 1000)); $('continueCountdown').textContent = seconds + '초';
   if (!seconds) enterIdle(); return;
  }
  if (Date.now() - state.lastInput < (state.config?.idleSeconds || 600) * 1000) return;
  if (state.screen === 'viewer' && !state.cooperative) {
   closeDialogs(); state.confirmDeadline = Date.now() + 30000; $('continueCountdown').textContent = '30초'; $('continueDialog').showModal();
  } else enterIdle();
 }
 document.addEventListener('visibilitychange', tick); setInterval(tick, 1000);

 $('adminOpen').onclick = () => { $('loginStatus').textContent = ''; $('adminPassword').value = ''; $('loginDialog').showModal(); $('adminPassword').focus(); };
 $('loginCancel').onclick = () => { $('loginDialog').close(); $('adminPassword').value = ''; };
 $('loginDialog').addEventListener('close', () => $('adminPassword').value = '');
 async function derive(password, params) {
  const enc = new TextEncoder(); const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(params.salt), iterations: params.iterations, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
 }
 $('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); if ($('loginSubmit').disabled) return;
  $('loginSubmit').disabled = true; $('loginStatus').textContent = '확인하고 있습니다…';
  try {
   const password = $('adminPassword').value; const params = await rpc('getLoginParams'); const key = await derive(password, params); $('adminPassword').value = '';
   const session = await rpc('loginAdmin', key);
   if (!$('loginDialog').open || state.screen !== 'home') { rpc('logoutAdmin', session.token).catch(() => {}); return; }
   state.session = session; const editor = await rpc('getMenuEditor', session.token);
   if (state.session !== session || !$('loginDialog').open || state.screen !== 'home') { if (state.session === session) clearAdmin(); return; }
   state.editor = editor; state.dirty = false; $('loginDialog').close(); show('admin'); activity(); $('adminStatus').textContent = ''; renderEditor();
  } catch (error) { clearAdmin(); $('loginStatus').textContent = error.message; }
  finally { $('loginSubmit').disabled = false; }
 });
 function field(label, type, value, update) {
  const wrap = document.createElement('label'); wrap.className = 'field'; wrap.textContent = label;
  const input = document.createElement('input'); input.type = type; input.value = value; input.autocomplete = 'off'; input.maxLength = type === 'url' ? 4096 : 50;
  input.addEventListener('input', () => { update(input.value); state.dirty = true; }); wrap.append(input); return wrap;
 }
 function action(label, aria, fn) { const button = document.createElement('button'); button.textContent = label; button.setAttribute('aria-label', aria); button.onclick = fn; return button; }
 function renderEditor() {
  const host = $('adminRows'); host.replaceChildren();
  state.editor.menus.forEach((menu, index) => {
   const row = document.createElement('article'); row.className = 'admin-row';
   const fields = document.createElement('div'); fields.className = 'admin-fields';
   fields.append(field('메뉴 이름', 'text', menu.name, v => menu.name = v), field('연결 주소', 'url', menu.url, v => menu.url = v));
   const label = document.createElement('label'); label.className = 'checkbox-label'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = menu.enabled;
   check.onchange = () => { menu.enabled = check.checked; state.dirty = true; }; label.append(check, document.createTextNode('메뉴에 표시')); fields.append(label);
   const actions = document.createElement('div'); actions.className = 'row-actions';
   const move = offset => { const list = state.editor.menus; [list[index], list[index + offset]] = [list[index + offset], list[index]]; state.dirty = true; renderEditor(); };
   const up = action('↑', menu.name + ' 위로 이동', () => move(-1)); up.disabled = index === 0;
   const down = action('↓', menu.name + ' 아래로 이동', () => move(1)); down.disabled = index === state.editor.menus.length - 1;
   const remove = action('삭제', menu.name + ' 삭제', async () => { if (await ask('메뉴 삭제', '‘' + (menu.name || '새 메뉴') + '’ 메뉴를 삭제할까요? 저장하면 반영됩니다.')) { state.editor.menus.splice(index, 1); state.dirty = true; renderEditor(); } }); remove.className = 'delete';
   actions.append(up, down, remove); row.append(fields, actions); host.append(row);
  });
  $('addMenu').disabled = state.editor.menus.length >= 100;
 }
 $('addMenu').onclick = () => { state.editor.menus.push({ id: 'menu-' + crypto.randomUUID(), name: '', url: '', enabled: true, note: '' }); state.dirty = true; renderEditor(); $('adminRows').lastElementChild?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
 $('adminClose').onclick = async () => { if (!state.dirty || await ask('변경 사항 확인', '저장하지 않은 변경 사항을 취소하고 나갈까요?')) goHome(); };
 $('reloadMenus').onclick = async () => {
  if (state.dirty && !await ask('목록 다시 불러오기', '저장하지 않은 변경 사항을 취소하고 시트의 목록을 불러올까요?')) return;
  const session = state.session;
  try { const editor = await rpc('getMenuEditor', session.token); if (state.session !== session) return; state.editor = editor; state.dirty = false; renderEditor(); $('adminStatus').textContent = ''; }
  catch (error) { $('adminStatus').textContent = error.message; }
 };
 $('saveMenus').onclick = async () => {
  if (state.saving || !state.session) return;
  const menus = state.editor.menus.map(m => ({ ...m }));
  for (const [index, menu] of menus.entries()) {
   try { if (!menu.name.trim() || /^[=+@-]/.test(menu.name.trim()) || new URL(menu.url).protocol !== 'https:') throw Error(); }
   catch (_) { $('adminStatus').textContent = (index + 1) + '번 메뉴 이름과 https 주소를 확인해주세요.'; return; }
  }
  const session = state.session; state.saving = true; $('adminRows').inert = true;
  ['saveMenus', 'addMenu', 'reloadMenus', 'adminClose', 'previewIdle'].forEach(id => $(id).disabled = true); $('adminStatus').textContent = '저장하는 중입니다…';
  try { const editor = await rpc('saveMenus', session.token, state.editor.revision, menus); if (state.session !== session) return; state.editor = editor; state.dirty = false; renderEditor(); $('adminStatus').textContent = '저장했습니다.'; await refreshConfig(true); }
  catch (error) { $('adminStatus').textContent = error.message; }
  finally { state.saving = false; $('adminRows').inert = false; ['saveMenus', 'addMenu', 'reloadMenus', 'adminClose', 'previewIdle'].forEach(id => $(id).disabled = false); }
 };
 $('previewIdle').onclick = async () => {
  if (state.dirty && !await ask('대기 화면 미리보기', '저장하지 않은 변경 사항을 취소하고 미리보기로 이동할까요?')) return;
  enterIdle();
 };
 renderMenus();
 if (state.config) { renderLogo(); $('schoolFooter').textContent = state.config.schoolName; $('idleMessage').textContent = state.config.idleMessage; }
 refreshConfig(true);
})();
