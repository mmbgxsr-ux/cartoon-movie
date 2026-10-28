{ const names = Object.keys(SH).filter(n => SHIMG[n]); let done = 0; const PFX = 'جاري تجهيز الشخصية';   // رسالة تقدّم أثناء التجهيز بدل صفحة تبدو متجمدة
  Object.keys(SH).forEach((n, ix) => { if (!SHIMG[n]) return; const im = new Image(); im.onload = async () => { await FCACHE.load(n); imgs[n] = im; build(n); FCACHE.save(n); refreshMouthUI(); const l = $('sheets').children[ix]; if (l) l.classList.add('ok');
    done++; const cur = $('msg').textContent;
    if (done < names.length) { if (!cur || cur.startsWith(PFX) || cur.startsWith('ارفع الخلفيات')) msg(PFX + ' (' + done + ' / ' + names.length + ') …'); } else if (cur.startsWith(PFX)) msg('ارفع الخلفيات وملفات الصوت ثم اضغط تشغيل'); };
    im.src = SHIMG[n]; }); }
// الخلفيات الخمس عشرة مدمجة (بترتيب أرقامها) وتُحمَّل تلقائيًا

const BG_DESC = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, 'خلفية ' + (i + 1)]));
const BG_SHORT = {};
Object.keys(BG_DESC).forEach(k => { BG_SHORT[k] = BG_DESC[k].split(/[:(،]/)[0].trim().slice(0, 22); });
let bgOrdered = false, bgBackup = null;
function renderThumbs() {
  $('thumbs').innerHTML = '';
  bgs.forEach((im, i) => {
    const d = document.createElement('div'); d.className = 'th'; const t = document.createElement('img'); t.src = im.src; d.appendChild(t);
    const b = document.createElement('b'); b.textContent = i + 1; d.appendChild(b);
    if (bgOrdered && BG_SHORT[i + 1]) { const s = document.createElement('small'); s.textContent = BG_SHORT[i + 1]; d.appendChild(s); }
    $('thumbs').appendChild(d);
  });
}
function smallJpeg(im) {
  const k = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .7).split(',')[1];
}
// ----- تعرّف محلي تقريبي (بدون إنترنت أو مفتاح) من ألوان الصورة -----
function bgFeatures(im) {
  const w = 64, h = 36, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, F = { green: 0, dgreen: 0, lgreen: 0, snow: 0, sky: 0, water: 0, warm: 0, brown: 0, yellow: 0, dark: 0, grey: 0, skyTop: 0, greenBot: 0 }, n = w * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), lum = .299 * r + .587 * gg + .114 * b, sat = mx ? (mx - mn) / mx : 0;
    const green = gg > r + 10 && gg > b + 10; if (green) { F.green++; lum < 95 ? F.dgreen++ : F.lgreen++; if (y >= h / 2) F.greenBot++; }
    if (lum > 190 && sat < .18) F.snow++;
    if (b > r + 18 && b >= gg - 5) { if (lum > 110) { F.sky++; if (y < h / 2) F.skyTop++; } else F.water++; }
    const warm = r > gg + 20 && r > b + 30; if (warm) { F.warm++; if (lum < 125) F.brown++; }
    if (r > b + 40 && gg > b + 25 && Math.abs(r - gg) < 45 && lum > 120) F.yellow++;
    if (lum < 55) F.dark++; if (sat < .12 && lum >= 55 && lum <= 190) F.grey++;
  }
  for (const k in F) F[k] /= (k === 'skyTop' || k === 'greenBot') ? n / 2 : n; return F;
}
const SLOT_SCORE = {
  1: f => .35, 2: f => .3,
  3: f => 1.2 * f.dgreen + .8 * f.snow + .5 * f.grey + .6 * f.skyTop - f.warm,
  4: f => 1.4 * f.brown + f.dark + .8 * f.grey + .6 * f.warm - 1.2 * f.green,
  5: f => 2 * f.dgreen + f.green - 1.2 * f.sky - f.snow - f.warm,
  6: f => 1.4 * f.lgreen + .9 * f.greenBot + .8 * f.skyTop - f.dark - .5 * f.brown,
  7: f => 2 * f.warm + .6 * f.yellow + .4 * f.green - .5 * f.snow,
  8: f => 1.2 * f.dark + f.warm + .6 * f.grey - f.green,
  9: f => f.brown + .8 * f.yellow + .7 * f.green + .3 * f.warm - f.snow,
  10: f => .8 * f.green + .9 * f.brown + .7 * f.skyTop + .6 * f.yellow,
  11: f => 1.2 * f.water + f.sky + .8 * f.green + .5 * f.dgreen,
  12: f => 1.5 * f.yellow + .8 * f.skyTop + .3 * f.lgreen,
  13: f => f.sky + .5 * f.dark - .3 * f.green,
  14: f => f.grey + .8 * f.snow + .8 * f.skyTop + .5 * f.brown - f.green,
  15: f => 1.6 * f.snow + .8 * f.grey - 1.2 * f.green
};
function assignLocal() {
  const N = bgs.length, slots = Object.keys(BG_DESC).map(Number), feats = bgs.map(bgFeatures), pairs = [];
  slots.forEach(s => feats.forEach((f, i) => pairs.push([s, i, s <= 2 ? SLOT_SCORE[s](f) - 1 : SLOT_SCORE[s](f)])));
  pairs.sort((a, b) => b[2] - a[2]); const slotImg = {}, used = new Set();
  for (const [s, i] of pairs) { if (slotImg[s] != null || used.has(i)) continue; slotImg[s] = i + 1; used.add(i); }
  return slotImg;
}
function applyOrder(slotImg, slots) {
  const used = new Set(), left = []; slots.forEach(s => { const n = slotImg[s]; if (n >= 1 && n <= bgs.length && !used.has(n)) used.add(n); else delete slotImg[s]; });
  for (let n = 1; n <= bgs.length; n++) if (!used.has(n)) left.push(n);
  const out = []; let fixed = 0;
  slots.forEach(s => { let n = slotImg[s]; if (!n) { n = left.shift() || slotImg[1] || 1; fixed++; } out.push(bgs[n - 1]); });
  bgs.length = 0; out.forEach(im => bgs.push(im)); bgOrdered = true; renderThumbs(); buildMap(); return fixed;
}
async function autoBg(auto) {
  const N = bgs.length; if (N < 2) { if (!auto) msg('ارفع الخلفيات أولًا'); return; }
  const key = $('kKey').value.trim(), slots = Object.keys(BG_DESC).map(Number);
  if (key.length < 10) {
    if (auto) return;
    bgBackup = bgs.slice(); const fixed = applyOrder(assignLocal(), slots); $('bUndo').style.display = '';
    msg('تم ترتيب الخلفيات بالألوان (تقريبي). للدقة العالية أدخل مفتاح Gemini وأعد الضغط. راجع المصغّرات وصحّح من «تعيين خلفية كل مشهد».'); return;
  }
  const prompt = 'أمامك ' + N + ' صورة مرقمة من 1 إلى ' + N + ' بترتيب ظهورها. لكل رقم خلفية مطلوبة من القائمة التالية اختر الصورة الأنسب لها، وكل صورة تُستخدم مرة واحدة فقط. أعد JSON فقط بالشكل {"رقم_الخلفية": رقم_الصورة} لكل الأرقام.\nالخلفيات المطلوبة:\n' + slots.map(s => s + ': ' + BG_DESC[s]).join('\n');
  const parts = [{ text: prompt }]; bgs.forEach((im, i) => { parts.push({ text: 'صورة رقم ' + (i + 1) + ':' }); parts.push({ inlineData: { mimeType: 'image/jpeg', data: smallJpeg(im) } }); });
  busy = true; $('bAuto').disabled = true; msg('جاري تحليل الصور بواسطة Gemini …');
  try {
    let j = null, lastSt = 0;
    for (let a = 0; a < 3 && !j; a++) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) });
      if (r.status === 429 || r.status >= 500) { lastSt = r.status; msg('انتظار حد الطلبات …'); await sleep(9000 * (a + 1)); continue; }
      const d = await r.json(); if (!r.ok) throw new Error(gemErr(r.status, d.error && d.error.message));
      j = JSON.parse(d.candidates[0].content.parts.map(p => p.text || '').join('').replace(/```json|```/g, '').trim());
    }
    if (!j) throw new Error(lastSt ? gemErr(lastSt) : 'لم يصل رد');
    const slotImg = {}; slots.forEach(s => { slotImg[s] = +j[s]; });
    bgBackup = bgs.slice(); const fixed = applyOrder(slotImg, slots); $('bUndo').style.display = '';
    msg('تم التعرف على الخلفيات وترتيبها' + (fixed ? ' (تعذّرت مطابقة ' + fixed + ' منها، راجعها)' : '') + '. راجع المصغّرات وصحّح أي خطأ من «تعيين خلفية كل مشهد».');
  } catch (e) { msg('خطأ Gemini: ' + errText(e)); }
  busy = false; $('bAuto').disabled = false;
}
$('bAuto').onclick = () => autoBg(false);
$('bUndo').onclick = () => { if (!bgBackup) return; bgs.length = 0; bgBackup.forEach(im => bgs.push(im)); bgOrdered = false; bgBackup = null; $('bUndo').style.display = 'none'; renderThumbs(); buildMap(); msg('تم الرجوع للترتيب الأصلي'); };

