// سلامة البيانات: رسائل أخطاء مفهومة (Gemini والشبكة والتخزين) ومراقبة مساحة التخزين
// يُحمَّل بعد core.js مباشرة، لذا تتوفر الدوال التالية لباقي الوحدات: gemErr, errText

// تحويل رمز حالة Gemini إلى رسالة عربية واضحة (والنص الأصلي للخطأ يُستخدم لتمييز المفتاح الخاطئ)
function gemErr(status, raw) {
  const t = String(raw || '');
  if (status === 400 && /api key|API_KEY/i.test(t)) return 'مفتاح Gemini غير صحيح. راجع المفتاح في تبويب الصوت';
  if (status === 401 || status === 403) return 'المفتاح غير مصرّح له أو غير مفعّل لخدمة Gemini. تأكد من صلاحياته';
  if (status === 404) return 'النموذج المختار غير متاح. غيّره من الإعدادات';
  if (status === 429) return 'تجاوزت حد الطلبات أو نفدت الحصة. انتظر قليلًا ثم أعد المحاولة، وإن تكرر فالحصة اليومية انتهت';
  if (status >= 500) return 'خدمة Gemini مشغولة مؤقتًا. أعد المحاولة بعد قليل';
  return t || ('خطأ غير معروف (' + status + ')');
}
// نص مناسب لأي استثناء، مع تمييز انقطاع الإنترنت
function errText(e) {
  const m = String((e && e.message) || e || '');
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(m)) return 'تعذّر الاتصال بالإنترنت';
  return m;
}

// ===== التخزين: تنبيه عند فشل الحفظ أو قرب امتلاء المساحة =====
(function () {
  let bar = null;
  const warn = t => {
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'storeWarn'; bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99;background:#7a3b00;color:#fff;padding:8px 14px;font-size:14px;text-align:center;cursor:pointer';
      bar.title = 'اضغط للإخفاء'; bar.onclick = () => { bar.style.display = 'none'; };
      document.body.appendChild(bar);
    }
    bar.textContent = t; bar.style.display = '';
  };
  Store.onError = e => {
    const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')));
    warn(full ? 'مساحة التخزين في المتصفح ممتلئة، لم يُحفظ آخر تعديل. احفظ المشروع كملف 💾 ثم احذف ما لا تحتاجه'
              : 'تعذّر الحفظ في المتصفح، احفظ المشروع كملف 💾 حتى لا تفقد عملك');
  };
  const LIMIT = 0.8;
  const check = () => Store.usage().then(u => {
    if (!u || !u.quota) return;
    const r = u.usage / u.quota;
    if (r >= LIMIT) warn('مساحة التخزين اقتربت من الامتلاء (' + Math.round(r * 100) + '%). احفظ المشروع كملف 💾 لتأمين عملك');
    else if (bar && bar.dataset.low) bar.style.display = 'none';
  }).catch(() => {});
  check(); setInterval(check, 60000);
})();
