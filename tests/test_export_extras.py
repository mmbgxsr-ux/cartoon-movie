"""اختبارات إضافات التصدير: نطاق المشاهد، تقرير المشكلة، زر المشاركة، فحص النتيجة."""
import json

from test_app import SCENES, reload


def test_range_selects_follow_scenes(page):
    page.evaluate("Store.setItem('cartoonScenes1', %s)" % json.dumps(json.dumps(SCENES)))
    reload(page)
    page.focus("#sExpTo")   # يحدّث القوائم عند التركيز
    n = page.evaluate("SHOTS.length")
    assert page.eval_on_selector("#sExpFrom", "e => e.options.length") == n
    assert page.eval_on_selector("#sExpTo", "e => e.options.length") == n + 1
    assert page.eval_on_selector("#sExpTo", "e => e.value") == "-1"


def test_problem_report_has_key_info(page):
    rep = page.evaluate("expReport()")
    for key in ("المتصفح:", "VideoEncoder=", "الإعدادات:", "آخر عمليات التصدير:", "آخر الأخطاء:"):
        assert key in rep, key


def test_share_button_hidden_by_default(page):
    assert page.eval_on_selector("#bShare", "e => e.hidden") is True
    assert page.eval_on_selector("#bRep", "e => !!e.textContent.trim()") is True


def test_ready_real_walk_cycle_loads_into_studio(page):
    page.click("#tab2")   # الزر داخل تبويب «دورة المشي»، والتبويب الافتراضي «البدء السريع»
    page.click("#wcReal")
    page.wait_for_function("document.getElementById('wcGrid').children.length === 7", timeout=10000)
    assert page.evaluate("WALKPRESET.length") == 7
