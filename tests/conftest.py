"""fixtures مشتركة لكل ملفات الاختبار (خادم محلي، متصفح Chromium واحد للجلسة، صفحة نظيفة لكل اختبار)."""
import functools
import http.server
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
