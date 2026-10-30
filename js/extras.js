// ===== نبض على مواضع الخرائط عند ذكر المنطقة (المواضع نسب من الصورة، ويمكن ضبطها بالضغط) =====
const PULSE = {};
const PK = 'cartoonPulse1'; let PO = {}; try { PO = JSON.parse(Store.getItem(PK) || '{}'); } catch (_) {}
const pts = k => PO[k] || PULSE[k];
function drawPulse(p, pw, ph, chh) {
  if (!$('cPulse').checked) return; const arr = pts(p.id + '|' + p.cap); if (!arr) return;
  arr.forEach((q, i) => {
    const x = -pw / 2 + q[0] * pw, y = -chh / 2 + 14 + q[1] * ph, u = (clock * .9 + i * .35) % 1;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,75,58,' + (1 - u).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, 7 + 30 * u, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ff4b3a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
  });
}
const PENT = []; Object.keys(PULSE).forEach(k => PULSE[k].forEach((_, j) => PENT.push([k, j])));
PENT.forEach(([k, j], n) => { const o = document.createElement('option'); o.value = n; o.textContent = (k.startsWith('mapAm') ? 'الأمريكتان' : 'أستراليا') + ' — ' + k.split('|')[1] + (PULSE[k].length > 1 ? ' (' + (j + 1) + ')' : ''); $('pSel').appendChild(o); });
function pDraw() {
  if (!PENT.length) return;
  const [k, j] = PENT[+$('pSel').value], im = props[k.split('|')[0]], c = $('pc'), g = c.getContext('2d');
  if (!im) { c.width = 420; c.height = 90; g.fillStyle = '#26313b'; g.fillRect(0, 0, 420, 90); g.fillStyle = '#ccc'; g.font = '16px system-ui'; g.textAlign = 'center'; g.fillText('ارفع صورة هذه الخريطة أولًا (قسم البطاقات)', 210, 52); return; }
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; c.width = 420; c.height = Math.round(ih * 420 / iw);
  g.drawImage(im, 0, 0, c.width, c.height);
  pts(k).forEach((q, n) => { g.fillStyle = n === j ? '#ff4b3a' : '#ffb3a8'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(q[0] * c.width, q[1] * c.height, 7, 0, 7); g.fill(); g.stroke(); });
}
window.pDraw = pDraw; $('pSel').onchange = pDraw;
$('pc').onpointerdown = e => {
  if (!PENT.length) return; const [k, j] = PENT[+$('pSel').value]; if (!props[k.split('|')[0]]) return; const r = $('pc').getBoundingClientRect();
  const arr = pts(k).map(a => a.slice()); arr[j] = [+((e.clientX - r.left) / r.width).toFixed(3), +((e.clientY - r.top) / r.height).toFixed(3)]; PO[k] = arr;
  try { Store.setItem(PK, JSON.stringify(PO)); } catch (_) {} pDraw();
};
$('pReset').onclick = () => { PO = {}; try { Store.removeItem(PK); } catch (_) {} pDraw(); };
pDraw();

