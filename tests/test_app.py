"""اختبارات آلية لصانع الأفلام الكرتونية (Playwright + pytest).

التشغيل:
    pip install pytest playwright && python -m playwright install chromium
    python build.py && python -m pytest tests -v

الاختبارات تشغّل خادمًا محليًا على مجلد المشروع وتفتح index.html في Chromium، ولا تحتاج إنترنت ولا مفاتيح.
"""
import functools
import http.server
import json
import socketserver
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def _png(w, h):
    """صورة PNG رمادية متدرّجة صالحة، بلا مكتبات إضافية."""
    import struct
    import zlib
    raw = b"".join(b"\x00" + bytes((x * 255 // w) for x in range(w)) for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def _png_cells(w, h, cols, rows):
    """لوحة شخصيات تجريبية: خلفية بيضاء ومستطيل داكن في كل خانة من الشبكة."""
    import struct
    import zlib
    cw, ch = w // cols, h // rows
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            cx, cy = x % cw, y % ch
            dark = cw * .3 < cx < cw * .7 and ch * .15 < cy < ch * .85
            raw += b"\x20\x30\x40" if dark else b"\xff\xff\xff"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw))) + chunk(b"IEND", b"")


def _wav(seconds=2.0, rate=24000):
    """ملف WAV قصير (نغمة) لاستخدامه كصوت مرفوع بدل مفتاح Gemini."""
    import io
    import math
    import struct
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 220 * i / rate))) for i in range(int(seconds * rate))))
    return buf.getvalue()


def open_tab(pg, selector):
    """يفتح التبويب الذي يحتوي العنصر (الواجهة مقسّمة إلى تبويبات، وغير النشط منها مخفي)."""
    pg.evaluate("""sel => {
        const el = document.querySelector(sel), boxes = [...document.querySelectorAll('.panel > .box')];
        const j = boxes.findIndex(b => b.contains(el));
        if (j >= 0) document.getElementById('tabs').children[j].click();
    }""", selector)


def reload(pg):
    pg.evaluate("Store.flush()")
    pg.reload()
    # الوحدات تُحمَّل تباعًا (المحرر والتبويبات آخرها)، فننتظر اكتمال بناء الواجهة لا تعريف SHOTS فقط
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined' && document.getElementById('tabs').children.length > 0 && document.querySelector('#eList')", timeout=45000)


SCENES = [
    {"h": "مشهد أول", "bg": 1, "text": "نص المشهد الأول للاختبار", "acts": [[0, "wave"]], "props": []},
    {"h": "مشهد ثانٍ", "bg": 2, "text": "نص المشهد الثاني للاختبار", "acts": [[0, "talk"]], "props": []},
]


# ---------- 1) فتح الأداة ----------
def test_opens_without_errors(page):
    assert page.locator("#c").count() == 1
    assert page.locator("#tabs").evaluate("e => e.children.length") >= 5
    assert page.evaluate("SHOTS.length") >= 1
    assert page.evaluate("Store.persistent") is True, "يجب أن يعمل التخزين على IndexedDB"
    assert page.errors == []


def test_single_file_build_opens(browser):
    """نسخة الملف الواحد في dist تعمل أيضًا (file://)."""
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    dist = ROOT / "dist" / ("cartoon_movie_%s.html" % version)
    assert dist.exists(), "شغّل python build.py أولًا: %s" % dist.name
    ctx = browser.new_context()
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(dist.as_uri())
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined' && document.getElementById('tabs').children.length > 0", timeout=20000)
    assert errs == []
    ctx.close()


# ---------- 2) التخزين والحفظ ----------
def test_storage_survives_reload(page):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    reload(page)
    assert page.evaluate("SHOTS.length") == 2
    assert page.evaluate("SHOTS[1].text") == SCENES[1]["text"]
    assert page.errors == []