// ===== ضبط موضع الشخصية (الأرض والمكان والحجم) لكل خلفية، يُحفظ في المتصفح =====
(function () {
  const GK = 'cartoonGround1', DEF = { y: Object.assign({}, GRG), s: Object.assign({}, GRS), x: Object.assign({}, GRX) }; let GO = {};
  try { GO = JSON.parse(Store.getItem(GK) || '{}'); } catch (_) {}
  const save = () => { try { Store.setItem(GK, JSON.stringify(GO)); } catch (_) {} };
  const apply = k => {
    for (const [o, d] of [[GRG, DEF.y], [GRX, DEF.x], [GRS, DEF.s]]) { if (d[k] != null) o[k] = d[k]; else delete o[k]; }
    const v = GO[k]; if (v) { GRG[k] = v[0]; GRX[k] = v[1]; GRS[k] = v[2]; }
  };
  Object.keys(GO).forEach(k => apply(+k));
  const sel = $('gSel'); for (let k = 1; k <= 15; k++) { const o = document.createElement('option'); o.value = k; o.textContent = k + '. ' + (BG_SHORT[k] || ''); sel.appendChild(o); }
  const cur = () => +sel.value, vals = k => [GRG[k] || 625, GRX[k] || .2, GRS[k] || 1];
  function show(k) { if (playing) return; const i = SHOTS.findIndex(s => (s.map || s.bg) === k); if (i >= 0) { idx = i; t = SHOTS[i].inT + 1; } }
  function draw() {
    const k = cur(), c = $('gc'), g = c.getContext('2d'), im = bgs[k - 1], [y, x, s] = vals(k); $('gScale').value = s;
    if (im) g.drawImage(im, 0, 0, c.width, c.height); else { g.fillStyle = '#26313b'; g.fillRect(0, 0, c.width, c.height); }
    const px = x * c.width, py = y * c.height / H, hh = 420 * s * c.height / H;
    g.fillStyle = 'rgba(40,120,255,.28)'; g.strokeStyle = '#5aa8ff'; g.lineWidth = 2; g.beginPath(); g.roundRect(px - hh * .22, py - hh, hh * .44, hh, 8); g.fill(); g.stroke();
    g.fillStyle = '#ff4b3a'; g.strokeStyle = '#fff'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.stroke();
  }
  sel.onchange = () => { draw(); show(cur()); };
  $('gc').onpointerdown = e => {
    const k = cur(), r = $('gc').getBoundingClientRect(), s = vals(k)[2];
    GO[k] = [Math.round((e.clientY - r.top) / r.height * H), +((e.clientX - r.left) / r.width).toFixed(3), s]; apply(k); save(); draw(); show(k);
  };
  $('gScale').oninput = () => { const k = cur(), v = vals(k); GO[k] = [v[0], v[1], +$('gScale').value]; apply(k); save(); draw(); show(k); };
  $('gReset').onclick = () => { const k = cur(); delete GO[k]; apply(k); save(); draw(); show(k); };
  draw();
})();
