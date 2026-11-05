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

// ===== Gemini: نداء موحّد مع إعادة المحاولة (كان الكود مكررًا في audio وbackgrounds وmouth) =====
const GEM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/', GEM_VISION = 'gemini-2.5-flash';
// يرسل الطلب، ويعيد المحاولة عند 429 و5xx. يعيد JSON الرد، ويرمي رسالة عربية واضحة عند الفشل.
async function geminiCall(model, key, body, o) {
  const { tries = 3, wait = 9000, onWait } = o || {}; let lastSt = 0;
  for (let a = 0; a < tries; a++) {
    const r = await fetch(GEM_URL + model + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    if (r.status === 429 || r.status >= 500) { lastSt = r.status; if (a < tries - 1) { onWait && onWait(a + 2); await new Promise(res => setTimeout(res, wait * (a + 1))); } continue; }
    let j = null; try { j = await r.json(); } catch (_) { dbg(_); }
    if (!r.ok) throw new Error(gemErr(r.status, j && j.error && j.error.message));
    return j || {};
  }
  throw new Error(gemErr(lastSt));
}
// أجزاء الرد، مع رسالة مفهومة إن لم يصل مرشّح (حجب أو رد فارغ) بدل TypeError غامض
function geminiParts(j) {
  const c = j && j.candidates && j.candidates[0], p = c && c.content && c.content.parts;
  if (Array.isArray(p) && p.length) return p;
  const why = (j && j.promptFeedback && j.promptFeedback.blockReason) || (c && c.finishReason) || '';
  throw new Error('لم يصل رد من Gemini' + (why ? ' (' + why + ')' : ''));
}
function geminiJson(j) {
  const t = geminiParts(j).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
  try { return JSON.parse(t); } catch (_) { throw new Error('رد Gemini ليس JSON صالحًا'); }
}

// ===== التخزين: تنبيه عند فشل الحفظ أو قرب امتلاء المساحة =====
(function () {
  let bar = null, dismissedAt = -1, lastPct = 0;   // dismissedAt: نسبة الامتلاء عند إخفاء تنبيه المساحة بالنقر
  const warn = (t, kind) => {
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'storeWarn'; bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99;background:#7a3b00;color:#fff;padding:8px 14px;font-size:14px;text-align:center;cursor:pointer';
      bar.title = 'اضغط للإخفاء';
      bar.onclick = () => { bar.style.display = 'none'; if (bar.dataset.kind === 'usage') dismissedAt = lastPct; };
      document.body.appendChild(bar);
    }
    bar.dataset.kind = kind || 'error'; bar.textContent = t; bar.style.display = '';
  };
  Store.onError = e => {
    const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')));
    warn(full ? 'مساحة التخزين في المتصفح ممتلئة، لم يُحفظ آخر تعديل. احفظ المشروع كملف 💾 ثم احذف ما لا تحتاجه'
              : 'تعذّر الحفظ في المتصفح، احفظ المشروع كملف 💾 حتى لا تفقد عملك', 'error');
  };
  const LIMIT = 0.8;
  const check = () => Store.usage().then(u => {
    if (!u || !u.quota) return;
    const r = u.usage / u.quota, pct = Math.round(r * 100); lastPct = pct;
    if (r >= LIMIT) {
      // إن أخفاه المستخدم لا نعيده إلا إذا زاد الامتلاء 5 نقاط أخرى (كان يعود كل دقيقة ولا يمكن إسكاته)
      if (dismissedAt < 0 || pct >= dismissedAt + 5) { dismissedAt = -1; warn('مساحة التخزين اقتربت من الامتلاء (' + pct + '%). احفظ المشروع كملف 💾 لتأمين عملك', 'usage'); }
    } else { dismissedAt = -1; if (bar && bar.dataset.kind === 'usage') bar.style.display = 'none'; }   // عادت المساحة: يختفي التنبيه تلقائيًا
  }).catch(dbg);
  check(); setInterval(check, 60000);
})();