def test_project_save_and_open_roundtrip(page, tmp_path):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    open_tab(page, "#bPrjSave")
    with page.expect_download() as d:
        page.click("#bPrjSave")
    f = tmp_path / "project.json"
    d.value.save_as(str(f))
    saved = json.loads(f.read_text(encoding="utf-8"))
    assert saved["app"] == "cartoon-movie" and "cartoonScenes1" in saved["data"]

    # امسح المشاريع ثم افتح الملف المحفوظ
    page.evaluate("Store.removeItem('cartoonScenes1')")
    reload(page)
    assert page.evaluate("SHOTS.length") == 1
    page.set_input_files("#fPrj", str(f))
    page.wait_for_function("SHOTS.length === 2", timeout=15000)
    assert page.evaluate("SHOTS[0].text") == SCENES[0]["text"]


def test_invalid_project_file_is_rejected(page, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{ not json", encoding="utf-8")
    page.set_input_files("#fPrj", str(bad))
    page.wait_for_function("document.getElementById('msg').textContent.includes('تعذّر فتح المشروع')", timeout=5000)
    assert page.evaluate("SHOTS.length") >= 1  # لم تُمسح بيانات المستخدم


def test_project_with_corrupt_values_does_not_replace_current_data(page, tmp_path):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    bad = tmp_path / "corrupt.json"
    bad.write_text(json.dumps({"app": "cartoon-movie", "v": 1, "data": {"cartoonScenes1": "{ not json"}}), encoding="utf-8")
    page.set_input_files("#fPrj", str(bad))
    page.wait_for_function("document.getElementById('msg').textContent.includes('تعذّر فتح المشروع')", timeout=5000)
    assert page.evaluate("Store.getItem('cartoonScenes1')") == json.dumps(SCENES)  # المشروع الحالي كما هو


def test_partial_project_keeps_other_data(page, tmp_path):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    partial = tmp_path / "partial.json"
    partial.write_text(json.dumps({"app": "cartoon-movie", "v": 1, "partial": True, "data": {"cartoonPlan1": "خطة"}}), encoding="utf-8")
    page.set_input_files("#fPrj", str(partial))
    page.wait_for_timeout(1500)
    page.wait_for_function("window.Store && Store.ready", timeout=15000)
    assert page.evaluate("SHOTS.length") == 2, "الاستيراد الجزئي يجب ألا يمسح المشاهد"


def test_old_localstorage_is_migrated(browser, base_url):
    """بيانات v52 المخزّنة في localStorage تُرحَّل تلقائيًا إلى IndexedDB."""
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto(base_url + "/css/styles.css")  # نفس الأصل لضبط localStorage قبل فتح الأداة
    pg.evaluate("localStorage.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    pg.goto(base_url + "/index.html")
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined'", timeout=20000)
    assert pg.evaluate("SHOTS.length") == 2
    ctx.close()


# ---------- 3) الحفظ التلقائي للمحرر ----------
def test_editor_draft_autosaves_and_restores(page):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    reload(page)
    open_tab(page, "#eList")
    page.evaluate("""() => { const t = document.querySelector('#eList textarea'); t.value = 'نص جديد لم يُحفظ بعد'; t.dispatchEvent(new Event('input', {bubbles: true})); t.dispatchEvent(new Event('change', {bubbles: true})); }""")
    page.wait_for_function("Store.getItem('cartoonDraft1') && Store.getItem('cartoonDraft1').includes('نص جديد لم يُحفظ بعد')", timeout=8000)
    reload(page)
    assert "نص جديد لم يُحفظ بعد" in page.evaluate("document.querySelector('#eList textarea').value")
    assert "مسودة" in page.evaluate("document.getElementById('msg').textContent")
    # المشاهد المطبّقة نفسها لم تتغير حتى يضغط المستخدم «حفظ وتطبيق»
    assert page.evaluate("SHOTS[0].text") == SCENES[0]["text"]


# ---------- 4) رسائل الأخطاء ----------
@pytest.mark.parametrize("status,raw,expect", [
    (400, "API key not valid. Please pass a valid API key.", "مفتاح Gemini غير صحيح"),
    (403, "permission denied", "غير مصرّح"),
    (404, "model not found", "النموذج"),
    (429, "quota", "نفدت الحصة"),
    (503, "overloaded", "مشغولة"),
    (418, "", "418"),
])
def test_gemini_error_messages(page, status, raw, expect):
    msg = page.evaluate("([s, r]) => gemErr(s, r)", [status, raw])
    assert expect in msg


def test_network_error_message(page):
    assert "الإنترنت" in page.evaluate("errText(new TypeError('Failed to fetch'))")


def test_gemini_bad_key_shows_clear_message(page):
    page.route("https://generativelanguage.googleapis.com/**", lambda r: r.fulfill(
        status=400, content_type="application/json",
        body=json.dumps({"error": {"message": "API key not valid. Please pass a valid API key."}})))
    page.evaluate("document.getElementById('kKey').value = 'x'.repeat(20)")
    page.evaluate("genAll().then(ok => window.__ok = ok)")
    page.wait_for_function("window.__ok === false", timeout=10000)
    assert "مفتاح Gemini غير صحيح" in page.evaluate("document.getElementById('msg').textContent")


def test_storage_error_shows_banner(page):
    page.evaluate("Store.onError(new DOMException('full', 'QuotaExceededError'))")
    assert page.locator("#storeWarn").is_visible()
    assert "ممتلئة" in page.locator("#storeWarn").inner_text()


def test_unreadable_background_is_reported(page, tmp_path):
    bad = tmp_path / "broken.png"
    bad.write_bytes(b"not an image at all")
    page.set_input_files("#fBg", str(bad))
    page.wait_for_function("document.getElementById('msg').textContent.includes('تعذّر فتح')", timeout=8000)
    assert "broken.png" in page.evaluate("document.getElementById('msg').textContent")


# ---------- 5) التصدير ----------
def test_export_short_clip(page, tmp_path):
    """تصدير فيديو قصير. يُتخطى إن لم يدعم هذا المتصفح ترميز H.264."""
    supported = page.evaluate("""async () => {
        if (!window.VideoEncoder || !window.AudioEncoder) return false;
        for (const c of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
            try { const r = await VideoEncoder.isConfigSupported({ codec: c, width: 1280, height: 720, bitrate: 1e6, framerate: 30, avc: { format: 'avc' } }); if (r.supported) return true; } catch (_) {}
        }
        return false;
    }""")
    if not supported:
        pytest.skip("المتصفح لا يدعم ترميز H.264 (Chromium بدون ترميزات مغلقة)")
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps([dict(SCENES[0], text="نص قصير")])))
    reload(page)
    bg = tmp_path / "bg.png"
    bg.write_bytes(_png(640, 360))
    page.set_input_files("#fBg", str(bg))
    page.wait_for_function("bgs.length === 1", timeout=10000)
    aud = tmp_path / "01.wav"
    aud.write_bytes(_wav())
    page.set_input_files("#fAud", str(aud))
    page.wait_for_function("SHOTS[0].eb", timeout=10000)
    open_tab(page, "#bExp")
    page.click("#bExp")
    # ينتهي التصدير برسالة نجاح أو فشل؛ لا ننتظر المهلة كاملة إن فشل
    page.wait_for_function("document.getElementById('msg').textContent.startsWith('تم التصدير') || document.getElementById('msg').textContent.startsWith('تعذّر')", timeout=240000)
    msg = page.evaluate("document.getElementById('msg').textContent")
    assert msg.startswith("تم التصدير"), msg
    blob_size = page.evaluate("fetch(document.getElementById('dl').href).then(r => r.blob()).then(b => b.size)")
    head = page.evaluate("fetch(document.getElementById('dl').href).then(r => r.arrayBuffer()).then(b => Array.from(new Uint8Array(b, 4, 4)))")
    assert blob_size > 20000, "الفيديو أصغر من المتوقع (%d بايت)" % blob_size
    assert bytes(head) == b"ftyp", "الملف الناتج ليس MP4 صالحًا"
    assert page.evaluate("EXPORTING") is False


# ---------- 6) الحزمة الكاملة (.zip) ----------
def _make_package(page, tmp_path):
    """يرفع خلفيتين ولوحة وبطاقة وصوتًا ثم يحفظ الحزمة ويعيد (مسارها، الملفات المرفوعة)."""
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    page.evaluate("localStorage.setItem('gk', 'SECRET-KEY-123456789')")
    reload(page)
    files = {
        "bg1.png": _png(640, 360), "bg2.png": _png(320, 180),
        "sheet.png": _png_cells(400, 200, 2, 1), "card.png": _png_cells(200, 200, 1, 1), "01.wav": _wav(),
    }
    for name, data in files.items():
        (tmp_path / name).write_bytes(data)
    # شبكة غير افتراضية للوحة الإشارة (عمودان × صف واحد) تُحفظ في الحزمة
    page.evaluate("""() => { $('gc_point').value = 2; $('gr_point').value = 1; $('gc_point').onchange(); }""")
    page.set_input_files("#fBg", [str(tmp_path / "bg1.png"), str(tmp_path / "bg2.png")])
    page.set_input_files('input[data-pick="point"]', str(tmp_path / "sheet.png"))
    page.set_input_files('input[data-pick="card1"]', str(tmp_path / "card.png"))
    page.set_input_files("#fAud", str(tmp_path / "01.wav"))
    page.wait_for_function("bgs.length === 2 && imgs.point && imgs.point._f && props.card1 && SHOTS[0].eb", timeout=20000)
    open_tab(page, "#bPkgSave")
    with page.expect_download() as d:
        page.click("#bPkgSave")
    out = tmp_path / "package.zip"
    d.value.save_as(str(out))
    return out


def test_full_package_roundtrip_on_fresh_browser(browser, base_url, page, tmp_path):
    import zipfile
    pkg = _make_package(page, tmp_path)

    # محتوى الحزمة سليم، ولا يحتوي مفتاح API
    with zipfile.ZipFile(pkg) as z:
        assert z.testzip() is None
        names = z.namelist()
        man = json.loads(z.read("manifest.json"))
        assert len([n for n in names if n.startswith("bg/")]) == 2
        assert [n for n in names if n.startswith("sheets/")] and [n for n in names if n.startswith("props/")] and [n for n in names if n.startswith("audio/")]
        assert man["grids"]["point"] == [2, 1]
        assert all(b"SECRET-KEY" not in z.read(n) for n in names), "مفتاح Gemini تسرّب إلى الحزمة"

    # متصفح جديد تمامًا (تخزين فارغ) = جهاز آخر
    ctx = browser.new_context(accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base_url + "/index.html")
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined' && window.CMPack && CMPack.ready", timeout=20000)
    assert pg.evaluate("bgs.length") == 0 and pg.evaluate("SHOTS.length") == 1
    pg.set_input_files("#fPrj", str(pkg))
    pg.wait_for_function("window.CMPack && CMPack.ready && bgs.length === 2 && SHOTS.length === 2", timeout=60000)
    pg.wait_for_function("document.getElementById('msg').textContent.includes('تم استرجاع الحزمة')", timeout=20000)

    assert pg.evaluate("[bgs[0].naturalWidth, bgs[1].naturalWidth]") == [640, 320]
    assert pg.evaluate("imgs.point._f.name") == "sheet.png"
    assert pg.evaluate("SH.point.cols") == 2 and pg.evaluate("SH.point.rows.length") == 1
    assert pg.evaluate("frames.point.length") >= 1
    assert pg.evaluate("!!props.card1")
    assert pg.evaluate("!!SHOTS[0].eb") and pg.evaluate("SHOTS[0].eb.duration") > 1
    assert pg.evaluate("SHOTS[1].text") == SCENES[1]["text"]
    assert pg.evaluate("localStorage.getItem('gk')") is None
    assert "تعذّر" not in pg.evaluate("document.getElementById('msg').textContent")
    assert errs == []

    # الحزمة المستعادة يمكن حفظها من جديد (الملفات الأصلية محفوظة بعد الاستعادة)
    again = pg.evaluate("CMPack.build().then(r => ({ bg: r.man.assets.bg.length, sheets: Object.keys(r.man.assets.sheets), props: Object.keys(r.man.assets.props), audio: r.man.assets.audio.length }))")
    assert again == {"bg": 2, "sheets": ["point"], "props": ["card1"], "audio": 1}
    ctx.close()


def test_package_is_applied_only_once(page, tmp_path):
    pkg = _make_package(page, tmp_path)
    page.set_input_files("#fPrj", str(pkg))
    # ننتظر رسالة الاستعادة (تظهر بعد إعادة التحميل). شرط bgs.length وحده يتحقق في الصفحة القديمة قبل إعادة التحميل.
    page.wait_for_function("window.CMPack && CMPack.ready && document.getElementById('msg').textContent.includes('تم استرجاع الحزمة') && bgs.length === 2", timeout=60000)
    page.evaluate("bgs.length = 0")          # نفرّغ ثم نعيد التحميل: لا يجب أن تُعاد الخلفيات من حزمة معلّقة قديمة
    page.reload()
    page.wait_for_function("window.CMPack && CMPack.ready", timeout=20000)
    assert page.evaluate("bgs.length") == 0


@pytest.mark.parametrize("content", [b"PK\x03\x04 this is not really a zip file", b"PK" + bytes(40)])
def test_corrupt_package_is_rejected(page, tmp_path, content):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    reload(page)
    bad = tmp_path / "bad.zip"
    bad.write_bytes(content)
    page.set_input_files("#fPrj", str(bad))
    page.wait_for_function("document.getElementById('msg').textContent.includes('تعذّر فتح المشروع')", timeout=10000)
    assert page.evaluate("SHOTS.length") == 2, "فتح حزمة تالفة يجب ألا يمسح بيانات المستخدم"


# ---------- لحظات القرار ----------
def test_decision_moment_pauses_and_resumes(page, tmp_path):
    q = {"q": "سؤال تجريبي؟", "opts": ["أ", "ب", "ج"], "ans": 1, "why": "لأن ب هو الصحيح"}
    scenes = [dict(SCENES[0], text="نص قصير", q=q), dict(SCENES[1], text="نص ثانٍ")]
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(scenes)))
    reload(page)
    assert page.evaluate("SHOTS[0].q.ans") == 1 and page.evaluate("SHOTS[1].q") is None
    bg = tmp_path / "bg.png"
    bg.write_bytes(_png(640, 360))
    page.set_input_files("#fBg", str(bg))
    page.wait_for_function("bgs.length >= 1", timeout=10000)
    page.evaluate("begin()")
    page.wait_for_selector(".qBox", timeout=40000)
    assert page.evaluate("idx") == 0 and page.evaluate("QWAIT") is True
    t0 = page.evaluate("t")
    page.wait_for_timeout(1500)
    assert abs(page.evaluate("t") - t0) < 0.01, "يجب أن يتجمّد الزمن أثناء السؤال"
    page.click(".qOpt >> nth=1")
    assert page.locator(".qOpt.ok").count() == 1 and page.locator(".qWhy").is_visible()
    page.click(".qGo")
    assert page.locator(".qBox").count() == 0 and page.evaluate("QWAIT") is False
    page.wait_for_function("idx === 1", timeout=20000)
    assert page.errors == []


