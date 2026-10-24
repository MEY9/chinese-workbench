"""Generate anonymous 2-class, 50-student, 20-week R1 acceptance data."""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs" / "acceptance" / "fixtures" / "R1-2班50人.json"
STAMP = "2026-10-23T00:00:00+08:00"


def main() -> None:
    state = {
        "version": 1,
        "classes": [
            {"id": "fixture-class-a", "name": "验收三（1）班", "grade": 3, "term": "上册", "publisher": "待绑定教材", "editionYear": "", "bookId": "", "createdAt": STAMP},
            {"id": "fixture-class-b", "name": "验收四（2）班", "grade": 4, "term": "上册", "publisher": "验收出版社", "editionYear": "2026", "bookId": "fixture-book-b", "createdAt": STAMP},
        ],
        "selectedClassId": "fixture-class-a",
        "students": [], "progress": [], "preps": [], "dictations": [], "assignments": [], "followups": [], "tasks": [],
        "customBooks": [{"bookId": "fixture-book-b", "publisher": "验收出版社", "grade": 4, "term": "上册", "editionYear": "2026", "title": "验收教材（无 PDF）", "file": "", "status": "待导入"}],
        "legacyWrong": [], "bankOverride": {},
        "settings": {"ai": {"key": "", "base": "https://api.deepseek.com", "model": "deepseek-flash"}, "voice": ""},
        "legacyLessonNo": None, "legacyPicks": {}, "createdAt": STAMP,
    }
    start = date(2026, 4, 6)
    for prefix, class_id, book_id in (("A", "fixture-class-a", ""), ("B", "fixture-class-b", "fixture-book-b")):
        for i in range(1, 51):
            state["students"].append({"id": f"fixture-{prefix}-student-{i:02}", "classId": class_id, "no": f"{i:02}", "name": f"{prefix}{i:02}号", "createdAt": STAMP})
        for week in range(1, 21):
            monday = start + timedelta(weeks=week - 1)
            state["progress"].append({"id": f"fixture-{prefix}-progress-{week}", "classId": class_id, "bookId": book_id, "lessonNo": str(week), "title": f"验收课次 {week}", "planDate": monday.isoformat(), "actualDate": monday.isoformat() if week < 20 else "", "status": "已上课" if week < 20 else "未开始", "note": "匿名验收数据", "createdAt": STAMP, "updatedAt": STAMP})
            for n, offset in enumerate((0, 2, 4), start=1):
                assigned = (monday + timedelta(days=offset)).isoformat()
                pending = week == 20 and n == 3
                state["assignments"].append({"id": f"fixture-{prefix}-assignment-{week}-{n}", "classId": class_id, "bookId": book_id, "lessonNo": str(week), "date": assigned, "content": f"验收作业 第{week}周 第{n}次", "participantCount": 50, "markedCount": 42 if pending else 50, "summary": "匿名测试记录", "issues": [{"tag": "字词", "text": "请复查同音字"}], "measures": "下次课讲评", "createdAt": STAMP, "updatedAt": STAMP})
        state["dictations"].append({"id": f"fixture-{prefix}-dictation", "classId": class_id, "bookId": book_id, "lessonNo": "20", "title": "验收词语听写", "date": "2026-10-23", "participantCount": 50, "markedCount": 40, "words": [{"w": "认真", "p": "rèn zhēn"}, {"w": "继续", "p": "jì xù"}], "wordErrors": {"认真": 8, "继续": 5}, "studentMarks": {}, "summary": "匿名测试记录", "measures": "下次课复查", "status": "待批改", "createdAt": STAMP, "updatedAt": STAMP})
        state["followups"].append({"id": f"fixture-{prefix}-followup", "classId": class_id, "bookId": book_id, "sourceType": "dictation", "sourceId": f"fixture-{prefix}-dictation", "kind": "复查", "title": "验收听写复查", "dueDate": "2026-10-23", "status": "待办", "studentIds": [], "result": "", "createdAt": STAMP, "updatedAt": STAMP})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"format": "teacher-workbench-r1", "version": 1, "exportedAt": STAMP, "state": state}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(state['students'])} students, {len(state['assignments'])} assignments)")


if __name__ == "__main__":
    main()
