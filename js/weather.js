// ===== طقس وإضاءة لكل مشهد =====
// الطقس (s.wx): مطر، عاصفة رعدية، ثلج، ضباب: جزيئات متحركة فوق المشهد + صبغة جوّ خفيفة.
// الإضاءة (s.lt): فجر، غروب، ليل، غائم: ضرب لوني + توهج + تعتيم الزوايا. كلاهما يتلاشى عند الانتقال بين المشاهد.
// الصيغة: [ضرب r,g,b,α] [توهج r,g,b,α] [تعتيم الزوايا α]
const LT_VEC = {
  dawn: [255, 222, 228, .34, 255, 190, 150, .10, .10],
  sunset: [255, 186, 138, .40, 255, 135, 60, .12, .22],
  night: [58, 80, 150, .62, 0, 0, 0, 0, .42],
  overcast: [172, 182, 192, .34, 0, 0, 0, 0, .12]
};
const WX_VEC = {   // صبغة الجوّ المرافقة للطقس
  rain: [150, 165, 185, .18, 0, 0, 0, 0, .06],
  storm: [105, 120, 148, .34, 0, 0, 0, 0, .20],
  snow: [0, 0, 0, 0, 220, 230, 245, .07, 0],
  fog: [0, 0, 0, 0, 226, 232, 238, .16, 0]
};
const ZERO9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
const lerpV = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
function drawVec(v) {
  if (!v || greenOn()) return;
  ctx.save();
  if (v[3] > .004) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(' + [v[0], v[1], v[2]].map(Math.round) + ',' + v[3].toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  if (v[7] > .004) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(' + [v[4], v[5], v[6]].map(Math.round) + ',' + v[7].toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  if (v[8] > .004) {
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(W / 2, H * .5, H * .35, W / 2, H * .5, H * .95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + v[8].toFixed(3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
// يُستدعى بعد التدرج اللوني: s المشهد الحالي، nx التالي (أو null)، k درجة الانتقال 0..1
function lightOv(s, nx, k) {
  const L = o => (o && LT_VEC[o.lt]) || ZERO9, X = o => (o && WX_VEC[o.wx]) || ZERO9;
  drawVec(lerpV(L(s), L(nx), k)); drawVec(lerpV(X(s), X(nx), k));
}

// الجزيئات: تظهر تدريجيًا في بداية المشهد وتخفت قبل نهايته إن كان الطقس التالي مختلفًا
function wxAmount(s, tt, i) {
  let a = 1; const prev = SHOTS[i - 1], next = SHOTS[i + 1], X = Math.min(.9, s.outT);
  if (!prev || prev.wx !== s.wx) a = Math.min(a, Math.min(1, tt / .9));
  if (next && next.wx !== s.wx && tt > s.dur - X) a = Math.min(a, 1 - ease((tt - (s.dur - X)) / X));
  return Math.max(0, a);
}
function drawWx(s, tt, i) {
  if (!s.wx || greenOn()) return; const a = wxAmount(s, tt, i); if (a <= 0) return;
  ctx.save();
  if (s.wx === 'rain' || s.wx === 'storm') {
    const n = s.wx === 'storm' ? 230 : 130; ctx.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const d = rn(k, 5), sp = 760 + d * 620, len = 14 + d * 22, y = (rn(k, 2) * (H + 80) + clock * sp) % (H + 80) - 40, x = (rn(k, 1) * (W + 320) - y * .22) % (W + 320);
      ctx.strokeStyle = 'rgba(205,220,240,' + ((.14 + .3 * d) * a).toFixed(3) + ')'; ctx.lineWidth = .7 + d * 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * .22, y + len); ctx.stroke();
    }
    if (s.wx === 'storm') {   // برق: ومضتان قصيرتان كل 11 ثانية تقريبًا وبشدة محدودة (لا وميض سريع متكرر)
      const ph = (clock + 3) % 11; let f = 0;
      if (ph < 1) f = Math.exp(-ph * 7) + (ph > .22 ? .8 * Math.exp(-(ph - .22) * 12) : 0);
      if (f > .01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(215,225,255,' + (.24 * Math.min(1, f) * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    }
  } else if (s.wx === 'snow') {
    for (let k = 0; k < 110; k++) {
      const d = rn(k, 5), y = (rn(k, 1) * H + clock * (26 + d * 60)) % H, x = rn(k, 3) * W + Math.sin(clock * (.5 + d * .5) + k) * (14 + d * 20);
      ctx.fillStyle = 'rgba(255,255,255,' + ((.45 + .4 * d) * a).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, 1 + d * 2.6, 0, 7); ctx.fill();
    }
  } else if (s.wx === 'fog') {
    for (let k = 0; k < 5; k++) {
      const x = ((clock * (7 + k * 4) + k * W * .36) % (W + 900)) - 450, y = H * (.38 + k * .12);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .32);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 460); g.addColorStop(0, 'rgba(236,241,246,' + (.34 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(236,241,246,0)');
      ctx.fillStyle = g; ctx.fillRect(-460, -460, 920, 920); ctx.restore();
    }
  }
  ctx.restore();
}
