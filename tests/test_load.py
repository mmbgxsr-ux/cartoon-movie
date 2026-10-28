"""اختبار الحمل: مشروع واقعي الحجم (15 خلفية 1280×720، 30 مشهدًا، 30 ملف صوت، لوحة وبطاقة).

معيار نجاح المرحلة 1 في الخطة: «فتح مشروع من 15 خلفية و30 مشهدًا دون تأخير ملحوظ وبلا فقدان بيانات».
الحدود الزمنية هنا سخية عمدًا (نحو 3 أضعاف القياس على Chromium بلا GPU) كي لا يفشل الاختبار بسبب بطء الجهاز،
لكنها تكشف أي تراجع كبير. الأزمنة الفعلية تُطبع (شغّل بـ -s لرؤيتها).
"""
import hashlib
import json
import time

import pytest

import bigproject

READY = "window.Store && Store.ready && typeof SHOTS !== 'undefined' && window.CMPack && CMPack.ready && document.getElementById('tabs').children.length > 0"


@pytest.fixture(scope="module")
def big(tmp_path_factory):
    return bigproject.build(tmp_path_factory.mktemp("big"))


def _digest(scenes):
    return hashlib.sha256(json.dumps([[s["text"], s.get("lines")] for s in scenes], ensure_ascii=False).encode()).hexdigest()


def _heap_mb(pg):
    return pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0")


def _open_tab(pg, selector):
    pg.evaluate("""sel => { const el = document.querySelector(sel), boxes = [...document.querySelectorAll('.panel > .box')];
        const j = boxes.findIndex(b => b.contains(el)); if (j >= 0) document.getElementById('tabs').children[j].click(); }""", selector)


def test_large_project_opens_saves_and_moves_without_loss(browser, base_url, big, tmp_path):
    times = {}
    scenes = big["scenes"]
    ctx = browser.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(base_url + "/index.html")
    page.wait_for_function(READY, timeout=30000)

    page.evaluate("s => Store.setItem('cartoonScenes1', s)", json.dumps(scenes))
    page.evaluate("Store.flush()")

    # 1) فتح المشروع (إعادة تحميل) بـ 30 مشهدًا
    t0 = time.time()
    page.reload()
    page.wait_for_function(READY + " && SHOTS.length === 30", timeout=60000)
    times["open_30_scenes"] = time.time() - t0
    assert times["open_30_scenes"] < 12, "فتح مشروع 30 مشهدًا استغرق %.1f ثانية" % times["open_30_scenes"]

    # 2) رفع 15 خلفية
    t0 = time.time()
    page.set_input_files("#fBg", [str(p) for p in big["bgs"]])
    page.wait_for_function("bgs.length === 15", timeout=120000)
    times["upload_15_backgrounds"] = time.time() - t0
    assert times["upload_15_backgrounds"] < 20

    # 3) رفع وفك ترميز 30 ملف صوت
    t0 = time.time()
    page.set_input_files("#fAud", [str(p) for p in big["auds"]])
    page.wait_for_function("SHOTS.filter(s => s.eb).length === 30", timeout=180000)
    times["upload_30_audio"] = time.time() - t0
    assert times["upload_30_audio"] < 30
    durations = page.evaluate("SHOTS.map(s => Math.round(s.eb.duration * 10))")
    page.set_input_files('input[data-pick="talk"]', str(big["sheet"]))
    page.set_input_files('input[data-pick="card1"]', str(big["card"]))
    page.wait_for_function("props.card1 && imgs.talk && imgs.talk._f", timeout=30000)

    # 4) واجهة المحرر تبقى سريعة مع 30 مشهدًا
    t0 = time.time()
    _open_tab(page, "#eList")
    page.wait_for_selector("#eList textarea", state="attached")
    assert page.locator("#eList textarea").count() >= 30
    times["open_editor"] = time.time() - t0
    assert times["open_editor"] < 3

    # 5) حفظ الحزمة
    _open_tab(page, "#bPkgSave")
    t0 = time.time()
    with page.expect_download(timeout=180000) as d:
        page.click("#bPkgSave")
    pkg = tmp_path / "big.zip"
    d.value.save_as(str(pkg))
    times["save_package"] = time.time() - t0
    assert times["save_package"] < 40
    heap = _heap_mb(page)
    assert heap < 400, "استهلاك الذاكرة مرتفع: %d ميجابايت" % heap

    # 6) نقل الحزمة إلى متصفح جديد (جهاز آخر)
    ctx2 = browser.new_context()
    p2 = ctx2.new_page()
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(base_url + "/index.html")
    p2.wait_for_function(READY, timeout=30000)
    t0 = time.time()
    p2.set_input_files("#fPrj", str(pkg))
    p2.wait_for_function("window.CMPack && CMPack.ready && bgs.length === 15 && SHOTS.length === 30 && SHOTS.filter(s => s.eb).length === 30", timeout=240000)
    times["import_package"] = time.time() - t0
    assert times["import_package"] < 60

    # 7) لا فقدان بيانات
    assert p2.evaluate("bgs.map(b => b.naturalWidth)") == [1280] * 15
    assert p2.evaluate("SHOTS.map(s => Math.round(s.eb.duration * 10))") == durations
    got = p2.evaluate("JSON.parse(Store.getItem('cartoonScenes1'))")
    assert len(got) == 30 and _digest(got) == _digest(scenes), "نصوص المشاهد تغيّرت بعد النقل"
    assert p2.evaluate("!!props.card1 && !!imgs.talk._f")
    assert "تعذّر" not in p2.evaluate("document.getElementById('msg').textContent")
    assert _heap_mb(p2) < 400

    # 8) إعادة فتح المشروع المستورد لا تفقد المشاهد
    p2.reload()
    p2.wait_for_function(READY + " && SHOTS.length === 30", timeout=60000)
    assert _digest(p2.evaluate("JSON.parse(Store.getItem('cartoonScenes1'))")) == _digest(scenes)

    print("\n" + "  ".join("%s=%.1fs" % (k, v) for k, v in times.items()) + "  heap=%dMB  zip=%.1fMB" % (heap, pkg.stat().st_size / 1048576))
    assert errs == []
    ctx.close()
    ctx2.close()


def test_startup_shows_progress_instead_of_looking_frozen(browser, base_url):
    """تجهيز اللوحات الافتراضية يستغرق ثوانيَ، فيجب أن تظهر رسالة تقدّم ثم تعود رسالة الإرشاد."""
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.add_init_script("""window.__msgs = []; document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('msg'); new MutationObserver(() => window.__msgs.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });""")
    pg.goto(base_url + "/index.html")
    pg.wait_for_function(READY + " && Object.keys(SH).every(n => !SHIMG[n] || imgs[n])", timeout=30000)
    pg.wait_for_timeout(300)
    msgs = pg.evaluate("window.__msgs")
    assert any(m.startswith("جاري تجهيز الشخصية") for m in msgs), msgs[:8]
    assert pg.evaluate("document.getElementById('msg').textContent").startswith("ارفع الخلفيات")
    ctx.close()
