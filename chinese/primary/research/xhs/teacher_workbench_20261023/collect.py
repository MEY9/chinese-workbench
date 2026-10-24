"""Read-only Xiaohongshu research for the teacher-workbench review.

Search tokens are kept in a temporary file outside the repository and are
removed after detail collection. Saved project JSON contains no xsec tokens.
"""

import json
import re
import sys
import tempfile
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path.home() / ".codex" / "skills" / "xhs-research" / "scripts"))
from xhs_call import call, download  # noqa: E402

ROOT = Path(__file__).resolve().parent
TMP = Path(tempfile.gettempdir()) / "xhs_teacher_workbench_20261023_tokens.json"
KEYWORDS = [
    "小学语文老师 一天 工作流程",
    "教师工作台 教学管理 工具",
    "小学语文老师 备课 批改 作业",
    "班主任 每日待办 工作清单",
    "教师 备课本 教学计划",
    "小学语文 作文批改 记录表",
    "小学语文 听写 错词 统计",
    "教师 教学进度 班级管理",
]


def clean_search(feed):
    card = feed.get("noteCard") or {}
    info = card.get("interactInfo") or {}
    return {
        "id": feed.get("id"),
        "title": card.get("displayTitle") or "",
        "author": (card.get("user") or {}).get("nickname") or "",
        "type": card.get("type") or "",
        "liked": info.get("likedCount"),
        "collected": info.get("collectedCount"),
        "comments": info.get("commentCount"),
        "url": "https://www.xiaohongshu.com/explore/" + str(feed.get("id") or ""),
    }


def search():
    public, private = {}, {}
    for i, keyword in enumerate(KEYWORDS):
        if i:
            time.sleep(3.5)
        raw = None
        for attempt in range(3):
            if attempt:
                time.sleep(5)
            try:
                response = call("search_feeds", {"keyword": keyword})
                raw = json.loads(response[0]["text"])
                break
            except Exception as exc:
                print(f"search error {keyword} attempt {attempt + 1}: {exc}", flush=True)
        if raw is None:
            continue
        feeds = raw.get("feeds") or []
        public[keyword] = [clean_search(f) for f in feeds[:20]]
        for f in feeds:
            if f.get("id") and f.get("xsecToken"):
                private[f["id"]] = f["xsecToken"]
        print(f"{keyword}: {len(feeds)}")
        for j, item in enumerate(public[keyword][:12]):
            print(f"  {j:02d} {item['id']} 赞{item['liked']} 藏{item['collected']} {item['title']}", flush=True)
        (ROOT / "search_results.json").write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
        TMP.write_text(json.dumps(private), encoding="utf-8")


def details(ids):
    private = json.loads(TMP.read_text(encoding="utf-8"))
    found = []
    for i, feed_id in enumerate(ids):
        if i:
            time.sleep(3.5)
        if feed_id not in private:
            print(f"missing token: {feed_id}")
            continue
        try:
            response = None
            for attempt in range(2):
                try:
                    response = call("get_feed_detail", {"feed_id": feed_id, "xsec_token": private[feed_id]})
                    break
                except Exception:
                    if attempt:
                        raise
                    time.sleep(5)
            raw = json.loads(next(p["text"] for p in response if p.get("type") == "text"))
            data = raw.get("data") or {}
            note = data.get("note") or {}
            info = note.get("interactInfo") or {}
            comments = data.get("comments") or {}
            comments = comments.get("comments") or [] if isinstance(comments, dict) else comments
            item = {
                "id": feed_id,
                "url": "https://www.xiaohongshu.com/explore/" + feed_id,
                "title": note.get("title") or "",
                "type": note.get("type") or "",
                "author": (note.get("user") or {}).get("nickname") or "",
                "desc": note.get("desc") or "",
                "liked": info.get("likedCount"),
                "collected": info.get("collectedCount"),
                "commentCount": info.get("commentCount"),
                "comments": [(c.get("content") or "") for c in comments[:15]],
                "images": [],
            }
            for j, image in enumerate((note.get("imageList") or [])[:4]):
                url = image.get("urlDefault") or image.get("url")
                if not url:
                    continue
                name = f"{feed_id[:10]}_{j + 1:02d}.jpg"
                time.sleep(3.5)
                try:
                    download(url, ROOT / "images" / name)
                    item["images"].append("images/" + name)
                except Exception as exc:
                    print(f"image error: {feed_id} {j}: {exc}")
            found.append(item)
            (ROOT / "details.json").write_text(json.dumps(found, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"detail {i+1}/{len(ids)}: {feed_id} {item['title']} ({len(item['images'])} images)")
        except Exception as exc:
            print(f"detail error: {feed_id}: {exc}")
    (ROOT / "details.json").write_text(json.dumps(found, ensure_ascii=False, indent=2), encoding="utf-8")
    TMP.unlink(missing_ok=True)


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    elif sys.argv[1] == "details":
        details(sys.argv[2:])
