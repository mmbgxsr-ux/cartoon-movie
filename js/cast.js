// الطاقم: شخصيات متعددة (نسخ بأزياء وغطاء رأس مختلفين من الشخصية الأساسية) + مشاهد الحوار
const CAST_K = 'cartoonCast1';
const CAST_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr', 'Orus', 'Leda'];
const CAST_ACC = [['', 'بدون غطاء'], ['turban', 'عمامة'], ['shemagh', 'غترة وعقال'], ['cap', 'طاقية'], ['helmet', 'خوذة'], ['crown', 'تاج']];
const CAST_LAYERS = [['', 'بدون طبقة'], ['cloak', 'عباءة / برنس'], ['armor', 'درع صدر'], ['sash', 'وشاح مائل']];
const CAST_POS = { l: .16, c: .42, r: .68 };
const CAST_POS_OPTS = [['', 'تلقائي'], ['l', 'يسار'], ['c', 'وسط'], ['r', 'يمين']];
const CAST_GUIDE = { id: 'guide', name: 'المرشد', top: '', bottom: '', acc: '', accColor: '#f3ead2', scale: 1, voice: '' };
const CAST_PRESET = [
  CAST_GUIDE,
  { id: 'amr', name: 'عمرو بن العاص', top: '#6b4a2b', bottom: '#3b2f22', acc: 'turban', accColor: '#f3ead2', scale: 1, voice: 'Fenrir', alt: [{ name: 'زي المعركة', top: '#4a3a2a', bottom: '#3b2f22', acc: 'helmet', accColor: '#9aa3ad', layer: 'armor', layerColor: '#9aa3ad' }, { name: 'بالعباءة', top: '#6b4a2b', bottom: '#3b2f22', acc: 'turban', accColor: '#f3ead2', layer: 'cloak', layerColor: '#7a5a2a' }] },
  { id: 'omar', name: 'عمر بن الخطاب', top: '#e9e2d0', bottom: '#d8cfb8', acc: 'turban', accColor: '#ffffff', scale: 1.03, voice: 'Charon', alt: [{ name: 'بالعباءة', top: '#e9e2d0', bottom: '#d8cfb8', acc: 'turban', accColor: '#ffffff', layer: 'cloak', layerColor: '#6b5a3a' }] },
  { id: 'muq', name: 'المقوقس', top: '#6d1f33', bottom: '#2f2540', acc: 'cap', accColor: '#7a1f3a', scale: .98, voice: 'Orus' },
  { id: 'sol', name: 'الجندي', top: '#4d5560', bottom: '#3a3f47', acc: 'helmet', accColor: '#9aa3ad', scale: 1, voice: 'Puck' }
];
let CAST = (() => { try { const a = JSON.parse(Store.getItem(CAST_K) || 'null'); if (Array.isArray(a) && a.length && a.every(x => x && x.id)) return a; } catch (_) {} return [Object.assign({}, CAST_GUIDE)]; })();
if (!CAST.some(c => c.id === 'guide')) CAST.unshift(Object.assign({}, CAST_GUIDE));
// اتجاه النظر: الصور الأصلية تنظر لجهة واحدة (الافتراضي يمين). المستمعون يلتفتون نحو المتحدث، والمتحدث نحو أقرب مستمع، بقلب الصورة أفقيًا
let FLIP = false;
const FACE_K = 'cartoonFace1';
let FACE_BASE = (() => { try { return Store.getItem(FACE_K) === 'l' ? -1 : 1; } catch (_) { return 1; } })();
const faceDir = c => (c.face === 'l' ? -1 : c.face === 'r' ? 1 : FACE_BASE);
const castSave = () => { try { Store.setItem(CAST_K, JSON.stringify(CAST)); } catch (_) {} };
const castById = id => CAST.find(c => c.id === id) || CAST[0];
// مطابقة الاسم: تطابق تام، ثم الكلمة الأولى (عمر ≠ عمرو)، ثم أي كلمة كاملة في الاسم، ثم احتواء يُقبل فقط إن كان وحيدًا
const castByName = n => {
  n = (n || '').trim(); if (!n) return null; const w = c => c.name.trim().split(/\s+/);
  const hit = CAST.find(c => c.name === n) || CAST.find(c => w(c)[0] === n) || CAST.find(c => w(c).includes(n));
  if (hit) return hit; const f = CAST.filter(c => c.name.includes(n) || n.includes(c.name)); return f.length === 1 ? f[0] : null;
};
const voiceOf = s => castById(s.spk || 'guide').voice || '';
// المتحدث الحالي في مشهد حوار: من أوقات الأسطر (lineT) أو بالتناسب مع طول النص إن لم يتوفر
function speakerAt(s, tt) {
  if (!s.lines || !s.lines.length) return s.spk || null;
  let ta = tt - s.inT; try { if (typeof envOf === 'function' && envOf(s)) ta = audioPos(s); } catch (_) {}
  let T = s.lineT; if (!T || T.length !== s.lines.length) { const tot = s.lines.reduce((q, L) => q + L.t.length, 0) || 1, D = Math.max(1, s.main || 1); let a = 0; T = s.lines.map(L => { const o = { id: L.spk, a, b: a + L.t.length / tot * D }; a = o.b; return o; }); }
  let id = T[T.length - 1].id; for (const x of T) if (ta < x.b + .15) { id = x.id; break; } return id;
}
const castList = s => { const a = (s.cast || []).filter(id => CAST.some(c => c.id === id)); if (s.spk && CAST.some(c => c.id === s.spk) && !a.includes(s.spk)) a.push(s.spk); return a.length ? a : ['guide']; };