# ---------- تأثير الهولجرام ----------
def test_hologram_effect_changes_character_pixels(page, tmp_path):
    scenes = [dict(SCENES[0], text="نص قصير", noWalk=True, holo=True)]
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(scenes)))
    reload(page)
    assert page.evaluate("SHOTS[0].holo") is True
    bg = tmp_path / "bg.png"
    bg.write_bytes(_png(640, 360))
    page.set_input_files("#fBg", str(bg))
    page.wait_for_function("bgs.length >= 1", timeout=10000)
    grab = """() => { idx = 0; t = 2.5; tickSim(0.02); idx = 0; t = 2.5; tickSim(0.02);
        return Array.from(ctx.getImageData(0, 0, W, H).data); }"""
    page.evaluate("document.getElementById('cHolo').checked = false")
    off = page.evaluate(grab)
    page.evaluate("document.getElementById('cHolo').checked = true")
    on = page.evaluate(grab)
    diff = sum(1 for i in range(0, len(on), 4) if abs(on[i] - off[i]) + abs(on[i + 2] - off[i + 2]) > 60)
    assert diff > 500, "يجب أن يغيّر الهولجرام بكسلات الشخصية (تغيّر %d)" % diff
    assert page.errors == []


# ---------- التخزين المؤقت لإطارات الشخصية ----------
def test_sheet_frames_cache_is_reused_on_second_open(page):
    ready = "Object.keys(SH).every(n => !SHIMG[n] || frames[n])"
    page.wait_for_function(ready, timeout=120000)
    n = page.evaluate("Object.keys(SH).filter(n => SHIMG[n]).length")
    count = """async () => { const db = await new Promise((r, j) => { const q = indexedDB.open('cmFrameCache1', 1); q.onsuccess = () => r(q.result); q.onerror = j; });
        const c = await new Promise(r => { const q = db.transaction('sheets').objectStore('sheets').count(); q.onsuccess = () => r(q.result); }); db.close(); return c; }"""
    for _ in range(60):   # ننتظر اكتمال الحفظ في الخلفية
        if page.evaluate(count) >= n:
            break
        page.wait_for_timeout(2000)
    else:
        raise AssertionError("لم يُحفظ التخزين المؤقت")
    reload(page)
    page.wait_for_function(ready, timeout=60000)
    assert page.evaluate("FCACHE.hits") == n, "كل الصفحات يجب أن تُستعاد من التخزين المؤقت في الفتح الثاني"
    assert page.errors == []


