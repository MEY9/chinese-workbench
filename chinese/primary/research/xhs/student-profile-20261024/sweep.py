# -*- coding: utf-8 -*-
"""学生档案+AI建议 定向调研"""
import requests, json, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
KEYWORDS = [
    "期末评语 班主任",
    "学生成长档案",
    "学生 个别情况 记录 老师",
    "学情分析 老师",
    "后进生 转化 记录",
    "家校沟通 记录 班主任",
    "班级优化大师 使用",
    "AI 批改 学情",
    "学生评语 生成 AI",
    "特殊学生 关注 班主任",
]
out = {}
for kw in KEYWORDS:
    payload = {"jsonrpc":"2.0","id":1,"method":"tools/call",
               "params":{"name":"search_feeds","arguments":{"keyword":kw,"filters":{"sort_by":"最多点赞"}}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        d = json.loads(r.json()["result"]["content"][0]["text"])
        feeds = d if isinstance(d, list) else d.get("feeds") or d.get("data") or []
        items = []
        for f in feeds[:12]:
            note = f.get("noteCard") or f
            inter = note.get("interactInfo") or {}
            items.append({"id": f.get("id") or note.get("noteId"),
                          "title": note.get("displayTitle") or "",
                          "liked": inter.get("likedCount"),
                          "collected": inter.get("collectedCount"),
                          "xsec": f.get("xsecToken") or note.get("xsecToken")})
        out[kw] = items
        print(f"[{kw}] {len(items)} 帖")
    except Exception as e:
        out[kw] = []
        print(f"[{kw}] ERROR {str(e)[:80]}")
    time.sleep(3.2)
json.dump(out, open("sweep.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("total:", sum(len(v) for v in out.values()))
