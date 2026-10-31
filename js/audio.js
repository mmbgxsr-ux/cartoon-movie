let AC, DEST, cur, busy = false, autoDl = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ac = () => { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); DEST = AC.createMediaStreamDestination(); AN = AC.createAnalyser(); AN.fftSize = 1024; AN.smoothingTimeConstant = 0.15; } return AC; };
const gemKey = () => $('kKey').value.trim().length > 10;
const EMBON = () => $('cEmb').checked && SHOTS.every(s => s.eb);
const useGem = () => $('cTts').checked && (EMBON() || gemKey());
const AB = s => !$('cTts').checked ? null : EMBON() ? s.eb : (gemKey() ? s.abuf : null);
const AD = s => EMBON() ? s.ed : s.adur;
try { $('kKey').value = Store.getItem('gk') || ''; } catch (_) {}
$('kKey').oninput = () => { try { Store.setItem('gk', $('kKey').value.trim()); } catch (_) {} };
$('kDel').onclick = () => { $('kKey').value = ''; try { Store.removeItem('gk'); } catch (_) {} msg('تم حذف المفتاح من هذا المتصفح'); };
function recalc() {
  SHOTS.forEach(s => { const base = AB(s) ? AD(s) + .35 : Math.max(6, s.text.length / RATE); s.main = base + (s.extra || 0); s.dur = s.inT + s.main + s.outT; });
  TOTAL = SHOTS.reduce((a, s) => a + s.dur, 0);
}
async function gen(s) {
  const _c = typeof castById === 'function' ? castById(s.spk || 'guide') : null, _g = !_c || _c.id === 'guide';
  const body = { contents: [{ parts: [{ text: (_g ? 'اقرأ بلهجة مصرية مرحة وحماسية كمدرس حقيقي يشرح لطلابه: ' : 'اقرأ بلهجة مصرية بصوت الشخصية «' + _c.name + '» في قصة تاريخية تعليمية للطلاب، بتمثيل طبيعي: ') + s.text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: (_c && _c.voice) || $('sGv').value } } } } };
  let lastSt = 0;
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + $('sGm').value + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': $('kKey').value.trim() }, body: JSON.stringify(body) });
    if (r.status === 429 || r.status >= 500) { lastSt = r.status; msg('انتظار حد الطلبات… محاولة ' + (a + 2)); await sleep(9000 * (a + 1)); continue; }
    const j = await r.json(); if (!r.ok) throw new Error(gemErr(r.status, j.error && j.error.message));
    const p = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.find(x => x.inlineData);
    if (!p) { await sleep(2000); continue; }
    const bin = atob(p.inlineData.data), n = bin.length >> 1, pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) pcm[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
    const buf = ac().createBuffer(1, n, 24000), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = pcm[i] / 32768;
    s.pcm = pcm; s.abuf = buf; s.adur = buf.duration; return;
  }
  throw new Error(lastSt ? gemErr(lastSt) : 'فشل توليد الصوت');
}
// مشهد حوار: يُولَّد صوت كل سطر بصوت صاحبه ثم تُدمج في مقطع واحد، ويُسجَّل وقت كل سطر (lineT) ليعرف الرسم من يتكلم
async function genLines(s) {
  const GAP = .3, R = 24000, parts = [], T = []; let t = 0;
  for (let k = 0; k < s.lines.length; k++) {
    const L = s.lines[k], tmp = { spk: L.spk === 'guide' ? undefined : L.spk, text: L.t };
    if (k) await sleep(800);
    await gen(tmp);
    if (k) { parts.push(new Int16Array(Math.round(GAP * R))); t += GAP; }
    parts.push(tmp.pcm); T.push({ id: L.spk || 'guide', a: t, b: t + tmp.adur }); t += tmp.adur;
  }
  const n = parts.reduce((q, p) => q + p.length, 0), pcm = new Int16Array(n); let o = 0; parts.forEach(p => { pcm.set(p, o); o += p.length; });
  const buf = ac().createBuffer(1, n, R), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = pcm[i] / 32768;
  s.pcm = pcm; s.abuf = buf; s.adur = buf.duration; s.lineT = T;
}
async function genAll(maxSec) {   // maxSec (اختياري): نتوقف عن توليد الصوت بعد هذا الزمن من الفيلم (للتصدير التجريبي)
  if (EMBON() || !gemKey() || !$('cTts').checked) return true; ac(); const vo1 = s => (typeof voiceOf === 'function' && voiceOf(s)) || $('sGv').value, vk = s => (s.lines && s.lines.length ? s.lines.map(L => vo1({ spk: L.spk }) + '|' + L.t).join('¦') : vo1(s)) + $('sGm').value;
  try {
    let acc = 0;
    for (let i = 0; i < SHOTS.length; i++) {
      if (maxSec && acc >= maxSec) break;
      const s = SHOTS[i], v = vk(s);
      if (!(s.abuf && s.gk === v)) { msg('جاري توليد الصوت ' + (i + 1) + ' من ' + SHOTS.length + ' …'); await (s.lines && s.lines.length ? genLines(s) : gen(s)); s.gk = v; await sleep(800); }
      if (maxSec) { recalc(); acc += s.dur; }   // المدة الفعلية بعد التوليد تحدد بداية المشهد التالي
    }
    msg(''); recalc(); return true;
  } catch (e) { msg('خطأ Gemini: ' + errText(e)); return false; }
}
$('bWav').onclick = async () => {
  if (!useGem()) { msg('أدخل مفتاح Gemini أولاً (صوت الجهاز لا يمكن حفظه كملف)'); return; } if (busy) return; busy = true;
  await EMBP; const ok = await genAll(); busy = false; if (!ok) return; recalc();
  const R = EMBON() ? AC.sampleRate : 24000, out = new Int16Array(Math.ceil(TOTAL * R)); let o = 0; SHOTS.forEach(s => { out.set(pcmOf(s), Math.round((o + s.inT) * R)); o += s.dur; });
  const h = new DataView(new ArrayBuffer(44)), w = (i, t) => [...t].forEach((c, k) => h.setUint8(i + k, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + out.length * 2, true); w(8, 'WAVEfmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, R, true); h.setUint32(28, R * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, out.length * 2, true);
  const a = $('dlA'); a.href = URL.createObjectURL(new Blob([h, out], { type: 'audio/wav' })); a.textContent = 'تحميل الصوت'; msg('تم تجهيز ملف الصوت وبدأ التحميل'); a.click();
};
const pcmOf = s => EMBON() ? Int16Array.from(s.eb.getChannelData(0), v => Math.max(-32768, Math.min(32767, Math.round(v * 32767)))) : s.pcm;
// قصّ الصمت الزائد: بداية ونهاية كل مقطع، والوقفات الداخلية الأطول من 0.6 ثانية تُختصر إلى نحو 0.5 (الوقفات الطبيعية بين الجمل تبقى كما هي)
function tightAudio(ab) {
  try {
    const sr = ab.sampleRate, n = ab.length, w = Math.round(sr * .01), nw = Math.floor(n / w), d = ab.getChannelData(0), sil = new Uint8Array(nw);
    for (let k = 0; k < nw; k++) { let e = 0; for (let i = k * w; i < (k + 1) * w; i++) e += d[i] * d[i]; sil[k] = Math.sqrt(e / w) < .01 ? 1 : 0; }
    let f = 0, l = nw - 1; while (f < nw && sil[f]) f++; while (l > f && sil[l]) l--; if (f >= l) return ab;
    f = Math.max(0, f - 6); l = Math.min(nw - 1, l + 12);
    const rg = []; let a = f;
    for (let k = f; k <= l;) { if (!sil[k]) { k++; continue; } let e = k; while (e <= l && sil[e]) e++; if (e - k > 60) { rg.push([a, k + 25]); a = e - 25; } k = e; }
    rg.push([a, l + 1]);
    const tot = rg.reduce((q, r) => q + (r[1] - r[0]) * w, 0); if (tot >= n - sr * .05) return ab;
    const nb = AC.createBuffer(ab.numberOfChannels, tot, sr);
    for (let c = 0; c < ab.numberOfChannels; c++) { const src = ab.getChannelData(c), dst = nb.getChannelData(c); let p = 0; for (const r of rg) { const seg = src.subarray(r[0] * w, Math.min(n, r[1] * w)); dst.set(seg, p); p += seg.length; } }
    return nb;
  } catch (_) { return ab; }
}
// تحميل الصوت من ملفات المستخدم: يُوزَّع على المشاهد بترتيب أسماء الملفات (01، 02، ...)
let AUDSRC = [];   // ملفات الصوت المرفوعة بترتيب المشاهد (للحزمة الكاملة)
async function loadAudioFiles(files) {
  ac(); const fs = [...files].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true })); AUDSRC = fs.slice(0, SHOTS.length);
  SHOTS.forEach(s => { s.eb = null; s.ed = null; }); let ok = 0;
  for (let i = 0; i < SHOTS.length && i < fs.length; i++) {
    msg('جاري قراءة الصوت ' + (i + 1) + ' / ' + Math.min(fs.length, SHOTS.length) + ' …');
    try { SHOTS[i].eb = tightAudio(await AC.decodeAudioData(await fs[i].arrayBuffer())); SHOTS[i].ed = SHOTS[i].eb.duration; ok++; }
    catch (e) { msg('تعذّر قراءة الملف: ' + fs[i].name); }
  }
  recalc(); audStatus(fs.length);
  let ai = 0; (function nxt() { const s = SHOTS[ai++]; if (!s) return; try { if (s.eb) analyzeAudio(s.eb); } catch (_) {} setTimeout(nxt, 60); })();
}
function audStatus(nFiles) {
  const n = SHOTS.filter(s => s.eb).length, el = $('aStat'); if (!el) return;
  el.textContent = n + ' / ' + SHOTS.length + ' مشهد'; el.style.color = n === SHOTS.length ? '#7fdc9a' : '#f9a';
  msg(n === SHOTS.length ? 'تم تحميل الصوت لكل المشاهد' : (n ? 'ينقص الصوت في ' + (SHOTS.length - n) + ' مشهد: سيُستخدم التعليق الآلي بدل الملفات حتى تكتمل' : 'لا يوجد صوت محمّل'));
  if (nFiles > SHOTS.length) msg('عدد الملفات (' + nFiles + ') أكبر من المشاهد (' + SHOTS.length + ')، تم تجاهل الزائد');
}
let EMBP = Promise.resolve();
$('fAud').onchange = e => { const f = e.target.files; if (!f.length) return; EMBP = loadAudioFiles(f); e.target.value = ''; };
audStatus(0); msg('ارفع الخلفيات وملفات الصوت ثم اضغط تشغيل');

