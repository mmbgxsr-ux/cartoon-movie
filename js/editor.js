(function () {
  const SK = 'cartoonScenes1', ACT = [['talk', 'حديث'], ['wave', 'تلويح'], ['point', 'إشارة'], ['think', 'تفكير'], ['sad', 'حزن'], ['awe', 'دهشة'], ['sit', 'جلوس'], ['joy', 'فرح'], ['pointup', 'إشارة للأعلى'], ['turn', 'التفات']];
  const pick = s => JSON.parse(JSON.stringify({ h: s.h || '', bg: s.bg || 1, text: s.text || '', acts: s.acts || [[0, 'talk']], props: s.props || [], noWalk: !!s.noWalk, run: !!s.run, out: s.out, extra: s.extra, spk: s.spk, cast: s.cast, lines: s.lines, pos: s.pos, wear: s.wear, noFace: s.noFace, era: s.era, year: s.year, amb: s.amb, q: s.q, holo: s.holo }));
  let ED = SHOTS.map(pick);
  const el = (t, p, c) => { const e = document.createElement(t); if (p) Object.assign(e, p); (c || []).forEach(x => e.appendChild(x)); return e; };
  const sel = (opts, val, fn) => { const s = el('select'); opts.forEach(([v, t]) => s.appendChild(el('option', { value: v, textContent: t }))); s.value = val; s.onchange = () => fn(s.value); return s; };
  const bgOpts = Array.from({ length: 15 }, (_, i) => [i + 1, (i + 1) + (typeof BG_SHORT !== 'undefined' && BG_SHORT[i + 1] ? '. ' + BG_SHORT[i + 1] : '')]);
  const NRE = /^\s*([^:：\n]{2,24}?)\s*[:：]\s*(.+)$/;
  const textToLines = s => { const parts = []; (s.text || '').split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(L => { const m = NRE.exec(L), c = m && castByName(m[1]); if (c) parts.push({ spk: c.id, t: m[2].trim() }); else if (parts.length) parts[parts.length - 1].t += ' ' + L; else parts.push({ spk: s.spk || 'guide', t: L }); }); if (!parts.length) parts.push({ spk: s.spk || 'guide', t: '' }); return parts; };
  const syncLines = s => {
    if (s.lines && s.lines.length) { s.text = s.lines.map(L => L.t.trim()).filter(Boolean).join(' '); const ids = [...new Set(s.lines.map(L => L.spk))]; s.cast = ids.length === 1 && ids[0] === 'guide' ? undefined : ids; s.spk = s.lines[0].spk === 'guide' ? undefined : s.lines[0].spk; if (ids.length > 1 || ids[0] !== 'guide') s.noWalk = true; } else s.lines = undefined;
  };
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
        sel([['walk', 'دخول: مشي'], ['run', 'دخول: جري'], ['none', 'بدون دخول']], s.noWalk ? 'none' : (s.run ? 'run' : 'walk'), v => { s.noWalk = v === 'none'; s.run = v === 'run'; }), propSel, cap, el('label', { style: 'white-space:nowrap' }, [el('input', { type: 'checkbox', checked: !!s.holo, onchange() { s.holo = this.checked || undefined; } }), el('span', { textContent: ' هولجرام' })])]);
      const eraRow = el('div', { className: 'row' }, [el('span', { textContent: 'شريط العصر' }),
        el('input', { value: s.era || '', placeholder: 'العصر', style: 'background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px;width:150px', oninput() { s.era = this.value.trim() || undefined; } }),
        el('input', { value: s.year || '', placeholder: 'السنة', style: 'background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px;width:100px', oninput() { s.year = this.value.trim() || undefined; } }),
        el('span', { textContent: 'صوت المكان' }), sel([['', 'حسب الخلفية'], ...(typeof AMB_OPTS !== 'undefined' ? AMB_OPTS : [])], s.amb || '', v => { s.amb = v || undefined; })]);
      const cur = () => (s.cast && s.cast.length ? s.cast.slice() : ['guide']);
      const castRow = el('div', { className: 'row' }, [el('span', { textContent: 'المتحدث' }),
        sel(CAST.map(c => [c.id, c.name]), s.spk || 'guide', v => { const a = cur(); if (!a.includes(v)) a.push(v); s.spk = v === 'guide' ? undefined : v; s.cast = a.length === 1 && a[0] === 'guide' ? undefined : a; render(); }),
        el('span', { textContent: 'الحاضرون' }),
        ...CAST.map(c => el('label', { style: 'font-size:13px' }, [el('input', { type: 'checkbox', checked: cur().includes(c.id), onchange() { let a = cur(); if (this.checked) a.push(c.id); else a = a.filter(x => x !== c.id); a = [...new Set(a)]; if (!a.length) a = ['guide']; s.cast = a.length === 1 && a[0] === 'guide' ? undefined : a; if (s.spk && !a.includes(s.spk)) s.spk = a[0] === 'guide' ? undefined : a[0]; render(); } }), document.createTextNode(c.name)]))]);
      const ta = el('textarea', { value: s.text, rows: 3, placeholder: 'نص المشهد (يُقرأ بالتعليق، وطوله يحدد المدة)', style: 'width:100%;background:#26313b;color:#eee;border:0;border-radius:6px;padding:8px;font:inherit', oninput() { s.text = this.value; } });
      const present = (s.cast && s.cast.length ? s.cast : ['guide']).filter(id => CAST.some(c => c.id === id));
      const pwRow = (present.length > 1 || (present[0] && present[0] !== 'guide')) ? (() => {
        const dup = present.some((id, i) => s.pos && s.pos[id] && present.some((o, k) => k !== i && s.pos[o] === s.pos[id]));
        const items = [el('span', { textContent: 'المواضع والأزياء', style: 'width:100%;font-size:12px;color:#8ea0b5' })];
        present.forEach(id => {
          const c = castById(id), g = [el('b', { textContent: c.name, style: 'font-size:13px;color:#cfd8e3' })];
          g.push(sel(CAST_POS_OPTS, (s.pos && s.pos[id]) || '', v => { s.pos = Object.assign({}, s.pos); if (v) s.pos[id] = v; else delete s.pos[id]; if (!Object.keys(s.pos).length) s.pos = undefined; render(); }));
          if (c.alt && c.alt.length) g.push(sel([['', 'الزي الأساسي'], ...c.alt.map((a, k) => [String(k), a.name || ('زي ' + (k + 1))])], s.wear && s.wear[id] != null ? String(s.wear[id]) : '', v => { s.wear = Object.assign({}, s.wear); if (v === '') delete s.wear[id]; else s.wear[id] = +v; if (!Object.keys(s.wear).length) s.wear = undefined; }));
          items.push(el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#1b2635;border-radius:8px;padding:4px 8px' }, g));
        });
        if (present.length > 1) items.push(el('label', { style: 'font-size:13px' }, [el('input', { type: 'checkbox', checked: !!s.noFace, onchange() { s.noFace = this.checked || undefined; } }), document.createTextNode('بدون التفات (ثبات الاتجاه)')]));
        if (dup) items.push(el('span', { textContent: '⚠ شخصيتان في نفس الموضع', style: 'color:#ffb454;font-size:12px' }));
        return el('div', { className: 'row', style: 'align-items:center' }, items);
      })() : null;
      const hasL = !!(s.lines && s.lines.length), inp2 = 'background:#26313b;color:#eee;border:0;border-radius:6px;padding:6px';
      const linesBox = el('div', { style: 'margin-top:6px;border:1px dashed #3a4a5e;border-radius:8px;padding:8px' });
      if (!hasL) {
        linesBox.appendChild(el('button', { type: 'button', textContent: '🗣️ تحويل لمشهد حوار (أكثر من متحدث)', style: 'background:#6a3fa0', onclick() { s.lines = textToLines(s); syncLines(s); render(); } }));
      } else {
        linesBox.appendChild(el('div', { textContent: 'سطور الحوار بالترتيب (الصوت والتوقيت يُحسبان تلقائيًا)', style: 'font-size:12px;color:#8ea0b5;margin-bottom:6px' }));
        const mvL = (k, d) => () => { const j = k + d; if (j < 0 || j >= s.lines.length) return; [s.lines[k], s.lines[j]] = [s.lines[j], s.lines[k]]; syncLines(s); render(); };
        s.lines.forEach((L, k) => linesBox.appendChild(el('div', { className: 'row', style: 'align-items:flex-start;margin:0 0 6px' }, [
          el('b', { textContent: (k + 1) + '.', style: 'padding-top:6px' }),
          sel(CAST.map(c => [c.id, c.name]), L.spk, v => { L.spk = v; syncLines(s); render(); }),
          el('textarea', { value: L.t, rows: 2, placeholder: 'ماذا يقول؟', style: inp2 + ';flex:1;min-width:140px;font:inherit', oninput() { L.t = this.value; syncLines(s); } }),
          el('button', { type: 'button', textContent: '↑', onclick: mvL(k, -1), style: 'padding:4px 9px' }), el('button', { type: 'button', textContent: '↓', onclick: mvL(k, 1), style: 'padding:4px 9px' }),
          el('button', { type: 'button', textContent: '✕', style: 'padding:4px 9px;background:#5a3a3a', onclick() { s.lines.splice(k, 1); if (!s.lines.length) s.lines = undefined; else syncLines(s); render(); } })])));
        linesBox.appendChild(el('button', { type: 'button', textContent: '➕ إضافة سطر', style: 'background:#245a36', onclick() {
          const last = s.lines[s.lines.length - 1], ids = [...new Set(s.lines.map(x => x.spk))], nx = ids.find(i => i !== last.spk) || last.spk; s.lines.push({ spk: nx, t: '' }); syncLines(s); render(); } }));
        linesBox.appendChild(el('button', { type: 'button', textContent: 'إلغاء الحوار (نص عادي)', style: 'background:#3a4656;font-size:12px;margin-inline-start:6px', onclick() { s.lines = undefined; render(); } }));
      }
      box.appendChild(el('div', { className: 'shot', style: 'display:block;cursor:default;padding:8px 0' }, (hasL ? [head, opts, eraRow, linesBox] : [head, opts, eraRow, castRow, ta, linesBox]).concat(pwRow ? [pwRow] : [])));
    });
  }
  document.getElementById('eDlg').onclick = () => {
    const re = /^\s*([^:：\n]{2,24}?)\s*[:：]\s*(.+)$/, out = []; let found = 0;
    ED.forEach(s => {
      const lines = s.text.split(/\n+/).map(x => x.trim()).filter(Boolean), parts = []; let prev = null;
      lines.forEach(L => { const m = re.exec(L), c = m && castByName(m[1]); if (c) { parts.push({ id: c.id, t: m[2].trim() }); prev = parts[parts.length - 1]; found++; } else if (prev) prev.t += ' ' + L; else parts.push({ id: s.spk || 'guide', t: L }); });
      if (!parts.some(p => p.id !== (s.spk || 'guide')) && !found) { out.push(s); return; }
      const ids = [...new Set(parts.map(p => p.id))];
      parts.forEach((p, k) => { const o = pick(s); o.lines = undefined; o.text = p.t; o.spk = p.id === 'guide' ? undefined : p.id; o.cast = ids.length === 1 && ids[0] === 'guide' ? undefined : ids; o.noWalk = true; o.run = false; o.out = undefined; if (k > 0) { o.props = []; o.h = s.h + ' ' + (k + 1); } o.acts = [[0, 'talk']]; o.q = k === parts.length - 1 ? s.q : undefined; out.push(o); });
    });
    if (!found) { document.getElementById('msg').textContent = 'لا يوجد حوار بصيغة «الاسم: نص»، تأكد أن الأسماء مطابقة لأسماء الطاقم'; return; }
    ED = out; render(); document.getElementById('msg').textContent = 'تم تحويل الحوار إلى ' + ED.length + ' مشهدًا، راجع ثم اضغط «حفظ وتطبيق»';
  };
  { const b1 = el('button', { id: 'eDlg1', type: 'button', textContent: '🗨️ حوار داخل مشهد واحد', style: 'background:#6a3fa0' }); document.getElementById('eDlg').after(b1);
    b1.onclick = () => { let n = 0; ED.forEach(s => { if (s.lines && s.lines.length) return; const L = textToLines(s); if (L.length && L.some(x => x.spk !== (s.spk || 'guide')) ) { s.lines = L; syncLines(s); n++; } });
      if (!n) { document.getElementById('msg').textContent = 'لا يوجد حوار بصيغة «الاسم: نص» (الأسماء مطابقة لأسماء الطاقم)، أو حوّل كل مشهد بزر «تحويل لمشهد حوار»'; return; }
      render(); document.getElementById('msg').textContent = 'تم تحويل ' + n + ' مشهدًا إلى مشاهد حوار، راجع ثم اضغط «حفظ وتطبيق»'; }; }
  document.getElementById('eAdd').onclick = () => { ED.push({ h: 'مشهد ' + (ED.length + 1), bg: 1, text: '', acts: [[0, 'talk']], props: [], noWalk: false }); render(); };
  document.getElementById('eClear').onclick = () => { if (!confirm('حذف كل المشاهد والبدء بمشهد فارغ؟')) return; ED = [{ h: 'مشهد 1', bg: 1, text: '', acts: [[0, 'wave']], props: [], noWalk: false }]; render(); };
  document.getElementById('eDef').onclick = () => { if (!confirm('الرجوع لمشاهد الدرس الأصلي؟')) return; try { Store.removeItem(SK); Store.removeItem('cartoonLastScene1'); Store.removeItem('cartoonDraft1'); } catch (_) {} Store.reload(); };
  document.getElementById('eSave').onclick = () => {
    ED.forEach(s => { if (s.lines) { s.lines = s.lines.filter(L => L.t.trim()); syncLines(s); } });
    const bad = ED.findIndex(s => !s.text.trim()); if (bad >= 0) { document.getElementById('msg').textContent = 'اكتب نص المشهد ' + (bad + 1) + ' أو احذفه'; return; }
    try { Store.setItem(SK, JSON.stringify(ED)); Store.removeItem('cartoonLastScene1'); Store.removeItem('cartoonDraft1'); } catch (_) { document.getElementById('msg').textContent = 'تعذّر الحفظ'; return; }
    document.getElementById('msg').textContent = 'تم الحفظ، جاري إعادة التحميل …'; setTimeout(() => Store.reload(), 500);
  };
  // ===== حفظ تلقائي للمسودة: أي تعديل في المحرر يُحفظ كل ثلاث ثوانٍ ويُسترجع عند إعادة فتح الصفحة =====
  const DK = 'cartoonDraft1', BASE = JSON.stringify(SHOTS.map(pick));
  try {
    const d = JSON.parse(Store.getItem(DK) || 'null');
    if (Array.isArray(d) && d.length && d.every(x => x && typeof x.text === 'string') && JSON.stringify(d.map(pick)) !== BASE) {
      ED = d.map(pick); document.getElementById('msg').textContent = 'تم استرجاع مسودة غير محفوظة من المحرر. اضغط «حفظ وتطبيق» لتثبيتها';
    }
  } catch (_) {}
  let last = JSON.stringify(ED);
  setInterval(() => {
    let cur; try { cur = JSON.stringify(ED); } catch (_) { return; }
    if (cur === last) return; last = cur;
    try { if (cur === BASE) Store.removeItem(DK); else Store.setItem(DK, cur); } catch (_) {}
  }, 3000);
  window.addEventListener('pagehide', () => { try { const cur = JSON.stringify(ED); if (cur !== BASE) Store.setItem(DK, cur); } catch (_) {} });
  render();
})();
