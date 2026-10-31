"""يشغّل الاختبارات على عدة عمليات متوازية (كل عملية بمتصفحها وخادمها)، ويجمع النتيجة.

    python tests/run_parallel.py            # عدد العمليات = min(عدد الأنوية، 4)
    python tests/run_parallel.py 3 -k mouth # 3 عمليات، وما بعده يُمرَّر إلى pytest

شغّل python build.py أولًا (أحد الاختبارات يفتح نسخة الملف الواحد من dist/).
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(argv):
    n = None
    if argv and argv[0].isdigit():
        n, argv = int(argv[0]), argv[1:]
    n = n or min(os.cpu_count() or 1, 4)
    t0 = time.time()
    procs = []
    for i in range(n):
        env = dict(os.environ, TEST_SHARDS=str(n), TEST_SHARD=str(i))
        procs.append(subprocess.Popen([sys.executable, "-m", "pytest", "tests", "-q", "-p", "no:cacheprovider", *argv], cwd=ROOT, env=env,
                                      stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8"))
    code = 0
    for i, p in enumerate(procs):
        out, _ = p.communicate()
        tail = [ln for ln in out.strip().splitlines() if ln.strip()][-1:] or ["(لا مخرجات)"]
        print("شريحة %d/%d: %s" % (i + 1, n, tail[0]))
        if p.returncode not in (0, 5):          # 5 = لا اختبارات في هذه الشريحة (مع -k مثلًا)
            code = p.returncode or 1
            print(out[-3000:])
    print("الزمن: %.0f ثانية، النتيجة: %s" % (time.time() - t0, "نجاح" if code == 0 else "فشل"))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