# ---------- المخطط الزمني ----------
def _wav_phrases(rate=24000):
    """ثلاث «عبارات» (نغمات متقطعة) تفصل بينها وقفات، لتظهر حدود العبارات في المخطط."""
    import io
    import math
    import struct
    import wave
    pcm = []
    for dur, gap in ((1.2, .5), (1.0, .5), (1.4, 0)):
        for i in range(int(dur * rate)):
            env = min(1, i / 800, (int(dur * rate) - i) / 800)
            pcm.append(int(9000 * env * math.sin(2 * math.pi * 180 * i / rate) * (0.6 + 0.4 * math.sin(2 * math.pi * 4 * i / rate))))
        pcm += [0] * int(gap * rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", v) for v in pcm))
    return buf.getvalue()


def test_timeline_shows_audio_acts_and_props(page, tmp_path):
    scenes = [dict(SCENES[0], text="نص تجريبي للمخطط", acts=[[0, "wave"], [0.5, "talk"]], noWalk=True,
                   props=[{"id": "card1", "cap": "بطاقة", "f0": 0.2, "f1": 0.6}])]
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(scenes)))
    reload(page)
    aud = tmp_path / "01.wav"
    aud.write_bytes(_wav_phrases())
    page.set_input_files("#fAud", str(aud))
    page.wait_for_function("SHOTS[0].eb", timeout=15000)
    page.evaluate("document.getElementById('dTl').open = true")
    page.wait_for_function("document.getElementById('tlNote').textContent.includes('مدة الصوت')", timeout=5000)
    px = page.evaluate("""() => { const g = document.getElementById('tl').getContext('2d'), d = g.getImageData(0, 0, 900, 210).data; let green = 0, gold = 0, blue = 0;
        for (let i = 0; i < d.length; i += 4) { const r = d[i], gr = d[i + 1], b = d[i + 2];
          if (gr > 190 && r < 90 && b > 120 && b < 170) green++; else if (r > 220 && gr > 140 && gr < 190 && b < 80) gold++; else if (b > 90 && r < 70 && gr < 100) blue++; }
        return [green, gold, blue]; }""")
    assert px[0] > 50, "علامات الإيماءات (أخضر) غير مرسومة"
    assert px[2] > 500, "غلاف الصوت غير مرسوم"
    assert page.evaluate("analyzeAudio(AB(SHOTS[0])).ev.length") >= 1, "يجب أن تُكتشف حدود عبارات من الوقفات"
    assert page.errors == []


