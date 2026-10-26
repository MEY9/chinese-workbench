"""Smoke test the future PDF intake without changing the live catalog."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from textbook_schema import validate_lessons

ROOT = Path(__file__).resolve().parent


def main() -> None:
    try:
        validate_lessons([{"lessonNo": "1", "title": "待核", "pageStart": 2, "pageEnd": 3}], 8)
    except ValueError as error:
        assert "verifiedBy" in str(error)
    else:
        raise AssertionError("unverified lesson must be rejected")
    with tempfile.TemporaryDirectory(prefix="pdf-pipeline-", dir=ROOT) as scratch:
        test_root = Path(scratch).resolve()
        if not test_root.is_relative_to(ROOT.resolve()):
            raise RuntimeError("temporary path escaped the app directory")
        (test_root / "src").mkdir()
        (test_root / "textbooks").mkdir()
        shutil.copytree(ROOT / "vendor", test_root / "vendor")
        (test_root / "design").mkdir()
        shutil.copyfile(ROOT / "design" / "logo-b64.txt", test_root / "design" / "logo-b64.txt")
        shutil.copytree(ROOT / "design" / "book-edition", test_root / "design" / "book-edition")
        for name in ("register_textbook.py", "build.py", "textbook_schema.py", "index.template.html", "bank.json"):
            shutil.copyfile(ROOT / name, test_root / name)
        for name in ("app.js", "style.css", "reliability.js"):
            shutil.copyfile(ROOT / "src" / name, test_root / "src" / name)
        (test_root / "textbooks-manifest.json").write_text('{"schemaVersion":1,"books":[]}', encoding="utf-8")
        source = test_root / "source.pdf"
        source.write_bytes(b"%PDF-1.4\n% pipeline fixture\n%%EOF\n")
        metadata = test_root / "entry.json"
        metadata.write_text(json.dumps({
            "pdf": "source.pdf", "bookId": "smoke-1a-2026", "publisher": "测试出版社",
            "grade": 1, "term": "上册", "editionYear": "2026", "title": "测试语文上册</script><script>alert(1)</script>",
            "pageCount": 8,
            "lessons": [{"lessonNo": "1", "title": "测试课", "pageStart": 2, "pageEnd": 3,
                         "verifiedBy": "测试员", "verifiedAt": "2026-10-23"}],
        }, ensure_ascii=False), encoding="utf-8")
        subprocess.run([sys.executable, str(test_root / "register_textbook.py"), "--metadata", str(metadata)], check=True, capture_output=True)
        manifest = json.loads((test_root / "textbooks-manifest.json").read_text(encoding="utf-8"))
        assert manifest["books"][0]["sourceName"] == "source.pdf"
        assert manifest["books"][0]["lessons"][0]["pageStart"] == 2
        subprocess.run([sys.executable, str(test_root / "build.py")], check=True, capture_output=True)
        built = (test_root / "index.html").read_text(encoding="utf-8")
        assert "测试语文上册" in built
        assert "测试语文上册</script>" not in built
        assert r"\u003c/script\u003e" in built
        (test_root / "textbooks" / "smoke-1a-2026.pdf").write_bytes(b"%PDF-1.4\nchanged")
        invalid = subprocess.run([sys.executable, str(test_root / "build.py")], capture_output=True)
        assert invalid.returncode != 0 and b"hash mismatch" in invalid.stderr
    print("PDF registration, lesson catalog, build and hash rejection passed")


if __name__ == "__main__":
    main()
