// إمكانية الوصول: أسماء للحقول بلا تسمية، وصول لوحة المفاتيح لفهرس المشاهد، وإخفاء مؤشر التحميل
(function () {
  const clean = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const isCtl = n => n.nodeType === 1 && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName);
  // اسم الحقل = أقرب نص يسبقه في نفس الصف (span أو نص مجاور)، وإلا placeholder
  function nameFor(el) {
    for (let p = el.previousSibling; p; p = p.previousSibling) {
      if (p.nodeType === 3) { const t = clean(p.textContent); if (t) return t; continue; }
      if (p.nodeType !== 1 || isCtl(p) || p.querySelector('input,select,textarea,button')) break;
      const t = clean(p.textContent); if (t) return t;
    }
    return clean(el.getAttribute('placeholder'));
  }
  function label() {
    document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(el => {
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.title || el.closest('label')) return;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')) return;
      const n = nameFor(el); if (n) el.setAttribute('aria-label', n);
    });
    // عناصر النقر في فهرس المشاهد: تصير أزرارًا تعمل بلوحة المفاتيح
    document.querySelectorAll('#idxList .shot:not([role])').forEach(r => {
      r.setAttribute('role', 'button'); r.tabIndex = 0;
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } });
    });
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; label(); }, 150); };
  // يراقب إضافة عناصر جديدة فقط (تجاهل تغيّر النصوص كل إطار أثناء التشغيل)
  new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) later(); }).observe(document.body, { childList: true, subtree: true });
  label();
  const boot = document.getElementById('boot'); if (boot) boot.remove();
})();
