// ===== حالة الفم (تُعرَّف مبكرًا لأن ac() تُستدعى عند البدء) =====
const M = { open: 0, wide: 0, round: 0, act: 0 };
let AN = null, pk = 0.08, audioUntil = 0, tdata = null, fdata = null;
SH.walk.nm = true; SH.back.nm = true;               // لا فم في المشي الجانبي أو من الخلف
SH.sit.mk = { y: .132, w: .036 };
SH.talk.mk = { y: .117, w: .030 }; SH.think.mk = { y: .121, w: .030 }; SH.awe.mk = { y: .113, w: .030 };
SH.point.mk = { y: .115, w: .030 }; SH.wave.mk = { y: .118, w: .030 }; SH.sad.mm = true; // الحزن: الرأس منحنٍ فلا فم ظاهر                    // تقدير رأس الشخصية الجالسة

// ===== إزالة الخلفية الاحترافية =====
// 1) تحديد لون/ألوان الخلفية من الحواف (تدعم لوحات مربعات الشفافية المزيفة)
// 2) ملء من الحواف + حذف الفراغات المحصورة بين الذراع والجسم
// 3) حواف ناعمة: نقدّر لون الشخصية الحقيقي ونحسب الشفافية بالإسقاط، فلا يبقى هالة بيضاء
// 4) حذف الشوائب الصغيرة وبقايا الإطارات المجاورة، ثم تنعيم خفيف للحافة
function bgColors(p, w, h) {
  const bins = new Map(); let n = 0;
  const add = k => {
    const i = k * 4; if (p[i + 3] < 200) return; n++;
    const key = ((p[i] >> 3) << 10) | ((p[i + 1] >> 3) << 5) | (p[i + 2] >> 3);
    let b = bins.get(key); if (!b) { b = [0, 0, 0, 0]; bins.set(key, b); }
    b[0]++; b[1] += p[i]; b[2] += p[i + 1]; b[3] += p[i + 2];
  };
  for (let x = 0; x < w; x++) { add(x); add(w + x); add((h - 1) * w + x); add((h - 2) * w + x); }
  for (let y = 2; y < h - 2; y++) { add(y * w); add(y * w + 1); add(y * w + w - 1); add(y * w + w - 2); }
  const arr = [...bins.values()].sort((a, b) => b[0] - a[0]), out = [];
  for (const b of arr) { if (out.length >= 3) break; if (out.length === 0 || b[0] >= n * 0.10) out.push([b[1] / b[0], b[2] / b[0], b[3] / b[0]]); }
  return out.length ? out : [[255, 255, 255]];
}
function matte(c, tol, badgePx) {
  const w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true });
  let im; try { im = g.getImageData(0, 0, w, h); } catch (e) { msg('تعذّر إزالة الخلفية في هذا المتصفح'); return null; }
  const p = im.data, N = w * h, alpha = new Uint8Array(N);
  let tr = 0, tot = 0; const chk = k => { tot++; if (p[k * 4 + 3] < 16) tr++; };
  for (let x = 0; x < w; x++) { chk(x); chk((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { chk(y * w); chk(y * w + w - 1); }
  const band = new Uint8Array(N);
  if (tr / tot > 0.6) {                                   // الصورة شفافة أصلًا: ننظّف فقط
    for (let k = 0; k < N; k++) alpha[k] = p[k * 4 + 3];
  } else {
    const B = bgColors(p, w, h), nb = B.length, D = new Float32Array(N), Ix = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const i = k * 4; let best = 1e9, bi = 0;
      for (let j = 0; j < nb; j++) { const d = (Math.abs(p[i] - B[j][0]) + Math.abs(p[i + 1] - B[j][1]) + Math.abs(p[i + 2] - B[j][2])) / 3; if (d < best) { best = d; bi = j; } }
      D[k] = best; Ix[k] = bi;
    }
    const Tf = tol * 1.5, Tc = tol;
    const rem = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
    const seed = k => { if (!rem[k] && D[k] <= Tf) { rem[k] = 1; st[sp++] = k; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (sp) { const k = st[--sp], x = k % w, y = (k / w) | 0; if (x > 0) seed(k - 1); if (x < w - 1) seed(k + 1); if (y > 0) seed(k - w); if (y < h - 1) seed(k + w); }
    // فراغات محصورة (بين الذراع والجسم مثلًا)
    const holes = !$('cHoles') || $('cHoles').checked;
    if (holes) {
      const lab = new Uint8Array(N), minA = N * 0.0015, maxA = N * 0.07, T2 = Tc * 0.8;
      for (let s0 = 0; s0 < N; s0++) {
        if (rem[s0] || lab[s0] || D[s0] > T2) continue;
        const comp = []; sp = 0; st[sp++] = s0; lab[s0] = 1;
        while (sp) {
          const k = st[--sp], x = k % w, y = (k / w) | 0; comp.push(k);
          const nn = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
          for (const q of nn) if (q >= 0 && !rem[q] && !lab[q] && D[q] <= T2) { lab[q] = 1; st[sp++] = q; }
        }
        if (comp.length >= minA && comp.length <= maxA) for (const k of comp) rem[k] = 1;
      }
    }
    // ظل الأرضية الرمادي تحت القدمين (للخلفيات الفاتحة): نمدّ الحذف على البكسلات المحايدة الفاتحة في أسفل الإطار
    const bl = B.reduce((a, c) => Math.max(a, .299 * c[0] + .587 * c[1] + .114 * c[2]), 0);
    if (bl > 150) {
      const yMin = Math.floor(h * .78), isSh = k => { const i = k * 4, r = p[i], g2 = p[i + 1], b2 = p[i + 2], mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2); return mx - mn <= 22 && (.299 * r + .587 * g2 + .114 * b2) >= bl * .7; };
      sp = 0; for (let y = yMin; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (rem[k]) st[sp++] = k; }
      while (sp) { const k = st[--sp], x = k % w, y = (k / w) | 0; for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > yMin ? k - w : -1, y < h - 1 ? k + w : -1]) if (q >= 0 && !rem[q] && isSh(q)) { rem[q] = 1; st[sp++] = q; } }
    }
    // نطاق الحافة: بكسلات الشخصية القريبة (حتى 2 بكسل) من الخلفية المحذوفة
    const near1 = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (rem[k]) continue; if ((x > 0 && rem[k - 1]) || (x < w - 1 && rem[k + 1]) || (y > 0 && rem[k - w]) || (y < h - 1 && rem[k + w])) near1[k] = 1; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (rem[k]) continue; if (near1[k]) { band[k] = 1; continue; } if ((x > 0 && near1[k - 1]) || (x < w - 1 && near1[k + 1]) || (y > 0 && near1[k - w]) || (y < h - 1 && near1[k + w])) band[k] = 1; }
    const R = 3, newRGB = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; if (rem[k]) { alpha[k] = 0; continue; } alpha[k] = 255;
      if (!band[k]) continue;
      // تقدير لون الشخصية الحقيقي من أقرب بكسلات داخلية
      let fr = 0, fg = 0, fb = 0, fn = 0;
      for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
        const q = yy * w + xx; if (rem[q] || band[q]) continue; const i = q * 4; fr += p[i]; fg += p[i + 1]; fb += p[i + 2]; fn++;
      }
      if (!fn) continue;
      fr /= fn; fg /= fn; fb /= fn;
      const b = B[Ix[k]], i = k * 4, vr = fr - b[0], vg = fg - b[1], vb = fb - b[2], vv = vr * vr + vg * vg + vb * vb;
      if (vv < 900) continue;                              // الشخصية قريبة من لون الخلفية: نتركها كما هي
      let a = ((p[i] - b[0]) * vr + (p[i + 1] - b[1]) * vg + (p[i + 2] - b[2]) * vb) / vv;
      a = a < 0 ? 0 : a > 1 ? 1 : a; if (a > 0.92) a = 1; else if (a < 0.06) a = 0;
      alpha[k] = Math.round(a * 255); newRGB.set(k, [fr, fg, fb]);
    }
    for (const [k, v] of newRGB) { const i = k * 4; p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; }
  }
  // إزالة بقايا الخلفية المحصورة (فجوات بيضاء/رمادية فاتحة بين الذراع والجسم أو بين قوائم الكرسي): كتل صغيرة فاتحة محايدة تحت مستوى الرأس
  if (!$('cHoles') || $('cHoles').checked) {
    const lab = new Uint8Array(N), st = new Int32Array(N), yMin = Math.floor(h * .22), maxA = N * 0.012;
    const lite = k => { if (alpha[k] < 128) return false; const i = k * 4, r = p[i], g2 = p[i + 1], b2 = p[i + 2], mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2); return mn > 150 && mx - mn < 34; };
    for (let y0 = yMin; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
      const s0 = y0 * w + x0; if (lab[s0] || !lite(s0)) continue;
      const comp = []; let sp = 0; st[sp++] = s0; lab[s0] = 1;
      while (sp) { const k = st[--sp], x = k % w, y = (k / w) | 0; comp.push(k);
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > yMin ? k - w : -1, y < h - 1 ? k + w : -1]) if (q >= 0 && !lab[q] && lite(q)) { lab[q] = 1; st[sp++] = q; } }
      if (comp.length >= 6 && comp.length <= maxA) for (const k of comp) alpha[k] = 0;
    }
  }
  // مسح شارة الرقم (لوحة التلويح)
  if (badgePx > 0) for (let y = 0; y < Math.min(h, badgePx); y++) for (let x = 0; x < Math.min(w, badgePx); x++) alpha[y * w + x] = 0;
  // حذف الشوائب: نُبقي أكبر الكتل المتصلة فقط
  {
    const lab = new Int32Array(N), st = new Int32Array(N), sizes = [0]; let nl = 0;
    for (let s0 = 0; s0 < N; s0++) {
      if (alpha[s0] < 40 || lab[s0]) continue; nl++; let sp = 0, n = 0; st[sp++] = s0; lab[s0] = nl;
      while (sp) {
        const k = st[--sp], x = k % w, y = (k / w) | 0; n++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx; if (!lab[q] && alpha[q] >= 40) { lab[q] = nl; st[sp++] = q; }
        }
      }
      sizes[nl] = n;
    }
    const big = sizes.reduce((a, b) => Math.max(a, b), 0);
    for (let k = 0; k < N; k++) { const l = lab[k]; if (l && sizes[l] < big * 0.10) alpha[k] = 0; else if (!l && alpha[k] < 40) alpha[k] = 0; }
  }
  // تنعيم الحافة (rEdge تمريرات) + إزالة الهالة (rHalo بكسل انكماش مع تنظيف لون الحافة)
  const edgeN = $('rEdge') ? +$('rEdge').value : 1, haloN = $('rHalo') ? +$('rHalo').value : 0;
  const a2 = Uint8Array.from(alpha);
  for (let it = 0; it < haloN; it++) {
    const b0 = Uint8Array.from(a2);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (!b0[k]) continue; const m = Math.min(b0[k - 1], b0[k + 1], b0[k - w], b0[k + w]); if (m < b0[k]) a2[k] = m; }
  }
  for (let it = 0; it < edgeN; it++) {
    const s0 = Uint8Array.from(a2);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x, a = s0[k], l = s0[k - 1], r = s0[k + 1], u = s0[k - w], d = s0[k + w];
      if (a === l && a === r && a === u && a === d) continue;
      a2[k] = (a * 4 + l + r + u + d) >> 3;
    }
  }
  if (haloN > 0) {                                          // لون الحافة من أقرب بكسلات داخلية معتمة
    const src = new Uint8ClampedArray(p);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x; if (a2[k] === 0 || a2[k] === 255) continue;
      let r = 0, g2 = 0, b2 = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = k + dy * w + dx; if (a2[q] === 255) { const i = q * 4; r += src[i]; g2 += src[i + 1]; b2 += src[i + 2]; n++; } }
      if (n) { const i = k * 4; p[i] = r / n; p[i + 1] = g2 / n; p[i + 2] = b2 / n; }
    }
  }
  for (let k = 0; k < N; k++) p[k * 4 + 3] = a2[k];
  g.putImageData(im, 0, 0);
  return measure(p, w, h);
}
// الحدود + نقاط الارتكاز (من قناة الشفافية)
function measure(p, w, h) {
  const A = k => p[k * 4 + 3];
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(y * w + x) > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return { x0: 0, y0: 0, x1: w, y1: h, axT: w / 2, axL: w / 2, hx: w / 2 };
  const H = y1 - y0, cen = (ya, yb) => { let sx = 0, sw = 0; for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(h - 1, Math.ceil(yb)); y++) for (let x = x0; x <= x1; x++) { const a = A(y * w + x); sx += x * a; sw += a; } return sw ? sx / sw : (x0 + x1) / 2; };
  let hx0 = w, hx1 = 0; for (let y = y0; y <= Math.min(h - 1, y0 + Math.round(H * .09)); y++) for (let x = x0; x <= x1; x++) if (A(y * w + x) > 60) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  return { x0, y0, x1, y1, axT: cen(y0 + H * .12, y0 + H * .5), axL: cen(y0 + H * .62, y1), hx: cen(y0, y0 + H * .09), tw: (hx1 - hx0) / H };
}
// قمة الشعر ومركز الرأس من البكسلات الداكنة (لا تتأثر بيد مرفوعة أو بصف مقصوص)
function headInfo(f) {
  const w = f.width, h = f.height, d = f.getContext('2d').getImageData(0, 0, w, h).data, bb = f.bb, lim = Math.max(3, Math.round(w * .012));
  let ht = bb.y0;
  for (let y = bb.y0; y < Math.min(h, bb.y0 + (bb.y1 - bb.y0) * .4); y++) { let n = 0; for (let x = bb.x0; x <= bb.x1; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] < 210) n++; } if (n >= lim) { ht = y; break; } }
  const y1 = Math.min(h - 1, ht + Math.round((bb.y1 - ht) * .05)); let sx = 0, sn = 0;
  for (let y = ht; y <= y1; y++) for (let x = bb.x0; x <= bb.x1; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] < 210) { sx += x; sn++; } }
  let hx = sn ? sx / sn : (bb.x0 + bb.x1) / 2; const Hr = bb.y1 - ht, ya = Math.round(ht + Hr * .085), yb = Math.round(ht + Hr * .115); let fx = 0, fn = 0;
  for (let y = ya; y <= yb && y < h; y++) for (let x = Math.max(0, Math.round(hx - Hr * .07)); x <= Math.min(w - 1, Math.round(hx + Hr * .07)); x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] > 110 && d[i] > d[i + 1] + 10 && d[i] - d[i + 2] > 30) { fx += x; fn++; } }
  f._ht = ht; f._hx = fn > 40 ? fx / fn : hx;
}
// تدقيق موضع الفم: الشفاه أكثر احمرارًا من البشرة حولها
function refineMouth(f) {
  const m = f.mouth, Hr = f._hr, w = f.width, h = f.height, d = f.getContext('2d').getImageData(0, 0, w, h).data;
  const x0 = Math.max(0, Math.round(m.x - Hr * .04)), x1 = Math.min(w - 1, Math.round(m.x + Hr * .04)), y0 = Math.max(0, Math.round(m.y - Hr * .016)), y1 = Math.min(h - 1, Math.round(m.y + Hr * .016)), px = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] > 90) px.push([x, y, (d[i] - d[i + 1]) - .35 * d[i + 2]]); }
  if (px.length < 60) return; const sc = px.map(p => p[2]).sort((a, b) => a - b), th = sc[Math.floor(sc.length * .8)]; let sx = 0, sy = 0, sw = 0;
  for (const p of px) if (p[2] >= th) { const wt = p[2] - th + 1; sx += p[0] * wt; sy += p[1] * wt; sw += wt; }
  if (sw) { m.x = sx / sw; m.y = sy / sw; }
}
// قص شبكة من صورة: cols×rows (أو نطاقات أفقية مخصّصة xr لصور الوضعيات المنفصلة)
function cutGrid(img, cfg, cols, rows, xr) {
  const k = img.naturalHeight / cfg.H, colW = img.naturalWidth / cols, out = [];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const sx = xr ? xr[c][0] : c * colW + cfg.pad * k, sw = Math.max(1, Math.round(xr ? xr[c][1] - xr[c][0] : colW - 2 * cfg.pad * k)), sy = rows[r][0] * k, sh = Math.round((rows[r][1] - rows[r][0]) * k);
    const cap = Math.min(1, 780 / sh), fw = Math.max(1, Math.round(sw * cap)), fh = Math.max(1, Math.round(sh * cap));
    const f = document.createElement('canvas'); f.width = fw; f.height = fh;
    const g = f.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, sw, sh, 0, 0, fw, fh);
    f.m = matte(f, cfg.tol, Math.round(cfg.badge * k * cap)) || { x0: 0, y0: 0, x1: fw, y1: fh, axT: fw / 2, axL: fw / 2, hx: fw / 2, tw: 0 };
    out.push(f);
  }
  return out;
}
// صور منفصلة: نجد الفراغ الرأسي بين الشخصيات ليُقصّ عنده بدل التقسيم المتساوي (لا تُقصّ القدم الممتدة)
function splitX(img, n) {
  const W0 = img.naturalWidth, H0 = img.naturalHeight; if (n <= 1) return [[0, W0]];
  const w = 480, h = Math.max(8, Math.round(H0 * w / W0)), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  let p; try { p = g.getImageData(0, 0, w, h).data; } catch (e) { p = null; }
  const eqr = Array.from({ length: n }, (_, i) => [i * W0 / n, (i + 1) * W0 / n]); if (!p) return eqr;
  const B = bgColors(p, w, h), cnt = new Int32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let best = 1e9;
    for (const q of B) { const d = (Math.abs(p[i] - q[0]) + Math.abs(p[i + 1] - q[1]) + Math.abs(p[i + 2] - q[2])) / 3; if (d < best) best = d; }
    if (best > 40) cnt[x]++;
  }
  const lim = Math.max(1, h * .003), cuts = [0];
  for (let i = 1; i < n; i++) {
    const mid = i * w / n, hw = .3 * w / n, lo = Math.max(1, Math.round(mid - hw)), hi = Math.min(w - 2, Math.round(mid + hw));
    let bestLen = 0, bestC = mid, x = lo;
    while (x <= hi) { if (cnt[x] <= lim) { let y2 = x; while (y2 <= hi && cnt[y2] <= lim) y2++; if (y2 - x > bestLen) { bestLen = y2 - x; bestC = (x + y2 - 1) / 2; } x = y2; } else x++; }
    cuts.push(bestC);
  }
  cuts.push(w);
  return cuts.slice(0, -1).map((c0, i) => [c0 * W0 / w, cuts[i + 1] * W0 / w]);
}
function rescaleFrame(f, k) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(f.width * k)); c.height = Math.max(1, Math.round(f.height * k));
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(f, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height); c.m = measure(d.data, c.width, c.height); return c;
}
const parts = {};          // لوحة ← [{ im, n, name }] صور منفصلة (كل صورة فيها n وضعيات)
// ===== دمج عدة صور لنفس الوضعية: محاذاة بالقدمين، ثم وسيط حيث تتطابق والأنظف حيث تختلف =====
function bestShift(R, C, w, h) {
  const sc = (dx, dy, st) => { let m = 0; for (let y = 0; y < h; y += st) for (let x = 0; x < w; x += st) { const xx = x - dx, yy = y - dy, c = (xx >= 0 && yy >= 0 && xx < w && yy < h) ? C[yy * w + xx] : 0; if (R[y * w + x] !== c) m++; } return m; };
  let bx = 0, by = 0, bs = 1e18;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const v = sc(dx * 4, dy * 4, 4); if (v < bs) { bs = v; bx = dx * 4; by = dy * 4; } }
  const cx = bx, cy = by; bs = 1e18;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const v = sc(cx + dx, cy + dy, 2); if (v < bs) { bs = v; bx = cx + dx; by = cy + dy; } }
  return [bx, by];
}
function mergeFrames(fs, cfg) {
  const base = fs[0], w = base.width, h = base.height, bm = base.m, mode = $('sMerge').value, T = +$('rMergeT').value || 28;
  const axOf = m => (cfg.nm && !cfg.axl) ? m.axT : m.axL, cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
  const cg = cvs.getContext('2d', { willReadFrequently: true }); cg.imageSmoothingQuality = 'high';
  const bin = d => { const o = new Uint8Array(w * h); for (let k = 0; k < w * h; k++) o[k] = d[k * 4 + 3] > 128 ? 1 : 0; return o; };
  const D = [cg.getImageData(0, 0, w, h)]; cg.drawImage(base, 0, 0); D[0] = cg.getImageData(0, 0, w, h).data; const R = bin(D[0]);
  for (let j = 1; j < fs.length; j++) {
    const f = fs[j], m = f.m, sk = Math.max(.85, Math.min(1.15, (bm.y1 - bm.y0) / Math.max(1, m.y1 - m.y0)));
    const put = (dx, dy) => { cg.clearRect(0, 0, w, h); cg.drawImage(f, axOf(bm) - axOf(m) * sk + dx, bm.y1 - m.y1 * sk + dy, f.width * sk, f.height * sk); return cg.getImageData(0, 0, w, h).data; };
    let d = put(0, 0); const [sx, sy] = bestShift(R, bin(d), w, h); if (sx || sy) d = put(sx, sy); D.push(d);
  }
  const K = D.length, N = w * h, out = new Uint8ClampedArray(N * 4), med = new Uint8ClampedArray(N * 4), mx = new Uint8Array(N), score = new Float64Array(K), cntF = new Float64Array(K);
  const mid = a => { a.sort((x, y) => x - y); const n = a.length; return n & 1 ? a[n >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  const al = new Array(K), cr = [], cg2 = [], cb = [];
  for (let k = 0; k < N; k++) {
    const i = k * 4; for (let j = 0; j < K; j++) al[j] = D[j][i + 3];
    const ma = mid(al.slice()); if (ma < 8) continue;
    cr.length = cg2.length = cb.length = 0;
    for (let j = 0; j < K; j++) if (D[j][i + 3] >= 64) { cr.push(D[j][i]); cg2.push(D[j][i + 1]); cb.push(D[j][i + 2]); }
    if (!cr.length) for (let j = 0; j < K; j++) { cr.push(D[j][i]); cg2.push(D[j][i + 1]); cb.push(D[j][i + 2]); }
    const r = mid(cr), g = mid(cg2), b = mid(cb); med[i] = r; med[i + 1] = g; med[i + 2] = b; med[i + 3] = Math.round(ma);
    let m = 0;
    for (let j = 0; j < K; j++) { let dv; if (D[j][i + 3] < 64 || Math.abs(D[j][i + 3] - ma) > 100) dv = 255; else dv = Math.max(Math.abs(D[j][i] - r), Math.abs(D[j][i + 1] - g), Math.abs(D[j][i + 2] - b)); score[j] += dv; cntF[j]++; if (dv > m) m = dv; }
    mx[k] = m;
  }
  let best = 0, bv = 1e18; for (let j = 0; j < K; j++) { const v = score[j] / Math.max(1, cntF[j]); if (v < bv) { bv = v; best = j; } }
  for (let k = 0; k < N; k++) {
    const i = k * 4;
    if (mode === 'best') { for (let q = 0; q < 4; q++) out[i + q] = D[best][i + q]; continue; }
    if (!med[i + 3]) continue;
    if (mode === 'median' || mx[k] <= T) { for (let q = 0; q < 4; q++) out[i + q] = med[i + q]; }
    else for (let q = 0; q < 4; q++) out[i + q] = D[best][i + q];
  }
  cg.clearRect(0, 0, w, h); cg.putImageData(new ImageData(out, w, h), 0, 0);
  cvs.m = measure(out, w, h); if (!(cvs.m.y1 > cvs.m.y0 + 5)) { return base; } return cvs;
}
function cutParts(P, cfg) {
  const per = P.map(q => cutGrid(q.im, cfg, q.n, eq(1), splitX(q.im, q.n)));
  const mh = per.map(g => g.reduce((a, f) => a + (f.m.y1 - f.m.y0), 0) / g.length), tg = mh.slice().sort((a, b) => a - b)[mh.length >> 1] || 1;
  per.forEach((g, gi) => { const k = tg / (mh[gi] || tg); if (Math.abs(k - 1) > .01) per[gi] = g.map(f => rescaleFrame(f, k)); });   // نفس مقياس الشخصية بين الصور
  const order = [], map = new Map();
  P.forEach((q, i) => { if (!map.has(q.g)) { map.set(q.g, []); order.push(q.g); } map.get(q.g).push(per[i]); });
  const out = [];
  for (const key of order) {
    const G = map.get(key); if (G.length === 1) { out.push(...G[0]); continue; }
    const n = Math.min(...G.map(a => a.length)); for (let i = 0; i < n; i++) out.push(mergeFrames(G.map(a => a[i]), cfg));
  }
  return out;
}
function build(name) {
  const cfg = SH[name], P = parts[name];
  const out = P && P.length ? cutParts(P, cfg) : cutGrid(imgs[name], cfg, cfg.cols, cfg.rows);
  out.forEach(f => {
    const m = f.m; f.bb = { x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1 }; f.ax = (cfg.nm && !cfg.axl) ? m.axT : m.axL; f.hx = m.hx;
    headInfo(f); f.hx = f._hx; f.mouth = { x: f._hx, y: 0, w: 0, r: 0, on: !cfg.nm && !cfg.mm };
  });
  { const hr = out.map(f => f.bb.y1 - f._ht).sort((a, b) => a - b), med = hr[hr.length >> 1] || 1, mk = cfg.mk || { y: .125, w: .030 };
    out.forEach(f => { let h = f.bb.y1 - f._ht; if (h < .93 * med) h = med; f._hr = h; f.mouth.y = f._ht + h * mk.y; f.mouth.w = h * mk.w; if (f.mouth.on) refineMouth(f); }); }
  const hs = out.map(f => f.bb.y1 - f.bb.y0).sort((a, b) => a - b); out.ch = hs[hs.length >> 1] || 1;
  if (cfg.lift) out.forEach((f, i) => { f.lift = (cfg.lift[i] || 0) * out.ch; });
  frames[name] = out; loadMouths(name);
}
function trim(im) {
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  let d; try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return im; }
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    const i = (y * c.width + x) * 4;
    if (d[i] < 238 || d[i + 1] < 238 || d[i + 2] < 238) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return c;
  x0 = Math.max(0, x0 - 6); y0 = Math.max(0, y0 - 6); x1 = Math.min(c.width - 1, x1 + 6); y1 = Math.min(c.height - 1, y1 + 6);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o;
}
function loadImg(file) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); }); }

