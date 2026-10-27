(function () {
  const SK = 'cartoonScenes1', ACT = [['talk', 'حديث'], ['wave', 'تلويح'], ['point', 'إشارة'], ['think', 'تفكير'], ['sad', 'حزن'], ['awe', 'دهشة'], ['sit', 'جلوس'], ['joy', 'فرح'], ['pointup', 'إشارة للأعلى'], ['turn', 'التفات']];
  const pick = s => JSON.parse(JSON.stringify({ h: s.h || '', bg: s.bg || 1, text: s.text || '', acts: s.acts || [[0, 'talk']], props: s.props || [], noWalk: !!s.noWalk, run: !!s.run, out: s.out, extra: s.extra, spk: s.spk, cast: s.cast }));
  let ED = SHOTS.map(pick);
  const el = (t, p, c) => { const e = document.createElement(t); if (p) Object.assign(e, p); (c || []).forEach(x => e.appendChild(x)); return e; };
  const sel = (opts, val, fn) => { const s = el('select'); opts.forEach(([v, t]) => s.appendChild(el('option', { value: v, textContent: t }))); s.value = val; s.onchange = () => fn(s.value); return s; };
  const bgOpts = Array.from({ length: 15 }, (_, i) => [i + 1, (i + 1) + (typeof BG_SHORT !== 'undefined' && BG_SHORT[i + 1] ? '. ' + BG_SHORT[i + 1] : '')]);
  function render() {
    const box = document.getElementById('eList'); box.innerHTML = '';
    ED.forEach((s, i) => {
      const p0 = s.props[0], multi = s.props.length > 1;
      const mv = (d) => () => { const j = i + d; if (j < 0 || j >= ED.length) return; [ED[i], ED[j]] = [ED[j], ED[i]]; render(); };
      const head = el('div', { className: 'row' }, [el('b', { textContent: (i + 1) + '.' }),
        el('input', { value: s.h, placeholder: 'عنوان المشهد', style: 'flex:1;min-width:120px;background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px', oninput() { s.h = this.value; } }),
        el('button', { type: 'button', textContent: '↑', onclick: mv(-1), style: 'padding:4px 10px' }), el('button', { type: 'button', textContent: '↓', onclick: mv(1), style: 'padding:4px 10px' }),
        el('button', { type: 'button', textContent: '✕', style: 'padding:4px 10px;background:#5a3a3a', onclick() { if (ED.length > 1) { ED.splice(i, 1); render(); } } })]);
      const propSel = sel([['', 'بدون بطاقة'], ...PROPS, ...(multi ? [['*', 'عدة بطاقات (محفوظة)']] : [])], multi ? '*' : (p0 ? p0.id : ''), v => {
        if (v === '*') return; s.props = v ? [{ id: v, cap: p0 ? p0.cap : '', f0: 0, f1: 1 }] : []; render(); });
      const cap = el('input', { value: p0 ? p0.cap || '' : '', placeholder: 'شرح البطاقة', disabled: !p0 || multi, style: 'flex:1;min-width:100px;background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px', oninput() { if (s.props[0]) s.props[0].cap = this.value; } });
      const opts = el('div', { className: 'row' }, [sel(bgOpts, s.bg, v => { s.bg = +v; }),
        sel(ACT, (s.acts[0] && s.acts[0][1]) || 'talk', v => { s.acts = v === 'talk' ? [[0, 'talk']] : [[0, v], [0.6, 'talk']]; }),
        sel([['', 'خروج: مشي'], ['away', 'خروج: بالظهر'], ['turnaway', 'خروج: التفات ثم بالظهر']], s.out || '', v => { s.out = v || undefined; }),
        sel([['walk', 'دخول: مشي'], ['run', 'دخول: جري'], ['none', 'بدون دخول']], s.noWalk ? 'none' : (s.run ? 'run' : 'walk'), v => { s.noWalk = v === 'none'; s.run = v === 'run'; }), propSel, cap]);
      const cur = () => (s.cast && s.cast.length ? s.cast.slice() : ['guide']);
      const castRow = el('div', { className: 'row' }, [el('span', { textContent: 'المتحدث' }),
        sel(CAST.map(c => [c.id, c.name]), s.spk || 'guide', v => { const a = cur(); if (!a.includes(v)) a.push(v); s.spk = v === 'guide' ? undefined : v; s.cast = a.length === 1 && a[0] === 'guide' ? undefined : a; render(); }),
        el('span', { textContent: 'الحاضرون' }),
        ...CAST.map(c => el('label', { style: 'font-size:13px' }, [el('input', { type: 'checkbox', checked: cur().includes(c.id), onchange() { let a = cur(); if (this.checked) a.push(c.id); else a = a.filter(x => x !== c.id); a = [...new Set(a)]; if (!a.length) a = ['guide']; s.cast = a.length === 1 && a[0] === 'guide' ? undefined : a; if (s.spk && !a.includes(s.spk)) s.spk = a[0] === 'guide' ? undefined : a[0]; render(); } }), document.createTextNode(c.name)]))]);
      const ta = el('textarea', { value: s.text, rows: 3, placeholder: 'نص المشهد (يُقرأ بالتعليق، وطوله يحدد المدة)', style: 'width:100%;background:#26313b;color:#eee;border:0;border-radius:6px;padding:8px;font:inherit', oninput() { s.text = this.value; } });
      box.appendChild(el('div', { className: 'shot', style: 'display:block;cursor:default;padding:8px 0' }, [head, opts, castRow, ta]));
    });
  }
  document.getElementById('eDlg').onclick = () => {
    const re = /^\s*([^:：\n]{2,24}?)\s*[:：]\s*(.+)$/, out = []; let found = 0;
    ED.forEach(s => {
      const lines = s.text.split(/\n+/).map(x => x.trim()).filter(Boolean), parts = []; let prev = null;
      lines.forEach(L => { const m = re.exec(L), c = m && castByName(m[1]); if (c) { parts.push({ id: c.id, t: m[2].trim() }); prev = parts[parts.length - 1]; found++; } else if (prev) prev.t += ' ' + L; else parts.push({ id: s.spk || 'guide', t: L }); });
      if (!parts.some(p => p.id !== (s.spk || 'guide')) && !found) { out.push(s); return; }
      const ids = [...new Set(parts.map(p => p.id))];
      parts.forEach((p, k) => { const o = pick(s); o.text = p.t; o.spk = p.id === 'guide' ? undefined : p.id; o.cast = ids.length === 1 && ids[0] === 'guide' ? undefined : ids; o.noWalk = true; o.run = false; o.out = undefined; if (k > 0) { o.props = []; o.h = s.h + ' ' + (k + 1); } o.acts = [[0, 'talk']]; out.push(o); });
    });
    if (!found) { document.getElementById('msg').textContent = 'لا يوجد حوار بصيغة «الاسم: نص»، تأكد أن الأسماء مطابقة لأسماء الطاقم'; return; }
    ED = out; render(); document.getElementById('msg').textContent = 'تم تحويل الحوار إلى ' + ED.length + ' مشهدًا، راجع ثم اضغط «حفظ وتطبيق»';
  };
  document.getElementById('eAdd').onclick = () => { ED.push({ h: 'مشهد ' + (ED.length + 1), bg: 1, text: '', acts: [[0, 'talk']], props: [], noWalk: false }); render(); };
  document.getElementById('eClear').onclick = () => { if (!confirm('حذف كل المشاهد والبدء بمشهد فارغ؟')) return; ED = [{ h: 'مشهد 1', bg: 1, text: '', acts: [[0, 'wave']], props: [], noWalk: false }]; render(); };
  document.getElementById('eDef').onclick = () => { if (!confirm('الرجوع لمشاهد الدرس الأصلي؟')) return; try { Store.removeItem(SK); Store.removeItem('cartoonLastScene1'); } catch (_) {} Store.reload(); };
  document.getElementById('eSave').onclick = () => {
    const bad = ED.findIndex(s => !s.text.trim()); if (bad >= 0) { document.getElementById('msg').textContent = 'اكتب نص المشهد ' + (bad + 1) + ' أو احذفه'; return; }
    try { Store.setItem(SK, JSON.stringify(ED)); Store.removeItem('cartoonLastScene1'); } catch (_) { document.getElementById('msg').textContent = 'تعذّر الحفظ'; return; }
    document.getElementById('msg').textContent = 'تم الحفظ، جاري إعادة التحميل …'; setTimeout(() => Store.reload(), 500);
  };
  render();
})();
