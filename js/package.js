// الحزمة الكاملة: مشاهد + إعدادات + الصور (خلفيات، لوحات، بطاقات) + الصوت، في ملف .zip واحد يُنقل بين الأجهزة
// - التصدير يجمع الملفات الأصلية التي رفعها المستخدم (لا نسخًا معالَجة)، فتُعاد معالجتها عند الاستيراد بنفس منطق الواجهة
// - الاستيراد يكتب الإعدادات في التخزين ويحفظ الملفات مؤقتًا في IndexedDB ثم يعيد تحميل الصفحة، فتُطبَّق الملفات بعد تهيئة الوحدات
// - مفتاح Gemini لا يُضمَّن في الحزمة أبدًا
(function () {
  const say = t => { const m = document.getElementById('msg'); if (m) m.textContent = t; };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const MAXN = 2000, MAXMANIFEST = 20 * 1048576;

  // ---------- ZIP (بدون ضغط: الصور والصوت مضغوطة أصلًا) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function writeZip(entries) {                 // entries: [{ path, blob }]
    const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const parts = [], cd = []; let off = 0;
    for (const e of entries) {
      const name = enc.encode(e.path), data = new Uint8Array(await e.blob.arrayBuffer()), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      parts.push(h, name, data); cd.push(c, name); off += 30 + name.length + data.length;
      if (off > 0xF0000000) throw new Error('الحزمة أكبر من 4 جيجابايت');
    }
    const cdSize = cd.reduce((a, x) => a + x.byteLength, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cd, end], { type: 'application/zip' });
  }
  async function readZip(file) {                     // يعيد { path: {method, csize, lho} } ودالة قراءة المدخل
    const size = file.size, tl = Math.min(size, 65557);
    if (size < 22) throw new Error('ملف ZIP غير صالح');
    const tail = new DataView(await file.slice(size - tl).arrayBuffer()); let e = -1;
    for (let i = tl - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('ملف ZIP غير صالح');
    const n = tail.getUint16(e + 10, true), cdSize = tail.getUint32(e + 12, true), cdOff = tail.getUint32(e + 16, true);
    if (n > MAXN) throw new Error('عدد الملفات داخل الحزمة كبير جدًا'); if (cdOff === 0xFFFFFFFF || cdOff + cdSize > size) throw new Error('ملف ZIP غير مدعوم');
    const mem = size <= 256 * 1048576 ? await file.arrayBuffer() : null;   // ملف أقل من 256 ميجابايت: نقرؤه مرة واحدة (أسرع بكثير من slice لكل مدخل)
    const cd = mem ? new DataView(mem, cdOff, cdSize) : new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), ents = {}; let p = 0;
    for (let i = 0; i < n; i++) {
      if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== 0x02014b50) throw new Error('ملف ZIP تالف');
      const method = cd.getUint16(p + 10, true), csize = cd.getUint32(p + 20, true), nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), lho = cd.getUint32(p + 42, true);
      ents[dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl))] = { method, csize, lho }; p += 46 + nl + el + cl;
    }
    const get = async path => {
      const m = ents[path]; if (!m) return null;
      if (m.lho + 30 > size) throw new Error('ملف ZIP تالف');
      const lh = mem ? new DataView(mem, m.lho, 30) : new DataView(await file.slice(m.lho, m.lho + 30).arrayBuffer()), s = m.lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      if (s + m.csize > size) throw new Error('ملف ZIP تالف');
      const b = mem ? new Blob([new Uint8Array(mem, s, m.csize)]) : file.slice(s, s + m.csize);
      if (m.method === 0) return b;
      if (m.method === 8 && window.DecompressionStream) return new Response(b.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      throw new Error('طريقة ضغط غير مدعومة في ' + path);
    };
    return { names: Object.keys(ents), get };
  }

  // ---------- جمع المحتوى من الذاكرة ----------
  const ext = (name, type) => { const m = /\.([A-Za-z0-9]{1,5})$/.exec(name || ''); if (m) return m[1].toLowerCase(); return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' })[type] || 'bin'; };
  const asBlob = async im => { if (im._f) return im._f; if (im.src && im.src.startsWith('blob:')) return (await fetch(im.src)).blob(); return null; };   // الصور الافتراضية المدمجة (data:) لا تُحفظ
  async function collect(quiet) {          // تجمع الملفات والمانيفست بلا ضغط (يستعملها التصدير والحفظ التلقائي)
    const sy = quiet ? () => {} : say;
    const entries = [], man = { app: 'cartoon-movie', v: 2, date: new Date().toISOString(), data: {}, grids: {}, assets: { bg: [], sheets: {}, props: {}, audio: [], gen: [] } };
    (window.PROJECT_KEYS || []).forEach(k => { try { const v = Store.getItem(k); if (v != null) man.data[k] = v; } catch (_) {} });
    const add = (dir, blob, name) => { const path = dir + '/' + String(entries.length).padStart(4, '0') + '.' + ext(name, blob.type); entries.push({ path, blob }); return path; };
    sy('جاري تجميع الصور …');
    for (const im of bgs) { const b = await asBlob(im); if (b) man.assets.bg.push({ path: add('bg', b, b.name), name: b.name || '' }); }
    for (const n of Object.keys(SH)) {
      man.grids[n] = [SH[n].cols, SH[n].rows.length];
      let list = [];
      if (parts[n] && parts[n].length) { for (const p of parts[n]) { const b = await asBlob(p.im); if (b) list.push({ b, n: p.n, g: p.g, name: p.name }); } }
      else if (imgs[n]) { const b = await asBlob(imgs[n]); if (b) list.push({ b, name: b.name }); }
      if (list.length) man.assets.sheets[n] = { sep: !!(parts[n] && parts[n].length), files: list.map(x => ({ path: add('sheets', x.b, x.name), name: x.name || '', n: x.n, g: x.g })) };
    }
    for (const id of Object.keys(PROPSRC)) if (PROPSRC[id]) man.assets.props[id] = { path: add('props', PROPSRC[id], PROPSRC[id].name), name: PROPSRC[id].name || '' };
    sy('جاري تجميع الصوت …');
    (typeof AUDSRC !== 'undefined' ? AUDSRC : []).forEach(f => { man.assets.audio.push({ path: add('audio', f, f.name), name: f.name }); });
    SHOTS.forEach((s, i) => { if (s.pcm && s.gk) { const path = 'gen/' + String(i).padStart(3, '0') + '.pcm'; entries.push({ path, blob: new Blob([s.pcm]) }); man.assets.gen.push({ i, path, gk: s.gk, lineT: s.lineT || null }); } });
    return { entries, man };
  }
  async function buildPkg() {
    const { entries, man } = await collect(false);
    entries.unshift({ path: 'manifest.json', blob: new Blob([JSON.stringify(man, null, 1)], { type: 'application/json' }) });
    say('جاري إنشاء الملف …');
    return { blob: await writeZip(entries), man, n: entries.length - 1 };
  }
  async function save() {
    try {
      const { blob, man } = await buildPkg(), a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'cartoon-project-' + new Date().toISOString().slice(0, 10) + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      const A = man.assets; say('تم حفظ الحزمة (' + (blob.size / 1048576).toFixed(1) + ' ميجابايت): ' + A.bg.length + ' خلفية، ' + Object.keys(A.sheets).length + ' لوحة، ' + Object.keys(A.props).length + ' بطاقة، ' + A.audio.length + ' صوت');
    } catch (e) { say('تعذّر حفظ الحزمة: ' + errText(e)); }
  }

  // ---------- الاستيراد ----------
  const pdb = () => new Promise((res, rej) => { const o = indexedDB.open('cartoon-movie-pending', 1); o.onupgradeneeded = () => o.result.createObjectStore('p'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const pdo = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction('p', mode), r = fn(t.objectStore('p')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  async function openZip(file) {
    say('جاري قراءة الحزمة …');
    const z = await readZip(file), mb = await z.get('manifest.json');
    if (!mb || mb.size > MAXMANIFEST) throw new Error('الحزمة لا تحتوي manifest.json صالحًا');
    const man = JSON.parse(await mb.text());
    if (!man || man.app !== 'cartoon-movie' || !man.data || typeof man.data !== 'object') throw new Error('ملف غير صالح');
    const blobs = {}, A = man.assets || {}, want = [];
    (A.bg || []).forEach(x => want.push(x.path)); Object.values(A.sheets || {}).forEach(s => (s.files || []).forEach(x => want.push(x.path)));
    Object.values(A.props || {}).forEach(x => want.push(x.path)); (A.audio || []).forEach(x => want.push(x.path)); (A.gen || []).forEach(x => want.push(x.path));
    let k = 0; for (const p of want) { if (typeof p !== 'string') continue; say('جاري استخراج الملفات ' + (++k) + ' / ' + want.length + ' …'); const b = await z.get(p); if (!b) throw new Error('ملف ناقص داخل الحزمة: ' + p); blobs[p] = b; }
    // الإعدادات: تُستبدل كلها (الحزمة مشروع كامل)
    (window.PROJECT_KEYS || []).forEach(key => { if (typeof man.data[key] === 'string') Store.setItem(key, man.data[key]); else Store.removeItem(key); });
    Store.removeItem('cartoonLastScene1'); Store.removeItem('cartoonDraft1');
    const db = await pdb(); await pdo(db, 'readwrite', s => s.put({ manifest: { grids: man.grids || {}, assets: A }, blobs }, 'pkg')); db.close();
    say('تم فتح الحزمة، جاري إعادة التحميل …'); setTimeout(() => Store.reload(), 600);
  }
  const mkFiles = (list, blobs) => list.map(x => new File([blobs[x.path]], x.name || x.path.split('/').pop(), { type: blobs[x.path].type || '' }));
  let restoredNow = false;
  async function applyPending() {
    if (!window.indexedDB) return;
    let db, pkg; try { db = await pdb(); pkg = await pdo(db, 'readonly', s => s.get('pkg')); if (pkg) await pdo(db, 'readwrite', s => s.delete('pkg')); db.close(); } catch (_) { return; }   // يُحذف أولًا حتى لا يتكرر التطبيق إن فشل شيء
    if (!pkg || !pkg.manifest) return;
    restoredNow = true;
    // ننتظر اكتمال بناء الواجهة والوحدات واللوحات الافتراضية
    for (let i = 0; i < 100; i++) { const ready = document.getElementById('tabs').children.length > 0 && Object.keys(SH).every(n => !SHIMG[n] || imgs[n]); if (ready) break; await sleep(100); }
    const { grids, assets: A } = pkg.manifest, B = pkg.blobs, fail = []; let nBg = 0, nSh = 0, nPr = 0, nAu = 0, nGen = 0;
    const step = async (label, fn) => { try { await fn(); } catch (e) { fail.push(label); console.error(label, e); } };
    msg('جاري استعادة الحزمة …');
    await step('الشبكات', async () => { Object.keys(grids || {}).forEach(n => { const c = $('gc_' + n), r = $('gr_' + n), g = grids[n]; if (c && r && Array.isArray(g) && g[0] > 0 && g[1] > 0) { c.value = g[0]; r.value = g[1]; SH[n].cols = +g[0]; SH[n].rows = eq(+g[1]); } }); });
    await step('الخلفيات', async () => { const fs = mkFiles(A.bg || [], B); if (fs.length) { await $('fBg').onchange({ target: { files: fs, value: '' } }); nBg = bgs.length; } });
    for (const n of Object.keys(A.sheets || {})) await step('لوحة ' + n, async () => {
      const s = A.sheets[n], inp = document.querySelector('input[data-pick="' + n + '"]'); if (!inp) return;
      await inp.onchange({ target: { files: mkFiles(s.files, B), value: '' } });
      if (parts[n] && parts[n].length === s.files.length) { parts[n].forEach((p, i) => { if (s.files[i].n > 0) p.n = s.files[i].n; if (s.files[i].g > 0) p.g = s.files[i].g; }); build(n); renderParts(); }
      nSh++;
    });
    for (const id of Object.keys(A.props || {})) await step('بطاقة ' + id, async () => { const inp = document.querySelector('input[data-pick="' + id + '"]'); if (!inp) return; await inp.onchange({ target: { files: mkFiles([A.props[id]], B), value: '' } }); nPr++; });
    await step('الصوت', async () => { const fs = mkFiles(A.audio || [], B); if (fs.length) { $('fAud').onchange({ target: { files: fs, value: '' } }); await EMBP; nAu = SHOTS.filter(s => s.eb).length; } });
    await step('الصوت المولَّد', async () => {
      for (const g of A.gen || []) {
        const s = SHOTS[g.i]; if (!s || !B[g.path]) continue;
        const pcm = new Int16Array(await B[g.path].arrayBuffer()), buf = ac().createBuffer(1, pcm.length, 24000), ch = buf.getChannelData(0); for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
        s.pcm = pcm; s.abuf = buf; s.adur = buf.duration; s.gk = g.gk; if (g.lineT) s.lineT = g.lineT; nGen++;
      }
      if (nGen) recalc();
    });
    msg('تم استرجاع الحزمة: ' + nBg + ' خلفية، ' + nSh + ' لوحة، ' + nPr + ' بطاقة، ' + nAu + ' ملف صوت' + (nGen ? '، ' + nGen + ' مشهد صوته مولَّد' : '') + (fail.length ? ' — تعذّر: ' + fail.join('، ') : ''));
  }


  // ---------- الحفظ التلقائي للصور والصوت ----------
  // المشاهد والإعدادات تُحفظ أصلًا في التخزين عند كل تعديل، أما الصور والصوت فتبقى في الذاكرة فقط وتضيع عند الإغلاق المفاجئ.
  // نحفظ لقطة منها (الملفات الأصلية) في IndexedDB كل فترة إن تغيّرت، ونعرض «استعادة» عند الفتح التالي. الاستعادة تمرّ عبر applyPending نفسها.
  const SDB = 'cartoon-movie-session', SKEY = 'snap', AUTO_MS = 20000, AUTO_MAX = 300 * 1048576;
  const sdb = () => new Promise((res, rej) => { const o = indexedDB.open(SDB, 1); o.onupgradeneeded = () => o.result.createObjectStore('s'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const sdo = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction('s', mode), r = fn(t.objectStore('s')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  const fsig = f => f ? (f.name || '') + ':' + (f.size || 0) + ':' + (f.lastModified || 0) : '';
  const isig = im => !im ? '' : im._f ? fsig(im._f) : String(im.src || '').slice(0, 40);
  const auds = () => (typeof AUDSRC !== 'undefined' ? AUDSRC : []);
  const sigNow = () => JSON.stringify([bgs.map(isig),
    Object.keys(SH).map(n => [n, SH[n].cols, SH[n].rows.length, parts[n] && parts[n].length ? parts[n].map(p => [isig(p.im), p.n, p.g]) : isig(imgs[n])]),
    Object.keys(PROPSRC).map(k => [k, fsig(PROPSRC[k])]), auds().map(fsig), SHOTS.map(x => x.pcm && x.gk ? x.gk + ':' + x.pcm.length : '')]);
  const blobImg = im => !!im && (!!im._f || /^blob:/.test(im.src || ''));
  const hasAssets = () => bgs.some(blobImg) || Object.keys(SH).some(n => blobImg(imgs[n]) || (parts[n] && parts[n].length)) || Object.keys(PROPSRC).some(k => PROPSRC[k]) || auds().length > 0 || SHOTS.some(x => x.pcm && x.gk);
  let lastSig = null, saving = false, paused = true, warned = false;   // paused حتى نفحص وجود لقطة قديمة، كي لا نمسحها بحالة فارغة
  async function autosaveNow(force) {
    if (!window.indexedDB || saving || paused) return false;
    if (!force && (playing || EXPORTING || busy)) return false;
    const sig = sigNow(); if (sig === lastSig) return false;
    saving = true;
    try {
      const { entries, man } = await collect(true), blobs = {}; let total = 0;
      entries.forEach(e => { blobs[e.path] = e.blob; total += e.blob.size || 0; });
      if (total > AUTO_MAX) { if (!warned) { warned = true; say('الحفظ التلقائي متوقف لأن الملفات كبيرة (أكثر من 300 ميجابايت). احفظ الحزمة 📦 يدويًا'); } lastSig = sig; return false; }
      const db = await sdb();
      try {
        if (!entries.length) await sdo(db, 'readwrite', st => st.delete(SKEY));   // لا شيء لحفظه: تُمسح اللقطة القديمة
        else await sdo(db, 'readwrite', st => st.put({ date: man.date, manifest: { grids: man.grids, assets: man.assets }, blobs }, SKEY));
      } finally { db.close(); }
      lastSig = sig; return true;
    } catch (e) { console.error('autosave', e); Store.onError && Store.onError(e); return false; }
    finally { saving = false; }
  }
  function showRestoreBar(snap) {
    const bar = document.createElement('div'); bar.id = 'restoreBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'استعادة الجلسة');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:98;background:#1d3b53;color:#fff;padding:10px 14px;font-size:14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap';
    const A = snap.manifest.assets, when = snap.date ? new Date(snap.date).toLocaleString('ar-EG') : '';
    const txt = document.createElement('span');
    txt.textContent = 'عُثر على جلسة محفوظة تلقائيًا' + (when ? ' (' + when + ')' : '') + ': ' + A.bg.length + ' خلفية، ' + Object.keys(A.sheets).length + ' لوحة، ' + Object.keys(A.props).length + ' بطاقة، ' + A.audio.length + ' صوت';
    const mk = label => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'padding:6px 14px;font-size:14px;cursor:pointer'; return b; };
    const yes = mk('استعادة'), no = mk('تجاهل');
    yes.onclick = async () => {
      yes.disabled = no.disabled = true;
      try { const db = await pdb(); try { await pdo(db, 'readwrite', st => st.put({ manifest: snap.manifest, blobs: snap.blobs }, 'pkg')); } finally { db.close(); } say('جاري استعادة الجلسة …'); Store.reload(); }
      catch (e) { say('تعذّرت الاستعادة: ' + errText(e)); yes.disabled = no.disabled = false; }
    };
    no.onclick = () => { if (!confirm('تجاهل الجلسة المحفوظة؟ ستُحذف الصور والصوت المحفوظة تلقائيًا.')) return; bar.remove(); paused = false; };
    bar.append(txt, yes, no); document.body.appendChild(bar);
  }
  async function offerRestore() {
    if (!window.indexedDB) return;
    let snap = null;
    try { const db = await sdb(); try { snap = await sdo(db, 'readonly', st => st.get(SKEY)); } finally { db.close(); } } catch (_) {}
    if (restoredNow) lastSig = sigNow();    // الحالة الآن مطابقة للقطة المستعادة: لا حاجة لإعادة كتابتها
    if (snap && snap.manifest && !restoredNow && !hasAssets()) { showRestoreBar(snap); return; }   // paused يبقى حتى يقرّر المستخدم
    paused = false;
  }
  setInterval(() => { autosaveNow(); }, AUTO_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosaveNow(); });

  window.CMPack = { save, openZip, build: buildPkg, readZip, writeZip, autosaveNow, ready: false };   // ready=true بعد انتهاء استعادة أي حزمة معلّقة
  const b = document.getElementById('bPkgSave'); if (b) b.onclick = save;
  (async () => { try { await applyPending(); } catch (e) { console.error(e); msg('تعذّر استرجاع الحزمة: ' + errText(e)); } finally { CMPack.ready = true; offerRestore().catch(console.error); } })();
})();
