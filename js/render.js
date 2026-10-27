function chunks(s) {
  if (s._ch) return s._ch;
  const parts = s.text.match(/[^.؟!،]+[.؟!،]?/g) || [s.text], out = []; let cur = '';
  for (const p of parts) { cur += (cur ? ' ' : '') + p.trim(); if (cur.length >= 60) { out.push(cur); cur = ''; } }
  if (cur) { if (out.length && cur.length < 25) out[out.length - 1] += ' ' + cur; else out.push(cur); }
  return (s._ch = out);
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}

let EXPORTING = false, EXP_END = false;
let idx = 0, t = 0, playing = false, last = performance.now(), clock = 0, spoken = false, rec = null, chunksRec = [], recExt = 'mp4', recMime = 'video/mp4';
let LASTSH = null, FGC = null, GROUND = H - 130, GSC = .94, CUR_BG = 1, CUR_AMB = null;   // الأرض والمنظور واللون المحيط تتبع كل مشهد
const LIGHT = { 5: -.8, 9: .4, 12: .9, 14: .3, 15: .5, 1: .6 };        // اتجاه الضوء: موجب = الظل نحو اليمين
const BGAMB = {}, GRG = { 5: 648, 8: 655, 10: 640, 14: 640 }, GRS = { 5: .97, 8: 1.03 }, GRX = { 5: .15 };   // أرض ثابتة (صخرة/أرض أمامية) ومنظور لكل خلفية
function ambOf(k) {
  if (BGAMB[k]) return BGAMB[k]; const im = bgs[k - 1]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = 32; c.height = 18; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 32, 18);
  let r = 0, gg = 0, b = 0, n = 0; try { const d = g.getImageData(0, 11, 32, 7).data; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } } catch (_) { return null; }
  r = Math.round(r / n); gg = Math.round(gg / n); b = Math.round(b / n); const lum = .3 * r + .59 * gg + .11 * b;
  let sr = 0, sg = 0, sb = 0, sn = 0; try { const d = g.getImageData(0, 0, 32, 6).data; for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sn++; } } catch (_) {}
  const sky = sn ? { r: Math.round(sr / sn), g: Math.round(sg / sn), b: Math.round(sb / sn) } : { r, g: gg, b };
  return (BGAMB[k] = { r, g: gg, b, a: .17, dim: lum < 120 ? (120 - lum) / 120 * .2 : 0, sky });
}
// نسخة الشخصية بإضاءة المشهد: لون محيط + ظل تلامس تدريجي نحو القدمين (تُحفظ للمشهد الحالي فقط)
function tinted(f) {
  const A = CUR_AMB; if (!A) return f; if (f._tk === CUR_BG && f._tc) return f._tc;
  const c = f._tc && f._tc.width === f.width && f._tc.height === f.height ? f._tc : document.createElement('canvas'); c.width = f.width; c.height = f.height;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(f, 0, 0); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(' + A.r + ',' + A.g + ',' + A.b + ',' + A.a + ')'; g.fillRect(0, 0, c.width, c.height);
  const y1 = f.bb.y1, y0 = f.bb.y0, Hh = y1 - y0, gr = g.createLinearGradient(0, y0 + Hh * .55, 0, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.24)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  if (A.dim > 0) { g.fillStyle = 'rgba(0,0,0,' + A.dim.toFixed(3) + ')'; g.fillRect(0, 0, c.width, c.height); }
  // واقعية الإضاءة: (أ) لون السماء على النصف العلوي، (ب) ضوء جانبي حسب اتجاه ضوء المشهد (جهة مضيئة وجهة مظلمة)، (ج) رفع الأسود الصافي إلى لون الخلفية كما في صورة فوتوغرافية حقيقية
  {
    g.globalCompositeOperation = 'source-atop';
    const Sk = A.sky || A, sg2 = g.createLinearGradient(0, y0, 0, y0 + Hh * .6); sg2.addColorStop(0, 'rgba(' + Sk.r + ',' + Sk.g + ',' + Sk.b + ',.12)'); sg2.addColorStop(1, 'rgba(' + Sk.r + ',' + Sk.g + ',' + Sk.b + ',0)'); g.fillStyle = sg2; g.fillRect(0, 0, c.width, c.height);
    const L = Math.max(-1, Math.min(1, LIGHT[CUR_BG] != null ? LIGHT[CUR_BG] : .5)), x0 = f.bb.x0, x1 = f.bb.x1, lg = g.createLinearGradient(x0, 0, x1, 0), k = Math.abs(L) * .22 + .05;
    const lit = 'rgba(255,238,205,' + (k * .55).toFixed(3) + ')', shd = 'rgba(0,0,0,' + (k * 1.1).toFixed(3) + ')';
    lg.addColorStop(0, L >= 0 ? lit : shd); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, L >= 0 ? shd : lit); g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'lighten'; g.fillStyle = 'rgb(' + Math.round(A.r * .16) + ',' + Math.round(A.g * .16) + ',' + Math.round(A.b * .16) + ')'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(f, 0, 0); g.globalCompositeOperation = 'source-over';
  }
  f._tc = c; f._tk = CUR_BG; return c;
}
// ===== حافة ضوء (rim light) على جهة الشمس + لون الأرض للظل =====
function rimOf(f) {
  const A = CUR_AMB, L = Math.max(-1, Math.min(1, LIGHT[CUR_BG] != null ? LIGHT[CUR_BG] : .5)), dim = A ? A.dim : 0, key = CUR_BG + '|' + Math.round(L * 10) + '|' + Math.round(dim * 20);
  if (f._rim && f._rim.key === key) return f._rim.c;
  const k = Math.min(.7, (.28 + .42 * Math.abs(L)) * (1 - dim * 1.4)); if (k < .04) return null;
  const c = f._rim ? f._rim.c : document.createElement('canvas'); c.width = f.width; c.height = f.height; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(f, 0, 0);
  const d = Math.max(2, f.height * .0042); if ('filter' in g) g.filter = 'blur(' + (d * .35).toFixed(1) + 'px)';
  g.globalCompositeOperation = 'destination-out'; g.drawImage(f, (L >= 0 ? 1 : -1) * d, d * .55); g.filter = 'none';   // يبقى هلال رفيع على الحافة المواجهة للضوء
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(255,236,200,' + k.toFixed(3) + ')'; g.fillRect(0, 0, c.width, c.height);
  if (A) {   // التفاف الضوء: لون الخلفية/السماء يلفّ الحافة البعيدة عن الشمس بلمسة خفيفة
    const Sk = A.sky || A, w = document.createElement('canvas'); w.width = f.width; w.height = f.height; const q = w.getContext('2d'); q.drawImage(f, 0, 0);
    const d2 = Math.max(3, f.height * .0075); if ('filter' in q) q.filter = 'blur(' + (d2 * .5).toFixed(1) + 'px)';
    q.globalCompositeOperation = 'destination-out'; q.drawImage(f, (L >= 0 ? -1 : 1) * d2, 0); q.filter = 'none';
    q.globalCompositeOperation = 'source-in'; q.fillStyle = 'rgba(' + Math.round((A.r + Sk.r) / 2) + ',' + Math.round((A.g + Sk.g) / 2) + ',' + Math.round((A.b + Sk.b) / 2) + ',.5)'; q.fillRect(0, 0, w.width, w.height);
    g.globalCompositeOperation = 'source-over'; g.drawImage(w, 0, 0);
  }
  f._rim = { key, c }; return c;
}
function groundCol() {
  const im = bgs[CUR_BG - 1]; if (!im) return [0, 0, 0]; if (im._gc && im._gg === GROUND) return im._gc;
  try { const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), gy = Math.max(0, Math.min(im.naturalHeight - 14, ((GROUND - (H - im.naturalHeight * k) / 2) / k) | 0)); const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(im, 0, gy, im.naturalWidth, 14, 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; im._gg = GROUND; return (im._gc = [d[0], d[1], d[2]]); } catch (_) { return [0, 0, 0]; }
}
function silh(f) {
  if (f._sl) return f._sl; const c = document.createElement('canvas'); c.width = f.width; c.height = f.height; const g = c.getContext('2d'); g.drawImage(f, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); return (f._sl = c);
}
function tintSk(sk) { const A = CUR_AMB; if (!A) return sk; const m = 1 - A.dim, a = A.a; return { r: Math.round((sk.r * (1 - a) + A.r * a) * m), g: Math.round((sk.g * (1 - a) + A.g * a) * m), b: Math.round((sk.b * (1 - a) + A.b * a) * m), sig: sk.sig }; }

