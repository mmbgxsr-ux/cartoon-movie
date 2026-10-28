// ===================== تحريك الفم =====================
function skinOf(f, m) {
  const sig = Math.round(m.x) + ',' + Math.round(m.y) + ',' + Math.round(m.w); if (f._sk && f._sk.sig === sig) return f._sk;
  let r = 0, g = 0, b = 0, n = 0; const g2 = f.getContext('2d');
  for (const [dx, dy] of [[-.85, -.12], [.85, -.12], [-.7, .35], [.7, .35], [0, -.9]]) {
    const x = Math.round(m.x + dx * m.w), y = Math.round(m.y + dy * m.w); if (x < 1 || y < 1 || x >= f.width - 1 || y >= f.height - 1) continue;
    try { const d = g2.getImageData(x - 1, y - 1, 3, 3).data; for (let i = 0; i < 36; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } } catch (_) {}
  }
  const sk = n ? { r: (r / n) | 0, g: (g / n) | 0, b: (b / n) | 0 } : { r: 205, g: 150, b: 125 }; sk.sig = sig; return (f._sk = sk);
}
function paintMouth(c2, f, sc, mx, my, st, alpha) {
  const m = f.mouth; if (!m || !m.on || alpha < .02 || st.act < .02) return;
  const mw = m.w * sc * UI.mouth(), o = st.open, sk = tintSk(skinOf(f, m)), vt = Math.max(0, Math.min(1, (o - .05) / .13)), vis = vt * vt * (3 - 2 * vt); if (vis < .02) return; alpha *= vis; // الفم المغلق = الشفاه الأصلية، فلا يظهر ترقيع
  c2.save(); c2.globalAlpha = Math.min(1, alpha * st.act); c2.translate(mx, my + mw * .07 * o); if ('filter' in c2) c2.filter = 'blur(' + (mw * .022).toFixed(2) + 'px)'; c2.rotate((m.r || 0) * Math.PI / 180);
  const a = mw * 0.5 * (1 + 0.16 * st.wide - 0.34 * st.round), hgt = mw * (0.30 * o * (1 - 0.2 * st.wide) + 0.15 * st.round * o), cl = mw * 0.035;
  const uh = mw * 0.02 + hgt * 0.2, lh = hgt;
  // رقعة بلون البشرة تُخفي الفم الأصلي بحواف ناعمة
  const R = mw * 0.9; c2.save(); c2.translate(0, mw * 0.02); c2.scale(1, .5);
  const gp = c2.createRadialGradient(0, 0, R * .55, 0, 0, R);
  gp.addColorStop(0, 'rgba(' + sk.r + ',' + sk.g + ',' + sk.b + ',1)'); gp.addColorStop(1, 'rgba(' + sk.r + ',' + sk.g + ',' + sk.b + ',0)');
  c2.fillStyle = gp; c2.beginPath(); c2.arc(0, 0, R, 0, 7); c2.fill(); c2.restore();
  // الفم المفتوح
  c2.beginPath(); c2.moveTo(-a, -cl); c2.quadraticCurveTo(0, -cl - uh * 2, a, -cl); c2.quadraticCurveTo(0, -cl + lh * 2 + mw * .02, -a, -cl); c2.closePath();
  c2.save(); c2.clip();
  const gi = c2.createLinearGradient(0, -uh - cl, 0, lh); gi.addColorStop(0, '#3a1213'); gi.addColorStop(1, '#170607');
  c2.fillStyle = gi; c2.fillRect(-a - 2, -uh - cl - 2, 2 * a + 4, uh + lh + cl * 2 + 6);
  if (hgt > mw * .06) { const th = Math.min(hgt * .45, mw * .16); c2.fillStyle = '#d6cfc3'; c2.fillRect(-a * .8, -cl - uh - 1, a * 1.6, uh + th * .8 + 1); }
  if (hgt > mw * .14) { c2.fillStyle = '#8f4640'; c2.beginPath(); c2.ellipse(0, -cl + lh * .95, a * .55, hgt * .4, 0, 0, 7); c2.fill(); }
  c2.restore();
  const lip = 'rgb(' + Math.min(255, Math.round(sk.r * .80 + 10)) + ',' + Math.round(sk.g * .58) + ',' + Math.round(sk.b * .58 + 4) + ')';
  c2.lineJoin = 'round'; c2.lineCap = 'round'; c2.strokeStyle = lip;
  c2.lineWidth = mw * .05; c2.beginPath(); c2.moveTo(-a, -cl); c2.quadraticCurveTo(0, -cl - uh * 2, a, -cl); c2.stroke();
  c2.lineWidth = mw * .065; c2.beginPath(); c2.moveTo(-a, -cl); c2.quadraticCurveTo(0, -cl + lh * 2 + mw * .02, a, -cl); c2.stroke();
  c2.restore();
}
function procMouth(tm) {
  const a = Math.abs(Math.sin(tm * 11 + Math.sin(tm * 2.7) * 2)), ph = .5 + .5 * Math.sin(tm * 1.9 + 1), gate = Math.sin(tm * .8 + .5) > -.9 ? 1 : .15;
  return Math.min(1, a * (.35 + .65 * ph) * 1.1) * gate;
}
// ===== تحليل مسبق للصوت المرفق: مظروف الصوت ومخارج الحروف كل 10 ملّي ثانية =====
// يُحسب مرة لكل مقطع، فيعرف المحرّك ما سيُنطق قبل سماعه: الفم يسبق الصوت قليلًا كما في الكلام الحقيقي،
// وتتزامن الإيماءات مع نهايات العبارات والنبرات القوية، وتتبع البطاقات والترجمة تقدّم الكلام الفعلي (لا الزمن الخطي)
const FFTN = 1024;
let FFTW = null, FFTR = null;
function fftInit() {
  FFTW = new Float32Array(FFTN); for (let i = 0; i < FFTN; i++) FFTW[i] = .42 - .5 * Math.cos(2 * Math.PI * i / FFTN) + .08 * Math.cos(4 * Math.PI * i / FFTN);   // نافذة Blackman كما في AnalyserNode
  FFTR = new Uint16Array(FFTN); for (let i = 0, b = Math.log2(FFTN); i < FFTN; i++) { let r = 0; for (let j = 0; j < b; j++) if (i & (1 << j)) r |= 1 << (b - 1 - j); FFTR[i] = r; }
}
function fft(re, im) {
  const N = FFTN; for (let i = 0; i < N; i++) { const j = FFTR[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= N; len <<= 1) { const h = len >> 1, a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < h; k++) { const x = i + k, y = x + h, tr = re[y] * cr - im[y] * ci, ti = re[y] * ci + im[y] * cr; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
function analyzeAudio(ab) {
  if (ab._env) return ab._env; if (!FFTW) fftInit();
  const sr = ab.sampleRate, d = ab.getChannelData(0), hop = Math.max(1, Math.round(sr / 100)), n = Math.max(2, Math.floor(d.length / hop)), bw = sr / FFTN;
  const op = new Float32Array(n), wd = new Float32Array(n), rd = new Float32Array(n), env = new Float32Array(n), re = new Float32Array(FFTN), im = new Float32Array(FFTN), by = new Uint8Array(FFTN / 2);
  const rmsA = new Float32Array(n);   // مرحلة أولى: طاقة الصوت لكل 10 ملّي ثانية، ثم معايرة الفتح على المئين 95 للمقطع كله (لا على قمة متحركة تُضعف الكلام بعد صيحة)
  for (let k = 0; k < n; k++) { const st = k * hop - FFTN / 2; let e = 0; for (let i = 0; i < FFTN; i++) { const x = st + i, v = x >= 0 && x < d.length ? d[x] : 0; e += v * v; } rmsA[k] = Math.sqrt(e / FFTN); }
  const srt = Float32Array.from(rmsA).sort(), pkc = Math.max(.04, srt[Math.min(n - 1, Math.floor(n * .95))] * 1.1);
  for (let k = 0; k < n; k++) {
    const st = k * hop - FFTN / 2; let e = 0;
    for (let i = 0; i < FFTN; i++) { const x = st + i, v = x >= 0 && x < d.length ? d[x] : 0; e += v * v; re[i] = v * FFTW[i]; im[i] = 0; }
    const rms = rmsA[k]; env[k] = Math.min(1.2, rms / pkc);
    let o = Math.pow(Math.max(0, Math.min(1, (rms / pkc - .09) / .92)), .9), w = 0, r2 = 0;   // مدى أوسع: لا يلتصق الفتح بالحد الأقصى في الأصوات العالية
    fft(re, im); for (let i = 0; i < FFTN / 2; i++) { const m = Math.hypot(re[i], im[i]) / FFTN, db = 20 * Math.log10(m + 1e-12); by[i] = Math.max(0, Math.min(255, Math.round(255 * (db + 100) / 70))); }   // نفس تحويل AnalyserNode إلى بايت
    const cen = (a, b) => { let sw = 0, sf = 0; for (let i = Math.max(1, Math.round(a / bw)); i < Math.min(by.length, Math.round(b / bw)); i++) { const q = Math.max(0, by[i] - 70); sw += q; sf += q * i * bw; } return sw > 40 ? sf / sw : 0; };
    const F1 = cen(250, 1000), F2 = cen(900, 2800); let lo = 0, hi = 0, nl = 0, nh = 0;
    for (let i = Math.max(1, Math.round(250 / bw)); i < Math.round(1000 / bw); i++) { lo += by[i]; nl++; }
    for (let i = Math.round(2200 / bw); i < Math.min(by.length, Math.round(5500 / bw)); i++) { hi += by[i]; nh++; }
    const r = ((hi / Math.max(1, nh)) + 1) / ((lo / Math.max(1, nl)) + (hi / Math.max(1, nh)) + 2);
    w = Math.max(0, Math.min(1, (r - .3) * 2.6)); const rdo = Math.max(0, Math.min(1, (.42 - r) * 3)); r2 = rdo * o;
    if (F1 && F2) { const a2 = Math.max(0, Math.min(1, (F2 - 1750) / 550)), b2 = Math.max(0, Math.min(1, (1500 - F2) / 350)), o1 = Math.max(0, Math.min(1, (F1 - 420) / 200)); w = .4 * w + .6 * a2; r2 = (.35 * rdo + .65 * b2) * o; o = Math.min(1, o * (.8 + .4 * o1)); }
    if (r > .6) { o = Math.min(o, .3); w = Math.max(w, .72); r2 *= .3; }   // حروف الصفير (س ش ف): الأسنان متقاربة والشفتان مشدودتان، فلا يُفتح الفم كثيرًا
    op[k] = o; wd[k] = w; rd[k] = r2;
  }
  { // تنظيف: وسيط على 5 عينات (50 ملّي ثانية) للشكل العريض/المستدير حتى لا يرتجف، ومزج خفيف للفتح كي تبقى الإغلاقات القصيرة (م ب)
    const med = a => { const q = new Float32Array(n), w5 = [0, 0, 0, 0, 0]; for (let k = 0; k < n; k++) { for (let j = -2; j <= 2; j++) w5[j + 2] = a[Math.min(n - 1, Math.max(0, k + j))]; w5.sort((x, y) => x - y); q[k] = w5[2]; } return q; };
    const o2 = med(op), w2 = med(wd), r3 = med(rd);
    for (let k = 0; k < n; k++) { op[k] = .5 * o2[k] + .5 * op[k]; wd[k] = w2[k]; rd[k] = r3[k]; }
  }
  // نشاط الكلام (للتقدّم الفعلي) + حدود العبارات (صمت ≥ 0.22 ثانية) + النبرات القوية => نقاط تغيير الإيماءة
  const sm = new Float32Array(n); for (let k = 0; k < n; k++) { let a = 0, c = 0; for (let j = Math.max(0, k - 3); j <= Math.min(n - 1, k + 3); j++) { a += env[j]; c++; } sm[k] = a / c; }
  const cum = new Float32Array(n + 1); for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + (sm[k] > .12 ? 1 : 0);
  const bd = [], pe = []; let sil = 0;
  for (let k = 0; k < n; k++) {
    if (sm[k] < .09) sil++; else { if (sil >= 22 && k > 50) bd.push(k / 100); sil = 0; }
    if (k > 50 && k < n - 4 && sm[k] > .62 && sm[k] >= sm[k - 4] * 1.12 && sm[k] >= sm[k + 1] && sm[k] > sm[k - 1] && sm[k] >= sm[k + 4]) pe.push(k / 100);
  }
  const evs = []; for (const t of bd) if (!evs.length || t - evs[evs.length - 1] >= 1.9) evs.push(t);       // نهايات العبارات أولًا
  for (const t of pe) if (evs.every(x => Math.abs(x - t) >= 1.7)) evs.push(t);                           // ثم النبرات القوية البعيدة عنها
  evs.sort((a, b) => a - b);
  return (ab._env = { n, op, wd, rd, cum, tot: Math.max(1, cum[n]), ev: evs, dur: ab.duration });
}
function envOf(s) {
  if (!$('cSync') || !$('cSync').checked || !AC || s !== SHOTS[idx] || !spoken || !playing || s._a0 == null || AC.currentTime >= audioUntil + .05) return null;
  const ab = AB(s); return ab && ab._env || null;
}
function audioPos(s) { const lat = rec ? 0 : Math.min(.25, (AC.outputLatency || 0) + (AC.baseLatency || 0)); return AC.currentTime - s._a0 - lat; }
function spFrac(s) { const E = envOf(s); if (!E) return null; const p = audioPos(s); if (p < 0) return 0; if (p >= E.dur) return 1; const f = p * 100, k = Math.min(E.n - 1, Math.floor(f)); return (E.cum[k] + (f - k) * (E.cum[k + 1] - E.cum[k])) / E.tot; }
function evCount(E, p) { let c = 0; while (c < E.ev.length && E.ev[c] <= p) c++; return c; }

const MQ = [], MV = { open: 0, wide: 0, round: 0 };
function spr(key, target, wn, zeta, dt) {   // نابض من الدرجة الثانية بخطوات صغيرة ثابتة (مستقر مهما تغيّر معدل الإطارات)
  let x = M[key], v = MV[key]; const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
  for (let i = 0; i < n; i++) { v += (wn * wn * (target - x) - 2 * zeta * wn * v) * h; x += v * h; }
  MV[key] = v; return x;
}
function updateMouth(dt, s) {
  let live = false, ana = false;
  if (playing && t >= s.inT && t < s.dur - s.outT) {
    if (AB(s)) { if (AC && AC.currentTime < audioUntil) { live = true; ana = true; } }
    else if (s.speaking && !s.done && s.ci >= 0) live = true;
    else if (!$('cTts').checked && t < s.inT + s.text.length / RATE) live = true;
  }
  let op = 0, wd = 0, rd = 0, envMode = false;
  const EN = live && ana ? envOf(s) : null;
  if (EN) {
    const f = Math.max(0, (audioPos(s) + .055) * 100), k = Math.min(EN.n - 1, Math.floor(f)), k2 = Math.min(EN.n - 1, k + 1), u = f - k;   // الفم يسبق الصوت بـ 40 ملّي ثانية
    op = EN.op[k] * (1 - u) + EN.op[k2] * u; wd = EN.wd[k] * (1 - u) + EN.wd[k2] * u; rd = EN.rd[k] * (1 - u) + EN.rd[k2] * u; envMode = true;
  } else if (live && ana && AN) {
    if (!tdata) { tdata = new Float32Array(AN.fftSize); fdata = new Uint8Array(AN.frequencyBinCount); }
    AN.getFloatTimeDomainData(tdata); let e = 0; for (let i = 0; i < tdata.length; i++) e += tdata[i] * tdata[i];
    const rms = Math.sqrt(e / tdata.length); pk = Math.max(pk * Math.exp(-dt * .25), rms, .04);
    op = Math.pow(Math.max(0, Math.min(1, (rms / pk - .10) / .65)), .85);
    AN.getByteFrequencyData(fdata); const bw = AC.sampleRate / AN.fftSize; let lo = 0, hi = 0, nl = 0, nh = 0;
    // مركز ثقل الطيف في نطاقين تقريبًا يمثلان الصائتين الأول والثاني: الأول عالٍ = فم مفتوح (ا)، والثاني عالٍ = فم عريض (ي)، والثاني منخفض = فم مستدير (و)
    const cen = (a, b) => { let sw = 0, sf = 0; for (let i = Math.max(1, Math.round(a / bw)); i < Math.min(fdata.length, Math.round(b / bw)); i++) { const w = Math.max(0, fdata[i] - 70); sw += w; sf += w * i * bw; } return sw > 40 ? sf / sw : 0; };
    const F1 = cen(250, 1000), F2 = cen(900, 2800);
    for (let i = Math.max(1, Math.round(250 / bw)); i < Math.round(1000 / bw); i++) { lo += fdata[i]; nl++; }
    for (let i = Math.round(2200 / bw); i < Math.min(fdata.length, Math.round(5500 / bw)); i++) { hi += fdata[i]; nh++; }
    const r = ((hi / Math.max(1, nh)) + 1) / ((lo / Math.max(1, nl)) + (hi / Math.max(1, nh)) + 2);
    wd = Math.max(0, Math.min(1, (r - .3) * 2.6)); const rdo = Math.max(0, Math.min(1, (.42 - r) * 3)); rd = rdo * op;
    if (F1 && F2) {
      const w2 = Math.max(0, Math.min(1, (F2 - 1750) / 550)), r2 = Math.max(0, Math.min(1, (1500 - F2) / 350)), o1 = Math.max(0, Math.min(1, (F1 - 420) / 200));   // معايرة على الصوت المرفق
      wd = .4 * wd + .6 * w2; rd = (.35 * rdo + .65 * r2) * op; op = Math.min(1, op * (.8 + .4 * o1));
    }
  } else if (live) { op = procMouth(clock); wd = .5 + .5 * Math.sin(clock * 3.1); rd = (1 - wd) * op * .6; }
  // تعويض زمن تأخر خرج الصوت لتتطابق حركة الفم مع ما يُسمَع
  MQ.push([clock, op, wd, rd]); const lat = ana && AC && !envMode ? Math.min(.25, (AC.outputLatency || 0) + (AC.baseLatency || 0)) : 0;
  while (MQ.length > 1 && MQ[1][0] <= clock - lat) MQ.shift(); if (MQ.length > 90) MQ.splice(0, MQ.length - 90);
  const q = MQ[0]; op = Math.min(1, Math.pow(q[1], 1.15) * .92); wd = q[2]; rd = q[3];
  // حركة الفك والشفتين كنابض مخمَّد (له زخم وتجاوز طفيف) بدل تتبّع أُسّي جامد؛ الإغلاق أسرع من الفتح كما في الكلام الحقيقي
  if (op < .07) op = 0; { const sm = wd + rd; if (sm > 1) { wd /= sm; rd /= sm; } }
  M.open = Math.max(0, Math.min(1, spr('open', op, op > M.open ? 48 : 66, .82, dt)));
  M.wide = Math.max(0, Math.min(1, spr('wide', wd, 30, .9, dt))); M.round = Math.max(0, Math.min(1, spr('round', rd, 30, .9, dt)));
  M.act += ((live ? 1 : 0) - M.act) * (1 - Math.exp(-dt * 10));
}
// ----- حفظ/تحميل مواضع الفم + اكتشافها بـ Gemini + أداة الضبط اليدوي -----
const mkey = n => { const im = imgs[n], c = SH[n]; return n + '|' + im.naturalWidth + 'x' + im.naturalHeight + '|' + c.cols + 'x' + c.rows.length; };
function loadMouths(n) {
  try {
    const all = JSON.parse(Store.getItem('mouths_v3') || '{}'), arr = all[mkey(n)], fr = frames[n];
    if (arr && fr && arr.length === fr.length) arr.forEach((m, i) => { if (m) fr[i].mouth = m; });
  } catch (_) {}
}
function saveMouths(n) {
  try { const all = JSON.parse(Store.getItem('mouths_v3') || '{}'); all[mkey(n)] = frames[n].map(f => f.mouth); Store.setItem('mouths_v3', JSON.stringify(all)); } catch (_) {}
}
function frameJpeg(f) {
  const k = Math.min(1, 448 / Math.max(f.width, f.height)), c = document.createElement('canvas'); c.width = Math.round(f.width * k); c.height = Math.round(f.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); g.drawImage(f, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .85).split(',')[1];
}
async function detectMouths(n, silent) {
  const key = $('kKey').value.trim(), fr = frames[n]; if (!fr || SH[n].nm) return false;
  if (key.length < 10) { if (!silent) msg('أدخل مفتاح Gemini أولًا'); return false; }
  const prompt = 'Each image below is one pose of the same cartoon/realistic person on a gray background. For EVERY frame return where the MOUTH is. Reply with JSON only: an array of objects {"i":frame_number,"visible":true/false,"x":0..1,"y":0..1,"w":0..1,"roll":degrees}. x and y are the mouth center as a fraction of the image width/height measured from the top-left, w is the mouth width as a fraction of the image width, roll is the head tilt in degrees (positive = clockwise). visible=false only if the face is turned away or the mouth is hidden.';
  const parts = [{ text: prompt }]; fr.forEach((f, i) => { parts.push({ text: 'frame ' + (i + 1) + ':' }); parts.push({ inlineData: { mimeType: 'image/jpeg', data: frameJpeg(f) } }); });
  const was = busy; msg('جاري اكتشاف مكان الفم في «' + SH[n].label + '» …');
  try {
    let arr = null, lastSt = 0;
    for (let a = 0; a < 3 && !arr; a++) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) });
      if (r.status === 429 || r.status >= 500) { lastSt = r.status; await sleep(8000 * (a + 1)); continue; }
      const d = await r.json(); if (!r.ok) throw new Error(gemErr(r.status, d.error && d.error.message));
      arr = JSON.parse(d.candidates[0].content.parts.map(p => p.text || '').join('').replace(/```json|```/g, '').trim());
    }
    if (!Array.isArray(arr)) throw new Error(lastSt ? gemErr(lastSt) : 'لم يصل رد صالح');
    let ok = 0;
    arr.forEach(o => {
      const f = fr[(o.i | 0) - 1]; if (!f || !o) return;
      if (o.visible === false) { f.mouth.on = false; return; }
      const x = +o.x, y = +o.y, w = +o.w, H = f.bb.y1 - f.bb.y0;
      if (!(x > 0 && x < 1 && y > 0 && y < 1 && w > .01 && w < .6)) return;
      if (y * f.height > f.bb.y0 + H * .6) return;                                   // الفم لا يكون في النصف السفلي
      f.mouth = { x: x * f.width, y: y * f.height, w: w * f.width, r: Math.max(-25, Math.min(25, +o.roll || 0)), on: true, auto: 1 }; f._sk = null; ok++;
    });
    saveMouths(n); msg('تم تحديد الفم في ' + ok + ' من ' + fr.length + ' إطار («' + SH[n].label + '»)'); drawMouthPrev(); return true;
  } catch (e) { msg('تعذّر اكتشاف الفم: ' + errText(e) + ' — يمكنك ضبطه يدويًا'); return false; }
}
const mSel = $('mSheet'), mFr = $('mFrame'), mc = $('mc'), mg = mc.getContext('2d');
function refreshMouthUI() {
  const cur = mSel.value; mSel.innerHTML = '';
  for (const n of Object.keys(SH)) if (frames[n] && !SH[n].nm) { const o = document.createElement('option'); o.value = n; o.textContent = SH[n].label; mSel.appendChild(o); }
  if (cur && frames[cur]) mSel.value = cur; if (mSel.value && frames[mSel.value]) { mFr.max = frames[mSel.value].length; if (+mFr.value > +mFr.max) mFr.value = 1; }
  drawMouthPrev();
}
const curF = () => { const fr = frames[mSel.value]; return fr && fr[(+mFr.value || 1) - 1]; };
function mouthInfo() {
  const fr = frames[mSel.value]; if (!fr) { $('mInfo').textContent = 'ارفع لوحة شخصية أولًا'; return; }
  const on = fr.filter(f => f.mouth && f.mouth.on).length, au = fr.filter(f => f.mouth && f.mouth.auto === 1).length;
  $('mInfo').textContent = 'الفم مفعّل في ' + on + ' من ' + fr.length + ' إطار' + (au ? ' (' + au + ' بالاكتشاف الذكي)' : ' (تقدير تقريبي — اكتشف بـ Gemini أو اضبطه يدويًا)');
}
let mFS = false, mV = { cx: 0, cy: 0, vx: 0, vy: 0, vh: 1 };
function mRecenter() { const f = curF(); if (!f) return; const z = +$('mZoom').value || 1, m = f.mouth; mV.cx = z > 1 && m ? m.x : f.width / 2; mV.cy = z > 1 && m ? m.y : f.height / 2; }
// موضع الفم بإحداثيات اللوحة، وقبضة الدوران على بُعد ثابت منه بزاوية الفم
const mPos = f => { const m = f.mouth; if (mFS) { const sc = 1000 / mV.vh; return { x: (m.x - mV.vx) * sc, y: (m.y - mV.vy) * sc }; } const sc = 340 / f.height; return { x: m.x * sc, y: m.y * sc }; };
const mHandle = p => { const R = mFS ? 110 : 38, a = ((curF().mouth.r || 0) * Math.PI) / 180; return { x: p.x + R * Math.cos(a), y: p.y + R * Math.sin(a) }; };
function drawMouthPrev() {
  CUR_AMB = null; const f = curF(); $('mNum').textContent = mFr.value; mouthInfo(); { const fm = f && f.mouth; $('mR').value = fm ? (fm.r || 0) : 0; $('mRv').textContent = Math.round(fm ? (fm.r || 0) : 0) + '°'; } $('mZv').textContent = (+$('mZoom').value) + '×';
  if (!f) { mg.clearRect(0, 0, mc.width, mc.height); return; }
  const m = f.mouth, MP = { open: .7, wide: .2, round: 0, act: 1 };
  if (mFS) {                                                  // ملء الشاشة: عرض مكبّر حول الوجه، الإحداثيات تُحوَّل حسب نافذة العرض
    const S = 1000, z = +$('mZoom').value || 1, vh = f.height / z, vx = mV.cx - vh / 2, vy = mV.cy - vh / 2, sc = S / vh; mV.vx = vx; mV.vy = vy; mV.vh = vh;
    mc.width = S; mc.height = S; mg.fillStyle = '#6b7a86'; mg.fillRect(0, 0, S, S); mg.fillStyle = '#7d8c98';
    for (let y = 0; y < S; y += 40) for (let x = (y / 40 % 2) * 40; x < S; x += 80) mg.fillRect(x, y, 40, 40);
    mg.save(); mg.translate(-vx * sc, -vy * sc); mg.drawImage(f, 0, 0, f.width * sc, f.height * sc);
    if (m) { if (m.on) paintMouth(mg, f, sc, m.x * sc, m.y * sc, MP, 1);
      mg.strokeStyle = m.on ? '#0f0' : '#f55'; mg.lineWidth = 2; mg.beginPath(); mg.arc(m.x * sc, m.y * sc, 7, 0, 7); mg.stroke(); }
    mg.restore();
    if (m) { const p = mPos(f), h = mHandle(p); mg.strokeStyle = '#ffb020'; mg.fillStyle = '#ffb020'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(p.x, p.y); mg.lineTo(h.x, h.y); mg.stroke(); mg.beginPath(); mg.arc(h.x, h.y, 14, 0, 7); mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.stroke(); }
    if (m) { $('mW').value = Math.round(m.w / f.height * 1000); $('mOn').checked = !!m.on; }
    return;
  }
  const Hh = 340, sc = Hh / f.height; mc.height = Hh; mc.width = Math.max(40, Math.round(f.width * sc));
  mg.fillStyle = '#6b7a86'; mg.fillRect(0, 0, mc.width, Hh); mg.fillStyle = '#7d8c98';
  for (let y = 0; y < Hh; y += 20) for (let x = (y / 20 % 2) * 20; x < mc.width; x += 40) mg.fillRect(x, y, 20, 20);
  mg.drawImage(f, 0, 0, mc.width, Hh);
  if (m) {
    if (m.on) paintMouth(mg, f, sc, m.x * sc, m.y * sc, MP, 1);
    mg.strokeStyle = m.on ? '#0f0' : '#f55'; mg.lineWidth = 1.5; mg.beginPath(); mg.arc(m.x * sc, m.y * sc, 4, 0, 7); mg.stroke();
    { const p = mPos(f), h = mHandle(p); mg.strokeStyle = '#ffb020'; mg.fillStyle = '#ffb020'; mg.lineWidth = 1.5; mg.beginPath(); mg.moveTo(p.x, p.y); mg.lineTo(h.x, h.y); mg.stroke(); mg.beginPath(); mg.arc(h.x, h.y, 6, 0, 7); mg.fill(); }
    $('mW').value = Math.round(m.w / f.height * 1000); $('mOn').checked = !!m.on;
  }
}
function setMFS(on) { mFS = on; document.documentElement.classList.toggle('mfs', on); $('mWrap').classList.toggle('fs', on); $('mFS').textContent = on ? '✕ إغلاق ملء الشاشة' : '⛶ ملء الشاشة'; if (on) { mRecenter(); } drawMouthPrev(); }
$('mFS').onclick = () => setMFS(!mFS);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && mFS) setMFS(false); });
$('mZoom').oninput = () => { mRecenter(); drawMouthPrev(); };
mSel.onchange = () => { mFr.max = (frames[mSel.value] || []).length || 1; mFr.value = 1; mRecenter(); drawMouthPrev(); };
mFr.oninput = () => { mRecenter(); drawMouthPrev(); };
function mSetPos(e) {
  const f = curF(); if (!f) return; const r = mc.getBoundingClientRect(), m = f.mouth || { r: 0, w: f.height * .04 }, u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  const x = mFS ? mV.vx + u * mV.vh : u * f.width, y = mFS ? mV.vy + v * mV.vh : v * f.height;
  f.mouth = Object.assign(m, { x, y, on: true, auto: 0 }); f._sk = null; saveMouths(mSel.value); drawMouthPrev();
}
let mDown = false, mRot = false;
const mcXY = e => { const r = mc.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * mc.width, y: (e.clientY - r.top) / r.height * mc.height }; };
function mSetRot(e) {
  const f = curF(); if (!f || !f.mouth) return; const p = mPos(f), q = mcXY(e);
  let a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI; a = Math.max(-60, Math.min(60, Math.round(a)));
  f.mouth.r = a; f._sk = null; saveMouths(mSel.value); drawMouthPrev();
}
mc.onpointerdown = e => {
  mDown = true; try { mc.setPointerCapture(e.pointerId); } catch (_) {}
  const f = curF(); mRot = false;
  if (f && f.mouth) { const h = mHandle(mPos(f)), q = mcXY(e); if (Math.hypot(q.x - h.x, q.y - h.y) < (mFS ? 50 : 20)) mRot = true; }
  if (mRot) mSetRot(e); else mSetPos(e);
};
mc.onpointermove = e => { if (!mDown) return; if (mRot) mSetRot(e); else if (mFS) mSetPos(e); };   // اسحب القبضة البرتقالية لتدوير الفم
mc.onpointerup = mc.onpointercancel = () => { mDown = false; mRot = false; };
$('mR').oninput = () => { const f = curF(); if (!f || !f.mouth) return; f.mouth.r = +$('mR').value; f._sk = null; saveMouths(mSel.value); drawMouthPrev(); };
$('mR0').onclick = () => { const f = curF(); if (!f || !f.mouth) return; f.mouth.r = 0; f._sk = null; saveMouths(mSel.value); drawMouthPrev(); };
$('mW').oninput = () => { const f = curF(); if (!f || !f.mouth) return; f.mouth.w = +$('mW').value / 1000 * f.height; f._sk = null; saveMouths(mSel.value); drawMouthPrev(); };
$('mOn').onchange = () => { const f = curF(); if (!f || !f.mouth) return; f.mouth.on = $('mOn').checked; saveMouths(mSel.value); drawMouthPrev(); };
$('mAll').onclick = () => {
  const fr = frames[mSel.value], f = curF(); if (!fr || !f || !f.mouth) return; const Hf = f.bb.y1 - f.bb.y0, m = f.mouth;
  fr.forEach(g => { if (g === f) return; const k = (g.bb.y1 - g.bb.y0) / Hf; g.mouth = { x: g.ax + (m.x - f.ax) * k, y: g.bb.y0 + (m.y - f.bb.y0) * k, w: m.w * k, r: m.r || 0, on: m.on }; g._sk = null; });
  saveMouths(mSel.value); msg('تم تعميم موضع الفم على كل إطارات اللوحة'); drawMouthPrev();
};
$('mAuto').onclick = async () => { if (busy) return; busy = true; await detectMouths(mSel.value, false); busy = false; };
$('mReset').onclick = () => {
  const n = mSel.value, fr = frames[n]; if (!fr) return; const cfg = SH[n], mk = cfg.mk || { y: .125, w: .030 };
  fr.forEach(f => { f.mouth = { x: f._hx, y: f._ht + f._hr * mk.y, w: f._hr * mk.w, r: 0, on: !cfg.mm }; f._sk = null; }); saveMouths(n); drawMouthPrev();
};
function afterSheet(n) { refreshMouthUI(); if (!SH[n].nm && gemKey() && $('cAutoMouth').checked) detectMouths(n, true); }
let _pt = 0;
function rebuildSoon(n) { clearTimeout(_pt); msg('جاري إعادة التجميع …'); _pt = setTimeout(() => { build(n); renderParts(); refreshMouthUI(); msg(''); }, 60); }
function renderParts() {
  const box = $('partsList'); if (!box) return; box.innerHTML = ''; let any = false;
  for (const n of Object.keys(parts)) {
    const P = parts[n]; if (!P || !P.length) continue; any = true;
    const h = document.createElement('div'); h.style.cssText = 'margin:8px 0 2px;font-weight:600'; h.textContent = SH[n].label + ' — ' + (frames[n] ? frames[n].length : '?') + ' وضعية'; box.appendChild(h);
    P.forEach((q, i) => {
      const row = document.createElement('div'); row.className = 'shot'; row.style.cursor = 'default';
      const im = document.createElement('img'); im.src = q.im.src; im.style.cssText = 'width:64px;height:40px;object-fit:cover;border-radius:4px;background:#2a3a30';
      const nm = document.createElement('span'); nm.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; nm.textContent = (i + 1) + '. ' + (q.name || '');
      const ni = document.createElement('input'); ni.type = 'number'; ni.min = 1; ni.max = 8; ni.value = q.n; ni.style.width = '48px'; ni.title = 'عدد الوضعيات في هذه الصورة'; ni.onchange = () => { q.n = Math.max(1, +ni.value || 1); rebuildSoon(n); };
      const gi = document.createElement('input'); gi.type = 'number'; gi.min = 1; gi.max = 99; gi.value = q.g; gi.style.width = '48px'; gi.title = 'رقم المجموعة: الصور بنفس الرقم تُدمج معًا كنسخ من نفس الوضعيات'; gi.onchange = () => { q.g = Math.max(1, +gi.value || 1); rebuildSoon(n); };
      const mkb = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'font-size:13px;padding:3px 9px'; b.onclick = fn; return b; };
      row.append(im, nm, ni, gi, mkb('▲', () => { if (i > 0) { [P[i - 1], P[i]] = [P[i], P[i - 1]]; rebuildSoon(n); } }), mkb('▼', () => { if (i < P.length - 1) { [P[i + 1], P[i]] = [P[i], P[i + 1]]; rebuildSoon(n); } }), mkb('✕', () => { P.splice(i, 1); if (!P.length) delete parts[n]; rebuildSoon(n); }));
      box.appendChild(row);
    });
  }
  if (!any) box.textContent = 'لا توجد صور منفصلة بعد';
}
$('bRebuild').onclick = () => { for (const n of Object.keys(imgs)) build(n); refreshMouthUI(); msg('تمت إعادة معالجة اللوحات'); };
['sMerge', 'rMergeT'].forEach(id => $(id).addEventListener('change', () => { if (Object.keys(parts).length) { msg('جاري إعادة الدمج …'); setTimeout(() => $('bRebuild').click(), 30); } }));
['rEdge', 'rHalo'].forEach(id => { $(id).addEventListener('input', () => { $('v' + id.slice(1)).textContent = $(id).value; }); $(id).addEventListener('change', () => { msg('جاري إعادة المعالجة …'); setTimeout(() => $('bRebuild').click(), 30); }); });
$('vEdge').textContent = $('rEdge').value; $('vHalo').textContent = $('rHalo').value;
$('rMouth').oninput = drawMouthPrev;
function drawProps(s, tt) {
  if (!s.props) return;
  const main = s.dur - s.inT - s.outT, m = mOf(s, tt);
  for (const p of s.props) {
    if (m < p.f0 || m >= p.f1) { p._on = false; continue; }
    if (!p._on) { p._on = true; if (sfxOn()) popSfx(); }
    const im = p.id.startsWith('bg') ? bgs[+p.id.slice(2) - 1] : props[p.id]; if (!im) continue;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const local = (m - p.f0) * main, rem = (p.f1 - m) * main, a = Math.min(1, local / 0.35, rem / 0.3), pop = LIFE() ? .55 + .45 * (1 + 2.70158 * Math.pow(Math.min(1, local / .45) - 1, 3) + 1.70158 * Math.pow(Math.min(1, local / .45) - 1, 2)) : 0.88 + 0.12 * Math.min(1, local / 0.35);
    const sc = Math.min(500 / iw, 300 / ih), pw = iw * sc, ph = ih * sc, cw = pw + 28, chh = ph + 28 + 52, cx = W * 0.72, cy = H * 0.36;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(pop, pop);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-cw / 2, -chh / 2, cw, chh, 18); ctx.fill();
    ctx.drawImage(im, -pw / 2, -chh / 2 + 14, pw, ph); drawPulse(p, pw, ph, chh);
    ctx.fillStyle = '#17406e'; ctx.beginPath(); ctx.roundRect(-cw / 2 + 10, chh / 2 - 52, cw - 20, 42, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '26px system-ui'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.fillText(p.cap, 0, chh / 2 - 22);
    ctx.restore();
  }
}
function drawCaption(s, tt) { return; // تم حذف الترجمة المكتوبة من الفيديو

  const ch = chunks(s); if (!ch.length) return; let text, hi = false, loc = 0;
  if (tt < s.inT) text = ch[0]; else if (tt > s.dur - s.outT) text = ch[ch.length - 1];
  else {
    const speak = Math.max(1, AB(s) ? AD(s) : s.text.length / RATE), f = (() => { const sf = spFrac(s); return sf != null ? sf : Math.min(1, (tt - s.inT) / speak); })(), tot = ch.reduce((a, c) => a + c.length, 0); let acc = 0; text = ch[ch.length - 1]; loc = 1;
    for (const c of ch) { acc += c.length; if (f * tot <= acc) { text = c; loc = Math.max(0, Math.min(1, (f * tot - (acc - c.length)) / c.length)); break; } }
    hi = f < 1;
  }
  if (s.speaking && !s.done && s.ci >= 0) { text = ch[s.ci]; hi = false; }
  ctx.save(); ctx.font = '28px system-ui'; ctx.direction = 'rtl'; ctx.textAlign = 'center';
  const lines = wrap(text, 1060), bh = lines.length * 40 + 20, y0 = H - 16 - bh;
  ctx.fillStyle = 'rgba(0,0,0,.66)'; ctx.beginPath(); ctx.roundRect(100, y0, W - 200, bh, 14); ctx.fill();
  // إبراز الكلمة المنطوقة الآن: الكلمات المنطوقة بيضاء، والحالية ذهبية بخلفية، والقادمة أخفت قليلًا
  let cw = -1;
  if (hi) { const ws = text.split(' '), tl = ws.reduce((a, w) => a + w.length + 1, 0), pos = loc * tl; let a = 0; cw = ws.length - 1; for (let i = 0; i < ws.length; i++) { a += ws[i].length + 1; if (pos <= a) { cw = i; break; } } }
  let wi = 0; ctx.textAlign = 'right';
  lines.forEach((l, i) => {
    const y = y0 + 38 + i * 40 - 6, ws = l.split(' '), R = W / 2 + ctx.measureText(l).width / 2;
    ws.forEach((w, k) => {
      const x = R - (k ? ctx.measureText(ws.slice(0, k).join(' ') + ' ').width : 0), ww = ctx.measureText(w).width;
      if (wi === cw) { ctx.fillStyle = 'rgba(255,210,60,.25)'; ctx.beginPath(); ctx.roundRect(x - ww - 7, y - 29, ww + 14, 40, 8); ctx.fill(); ctx.fillStyle = '#ffd23f'; }
      else ctx.fillStyle = cw >= 0 && wi > cw ? '#c9d3df' : '#fff';
      ctx.fillText(w, x, y); wi++;
    });
  });
  ctx.restore();
}
// بطاقة العنوان في أول الفيلم، وبطاقة الخلاصة في آخره، ومؤقت التفكير في مشاهد النقاش
const SUMMARY = ['أماكن انتشارها في العالم الجديد', 'مقارنة خصائصها وحياتها', 'دورها في التوازن البيئي', 'حمايتها من الأخطار'];
function drawCards(s, tt) {
  const n = SHOTS.indexOf(s); ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = 'center';
  if (n === 0 && tt > .4 && tt < s.inT + .6) {
    const u = tt < 1.2 ? (tt - .4) / .8 : tt > s.inT - .2 ? 1 - (tt - (s.inT - .2)) / .8 : 1, a = ease(u);
    ctx.globalAlpha = a * .82; ctx.fillStyle = '#0e2a4a'; ctx.fillRect(0, 230, W, 210);
    ctx.globalAlpha = a; ctx.fillStyle = '#e0a030'; ctx.fillRect(0, 230, W, 5); ctx.fillRect(0, 435, W, 5);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 50px system-ui'; ctx.fillText(s.h, W / 2, 322, 1120);
    ctx.fillStyle = '#cfe3ff'; ctx.font = '28px system-ui'; ctx.fillText('أمريكا الشمالية  •  أمريكا الجنوبية  •  أستراليا', W / 2, 392, 1000);
  }
  if (n === SHOTS.length - 1 && tt > s.inT) {
    const x = 660, y = 110, w = 560, h = 70 + SUMMARY.length * 58;
    ctx.globalAlpha = ease((tt - s.inT) / .6) * .8; ctx.fillStyle = '#0e2a4a'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    ctx.globalAlpha = ease((tt - s.inT) / .6); ctx.fillStyle = '#e0a030'; ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'right'; ctx.fillText('الخلاصة', x + w - 26, y + 46);
    SUMMARY.forEach((p, i) => {
      const a = ease((tt - (s.inT + 1.2 + i * 1.5)) / .5); if (a <= 0) return;
      ctx.globalAlpha = a; ctx.fillStyle = '#7ddc8a'; ctx.font = 'bold 28px system-ui'; ctx.fillText('✓', x + w - 26, y + 108 + i * 58);
      ctx.fillStyle = '#fff'; ctx.font = '27px system-ui'; ctx.fillText(p, x + w - 66, y + 108 + i * 58, w - 100);
    });
  }
  const end = s.dur - s.outT;
  if (s.extra && tt >= end - s.extra && tt <= end && !(s.speaking && !s.done)) {
    const rem = end - tt, f = rem / s.extra, cx = W - 130, cy = 160, r = 60;
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(14,42,74,.82)'; ctx.beginPath(); ctx.arc(cx, cy, r + 16, 0, 7); ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#e0a030'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 46px system-ui'; ctx.fillText(Math.ceil(rem), cx, cy + 16);
    ctx.fillStyle = 'rgba(14,42,74,.88)'; ctx.beginPath(); ctx.roundRect(cx - 74, cy + r + 20, 148, 36, 18); ctx.fill();
    ctx.font = '22px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('وقت التفكير', cx, cy + r + 46);
  }
  ctx.restore();
}
function drawChip(s) {
  if (!$('cChip') || !$('cChip').checked) return;
  ctx.save(); ctx.font = '22px system-ui'; ctx.direction = 'rtl'; ctx.textAlign = 'center';
  const w = Math.min(380, ctx.measureText(s.h).width + 36), x = 24, y = 20;
  ctx.fillStyle = 'rgba(20,50,90,.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, 40, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(s.h, x + w / 2, y + 28, w - 24); ctx.restore();
}
function voices() { return window.speechSynthesis ? speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang)) : []; }
function fillVoices() {
  const sel = $('sVoice'), vs = voices(), cur = sel.value; sel.innerHTML = '';
  vs.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; sel.appendChild(o); });
  if (!vs.length) { const o = document.createElement('option'); o.value = ''; o.textContent = 'افتراضي'; sel.appendChild(o); }
  if (cur) sel.value = cur;
}
if (window.speechSynthesis) { fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
function speak(s) {
  if (!$('cTts').checked) return;
  const ab = AB(s); if (ab) { const a = ac(); if (a.state === 'suspended') a.resume(); const src = a.createBufferSource(); src.buffer = ab; src.connect(a.destination); src.connect(DEST); if (AN) src.connect(AN); audioUntil = a.currentTime + ab.duration; try { analyzeAudio(ab); } catch (_) {} s._a0 = a.currentTime; src.start(a.currentTime); cur = src; return; }
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const ch = chunks(s); s.speaking = true; s.done = false; s.hold = 0; s.ci = -1;
  const v = voices().find(x => x.name === $('sVoice').value);
  ch.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c); u.lang = v ? v.lang : 'ar-EG'; if (v) u.voice = v; u.rate = +$('rRate').value;
    u.onstart = () => { s.ci = i; s.cT = clock; };
    u.onend = () => { if (i === ch.length - 1) s.done = true; };
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') { s.speaking = false; msg('تعذّر تشغيل الصوت العربي على هذا الجهاز'); } };
    speechSynthesis.speak(u);
  });
}
