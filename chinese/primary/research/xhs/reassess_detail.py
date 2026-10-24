import importlib.util,json,sys,time,tempfile,hashlib
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
p=Path('C:/Users/Administrator/.codex/skills/xhs-research/scripts/xhs_call.py')
spec=importlib.util.spec_from_file_location('xhs',p);xhs=importlib.util.module_from_spec(spec);spec.loader.exec_module(xhs)
root=Path('workbench/chinese/primary/research/xhs/workflow_reassessment_20261023');root.joinpath('images').mkdir(exist_ok=True)
tokens=json.loads(Path(tempfile.gettempdir(),'workbench-xhs-reassessment-tokens.json').read_text(encoding='utf-8'))
ids=['67b1d1b1000000001800fabe','6ada161a000000002a01ff2c','6a91302400000000040280a9','69d5f58d000000001a026f43','6ac52b91000000001802f572','6acc8189000000001500e4bb','6acf9eac000000000100bebf','68d3484c000000001300fbc2','6a9a70300000000027008c04','6a70c2ce0000000005029386','6a869aa8000000001603e3d6','6ac9ffb2000000000a0223f9']
items=[]
for feed in ids:
 time.sleep(3)
 try:
  parts=xhs.call('get_feed_detail',{'feed_id':feed,'xsec_token':tokens[feed]},timeout=55)
  raw=json.loads(next(p['text'] for p in parts if p.get('type')=='text'))
  d=raw.get('data',{});n=d.get('note',{});comments=d.get('comments',{})
  if isinstance(comments,dict):comments=comments.get('list',comments.get('comments',[]))
  item={'id':feed,'url':'https://www.xiaohongshu.com/explore/'+feed,'title':n.get('title'),'author':n.get('user',{}).get('nickname'),'desc':n.get('desc'),'type':n.get('type'),'time':n.get('time'),'interactions':n.get('interactInfo',{}),'comments':[{'text':c.get('content'),'replies':[r.get('content') for r in c.get('subComments',[])]} for c in comments[:20]],'totalImages':len(n.get('imageList',[])),'images':[]}
  for i,im in enumerate(n.get('imageList',[])[:2]):
   url=im.get('urlDefault') or im.get('url')
   if not url:continue
   try:
    time.sleep(3);path=root/'images'/f'{feed}_{i+1:02}.jpg';xhs.download(url,path)
    item['images'].append({'path':'images/'+path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
   except Exception as e:item.setdefault('imageErrors',[]).append(str(e))
  items.append(item)
  print(json.dumps(item,ensure_ascii=False),flush=True)
 except Exception as e:
  items.append({'id':feed,'error':str(e)});print('FAILED',feed,str(e)[:200],flush=True)
 root.joinpath('details.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
