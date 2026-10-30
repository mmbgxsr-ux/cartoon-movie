// حماية التشغيل والتصدير من الخروج والأخطاء: تأكيد قبل إغلاق الصفحة أثناء التصدير/التسجيل،
// إعادة طلب إبقاء الشاشة مضاءة عند العودة للتبويب، وشبكة أمان تُعيد الحالة سليمة إن وقع خطأ أثناء التشغيل.
// يُحمَّل بعد export.js لأنه يستخدم EXPORTING وplaying وrec وwlOn وstopAll.
(function () {
  const recording = () => !!(rec && rec.state === 'recording');
  const busyNow = () => EXPORTING || (playing && recording());

  // 1) إغلاق الصفحة أو تحديثها أثناء التصدير/التسجيل يضيّع العمل: نطلب تأكيد المتصفح، وفي غير ذلك لا نزعج المستخدم
  addEventListener('beforeunload', e => {
    if (!busyNow()) return;
    e.preventDefault(); e.returnValue = '';
    return '';
  });

  // 2) المتصفح يحرّر قفل الشاشة عند إخفاء التبويب، فنعيد طلبه عند العودة
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (playing || EXPORTING) wlOn(); return; }
    if (EXPORTING) msg('التصدير مستمر، لكن أبقِ هذا التبويب مفتوحًا ومرئيًا حتى ينتهي');
    else if (playing && recording()) msg('التسجيل يتأثر عند إخفاء التبويب، ارجع إلى هذه الصفحة حتى ينتهي الفيلم');
  });

  // 3) خطأ غير متوقع أثناء التشغيل: لا نترك الواجهة عالقة على «إيقاف»
  let lastErr = -Infinity;   // لا 0، وإلا تُهمَل الأخطاء في أول ثانية بعد تحميل الصفحة
  const onFail = e => {
    if (!playing && !EXPORTING) return;
    const now = performance.now(); if (now - lastErr < 1000) return; lastErr = now;
    const m = e && (e.message || (e.reason && e.reason.message) || e.reason) || '';
    console.error('guard:', e);
    if (EXPORTING) { EXP_CANCEL = true; msg('حدث خطأ أثناء التصدير، جاري الإيقاف' + (m ? ': ' + m : '')); return; }   // exportExact يعيد الحالة في finally
    try { stopAll(); } catch (_) {}
    msg('توقّف التشغيل بسبب خطأ' + (m ? ': ' + m : '') + '. يمكنك المحاولة من جديد');
  };
  addEventListener('error', onFail);
  addEventListener('unhandledrejection', onFail);
})();
