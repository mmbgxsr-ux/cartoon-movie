// وضع الشاشة الكاملة لمشاهدة الفيلم: زر ⛶ ، أو الضغط المزدوج على الصورة، أو مفتاح F (أو «ب» في لوحة المفاتيح العربية).
// عند عدم دعم المتصفح (iPhone مثلًا يقتصر ملء الشاشة عنده على عنصر video) نستعمل وضعًا بديلًا يملأ الصفحة بالـCSS.
(function () {
  const stage = document.querySelector('.stage'), btn = document.getElementById('bFull'), play = document.getElementById('bPlay');
  if (!stage || !btn || !play) return;
  // أزرار تظهر داخل الشاشة الكاملة فقط (التشغيل والخروج) وتختفي بعد 3 ثوانٍ من عدم اللمس
  const ctl = document.createElement('div'); ctl.className = 'fsCtl';
  const bp = document.createElement('button'); bp.type = 'button';
  const bx = document.createElement('button'); bx.type = 'button'; bx.textContent = '✕ خروج'; bx.setAttribute('aria-label', 'خروج من الشاشة الكاملة');
  ctl.append(bp, bx); stage.appendChild(ctl);
  const syncPlay = () => { bp.textContent = play.textContent; }; syncPlay();
  new MutationObserver(syncPlay).observe(play, { childList: true, characterData: true, subtree: true });
  bp.onclick = () => play.click();

  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const isFull = () => fsEl() === stage || stage.classList.contains('pseudoFS');
  let hideT = 0;
  const showCtl = () => { ctl.classList.remove('hide'); clearTimeout(hideT); if (isFull()) hideT = setTimeout(() => ctl.classList.add('hide'), 3000); };
  const sync = () => {
    const on = isFull();
    btn.textContent = on ? '✕ خروج من الشاشة الكاملة' : '⛶ شاشة كاملة';
    document.body.classList.toggle('fsLock', on);
    if (on) showCtl();
    else { clearTimeout(hideT); ctl.classList.remove('hide'); try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (_) { dbg(_); } }
  };
  const enter = async () => {
    const rq = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (rq) {
      try { await rq.call(stage); try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) { dbg(_); } return; }
      catch (e) { dbg(e); }
    }
    stage.classList.add('pseudoFS'); sync();
  };
  const exit = () => {
    stage.classList.remove('pseudoFS');
    const f = document.exitFullscreen || document.webkitExitFullscreen;
    if (fsEl() && f) { try { const r = f.call(document); r && r.catch && r.catch(dbg); } catch (_) { dbg(_); } }
    sync();
  };
  const toggle = () => (isFull() ? exit() : enter());
  btn.onclick = toggle; bx.onclick = exit;
  stage.addEventListener('dblclick', e => { if (e.target.tagName === 'CANVAS') toggle(); });
  ['pointermove', 'pointerdown', 'touchstart'].forEach(ev => stage.addEventListener(ev, () => { if (isFull()) showCtl(); }, { passive: true }));
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (e.key === 'Escape' && stage.classList.contains('pseudoFS')) exit();
    else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'f' || e.key === 'F' || e.key === 'ب')) toggle();   // «ب» هي مفتاح F في لوحة المفاتيح العربية
  });
})();
