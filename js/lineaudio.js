// ===== أصوات أسطر الحوار: ملف صوت لكل سطر (بصوت صاحبه) بدل توليد Gemini =====
// كل سطر مرفوع يُحوَّل إلى PCM أحادي 24 كيلوهرتز؛ وإذا اكتملت أسطر المشهد دُمجت بنفس صيغة الصوت المولَّد (pcm/abuf/lineT)،
// فيعمل التشغيل والتصدير والحزمة ومزامنة الفم وتبديل المتحدث دون مسار خاص. الأسطر الناقصة تُولَّد بـ Gemini عند توفر المفتاح.
async function toPcm24(buf) {
  const n = Math.max(1, Math.ceil(buf.duration * 24000)), oc = new OfflineAudioContext(1, n, 24000), src = oc.createBufferSource();
  src.buffer = buf; src.connect(oc.destination); src.start();
  const d = (await oc.startRendering()).getChannelData(0), pcm = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
  return pcm;
}
async function setLineAudio(i, k, file) {
  const s = SHOTS[i]; if (!s || !s.lines || !s.lines[k]) throw new Error('لا يوجد سطر ' + (k + 1) + ' في المشهد ' + (i + 1));
  ac(); const pcm = await toPcm24(tightAudio(await AC.decodeAudioData(await file.arrayBuffer())));
  (s.lineAud = s.lineAud || [])[k] = { pcm, file, name: file.name || 'audio', sig: (file.name || '') + ':' + (file.size || 0) };
}
const lineAudRows = () => { const r = []; SHOTS.forEach((s, i) => (s.lines || []).forEach((L, k) => r.push({ i, k, s, L }))); return r; };
const lineAudDone = s => !!(s.lines && s.lines.length && s.lines.every((_, k) => s.lineAud && s.lineAud[k]));
// بعد رفع أو حذف: إن اكتملت أسطر المشهد نبني صوته الجاهز، وإلا يُعاد توليد الناقص عند التشغيل (إن وُجد مفتاح)
async function afterLineAudio(i) {
  const s = SHOTS[i]; if (!s || !s.lines || !s.lines.length) return;
  if (lineAudDone(s)) { await genLines(s); s.gk = voKey(s); }
  recalc(); renderLineAud();
}
function clearLineAudio(i, k) {
  const s = SHOTS[i]; if (!s || !s.lineAud || !s.lineAud[k]) return;
  s.lineAud[k] = null; s.cust = false;
  s.abuf = null; s.pcm = null; s.gk = null; s.lineT = null; s.adur = 0;   // الصوت المدمج لم يعد صالحًا
  recalc(); renderLineAud();
}
function renderLineAud() {
  const box = $('lineAud'); if (!box) return; box.textContent = '';
  const rows = lineAudRows(), nm = id => { try { return castById(id || 'guide').name; } catch (_) { return id || 'المرشد'; } };
  const have = rows.filter(r => (r.s.lineAud && r.s.lineAud[r.k]) || (r.s.lineT && r.s.lineT[r.k] && r.s.lineT[r.k].c)).length;
  const st = $('laStat'); if (st) { st.textContent = rows.length ? have + ' / ' + rows.length + ' سطر بصوت مرفوع' : ''; st.style.color = rows.length && have === rows.length ? '#7fdc9a' : '#f9a'; }
  if (!rows.length) { const p = document.createElement('div'); p.style.cssText = 'font-size:13px;color:#9aa'; p.textContent = 'لا توجد مشاهد حوار. حوّل مشهدًا إلى حوار من محرر المشاهد (🗣️) ثم عُد هنا.'; box.appendChild(p); return; }
  let last = -1;
  rows.forEach(({ i, k, s, L }) => {
    if (i !== last) { last = i; const hd = document.createElement('div'); hd.style.cssText = 'margin:8px 0 3px;font-weight:700;font-size:13px'; const miss = s.lines.filter((_, q) => !(s.lineAud && s.lineAud[q])).length;
      hd.textContent = (i + 1) + '. ' + s.h + (miss === 0 ? ' — اكتمل صوت الأسطر' : ' — ينقص ' + miss + ' من ' + s.lines.length); box.appendChild(hd); }
    const row = document.createElement('div'); row.className = 'row'; row.dataset.scene = i; row.dataset.line = k; row.style.cssText = 'align-items:center;margin:0 0 4px';
    const who = document.createElement('b'); who.style.cssText = 'min-width:96px;font-size:13px'; who.textContent = nm(L.spk);
    const tx = document.createElement('span'); tx.style.cssText = 'flex:1;min-width:120px;font-size:13px;color:#cbd'; tx.textContent = String(L.t || '').slice(0, 48) + (String(L.t || '').length > 48 ? '…' : '');
    const u = s.lineAud && s.lineAud[k], saved = !u && s.lineT && s.lineT[k] && s.lineT[k].c;
    const stt = document.createElement('span'); stt.className = 'laState'; stt.style.cssText = 'font-size:12px;color:' + (u || saved ? '#7fdc9a' : '#9aa'); stt.textContent = u ? '✔ ' + u.name : saved ? '✔ مرفوع (محفوظ)' : '—';
    const lb = document.createElement('label'); lb.className = 'f'; lb.style.flex = '0 1 auto'; lb.append('🎙️ ');
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*'; inp.setAttribute('aria-label', 'صوت السطر ' + (k + 1) + ' من المشهد ' + (i + 1));
    inp.onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { msg('جاري قراءة الصوت …'); await setLineAudio(i, k, f); await afterLineAudio(i); msg('تم ربط الصوت بالسطر ' + (k + 1) + ' من المشهد ' + (i + 1)); } catch (err) { dbg(err); msg('تعذّر قراءة الملف: ' + (f.name || '')); } };
    lb.appendChild(inp); row.append(who, tx, stt, lb);
    if (u) { const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'إزالة صوت هذا السطر'; x.style.cssText = 'padding:4px 9px;background:#5a3a3a'; x.onclick = () => clearLineAudio(i, k); row.appendChild(x); }
    box.appendChild(row);
  });
}
$('fLineAud').onchange = async e => {
  const fs = [...e.target.files].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true })); e.target.value = ''; if (!fs.length) return;
  const rows = lineAudRows(); if (!rows.length) { msg('لا توجد مشاهد حوار لربط الملفات بها'); return; }
  const bad = [], touched = new Set(); let ok = 0;
  for (let q = 0; q < fs.length && q < rows.length; q++) {
    msg('جاري قراءة الصوت ' + (q + 1) + ' / ' + Math.min(fs.length, rows.length) + ' …');
    try { await setLineAudio(rows[q].i, rows[q].k, fs[q]); touched.add(rows[q].i); ok++; } catch (err) { dbg(err); bad.push(fs[q].name); }
  }
  for (const i of touched) await afterLineAudio(i);
  renderLineAud();
  msg('رُبط ' + ok + ' ملف بأسطر الحوار' + (fs.length > rows.length ? ' — عدد الملفات (' + fs.length + ') أكبر من الأسطر (' + rows.length + ')، تم تجاهل الزائد' : '') + (rows.length > fs.length ? ' — بقي ' + (rows.length - fs.length) + ' سطر بلا ملف' : '') + (bad.length ? ' — تعذّر: ' + bad.join('، ') : ''));
};
renderLineAud();
