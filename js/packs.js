// أدوات عامة تنفع لأي درس: مكتبة شخصيات وأزياء جاهزة + صوت محيط يُختار لكل مشهد
(function () {
  const say = t => { const m = document.getElementById('msg'); if (m) m.textContent = t; };
  // ----- 1) صوت المكان لكل مشهد (بدل ربطه برقم الخلفية) -----
  const AMB_PRESETS = {
    nature: ['🌳 طبيعة وطيور', { wind: .3, birds: .6, water: .1 }], desert: ['🏜️ صحراء ورياح', { wind: .8 }], river: ['🌊 نهر وطيور', { water: .5, birds: .4, crickets: .2, wind: .2 }],
    sea: ['⛵ بحر وموج', { waves: .9, birds: .5, wind: .3 }], camp: ['🔥 معسكر ونار', { fire: 1, wind: .4, crickets: .3 }], rain: ['🌧️ مطر', { rain: .8, wind: .25, birds: .1 }],
    night: ['🌙 ليل وصراصير', { crickets: .7, wind: .2 }], city: ['🏙️ مدينة وسوق', { wind: .2, birds: .35 }], quiet: ['🤫 هدوء (قاعة/معمل)', {}]
  };
  window.AMB_OPTS = Object.keys(AMB_PRESETS).map(k => [k, AMB_PRESETS[k][0]]);
  if (typeof ambTick === 'function' && typeof AMBP !== 'undefined') {
    const _tick0 = ambTick;
    ambTick = function (s) {
      const am = s && (s.amb || (s.wx === 'rain' || s.wx === 'storm' ? 'rain' : !s.wx && s.lt === 'night' ? 'night' : null)), pr = am && AMB_PRESETS[am]; if (!pr) return _tick0(s);
      const k = s.map || s.bg || 1, old = AMBP[k]; AMBP[k] = pr[1]; try { return _tick0(s); } finally { if (old === undefined) delete AMBP[k]; else AMBP[k] = old; }
    };
  }
  // ----- 2) مكتبة الشخصيات والأزياء العامة -----
  const ROLES = [
    { key: 'king', name: 'الملك / الحاكم', top: '#7a1f3a', bottom: '#2f2540', acc: 'crown', accColor: '#d9a520', layer: 'cloak', layerColor: '#6d1f33', voice: 'Charon' },
    { key: 'general', name: 'القائد', top: '#4a3a2a', bottom: '#3b2f22', acc: 'helmet', accColor: '#9aa3ad', layer: 'armor', layerColor: '#9aa3ad', voice: 'Fenrir' },
    { key: 'soldier', name: 'الجندي', top: '#4d5560', bottom: '#3a3f47', acc: 'helmet', accColor: '#9aa3ad', voice: 'Puck' },
    { key: 'merchant', name: 'التاجر', top: '#8a5a2b', bottom: '#4a3a2a', acc: 'turban', accColor: '#b5452d', layer: 'sash', layerColor: '#d9a520', voice: 'Orus' },
    { key: 'farmer', name: 'الفلاح', top: '#a8935f', bottom: '#6b5a3a', acc: 'cap', accColor: '#e9e2d0', voice: 'Puck' },
    { key: 'scholar', name: 'العالِم', top: '#e9e2d0', bottom: '#d8cfb8', acc: 'turban', accColor: '#ffffff', layer: 'cloak', layerColor: '#3a5a7a', voice: 'Charon' },
    { key: 'sheikh', name: 'الشيخ الحكيم', top: '#d8cfb8', bottom: '#c8bfa6', acc: 'shemagh', accColor: '#f3ead2', layer: 'cloak', layerColor: '#5a4a32', voice: 'Orus' },
    { key: 'doctor', name: 'الطبيب / العالم', top: '#f2f2f2', bottom: '#4a5560', acc: '', accColor: '#ffffff', voice: 'Kore' },
    { key: 'teacher', name: 'المعلّم', top: '#3d5a80', bottom: '#2b2f3a', acc: '', accColor: '#ffffff', voice: 'Zephyr' },
    { key: 'student', name: 'الطالب', top: '#c8602a', bottom: '#3a4a6a', acc: 'cap', accColor: '#2f7a5a', voice: 'Leda' },
    { key: 'sailor', name: 'البحّار', top: '#e9e2d0', bottom: '#2f4a6a', acc: 'cap', accColor: '#2f4a6a', layer: 'sash', layerColor: '#b5452d', voice: 'Fenrir' },
    { key: 'child', name: 'الطفل / الفضولي', top: '#e0b020', bottom: '#4a6a3a', acc: '', accColor: '#ffffff', scale: .93, voice: 'Aoede' }
  ];
  window.CAST_ROLES = ROLES;
  function addRole(key) {
    const r = ROLES.find(x => x.key === key); if (!r) return false;
    const c = Object.assign({ id: 'r_' + key + '_' + Date.now().toString(36), scale: 1, voice: '' }, r); delete c.key;
    CAST.push(c); castSave(); if (window.castRender) window.castRender(); return c;
  }
  window.castAddRole = addRole;
  const anchor = document.getElementById('castAdd'); if (!anchor) return;
  const sel = document.createElement('select'); sel.id = 'roleSel'; sel.title = 'نوع الشخصية الجديدة'; ROLES.forEach(r => { const o = document.createElement('option'); o.value = r.key; o.textContent = r.name; sel.appendChild(o); });
  const btn = document.createElement('button'); btn.id = 'roleAdd'; btn.type = 'button'; btn.textContent = '➕ إضافة دور جاهز'; btn.onclick = () => { const c = addRole(sel.value); if (c) say('أُضيفت شخصية «' + c.name + '». عدّل اسمها (مثل «خالد») لتظهر في الحوار'); };
  anchor.parentNode.append(sel, btn);
})();
