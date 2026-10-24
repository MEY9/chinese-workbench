# -*- coding: utf-8 -*-
"""功能定向调研:12 组关键词,每组取前 14 帖(按最多点赞)"""
import requests, json, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

KEYWORDS = [
    "语文老师 神器",
    "小学语文 老师 必备工具",
    "教师 免费工具 网站",
    "听写 词语 生成 打印",
    "看拼音写词语 生成器",
    "生字卡 制作 打印",
    "课文 朗读 APP 推荐",
    "课堂 点名 随机 老师",
    "成绩 统计 老师 表格",
    "班主任 必备 表格 工具",
    "小学 语文 试卷 生成",
    "作文 批改 评语",
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
        for f in feeds[:14]:
            note = f.get("noteCard") or f
            inter = note.get("interactInfo") or {}
            items.append({
                "id": f.get("id") or note.get("noteId"),
                "title": note.get("displayTitle") or "",
                "liked": inter.get("likedCount"),
                "collected": inter.get("collectedCount"),
                "xsec": f.get("xsecToken") or note.get("xsecToken"),
            })
        out[kw] = items
        print(f"[{kw}] {len(items)} 帖")
    except Exception as e:
        out[kw] = []
        print(f"[{kw}] ERROR {e}")
    time.sleep(3.2)

json.dump(out, open("sweep.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
total = sum(len(v) for v in out.values())
print("total posts:", total)