function mOf(s, tt) {
  const main = s.dur - s.inT - s.outT;
  { const sf = spFrac(s); if (sf != null) return Math.min(.999, sf * envOf(s).dur / main); }
  if (s.speaking && !s.done && s.ci >= 0) {
    const ch = chunks(s), tot = ch.reduce((a, c) => a + c.length, 0); let a = 0; for (let i = 0; i < s.ci; i++) a += ch[i].length;
    const w = ch[s.ci].length, p = Math.min(1, (clock - s.cT) / (w / RATE * 1.1));
    return Math.min(.999, (a + w * p) / tot * (1 - (s.extra || 0) / main));
  }
  return (tt - s.inT) / main;
}
function startRec() {
  if (!$('cRec').checked) return;
  if (!window.MediaRecorder || !cv.captureStream) { msg('هذا المتصفح لا يدعم التسجيل، استخدم Chrome على الحاسوب أو الأندرويد'); autoDl = false; return; }
  chunksRec = []; const cands = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'];
  const mt = cands.find(c => MediaRecorder.isTypeSupported(c)) || 'video/webm'; recExt = mt.startsWith('video/mp4') ? 'mp4' : 'webm'; recMime = recExt === 'mp4' ? 'video/mp4' : 'video/webm';
  if (recExt !== 'mp4') msg('متصفحك لا يدعم تسجيل MP4 مباشرة، سيُحفظ الفيديو بصيغة WebM — جرّب Chrome حديثًا أو Safari للحصول على MP4');
  const st = cv.captureStream(30); if (DEST) DEST.stream.getAudioTracks().forEach(k => st.addTrack(k)); rec = new MediaRecorder(st, { mimeType: mt, videoBitsPerSecond: +$('sQ').value || 900000, audioBitsPerSecond: (+$('sQ').value >= 4000000 ? 128000 : 64000) });
  rec.ondataavailable = e => chunksRec.push(e.data);
  rec.onstop = () => { const a = $('dl'); a.href = URL.createObjectURL(new Blob(chunksRec, { type: recMime })); a.download = 'movie.' + recExt; a.textContent = 'تحميل الفيديو (' + recExt.toUpperCase() + ')'; if (autoDl) { autoDl = false; msg('تم إنهاء التسجيل وبدأ التحميل'); a.click(); } };
  rec.start(1000);
}
function stopAll() { hideQ(); wlOff(); ambStop(); playing = false; $('bPlay').textContent = 'تشغيل'; $('bPlay').classList.remove('on'); if (window.speechSynthesis) speechSynthesis.cancel(); try { cur && cur.stop(); } catch (_) {} if (rec && rec.state !== 'inactive') rec.stop(); rec = null; }
function begin() {
  recalc();
  SHOTS.forEach(x => { x.speaking = false; x.done = false; x.hold = 0; x.ci = -1; x._qd = false; x._lk = null; });
  if (window.speechSynthesis && $('cTts').checked && !useGem() && !voices().length) msg('لم يُعثر على صوت عربي؛ فعّل صوتًا عربيًا من إعدادات الجهاز (تحويل النص إلى كلام)');
  idx = +$('sStart').value; t = 0; spoken = false; playing = true; $('bPlay').textContent = 'إيقاف'; $('bPlay').classList.add('on'); ambStart(); wlOn(); startRec(); }
