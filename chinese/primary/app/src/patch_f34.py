# -*- coding: utf-8 -*-
"""F34 教材划线标注 + A12/A13 AI 分析:pdf.js 渲染 + Canvas 墨迹层"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor count=%r expect=%r: %s' % (src.count(old), cnt, old[:70].replace('%','%%'))
    src = src.replace(old, new)

# 1) ui 状态
rep("rollMode:'random',rollPicked:[],rollCurrent:null,rollSeq:0,",
    "rollMode:'random',rollPicked:[],rollCurrent:null,rollSeq:0,annPage:1,annPages:1,annTool:'red',annLayer:'备课',annDraw:false,annStrokes:[],annUndo:[],annScale:1.5,")

# 2) renderPdfReader 升级:标注模式(pdf.js + canvas);纯预览(iframe)保留临时文件
rep("function renderPdfReader(){\n  const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId),temporary=ui.pdfTemporary;",
"""function renderPdfReader(){
  if(!ui.pdfTemporary&&ui.pdfBookId)return renderPdfAnnotator();
  const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId),temporary=true;""")

rep("  const external=!temporary&&ui.pdfUrl?`<a class=\"btn sm\" href=\"${A(ui.pdfUrl)}\" target=\"_blank\" rel=\"noopener\">在新窗口打开</a>`:'';",
    "  const external='';")

# 3) 标注器主体(替换整个 renderPdfAnnotator 之前先注册);插在 renderComments 前
rep("function renderComments(){",
"""function annKey(){return (ui.pdfBookId||'tmp')+'|'+ui.annLayer+'|p'+ui.annPage}
function annAll(){state.annotations=state.annotations||[];return state.annotations.filter(a=>a.key.split('|').slice(0,2).join('|')===(ui.pdfBookId||'tmp')+'|'+ui.annLayer)}
function annPageStrokes(){return (state.annotations||[]).filter(a=>a.key===annKey())}
function renderPdfAnnotator(){
  const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId);
  const title=b?b.title:'教材 PDF';
  const meta=(b?b.publisher+' · 统编版 · ':'')+'标注按 教材+图层+页码 保存';
  return `<div class="pdf-reader ann">
  <div class="pdf-bar">
    <button class="btn sm" data-act="closePdf">‹ 返回目录</button>
    <div class="pdf-ident"><b>${E(title)}</b><small>${E(meta)}</small></div>
    <span class="right row gap8">
      <span class="small muted">画笔</span>
      ${[['red','#FF6B57'],['blue','#4E9AF1'],['green','#4CAF6E']].map(([k,c])=>`<button class="ann-pen ${ui.annTool===k?'on':''}" data-act="annTool" data-tool="${k}" style="--pc:${c}" title="${k}"></button>`).join('')}
      <button class="btn sm" data-act="annUndo">撤销</button>
      <button class="btn sm" data-act="annClearPage">清空本页</button>
      <select id="annLayerSel" data-act-change="annLayer" aria-label="标注图层"><option ${ui.annLayer==='备课'?'selected':''}>备课</option><option ${ui.annLayer==='上课'?'selected':''}>上课</option></select>
      <span class="small muted">页</span><input type="number" id="annPageNo" min="1" max="${ui.annPages||1}" value="${ui.annPage}" style="width:64px">
      <button class="btn sm" data-act="annGo">跳转</button>
    </span>
  </div>
  <div class="ann-body">
    <div class="ann-stage"><canvas id="annCanvas"></canvas></div>
    <div class="ann-side">
      <div class="card ai-card"><h2>✦ AI 划线分析</h2><div id="annAIOut" class="small">${state.aiCache&&state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]?E(state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]):'<span class=\"muted\">在本页划出教学重点,然后让 AI 归纳:重点是什么、怎么提问、板书写什么。</span>'}</div>
        <div class="row mt">${btn('✦ 分析本页划线','annAnalyze','sky sm')}${btn('整课分析','annLesson','sm')}</div>
        <p class="small muted" style="margin-top:8px">发送内容:本页划线笔画摘要与课次信息(教材为公开出版物,不含学生数据)。</p>
      </div>
      <div class="card"><h2>本课词单</h2><div class="picklist">${(()=>{const l=(bankLessons().find(x=>String(x.no)===String(ui.teachLesson)));return l?l.words.slice(0,12).map(x=>`<span class="pick">${E(x.w)}</span>`).join(''):'<span class=\"muted small\">未绑定课次词库</span>'})()}</div></div>
      <div class="card"><h2>图层说明</h2><p class="small muted">「备课」「上课」两套图层互不覆盖;标注随工作台数据本地保存,可随备份导出。</p></div>
    </div>
  </div></div>`}
