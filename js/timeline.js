// المخطط الزمني للمشهد الحالي: غلاف الصوت (فتح الفم) + حدود العبارات والنبرات + الإيماءات + الأدوات + مؤشر التشغيل
// للعرض فقط، ويُرسم فقط عندما يكون القسم مفتوحًا (لا كلفة وهو مغلق)
(function () {
  const box = $('dTl'), cvT = $('tl'), note = $('tlNote'); if (!box || !cvT) return;
  const g = cvT.getContext('2d'), W2 = cvT.width, H2 = cvT.height, L = { talk: 'كلام', point: 'إشارة', wave: 'تحية', joy: 'فرح', awe: 'دهشة', sad: 'حزن', think: 'تفكير', sit: 'جلوس', run: 'جري', walk: 'مشي', turn: 'التفات', pointup: 'إشارة لأعلى', back: 'ظهر' };
  const tAt = (E, sf) => { sf = Math.max(0, Math.min(1, sf)); let k = 0; const goal = sf * E.tot; while (k < E.n && E.cum[k + 1] < goal) k++; return k / 100; };   // زمن (ثانية) يبلغ فيه الكلام النسبة sf
  function draw() {
    if (!box.open) return;
    const s = SHOTS[idx]; let ab = null; try { ab = s && AB(s); } catch (_) {}
    g.clearRect(0, 0, W2, H2); g.fillStyle = '#0d1520'; g.fillRect(0, 0, W2, H2);
    if (!s) { note.textContent = ''; return; }
    if (!ab) { note.textContent = 'المشهد ' + (idx + 1) + ': لا يوجد ملف صوت مرتبط به، فتُحسب الإيماءات من طول النص.'; return; }
    const E = analyzeAudio(ab), T = E.dur, X = t => 10 + (W2 - 20) * t / T, y0 = H2 - 44, hh = H2 - 110;
    note.textContent = 'المشهد ' + (idx + 1) + ' — مدة الصوت ' + T.toFixed(1) + ' ث · الخط الذهبي: نهاية عبارة أو نبرة قوية تغيّر الإيماءة';
    g.fillStyle = '#2b4d6b'; g.beginPath(); g.moveTo(X(0), y0);   // فتح الفم
    for (let k = 0; k < E.n; k += 2) g.lineTo(X(k / 100), y0 - hh * E.op[k]);
    g.lineTo(X(T), y0); g.closePath(); g.fill();
    g.strokeStyle = '#f5a524'; g.setLineDash([8, 6]); g.lineWidth = 3;                           // أحداث تغيّر الإيماءة
    E.ev.forEach(t => { g.beginPath(); g.moveTo(X(t), 62); g.lineTo(X(t), y0); g.stroke(); }); g.setLineDash([]);
    const main = s.dur ? Math.max(.5, s.dur - (s.inT || 0) - (s.outT || 0)) : T, ft = f => tAt(E, f * main / T);
    g.font = '26px sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left';
    (s.acts || []).forEach(([f, md], i) => { const x = X(ft(f)); g.strokeStyle = '#3ddc97'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y0); g.stroke(); g.fillStyle = '#3ddc97'; g.fillText(L[md] || md, x + 5, (i % 2) * 30); });
    (s.props || []).forEach((p, i) => { const a = X(ft(p.f0)), b = X(ft(Math.min(1, p.f1))); g.fillStyle = 'rgba(180,120,255,.55)'; g.fillRect(a, y0 + 6, Math.max(4, b - a), 12); g.fillStyle = '#c9a6ff'; g.fillText(p.cap || p.id, a, y0 + 14); });
    g.fillStyle = '#7e8da1'; for (let t = 0; t <= T; t += 1) { g.fillRect(X(t), H2 - 8, 2, 8); }
    if (playing && s === SHOTS[idx] && s._a0 != null) { const p = Math.max(0, Math.min(T, audioPos(s))); g.fillStyle = '#ff5d5d'; g.fillRect(X(p) - 2, 0, 4, y0 + 4); }   // مؤشر التشغيل
  }
  box.addEventListener('toggle', draw); setInterval(draw, 120);
})();
