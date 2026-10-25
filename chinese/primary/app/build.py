"""Build self-contained HTML; optional PDFs remain sidecar files."""
from __future__ import annotations

import os

import hashlib
import json
import re
from pathlib import Path

from textbook_schema import validate_lessons

ROOT = Path(__file__).resolve().parent


def inline_json(value: object) -> str:
    """Keep metadata inside one script element even with unusual book titles."""
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def build() -> None:
    template = (ROOT / "index.template.html").read_text(encoding="utf-8")
    css = (ROOT / "src" / "style.css").read_text(encoding="utf-8")
    js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
    bank = json.loads((ROOT / "bank.json").read_text(encoding="utf-8"))
    if not isinstance(bank.get("lessons"), list):
        raise ValueError("bank.json: lessons must be a list")
    manifest = json.loads((ROOT / "textbooks-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("books"), list):
        raise ValueError("textbooks-manifest.json: invalid schema")
    if os.environ.get("WB_CI"):
        # CI 模式:教材 PDF 不入库,构建零教材版(本地构建放置 PDF 后重新构建即可带教材)
        manifest = {"schemaVersion": 1, "books": []}
        print("WB_CI: building without bundled textbooks")
    seen = set()
    for book in manifest["books"]:
        required = ("bookId", "publisher", "grade", "term", "editionYear", "title", "file", "sha256")
        if any(not book.get(key) for key in required):
            raise ValueError(f"textbook entry missing field: {book!r}")
        if book["bookId"] in seen:
            raise ValueError(f"duplicate bookId: {book['bookId']}")
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", book["bookId"]) or book["file"] != book["bookId"] + ".pdf":
            raise ValueError(f"invalid bookId or PDF filename: {book['bookId']}")
        seen.add(book["bookId"])
        if book["grade"] not in range(1, 7) or book["term"] not in ("上册", "下册"):
            raise ValueError(f"invalid grade or term: {book['bookId']}")
        validate_lessons(book.get("lessons", []), book.get("pageCount"))
        path = (ROOT / "textbooks" / book["file"]).resolve()
        if not path.is_relative_to((ROOT / "textbooks").resolve()) or not path.is_file():
            raise ValueError(f"missing/unsafe PDF: {book['file']}")
        digest_calc = hashlib.sha256()
        with path.open("rb") as source:
            if path.suffix.lower() != ".pdf" or source.read(5) != b"%PDF-":
                raise ValueError(f"not a PDF: {book['file']}")
            source.seek(0)
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest_calc.update(chunk)
        digest = digest_calc.hexdigest()
        if digest.lower() != book["sha256"].lower():
            raise ValueError(f"PDF hash mismatch: {book['bookId']}")
    catalog = inline_json(manifest["books"])
    # PDF.js 引擎内联(v3 UMD):消灭运行时加载失败(file:// 与 http 均零依赖)
    pdfjs_dir = ROOT / "vendor" / "pdfjs"
    pdfjs_lib = (pdfjs_dir / "pdf.min.js").read_text(encoding="utf-8")
    pdfjs_worker = (pdfjs_dir / "pdf.worker.min.js").read_text(encoding="utf-8")
    # 防止内联 JS 中的 </script 提前闭合标签(字符串/正则内 \/ 语义等价)
    pdfjs_lib = pdfjs_lib.replace("</script", "<\\/script")
    pdfjs_worker = pdfjs_worker.replace("</script", "<\\/script")
    logo_b64 = (ROOT / 'design' / 'logo-b64.txt').read_text(encoding='utf-8').strip()
    output = (
        template.replace("__CSS__", css)
        .replace("__JS__", js)
        .replace("__BANK__", inline_json(bank))
        .replace("__TEXTBOOKS__", catalog)
        .replace("__LOGO_B64__", "data:image/png;base64," + logo_b64)
        .replace("<!--PDFJS_LIB-->", "<script>" + pdfjs_lib + "</script>")
        .replace("<!--PDFJS_WORKER-->", '<script type="text/plain" id="pdfjsWorkerCode">' + pdfjs_worker + "</script>")
    )
    if any(token in output for token in ("__CSS__", "__JS__", "__BANK__", "__TEXTBOOKS__", "PDFJS_LIB", "PDFJS_WORKER", "__LOGO_B64__")):
        raise ValueError("unresolved build placeholder")
    target_html = ROOT / "index.html"
    target_html.write_text(output, encoding="utf-8", newline="\n")
    (ROOT / "index.r1.html").write_text(output, encoding="utf-8", newline="\n")

    # 桌面壳加载的是本副本;保持与 Web 构建强一致,避免两份页面漂移
    desktop_renderer = ROOT.parent / "desktop" / "src" / "renderer" / "index.html"
    if desktop_renderer.parent.exists():
        desktop_renderer.write_text(output, encoding="utf-8", newline="\n")
    print(f"built {target_html} ({target_html.stat().st_size} bytes, {len(seen)} PDFs)")


if __name__ == "__main__":
    build()