$('bVid').onclick = () => {
  if (playing || busy) return; if (!bgs.length) { msg('اختر الخلفيات أولاً'); return; }
  $('cRec').checked = true; $('sStart').value = 0; autoDl = true; $('bPlay').onclick();
};
$('bPlay').onclick = async () => { ac(); if (AC.state === 'suspended') AC.resume(); if (busy) return; if (playing) { stopAll(); return; } if (!bgs.length) msg('اختر الخلفيات أولاً'); busy = true; await EMBP; const ok = await genAll(); busy = false; if (ok) begin(); };

// ===================== صوت الخلفية: طبيعة مُولَّدة + موسيقى هادئة (يخفت تلقائيًا أثناء الكلام) =====================
const AMBP = { 1: { wind: .3, birds: .5 }, 3: { wind: .6, water: .25, birds: .2 }, 4: { wind: .5 }, 5: { birds: 1, water: .3, crickets: .35, wind: .12 }, 6: { wind: .7, birds: .35, crickets: .3 },
  7: { wind: .5, birds: .5, water: .2 }, 8: { fire: 1, wind: .4 }, 9: { rain: .8, birds: .3, wind: .2 }, 10: { wind: .35, waves: .6, crickets: .5 }, 11: { waves: .9, birds: .5, wind: .3 },
  12: { crickets: .6, birds: .5, water: .25, wind: .3 }, 13: { wind: 1 }, 14: { wind: .9 }, 15: { wind: 1 } };
