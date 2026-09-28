#!/usr/bin/env python3
"""Run the full suite without pytest. `python3 -m pytest tests/` also works."""
import contextlib, io, sys, traceback
sys.path.insert(0, "tests"); sys.path.insert(0, ".")
import test_model, test_live_path


class _Capsys:
    def __init__(self): self.buf = io.StringIO()
    def readouterr(self):
        class R: pass
        r = R(); r.out = self.buf.getvalue(); r.err = ""; return r


passed = failed = 0
for mod in (test_model, test_live_path):
    for name in sorted(n for n in dir(mod) if n.startswith("test_")):
        fn = getattr(mod, name)
        try:
            args = fn.__code__.co_varnames[:fn.__code__.co_argcount]
            if "capsys" in args:
                cap = _Capsys()
                with contextlib.redirect_stdout(cap.buf):
                    fn(cap)
            else:
                fn()
            passed += 1; print(f"  PASS  {mod.__name__}.{name}")
        except Exception as exc:
            failed += 1; print(f"  FAIL  {mod.__name__}.{name}: {exc}")
            traceback.print_exc(limit=1)
print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
