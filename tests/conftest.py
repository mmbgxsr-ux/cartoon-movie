"""fixtures مشتركة لكل ملفات الاختبار (خادم محلي، متصفح Chromium واحد للجلسة، صفحة نظيفة لكل اختبار)."""
import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

# ---- تقسيم الاختبارات على عدة عمليات (بلا إضافات خارجية) ----
# TEST_SHARDS=N TEST_SHARD=i (من 0) يشغّل شريحة واحدة. التوزيع حتمي ومتوازن بالأوزان التقريبية (ثوانٍ) أدناه:
# الأوزان للتوازن فقط: لو أصبحت قديمة يسوء التوازن ولا يتأثر الصواب. الاختبار غير المذكور وزنه DEFAULT_WEIGHT.
DEFAULT_WEIGHT = 5
WEIGHTS = {
    "test_hologram_effect_changes_character_pixels": 44, "test_large_project_opens_saves_and_moves_without_loss": 34,
    "test_decision_moment_pauses_and_resumes": 21, "test_full_package_roundtrip_on_fresh_browser": 20,
    "test_export_short_clip": 19, "test_package_is_applied_only_once": 18, "test_test_export_makes_short_preview_without_downloading": 18,
    "test_project_save_and_open_roundtrip": 13, "test_autosave_offers_restore_after_unclean_exit": 12, "test_autosave_ignore_discards_snapshot": 12,
    "test_editor_draft_autosaves_and_restores": 12, "test_sheet_frames_cache_is_reused_on_second_open": 11, "test_generate_audio_stops_after_test_export_window": 11,
    "test_all_form_controls_have_accessible_names": 9, "test_partial_project_keeps_other_data": 9, "test_corrupt_package_is_rejected": 8, "test_storage_survives_reload": 8,
}


def _weight(item):
    return WEIGHTS.get(getattr(item, "originalname", None) or item.name, DEFAULT_WEIGHT)


def shard_of(items, total):
    """يعيد قائمة بالفهرس (0..total-1) لكل عنصر: الأثقل أولًا إلى أخف شريحة (LPT)، حتميًا."""
    order = sorted(range(len(items)), key=lambda i: (-_weight(items[i]), items[i].nodeid))
    load, out = [0.0] * total, [0] * len(items)
    for i in order:
        k = min(range(total), key=lambda j: (load[j], j))
        out[i] = k
        load[k] += _weight(items[i])
    return out


def pytest_collection_modifyitems(config, items):
    total = int(os.environ.get("TEST_SHARDS", "1") or 1)
    if total <= 1:
        return
    idx = int(os.environ.get("TEST_SHARD", "0") or 0)
    if not 0 <= idx < total:
        raise pytest.UsageError("TEST_SHARD يجب أن يكون بين 0 و TEST_SHARDS-1")
    owner = shard_of(items, total)
    keep = [it for it, k in zip(items, owner) if k == idx]
    drop = [it for it, k in zip(items, owner) if k != idx]
    config.hook.pytest_deselected(items=drop)
    items[:] = keep


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