# ---------- المستمع يومئ في مشاهد الحوار ----------
def test_listener_nods_on_speaker_phrase_end(page):
    page.evaluate("CAST.push({id: 't1', name: 'ت', top: '#336699', bottom: '#222222', acc: '', accColor: '#ffffff', scale: 1, voice: ''})")
    scenes = [dict(SCENES[0], text="جملة أولى. جملة ثانية.", noWalk=True, spk="guide", cast=["guide", "t1"], acts=[[0, "talk"]])]
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(scenes)))
    reload(page)
    page.evaluate("CAST.push({id: 't1', name: 'ت', top: '#336699', bottom: '#222222', acc: '', accColor: '#ffffff', scale: 1, voice: ''})")
    page.wait_for_function("Object.keys(SH).every(n => !SHIMG[n] || frames[n])", timeout=120000)
    rots = page.evaluate("""() => {
        const out = [], ob = blit; blit = function (n, i, x, sc, dy, al, o) { if (n === 'talk' && o && o.mouth === 1 && o.dy !== undefined) out.push(o.rot); return ob.apply(this, arguments); };
        const s = SHOTS[0]; idx = 0; s._lk = null; let pos = 0.5, tt = 3;
        s.inT = .3; s.outT = .3; s.dur = 6; const cum = new Float32Array(501).map((_, k) => k); envOf = () => ({ ev: [1.0, 2.0], dur: 5, n: 500, cum, tot: 500 }); audioPos = () => pos;
        const rot = () => { out.length = 0; drawChar(s, tt); return out[0]; };
        const base = rot();            // قبل أي حدث: الميل الثابت فقط
        pos = 1.5; const c0 = clock; clock = c0; rot();    // مرّت نهاية العبارة الأولى: يبدأ العدّ
        clock = c0 + .22 + .27; const peak = rot();       // ذروة الإيماءة
        clock = c0 + 1.5; const after = rot();            // انتهت الإيماءة
        blit = ob; return { base, peak, after }; }""")
    assert abs(rots["peak"]) > abs(rots["base"]) + 0.02, rots
    assert abs(rots["after"] - rots["base"]) < 0.01, rots
    assert page.errors == []


