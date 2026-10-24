"""Register one user-provided textbook PDF using a UTF-8 metadata JSON file.

Example: python register_textbook.py --metadata textbooks/entry.example.json
Chinese metadata stays in the JSON file rather than a shell command line.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from textbook_schema import validate_lessons

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "textbooks-manifest.json"
DEST = ROOT / "textbooks"


def main() -> None:
    parser = argparse.ArgumentParser(description="Register an offline primary Chinese textbook PDF")
    parser.add_argument("--metadata", type=Path, required=True, help="UTF-8 JSON with pdf, bookId, publisher, grade, term, editionYear and title")
    cli = parser.parse_args()
    try:
        metadata_path = cli.metadata.resolve(strict=True)
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        args = argparse.Namespace(
            pdf=metadata_path.parent / meta["pdf"],
            book_id=meta["bookId"],
            publisher=meta["publisher"],
            grade=int(meta["grade"]),
            term=meta["term"],
            edition_year=meta["editionYear"],
            title=meta["title"],
            page_count=meta.get("pageCount"),
            lessons=meta.get("lessons", []),
        )
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.error(f"invalid metadata JSON: {error}")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", args.book_id):
        parser.error("book-id must be 3–64 lowercase ASCII letters, digits or hyphens")
    if args.grade not in range(1, 7) or args.term not in ("上册", "下册"):
        parser.error("grade must be 1–6 and term must be 上册 or 下册")
    if not all(str(value).strip() for value in (args.publisher, args.edition_year, args.title)):
        parser.error("publisher, editionYear and title must not be empty")
    try:
        validate_lessons(args.lessons, args.page_count)
    except ValueError as error:
        parser.error(str(error))
    source = args.pdf.resolve(strict=True)
    if source.suffix.lower() != ".pdf":
        parser.error("source must be a PDF file")
    with source.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            parser.error("source does not have a PDF header")
    catalog = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if catalog.get("schemaVersion") != 1 or not isinstance(catalog.get("books"), list):
        parser.error("manifest has invalid schema")
    if any(book["bookId"] == args.book_id for book in catalog["books"]):
        parser.error("book-id already exists; existing files are never overwritten")
    if any(book["publisher"] == args.publisher and book["grade"] == args.grade and book["term"] == args.term and book["editionYear"] == args.edition_year for book in catalog["books"]):
        parser.error("this publisher/grade/term/edition is already registered")
    DEST.mkdir(exist_ok=True)
    target = DEST / f"{args.book_id}.pdf"
    if target.exists():
        parser.error("target PDF already exists; no overwrite performed")
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    shutil.copyfile(source, target)
    entry = {
        "bookId": args.book_id,
        "publisher": args.publisher.strip(),
        "grade": args.grade,
        "term": args.term,
        "editionYear": args.edition_year.strip(),
        "title": args.title.strip(),
        "sourceName": source.name,
        "file": target.name,
        "bytes": target.stat().st_size,
        "sha256": digest.hexdigest(),
        "contentVerified": False,
        "pageCount": args.page_count,
        "lessons": args.lessons,
    }
    catalog["books"].append(entry)
    MANIFEST.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"registered {entry['bookId']} ({entry['bytes']} bytes); textbook content remains unverified")


if __name__ == "__main__":
    main()
