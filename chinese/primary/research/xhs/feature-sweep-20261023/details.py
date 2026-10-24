# -*- coding: utf-8 -*-
"""去重排序,抓前 18 篇详情(正文为主)"""
import requests, json, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sweep = json.load(open("sweep.json", encoding="utf-8"))
def num(x):
    if x is None: return 0
    s = str(x)
    if '万' in s: return int(float(s.replace('万','')) * 10000)
    try: return int(s)
    except: return 0

seen, pool = set(), []
for kw, items in sweep.items():
    for it in items:
        if not it['id'] or it['id'] in seen: continue
        seen.add(it['id'])
        pool.append({**it, 'kw': kw, 'score': num(it['liked']) + num(it['collected'])})
pool.sort(key=lambda x: -x['score'])
print('去重后:', len(pool), '| 取前 18')

results = []
for i, p in enumerate(pool[:18]):
    payload = {"jsonrpc":"2.0","id":i,"method":"tools/call",
               "params":{"name":"get_feed_detail","arguments":{"feed_id":p["id"],"xsec_token":p["xsec"]}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        d = json.loads(r.json()["result"]["content"][0]["text"])["data"]
        note = d.get("note") or {}
        results.append({
            "kw": p["kw"], "liked": p["liked"], "collected": p["collected"],
            "title": note.get("title") or p["title"],
            "desc": (note.get("desc") or "")[:1600],
            "url": "https://www.xiaohongshu.com/explore/" + p["id"],
        })
        print(f"OK [{i}] {p['liked']}赞 {note.get('title') or p['title'][:24]}")
    except Exception as e:
        print(f"ERR [{i}] {p['title'][:20]}: {str(e)[:80]}")
    time.sleep(3.2)

json.dump(results, open("details.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved", len(results))
