// طبقة التخزين: واجهة متزامنة مثل localStorage، مدعومة بـ IndexedDB (سعة كبيرة)، مع ترحيل تلقائي من الإصدارات القديمة
(function () {
  const PASS = ['gk', 'cmTab'];            // تبقى في localStorage (مفتاح API وآخر تبويب)
  const cache = Object.create(null);
  let db = null, pending = [];
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const Store = {
    ready: false, persistent: false,
    getItem(k) { if (PASS.includes(k)) return localStorage.getItem(k); return k in cache ? cache[k] : null; },
    setItem(k, v) {
      if (PASS.includes(k)) return localStorage.setItem(k, v);
      v = String(v); cache[k] = v; if (!db) { try { localStorage.setItem(k, v); } catch (_) {} return; } Store._w(tx => tx.put(v, k));
    },
    removeItem(k) { if (PASS.includes(k)) return localStorage.removeItem(k); delete cache[k]; if (!db) { try { localStorage.removeItem(k); } catch (_) {} return; } Store._w(tx => tx.delete(k)); },
    keys() { return Object.keys(cache); },
    _w(fn) {
      if (!db) return;
      const p = new Promise((res, rej) => { try { const t = db.transaction('kv', 'readwrite'); fn(t.objectStore('kv')); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch (e) { rej(e); } });
      pending.push(p); p.catch(e => { Store.onError && Store.onError(e); });
    },
    flush() { return Promise.allSettled(pending.splice(0)); },
    reload() { return Store.flush().then(() => location.reload()); },
    usage() { return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null); },
    async init() {
      const LEGACY = ['cartoonScenes1', 'cartoonMovieSettings1', 'cartoonGround1', 'cartoonPulse1', 'mouths_v3', 'cartoonLastScene1'];
      try {
        db = await new Promise((res, rej) => { const o = indexedDB.open('cartoon-movie', 1); o.onupgradeneeded = () => o.result.createObjectStore('kv'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
        const st = db.transaction('kv').objectStore('kv');
        const [ks, vs] = await Promise.all([reqP(st.getAllKeys()), reqP(st.getAll())]);
        ks.forEach((k, i) => { cache[k] = vs[i]; });
        Store.persistent = true;
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      } catch (e) { db = null; }
      // ترحيل بيانات الإصدار القديم من localStorage (مرة واحدة)
      const keys = new Set(LEGACY); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !PASS.includes(k) && /^(cartoon|mouths_)/.test(k)) keys.add(k); }
      keys.forEach(k => { const v = localStorage.getItem(k); if (v != null && !(k in cache)) { cache[k] = v; if (db) Store._w(tx => tx.put(v, k)); } });
      if (db) await Store.flush();
      Store.ready = true;
    }
  };
  window.Store = Store;
  addEventListener('pagehide', () => { Store.flush(); });
})();
