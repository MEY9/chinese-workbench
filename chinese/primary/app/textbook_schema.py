"""Validation shared by textbook registration and the offline build."""

from __future__ import annotations

import re
from datetime import date as calendar_date


def validate_lessons(lessons: object, page_count: object = None) -> list[dict]:
    if not isinstance(lessons, list):
        raise ValueError("lessons must be a list")
    if page_count is not None and (type(page_count) is not int or page_count < 1):
        raise ValueError("pageCount must be a positive integer or null")
    seen: set[str] = set()
    for lesson in lessons:
        if not isinstance(lesson, dict):
            raise ValueError("each lesson must be an object")
        number = lesson.get("lessonNo")
        if not isinstance(number, str) or not number.strip() or number in seen:
            raise ValueError("lessonNo must be a unique nonempty string")
        seen.add(number)
        if not isinstance(lesson.get("title"), str) or not lesson["title"].strip():
            raise ValueError(f"lesson {number}: title is required")
        start, end = lesson.get("pageStart"), lesson.get("pageEnd")
        if type(start) is not int or type(end) is not int or start < 1 or end < start:
            raise ValueError(f"lesson {number}: invalid page range")
        if page_count is not None and end > page_count:
            raise ValueError(f"lesson {number}: page range exceeds pageCount")
        if not isinstance(lesson.get("verifiedBy"), str) or not lesson["verifiedBy"].strip():
            raise ValueError(f"lesson {number}: verifiedBy is required")
        date = lesson.get("verifiedAt")
        if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise ValueError(f"lesson {number}: verifiedAt must be YYYY-MM-DD")
        try:
            calendar_date.fromisoformat(date)
        except ValueError as error:
            raise ValueError(f"lesson {number}: verifiedAt is not a real date") from error
    return lessons
