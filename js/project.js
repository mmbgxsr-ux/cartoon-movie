// حفظ وفتح المشروع كملف JSON
(function () {
  const KEYS = ['cartoonScenes1', 'cartoonMovieSettings1', 'cartoonGround1', 'cartoonPulse1', 'mouths_v3', 'cartoonLastScene1', 'cartoonCast1', 'cartoonPlan1'];
  window.PROJECT_KEYS = KEYS;
  const say = t => { const m = document.getElementById('msg'); if (m) m.textContent = t; };
  document.getElementById('bPrjSave').onclick = () => {
    const data = {}; KEYS.forEach(k => { try { const v = Store.getItem(k); if (v != null) data[k] = v; } catch (_) {} });
    const blob = new Blob([JSON.stringify({ app: 'cartoon-movie', v: 1, date: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'project-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); say('تم حفظ المشروع');
  };
  document.getElementById('fPrj').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const magic = new Uint8Array(await f.slice(0, 2).arrayBuffer());
      if (magic[0] === 0x50 && magic[1] === 0x4B) { if (!window.CMPack) throw new Error('وحدة الحزمة غير محمّلة'); await CMPack.openZip(f); return; }   // حزمة كاملة .zip
      const o = JSON.parse(await f.text());
      if (!o || o.app !== 'cartoon-movie' || !o.data) throw new Error('ملف غير صالح');
      KEYS.forEach(k => { if (typeof o.data[k] === 'string') Store.setItem(k, o.data[k]); else if (!o.partial) Store.removeItem(k); });
      if (o.partial) Store.removeItem('cartoonLastScene1');
      say('تم فتح المشروع، جاري إعادة التحميل …'); setTimeout(() => Store.reload(), 600);
    } catch (err) { say('تعذّر فتح المشروع: ' + err.message); }
  };
})();
