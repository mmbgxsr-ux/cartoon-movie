// لحظات القرار: يتوقف الفيلم عند مشهد فيه سؤال (الحقل q) ويعرض الخيارات، ثم يكمل بعد الإجابة
(function () {
  let box = null;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  window.hideQ = function () { QWAIT = false; QPOSE = null; if (box) { box.remove(); box = null; } };
  window.showQ = function (s) {
    hideQ(); QWAIT = true; QPOSE = { mode: 'think', t0: clock };   // أثناء السؤال تفكّر الشخصية بدل أن تواصل الإيماءات
    const q = s.q; box = el('div', 'qBox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite');
    const card = el('div', 'qCard'); card.appendChild(el('div', 'qHead', 'لحظة قرار'));
    card.appendChild(el('div', 'qText', q.q));
    const list = el('div', 'qOpts'), why = el('div', 'qWhy'), go = el('button', 'qGo', 'متابعة');
    why.hidden = true; go.hidden = true; go.type = 'button';
    let answered = false;
    q.opts.forEach((o, i) => {
      const b = el('button', 'qOpt', o); b.type = 'button';
      b.onclick = () => {
        if (answered) return; answered = true;
        [...list.children].forEach((x, j) => { x.disabled = true; if (q.ans >= 0) { if (j === q.ans) x.classList.add('ok'); else if (j === i) x.classList.add('bad'); } else if (j === i) x.classList.add('pick'); });
        if (q.ans >= 0) QPOSE = { mode: i === q.ans ? 'joy' : 'point', t0: clock };   // إجابة صحيحة ← فرح، خاطئة ← تشير وتشرح
        if (q.why) { why.textContent = q.why; why.hidden = false; }
        go.hidden = false; go.focus();
      };
      list.appendChild(b);
    });
    go.onclick = hideQ;
    card.append(list, why, go); box.appendChild(card); document.body.appendChild(box);
  };
})();
