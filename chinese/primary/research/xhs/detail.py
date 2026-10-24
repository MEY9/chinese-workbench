# -*- coding: utf-8 -*-
import requests, json, time, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

data = json.load(open("search_results.json", encoding="utf-8"))

WANT = [
    "教你轻松备完一学期", "备课网址", "备课神器", "超级实用的语文小程序",
    "偷懒工具", "严抓听默写", "更痛苦", "出卷神器", "deepseek出语文试卷",
    "课件如何选择", "必备的10个网站", "王炸AI工具", "生字表写字表", "组词",
]

picked = []
for kw, items in data.items():
    for it in items:
        t = it.get("title") or ""
        for w in WANT:
            if w in t and it.get("id") and it.get("xsec"):
                if not any(p["id"] == it["id"] for p in picked):
                    picked.append({"kw": kw, **it})
                break

print(f"picked {len(picked)} posts")
results = []
for i, p in enumerate(picked[:14]):
    payload = {"jsonrpc":"2.0","id":i+1,"method":"tools/call",
               "params":{"name":"get_feed_detail","arguments":{"feed_id":p["id"],"xsec_token":p["xsec"]}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        d = json.loads(r.json()["result"]["content"][0]["text"])
        note = d.get("feed") or d
        desc = note.get("desc") or note.get("content") or ""
        desc = re.sub(r"[#\[]#[^#]\S*", "", desc)[:1500]
        comments = []
        for c in (note.get("comments") or [])[:8]:
            cc = c.get("content") or ""
            if cc and len(cc) > 8: comments.append(cc[:120])
        results.append({"kw": p["kw"], "title": p["title"], "liked": p["liked"],
                        "collected": p["collected"], "desc": desc, "comments": comments})
        print(f"OK [{p['title'][:30]}] desc={len(desc)} comments={len(comments)}")
    except Exception as e:
        print(f"ERR {p['title'][:30]}: {e}")
    time.sleep(3.5)

json.dump(results, open("details.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved details.json")
