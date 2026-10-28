
const IN = 2, OUT = 1.2, RATE = 9.5, WAVE_HOLD = 2.6;   // WAVE_HOLD: مدة التلويح بالثواني بعد رفع اليد
const SHOTS = [
 { h: 'مشهد 1', bg: 1, acts: [[0, 'wave']], text: `اكتب هنا نص المشهد الأول من تبويب «المحرر».` }
];
// مشاهد مخصصة من محرر المشاهد (إن وُجدت) تحل محل مشاهد الدرس الافتراضي
try {
  const cs = JSON.parse(Store.getItem('cartoonScenes1') || 'null');
  if (Array.isArray(cs) && cs.length) {
    const hasL = x => Array.isArray(x.lines) && x.lines.some(l => l && String(l.t || '').trim());
    const ok = cs.filter(x => x && ((typeof x.text === 'string' && x.text.trim()) || hasL(x))).map(x => {
      const o = { h: String(x.h || 'مشهد'), bg: Math.min(15, Math.max(1, +x.bg || 1)), text: hasL(x) ? x.lines.map(l => String((l && l.t) || '').trim()).filter(Boolean).join(' ') : x.text.trim(), acts: Array.isArray(x.acts) && x.acts.length ? x.acts : [[0, 'talk']], props: Array.isArray(x.props) ? x.props : [] };
      if (x.spk) o.spk = String(x.spk); if (Array.isArray(x.cast) && x.cast.length) o.cast = x.cast.map(String); if (x.noWalk || o.spk || (o.cast && (o.cast.length > 1 || o.cast[0] !== 'guide'))) o.noWalk = true; if (hasL(x)) { o.lines = x.lines.filter(l => l && String(l.t || '').trim()).map(l => ({ spk: String(l.spk || 'guide'), t: String(l.t).trim() })); o.cast = [...new Set(o.lines.map(l => l.spk))]; o.spk = o.lines[0].spk === 'guide' ? undefined : o.lines[0].spk; if (o.cast.length > 1 || o.cast[0] !== 'guide') o.noWalk = true; }
      if (x.noFace) o.noFace = true; if (x.amb) o.amb = String(x.amb); if (x.era) o.era = String(x.era); if (x.year) o.year = String(x.year); if (x.pos && typeof x.pos === 'object' && Object.keys(x.pos).length) o.pos = x.pos; if (x.wear && typeof x.wear === 'object' && Object.keys(x.wear).length) o.wear = x.wear;
      if (x.run) o.run = true; if (x.out) o.out = x.out; if (+x.extra) o.extra = +x.extra; return o;
    });
    if (ok.length) SHOTS.splice(0, SHOTS.length, ...ok);
  }
} catch (_) {}
SHOTS.forEach((s, i) => {
  s.cam = i % 4; s.mood = (s.acts || []).some(a => a[1] === 'sad') ? -1 : (s.acts || []).some(a => a[1] === 'awe' || a[1] === 'joy') ? 1 : 0;
  s.inT = s.noWalk ? 0.5 : (s.run ? 1.3 : IN); s.outT = s.noWalk ? 0.5 : (s.out === 'turnaway' ? 2.1 : s.run ? .9 : OUT);
  s.main = Math.max(6, s.text.length / RATE) + (s.extra || 0);
  s.dur = s.inT + s.main + s.outT; s.map = s.bg;
  s.x = 0.2;
});
let TOTAL = SHOTS.reduce((a, s) => a + s.dur, 0);

const cv = document.getElementById('c'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, $ = id => document.getElementById(id);
const msg = t => { $('msg').textContent = t || ''; };
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const eq = r => Array.from({ length: r }, (_, i) => [i / r, (i + 1) / r]);

const SH = {
  walk:  { label: 'المشي (جانبي)',      cols: 8, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 10, th: 407, foot: .014, g: [8, 1], pp: true },
  wave:  { label: 'التلويح',            cols: 5, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 14, th: 420, foot: .03, g: [5, 2] },
  talk:  { label: 'الإيماءات (16)',     cols: 4, rows: eq(4), H: 1, pad: 0, badge: 0, tol: 10, th: 420, foot: .04, g: [4, 4] },
  point: { label: 'الإشارة',            cols: 3, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 12, th: 420, foot: .05, g: [3, 2] },
  think: { label: 'التفكير',            cols: 3, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 12, th: 420, foot: .05, g: [3, 2] },
  sad:   { label: 'الحزن',              cols: 3, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 12, th: 405, foot: .05, g: [3, 2] },
  awe:   { label: 'الدهشة',             cols: 3, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 12, th: 440, foot: .05, g: [3, 2] },
  sit:   { label: 'الجلوس',             cols: 3, rows: eq(2), H: 1, pad: 0, badge: 0, tol: 12, th: 336, foot: .04, g: [3, 2] },
  back:  { label: 'المشي بالظهر',       cols: 8, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 12, th: 440, foot: .10, g: [8, 1] },
  run:   { label: 'الجري (جانبي)',      cols: 6, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 10, th: 431, foot: .014, g: [6, 1], nm: true, lift: [0, 0, .149, 0, 0, .149] },
  joy:   { label: 'الفرح',              cols: 4, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 12, th: 405, foot: .05, g: [4, 1], nm: true, axl: true, lift: [0, 0, 0, .21] },
  pointup: { label: 'الإشارة للأعلى',   cols: 2, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 12, th: 453, foot: .05, g: [2, 1], nm: true, axl: true },
  turn:  { label: 'الالتفات',           cols: 4, rows: eq(1), H: 1, pad: 0, badge: 0, tol: 12, th: 420, foot: .05, g: [4, 1], nm: true, axl: true }
};
const PROPS = [['card1', 'بطاقة 1'], ['card2', 'بطاقة 2'], ['card3', 'بطاقة 3'], ['card4', 'بطاقة 4'], ['card5', 'بطاقة 5']];
const bgs = [], imgs = {}, frames = {}, props = {};
