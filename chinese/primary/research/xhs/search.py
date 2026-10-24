# -*- coding: utf-8 -*-
import requests, json, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

KEYWORDS = [
    "语文老师 备课工具",
    "小学语文 效率工具",
    "语文老师 批改作文",
    "语文老师 出题 组卷",
    "小学语文 生字表",
    "语文老师 工作量",
    "老师 听写 默写",
    "语文老师 课件 资源",
]

out = {}
for i, kw in enumerate(KEYWORDS):
    payload = {"jsonrpc":"2.0","id":i+1,"method":"tools/call",
               "params":{"name":"search_feeds","arguments":{"keyword":kw,"filters":{"sort_by":"最多点赞"}}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        text = r.json()["result"]["content"][0]["text"]
        data = json.loads(text)
        feeds = data if isinstance(data, list) else data.get("feeds") or data.get("data") or []
        items = []
        for f in feeds[:12]:
            mb = f.get("modelType") or f
            note = f.get("noteCard") or f
            interact = note.get("interactInfo") or {}
            items.append({
                "id": f.get("id") or note.get("noteId"),
                "title": note.get("displayTitle") or f.get("displayTitle") or "",
                "liked": interact.get("likedCount"),
                "collected": interact.get("collectedCount"),
                "comments": interact.get("commentCount"),
                "xsec": f.get("xsecToken") or note.get("xsecToken"),
                "user": (note.get("user") or {}).get("nickname", ""),
            })
        out[kw] = items
        print(f"[{kw}] {len(items)} posts")
        for it in items[:6]:
            print(f"   {it['liked'] or '?'}赞 {it['collected'] or '?'}藏 | {it['title'][:40]}")
    except Exception as e:
        print(f"[{kw}] ERROR: {e}")
    time.sleep(3.5)

with open("search_results.json", "w", encoding="utf-8") as fp:
    json.dump(out, fp, ensure_ascii=False, indent=1)
print("saved search_results.json")