def test_scene_title_html_is_not_executed(page):
    """عنوان مشهد خبيث (من درس مستورد) يجب أن يظهر نصًا ولا يُنفَّذ."""
    evil = [{"h": "<img src=x onerror=\"window.__xss=1\">", "bg": 1, "text": "نص تجريبي للمشهد", "acts": [[0, "talk"]]}]
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(evil)))
    reload(page)
    page.wait_for_timeout(500)
    assert page.evaluate("window.__xss") is None
    assert page.locator("#idxList img, #map img").count() == 0
    assert "onerror" in page.locator("#idxList").inner_text()


def test_delete_key_button_clears_key(page):
    open_tab(page, "#kDel")
    page.evaluate("document.getElementById('kKey').value = 'x'.repeat(20); document.getElementById('kKey').dispatchEvent(new Event('input'))")
    assert page.evaluate("localStorage.getItem('gk')") is not None
    page.click("#kDel")
    assert page.evaluate("document.getElementById('kKey').value") == ""
    assert page.evaluate("localStorage.getItem('gk')") is None


# ---------- 3) تناسق الإصدار والبناء ----------
def test_version_is_consistent():
    """VERSION يطابق عنوان index.html واسم ملف dist، وكل ملفات files.json موجودة."""
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    assert version.startswith("v")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "صانع الأفلام الكرتونية " + version in index, "index.html قديم: شغّل python build.py"
    assert (ROOT / "dist" / ("cartoon_movie_%s.html" % version)).exists()
    missing = [f for f in json.loads((ROOT / "files.json").read_text(encoding="utf-8")) if not (ROOT / f).exists()]
    assert missing == []