// حركة كاميرا بطيئة تختلف من مشهد لآخر: تقريب، ثم تحريك لليمين، ثم ابتعاد، ثم تحريك لليسار
function camRect(s, tt, im) {
  const u = ease(tt / s.dur), c = (s.cam || 0) % 4;
  const z = c === 0 ? 1 + .06 * u : c === 2 ? 1.06 - .06 * u : 1.10;
  const k = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z * ($('cPar') && $('cPar').checked ? 1.09 : 1),   // هامش إضافي حتى لا يظهر طرف فارغ عند إزاحة الطبقات
    w = im.naturalWidth * k, h = im.naturalHeight * k;
  const pan = c === 1 ? (2 * u - 1) : c === 3 ? (1 - 2 * u) : 0;
  return { x: (W - w) / 2 + pan * (w - W) / 2 * .9, y: (H - h) / 2, w, h };
}
const greenOn = () => !rec && !EXPORTING && $('cGreen') && $('cGreen').checked;
function drawBg(s, tt, alpha) {
  if (greenOn()) { ctx.fillStyle = '#00b140'; ctx.fillRect(0, 0, W, H); return; }
  const im = bgs[(s.map || 1) - 1];
  if (!im) { ctx.fillStyle = '#35505a'; ctx.fillRect(0, 0, W, H); return; }
  const r = camRect(s, tt, im);
  if (alpha != null) ctx.globalAlpha = alpha;
  const img = dofImg(im, s), P = parShift(s, tt);
  if (P == null) ctx.drawImage(img, r.x, r.y, r.w, r.h);
  else {   // منظور: شرائح أفقية تُزاح بمقدار يتدرّج مع العمق؛ مستوى الشخصية ثابت، والبعيد يتحرك عكس القريب
    const sw = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth, sh = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight, yG = GRG[s.map || s.bg || 1] || 625, k = sh / r.h, ST = 8;
    for (let y = 0; y < H; y += ST) { const sy0 = (y - r.y) * k, shh = Math.min(sh - sy0, (ST + 1) * k); if (shh <= 0) continue; ctx.drawImage(img, 0, sy0, sw, shh, Math.min(0, Math.max(W - r.w, r.x + shiftAt(P, y + ST / 2, yG))), y, r.w, shh / k);   // الإزاحة لا تتجاوز حافة الصورة أبدًا فلا يظهر طرف فارغ
 }
  }
  ctx.globalAlpha = 1;
}
function parShift(s, tt) {
  if (!$('cPar') || !$('cPar').checked || greenOn()) return null;
  const u = Math.max(0, Math.min(1, tt / s.dur)); if (s._pi == null) s._pi = SHOTS.indexOf(s);
  return (ease(u) - .5) * .05 * W * (s._pi % 2 ? -1 : 1);
}
let WALKSH = 0;   // إزاحة إضافية للخلفية أثناء مشي الشخصية: القريب يتحرك أكثر من البعيد
const shiftAt = (P, y, yG) => P * Math.max(-1, Math.min(.6, (y - yG) / (H * .55))) + WALKSH * (.12 + .88 * Math.pow(Math.max(0, Math.min(1, y / H)), 1.5));
function walkOffset(s, tt) {   // بُعد الشخصية الأفقي عن موضع وقوفها (سالب = تدخل، موجب = تخرج)
  if (s.noWalk || !(frames.walk || (s.run && frames.run))) return 0; const k = s.map || s.bg || 1, X = W * (GRX[k] && +$('rX').value === 0.2 ? GRX[k] : (+($('rX') ? $('rX').value : s.x) || s.x)), x0 = W * -0.15, x1 = W * 1.15, mainEnd = s.dur - s.outT;
  if (tt < s.inT) return (x0 + (X - x0) * (1 - Math.pow(1 - tt / s.inT, 1.6))) - X;
  if (tt > mainEnd && !((s.out === 'away' || s.out === 'turnaway') && frames.back)) return (X + (x1 - X) * Math.pow((tt - mainEnd) / s.outT, 1.6)) - X;
  return 0;
}
// ===== عمق ميداني: تُخبَز نسخة واحدة لكل خلفية (إضابة بعيدة + حدّة قرب الأرض) فلا كلفة في كل إطار =====
function dofImg(im, s) {
  const on = $('cDof') && $('cDof').checked; if (!on || !('filter' in ctx)) return im;
  const ks = +($('rDof') ? $('rDof').value : 1) || 1; if (im._dof && im._dofk === ks) return im._dof;
  try {
    const k = Math.min(1, 1600 / im.naturalWidth), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.filter = 'blur(' + (ks * w / 1400).toFixed(2) + 'px)'; g.drawImage(im, -4, -4, w + 8, h + 8); g.filter = 'none';   // حواف ممتدة لتجنّب هالة الحافة
    const b = document.createElement('canvas'); b.width = w; b.height = h; const q = b.getContext('2d'); q.drawImage(im, 0, 0, w, h);
    const bk = (s.map || s.bg || 1), gy = (GRG[bk] || 625) / H;           // موضع الأرض تقريبًا كنسبة من الارتفاع
    const gr = q.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(Math.max(.2, gy - .22), 'rgba(0,0,0,0)'); gr.addColorStop(Math.min(.95, gy - .02), 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    q.globalCompositeOperation = 'destination-in'; q.fillStyle = gr; q.fillRect(0, 0, w, h);
    g.drawImage(b, 0, 0); c.naturalWidth = im.naturalWidth; c.naturalHeight = im.naturalHeight;
    im._dof = c; im._dofk = ks; return c;
  } catch (_) { return im; }
}
// ===================== التحريك الاحترافي =====================
const CEL = () => !$('cCel') || $('cCel').checked, TWOS = () => $('cTwos') && $('cTwos').checked;
const LIFE = () => !$('cLife') || $('cLife').checked, ANT = .12;
let ARR = 99;   // الزمن منذ وصول الشخصية إلى وضع الوقوف (لتجاوز واستقرار الوصول)
const ARRT = { point: .3, think: .5, sad: .7, awe: .5, wave: .85, joy: .5, pointup: .6, turn: 1.4 };
const settleF = t => t > 0 ? Math.exp(-6 * t) * Math.sin(17 * t) : 0;   // نابض مخمَّد: يتجاوز ثم يهدأ
const UI = { size: () => +$('rSize').value || 1, mouth: () => +$('rMouth').value || 1 };
const ease = u => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
const STRIDE = 22, XF = 0.45; const isPP = n => SH.walk.pp && n >= 3 && n < 6;   // 3–5 إطارات: ذهاب وإياب؛ 6 فأكثر: دورة مشي كاملة تتكرر (ساق يمين ثم يسار)
function strideNow() { const n = frames.walk ? frames.walk.length : 9; return isPP(n) ? 352 / (2 * n - 2) : STRIDE; }
function blit(name, i, x, scl, dy, alpha, o) {
  const fr = frames[name], cfg = SH[name]; if (!fr || alpha <= 0.002) return; o = o || {}; const FL = o.flip != null ? o.flip : (typeof FLIP !== 'undefined' && FLIP);
  const f = fr[((i % fr.length) + fr.length) % fr.length], sc = cfg.th * 0.96 / fr.ch * UI.size() * scl * GSC;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x + (o.dx || 0), GROUND + dy + (o.dy || 0));                      // نقطة الارتكاز عند القدمين
  if (o.rot) ctx.rotate(o.rot); if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
  { // ظل ساقط واقعي على الأرض من شكل الشخصية نفسه
    const L = LIGHT[CUR_BG] != null ? LIGHT[CUR_BG] : .55; ctx.save(); ctx.globalAlpha = Math.min(1, alpha) * .40; ctx.transform(1, 0, -L * .5, -.11, 0, 0); if (FL) ctx.scale(-1, 1); if ('filter' in ctx) ctx.filter = 'blur(' + Math.max(2, 5 * sc).toFixed(1) + 'px)';
    ctx.drawImage(silh(f), -f.ax * sc, -f.bb.y1 * sc, f.width * sc, f.height * sc); ctx.restore(); }
  if (f.lift) ctx.translate(0, -f.lift * sc); if (FL) ctx.scale(-1, 1);   // إطار في الهواء (جري/قفز): الظل يبقى على الأرض والجسم يرتفع
  ctx.drawImage(CEL() && !greenOn() ? inked(f) : tinted(f), -f.ax * sc, -f.bb.y1 * sc, f.width * sc, f.height * sc);
  if ($('cRim') && $('cRim').checked && !greenOn()) { const rm = rimOf(f); if (rm) ctx.drawImage(rm, -f.ax * sc, -f.bb.y1 * sc, f.width * sc, f.height * sc); }
  if (o.mouth && f.mouth && f.mouth.on && !cfg.nm && $('cMouth').checked) paintMouth(ctx, f, sc, (f.mouth.x - f.ax) * sc, (f.mouth.y - f.bb.y1) * sc, M, o.mouth * alpha);
  ctx.restore(); ctx.globalAlpha = 1;
}
// خط الحبر يُخبز مرة واحدة لكل وضعية ولكل خلفية (بدل رسمه 4 مرات في كل إطار)
function inked(f) {
  const T = tinted(f); if (f._ik && f._ik.t === T && f._ik.bg === CUR_BG) return f._ik.c;
  const od = Math.max(2, f.height * .0032), c = f._ik && f._ik.c.width === f.width && f._ik.c.height === f.height ? f._ik.c : document.createElement('canvas'); c.width = f.width; c.height = f.height;
  const g = c.getContext('2d'), sl = silh(f); g.clearRect(0, 0, c.width, c.height); g.globalAlpha = .5;
  for (const [ox, oy] of [[od, 0], [-od, 0], [0, od], [0, -od]]) g.drawImage(sl, ox, oy);
  g.globalAlpha = 1; g.drawImage(T, 0, 0); f._ik = { t: T, bg: CUR_BG, c }; return c;
}
function shadow(x, w, a) {
  a = a == null ? 1 : a; LASTSH = [x, w, a]; ctx.save(); ctx.globalAlpha = .62 * a; ctx.translate(x, GROUND + 3); ctx.scale(1, .13);
  const cr = $('cRim') && $('cRim').checked ? groundCol().map(v => Math.round(v * .2)) : [0, 0, 0], cs = cr[0] + ',' + cr[1] + ',' + cr[2];   // ظل بلون الأرض المعتّم لا أسود صرف
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.15); g.addColorStop(0, 'rgba(' + cs + ',.75)'); g.addColorStop(.6, 'rgba(' + cs + ',.35)'); g.addColorStop(1, 'rgba(' + cs + ',0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 1.15, 0, 7); ctx.fill();
  if (cs !== '0,0,0' || ($('cRim') && $('cRim').checked)) { const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, w * .5); g2.addColorStop(0, 'rgba(' + cs + ',.9)'); g2.addColorStop(.55, 'rgba(' + cs + ',.45)'); g2.addColorStop(1, 'rgba(' + cs + ',0)'); ctx.scale(1, .6); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, w * .5, 0, 7); ctx.fill(); }   // ظل التصاق ضيّق وداكن تحت القدمين
  ctx.restore();
}
const RSTR = 36, ROUT = 80;   // الجري: كل إطار يقطع 36 بكسل عند الدخول (ينتهي على إطار الملامسة 0)
function runAt(x, steps, A, scl) {
  const n = frames.run.length; scl = scl || 1; const pos = ((Math.floor(steps) % n) + n) % n, lf = (SH.run.lift || [])[pos] ? 1 : 0;
  stepTick(Math.floor(steps / 1.5), A * scl);
  shadow(x, 100 * scl * (1 - .2 * lf), A * (1 - .35 * lf));
  blit('run', pos, x, scl, 0, A, { rot: 0 });
  if (!lf && $('cSym') && $('cSym').checked && !greenOn()) {   // غبار خفيف عند ملامسة القدم
    const gc = groundCol(), age = (((steps % 1) + 1) % 1);
    ctx.save(); ctx.fillStyle = 'rgba(' + Math.min(255, gc[0] + 60) + ',' + Math.min(255, gc[1] + 55) + ',' + Math.min(255, gc[2] + 50) + ',' + (.4 * (1 - age) * A).toFixed(3) + ')';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - (40 + k * 18 + age * 30) * scl, GROUND - (4 + k * 3 + age * 14) * scl, (5 + k * 3 + age * 12) * scl, 0, 7); ctx.fill(); }
    ctx.restore();
  }
}
function pickSheet(mode) {
  const order = { talk: ['talk', 'wave'], wave: ['wave', 'talk'], point: ['point', 'talk', 'wave'], think: ['think', 'talk', 'wave'], sad: ['sad', 'talk', 'wave'], awe: ['awe', 'talk', 'wave'], sit: ['sit', 'talk', 'wave'], joy: ['joy', 'awe', 'talk', 'wave'], pointup: ['pointup', 'point', 'talk', 'wave'], turn: ['turn', 'talk', 'wave'] }[mode] || ['talk', 'wave'];
  for (const n of order) if (frames[n]) return n;
  return frames.walk ? 'walk' : null;
}
// المشي: الإيقاع مرتبط بالمسافة المقطوعة (لا ينزلق القدم) + ارتفاع طفيف + ميلان
// مع دورة مشي كاملة: تنتهي الخطوة الأخيرة عند الوصول على وضع «القدمان متجاورتان» (وتبدأ خطوة الخروج منه)، فيكون الانتقال إلى الوقوف سلسًا
function walkPh(d, enter) { const n = frames.walk ? frames.walk.length : 0; if (isPP(n) || n < 6) return 0; const tgt = Math.round(n * .25), L = n; return enter ? ((tgt - d / strideNow()) % L + L) % L : Math.round(n * .625); }
function walkIdx(steps) { const n = frames.walk.length; if (!isPP(n)) return Math.floor(steps); const L = 2 * n - 2, i = ((Math.floor(steps) % L) + L) % L; return i < n ? i : L - i; }
function walkPos(steps) { const n = frames.walk.length, L = 2 * n - 2, p = ((steps % L) + L) % L; return p <= n - 1 ? p : L - p; }
function walkAt(x, steps, A, scl, dy0) {
  const n = frames.walk.length; scl = scl || 1; const pp = isPP(n), L = pp ? 2 * n - 2 : n, cyc = (((steps % L) + L) % L) / L;
  const pos = pp ? walkPos(steps) : ((steps % n) + n) % n, i0 = Math.floor(pos), i1 = pp ? Math.min(n - 1, i0 + 1) : (i0 + 1) % n, ue = ease(pos - i0);
  const bob = (pp ? -Math.sin(Math.min(1, pos / (n - 1)) * Math.PI) : -Math.abs(Math.sin(cyc * Math.PI * 2))) * 2.5 * scl, dy = bob + (dy0 || 0);
  stepTick(Math.floor(steps / (n - 1)), A * scl);
  { const air0 = pp ? Math.sin(Math.min(1, pos / (n - 1)) * Math.PI) : Math.abs(Math.sin(cyc * Math.PI * 2)), L0 = LIFE();   // الظل يصغر ويخفّ عند ارتفاع الجسم ويتسع ويغمق عند هبوط القدم
    shadow(x - (L0 ? air0 * 5 * scl : 0), 100 * scl * (L0 ? 1 - .16 * air0 : 1), A * (L0 ? 1 - .25 * air0 : 1)); }
  const o = { rot: 0.012 + Math.sin(cyc * Math.PI * 2) * 0.005, dx: Math.sin(cyc * Math.PI * 4) * 2 * scl };
  if (LIFE()) {   // الضغط والتمدد: ضغط خفيف عند هبوط القدم وتمدد خفيف في أعلى الخطوة (الحجم محفوظ تقريبًا)
    const air = pp ? Math.sin(Math.min(1, pos / (n - 1)) * Math.PI) : Math.abs(Math.sin(cyc * Math.PI * 2)), sq = Math.pow(1 - air, 3) * .022, st = air * .007;
    o.sy = 1 - sq + st; o.sx = 1 + sq * .6 - st * .5;
  }
  blit('walk', i0, x, scl, dy, A, o);
  if (ue > 0.01 && i1 !== i0) blit('walk', i1, x, scl, dy, A * ue, o);
  if ($('cSym') && $('cSym').checked && !greenOn()) {   // غبار عند لمس القدم للأرض + خطوط سرعة خلف الشخصية أثناء المشي
    const per = pp ? n - 1 : n / 2, age = (((steps % per) + per) % per) / per, gc = groundCol(), pc = 'rgba(' + Math.min(255, gc[0] + 60) + ',' + Math.min(255, gc[1] + 55) + ',' + Math.min(255, gc[2] + 50) + ',';
    ctx.save(); ctx.fillStyle = pc + (.45 * (1 - age) * A).toFixed(3) + ')';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - (30 + k * 16 + age * 34) * scl, GROUND - (4 + k * 3 + age * 16) * scl, (5 + k * 3 + age * 14) * scl, 0, 7); ctx.fill(); }
    const q = Math.floor(clock * 12); ctx.strokeStyle = 'rgba(255,255,255,' + (.28 * A).toFixed(2) + ')'; ctx.lineWidth = 3 * scl; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const yy = GROUND - (60 + rn(k, 7) * 230) * scl, len = (50 + rn(k + q, 3) * 70) * scl, xx = x - (70 + rn(k + q, 5) * 40) * scl; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - len, yy); ctx.stroke(); }
    ctx.restore();
  }
}
// عناصر أمامية: شريط من الخلفية نفسها (بحافة ناعمة) فوق القدمين ليبدو أنهما وسط العشب/الأوراق لا فوقها
function drawFg(s, tt) {
  if (greenOn()) return;
  const im = bgs[(s.map || 1) - 1]; if (!im || CUR_BG === 5 || !LASTSH) return;
  const top = GROUND - 30, bh = 72, cr = camRect(s, tt, im);
  if (!FGC) { FGC = document.createElement('canvas'); FGC.width = W; FGC.height = bh; } const g = FGC.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, bh);
  { const P = parShift(s, tt); g.drawImage(im, P == null ? cr.x : Math.min(0, Math.max(W - cr.w, cr.x + shiftAt(P, GROUND + 20, GROUND))), cr.y - top, cr.w, cr.h); }
  g.globalCompositeOperation = 'destination-in'; const gr = g.createLinearGradient(0, 0, 0, bh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.3, 'rgba(0,0,0,1)'); gr.addColorStop(.85, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, bh);
  const hw = LASTSH[1] * 1.0, x0 = Math.max(0, LASTSH[0] - hw), x1 = Math.min(W, LASTSH[0] + hw);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, top, x1 - x0, bh); ctx.clip(); ctx.drawImage(FGC, 0, top); ctx.restore();
  ctx.save(); ctx.globalAlpha = .4 * LASTSH[2]; ctx.translate(LASTSH[0], GROUND + 3); ctx.scale(1, .13); const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, LASTSH[1]); rg.addColorStop(0, 'rgba(0,0,0,.7)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, LASTSH[1], 0, 7); ctx.fill(); ctx.restore();
}
const MULTI_BG = [1, 5, 6, 7, 9, 10, 11];
function softLeaf(rx, ry, c) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, c); g.addColorStop(.6, c); g.addColorStop(1, c.replace('rgb(', 'rgba(').replace(')', ',0)')); ctx.fillStyle = g; ctx.save(); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore(); }
function drawMulti(s, tt) {   // طبقة أمامية خفيفة: أوراق بحواف ناعمة بتدرّج لوني (بدون فلتر تمويه كي لا تثقل التشغيل)
  if (!$('cMulti') || !$('cMulti').checked || greenOn() || !MULTI_BG.includes(s.map || s.bg || 1)) return;
  const A = CUR_AMB || { r: 60, g: 90, b: 50 }, col = 'rgb(' + Math.round(A.r * .38) + ',' + Math.round(A.g * .45) + ',' + Math.round(A.b * .32) + ')', hi = 'rgb(' + Math.round(A.r * .55) + ',' + Math.round(A.g * .68) + ',' + Math.round(A.b * .45) + ')';
  const sd = (s._pi == null ? SHOTS.indexOf(s) : s._pi), side = sd % 2 ? 1 : -1, bx = side < 0 ? 0 : W, sw = Math.sin(clock * .7 + sd) * .035 + Math.sin(clock * 1.7 + sd * 2) * .01, inw = side < 0 ? 1 : -1;
  ctx.save(); ctx.globalAlpha = .85;
  for (let i = 0; i < 7; i++) {
    const u = i / 6, x = bx + inw * (30 + u * 320), y = -30 + u * 150 + Math.sin(clock * .9 + i) * 3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(inw * (.5 + u * .2) + sw * (2 + u * 4) + (i % 2 ? .9 : -.9) * inw); softLeaf(60 + u * 34, 22 + u * 10, i % 3 ? col : hi); ctx.restore();
  }
  const P = 11, u = (((clock + sd * 3.7) % P) + P) % P / P;
  if (u < .09) { const e = u / .09, x = inw > 0 ? -80 + e * (W + 160) : W + 80 - e * (W + 160), y = H * .16 + Math.sin(e * Math.PI) * -40 + e * 60;
    ctx.globalAlpha = .7; ctx.translate(x, y); ctx.rotate(e * 6 + sd); softLeaf(95, 40, col); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawChar(s, tt) {
  const RN = !!(s.run && frames.run); ARR = s.noWalk ? tt : tt - (s.inT + XF); CUR_BG = s.map || s.bg || 1; CUR_AMB = ambOf(CUR_BG); GROUND = GRG[CUR_BG] || 625; GSC = GRS[CUR_BG] || 1;
  const X = W * (GRX[CUR_BG] && +$('rX').value === 0.2 ? GRX[CUR_BG] : (+($('rX') ? $('rX').value : s.x) || s.x)), x0 = W * -0.15, x1 = W * 1.15, mainEnd = s.dur - s.outT;
  if (!s.noWalk && tt < s.inT) {
    if (!(RN || frames.walk)) { drawStand(s, 0, X, 1); return; }
    const e = 1 - Math.pow(1 - tt / s.inT, 1.6), x = x0 + (X - x0) * e; if (RN) runAt(x, (x - X) / RSTR, 1); else walkAt(x, (x - x0) / strideNow() + walkPh(X - x0, true), 1); return;
  }
  if (!s.noWalk && (RN || frames.walk) && tt < s.inT + XF) {               // تحويل ناعم من المشي إلى الوقوف
    // قطع مباشر (بدون امتزاج) حتى لا تبقى وضعية المشي ظاهرة خلف وضعية الوقوف
    if ((tt - s.inT) / XF < .5) { if (RN) runAt(X, 0, 1); else walkAt(X, (X - x0) / strideNow() + walkPh(X - x0, true), 1); } else drawStand(s, 0, X, 1); return;
  }
  if (!s.noWalk && tt > mainEnd) {
    const ot = tt - mainEnd, u = ot / s.outT, c = ease(ot / XF);
    if ((s.out === 'away' || s.out === 'turnaway') && frames.back) {
      const TT = s.out === 'turnaway' && frames.turn ? .7 : 0;   // التفات سريع (أمام ← ثلاثة أرباع ← جانب ← ظهر) ثم مشي بالظهر
      if (TT && ot < TT + .2) { const ti = Math.min(frames.turn.length - 1, Math.floor(Math.max(0, ot - .15) / (TT - .15) * frames.turn.length)); if (ot < .15) { drawStand(s, .999, X, 1); return; } shadow(X, 90, 1); blit('turn', ti, X, 1, 0, 1); return; }
      const u2 = TT ? Math.min(1, (ot - TT - .2) / Math.max(.3, s.outT - TT - .2)) : u;
      const e = ease(u2), sc = 1 - .4 * e, dy = -50 * e; if (TT) { stepTick(Math.floor(clock * 2.2), sc); shadow(X, 100 * sc, 1); blit('back', Math.floor(clock * 8.8), X, sc, dy, 1); return; }
      if (c < .5) { drawStand(s, .999, X, 1); return; }
      stepTick(Math.floor(clock * 2.2), sc); shadow(X, 100 * sc, 1); blit('back', Math.floor(clock * 8.8), X, sc, dy, 1); return;
    }
    if (RN || frames.walk) {
      const x = X + (x1 - X) * Math.pow(u, 1.6);
      if (c < .5) { drawStand(s, .999, X, 1); return; }
      if (RN) runAt(x, (x - X) / ROUT, 1); else walkAt(x, (x - X) / strideNow() + walkPh(0, false), 1); return;
    }
  }
  drawStand(s, Math.min(.999, Math.max(0, mOf(s, tt))), X, 1);
}
function pair(name, i0, i1, u, X, A, o) {
  // مزج حقيقي: الوضعية السابقة تتلاشى تدريجيًا (بدل أن تبقى كاملة خلف الجديدة حتى آخر لحظة ثم تختفي فجأة)
  // قطع مباشر بين الإطارين بلا أي امتزاج: لا تظهر الوضعية السابقة إطلاقًا خلف الجديدة
  blit(name, u >= .5 ? i1 : i0, X, 1, 0, A, Object.assign({}, o, { mouth: 1 }));
}
function chunkAt(s, m) {
  const ch = chunks(s), tot = ch.reduce((a, c) => a + c.length, 0), main = s.dur - s.inT - s.outT, f = Math.max(0, Math.min(1, m / Math.max(.05, 1 - (s.extra || 0) / main)));
  let acc = 0; for (let i = 0; i < ch.length; i++) { acc += ch[i].length; if (f * tot <= acc) return i; } return ch.length - 1;
}
// ===== حركات مرتبطة بكلمات النص: قفزة فرح، إيماءة موافقة، رجفة خوف/برد =====
const KW = [
  { t: 'jump', d: .85, gap: 6, re: /رائع|ممتاز|برافو|مبروك|أحسنت|عظيم|مذهل|هيا بنا/g },
  { t: 'nod', d: .5, gap: 2.5, re: /نعم|بالضبط|صحيح|بالتأكيد|طبع[اً]|أجل/g },
  { t: 'shiver', d: 1.4, gap: 3, re: /خائف|خوف|برد|يرتجف|مخيف/g }
];
function kwEvents(s) {
  const main = s.dur - s.inT - s.outT, txt = s.text || '', k = 1 - (s.extra || 0) / main, out = [];
  for (const r of KW) { let last = -99, m; r.re.lastIndex = 0;
    while ((m = r.re.exec(txt))) { const f = m.index / Math.max(1, txt.length) * k; if ((f - last) * main >= r.gap) { out.push({ t: r.t, f, d: r.d }); last = f; } } }
  return out;
}
function drawStand(s, m, X, A, noSh) {
  A = A == null ? 1 : A; if (A <= 0.002) return;
  const main = s.dur - s.inT - s.outT; let mode = 'talk', st = 0, nx = 1;
  s.acts.forEach(([f, md], i) => { if (m >= f) { mode = md; st = f; nx = s.acts[i + 1] ? s.acts[i + 1][0] : 1; } });
  if (s.props && frames.point) for (const p of s.props) {   // تشير الشخصية إلى البطاقة لحظة ظهورها
    if (m >= p.f0 && m < p.f1 && (p.id.startsWith('bg') ? bgs[+p.id.slice(2) - 1] : props[p.id]) && (m - p.f0) * main < 2.6 && mode !== 'point') { mode = 'point'; st = p.f0; nx = Math.min(1, p.f0 + 2.6 / main); }
  }
  const tm = m * main - st * main, left = (nx - m) * main; let name = pickSheet(mode), wLow = -1;
  // التلويح طبيعي: رفع اليد، ثم تلويحتان خفيفتان لمدة قصيرة، ثم تنزل اليد ويكمل الشرح بالإيماءات
  if (name === 'wave' && mode === 'wave' && tm > WAVE_HOLD) { if (tm < WAVE_HOLD + .8 && frames.wave.length > 8) wLow = 5 * (1 - ease((tm - WAVE_HOLD) / .8)); else { mode = 'talk'; name = pickSheet('talk'); } }
  if (!name) return;
  const n = frames[name].length, cl = v => Math.max(0, Math.min(n - 1, v)); let i0 = 0, i1 = 0, u = 0, hop = 0;
  if (name === 'wave' && wLow >= 0) { const k = Math.min(4, Math.floor(wLow)); i0 = k; i1 = k + 1; u = wLow - k; }
  else if (name === 'wave') { if (tm < .85 && n > 8) { const p = ease(tm / .85) * 5, k = Math.min(4, Math.floor(p)); i0 = k; i1 = k + 1; u = p - k; } else { const nn = 3, wv = .5 + .5 * Math.sin((clock - st * main) * 5 + 1.2), pp = wv * (nn - 1), k = Math.min(nn - 1, Math.floor(pp)); i0 = 5 + k; i1 = 5 + Math.min(nn - 1, k + 1); u = pp - k; } }
  else if (name === 'talk' || name === 'sit') {
    // الإيماءة تتغير عند نهاية الجملة/الفاصلة، أو عند تأكيد الصوت، أو كل 2.6 ثانية كحد أقصى
    const mul = name === 'talk' ? 7 : 5, cid = chunkAt(s, m);
    if (s._bn !== name) { s._bn = name; s._bk = 0; s._bl = clock; s._tp = -9; s._cid = cid; }
    const EV = envOf(s), evOn = EV && audioPos(s) >= 0 && audioPos(s) <= EV.dur;
    const emph = !evOn && M.act > .5 && M.open > .6 && clock - s._bl > 1.2;
    const hold = 2.4 + ((s._bk * 7 + 3) % 5) * .3;                // مدة الإيماءة تتفاوت 2.4–3.6 ثانية فلا يبدو الإيقاع آليًا
    const cid2 = evOn ? evCount(EV, audioPos(s)) : cid;            // مع الصوت المرفق: تتغير الإيماءة عند نهاية العبارة أو النبرة القوية فعلًا
    if ((evOn ? (cid2 !== s._cid && clock - s._bl > 1.3) : cid !== s._cid) || clock - s._bl > hold + (evOn ? .6 : 0) || emph) { s._cid = evOn ? cid2 : cid; s._bk++; s._bl = clock; s._tp = clock; }
    i0 = (Math.max(0, s._bk - 1) * mul + 3) % n; i1 = (s._bk * mul + 3) % n; u = ease((clock - s._tp - (LIFE() ? ANT : 0)) / .26);
  } else {
    let pos;
    if (name === 'point') { pos = Math.min(4, tm / 0.3); if (left < 0.5 && nx < 1) pos = Math.min(5, 4 + (0.5 - left) / 0.25); }
    else if (name === 'think') {
      if (tm < 2.5) pos = Math.min(5, tm / 0.5);
      else { const q = (tm - 2.5) / 0.9, k = Math.floor(q); pos = -1; i0 = 3 + k % 3; i1 = 3 + (k + 1) % 3; u = ease(q - k); }
    }
    else if (name === 'joy') { const P = 2.6, q = ((tm % P) + P) % P, k = q < .5 ? 0 : q < .8 ? 2 : q < 1.35 ? 3 : 1; pos = -1; i0 = i1 = Math.min(n - 1, k); u = 0; hop = k === 3 ? Math.sin((q - .8) / .55 * Math.PI) * 26 : 0; }   // ضحك ← انحناء ← قفزة ← ذراعان مرفوعتان
    else if (name === 'sad') pos = Math.min(n - 1, tm / 0.7);
    else pos = Math.min(n - 1, tm / 0.5);
    if (pos >= 0) { const k = Math.floor(pos); i0 = k; i1 = k + 1; u = ease(pos - k); }
  }
  if (name === 'wave') u = ease((u - .46) / .08);
  else if (name !== 'talk' && name !== 'sit') u = ease((u - .22) / .56);   // امتزاج أقصر بين وضعيات الإشارة والتفكير والحزن والدهشة: أقل شبحية   // امتزاج قصير جدًا بين إطارات التلويح لتجنّب الطيف الشبحي حول اليد
  i0 = cl(i0); i1 = cl(i1); if (i0 === i1) u = 0;
  const ck = TWOS() ? Math.floor(clock * 12) / 12 : clock;   // «على اثنين»: حركة الحياة تتغير 12 مرة في الثانية كالرسوم اليدوية القديمة
  // حركة حياة خفيفة: تنفّس + تمايل + نبضة مع الصوت
  const br = Math.sin(ck * 2.1), amp = M.open * M.act, idle = 1 - Math.min(1, M.act * 1.5);
  const ws = Math.sin(ck * .72 + (s.cam || 0)), ws2 = Math.sin(ck * .31 + 2);    // انتقال الوزن بين القدمين ببطء + تمايل أبطأ
  const bp = (name === 'talk' || name === 'sit') && s._tp > 0 ? Math.exp(-(clock - s._tp) * 6) * M.act : 0;   // نبضة خفيفة مع كل إيماءة جديدة
  const o = { sy: 1 + 0.008 * (1 + .9 * idle) * br + 0.0025 * amp + 0.005 * bp, sx: 1 - 0.004 * br - 0.001 * amp, rot: Math.sin(ck * 0.8) * 0.003 + Math.sin(ck * 1.9 + 1) * 0.0012 + (amp - 0.3 * M.act) * 0.0018 + Math.sin(ck * .33) * .005 * idle + ws * 0.0065 + ws2 * 0.003, dx: Math.sin(ck * 0.55) * 2.4 + Math.sin(ck * 1.3 + 1) * 0.9 + Math.sin(ck * .3) * 3.2 * idle + ws * 5.5 };
  if (LIFE()) {
    const gest = name === 'talk' || name === 'sit', dir = (s._bk || 0) % 2 ? 1 : -1;
    // (1) التمهيد: قبل تغيّر الإيماءة تتراجع الشخصية وتنضغط قليلًا ثم تنطلق
    if (gest && s._tp > 0) { const ta = clock - s._tp; if (ta >= 0 && ta < ANT) { const a = Math.sin(ta / ANT * Math.PI / 2); o.rot -= dir * .016 * a; o.dx -= dir * 4 * a; o.sy -= .012 * a; o.sx += .006 * a; } }
    // (2) التجاوز والاستقرار: عند بلوغ الوضع الجديد (إيماءة أو إشارة أو وصول) تتجاوز قليلًا ثم تستقر بنعومة
    let tc = gest ? (s._tp > 0 ? clock - s._tp - ANT - .1 : 99) : tm - (ARRT[name] || .5);
    tc = Math.min(tc, ARR - .05); const S = settleF(tc);
    if (Math.abs(S) > 1e-4) { o.rot += dir * S * .014; o.dx += dir * S * 3.5; o.sy += S * .013; o.sx -= S * .007; }
    // (4) الإمساك المتحرك: لا تتجمّد الشخصية في الوضع الثابت؛ ميلان رأس ونقل وزن دقيقان لا يتكرران بوضوح
    const hv = gest ? 1 : 1.6 * ease((tm - (ARRT[name] ?? .5)) / .9);
    o.rot += hv * (Math.sin(ck * .47 + 1.3) * .0035 + Math.sin(ck * 1.07 + .4) * .0016);
    o.dx += hv * (Math.sin(ck * .38 + 2.1) * 2.6 + Math.sin(ck * .91) * .8);
    o.sy += hv * Math.sin(ck * .53 + .7) * .0035;
  }
  if (LIFE() && name === 'awe') {   // اللقطة الانفعالية: انكماش سريع ثم تمدد مبالغ فيه ثم عودة
    const k = tm; let ys = 0, xs = 0;
    if (k >= 0 && k < .1) { const e = ease(k / .1); ys = -.035 * e; xs = .03 * e; }
    else if (k < .26) { const e = ease((k - .1) / .16); ys = -.035 + .1 * e; xs = .03 - .06 * e; }
    else if (k < .62) { const e = ease((k - .26) / .36); ys = .065 * (1 - e); xs = -.03 * (1 - e); }
    o.sy += ys; o.sx += xs;
  }
  if (LIFE() && name !== 'sit' && name !== 'wave') {   // تنفَّذ فوق الحركة الحالية بدون تغيير الإطارات
    if (!s._kw) s._kw = kwEvents(s);
    for (const e of s._kw) { const k = (m - e.f) * main; if (k < 0 || k > e.d) continue;
      if (e.t === 'jump' && ['talk', 'point', 'think'].includes(name)) {
        if (k < .1) { const a = Math.sin(k / .1 * Math.PI / 2); o.sy -= .04 * a; o.sx += .02 * a; }
        else if (k < .65) { o.dy = (o.dy || 0) - 38 * Math.sin((k - .1) / .55 * Math.PI); }
        else { const a = Math.sin((k - .65) / .2 * Math.PI); o.sy -= .05 * a; o.sx += .03 * a; } }
      else if (e.t === 'nod' && ['talk', 'point', 'think'].includes(name)) { const a = Math.sin(k / e.d * Math.PI); o.rot += .035 * a; o.sy -= .012 * a; }
      else if (e.t === 'shiver') { const a = Math.sin(k / e.d * Math.PI); o.dx += Math.sin(clock * 38) * 1.6 * a; o.rot += Math.sin(clock * 31) * .004 * a; } } }
  if (hop) o.dy = (o.dy || 0) - hop;
  if (!noSh) { const L1 = LIFE(); shadow(X + (L1 ? o.dx * .7 : 0), (name === 'sit' ? 70 : 90) * (L1 ? Math.max(.85, Math.min(1.2, 1 + (1 - o.sy) * 3)) : 1), A * (L1 ? Math.max(.75, Math.min(1.15, 1 + (1 - o.sy) * 2)) : 1)); }
  let pn = name;
  if (frames.joy && ['talk', 'point', 'think'].includes(name)) { if (!s._kw) s._kw = kwEvents(s);   // كلمات الفرح (رائع، مبروك…): نستبدل الإطار بقفزة الفرح
    for (const e of s._kw) { if (e.t !== 'jump') continue; const k = (m - e.f) * main; if (k >= 0 && k < e.d) { pn = 'joy'; i0 = i1 = k < .2 ? 2 : k < .7 ? 3 : 1; u = 0; o.sy = 1; o.sx = 1; o.dy = k >= .2 && k < .7 ? -Math.sin((k - .2) / .5 * Math.PI) * 26 : 0; } } }
  pair(pn, i0, i1, u, X, A, o);
  if ($('cSym') && $('cSym').checked && !greenOn() && (name === 'awe' || name === 'think')) {   // رمز فوق الرأس: ! عند الدهشة، ؟ عند التفكير
    const fr = frames[name][i0], cfg = SH[name], sc = cfg.th * 0.96 / frames[name].ch * UI.size() * GSC, top = GROUND - (fr.bb.y1 - fr.bb.y0) * sc * 1.0;
    const st0 = name === 'awe' ? .12 : .6, ttm = tm - st0; if (ttm > 0 && (name === 'think' || ttm < 1.6)) {
      const u2 = Math.min(1, ttm / .25), pop = .3 + .7 * (1 + 2.70158 * Math.pow(u2 - 1, 3) + 1.70158 * Math.pow(u2 - 1, 2)), fade = name === 'awe' ? Math.min(1, (1.6 - ttm) / .3) : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, fade) * A; ctx.translate(X + 70, top - 14 + Math.sin(clock * 3) * (name === 'think' ? 4 : 0)); ctx.rotate(Math.sin(clock * 9) * (name === 'awe' ? .08 : .05)); ctx.scale(pop, pop);
      ctx.font = 'bold 88px system-ui'; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = name === 'awe' ? '#ffd23f' : '#7fd1ff';
      const ch = name === 'awe' ? '!' : '?'; ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0); ctx.restore();
    }
  }
}
