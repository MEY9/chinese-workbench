"""Build the required full Windows installer with all registered textbooks."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / 'app'
env = dict(os.environ)
for name in ('WB_CI', 'WB_PUBLIC_PACKAGE', 'WB_PACKAGE_DIR'):
    env.pop(name, None)
manifest = json.loads((APP / 'textbooks-manifest.json').read_text(encoding='utf-8'))
if not manifest['books']:
    raise RuntimeError('Full releases must contain textbooks')
# build.py validates source PDF paths and hashes before any packaging.
subprocess.run([sys.executable, 'build.py'], cwd=APP, env=env, check=True)
resource_dir = ROOT / 'resources' / 'textbooks'
resource_dir.mkdir(parents=True, exist_ok=True)
for book in manifest['books']:
    shutil.copy2(APP / 'textbooks' / book['file'], resource_dir / book['file'])
subprocess.run(['node', 'node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never'], cwd=ROOT, env=env, check=True)
subprocess.run([sys.executable, str(APP / 'test_release.py')], cwd=ROOT, env=env, check=True)
version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
source = ROOT / 'dist' / f'语文工作台 Setup {version}.exe'
output = ROOT / 'dist' / 'release'
output.mkdir(exist_ok=True)
target = output / f'Setup-{version}-full-with-textbooks.exe'
shutil.copy2(source, target)
with target.open('rb') as handle:
    digest = hashlib.file_digest(handle, 'sha256').hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n', encoding='utf-8')
print(f'FULL RELEASE READY: {target.name}; {len(manifest["books"])} textbooks; {target.stat().st_size} bytes; SHA256 {digest}')