# ---------- 4) إمكانية الوصول ----------
_UNNAMED = """() => [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(el => !(
    el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title || el.closest('label') ||
    (el.id && document.querySelector('label[for="' + el.id + '"]')))).map(el => el.outerHTML.slice(0, 120))"""


def test_tabs_are_accessible_and_keyboard_navigable(page):
    assert page.get_attribute("#tabs", "role") == "tablist"
    n = page.evaluate("document.querySelectorAll('#tabs [role=tab]').length")
    assert n >= 5
    assert page.evaluate("document.querySelectorAll('#tabs [aria-selected=true]').length") == 1
    assert page.evaluate("[...document.querySelectorAll('#tabs [role=tab]')].every(t => document.getElementById(t.getAttribute('aria-controls')).getAttribute('aria-labelledby') === t.id)")
    page.evaluate("document.querySelector('#tabs [aria-selected=true]').focus()")
    before = page.evaluate("[...document.getElementById('tabs').children].findIndex(t => t.getAttribute('aria-selected') === 'true')")
    page.keyboard.press("ArrowLeft")   # الواجهة RTL: السهم الأيسر = القسم التالي
    after = page.evaluate("[...document.getElementById('tabs').children].findIndex(t => t.getAttribute('aria-selected') === 'true')")
    assert after == (before + 1) % n
    page.keyboard.press("Home")
    assert page.evaluate("document.getElementById('tabs').children[0].getAttribute('aria-selected')") == "true"