let AMB = null;
function nbuf(a, brown) { const n = a.sampleRate * 3, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
function ambBuild() {
  const a = ac(), bus = a.createGain(); bus.gain.value = 0; bus.connect(a.destination); bus.connect(DEST);
  const W_ = nbuf(a, false), B_ = nbuf(a, true), ch = {};
  const mk = (buf, filters, lfoHz, lfoDepth) => {
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true; let node = src;
    for (const [type, f, q] of filters) { const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; node.connect(fl); node = fl; }
    const mod = a.createGain(); mod.gain.value = 1 - lfoDepth; node.connect(mod);
    if (lfoHz) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = lfoHz; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(mod.gain); l.start(); }
    const m = a.createGain(); m.gain.value = 0; mod.connect(m); m.connect(bus); src.start(); return m;
  };
  ch.wind = mk(B_, [['lowpass', 520]], .11, .35); ch.water = mk(W_, [['bandpass', 1000, .4], ['lowpass', 3200]], .27, .22);
  ch.rain = mk(W_, [['highpass', 2200], ['lowpass', 9000]], 0, 0); ch.waves = mk(B_, [['lowpass', 700]], .09, .55);
  { const c = a.createOscillator(), am = a.createGain(), t1 = a.createOscillator(), t1g = a.createGain(), t2 = a.createOscillator(), t2g = a.createGain(), m = a.createGain();
    c.frequency.value = 4300; am.gain.value = .5; t1.frequency.value = 27; t1g.gain.value = .5; t2.frequency.value = .35; t2g.gain.value = .3;
    c.connect(am); t1.connect(t1g); t1g.connect(am.gain); t2.connect(t2g); t2g.connect(am.gain); m.gain.value = 0; am.connect(m); m.connect(bus); c.start(); t1.start(); t2.start(); ch.crickets = m; }
  ch.birds = a.createGain(); ch.birds.gain.value = 0; ch.birds.connect(bus); ch.fire = a.createGain(); ch.fire.gain.value = 0; ch.fire.connect(bus);
  // بساط موسيقي هادئ
  const pad = a.createGain(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; pad.gain.value = .0; lp.connect(pad); pad.connect(bus);
  const oscs = [0, 1, 2].map(() => { const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = 220; o.connect(lp); o.start(); return o; });
  const CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [196, 246.9, 293.7]]; let ci = 0;
  const chord = () => { if (!AMB) return; oscs.forEach((o, i) => o.frequency.setTargetAtTime(CH[ci][i], a.currentTime, 1.2)); ci = (ci + 1) % CH.length; setTimeout(chord, 7000 * (1 - .4 * MOOD)); };
  AMB = { a, bus, ch, pad, lp, chord, on: false, lvl: {}, started: false };
}
function ambBird() {
  if (!AMB || !AMB.on) return; const a = AMB.a, lv = (AMB.lvl.birds || 0);
  if (lv > .05) { const n = 2 + Math.floor(Math.random() * 4), f0 = 2200 + Math.random() * 2600, pan = a.createStereoPanner ? a.createStereoPanner() : null; let t0 = a.currentTime + .02;
    if (pan) { pan.pan.value = Math.random() * 1.6 - .8; pan.connect(AMB.ch.birds); }
    for (let i = 0; i < n; i++) { const o = a.createOscillator(), g = a.createGain(), dur = .07 + Math.random() * .06; o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < .5 ? 1.35 : .75), t0 + dur);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.5, t0 + .012); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); o.connect(g); g.connect(pan || AMB.ch.birds); o.start(t0); o.stop(t0 + dur + .02); t0 += dur + .05; } }
  setTimeout(ambBird, 900 + Math.random() * 3800 / Math.max(.3, lv));
}
function ambFire() {
  if (!AMB || !AMB.on) return; const a = AMB.a, lv = AMB.lvl.fire || 0;
  if (lv > .05) { for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) { const t0 = a.currentTime + Math.random() * .25, n = Math.floor(a.sampleRate * (.01 + Math.random() * .03)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 2500; g.gain.value = .4 + Math.random() * .6; s.connect(f); f.connect(g); g.connect(AMB.ch.fire); s.start(t0); } }
  setTimeout(ambFire, 60 + Math.random() * 200);
}
function ambStart() {
  if (!$('cAmb') || !$('cAmb').checked) return; ac(); if (!AMB) ambBuild(); if (AC.state === 'suspended') AC.resume();
  if (!AMB.on) { AMB.on = true; if (!AMB.started) { AMB.started = true; AMB.chord(); } ambBird(); ambFire(); }
}
function ambStop() { if (!AMB) return; AMB.on = false; AMB.bus.gain.setTargetAtTime(0, AMB.a.currentTime, .25); }
function ambTick(s) {
  if (!AMB || !AMB.on) return; const a = AMB.a, now = a.currentTime, P = AMBP[s.map || s.bg || 1] || {}, vol = (+$('rAmb').value || .35), duck = 1 - .62 * Math.min(1, M.act / .35);
  for (const k of ['wind', 'water', 'rain', 'waves', 'crickets', 'birds', 'fire']) { const l = (P[k] || 0) * (k === 'birds' && MOOD < 0 ? 1 + MOOD * .8 : 1); AMB.lvl[k] = l; const g = { wind: .5, water: .22, rain: .16, waves: .5, crickets: .05, birds: .18, fire: .25 }[k]; AMB.ch[k].gain.setTargetAtTime(l * g, now, 1.2); }
  AMB.pad.gain.setTargetAtTime(.09 + .03 * MOOD, now, 2); AMB.lp.frequency.setTargetAtTime(800 + 450 * MOOD, now, 1.5); AMB.bus.gain.setTargetAtTime(vol * duck, now, duck < 1 ? .15 : .6);
}
