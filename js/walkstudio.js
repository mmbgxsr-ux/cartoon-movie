// ===== استوديو دورة المشي (مدمج): رتّب الإطارات وعاينها ثم استخدمها كلوحة المشي مباشرة =====
(function () {
  const wc = { fr: [], cur: 0, playing: false, raf: 0, last: 0, acc: 0 };
  const pv = $('wcPrev'), pg = pv.getContext('2d'), say = t => { $('wcMsg').textContent = t || ''; };
  const dimsOf = im => [im.naturalWidth || im.width, im.naturalHeight || im.height];
  const scaleOf = (aw, ah) => { const ds = wc.fr.map(f => dimsOf(f.img)); return Math.min(aw / Math.max(...ds.map(d => d[0])), ah / Math.max(...ds.map(d => d[1]))); };   // مقياس واحد لكل الإطارات
  function wcDraw() {
    pg.fillStyle = '#e9edf2'; pg.fillRect(0, 0, pv.width, pv.height);
    const base = pv.height * .9; pg.strokeStyle = '#9aa8b8'; pg.beginPath(); pg.moveTo(0, base); pg.lineTo(pv.width, base); pg.stroke();
    $('wcTag').textContent = wc.fr.length ? (wc.cur + 1) + ' / ' + wc.fr.length : '0 / 0';
    const f = wc.fr[wc.cur]; if (!f) return;
    const k = scaleOf(pv.width * .9, pv.height * .84), [w, h] = dimsOf(f.img);
    pg.drawImage(f.img, (pv.width - w * k) / 2, base - h * k, w * k, h * k);
  }
  function wcGrid() {
    const g = $('wcGrid'); g.innerHTML = '';
    wc.fr.forEach((f, i) => {
      const d = document.createElement('div'); d.style.cssText = 'position:relative;cursor:pointer;border:2px solid ' + (i === wc.cur ? 'var(--ac)' : 'var(--line)') + ';border-radius:8px;overflow:hidden;background:#e9edf2';
      const t = document.createElement('canvas'); t.width = 90; t.height = 120; t.style.borderRadius = '0';
      const [w, h] = dimsOf(f.img), k = Math.min(t.width / w, t.height / h); const tg = t.getContext('2d'); tg.fillStyle = '#e9edf2'; tg.fillRect(0, 0, t.width, t.height); tg.drawImage(f.img, (t.width - w * k) / 2, t.height - h * k, w * k, h * k);
      const nm = document.createElement('span'); nm.textContent = i + 1; nm.style.cssText = 'position:absolute;top:3px;right:3px;background:#111c2dcc;color:#fff;font-size:11px;padding:1px 6px;border-radius:99px';
      const bar = document.createElement('div'); bar.style.cssText = 'display:flex;justify-content:space-between;background:#111c2d;padding:2px';
      const mk = (txt, ttl, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = ttl; b.style.cssText = 'font-size:12px;padding:1px 6px'; b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
      bar.append(
        mk('▲', 'تقديم', () => { if (i > 0) { [wc.fr[i - 1], wc.fr[i]] = [wc.fr[i], wc.fr[i - 1]]; wc.cur = i - 1; wcGrid(); wcDraw(); } }),
        mk('×', 'حذف', () => { wc.fr.splice(i, 1); wc.cur = Math.min(wc.cur, Math.max(0, wc.fr.length - 1)); wcGrid(); wcDraw(); }),
        mk('▼', 'تأخير', () => { if (i < wc.fr.length - 1) { [wc.fr[i + 1], wc.fr[i]] = [wc.fr[i], wc.fr[i + 1]]; wc.cur = i + 1; wcGrid(); wcDraw(); } }));
      d.onclick = () => { wc.cur = i; wcGrid(); wcDraw(); };
      d.append(t, nm, bar); g.appendChild(d);
    });
  }
  const wcStop = () => { wc.playing = false; cancelAnimationFrame(wc.raf); $('wcPlay').textContent = '▶ تشغيل'; };
  function wcTick(t) {
    if (!wc.playing) return; if (!wc.last) wc.last = t; wc.acc += (t - wc.last) / 1000; wc.last = t;
    const iv = 1 / (+$('wcFps').value || 8);
    if (wc.acc >= iv) { const s = Math.floor(wc.acc / iv); wc.acc -= s * iv; if (wc.fr.length) { wc.cur = (wc.cur + s) % wc.fr.length; wcGrid(); wcDraw(); } }
    wc.raf = requestAnimationFrame(wcTick);
  }
  $('wcPlay').onclick = () => { if (wc.fr.length < 2) { say('ارفع صورتين على الأقل للمعاينة.'); return; } if (wc.playing) { wcStop(); return; } wc.playing = true; wc.last = 0; wc.acc = 0; $('wcPlay').textContent = '⏸ إيقاف'; wc.raf = requestAnimationFrame(wcTick); };
  $('wcBack').onclick = () => { wcStop(); if (wc.fr.length) { wc.cur = (wc.cur - 1 + wc.fr.length) % wc.fr.length; wcGrid(); wcDraw(); } };
  $('wcNext').onclick = () => { wcStop(); if (wc.fr.length) { wc.cur = (wc.cur + 1) % wc.fr.length; wcGrid(); wcDraw(); } };
  $('wcFps').oninput = () => { $('wcFpsT').textContent = $('wcFps').value; };
  $('wcClear').onclick = () => { wcStop(); wc.fr = []; wc.cur = 0; $('lWc').classList.remove('ok'); wcGrid(); wcDraw(); say('تم المسح.'); };
  $('wcFiles').onchange = async e => {
    const fs = [...e.target.files].filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!fs.length) return; wcStop(); let n = 0;
    for (const f of fs) { try { wc.fr.push({ img: await loadImg(f), name: f.name }); n++; } catch (_) {} }
    wc.cur = 0; wcGrid(); wcDraw(); $('lWc').classList.add('ok'); say('تم تحميل ' + n + ' صورة. شغّل المعاينة ثم اضغط «استخدمها».'); e.target.value = '';
  };
  $('wcDemo').onclick = () => {
    wcStop(); wc.fr = [];
    [[1, -1, 0], [.45, -.45, -1], [0, 0, 0], [-.55, .5, 1], [-1, 1, 0], [-.45, .45, -1], [0, 0, 0], [.55, -.5, 1]].forEach(([leg, arm, body], i) => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d');
      x.fillStyle = '#e9edf2'; x.fillRect(0, 0, 300, 400); x.strokeStyle = '#1e2938'; x.lineCap = 'round'; x.lineJoin = 'round';
      const L = (ax, ay, bx, by, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); };
      const hx = 150, hy = 220 + body * 4, sy = 130 + body * 3;
      L(hx - 5, hy, hx + leg * 45, hy + 68, 16); L(hx + leg * 45, hy + 68, hx + leg * 78, hy + 130, 13); L(hx + leg * 78, hy + 130, hx + leg * 78 + 28, hy + 130, 10);
      L(hx + 5, hy, hx - leg * 38, hy + 70, 16); L(hx - leg * 38, hy + 70, hx - leg * 78, hy + 128, 13); L(hx - leg * 78, hy + 128, hx - leg * 78 + 24, hy + 128, 10);
      x.fillStyle = '#111827'; x.beginPath(); x.roundRect(hx - 33, sy - 5, 66, 95, 18); x.fill();
      L(hx - 23, sy + 12, hx - 25 + arm * 42, sy + 58, 12); L(hx + 23, sy + 12, hx + 25 - arm * 42, sy + 58, 12);
      x.fillStyle = '#d8a17c'; x.beginPath(); x.arc(150, 75 + body * 2, 31, 0, Math.PI * 2); x.fill();
      wc.fr.push({ img: c, name: 'demo-' + (i + 1) });
    });
    wc.cur = 0; wcGrid(); wcDraw(); $('lWc').classList.add('ok'); say('مثال تخطيطي لاختبار التوقيت. ارفع صور شخصيتك للنتيجة الفعلية.');
  };
  $('wcUse').onclick = async () => {
    const n = wc.fr.length;
    if (n < 3) { say('أضف 3 إطارات على الأقل: من 3 إلى 5 = ذهاب وإياب، ومن 6 فأكثر = دورة كاملة.'); return; }
    if (n > 12) { say('الحد الأقصى 12 إطارًا، احذف الزائد.'); return; }
    wcStop(); say('جاري التجهيز …'); msg('جاري إزالة الخلفية من اللوحة …'); await sleep(40);
    const cs = 512, k = scaleOf(cs * .88, cs * .86), base = cs * .92;
    const c = document.createElement('canvas'); c.width = cs * n; c.height = cs; const g = c.getContext('2d');
    wc.fr.forEach((f, i) => {
      const [w, h] = dimsOf(f.img); let fill = null;
      try {   // لون الخلفية = لون زوايا الصورة، فتُزال الخلفية بدقة
        const t = document.createElement('canvas'); t.width = w; t.height = h; const tg = t.getContext('2d', { willReadFrequently: true }); tg.drawImage(f.img, 0, 0);
        let r = 0, gg = 0, b = 0, a = 0; [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].forEach(([px, py]) => { const d = tg.getImageData(px, py, 1, 1).data; r += d[0]; gg += d[1]; b += d[2]; a += d[3]; });
        if (a / 4 >= 128) fill = 'rgb(' + Math.round(r / 4) + ',' + Math.round(gg / 4) + ',' + Math.round(b / 4) + ')';
      } catch (_) { fill = '#e9edf2'; }
      if (fill) { g.fillStyle = fill; g.fillRect(i * cs, 0, cs, cs); }
      g.drawImage(f.img, i * cs + (cs - w * k) / 2, base - h * k, w * k, h * k);
    });
    let im; try { im = await new Promise((res, rej) => c.toBlob(bl => { if (!bl) return rej(); const i2 = new Image(); i2.onload = () => res(i2); i2.onerror = rej; i2.src = URL.createObjectURL(bl); }, 'image/png')); } catch (_) { say('تعذّر تجهيز اللوحة'); msg(''); return; }
    SH.walk.cols = n; SH.walk.rows = eq(1); $('gc_walk').value = n; $('gr_walk').value = 1;
    imgs.walk = im; delete parts.walk; build('walk'); renderParts(); afterSheet('walk');
    [...$('sheets').children].forEach(l => { if (l.textContent.includes(SH.walk.label)) l.classList.add('ok'); });
    const t = 'تم تعيين دورة المشي: ' + frames.walk.length + ' إطارات (' + (frames.walk.length < 6 ? 'ذهاب وإياب' : 'دورة كاملة') + ')'; say(t); msg(t);
  };
  wcDraw();
})();
for (const [id, label] of PROPS) mkPicker($('props'), id, label, async im => { props[id] = trim(im); if (window.pDraw) pDraw(); });
SHOTS.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (i + 1) + '. ' + s.h; $('sStart').appendChild(o); });
