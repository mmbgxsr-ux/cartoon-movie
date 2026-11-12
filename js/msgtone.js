// تلوين رسالة الحالة حسب نوعها (تعليمة، نجاح، خطأ) بدل مظهر الخطأ الدائم. تغيير شكلي فقط: لا يمس النص ولا يغيّر أي سلوك.
try {
  (function () {
    const el = document.getElementById('msg'); if (!el) return;
    const ERR = /تعذّر|تعذر|خطأ|فشل|غير صالح|غير مدعوم|لا يوجد|اكتب|رُفض|رفض|مشكلة|ناقص|كبير جدًا/, OK = /^تم|✅|جاهز|اكتمل|نجح/;
    const tone = () => { const t = el.textContent || ''; el.dataset.tone = !t ? '' : ERR.test(t) ? 'err' : OK.test(t) ? 'ok' : 'info'; };
    new MutationObserver(tone).observe(el, { childList: true, characterData: true, subtree: true }); tone();
  })();
} catch (e) { /* شكلي فقط */ }
