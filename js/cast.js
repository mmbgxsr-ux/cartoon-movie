// الطاقم: شخصيات متعددة (نسخ بأزياء وغطاء رأس مختلفين من الشخصية الأساسية) + مشاهد الحوار
const CAST_K = 'cartoonCast1';
const CAST_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr', 'Orus', 'Leda'];
const CAST_ACC = [['', 'بدون غطاء'], ['turban', 'عمامة'], ['shemagh', 'غترة وعقال'], ['cap', 'طاقية'], ['helmet', 'خوذة'], ['crown', 'تاج']];
const CAST_GUIDE = { id: 'guide', name: 'المرشد', top: '', bottom: '', acc: '', accColor: '#f3ead2', scale: 1, voice: '' };
const CAST_PRESET = [
  CAST_GUIDE,
  { id: 'amr', name: 'عمرو بن العاص', top: '#6b4a2b', bottom: '#3b2f22', acc: 'turban', accColor: '#f3ead2', scale: 1, voice: 'Fenrir' },
  { id: 'omar', name: 'عمر بن الخطاب', top: '#e9e2d0', bottom: '#d8cfb8', acc: 'turban', accColor: '#ffffff', scale: 1.03, voice: 'Charon' },
  { id: 'muq', name: 'المقوقس', top: '#6d1f33', bottom: '#2f2540', acc: 'cap', accColor: '#7a1f3a', scale: .98, voice: 'Orus' },
  { id: 'sol', name: 'الجندي', top: '#4d5560', bottom: '#3a3f47', acc: 'helmet', accColor: '#9aa3ad', scale: 1, voice: 'Puck' }
];
let CAST = (() => { try { const a = JSON.parse(Store.getItem(CAST_K) || 'null'); if (Array.isArray(a) && a.length && a.every(x => x && x.id)) return a; } catch (_) {} return [Object.assign({}, CAST_GUIDE)]; })();
if (!CAST.some(c => c.id === 'guide')) CAST.unshift(Object.assign({}, CAST_GUIDE));
const castSave = () => { try { Store.setItem(CAST_K, JSON.stringify(CAST)); } catch (_) {} };
const castById = id => CAST.find(c => c.id === id) || CAST[0];
const castByName = n => { n = (n || '').trim(); if (!n) return null; return CAST.find(c => c.name === n) || CAST.find(c => c.name.includes(n) || n.includes(c.name)) || null; };
const voiceOf = s => castById(s.spk || 'guide').voice || '';
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
  if (c.acc) castAcc(g, f, c);
  return k;
}
const CVAR = new Map();
const castSig = c => [c.top, c.bottom, c.acc, c.accColor].join('|');
const castPlain = c => !c.top && !c.bottom && !c.acc;
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
  const spk = s.spk && list.includes(s.spk) ? s.spk : list[0], sx = xs[list.indexOf(spk)];
  const m = Math.min(.999, Math.max(0, mOf(s, tt)));
  list.forEach((id, i) => {
    if (id === spk) return; const c = castById(id);
    withCast(c, () => {
      const fr = frames.talk; if (!fr) return; const sv = { open: M.open, wide: M.wide, round: M.round, act: M.act }; M.open = M.wide = M.round = M.act = 0;
      const br = Math.sin(clock * 2.1 + i * 1.7);
      blit('talk', 15 % fr.length, xs[i], c.scale || 1, 0, 1, { sy: 1 + .008 * br, sx: 1 - .004 * br, rot: (sx > xs[i] ? 1 : -1) * .01 + Math.sin(clock * .8 + i) * .003, dx: Math.sin(clock * .55 + i * 2) * 2.4, mouth: 1 });
      Object.assign(M, sv);
    });
  });
  const c = castById(spk);
  withCast(c, () => { const os = UI.size; UI.size = () => os() * (c.scale || 1); try { drawStand(s, m, sx, 1); } finally { UI.size = os; } });
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
  function render() {
    box.innerHTML = ''; previews.length = 0;
    CAST.forEach((c, i) => {
      const cv = el('canvas', { width: 90, height: 150, style: 'width:60px;height:100px;background:#1b2635;border-radius:8px;flex:none' }); previews.push({ cv, c });
      const nm = el('input', { value: c.name, placeholder: 'اسم الشخصية', style: inp + ';flex:1;min-width:110px', oninput() { c.name = this.value; castSave(); } });
      const colr = (lab, key) => el('label', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:13px' }, [document.createTextNode(lab), el('input', { type: 'color', value: c[key] || '#444444', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { c[key] = this.value; save(); } }), el('button', { type: 'button', textContent: '↺', title: 'الأصلي', style: 'padding:2px 7px;background:#3a4656;font-size:12px', onclick() { c[key] = ''; render(); castSave(); } })]);
      const acc = el('select'); CAST_ACC.forEach(([v, t]) => acc.appendChild(el('option', { value: v, textContent: t }))); acc.value = c.acc || ''; acc.onchange = () => { c.acc = acc.value; save(); };
      const accC = el('input', { type: 'color', value: c.accColor || '#f3ead2', style: 'width:34px;height:26px;padding:0;border:0;background:none', onchange() { c.accColor = this.value; save(); } });
      const vo = el('select'); vo.appendChild(el('option', { value: '', textContent: 'صوت المشهد الافتراضي' })); CAST_VOICES.forEach(v => vo.appendChild(el('option', { value: v, textContent: 'صوت ' + v }))); vo.value = c.voice || ''; vo.onchange = () => { c.voice = vo.value; castSave(); };
      const sc = el('input', { type: 'range', min: .85, max: 1.15, step: .01, value: c.scale || 1, style: 'width:90px', oninput() { c.scale = +this.value; castSave(); } });
      const del = c.id === 'guide' ? el('span', { textContent: '(الأساسية)', style: 'color:#8ea0b5;font-size:12px' }) : el('button', { type: 'button', textContent: '✕', style: 'padding:4px 10px;background:#5a3a3a', onclick() { if (confirm('حذف ' + c.name + '؟')) { CAST.splice(i, 1); castSave(); render(); } } });
      box.appendChild(el('div', { className: 'row', style: 'align-items:center;border-bottom:1px solid #243142;padding-bottom:8px' }, [cv, el('div', { style: 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0' }, [
        el('div', { className: 'row', style: 'margin:0' }, [nm, del]),
        el('div', { className: 'row', style: 'margin:0' }, [colr('القميص', 'top'), colr('البنطال', 'bottom')]),
        el('div', { className: 'row', style: 'margin:0' }, [acc, accC, el('span', { textContent: 'الحجم' }), sc]),
        el('div', { className: 'row', style: 'margin:0' }, [vo])])]));
    });
    previews.forEach(p => paint(p.cv, p.c));
  }
  document.getElementById('castAdd').onclick = () => { const n = CAST.length; CAST.push({ id: 'c' + Date.now().toString(36), name: 'شخصية ' + n, top: '#3d5a80', bottom: '#2b2f3a', acc: '', accColor: '#f3ead2', scale: 1, voice: '' }); castSave(); render(); };
  document.getElementById('castPreset').onclick = () => { if (CAST.length > 1 && !confirm('استبدال الطاقم الحالي بطاقم «فتح مصر»؟')) return; CAST = CAST_PRESET.map(c => Object.assign({}, c)); castSave(); render(); };
  render(); let tries = 0; const iv = setInterval(() => { if (frames.talk || ++tries > 40) { clearInterval(iv); previews.forEach(p => paint(p.cv, p.c)); } }, 500);
})();