async function annLoadPage(){
  const canvas=document.getElementById('annCanvas');if(!canvas)return;
  if(!window.pdfjsLib){try{const m=await import('./vendor/pdf.min.mjs');window.pdfjsLib=m;pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.mjs'}catch(e){canvas.replaceWith(Object.assign(document.createElement('p'),{textContent:'PDF 引擎加载失败:'+e.message}));return}}
  try{
    const doc=await pdfjsLib.getDocument({url:ui.pdfUrl}).promise;
    ui.annPages=doc.numPages;
    const page=await doc.getPage(Math.min(ui.annPage,doc.numPages));
    const dpr=window.devicePixelRatio||1;
    const vw=page.getViewport({scale:ui.annScale});
    canvas.width=vw.width*dpr;canvas.height=vw.height*dpr;
    canvas.style.width='100%';
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    await page.render({canvasContext:ctx,viewport:vw}).promise;
    canvas.__viewport={w:vw.width,h:vw.height};
    annRedraw();
  }catch(e){canvas.replaceWith(Object.assign(document.createElement('p'),{textContent:'PDF 渲染失败:'+e.message}))}
}
function annRedraw(){
  const canvas=document.getElementById('annCanvas');if(!canvas)return;
  const layer=canvas.querySelector('.ink');if(!layer)return;
  const ctx=layer.getContext('2d');ctx.clearRect(0,0,layer.width,layer.height);
  const colors={red:'#FF6B57',blue:'#4E9AF1',green:'#4CAF6E'};
  for(const s of annPageStrokes()){
    ctx.strokeStyle=colors[s.color]||s.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=.85;
    ctx.beginPath();s.pts.forEach((p,i)=>{i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke();
  }
  if(ui.annLive&&ui.annLive.length){const c=colors[ui.annTool]||'#FF6B57';ctx.strokeStyle=c;ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ui.annLive.forEach((p,i)=>{i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke()}
}
function renderComments(){""")

# 4) 事件:annTool/annUndo/annClearPage/annGo/annLayer/annAnalyze/annLesson + 画布绘制 + afterRender 钩子
rep("case'comments':ui.view='comments';renderApp();break;",
"""case'comments':ui.view='comments';renderApp();break;
case'annTool':ui.annTool=el.dataset.tool;renderApp();break;
case'annUndo':{const k=annKey();const arr=(state.annotations||[]);for(let i=arr.length-1;i>=0;i--){if(arr[i].key===k){arr.splice(i,1);ui.dirty=true;await save();break}}renderApp();break}
case'annClearPage':{if(!(await uiConfirm('清空本页全部标注?',{danger:true,ok:'清空'})))break;const k=annKey();state.annotations=(state.annotations||[]).filter(a=>a.key!==k);ui.dirty=true;await save();renderApp();break}
case'annGo':{const v=Number(document.getElementById('annPageNo')?.value);if(v>=1){ui.annPage=v;renderApp()}break}
case'annLayer':ui.annLayer=document.getElementById('annLayerSel')?.value||ui.annLayer;renderApp();break;
case'annAnalyze':{const strokes=annPageStrokes();if(!strokes.length){toast('先在本页划线');break}
  const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId);
  toast('AI 分析中…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文特级教师。老师在教学材 PDF 上划了重点(以笔画区域描述提供:页面宽高的相对坐标)。请推测这些划线针对的教学内容,输出:①教学重点归纳(60字内)②2 个课堂提问建议 ③板书要点。条理清晰。'},{role:'user',content:'教材:'+(b?b.title:'统编版语文')+' 第'+ui.annPage+'页;划线 '+strokes.length+' 处,包围盒(相对坐标 x0,y0,x1,y1):'+strokes.map(s=>{const xs=s.pts.map(p=>p.x),ys=s.pts.map(p=>p.y);return '['+(Math.min(...xs)/ui.annScale/1000).toFixed(2)+','+(Math.min(...ys)/ui.annScale/1000).toFixed(2)+','+(Math.max(...xs)/ui.annScale/1000).toFixed(2)+','+(Math.max(...ys)/ui.annScale/1000).toFixed(2)+']'}).join(' ')+'。课次词单:'+(bankLessons().find(x=>String(x.no)===String(ui.teachLesson))||{words:[]}).words.slice(0,8).map(x=>x.w).join('、')}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'annLesson':{const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId);
  const annByPage={};annAll().forEach(a=>{const p=a.key.split('|p')[1];annByPage[p]=(annByPage[p]||0)+1});
  toast('AI 整课分析中…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文特级教师。基于教师标注分布与课次词库,输出整课备课建议:教学目标(3条)/教学环节(4步)/提问链(3个)/作业设计(2项)。markdown 列表,简洁。'},{role:'user',content:'教材:'+(b?b.title:'统编版语文')+';教师标注分布(页:处数):'+JSON.stringify(annByPage)+';本课词库:'+((bankLessons().find(x=>String(x.no)===String(ui.teachLesson))||{words:[]}).words.slice(0,10).map(x=>x.w).join('、'))}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['annlesson:'+ui.pdfBookId+'|'+ui.annLayer]=out;
  toast('整课分析完成,见划线分析卡片下方');
  const box=document.getElementById('annAIOut');if(box)box.innerHTML='<b>整课备课建议</b><br>'+E(out).split('\\n').join('<br>');
  }catch(e){toast('AI 失败:'+e.message)}break}""")

# 5) 渲染后钩子:进入 pdf 视图时加载页面 + 绑定画布事件
rep("function tzWord(w,p)",
"""function annBindCanvas(){
  const canvas=document.getElementById('annCanvas');if(!canvas||canvas.__bound)return;canvas.__bound=1;
  const ink=document.createElement('canvas');ink.style.cssText='position:absolute;inset:0;width:100%;height:100%';ink.className='ink';
  canvas.parentElement.style.position='relative';
  ink.width=canvas.width;ink.height=canvas.height;
  canvas.parentElement.appendChild(ink);
  annLoadPage().then(()=>{const l=document.getElementById('annCanvas')?.parentElement?.querySelector('.ink');if(l){l.width=document.getElementById('annCanvas').width;l.height=document.getElementById('annCanvas').height;annRedraw()}});
  const pos=e=>{const r=ink.getBoundingClientRect();const vp=canvas.__viewport||{w:1000,h:1400};return {x:(e.clientX-r.left)/r.width*vp.w,y:(e.clientY-r.top)/r.height*vp.h}};
  ink.addEventListener('pointerdown',e=>{if(e.button!==0)return;ink.setPointerCapture(e.pointerId);ui.annDraw=true;ui.annLive=[pos(e)]});
  ink.addEventListener('pointermove',e=>{if(!ui.annDraw)return;ui.annLive.push(pos(e));annRedraw()});
  const up=async e=>{if(!ui.annDraw)return;ui.annDraw=false;
    if(ui.annLive&&ui.annLive.length>1){state.annotations=state.annotations||[];state.annotations.push({id:uid(),key:annKey(),color:ui.annTool,pts:ui.annLive.slice()});ui.dirty=true;await save()}
    ui.annLive=null;annRedraw()};
  ink.addEventListener('pointerup',up);ink.addEventListener('pointercancel',up);
  window.addEventListener('resize',()=>annRedraw());
}
function tzWord(w,p)""")

# renderApp 收尾注入(在 restoreFormDrafts();tintStatusSelects() 处)
rep(";restoreFormDrafts();tintStatusSelects()}",
    ";restoreFormDrafts();tintStatusSelects();if(ui.view==='pdf'&&ui.pdfBookId)setTimeout(()=>{try{annBindCanvas()}catch(e){}},60)}")

# 6) closePdf 返回时清 pdfjs 状态;lessonLessons 联动:打开教材时定位课次页码
rep("case'closePdf':if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);ui.pdfUrl=null;ui.pdfBookId=null;ui.pdfTemporary=false;ui.pdfFileName='';ui.view=ui.pdfReturn||'resources';location.hash=ui.view;renderApp();break;",
    "case'closePdf':if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);ui.pdfUrl=null;ui.view=ui.pdfReturn||'resources';renderApp();break;\ncase'annPageFromLesson':{const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId);const les=(b&&b.lessons||[]).find(l=>String(l.lessonNo)===String(ui.teachLesson));if(les&&les.pageStart){ui.annPage=les.pageStart;toast('已定位到第'+les.pageStart+'页(课次页码目录)')}else toast('本课页码目录待录入');renderApp();break}")

# 打开教材时:若该册有页码目录且当前课在目录内,自动跳页

open('app.js', 'w', encoding='utf-8').write(src)
print('F34 patch done:', n0, '->', len(src))
