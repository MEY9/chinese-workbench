"""Repeatable local release gate; uses synthetic data and temporary databases only."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
DESKTOP = ROOT.parent / 'desktop'
checks = [
    (['node', '--check', 'src/app.js'], ROOT, None),
    (['node', '--check', 'src/reliability.js'], ROOT, None),
    (['node', 'test_r1_data.cjs'], ROOT, None),
    (['node', 'test_r1_storage.cjs'], ROOT, None),
    (['node', 'test_workflows.cjs'], ROOT, None),
    (['node', '../docs/acceptance/test_review_fixes.cjs'], ROOT, None),
    ([sys.executable, '-m', 'unittest', 'test_sqlite_server.py', 'test_reliability_server.py'], ROOT, None),
    ([sys.executable, 'test_textbook_pipeline.py'], ROOT, None),
    ([str(DESKTOP / 'node_modules/electron/dist/electron.exe'), 'test-store.mjs'], DESKTOP, dict(os.environ, ELECTRON_RUN_AS_NODE='1')),
    (['node', 'test-package.mjs'], DESKTOP, None),
]
for command, cwd, env in checks:
    print('CHECK:', ' '.join(command), flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True, timeout=120)
print('ALL 10 LOCAL RELEASE CHECKS PASSED. Visual, installed-app and real teacher acceptance remain separate gates.')
