// عدّاد الأداء (اختياري): افتح التطبيق مع ?perf=1 في الرابط
(function () {
  if (!PERF.on) return;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;top:6px;z-index:999;background:rgba(0,0,0,.75);color:#7CFC9A;font:11px/1.5 monospace;padding:4px 8px;border-radius:6px;direction:ltr;pointer-events:none';
  document.body.appendChild(box);
  let n = 0, sum = 0, max = 0, t0 = performance.now(), first = 0;
  PERF.log = [];
  PERF.add = (ms, dt) => {
    if (!first) first = performance.now();
    n++; sum += ms; if (ms > max) max = ms;
    const now = performance.now();
    if (now - t0 >= 1000) {
      const o = { fps: Math.round(n * 1000 / (now - t0)), avg: +(sum / n).toFixed(1), max: +max.toFixed(1), playing: !!playing };
      PERF.log.push(o); if (PERF.log.length > 600) PERF.log.shift();
      box.textContent = 'fps ' + o.fps + ' | draw avg ' + o.avg + 'ms max ' + o.max + 'ms | first frame ' + Math.round(first) + 'ms | ' + (o.playing ? 'play' : 'idle');
      n = 0; sum = 0; max = 0; t0 = now;
    }
  };
})();