// ----- تلوين الملابس (الأسود فقط، أسفل الذقن) وإضافة غطاء الرأس على نسخة من كل إطار -----
const hex3 = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function castAcc(g, f, c) {
  const h = f.bb.y1 - f._ht, cx = f._hx, y0 = f._ht, col = c.accColor || '#f3ead2', lw = Math.max(1, h * .0028);
  const shade = (hexc, k) => { const r = hex3(hexc) || [240, 230, 210]; return 'rgb(' + r.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',') + ')'; };
  g.save(); g.translate(cx, y0); g.lineJoin = 'round'; g.lineCap = 'round';
  const grad = (y, r, a, b) => { const q = g.createLinearGradient(0, y - r, 0, y + r); q.addColorStop(0, shade(col, a)); q.addColorStop(1, shade(col, b)); return q; };
  const ell = (x, y, rx, ry, fill, stroke) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  if (c.acc === 'turban') {
    const rx = h * .074, ry = h * .042, cy = h * .006;
    ell(0, cy, rx, ry, grad(cy, ry, 1.05, .78), 'rgba(30,20,10,.75)');
    g.strokeStyle = 'rgba(70,55,35,.5)'; g.lineWidth = lw; for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * rx * .12, cy + i * ry * .32, rx * .9, ry * .5, 0, .12 * Math.PI, .88 * Math.PI); g.stroke(); }
    ell(0, cy - ry * .5, rx * .62, ry * .62, grad(cy - ry * .55, ry * .55, 1.08, .9), 'rgba(30,20,10,.5)');
  } else if (c.acc === 'cap') {
    const rx = h * .052, ry = h * .02, cy = h * .006; ell(0, cy, rx, ry, grad(cy, ry, 1.05, .8), 'rgba(30,20,10,.7)');
  } else if (c.acc === 'shemagh') {
    const rx = h * .066, ry = h * .034, cy = h * .014;
    g.fillStyle = grad(cy, ry, 1.05, .85); g.strokeStyle = 'rgba(30,20,10,.7)'; g.lineWidth = lw;
    g.beginPath(); g.ellipse(0, cy, rx, ry, 0, Math.PI, 0); g.lineTo(rx * 1.08, h * .15); g.lineTo(rx * .78, h * .16); g.lineTo(rx * .72, h * .05); g.lineTo(-rx * .72, h * .05); g.lineTo(-rx * .78, h * .16); g.lineTo(-rx * 1.08, h * .15); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#15110d'; g.lineWidth = Math.max(2, h * .008); g.beginPath(); g.ellipse(0, h * .02, rx * .86, ry * .7, 0, 0, Math.PI * 2); g.stroke();
  } else if (c.acc === 'helmet') {
    const rx = h * .062, ry = h * .042, cy = h * .03;
    g.fillStyle = grad(cy, ry, 1.12, .62); g.strokeStyle = 'rgba(20,20,25,.8)'; g.lineWidth = lw;
    g.beginPath(); g.ellipse(0, cy, rx, ry, 0, Math.PI, 0); g.lineTo(rx * 1.04, cy + h * .006); g.lineTo(-rx * 1.04, cy + h * .006); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shade(col, .55); g.fillRect(-rx * 1.04, cy, rx * 2.08, h * .008); g.fillStyle = shade(col, .8); g.fillRect(-rx * .06, cy - ry * 1.02, rx * .12, ry * .7);
  } else if (c.acc === 'crown') {
    const rx = h * .052, by = h * .022, th = h * .038; g.fillStyle = grad(by, th, 1.15, .75); g.strokeStyle = 'rgba(70,45,5,.9)'; g.lineWidth = lw;
    g.beginPath(); g.moveTo(-rx, by); g.lineTo(-rx, by - th * .6); g.lineTo(-rx * .5, by - th * .25); g.lineTo(0, by - th); g.lineTo(rx * .5, by - th * .25); g.lineTo(rx, by - th * .6); g.lineTo(rx, by); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
// طبقات الملابس: تُرسم بنسب من طول الجسم (h) فتناسب كل الإيماءات
function castLayer(g, f, c) {
  const h = f.bb.y1 - f._ht, cx = f._hx, y0 = f._ht, col = c.layerColor || '#8a6a3a', lw = Math.max(1, h * .003);
  const shade = (hexc, k) => { const r = hex3(hexc) || [138, 106, 58]; return 'rgb(' + r.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',') + ')'; };
  const vg = (ya, yb, a, b) => { const q = g.createLinearGradient(0, ya, 0, yb); q.addColorStop(0, shade(col, a)); q.addColorStop(1, shade(col, b)); return q; };
  g.save(); g.translate(cx, y0); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = 'rgba(25,18,10,.75)'; g.lineWidth = lw;
  if (c.layer === 'cloak') {            // عباءة: كتفان واسعان ينسدلان خلف الجسم حتى الركبة
    g.fillStyle = vg(h * .17, h * .78, 1.08, .72);
    g.beginPath(); g.moveTo(-h * .075, h * .165); g.quadraticCurveTo(0, h * .145, h * .075, h * .165);
    g.lineTo(h * .13, h * .24); g.quadraticCurveTo(h * .165, h * .5, h * .15, h * .78); g.lineTo(h * .1, h * .8);
    g.quadraticCurveTo(h * .105, h * .5, h * .07, h * .26); g.lineTo(-h * .07, h * .26);
    g.quadraticCurveTo(-h * .105, h * .5, -h * .1, h * .8); g.lineTo(-h * .15, h * .78); g.quadraticCurveTo(-h * .165, h * .5, -h * .13, h * .24); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = shade(col, 1.3); g.lineWidth = Math.max(2, h * .006); g.beginPath(); g.moveTo(-h * .075, h * .168); g.quadraticCurveTo(0, h * .148, h * .075, h * .168); g.stroke();
  } else if (c.layer === 'armor') {     // درع صدر مع حزام
    g.fillStyle = vg(h * .2, h * .46, 1.2, .6);
    g.beginPath(); g.moveTo(-h * .062, h * .195); g.lineTo(h * .062, h * .195); g.lineTo(h * .072, h * .33); g.lineTo(h * .055, h * .45); g.lineTo(-h * .055, h * .45); g.lineTo(-h * .072, h * .33); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(25,18,10,.5)'; for (let i = 1; i < 4; i++) { const yy = h * (.195 + i * .06); g.beginPath(); g.moveTo(-h * .066, yy); g.lineTo(h * .066, yy); g.stroke(); }
    g.fillStyle = shade(col, .5); g.fillRect(-h * .06, h * .45, h * .12, h * .018);
  } else if (c.layer === 'sash') {      // وشاح مائل من الكتف إلى الخصر
    g.fillStyle = vg(h * .18, h * .5, 1.1, .8);
    g.beginPath(); g.moveTo(-h * .06, h * .185); g.lineTo(-h * .03, h * .175); g.lineTo(h * .07, h * .46); g.lineTo(h * .035, h * .48); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
function castFrame(f, c) {
  const k = document.createElement('canvas'); k.width = f.width; k.height = f.height;
  const g = k.getContext('2d', { willReadFrequently: true }); g.drawImage(f, 0, 0);
  ['bb', 'ax', 'hx', '_hx', '_ht', '_hr', 'm', 'lift', 'mouth'].forEach(p => { k[p] = f[p]; });
  if (!f.bb || f._ht == null) return k;
  const T = hex3(c.top), B = hex3(c.bottom);
  if (T || B) {
    const Wd = k.width, Hh = f.bb.y1 - f._ht, y0 = Math.max(0, Math.floor(f._ht + Hh * .175)), y1 = Math.min(k.height, Math.floor(f._ht + Hh * .93)), waist = f._ht + Hh * .52;
    const id = g.getImageData(0, y0, Wd, y1 - y0), d = id.data;
    for (let y = y0; y < y1; y++) {
      const col = y < waist ? T : B; if (!col) continue;
      for (let x = 0, i = (y - y0) * Wd * 4; x < Wd; x++, i += 4) {
        if (d[i + 3] < 10) continue; const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (mx < 110 && mx - mn < 40) { const q = .55 + .45 * Math.min(1, Math.max(0, (mx - 6) / 80)); d[i] = col[0] * q; d[i + 1] = col[1] * q; d[i + 2] = col[2] * q; }
      }
    }
    g.putImageData(id, 0, y0);
  }
  if (c.layer) castLayer(g, f, c);
  if (c.acc) castAcc(g, f, c);
  return k;
}
const CVAR = new Map();
const castSig = c => [c.top, c.bottom, c.acc, c.accColor, c.layer, c.layerColor].join('|');
const castPlain = c => !c.top && !c.bottom && !c.acc && !c.layer;
// الزي الذي يلبسه الشخص في هذا المشهد: الأساسي أو أحد الأزياء البديلة (c.alt) حسب s.wear
const wearOf = (s, id) => { const c = castById(id), k = s && s.wear && s.wear[id]; const a = k != null && c.alt && c.alt[k]; return a ? Object.assign({}, c, a, { id: c.id, name: c.name, voice: c.voice, scale: c.scale }) : c; };
function castArr(c, name, src) {
  if (castPlain(c) || !src || !src.length || !src[0].bb) return src;
  const sig = castSig(c); let m = CVAR.get(sig); if (!m) { m = {}; CVAR.set(sig, m); if (CVAR.size > 12) CVAR.delete(CVAR.keys().next().value); }
  let e = m[name]; if (!e || e.src !== src) { const arr = src.map(f => castFrame(f, c)); arr.ch = src.ch; e = m[name] = { src, arr }; }
  return e.arr;
}
function withCast(c, fn) {
  const keys = Object.keys(frames), saved = {}; keys.forEach(k => { saved[k] = frames[k]; frames[k] = castArr(c, k, saved[k]); });
  try { return fn(); } finally { keys.forEach(k => { frames[k] = saved[k]; }); }
}

// ----- الرسم: المتحدث يتحرك بالكامل، والباقون يستمعون بوضعية هادئة وفم مغلق -----
const _drawChar0 = drawChar;
drawChar = function (s, tt) {
  const list = castList(s); if (list.length < 2 && list[0] === 'guide') return _drawChar0(s, tt);
  CUR_BG = s.map || s.bg || 1; CUR_AMB = ambOf(CUR_BG); GROUND = GRG[CUR_BG] || 625; GSC = GRS[CUR_BG] || 1; ARR = tt;
  const n = list.length, xs = n === 1 ? [W * ((+($('rX') ? $('rX').value : 0) || 0.2))] : n === 2 ? [W * .24, W * .62] : n === 3 ? [W * .16, W * .42, W * .68] : [W * .12, W * .32, W * .52, W * .72];
  list.forEach((id, i) => { const p = s.pos && CAST_POS[s.pos[id]]; if (p != null) xs[i] = W * p; });
  const _sp = speakerAt(s, tt) || s.spk, spk = _sp && list.includes(_sp) ? _sp : list[0], sx = xs[list.indexOf(spk)];
  const m = Math.min(.999, Math.max(0, mOf(s, tt)));
  const face = !s.noFace && list.length > 1, flipFor = (id, fx, tx) => face && Math.sign(tx - fx) * faceDir(castById(id)) < 0;
  const others = list.map((id, i) => xs[i]).filter((x, i) => list[i] !== spk), near = others.length ? others.reduce((a, b) => Math.abs(b - sx) < Math.abs(a - sx) ? b : a) : sx;
  list.forEach((id, i) => {
    if (id === spk) return; const c = wearOf(s, id);
    withCast(c, () => {
      const fr = frames.talk; if (!fr) return; const sv = { open: M.open, wide: M.wide, round: M.round, act: M.act }; M.open = M.wide = M.round = M.act = 0;
      const br = Math.sin(clock * 2.1 + i * 1.7);
      blit('talk', 15 % fr.length, xs[i], c.scale || 1, 0, 1, { flip: flipFor(id, xs[i], sx), sy: 1 + .008 * br, sx: 1 - .004 * br, rot: (sx > xs[i] ? 1 : -1) * .01 + Math.sin(clock * .8 + i) * .003, dx: Math.sin(clock * .55 + i * 2) * 2.4, mouth: 1 });
      Object.assign(M, sv);
    });
  });
  const c = wearOf(s, spk);
  withCast(c, () => { const os = UI.size; UI.size = () => os() * (c.scale || 1); FLIP = flipFor(spk, sx, near); try { drawStand(s, m, sx, 1); } finally { UI.size = os; FLIP = false; } });
};

// ----- واجهة تبويب «الطاقم» -----
(function () {
  const box = document.getElementById('castList'); if (!box) return;
  const el = (t, p, ch) => { const e = document.createElement(t); if (p) Object.assign(e, p); (ch || []).forEach(x => e.appendChild(x)); return e; };
  const inp = 'background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px';
  const previews = [];
  function paint(cv, c) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    const fr = frames.talk; if (!fr || !fr.length) return; const arr = castArr(c, 'talk', fr), f = arr[15 % arr.length]; if (!f || !f.bb) return;
    const b = f.bb, sw = b.x1 - b.x0, sh = b.y1 - b.y0, k = Math.min(cv.width / sw, cv.height / sh) * .96;
    g.drawImage(f, b.x0, b.y0, sw, sh, (cv.width - sw * k) / 2, cv.height - sh * k, sw * k, sh * k);
  }
  function save() { castSave(); previews.forEach(p => paint(p.cv, p.c)); }
  const colO = (o, lab, key) => el('label', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:13px' }, [document.createTextNode(lab), el('input', { type: 'color', value: o[key] || '#444444', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { o[key] = this.value; save(); } }), el('button', { type: 'button', textContent: '↺', title: 'الأصلي', style: 'padding:2px 7px;background:#3a4656;font-size:12px', onclick() { o[key] = ''; render(); castSave(); } })]);
  const layerRow = o => { const s1 = el('select'); CAST_LAYERS.forEach(([v, t]) => s1.appendChild(el('option', { value: v, textContent: t }))); s1.value = o.layer || ''; s1.onchange = () => { o.layer = s1.value; save(); };
    return el('div', { className: 'row', style: 'margin:0' }, [el('span', { textContent: 'ملابس إضافية' }), s1, el('input', { type: 'color', value: o.layerColor || '#8a6a3a', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { o.layerColor = this.value; save(); } })]); };
  const altBox = (c, a, j) => {
    const acc2 = el('select'); CAST_ACC.forEach(([v, t]) => acc2.appendChild(el('option', { value: v, textContent: t }))); acc2.value = a.acc || ''; acc2.onchange = () => { a.acc = acc2.value; save(); };
    return el('div', { style: 'border:1px solid #2f3d50;border-radius:8px;padding:6px;margin-top:4px;display:flex;flex-direction:column;gap:6px' }, [
      el('div', { className: 'row', style: 'margin:0' }, [el('input', { value: a.name || '', placeholder: 'اسم الزي', style: inp + ';flex:1;min-width:100px', oninput() { a.name = this.value; castSave(); } }), el('button', { type: 'button', textContent: '✕', style: 'padding:4px 10px;background:#5a3a3a', onclick() { c.alt.splice(j, 1); castSave(); render(); } })]),
      el('div', { className: 'row', style: 'margin:0' }, [colO(a, 'القميص', 'top'), colO(a, 'البنطال', 'bottom')]),
      el('div', { className: 'row', style: 'margin:0' }, [acc2, el('input', { type: 'color', value: a.accColor || '#f3ead2', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { a.accColor = this.value; save(); } })]),
      layerRow(a)]);
  };
  function render() {
    box.innerHTML = ''; previews.length = 0;
    CAST.forEach((c, i) => {
      const cv = el('canvas', { width: 90, height: 150, style: 'width:60px;height:100px;background:#1b2635;border-radius:8px;flex:none' }); previews.push({ cv, c });
      const nm = el('input', { value: c.name, placeholder: 'اسم الشخصية', style: inp + ';flex:1;min-width:110px', oninput() { c.name = this.value; castSave(); } });
      const colr = (lab, key) => el('label', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:13px' }, [document.createTextNode(lab), el('input', { type: 'color', value: c[key] || '#444444', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { c[key] = this.value; save(); } }), el('button', { type: 'button', textContent: '↺', title: 'الأصلي', style: 'padding:2px 7px;background:#3a4656;font-size:12px', onclick() { c[key] = ''; render(); castSave(); } })]);
      const acc = el('select'); CAST_ACC.forEach(([v, t]) => acc.appendChild(el('option', { value: v, textContent: t }))); acc.value = c.acc || ''; acc.onchange = () => { c.acc = acc.value; save(); };
      const accC = el('input', { type: 'color', value: c.accColor || '#f3ead2', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { c.accColor = this.value; save(); } });
      const fc = el('select'); [['', 'اتجاه النظر: الافتراضي'], ['r', 'صورته تنظر لليمين'], ['l', 'صورته تنظر لليسار']].forEach(([v, t]) => fc.appendChild(el('option', { value: v, textContent: t }))); fc.value = c.face || ''; fc.onchange = () => { c.face = fc.value; castSave(); };
      const vo = el('select'); vo.appendChild(el('option', { value: '', textContent: 'صوت المشهد الافتراضي' })); CAST_VOICES.forEach(v => vo.appendChild(el('option', { value: v, textContent: 'صوت ' + v }))); vo.value = c.voice || ''; vo.onchange = () => { c.voice = vo.value; castSave(); };
      const sc = el('input', { type: 'range', min: .85, max: 1.15, step: .01, value: c.scale || 1, style: 'width:90px', oninput() { c.scale = +this.value; castSave(); } });
      const del = c.id === 'guide' ? el('span', { textContent: '(الأساسية)', style: 'color:#8ea0b5;font-size:12px' }) : el('button', { type: 'button', textContent: '✕', style: 'padding:4px 10px;background:#5a3a3a', onclick() { if (confirm('حذف ' + c.name + '؟')) { CAST.splice(i, 1); castSave(); render(); } } });
      box.appendChild(el('div', { className: 'row', style: 'align-items:center;border-bottom:1px solid #243142;padding-bottom:8px' }, [cv, el('div', { style: 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0' }, [
        el('div', { className: 'row', style: 'margin:0' }, [nm, del]),
        el('div', { className: 'row', style: 'margin:0' }, [colr('القميص', 'top'), colr('البنطال', 'bottom')]),
        el('div', { className: 'row', style: 'margin:0' }, [acc, accC, el('span', { textContent: 'الحجم' }), sc]),
        layerRow(c),
        el('div', { className: 'row', style: 'margin:0' }, [vo, fc]),
        el('div', { style: 'font-size:12px;color:#8ea0b5' }, [document.createTextNode('الأزياء البديلة (تُختار لكل مشهد من المحرر)')]),
        ...(c.alt || []).map((a, j) => altBox(c, a, j)),
        el('button', { type: 'button', textContent: '➕ زي بديل', style: 'align-self:flex-start;padding:4px 10px;background:#3a4656', onclick() { (c.alt = c.alt || []).push({ name: 'زي ' + (c.alt.length + 1), top: c.top || '', bottom: c.bottom || '', acc: c.acc || '', accColor: c.accColor || '#f3ead2', layer: '', layerColor: '#8a6a3a' }); castSave(); render(); } })])]));
    });
    previews.forEach(p => paint(p.cv, p.c));
  }
  { const fs = el('select'); [['r', 'تنظر لليمين'], ['l', 'تنظر لليسار']].forEach(([v, t]) => fs.appendChild(el('option', { value: v, textContent: t }))); fs.value = FACE_BASE < 0 ? 'l' : 'r';
    fs.onchange = () => { FACE_BASE = fs.value === 'l' ? -1 : 1; try { Store.setItem(FACE_K, fs.value); } catch (_) {} };
    box.before(el('div', { className: 'row' }, [el('span', { textContent: 'الشخصية الأصلية في الصور:' }), fs, el('span', { textContent: '(تلتفت الشخصيات نحو بعضها تلقائيًا في مشاهد الحوار)', style: 'font-size:12px;color:#8ea0b5' })])); }
  document.getElementById('castAdd').onclick = () => { const n = CAST.length; CAST.push({ id: 'c' + Date.now().toString(36), name: 'شخصية ' + n, top: '#3d5a80', bottom: '#2b2f3a', acc: '', accColor: '#f3ead2', scale: 1, voice: '' }); castSave(); render(); };
  document.getElementById('castPreset').onclick = () => { if (CAST.length > 1 && !confirm('استبدال الطاقم الحالي بطاقم «فتح مصر»؟')) return; CAST = CAST_PRESET.map(c => Object.assign({}, c)); castSave(); render(); };
  window.castRender = render; render(); let tries = 0; const iv = setInterval(() => { if (frames.talk || ++tries > 40) { clearInterval(iv); previews.forEach(p => paint(p.cv, p.c)); } }, 500);
})();
