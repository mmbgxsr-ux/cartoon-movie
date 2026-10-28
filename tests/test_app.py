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


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(_Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield "http://127.0.0.1:%d" % srv.server_address[1]
    srv.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        yield b
        b.close()


@pytest.fixture()
def page(browser, base_url):
    """صفحة جديدة بسياق نظيف (تخزين فارغ) مع تجميع أخطاء الكونسول."""
    ctx = browser.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append("pageerror: %s" % e))
    pg.on("console", lambda m: pg.errors.append("console: %s" % m.text) if m.type == "error" else None)
    pg.goto(base_url + "/index.html")
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined' && document.getElementById('tabs').children.length > 0", timeout=20000)
    yield pg
    ctx.close()


def _png(w, h):
    """صورة PNG رمادية متدرّجة صالحة، بلا مكتبات إضافية."""
    import struct
    import zlib
    raw = b"".join(b"\x00" + bytes((x * 255 // w) for x in range(w)) for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


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
    pg.wait_for_function("window.Store && Store.ready && typeof SHOTS !== 'undefined'", timeout=20000)


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
    dist = next((ROOT / "dist").glob("cartoon_movie_v*.html"))
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
