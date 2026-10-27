// زر التشغيل العلوي: يضغط زر التشغيل الأصلي ويعكس حالته ونصه
(function () {
  const top = document.getElementById('bPlayTop'), main = document.getElementById('bPlay'), info = document.getElementById('info'), it = document.getElementById('infoTop');
  const sync = () => { top.textContent = main.textContent; top.className = main.className; it.textContent = info.textContent; };
  top.onclick = () => main.click();
  new MutationObserver(sync).observe(main, { childList: true, characterData: true, subtree: true, attributes: true });
  new MutationObserver(sync).observe(info, { childList: true, characterData: true, subtree: true });
  sync();
})();