def test_all_form_controls_have_accessible_names(page):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    reload(page)
    for i in range(page.evaluate("document.getElementById('tabs').children.length")):
        page.evaluate("i => document.getElementById('tabs').children[i].click()", i)
        page.wait_for_timeout(100)
    page.wait_for_timeout(500)   # المراقب في js/a11y.js يعمل بتأخير قصير
    assert page.evaluate(_UNNAMED) == []


def test_live_regions_canvas_labels_and_boot_indicator(page):
    assert page.get_attribute("#msg", "aria-live") == "polite"
    assert page.get_attribute("#c", "aria-label")
    assert page.locator("#boot").count() == 0   # يُزال بعد اكتمال التحميل
    assert page.locator("a.skip").count() == 1



def test_beforeunload_guards_only_while_exporting(page):
    fire = "(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); return e.defaultPrevented; })()"
    assert page.evaluate(fire) is False          # الاستخدام العادي: لا نزعج المستخدم
    page.evaluate("EXPORTING = true")
    try:
        assert page.evaluate(fire) is True       # أثناء التصدير: يظهر تأكيد المتصفح
    finally:
        page.evaluate("EXPORTING = false")
    assert page.evaluate(fire) is False


def test_runtime_error_during_playback_resets_state(page):
    page.evaluate("playing = true; $('bPlay').textContent = 'إيقاف'")
    page.evaluate("dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }))")
    assert page.evaluate("playing") is False
    assert page.evaluate("$('bPlay').textContent") == "تشغيل"
    assert "boom" in page.evaluate("document.getElementById('msg').textContent")


def test_runtime_error_during_export_requests_cancel(page):
    page.evaluate("EXPORTING = true; EXP_CANCEL = false")
    try:
        page.evaluate("dispatchEvent(new ErrorEvent('error', { message: 'boom' }))")
        assert page.evaluate("EXP_CANCEL") is True
    finally:
        page.evaluate("EXPORTING = false; EXP_CANCEL = false")


def test_error_while_idle_is_ignored(page):
    page.evaluate("dispatchEvent(new ErrorEvent('error', { message: 'boom' }))")
    assert "boom" not in page.evaluate("document.getElementById('msg').textContent")
    assert page.evaluate("playing") is False and page.evaluate("EXP_CANCEL") is False
