// ===== حفظ الإعدادات في المتصفح =====
const SETK = 'cartoonMovieSettings1', SETIDS = ['rSize', 'rX', 'rMouth', 'rAmb', 'rRate', 'cHoles', 'cMouth', 'cAutoMouth', 'cTts', 'cEmb', 'cAmb', 'cChip', 'cSfx', 'cFx', 'cMood', 'cSync', 'sFps', 'cPar', 'cRim', 'cSym', 'cCel', 'cIris', 'cTwos', 'cOld', 'cLife', 'cMulti', 'cCam', 'cDof', 'rDof', 'cGrade', 'cPulse', 'cAutoBg', 'rEdge', 'rHalo', 'sMerge', 'rMergeT', 'sQ', 'sGm', 'sGv'];
(function () {
  let st = {}; try { st = JSON.parse(Store.getItem(SETK) || '{}'); } catch (_) {}
  const save = () => { try { const o = {}; SETIDS.forEach(id => { const e = $(id); if (e) o[id] = e.type === 'checkbox' ? e.checked : e.value; }); Store.setItem(SETK, JSON.stringify(o)); } catch (_) {} };
  SETIDS.forEach(id => { const e = $(id); if (!e) return; if (id in st) { if (e.type === 'checkbox') e.checked = !!st[id]; else e.value = st[id]; } e.addEventListener('change', save); e.addEventListener('input', save); });
  $('bResetSet').onclick = () => { try { Store.removeItem(SETK); } catch (_) {} Store.reload(); };
  $('vEdge').textContent = $('rEdge').value; $('vHalo').textContent = $('rHalo').value;
})();
