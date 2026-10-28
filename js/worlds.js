// المرحلة 3: شريط العصر والسنة على الشاشة + معالج البدء السريع وقوالب العوالم
(function () {
  const PLAN_K = 'cartoonPlan1';
  const say = t => { const m = document.getElementById('msg'); if (m) m.textContent = t; };
  // ----- 1) شريط العصر والسنة (أعلى يمين الشاشة): يظهر بتلاشٍ ناعم في أول المشهد وآخره -----
  const _chip0 = drawChip;
  drawChip = function (s) {
    _chip0(s);
    const on = !$('cEra') || $('cEra').checked, label = [s.era, s.year].filter(Boolean).join('  •  ');
    if (!on || !label) return;
    const a = Math.max(0, Math.min(1, (t - s.inT) / .6, (s.dur - s.outT * .5 - t) / .6)); if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 24px system-ui'; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    const w = Math.min(520, ctx.measureText(label).width + 56), x = W - 24 - w, y = 20;
    ctx.fillStyle = 'rgba(92,52,12,.82)'; ctx.beginPath(); ctx.roundRect(x, y, w, 46, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffe9b8'; ctx.fillText(label, x + w / 2, y + 31, w - 28); ctx.restore();
  };

  // ----- 2) قوالب العوالم: هيكل درس جاهز يملؤه المعلّم (✏️ = مكان تعديل المعلّم) -----
  const E = '✏️ ';
  const WORLDS = {
    time: { name: 'آلة الزمن (تاريخ)', desc: 'يدخل الطالب آلة الزمن ويعيش الحدث بنفسه', subject: 'تاريخ', scenes: [
      { h: 'آلة الزمن', bgd: 'غرفة آلة الزمن بأجهزة وأضواء', acts: [[0, 'wave'], [.6, 'talk']], text: 'أهلًا بيك يا بطل {grade}! أنا مرشدك، وعندنا النهارده رحلة مش عادية. هندخل آلة الزمن ونسافر إلى {era} عشان نعيش درس «{title}» بنفسنا. اربط الحزام وإحنا ماشيين!' },
      { h: 'وصلنا', bgd: 'مكان الأحداث كما كان قبل الحدث', acts: [[0, 'awe'], [.6, 'talk']], yr: 1, text: 'وصلنا! إحنا دلوقتي في {era}. بص حواليك كده. ' + E + 'اكتب هنا وصف المكان والوضع قبل الأحداث.' },
      { h: 'شخصية الدرس', bgd: 'مكان الشخصية الرئيسية', acts: [[0, 'point'], [.6, 'talk']], text: E + 'اكتب هنا تعريفًا بالشخصية أو الفكرة الأساسية في «{title}».' },
      { h: 'الحدث الرئيسي', bgd: 'موقع الحدث الأهم', acts: [[0, 'think'], [.6, 'talk']], yr: 1, text: E + 'اكتب هنا الحدث الرئيسي بالترتيب، مع السبب والنتيجة.' },
      { h: 'بطاقة وسؤال', bgd: 'خلفية هادئة للمراجعة', acts: [[0, 'point'], [.6, 'talk']], props: [{ id: 'card1', cap: 'ملخص الحدث', f0: .1, f1: 1 }], text: 'سؤال سريع قبل ما نكمل: ' + E + 'اكتب هنا سؤالًا عن الحدث؟ فكّر لحظة قبل ما أقولك الإجابة.' },
      { h: 'النتائج', bgd: 'المكان بعد الحدث', acts: [[0, 'joy'], [.6, 'talk']], text: E + 'اكتب هنا نتائج الحدث وأثره على الناس.' },
      { h: 'العودة', bgd: 'غرفة آلة الزمن عند العودة', acts: [[0, 'wave'], [.6, 'talk']], out: 'turnaway', text: 'وخلصت رحلتنا! النهارده اتعلمنا إيه عن «{title}»؟ ' + E + 'لخّص أهم نقطتين. نشوفك في رحلة جاية يا بطل!' }] },
    mini: { name: 'رحلة مصغّرة (علوم)', desc: 'نصغّر ونروح جوّه الشيء اللي بندرسه', subject: 'علوم', scenes: [
      { h: 'جهاز التصغير', bgd: 'معمل علمي بجهاز تصغير', acts: [[0, 'wave'], [.6, 'talk']], text: 'أهلًا يا عالم {grade}! النهارده هنصغّر نفسنا ونروح جوّه «{title}» بنفسنا. اضغط الزر وإحنا ماشيين!' },
      { h: 'الدخول', bgd: 'مدخل العالم المصغّر', acts: [[0, 'awe'], [.6, 'talk']], text: 'يا سلام! شايف الشكل من جوّه؟ ' + E + 'اكتب هنا أول ما نشوفه ونلاحظه.' },
      { h: 'التركيب', bgd: 'الأجزاء الداخلية بألوان واضحة', acts: [[0, 'point'], [.6, 'talk']], props: [{ id: 'card1', cap: 'أجزاء ' + '«{title}»', f0: .1, f1: 1 }], text: E + 'اكتب هنا الأجزاء الأساسية ووظيفة كل جزء.' },
      { h: 'كيف يعمل', bgd: 'العملية في أثناء حدوثها', acts: [[0, 'think'], [.6, 'talk']], text: E + 'اكتب هنا خطوات العملية بالترتيب بكلام بسيط.' },
      { h: 'سؤال وتجربة', bgd: 'ركن التجارب', acts: [[0, 'point'], [.6, 'talk']], text: 'تعال نجرّب: ' + E + 'اكتب هنا سؤالًا أو تجربة بسيطة، وفكّر لحظة قبل الإجابة.' },
      { h: 'الرجوع', bgd: 'المعمل عند العودة', acts: [[0, 'joy'], [.6, 'talk']], out: 'turnaway', text: 'رجعنا بالسلامة! اتعلمنا النهارده إيه عن «{title}»؟ ' + E + 'لخّص أهم نقطتين.' }] },
    travel: { name: 'رحلة سفر (جغرافيا)', desc: 'نسافر بين الأماكن وعلى الخريطة', subject: 'جغرافيا', scenes: [
      { h: 'بداية الرحلة', bgd: 'مطار أو ميناء بخريطة كبيرة', acts: [[0, 'wave'], [.6, 'talk']], text: 'أهلًا يا رحّال {grade}! النهارده رحلتنا عن «{title}». شنطتك جاهزة؟ يلا نسافر!' },
      { h: 'الخريطة', bgd: 'ورق بردي بخريطة', acts: [[0, 'point'], [.6, 'talk']], props: [{ id: 'card1', cap: 'خريطة «{title}»', f0: .1, f1: 1 }], text: E + 'اكتب هنا موقع المكان على الخريطة وحدوده.' },
      { h: 'المحطة الأولى', bgd: 'المنطقة الأولى', acts: [[0, 'awe'], [.6, 'talk']], text: E + 'اكتب هنا وصف المحطة الأولى: الطقس والتضاريس.' },
      { h: 'المحطة الثانية', bgd: 'المنطقة الثانية', acts: [[0, 'talk']], text: E + 'اكتب هنا وصف المحطة الثانية والمقارنة بالأولى.' },
      { h: 'سؤال المسافر', bgd: 'استراحة في الطريق', acts: [[0, 'think'], [.6, 'talk']], text: 'سؤال في الطريق: ' + E + 'اكتب هنا سؤالًا، وفكّر لحظة قبل الإجابة.' },
      { h: 'نهاية الرحلة', bgd: 'العودة للمطار', acts: [[0, 'wave'], [.6, 'talk']], out: 'turnaway', text: 'وصلنا بالسلامة! اتعلمنا إيه عن «{title}»؟ ' + E + 'لخّص أهم نقطتين. مع السلامة!' }] },
    puzzle: { name: 'باب الألغاز (رياضيات)', desc: 'كل باب يتفتح بحل مسألة', subject: 'رياضيات', scenes: [
      { h: 'القلعة', bgd: 'بوابة قلعة مقفولة بألغاز', acts: [[0, 'wave'], [.6, 'talk']], text: 'أهلًا يا بطل {grade}! البوابة دي مقفولة، ومش هتتفتح غير بحل ألغاز «{title}». جاهز؟' },
      { h: 'اللغز الأول', bgd: 'الباب الأول', acts: [[0, 'point'], [.6, 'talk']], props: [{ id: 'card1', cap: 'اللغز الأول', f0: .1, f1: 1 }], text: E + 'اكتب هنا القاعدة ومثالًا محلولًا بسيطًا.' },
      { h: 'فكّر', bgd: 'الباب الأول مغلق', acts: [[0, 'think'], [.6, 'talk']], text: 'دورك دلوقتي: ' + E + 'اكتب هنا مسألة، وفكّر لحظة قبل ما نحلها سوا.' },
      { h: 'الحل', bgd: 'الباب الأول يتفتح', acts: [[0, 'joy'], [.6, 'talk']], text: E + 'اكتب هنا خطوات الحل بالترتيب.' },
      { h: 'اللغز الثاني', bgd: 'الباب الثاني', acts: [[0, 'point'], [.6, 'talk']], props: [{ id: 'card2', cap: 'اللغز الثاني', f0: .1, f1: 1 }], text: E + 'اكتب هنا لغزًا أصعب قليلًا مع التلميح.' },
      { h: 'الكنز', bgd: 'غرفة الكنز', acts: [[0, 'joy'], [.6, 'talk']], out: 'turnaway', text: 'فتحنا الباب وعدينا! اتعلمنا النهارده إيه عن «{title}»؟ ' + E + 'لخّص القاعدة.' }] },
    text: { name: 'النص يتكلم (لغة عربية)', desc: 'الشخصيات تحكي النص وتشرحه', subject: 'لغة عربية', scenes: [
      { h: 'مقدمة', bgd: 'مكتبة دافئة بكتب', acts: [[0, 'wave'], [.6, 'talk']], text: 'أهلًا يا قارئ {grade}! النهارده هنقرا سوا «{title}»، ونفهمه من جوّه. اسمع كويس!' },
      { h: 'النص', bgd: 'مشهد من أحداث النص', acts: [[0, 'talk']], props: [{ id: 'card1', cap: '«{title}»', f0: .1, f1: 1 }], text: E + 'اكتب هنا الفقرة الأولى من النص بتشكيل واضح.' },
      { h: 'المفردات', bgd: 'سبورة المفردات', acts: [[0, 'point'], [.6, 'talk']], text: E + 'اكتب هنا معاني الكلمات الصعبة بالمثال.' },
      { h: 'الفهم', bgd: 'ركن الأسئلة', acts: [[0, 'think'], [.6, 'talk']], text: 'سؤال فهم: ' + E + 'اكتب هنا سؤالًا عن النص، وفكّر لحظة قبل الإجابة.' },
      { h: 'الخلاصة', bgd: 'المكتبة عند الختام', acts: [[0, 'joy'], [.6, 'talk']], out: 'turnaway', text: 'برافو عليك! اتعلمنا إيه من «{title}»؟ ' + E + 'لخّص الفكرة الرئيسية.' }] }
  };
  const GRADES = ['الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي', 'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'];
  const fill = (s, v) => s.replace(/\{(title|grade|era|year)\}/g, (_, k) => v[k] || (k === 'era' ? 'الزمن القديم' : ''));
  // دالة خالصة قابلة للاختبار: تبني مشاهد الدرس وخطة الخلفيات من القالب
  function buildLesson(worldId, o) {
    const w = WORLDS[worldId]; if (!w) return null;
    const v = { title: (o.title || 'الدرس').trim(), grade: (o.grade || ''), era: (o.era || '').trim(), year: (o.year || '').trim() };
    const scenes = w.scenes.map((x, i) => {
      const s = { h: fill(x.h, v), bg: i + 1, text: fill(x.text, v), acts: x.acts.map(a => a.slice()), props: (x.props || []).map(p => ({ id: p.id, cap: fill(p.cap || '', v), f0: p.f0, f1: p.f1 })), noWalk: i > 0 };
      if (x.out) s.out = x.out; if (v.era) s.era = v.era; if (x.yr && v.year) s.year = v.year; return s;
    });
    return { scenes, plan: w.scenes.map((x, i) => (i + 1) + '. ' + fill(x.bgd, v)) };
  }
  window.WORLDS = WORLDS; window.buildLesson = buildLesson;

  // ----- 3) واجهة تبويب «البدء السريع» -----
  const box = document.getElementById('wizBox'); if (!box) return;
  const el = (t, p, ch) => { const e = document.createElement(t); if (p) Object.assign(e, p); (ch || []).forEach(x => e.appendChild(x)); return e; };
  const inp = 'background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px';
  const subj = el('select'), grade = el('select'), world = el('select'), title = el('input', { placeholder: 'عنوان الدرس (مثال: فتح مصر)', style: inp + ';flex:1;min-width:160px' }),
    era = el('input', { placeholder: 'العصر (مثال: العصر الإسلامي)', style: inp + ';flex:1;min-width:140px' }), year = el('input', { placeholder: 'السنة (مثال: 639م)', style: inp + ';width:120px' }), desc = el('div', { style: 'font-size:12px;color:#8ea0b5' }), plan = el('div', { style: 'white-space:pre-line;font-size:13px;background:#1b2635;border-radius:8px;padding:8px;display:none' });
  const subjects = [...new Set(Object.values(WORLDS).map(w => w.subject))];
  subjects.forEach(x => subj.appendChild(el('option', { value: x, textContent: x }))); GRADES.forEach(x => grade.appendChild(el('option', { value: x, textContent: x }))); grade.value = GRADES[3];
  const worldsOf = () => Object.keys(WORLDS).filter(k => WORLDS[k].subject === subj.value);
  const fillWorlds = () => { world.innerHTML = ''; worldsOf().forEach(k => world.appendChild(el('option', { value: k, textContent: WORLDS[k].name }))); desc.textContent = world.value ? WORLDS[world.value].desc : ''; };
  subj.onchange = fillWorlds; world.onchange = () => { desc.textContent = WORLDS[world.value].desc; }; fillWorlds();
  const showPlan = txt => { plan.style.display = txt ? 'block' : 'none'; plan.textContent = txt ? 'ارفع الخلفيات بهذا الترتيب (تبويب الخلفيات):\n' + txt : ''; };
  try { showPlan(Store.getItem(PLAN_K) || ''); } catch (_) {}
  const go = el('button', { type: 'button', textContent: '✨ إنشاء هيكل الدرس', style: 'background:#245a36', onclick() {
    if (!title.value.trim()) { say('اكتب عنوان الدرس أولًا'); return; }
    if (!confirm('سيُستبدل محتوى المحرر الحالي بهيكل الدرس الجديد. متابعة؟')) return;
    const r = buildLesson(world.value, { title: title.value, grade: grade.value, era: era.value, year: year.value });
    try { Store.setItem('cartoonScenes1', JSON.stringify(r.scenes)); Store.removeItem('cartoonLastScene1'); Store.setItem(PLAN_K, r.plan.join('\n')); } catch (_) { say('تعذّر الحفظ'); return; }
    say('تم إنشاء ' + r.scenes.length + ' مشاهد، جاري إعادة التحميل …'); setTimeout(() => Store.reload(), 500); } });
  box.append(el('div', { className: 'row' }, [el('span', { textContent: 'المادة' }), subj, el('span', { textContent: 'الصف' }), grade]), el('div', { className: 'row' }, [el('span', { textContent: 'العالم' }), world]), desc,
    el('div', { className: 'row' }, [title]), el('div', { className: 'row' }, [era, year]), el('div', { className: 'row' }, [go]), plan);
})();
