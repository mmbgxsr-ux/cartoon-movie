"""تقسيم الاختبارات على شرائح (TEST_SHARDS/TEST_SHARD): الشرائح متباعدة وتغطي المجموعة كلها بلا تكرار أو نقص."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def _collect(**extra):
    env = {k: v for k, v in os.environ.items() if k not in ("TEST_SHARDS", "TEST_SHARD")}
    env.update({k: str(v) for k, v in extra.items()})
    r = subprocess.run([sys.executable, "-m", "pytest", "tests", "--collect-only", "-q", "-p", "no:cacheprovider"],
                       cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
    assert r.returncode in (0, 5), r.stdout + r.stderr
    return [ln for ln in r.stdout.splitlines() if "::" in ln]


@pytest.mark.parametrize("n", [2, 3])
def test_shards_partition_the_whole_suite(n):
    everything = _collect()
    assert len(everything) > 20
    parts = [_collect(TEST_SHARDS=n, TEST_SHARD=i) for i in range(n)]
    flat = [t for p in parts for t in p]
    assert sorted(flat) == sorted(everything)             # لا نقص ولا تكرار
    assert all(len(p) >= len(everything) // (n * 2) for p in parts)   # لا شريحة شبه فارغة


def test_invalid_shard_index_is_a_usage_error():
    env = dict(os.environ, TEST_SHARDS="2", TEST_SHARD="5")
    r = subprocess.run([sys.executable, "-m", "pytest", "tests", "--collect-only", "-q", "-p", "no:cacheprovider"],
                       cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
    assert r.returncode != 0
