import importlib.util,json,sys,time,tempfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
p=Path('C:/Users/Administrator/.codex/skills/xhs-research/scripts/xhs_call.py')
spec=importlib.util.spec_from_file_location('xhs',p);xhs=importlib.util.module_from_spec(spec);spec.loader.exec_module(xhs)
root=Path('workbench/chinese/primary/research/xhs/workflow_reassessment_20261023');root.mkdir(parents=True,exist_ok=True)
queries=['小学语文 备课 流程','小学语文老师 课件 整理','小学语文 作业 批改 太累','小学语文 听写 批改','作业 批改记录 检查','小学语文 作文 批改 工具','老师 作业 收交 订正','教师工作台 不好用']
tokens={};results=[]
def strip(v):
 if isinstance(v,dict):return {k:strip(x) for k,x in v.items() if 'token' not in k.lower()}
 if isinstance(v,list):return [strip(x) for x in v]
 return v
for i,q in enumerate(queries):
 time.sleep(3)
 try:
  parts=xhs.call('search_feeds',{'keyword':q},timeout=55)
  raw=next(p['text'] for p in parts if p.get('type')=='text');j=json.loads(raw)
  feeds=j.get('feeds',[])
  for f in feeds:
   if f.get('id') and f.get('xsecToken'):tokens[f['id']]=f['xsecToken']
  results.append({'query':q,'data':strip(j)})
  print('\nQUERY',i,q,'COUNT',len(feeds),flush=True)
  for f in feeds[:16]:
   n=f.get('noteCard',{});print(f.get('id'),n.get('displayTitle'),n.get('user',{}).get('nickname'),n.get('interactInfo',{}),flush=True)
 except Exception as e:
  results.append({'query':q,'error':str(e)});print('FAILED',q,str(e)[:150],flush=True)
 root.joinpath('search_results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 Path(tempfile.gettempdir(),'workbench-xhs-reassessment-tokens.json').write_text(json.dumps(tokens),encoding='utf-8')
