# -*- coding: utf-8 -*-
import requests, json, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sweep = json.load(open("sweep.json", encoding="utf-8"))
def num(x):
    s = str(x or '')
    if '万' in s: return int(float(s.replace('万',''))*10000)
    try: return int(s)
    except: return 0
seen, pool = set(), []
for kw, items in sweep.items():
    for it in items:
        if not it['id'] or it['id'] in seen: continue
        seen.add(it['id'])
        pool.append({**it, 'kw': kw, 'score': num(it['liked'])+num(it['collected'])})
pool.sort(key=lambda x: -x['score'])
print('去重:', len(pool), '| 取前 14')
results = []
for i, p in enumerate(pool[:14]):
    payload = {"jsonrpc":"2.0","id":i,"method":"tools/call",
               "params":{"name":"get_feed_detail","arguments":{"feed_id":p["id"],"xsec_token":p["xsec"]}}}
    try:
        r = requests.post("http://localhost:18060/mcp", json=payload, timeout=120)
        d = json.loads(r.json()["result"]["content"][0]["text"])["data"]
        note = d.get("note") or {}
        comments = d.get("comments") or {}
        cl = comments.get("comments") if isinstance(comments, dict) else comments
        cs = []
        if isinstance(cl, list):
            for c in cl[:8]:
                t = (c.get("content") or "").strip()
                if len(t) > 6: cs.append(t[:100])
        results.append({"kw": p["kw"], "liked": p["liked"], "collected": p["collected"],
                        "title": note.get("title") or p["title"],
                        "desc": (note.get("desc") or "")[:1500],
                        "comments": cs,
                        "url": "https://www.xiaohongshu.com/explore/" + p["id"]})
        print(f"OK [{i}] {p['liked']}赞 {p['title'][:22]}")
    except Exception as e:
        print(f"ERR [{i}] {p['title'][:20]}: {str(e)[:70]}")
    time.sleep(3.2)
json.dump(results, open("details.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved", len(results))
