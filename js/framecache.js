// تخزين مؤقت لنتيجة إزالة الخلفية للصفحات المدمجة (IndexedDB): أول فتح يحسبها، وما بعده يستعيدها بدل إعادة الحساب
// المفتاح يتغير تلقائيًا إذا تغيّر كود الإزالة أو إعداداتها أو الصورة، فلا تبقى نتيجة قديمة
const FCACHE = (function () {
  const DB = 'cmFrameCache1', ST = 'sheets', hit = {}; let hits = 0;
  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const key = n => { const c = SH[n], im = SHIMG[n]; return fnv(['v1', matte, cutGrid, measure, bgColors].join('|') + JSON.stringify([c.cols, c.rows, c.H, c.pad, c.tol, c.badge]) + im.length + im.slice(-64) +
    [$('cHoles') ? $('cHoles').checked : 1, $('rEdge') ? $('rEdge').value : '', $('rHalo') ? $('rHalo').value : ''].join(',')); };
  const open = () => new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'n' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function load(n) {          // إن وُجدت نتيجة صالحة تُوضع في PRECUT ليستعملها build()
    try {
      const db = await open(), rec = await req(db.transaction(ST).objectStore(ST).get(n)); db.close();
      if (!rec || rec.key !== key(n) || !rec.frames.length) return false;
      const out = [];
      for (const fr of rec.frames) {
        const bm = await createImageBitmap(fr.b), c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0); if (bm.close) bm.close(); c.m = fr.m; out.push(c);
      }
      PRECUT[n] = out; hit[n] = true; hits++; return true;
    } catch (_) { return false; }
  }
  async function save(n) {          // بعد الحساب الأول: نحفظ الإطارات في الخلفية بعد هدوء الصفحة
    if (hit[n]) { delete hit[n]; return; }
    setTimeout(async () => {
      try {
        const fr = frames[n]; if (!fr || !fr.length) return; const k = key(n), rows = [];
        for (const f of fr) { const b = await new Promise(r => f.toBlob(r, 'image/webp', 1)); if (!b) return; rows.push({ b, w: f.width, h: f.height, m: f.m }); }
        const db = await open(); await req(db.transaction(ST, 'readwrite').objectStore(ST).put({ n, key: k, frames: rows })); db.close();
      } catch (_) {}
    }, 4000);
  }
  return { load, save, get hits() { return hits; } };
})();
