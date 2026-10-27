// ===================== تصدير دقيق بدون تقطيع (WebCodecs) =====================
// يتقدّم المحرّك بخطوات زمنية ثابتة (1/30 أو 1/60 ثانية) ويرسم كل إطار كاملًا ثم يضغطه، فلا يتأثر الفيديو ببطء الجهاز.
// الصوت (التعليق + الطبيعة + الخطوات) يُحسب على ساعة افتراضية في سياق صوتي غير متصل ثم يُدمج مع الفيديو في ملف MP4.
const Mp4 = (() => {
  const enc = new TextEncoder();
  const cat = (...a) => { let n = 0; for (const x of a) n += x.length; const o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
  const u32 = v => new Uint8Array([v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]), u16 = v => new Uint8Array([v >>> 8 & 255, v & 255]), u8 = (...v) => new Uint8Array(v), z = n => new Uint8Array(n);
  const box = (type, ...p) => { const b = cat(...p); return cat(u32(b.length + 8), enc.encode(type), b); };
  const fbox = (type, ver, flags, ...p) => box(type, u8(ver, flags >>> 16 & 255, flags >>> 8 & 255, flags & 255), ...p);
  const table = arr => { const o = new Uint8Array(arr.length * 4), dv = new DataView(o.buffer); for (let i = 0; i < arr.length; i++) dv.setUint32(i * 4, arr[i] >>> 0); return o; };
  const MAT = cat(u32(0x10000), z(12), u32(0x10000), z(12), u32(0x40000000));
  const bytes = d => d instanceof Uint8Array ? d : new Uint8Array(d.buffer ? d.buffer : d);
  class Mux {
    constructor(o) { this.o = o; this.v = []; this.a = []; this.vd = null; this.ad = null; this.ak = o.audio; }
    addVideo(c, m) { const d = new Uint8Array(c.byteLength); c.copyTo(d); if (m && m.decoderConfig && m.decoderConfig.description && !this.vd) this.vd = bytes(m.decoderConfig.description).slice(); this.v.push({ d, key: c.type === 'key' }); }
    addAudio(c, m) { const d = new Uint8Array(c.byteLength); c.copyTo(d); if (m && m.decoderConfig && m.decoderConfig.description && !this.ad) this.ad = bytes(m.decoderConfig.description).slice(); this.a.push({ d, dur: c.duration ? Math.round(c.duration * this.o.sr / 1e6) : 1024 }); }
    finish() {
      const o = this.o, VT = 90000, AT = o.sr; if (!this.vd) throw new Error('لا توجد بيانات avcC');
      // أزمنة العيّنات
      let vdts = 0; this.v.forEach((s, i) => { s.dts = Math.round(i * VT / o.fps); s.dur = Math.round((i + 1) * VT / o.fps) - s.dts; });
      let adts = 0; this.a.forEach(s => { s.dts = adts; adts += s.dur; });
      const vDur = this.v.length ? this.v[this.v.length - 1].dts + this.v[this.v.length - 1].dur : 0, aDur = adts;
      const durMs = Math.round(Math.max(vDur / VT, aDur / AT) * 1000);
      const order = [...this.v.map((s, i) => ({ s, t: s.dts / VT, tr: 0 })), ...this.a.map(s => ({ s, t: s.dts / AT, tr: 1 }))].sort((x, y) => x.t - y.t || x.tr - y.tr);
      const mkAudioEntry = () => {
        const hdr = [z(6), u16(1), z(8), u16(o.ch), u16(16), u16(0), u16(0), u32((o.sr << 16) >>> 0)];
        if (o.audio === 'aac') {
          const asc = this.ad || u8(0x11, 0x90), dsi = cat(u8(5, asc.length), asc), dcd = cat(u8(4, 13 + dsi.length, 0x40, 0x15), z(3), u32(0), u32(0), dsi), sl = u8(6, 1, 2), es = cat(u8(3, 3 + dcd.length + sl.length), u16(0), u8(0), dcd, sl);
          return box('mp4a', ...hdr, fbox('esds', 0, 0, es));
        }
        let pre = 312; if (this.ad && this.ad.length >= 12) pre = this.ad[10] | this.ad[11] << 8;
        return box('Opus', ...hdr, box('dOps', u8(0, o.ch), u16(pre), u32(o.sr), u16(0), u8(0)));
      };
      const trak = (id, kind, ts, samples, entry, offs) => {
        const durTs = samples.length ? samples[samples.length - 1].dts + samples[samples.length - 1].dur : 0;
        const stts = []; let run = 0, last = -1; for (const s of samples) { if (s.dur === last) run++; else { if (run) stts.push(run, last); run = 1; last = s.dur; } } if (run) stts.push(run, last);
        const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
        const stbl = box('stbl', fbox('stsd', 0, 0, u32(1), entry), fbox('stts', 0, 0, u32(stts.length / 2), table(stts)), ...(kind === 'vide' ? [fbox('stss', 0, 0, u32(keys.length), table(keys))] : []),
          fbox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)), fbox('stsz', 0, 0, u32(0), u32(samples.length), table(samples.map(s => s.d.length))), fbox('stco', 0, 0, u32(samples.length), table(offs)));
        const minf = box('minf', kind === 'vide' ? fbox('vmhd', 0, 1, z(8)) : fbox('smhd', 0, 0, z(4)), box('dinf', fbox('dref', 0, 0, u32(1), fbox('url ', 0, 1))), stbl);
        const mdia = box('mdia', fbox('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(durTs), u16(0x55c4), u16(0)), fbox('hdlr', 0, 0, u32(0), enc.encode(kind), z(12), enc.encode(kind === 'vide' ? 'Video' : 'Audio'), u8(0)), minf);
        return box('trak', fbox('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(Math.round(durTs / ts * 1000)), z(8), u16(0), u16(0), u16(kind === 'soun' ? 0x100 : 0), u16(0), MAT, u32(kind === 'vide' ? o.w << 16 : 0), u32(kind === 'vide' ? o.h << 16 : 0)), mdia);
      };
      const ftyp = box('ftyp', enc.encode('isom'), u32(512), enc.encode('isomiso2avc1mp41'));
      const ve = box('avc1', z(6), u16(1), z(16), u16(o.w), u16(o.h), u32(0x480000), u32(0x480000), u32(0), u16(1), z(32), u16(0x18), u16(0xffff), box('avcC', this.vd));
      const build = (vo, ao) => box('moov', fbox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(durMs), u32(0x10000), u16(0x100), u16(0), z(8), MAT, z(24), u32(3)), trak(1, 'vide', VT, this.v, ve, vo), trak(2, 'soun', AT, this.a, mkAudioEntry(), ao));
      const size = build(this.v.map(() => 0), this.a.map(() => 0)).length;
      let pos = ftyp.length + size + 8; const vo = [], ao = []; for (const x of order) { (x.tr ? ao : vo).push(pos); pos += x.s.d.length; }
      const moov = build(vo, ao), tot = pos - (ftyp.length + size + 8);
      return new Blob([ftyp, moov, u32(tot + 8), enc.encode('mdat'), ...order.map(x => x.s.d)], { type: 'video/mp4' });
    }
  }
  return Mux;
})();

let EXP_CANCEL = false;
const yieldNow = (() => { const mc = new MessageChannel(); return () => new Promise(r => { mc.port1.onmessage = () => r(); mc.port2.postMessage(0); }); })();
async function exportExact(opt) {
  opt = opt || {};
  if (playing || busy || EXPORTING) { if (EXPORTING) EXP_CANCEL = true; return; }
  if (!bgs.length) { msg('اختر الخلفيات أولاً'); return; }
  if (!window.VideoEncoder || !window.AudioEncoder || !window.OfflineAudioContext || !window.VideoFrame) { msg('متصفحك لا يدعم التصدير الدقيق؛ استخدم Chrome حديثًا أو زر «تحميل الفيديو»'); return; }
  if (!useGem()) { msg('التصدير الدقيق يحتاج الصوت المرفق أو مفتاح Gemini (صوت الجهاز الآلي لا يمكن التقاطه)'); return; }
  busy = true; await EMBP; const okg = await genAll(); busy = false; if (!okg) return; recalc();
  const fps = +$('sFps').value || 30, TT = Math.min(TOTAL, opt.maxSec || TOTAL), N = Math.floor(TT * fps), SR = 48000, bitrate = +$('sQ').value || 1600000;
  let vcfg = null; for (const c of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']) { const cfg = { codec: c, width: W, height: H, bitrate: Math.max(bitrate, fps > 30 ? 2500000 : 0), framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' }; try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) { vcfg = cfg; break; } } catch (_) {} }
  if (!vcfg) { msg('هذا الجهاز لا يوفّر ضغط H.264 عبر المتصفح؛ استخدم زر «تحميل الفيديو»'); return; }
  let acfg = null, akind = 'aac'; for (const [c, k] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) { const cfg = { codec: c, sampleRate: SR, numberOfChannels: 2, bitrate: 128000 }; try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) { acfg = cfg; akind = k; break; } } catch (_) {} }
  if (!acfg) { msg('هذا الجهاز لا يوفّر ضغط الصوت؛ استخدم زر «تحميل الفيديو»'); return; }
  // حالة حيّة تُحفَظ ثم تُستعاد
  const S = { AC, DEST, AN, AMB, cur, noise: SFX.noise, ls: SFX.lastStep, lc: SFX.lastC, st: window.setTimeout, ct: window.clearTimeout, idx, t, MOOD };
  const mux = new Mp4({ w: W, h: H, fps, sr: SR, ch: 2, audio: akind });
  let err = null, venc = null, XT = 0, vq = [], vid = 1e9, off = null, t0 = performance.now();
  const btn = $('bExp'), label = btn.textContent; btn.textContent = '⏹ إلغاء التصدير'; EXP_CANCEL = false;
  try {
    venc = new VideoEncoder({ output: (c, m) => mux.addVideo(c, m), error: e => { err = e; } }); venc.configure(vcfg);
    off = new OfflineAudioContext(2, Math.ceil((TT + 1) * SR), SR);
    const proxy = new Proxy(off, { get(tg, p) { if (p === 'currentTime') return XT; if (p === 'state') return 'running'; if (p === 'resume') return () => Promise.resolve(); const v = tg[p]; return typeof v === 'function' ? v.bind(tg) : v; } });
    AC = proxy; DEST = off.createGain(); DEST.gain.value = 0; AN = off.createAnalyser(); AMB = null; cur = null; SFX.noise = null; SFX.lastStep = 0; SFX.lastC = -1; audioUntil = 0; MQ.length = 0; Object.assign(M, { open: 0, wide: 0, round: 0, act: 0 });
    // ساعة افتراضية للمؤقتات (طيور الخلفية والنار وتغيّر الوتر) حتى تتبع زمن الفيلم لا الزمن الحقيقي
    window.setTimeout = (fn, ms) => { const id = ++vid; vq.push({ id, at: XT + (ms || 0) / 1000, fn }); return id; };
    window.clearTimeout = id => { vq = vq.filter(x => x.id !== id); };
    const runDue = () => { for (;;) { let k = -1; for (let i = 0; i < vq.length; i++) if (vq[i].at <= XT && (k < 0 || vq[i].at < vq[k].at)) k = i; if (k < 0) break; const e = vq.splice(k, 1)[0]; try { e.fn(); } catch (_) {} } };
    SHOTS.forEach(x => { x.speaking = false; x.done = false; x.hold = 0; x.ci = -1; x._a0 = null; x._bn = null; });
    idx = 0; t = 0; spoken = false; playing = true; EXPORTING = true; EXP_END = false; MOOD = 0; clock = 0; wlOn(); ambStart();
    let done = 0;
    for (let i = 0; i < N; i++) {
      XT = i / fps; runDue(); tickSim(i === 0 ? 0 : 1 / fps); if (EXP_END) break;
      const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      while (venc.encodeQueueSize > 8 && !err) await yieldNow();
      if (err) { vf.close(); throw err; }
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close(); done = i + 1;
      if (i % 5 === 0) {
        const el = (performance.now() - t0) / 1000, rem = el / Math.max(1, i) * (N - i);
        msg('تصدير دقيق: ' + Math.round(i / N * 100) + '٪ — المتبقي نحو ' + (rem > 90 ? Math.ceil(rem / 60) + ' دقيقة' : Math.ceil(rem) + ' ثانية') + ' (أبقِ الشاشة مضاءة)');
        await yieldNow(); if (EXP_CANCEL) throw new Error('cancel');
      }
    }
    await venc.flush();
    // استعادة الحالة الحيّة قبل معالجة الصوت (لا حاجة للساعة الافتراضية بعد الآن)
    window.setTimeout = S.st; window.clearTimeout = S.ct; EXPORTING = false; playing = false;
    msg('جاري تجهيز الصوت…'); await yieldNow();
    const ab = await off.startRendering(), vdur = done / fps, total = Math.min(ab.length, Math.ceil(vdur * SR));
    let aerr = null; const aenc = new AudioEncoder({ output: (c, m) => mux.addAudio(c, m), error: e => { aerr = e; } }); aenc.configure(acfg);
    const c0 = ab.getChannelData(0), c1 = ab.getChannelData(1), B = 4800;
    for (let p = 0; p < total; p += B) {
      const n = Math.min(B, total - p), d = new Float32Array(2 * n); d.set(c0.subarray(p, p + n), 0); d.set(c1.subarray(p, p + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(p * 1e6 / SR), data: d }); aenc.encode(ad); ad.close();
      if (aerr) throw aerr; if ((p / B) % 20 === 0) await yieldNow();
    }
    await aenc.flush(); if (aerr) throw aerr;
    const blob = mux.finish(), a = $('dl'); a.href = URL.createObjectURL(blob); a.download = 'movie.mp4'; a.textContent = 'تحميل الفيديو (MP4 دقيق)';
    if (opt.onBlob) opt.onBlob(blob);
    msg('تم التصدير (' + (blob.size / 1048576).toFixed(1) + ' ميجابايت)' + (akind === 'opus' ? ' — الصوت بصيغة Opus لأن جهازك لا يضغط AAC' : '')); a.click();
  } catch (e) {
    msg(e && e.message === 'cancel' ? 'أُلغي التصدير' : 'تعذّر التصدير: ' + (e && e.message ? e.message : e)); console.error(e);
  } finally {
    window.setTimeout = S.st; window.clearTimeout = S.ct; EXPORTING = false; playing = false; try { venc && venc.state !== 'closed' && venc.close(); } catch (_) {}
    AC = S.AC; DEST = S.DEST; AN = S.AN; AMB = S.AMB; cur = S.cur; SFX.noise = S.noise; SFX.lastStep = S.ls; SFX.lastC = S.lc; idx = 0; t = 0; spoken = false; MOOD = 0; wlOff(); btn.textContent = label;
  }
}
$('bExp').onclick = () => exportExact();
window.exportExact = exportExact;
