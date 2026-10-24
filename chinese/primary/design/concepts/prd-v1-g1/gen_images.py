# -*- coding: utf-8 -*-
"""批量生图:requests 直连;有底图→edits,无底图→generations;带重试"""
import io, sys, json, base64, time, os
import requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
requests.packages.urllib3.disable_warnings()
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(HERE + '/../.key').read().strip()
BASE = open(HERE + '/../.base').read().strip()
ROOT = HERE + '/..'
REF = {
 "01-home": ROOT + "/teacher-workbench-v2/originals/cheer-home.png",
 "02-teaching": ROOT + "/teacher-workbench-v2/originals/cheer-teaching.png",
 "07-marking": ROOT + "/teacher-workbench-v2/originals/cheer-marking.png",
 "09-composition": ROOT + "/teacher-workbench-v2/originals/cheer-composition.png",
 "11-print": ROOT + "/teacher-workbench-v2/originals/cheer-print.png",
}
names = ["01-home", "02-teaching", "03-bank", "04-rollcall", "05-dictation", "06-recite",
         "07-marking", "08-assign", "09-composition", "10-followup", "11-print",
         "12-profile", "13-report", "14-annotate"]


def gen_one(name):
    prompt = open(HERE + '/prompt-%s.txt' % name, encoding='utf-8').read()
    ref = REF.get(name, '')
    if ref and os.path.exists(ref):
        body = prompt.replace(
            '一张高保真的桌面端教育软件 UI 设计效果图,产品名「语文工作台」',
            '参考这张图的窗口框架、左侧导航与整体美术风格,重新设计页面内容。'
            '一张高保真的桌面端教育软件 UI 设计效果图,产品名「语文工作台」')
        r = requests.post(BASE + '/images/edits',
                          headers={'Authorization': 'Bearer ' + KEY},
                          data={'prompt': body.encode('utf-8'), 'model': 'gpt-image-2.5'},
                          files={'image': ('ref.png', open(ref, 'rb'), 'image/png')},
                          timeout=430)
    else:
        r = requests.post(BASE + '/images/generations',
                          headers={'Authorization': 'Bearer ' + KEY,
                                   'Content-Type': 'application/json'},
                          data=json.dumps({"model": "gpt-image-2.5", "prompt": prompt,
                                           "size": "1536x1024", "quality": "high"},
                                          ensure_ascii=True).encode('utf-8'),
                          timeout=430)
    d = r.json()
    if 'data' in d and d['data']:
        item = d['data'][0]
        if item.get('b64_json'):
            open(HERE + '/ui-%s.png' % name, 'wb').write(base64.b64decode(item['b64_json']))
            return 'OK'
        if item.get('url'):
            open(HERE + '/ui-%s.png' % name, 'wb').write(
                requests.get(item['url'], timeout=120).content)
            return 'OK(url)'
    return 'API-ERR ' + json.dumps(d, ensure_ascii=False)[:150]


todo = sys.argv[1:] or names
for name in todo:
    ok = False
    for attempt in range(3):
        try:
            result = gen_one(name)
            if result.startswith('OK'):
                print(result, name, flush=True)
                ok = True
                break
            print('API-ERR#%d' % attempt, name, result[:120], flush=True)
        except Exception as e:
            print('FAIL#%d' % attempt, name, str(e)[:100], flush=True)
        if attempt < 2:
            time.sleep(8)
    if not ok:
        print('GIVEUP', name, flush=True)
    time.sleep(4)
