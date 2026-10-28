// تأثير الهولجرام على الشخصية: يُطبَّق على المشاهد التي فيها holo=true (يُضبط من المحرر)
// يعمل بالمزج على اللوحة نفسها (بلا فلاتر)، فيظهر أيضًا في الفيديو المُصدَّر
// القناع واللون والخطوط تُحسب بنصف الدقة (أسرع بـ4 مرات)، ثم تُكبَّر فوق الإطار الكامل
(function () {
  const H_ = {}, w = W >> 1, h = H >> 1;
  const mk = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return { c, g: c.getContext('2d') }; };
  function init() {
    H_.A = mk(W, H); H_.B = mk(w, h); H_.M = mk(w, h); H_.T = mk(w, h); H_.N = mk(w, h);
    const l = document.createElement('canvas'); l.width = 2; l.height = 2; const g = l.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); g.fillStyle = '#8a8a8a'; g.fillRect(0, 1, 2, 1);
    H_.P = H_.T.g.createPattern(l, 'repeat');
  }
  const base = drawChar;
  drawChar = function (s, tt) {
    if (!(s.holo && $('cHolo') && $('cHolo').checked) || greenOn()) return base(s, tt);
    if (!H_.A) init();
    const a = H_.A.g, b = H_.B.g, m = H_.M.g, t = H_.T.g, n = H_.N.g;
    a.globalCompositeOperation = 'copy'; a.drawImage(cv, 0, 0);                                        // الخلفية قبل الشخصية
    b.globalCompositeOperation = 'copy'; b.drawImage(cv, 0, 0, w, h);
    base(s, tt);                                                                                         // ترسم الشخصية فوقها
    m.globalAlpha = 1; m.globalCompositeOperation = 'copy'; m.drawImage(cv, 0, 0, w, h);                // قناع الشخصية = الفرق بين الإطارين
    t.globalAlpha = 1; t.globalCompositeOperation = 'copy'; t.drawImage(H_.M.c, 0, 0);                 // نسخة بنصف الدقة للون (قبل تحويلها إلى قناع)
    m.globalCompositeOperation = 'difference'; m.drawImage(H_.B.c, 0, 0);
    m.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) m.drawImage(H_.M.c, 0, 0);      // تشبيع: أي فرق يصبح أبيض
    t.globalCompositeOperation = 'saturation'; t.fillStyle = '#808080'; t.fillRect(0, 0, w, h);         // الشخصية بلون سماوي
    t.globalCompositeOperation = 'multiply'; t.fillStyle = 'rgb(70,235,255)'; t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'lighter'; t.globalAlpha = .55; t.drawImage(H_.T.c, 0, 0);
    t.globalAlpha = 1; t.globalCompositeOperation = 'multiply'; t.save(); t.translate(0, Math.floor(clock * 20) % 2); t.fillStyle = H_.P; t.fillRect(0, -4, w, h + 4); t.restore();   // خطوط المسح تتحرك
    t.globalCompositeOperation = 'multiply'; t.drawImage(H_.M.c, 0, 0);                                // لا يبقى إلا موضع الشخصية
    t.globalCompositeOperation = 'lighter'; t.globalAlpha = .22; t.drawImage(H_.T.c, -w * .012, -h * .012, w * 1.024, h * 1.024);   // توهج (بنصف الدقة بدل رسمة إضافية بالدقة الكاملة)
    n.globalAlpha = 1; n.globalCompositeOperation = 'source-over'; n.fillStyle = '#fff'; n.fillRect(0, 0, w, h);   // تعتيم الخلفية خلف الشخصية جزئيًا لتبدو شفافة
    n.globalCompositeOperation = 'difference'; n.globalAlpha = .65; n.drawImage(H_.M.c, 0, 0);
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(H_.A.c, 0, 0);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(H_.N.c, 0, 0, W, H);
    const fl = .8 + .2 * Math.sin(clock * 23) * Math.sin(clock * 7.3) + (Math.random() < .05 ? -.25 : 0);   // وميض خفيف
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(.35, Math.min(1, fl)); ctx.drawImage(H_.T.c, 0, 0, W, H);
    if (Math.random() < .05) { const y = Math.random() * (h - 25) | 0, hh = 7 + Math.random() * 15 | 0, dx = (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 16) | 0; ctx.globalAlpha = .6; ctx.drawImage(H_.T.c, 0, y, w, hh, dx, y * 2, W, hh * 2); }   // خلل لحظي
    ctx.restore();
  };
})();