// ===== مزاج المشهد: حزن (أخطار) يعتّم الإضاءة ويبطئ الموسيقى، ودهشة تضيء المشهد =====
let MOOD = 0;
function moodOv(m) {
  if (!m) return; const a = Math.abs(m); ctx.save();
  if (m < 0) {
    ctx.fillStyle = 'rgba(24,34,58,' + (.22 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * .5, H * .35, W / 2, H * .5, H * .95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (.45 * a).toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(W * .5, H * .2, 10, W * .5, H * .2, H * .9);
    g.addColorStop(0, 'rgba(255,236,190,' + (.22 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,245,220,' + (.05 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ===== حركة الخلفية: غبار وأوراق وثلج وجمر وطيور حسب نوع المشهد =====
const FXMAP = { 1: ['motes'], 3: ['snow'], 4: ['ember'], 5: ['motes', 'birds'], 6: ['motes', 'birds'], 7: ['leaves'], 8: ['ember'], 9: ['dust', 'leaves'], 10: ['motes', 'birds'], 11: ['motes'], 12: ['dust', 'birds'], 14: ['birds'], 15: ['snow'] };
const rn = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
function drawFx(s) {
  if (!$('cFx') || !$('cFx').checked) return; const list = FXMAP[s.map || s.bg || 1]; if (!list) return;
  ctx.save();
  for (const k of list) {
    if (k === 'motes') for (let i = 0; i < 28; i++) {
      const x = (rn(i, 1) * W + clock * (6 + rn(i, 2) * 10) + Math.sin(clock * .5 + i) * 18) % W, y = rn(i, 3) * H * .75 + Math.sin(clock * .35 + i * 1.7) * 22;
      ctx.fillStyle = 'rgba(255,248,200,' + (.22 + .3 * Math.pow(Math.sin(clock * 1.2 + i * 3), 2)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.2 + rn(i, 4) * 2.2, 0, 7); ctx.fill();
    }
    else if (k === 'dust') for (let i = 0; i < 30; i++) {
      const x = (rn(i, 1) * W + clock * (25 + rn(i, 2) * 30)) % W, y = H * .45 + rn(i, 3) * H * .45 + Math.sin(clock * .7 + i) * 10;
      ctx.fillStyle = 'rgba(235,205,150,.28)'; ctx.beginPath(); ctx.arc(x, y, 1 + rn(i, 4) * 2, 0, 7); ctx.fill();
    }
    else if (k === 'snow') for (let i = 0; i < 70; i++) {
      const y = (rn(i, 1) * H + clock * (28 + rn(i, 2) * 45)) % H, x = rn(i, 3) * W + Math.sin(clock * .7 + i) * 22;
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.arc(x, y, 1.3 + rn(i, 4) * 2.2, 0, 7); ctx.fill();
    }
    else if (k === 'leaves') for (let i = 0; i < 14; i++) {
      const y = (rn(i, 1) * (H + 80) + clock * (38 + rn(i, 2) * 40)) % (H + 80) - 40, x = rn(i, 3) * W + Math.sin(clock * .9 + i * 2) * 45;
      ctx.save(); ctx.translate(x, y); ctx.rotate(clock * (1 + rn(i, 5)) + i); ctx.fillStyle = ['#d9822b', '#b5541c', '#e0b13a'][i % 3]; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.6, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    else if (k === 'ember') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 36; i++) {
      const u = (clock * (.12 + rn(i, 2) * .1) + rn(i, 1)) % 1, y = H * .98 - u * H * .8 * (.6 + rn(i, 5) * .5), x = rn(i, 3) * W + Math.sin(clock * 2 + i) * 14 + u * 30;
      ctx.fillStyle = 'rgba(255,' + Math.round(120 + rn(i, 6) * 80) + ',40,' + ((1 - u) * .8).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, (1.3 + rn(i, 4) * 2) * (1 - u * .6), 0, 7); ctx.fill();
    } ctx.globalCompositeOperation = 'source-over'; }
    else if (k === 'birds') for (let i = 0; i < 3; i++) {
      const x = W + 100 - ((clock * (55 + i * 10) + i * 430) % (W + 200)), y = 135 + i * 50 + Math.sin(clock * .6 + i * 2) * 14, fl = Math.sin(clock * 8 + i * 2) * 5, sc = 1 - i * .2;
      ctx.strokeStyle = 'rgba(25,35,45,.7)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - 13 * sc, y - fl * sc); ctx.quadraticCurveTo(x - 5 * sc, y - (fl + 7) * sc, x, y); ctx.quadraticCurveTo(x + 5 * sc, y - (fl + 7) * sc, x + 13 * sc, y - fl * sc); ctx.stroke();
    }
  }
  ctx.restore();
}

// ===== فهرس المشاهد + تذكّر آخر مشهد =====
let MARK = -1, SAVEDIDX = -1; const LSK = 'cartoonLastScene1';
SHOTS.forEach((s, i) => { const r = document.createElement('div'); r.className = 'shot'; r.id = 'ix' + i; const t1 = document.createElement('span'); t1.textContent = (i + 1) + '. ' + s.h; const t2 = document.createElement('span'); t2.textContent = '▶'; r.append(t1, t2); r.onclick = () => jumpTo(i); $('idxList').appendChild(r); });
async function jumpTo(i) {
  if (rec) { msg('لا يمكن الانتقال أثناء تسجيل الفيديو'); return; }
  $('sStart').value = i; if (playing) { stopAll(); await sleep(200); }
  if (!playing) $('bPlay').onclick();
}
function idxTick() {
  if (idx !== MARK) { const o = $('ix' + MARK), n = $('ix' + idx); if (o) o.classList.remove('cur'); if (n) n.classList.add('cur'); MARK = idx; }
  if (playing && !EXPORTING && idx !== SAVEDIDX) { SAVEDIDX = idx; try { Store.setItem(LSK, idx); } catch (_) {} }
}
try { const sv = +Store.getItem(LSK); if (sv > 0 && sv < SHOTS.length) { $('sStart').value = sv; msg('تم تحديد آخر مشهد توقفت عنده: ' + (sv + 1) + '. اختر «ابدأ من» المشهد 1 للبدء من الأول'); } } catch (_) {}

// ===== مؤثرات صوتية: خطوات على العشب ونقرة عند ظهور البطاقة =====
const SFX = { lastStep: 0, lastC: -1, noise: null };
const sfxOn = () => playing && AC && AC.state === 'running' && $('cSfx') && $('cSfx').checked;
function sfxOut(g) { g.connect(AC.destination); if (DEST) g.connect(DEST); }
function stepSfx(v) {
  const a = AC, now = a.currentTime; if (now - SFX.lastStep < .22) return; SFX.lastStep = now;
  if (!SFX.noise) SFX.noise = nbuf(a, false);
  const layer = (type, f, q, peak, dec) => {
    const src = a.createBufferSource(); src.buffer = SFX.noise; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f * (.9 + Math.random() * .2); if (q) fl.Q.value = q;
    const g = a.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(peak * v, now + .008); g.gain.exponentialRampToValueAtTime(.0008, now + dec);
    src.connect(fl); fl.connect(g); sfxOut(g); src.start(now, Math.random() * 2, dec + .05);
  };
  const T = gOn() ? GT() : 'grass', CB = typeof CUR_BG !== 'undefined' ? CUR_BG : 0;   // صوت الخطوة يتبع نوع الأرض
  if (T === 'gloss') { if (CB === 14) { layer('lowpass', 380, 0, .2, .09); layer('bandpass', 1500, 3, .07, .05); } else { layer('bandpass', 1100, 2.5, .16, .06); layer('lowpass', 300, 0, .10, .08); } }
  else if (T === 'dust') { layer('lowpass', 380, 0, .14, .10); layer('highpass', 2600, 0, .05, .12); }
  else if (T === 'snow') { layer('lowpass', 700, 0, .10, .10); layer('bandpass', 3800, 1.2, .06, .14); }
  else if (T === 'pebble') { layer('bandpass', 2200, 3, .10, .05); layer('bandpass', 3400, 3, .07, .04); layer('lowpass', 400, 0, .10, .08); }
  else if (T === 'wet') { layer('lowpass', 500, 0, .12, .12); layer('bandpass', 1800, .7, .09, .22); }
  else if (T === 'water') { layer('lowpass', 260, 0, .12, .18); }
  else { layer('lowpass', 430, 0, .20, .12); layer('bandpass', 2300, .8, .05, .09); }   // عشب: وقع القدم + خشخشة
}
function popSfx() {
  const a = AC, now = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(900, now + .08);
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.07, now + .01); g.gain.exponentialRampToValueAtTime(.001, now + .22);
  o.connect(g); sfxOut(g); o.start(now); o.stop(now + .25);
}
function stepTick(c, v) { if (!sfxOn()) return; if (c !== SFX.lastC) { SFX.lastC = c; stepSfx(Math.min(1, v)); } }

// ===== إبقاء الشاشة مضاءة أثناء التشغيل/التسجيل =====
let WL = null;
async function wlOn() { try { if (navigator.wakeLock && !WL) { WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', () => { WL = null; }); } } catch (_) {} }
function wlOff() { try { WL && WL.release(); } catch (_) {} WL = null; }
$('cRec').addEventListener('change', () => { if ($('cRec').checked) msg('أثناء التسجيل أبقِ الشاشة مضاءة وابقَ في هذه الصفحة حتى ينتهي الفيلم'); });

// ===== كاميرا سينمائية: تقريب بطيء/انزلاق جانبي حسب نوع المشهد + لقطة قريبة (قصّ زاوية) عند الشرح =====
// كل حركة تبدأ من الوضع الطبيعي (تقريب 1) فتتطابق مع الانتقال المتقاطع بين المشاهد دون قفزة
function camFor(s, tt, idxS) {
  if (!$('cCam') || !$('cCam').checked || greenOn()) return null;
  const u = Math.max(0, Math.min(1, tt / s.dur)), e = ease(u), type = idxS % 4, bk = s.map || s.bg || 1;
  let z = 1, dx = 0;
  if (type === 0) z = 1 + .07 * e;                                   // تقريب بطيء نحو الشخصية
  else if (type === 1) { z = 1 + .05 * ease(Math.min(1, u * 5)); dx = (e - .5) * .05 * W; }   // انزلاق جانبي لليمين
  else if (type === 2) { z = 1 + .06 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ; }          // تقريب ثم ارتداد خفيف
  else { z = 1 + .05 * ease(Math.min(1, u * 5)); dx = (.5 - e) * .05 * W; }                  // انزلاق جانبي لليسار
  // لقطة قريبة وسط الشرح: زاوية ثانية على نفس المشهد (حوالي ربع المدة) بانتقال سريع وسلس
  const main = s.dur - s.inT - s.outT;
  if (!s.noWalk && main > 9) {
    const a = s.inT + main * .42, len = Math.min(6, main * .22), ra = .45;
    const k = ease((tt - a) / ra) * (1 - ease((tt - (a + len)) / ra)); z *= 1 + .16 * k;
  }
  const X = W * (GRX[bk] && +$('rX').value === 0.2 ? GRX[bk] : (+($('rX') ? $('rX').value : s.x) || s.x || .5)), Y = (GRG[bk] || 625) - H * .34;
  z *= 1.008 + .004 * Math.sin(tt * .5); dx += 3 * Math.sin(tt * .37);   // انجراف يدوي خفيف للكاميرا
  const dmax = X * (z - 1), dmin = -(W - X) * (z - 1);   // لا يظهر طرف فارغ أبدًا
  dx = Math.max(dmin, Math.min(dmax, dx));
  return { z, dx, X, Y };
}
function camBegin(c) { if (!c) return; ctx.save(); ctx.translate(c.X + c.dx, c.Y); ctx.scale(c.z, c.z); ctx.translate(-c.X, -c.Y); }
function camEnd(c) { if (c) ctx.restore(); }

// ===== تصحيح ألوان موحّد + تدرّج زوايا + حبيبات فيلم خفيفة (يوحّد مظهر كل المشاهد) =====
let GRD = null;
function gradeInit() {
  const v = document.createElement('canvas'); v.width = W; v.height = H; const g = v.getContext('2d');
  const r = g.createRadialGradient(W / 2, H * .48, H * .38, W / 2, H * .5, Math.hypot(W, H) * .56); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(150,140,135,1)');
  g.fillStyle = r; g.fillRect(0, 0, W, H);
  const n = document.createElement('canvas'); n.width = n.height = 192; const q = n.getContext('2d'), d = q.createImageData(192, 192);
  for (let i = 0; i < d.data.length; i += 4) { const x = 128 + (Math.random() - .5) * 150; d.data[i] = d.data[i + 1] = d.data[i + 2] = x; d.data[i + 3] = 255; }
  q.putImageData(d, 0, 0);
  GRD = { vig: v, grain: [n, ctx.createPattern(n, 'repeat')] };
}
function gradeFx() {
  if (!$('cGrade') || !$('cGrade').checked || greenOn()) return; if (!GRD) gradeInit();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .18; ctx.drawImage(cv, 0, 0);          // تباين سينمائي ناعم (منحنى S)
  ctx.globalAlpha = .08; ctx.fillStyle = 'rgb(255,200,150)'; ctx.fillRect(0, 0, W, H);                  // دفء الإضاءات العام
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .32; ctx.drawImage(GRD.vig, 0, 0);       // تعتيم الزوايا
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07; ctx.translate(Math.floor(Math.random() * 192), Math.floor(Math.random() * 192)); ctx.fillStyle = GRD.grain[1]; ctx.fillRect(-192, -192, W + 192, H + 192);
  ctx.restore();
}

function oldFilm() {   // وميض خفيف وخدوش عمودية وغبار عشوائي، يتغير كل إطار
  if (!$('cOld') || !$('cOld').checked || greenOn()) return;
  ctx.save(); ctx.globalAlpha = .02 + Math.random() * .03; ctx.fillStyle = Math.random() < .5 ? '#fff' : '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  if (Math.random() < .3) { const x = Math.random() * W; ctx.strokeStyle = 'rgba(255,255,255,' + (.1 + Math.random() * .12).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - .5) * 6, H); ctx.stroke(); }
  const n = Math.random() < .5 ? 1 + (Math.random() * 3 | 0) : 0;
  for (let i = 0; i < n; i++) { ctx.fillStyle = 'rgba(' + (Math.random() < .6 ? '20,15,10' : '240,235,220') + ',' + (.25 + Math.random() * .3).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, .8 + Math.random() * 2.2, 0, 7); ctx.fill(); }
  ctx.restore();
}
function tickSim(dt) {
  clock += dt;
  const s = SHOTS[idx];
  if (playing && !QWAIT) {
    const T1 = s.dur - s.outT - (s.extra || 0);
    if (s.speaking && !s.done && t >= T1) { s.hold = (s.hold || 0) + dt; if (s.hold > 20) s.done = true; } else t += dt;
    if (s.speaking && s.done && t < T1) t = T1;
    if (spoken && AC && AC.state === 'running' && s._a0 != null && AC.currentTime < audioUntil && AB(s)) {   // تتبّع ساعة الصوت: إن تباطأ الرسم تقفز الصورة لتلحق بالصوت بدل أن يتأخر عنه
      const ta = s.inT + (AC.currentTime - s._a0); if (Math.abs(ta - t) > .08) t = Math.max(0, ta);
    }
    if (!spoken && t >= s.inT) { spoken = true; speak(s); }
    if (s.q && !s._qd && !EXPORTING && !rec && t >= T1 && (!s.speaking || s.done)) { s._qd = true; showQ(s); }   // لحظة قرار: يتوقف الفيلم ويظهر السؤال
    if (t >= s.dur) { s.speaking = false; s.done = false; idx++; t = 0; spoken = false; if (idx >= SHOTS.length) { idx = 0; if (EXPORTING) EXP_END = true; else stopAll(); } }
  }
  const sh = SHOTS[idx];
  MOOD += (($('cMood').checked ? (sh.mood || 0) : 0) - MOOD) * Math.min(1, dt * .8);
  updateMouth(dt, sh); ambTick(sh);
  LASTSH = null; idxTick(); WALKSH = $('cPar') && $('cPar').checked && LIFE() ? -.035 * walkOffset(sh, t) : 0; const cam = camFor(sh, t, idx); camBegin(cam); drawBg(sh, t); drawFx(sh); drawChar(sh, t); drawFg(sh, t); drawProps(sh, t); drawMulti(sh, t); camEnd(cam); drawChip(sh); drawCards(sh, t); drawCaption(sh, t);
  // انتقال ناعم: الخلفية التالية تظهر تدريجيًا فوق المشهد الحالي (تلاشٍ متقاطع). الأسود فقط في أول الفيلم وآخره
  const isLast = idx === SHOTS.length - 1, X = Math.min(.9, sh.outT);
  if (!isLast && t > sh.dur - X) drawBg(SHOTS[idx + 1], 0, ease((t - (sh.dur - X)) / X));
  gradeFx();
  { let vm = sh.mood || 0; if (!isLast && t > sh.dur - X) vm = vm * (1 - ease((t - (sh.dur - X)) / X)) + (SHOTS[idx + 1].mood || 0) * ease((t - (sh.dur - X)) / X); if ($('cMood').checked) moodOv(vm); }
  if ($('cIris') && $('cIris').checked && !greenOn()) {   // فتح وإغلاق دائري كأفلام الكرتون الكلاسيكية
    const IR = 1.2; let kk = 1; if (idx === 0 && t < IR) kk = ease(t / IR); else if (isLast && t > sh.dur - IR) kk = 1 - ease((t - (sh.dur - IR)) / IR);
    if (kk < .999) { ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W * .5, H * .52, Math.max(.1, kk * Math.hypot(W, H) * .55), 0, 7); ctx.fill('evenodd'); ctx.restore(); }
  }
  oldFilm();
  const a = ($('cIris') && $('cIris').checked) ? 0 : idx === 0 && t < .7 ? 1 - t / .7 : isLast && t > sh.dur - .7 ? (t - (sh.dur - .7)) / .7 : 0;
  if (a > 0) { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, W, H); }
  let el = 0; for (let i = 0; i < idx; i++) el += SHOTS[i].dur; el += t;
  $('prog').style.width = (el / TOTAL * 100) + '%';
  $('info').textContent = 'المشهد ' + (idx + 1) + ' من ' + SHOTS.length + ' — ' + '\u2066' + fmt(el) + ' / ' + fmt(TOTAL) + '\u2069';
}
// عند عدم التشغيل لا حاجة لإعادة الرسم 60 مرة في الثانية: نرسم بسرعة (~20/ث) لثانية ونصف بعد أي لمس أو تغيير، ثم بمعدل بطيء (~2/ث)
let IDLE_LAST = 0, IDLE_BOOST = 0;
['input', 'change', 'pointerdown', 'pointerup', 'keydown', 'resize'].forEach(e => addEventListener(e, () => { IDLE_BOOST = performance.now() + 1500; }, true));
function loop(now) {
  requestAnimationFrame(loop);   // أولًا: لو رمى tickSim استثناءً تبقى حلقة الرسم حيّة بدل أن تموت للأبد
  if (!playing && !EXPORTING && !QWAIT && !PERF.full && now - IDLE_LAST < (now < IDLE_BOOST ? 45 : 450)) return;
  IDLE_LAST = now;
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!EXPORTING) {
    const pm = PERF.on && PERF.add ? performance.now() : 0;
    tickSim(dt);
    if (pm) PERF.add(performance.now() - pm, dt);
  }
}
requestAnimationFrame(loop);
