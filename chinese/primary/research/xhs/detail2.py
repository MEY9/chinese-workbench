# -*- coding: utf-8 -*-
import requests, json, time, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

data = json.load(open("search_results.json", encoding="utf-8"))
WANT = ["教你轻松备完一学期","备课网址","备课神器","超级实用的语文小程序",
        "偷懒工具","严抓听默写","更痛苦","出卷神器","deepseek出语文试卷",
        "课件如何选择","必备的10个网站","王炸AI工具","生字表写字表","识字表组词",
        "阅读理解","作文批改","名著","文言文","班主任"]

picked = []
for kw, items in data.items():
    for it in items:
        t = it.get("title") or ""
        for w in WANT:
            if w in t and it.get("id") and it.get("xsec"):
                if not any(p["id"] == it["id"] for p in picked):
                    picked.append({"kw": kw, **it})
                break

results = []
for i, p in enumerate(picked[:14]):
    payload = {"jsonrpc":"2.0","id":i+1,"method":"tools/call",
               "params":{"name":"get_feed_detail","arguments":{"feed_id":p["id"],"xsec_token":p["xsec"]}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        d = json.loads(r.json()["result"]["content"][0]["text"])["data"]
        note = d.get("note") or {}
        desc = note.get("desc") or ""
        comments = []
        c = d.get("comments") or {}
        cl = c.get("comments") if isinstance(c, dict) else c
        if isinstance(cl, list):
            for cm in cl:
                txt = cm.get("content") or ""
                if len(txt) > 10: comments.append(txt[:150])
        nimg = len(note.get("imageList") or [])
        results.append({"kw": p["kw"], "title": note.get("title") or p["title"],
                        "liked": p["liked"], "collected": p["collected"],
                        "desc": desc[:1200], "comments": comments[:10], "n_images": nimg,
                        "url": f"https://www.xiaohongshu.com/explore/{p['id']}"})
        print(f"OK [{(note.get('title') or '')[:28]}] desc={len(desc)} cmt={len(comments)} img={nimg}")
    except Exception as e:
        print(f"ERR {p['title'][:24]}: {str(e)[:80]}")
    time.sleep(3.5)

json.dump(results, open("details.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved", len(results))
