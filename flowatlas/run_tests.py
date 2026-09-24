#!/usr/bin/env python3
"""Run the test suite without pytest. `python3 -m pytest tests/` also works."""
import sys, traceback
sys.path.insert(0, "tests"); sys.path.insert(0, ".")
import test_model as T

fns = [getattr(T, n) for n in sorted(dir(T)) if n.startswith("test_")]
passed = failed = 0
for f in fns:
    try:
        f(); passed += 1; print(f"  PASS  {f.__name__}")
    except Exception as exc:
        failed += 1
        print(f"  FAIL  {f.__name__}: {exc}")
        traceback.print_exc(limit=1)
print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
