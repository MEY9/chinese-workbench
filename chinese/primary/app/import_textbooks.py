# -*- coding: utf-8 -*-
"""批量登记 E:/downloadAll/chrome 下的统编版小学语文教材 PDF(1-6 年级上下册)"""
import io, sys, json, subprocess, glob, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SRC_DIR = 'E:/downloadAll/chrome'
META_DIR = 'textbooks/entries'
os.makedirs(META_DIR, exist_ok=True)

files = {}
CN = '一二三四五六'
for f in glob.glob(os.path.join(SRC_DIR, '*.pdf')):
    base = os.path.basename(f)
    for g in range(1, 7):
        cn = CN[g - 1]
        if (cn + '年级_上册') in base:
            files[str(g) + 'a'] = f
        if base == (cn + '年级下册.pdf'):
            files[str(g) + 'b'] = f
assert len(files) == 12, '期望12本,找到%d: %s' % (len(files), sorted(files))

results = []
for g in range(1, 7):
    for term, suffix in (('上册', 'a'), ('下册', 'b')):
        key = str(g) + suffix
        book_id = 'yw-' + key
        meta = {
            "pdf": files[key],
            "bookId": book_id,
            "publisher": "人民教育出版社",
            "grade": g,
            "term": term,
            "editionYear": "2024",
            "title": "义务教育教科书 语文 %d年级 %s(统编版)" % (g, term),
            "pageCount": None,
            "lessons": []
        }
        mp = os.path.join(META_DIR, book_id + '.json')
        json.dump(meta, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        r = subprocess.run([sys.executable, 'register_textbook.py', '--metadata', mp],
                           capture_output=True, text=True, encoding='utf-8')
        ok = 'registered' in (r.stdout or '')
        results.append((book_id, 'OK' if ok else 'FAIL: ' + ((r.stderr or r.stdout) or '').strip()[:150]))

for b, s in results:
    print(b, s)
fails = [r for r in results if not r[1].startswith('OK')]
sys.exit(1 if fails else 0)