$('fBg').onchange = async e => {
  const files = [...e.target.files]; if (!files.length) return;
  bgs.length = 0; bgOrdered = false; bgBackup = null; $('bUndo').style.display = 'none';
  for (const f of files) { try { bgs.push(await loadImg(f)); } catch (_) {} }
  renderThumbs(); $('lBg').classList.add('ok'); buildMap(); msg(bgs.length < 15 ? 'تم تحميل ' + bgs.length + ' خلفية، والمطلوب 15' : '');
};
function buildMap() {
  const m = $('map'); m.innerHTML = '';
  SHOTS.forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'shot';
    const sel = document.createElement('select');
    for (let n = 1; n <= bgs.length; n++) { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); }
    sel.value = Math.min(s.bg, bgs.length) || 1; s.map = +sel.value; sel.onchange = () => { s.map = +sel.value; };
    row.innerHTML = '<span>' + (i + 1) + '. ' + s.h + '</span>'; row.appendChild(sel); m.appendChild(row);
  });
}
function mkPicker(parent, id, label, onFile, multi) {
  const l = document.createElement('label'); l.className = 'f'; l.textContent = label + ' ';
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (multi) inp.multiple = true;
  inp.onchange = async e => { const fs = [...e.target.files]; if (!fs.length) return; try { if (multi) { const ims = []; for (const f of fs) ims.push(await loadImg(f)); await onFile(ims, fs); } else await onFile(await loadImg(fs[0])); l.classList.add('ok'); } catch (_) { msg('تعذّر فتح الصورة'); } e.target.value = ''; };
  l.appendChild(inp); parent.appendChild(l);
}
for (const n of Object.keys(SH)) {
  mkPicker($('sheets'), n, 'لوحة ' + SH[n].label, async (ims, fs) => {
    msg('جاري إزالة الخلفية من اللوحة …'); await sleep(40);
    const md = $('sMode').value, sep = md === 'parts' || (md === 'auto' && ims.length > 1);
    imgs[n] = ims[0]; if (sep) parts[n] = ims.map((im, i) => ({ im, n: Math.max(1, +$('nPer').value || 2), name: fs[i].name, g: $('cSame').checked ? 1 : i + 1 })); else delete parts[n];
    build(n); renderParts(); msg(sep ? 'تم تجميع ' + ims.length + ' صور في لوحة ' + SH[n].label + ' (' + frames[n].length + ' وضعية' + ($('cSame').checked ? '، بعد دمج النسخ' : '') + ')' : ''); afterSheet(n);
  }, true);
  if (SH[n].g) {
    const row = document.createElement('div'); row.className = 'shot';
    row.innerHTML = '<span>' + SH[n].label + '</span><span>أعمدة <input type="number" id="gc_' + n + '" value="' + SH[n].g[0] + '" min="1" max="12" style="width:56px"> صفوف <input type="number" id="gr_' + n + '" value="' + SH[n].g[1] + '" min="1" max="12" style="width:56px"></span>';
    $('grids').appendChild(row);
    const apply = () => { const c = Math.max(1, +$('gc_' + n).value || 1), r = Math.max(1, +$('gr_' + n).value || 1); SH[n].cols = c; SH[n].rows = eq(r); if (imgs[n]) build(n); };
    $('gc_' + n).onchange = apply; $('gr_' + n).onchange = apply;
  }
}
