'use strict';
// Shared workflow rules. This file is bundled before app.js; it performs no I/O on load.
function lessonDay(value){
  const day=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
  const date=new Date(day+'T12:00:00');
  return Number.isNaN(date.getTime())?'':day;
}
function assessedMark(mark){return !!mark&&['已批','待复查','已录'].includes(mark.status)}
function scoreValue(row){
  if(!row||row.absent||row.score==null||String(row.score).trim()==='')return null;
  const n=Number(row.score);return Number.isFinite(n)&&n>=0&&n<=100?n:null;
}
function gradeEntryState(row){
  if(row?.absent)return {label:'缺考',value:null,kind:'muted'};
  const value=scoreValue(row);
  if(value===null)return {label:row?.score!=null&&String(row.score).trim()!==''?'分数无效':'未录入',value:null,kind:'muted'};
  return {label:value>=85?'优秀':value>=75?'良好':value>=passLine()?'及格':'待巩固',value,kind:value>=passLine()?'blue':'magenta'};
}
function gradeEditFeedback(){
  const status=document.querySelector('[data-grade-save-state]');
  if(status){status.textContent='有修改待保存';status.classList?.add('pending')}
  for(const input of document.querySelectorAll('[data-act="gradeInput"]')){
    const tr=input.closest('tr');if(!tr)continue;
    const absent=tr.querySelector('[data-act="gradeAbsent"]')?.checked;
    const item=gradeEntryState({score:input.value,absent});
    const label=tr.querySelector('[data-grade-level]');if(label){label.textContent=item.label;label.className='status '+item.kind}
    const delta=tr.querySelector('[data-grade-diff]');
    if(delta){const previous=delta.dataset.previous===''?null:Number(delta.dataset.previous);const diff=item.value!==null&&previous!==null?Math.round((item.value-previous)*10)/10:null;delta.textContent=diff===null?'—':(diff>0?'+':'')+diff;delta.className=diff===null?'muted':diff<0?'score-down':'score-up'}
    input.setAttribute('aria-invalid',String(item.label==='分数无效'));
  }
}
function captureGradeDraft(input){
  const row=input.closest('tr'),score=row?.querySelector('[data-act="gradeInput"]'),absent=row?.querySelector('[data-act="gradeAbsent"]');
  if(!score)return;
  ui.gradeDrafts=ui.gradeDrafts||{};ui.gradeDrafts[score.dataset.grade]=ui.gradeDrafts[score.dataset.grade]||{};
  ui.gradeDrafts[score.dataset.grade][score.dataset.sid]={studentId:score.dataset.sid,score:absent?.checked?'':score.value,absent:!!absent?.checked};
  ui.dirty=true;gradeEditFeedback();
}
function extendedStateValid(data){
  const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  for(const key of ['records','reciteLogs','grades','annotations']){
    if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].some(x=>!object(x)||typeof x.id!=='string')))return false;
  }
  for(const row of data.records||[])if(typeof row.note!=='string'||typeof row.date!=='string'||typeof row.studentId!=='string')return false;
  for(const row of data.grades||[])if(typeof row.name!=='string'||typeof row.date!=='string'||!Array.isArray(row.scores)||row.scores.some(x=>!object(x)||typeof x.studentId!=='string'||(!x.absent&&x.score!==''&&x.score!=null&&scoreValue(x)===null)))return false;
  for(const row of data.annotations||[])if(typeof row.key!=='string'||!Array.isArray(row.pts)||row.pts.some(p=>!object(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  for(const key of ['aiCache','reportCards','pointsByClass','seatsByClass','reciteTexts','bookLessons'])if(data[key]!==undefined&&!object(data[key]))return false;
  for(const rows of Object.values(data.bookLessons||{}))if(!Array.isArray(rows)||rows.some(row=>!object(row)||typeof row.lessonNo!=='string'||typeof row.title!=='string'||!Number.isInteger(row.pageStart)||!Number.isInteger(row.pageEnd)||row.pageStart<1||row.pageEnd<row.pageStart))return false;
  if(data.reportArchive!==undefined&&!Array.isArray(data.reportArchive))return false;
  return true;
}
function studentOrder(a,b){return String(a.no).localeCompare(String(b.no),'zh-CN',{numeric:true})}
function parentView(view){return ({rollcall:'classroom',recite:'classroom',dictation:'teaching',pdf:'resources',seats:'resources',points:'resources',comments:'marking'})[view]||view}
function sampleLesson(){const c=currentClass();return c&&Number(c.grade)===3&&c.term==='上册'&&!c.bookId?bankLessons().find(x=>String(x.no)===String(ui.teachLesson)):null}
function scopedWords(){
  const words=new Map();
  for(const x of sampleLesson()?.words||[])words.set(x.w,{...x});
  for(const d of inBook(state.dictations).filter(x=>String(x.lessonNo)===String(ui.teachLesson)))for(const x of d.words||[])words.set(x.w,{...x});
  return [...words.values()];
}
function scopedPinyin(){const words=new Map();for(const d of inBook(state.dictations))for(const w of d.words||[])if(w.p)words.set(w.w,w.p);for(const w of sampleLesson()?.words||[])if(w.p&&!words.has(w.w))words.set(w.w,w.p);return words}
function reportTerm(){const c=currentClass();return (c?.semesterStart?.slice(0,4)||String(new Date().getFullYear()))+' · '+(c?.term||'本学期')}
function reportKey(sid){return (currentClass()?.id||'')+'|'+reportTerm()+'|'+sid}
function reportFor(sid){return state.reportCards?.[reportKey(sid)]||null}
function migrateReports(){
  state.reportCards=state.reportCards||{};state.reportArchive=state.reportArchive||[];
  for(const [key,value] of Object.entries(state.reportCards)){
    if(!key.includes('|')){state.reportArchive.push({...value,studentId:value.studentId||key,legacy:true,status:'draft'});delete state.reportCards[key]}
  }
}
function markSummary(record){
  const marks=record.studentMarks||{},wordErrors={};let marked=0;
  for(const s of inClass(state.students)){const m=marks[s.id];if(!assessedMark(m))continue;marked++;for(const w of new Set(m.wrongWords||[]))wordErrors[w]=(wordErrors[w]||0)+1}
  return {marked,wordErrors};
}
function renderReportArchive(){
  const rows=(state.reportArchive||[]).map((row,index)=>({row,index})).filter(({row})=>inClass(state.students).some(s=>s.id===row.studentId));
  if(!rows.length)return '';
  return `<details class="card mt"><summary>旧版评语 · ${rows.length} 条</summary><p>旧版没有可靠的学期与审定信息。采纳后仍需重新审定。</p>${rows.map(({row,index})=>`<article class="item"><b>${E(inClass(state.students).find(s=>s.id===row.studentId)?.name||'历史学生')}</b><p>${E(row.text||'')}</p>${btn('采纳为本学期草稿','adoptLegacyReport','sm',`data-index="${index}"`)}</article>`).join('')}</details>`;
}
function summarizeMarkForm(){
  const form=document.querySelector('form[data-form="dictMark"]');if(!form)return;
  const record=inBook(state.dictations).find(x=>x.id===form.dataset.id);if(!record)return;
  const marks={},known=new Set(record.words.map(x=>x.w));
  for(const student of inClass(state.students)){
    const status=formVal(form,'stu_status_'+student.id),wrongWords=[...new Set(formVal(form,'stu_words_'+student.id).split(/[、,，\s]+/).filter(Boolean))];
    if(wrongWords.length&&!assessedMark({status}))return toast('有错词的学生须先标记为已批或待复查');
    if(wrongWords.some(w=>!known.has(w)))return toast('错词中含本次任务以外的词，请先核对');
    marks[student.id]={status,wrongWords};
  }
  const result=markSummary({studentMarks:marks});
  if(result.marked>Number(formVal(form,'participants')))return toast('已批学生数超过参与人数，请先核对参与人数');
  form.elements.namedItem('marked').value=String(result.marked);
  record.words.forEach((x,i)=>{form.elements.namedItem('err_'+i).value=String(result.wordErrors[x.w]||0)});
  ui.dirty=true;toast('已填入汇总，请核对后保存批改记录');
}
async function editBookLesson(){
  const book=bookCatalog().find(b=>b.bookId===ui.pdfBookId);if(!book)return;
  const doc=await pdfDocument(),old=(book.lessons||[]).find(l=>String(l.lessonNo)===String(ui.teachLesson));
  const input=await configureDialog('校对本册课次页码',`<p>${E(book.title)}，共 ${doc.numPages} 页。填写 PDF 页码，可能与书上印刷页码不同。</p>${field('lessonNo','课次',old?.lessonNo||ui.teachLesson,'text','required')}${field('title','课文名称',old?.title||'','text','required')}${field('pageStart','PDF 起始页',old?.pageStart||ui.annPage,'number',`min="1" max="${doc.numPages}" required`)}${field('pageEnd','PDF 结束页',old?.pageEnd||ui.annPage,'number',`min="1" max="${doc.numPages}" required`)}${field('verifiedBy','校对人',old?.verifiedBy||'','text','required')}`,'确认已核对并保存');
  if(!input)return;const pageStart=Number(input.pageStart),pageEnd=Number(input.pageEnd);
  if(!input.lessonNo.trim()||!input.title.trim()||!input.verifiedBy.trim()||!Number.isInteger(pageStart)||!Number.isInteger(pageEnd)||pageStart<1||pageEnd<pageStart||pageEnd>doc.numPages)throw Error('课次、课名、校对人或页码不正确');
  const row={lessonNo:input.lessonNo.trim(),title:input.title.trim(),pageStart,pageEnd,verifiedBy:input.verifiedBy.trim(),verifiedAt:today()};
  state.bookLessons=state.bookLessons||{};state.bookLessons[book.bookId]=[...(book.lessons||[]).filter(l=>String(l.lessonNo)!==row.lessonNo),row].sort((a,b)=>a.pageStart-b.pageStart);
  ui.teachLesson=row.lessonNo;await save();renderApp();toast('课次页码已保存，可按课跳转和分析');
}
function configureDialog(title,fields,ok='保存'){
  return new Promise(resolve=>{
    const modal=uiModalShell(`<form class="modal task-dialog"><h3>${E(title)}</h3><div class="modal-body stack">${fields}</div><div class="mrow"><button type="button" class="btn" data-cancel>取消</button><button type="submit" class="btn primary">${E(ok)}</button></div></form>`);
    const finish=value=>{modal.remove();modal._restoreFocus();resolve(value)};
    modal.querySelector('form').addEventListener('submit',event=>{event.preventDefault();finish(Object.fromEntries(new FormData(event.currentTarget).entries()))});
    modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('[data-cancel]'))finish(null)});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(null)}});
    modal.querySelector('input,textarea,select')?.focus();
  });
}
async function approveAI(messages){
  if(!(await DesktopAI.hasKey()))throw Error('请先在设置中配置 AI 服务');
  const ai=state.settings.ai||{};
  return new Promise(resolve=>{
    const content=messages.map(m=>m.role+'：\n'+(typeof m.content==='string'?m.content:'[页面图像]')).join('\n\n');
    const modal=uiModalShell(`<section class="modal task-dialog"><h3>确认发送给 AI 的内容</h3><p>服务：${E(ai.base||'默认服务')} · ${E(ai.model||'默认模型')}</p><div class="modal-body"><p>结果为草稿，需教师审核。取消不会请求外部服务。</p><pre class="request-preview">${E(content)}</pre></div><div class="mrow"><button class="btn" data-send="no">取消</button><button class="btn primary" data-send="yes">发送并生成草稿</button></div></section>`);
    const finish=value=>{modal.remove();modal._restoreFocus();resolve(value)};
    modal.addEventListener('click',e=>{const b=e.target.closest('[data-send]');if(b||e.target===modal)finish(b?.dataset.send==='yes')});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape')finish(false)});
  });
}
let aiCancel=null;
function aiProgress(){
  const controller=new AbortController();aiCancel=controller;
  const mask=document.createElement('div');mask.className='ai-progress';mask.setAttribute('role','status');
  mask.innerHTML='<span>正在生成草稿…</span><button type="button" class="btn sm">取消</button>';
  mask.querySelector('button').addEventListener('click',()=>{controller.abort();window.desktop?.ai.cancel?.()});document.body.appendChild(mask);
  return {controller,close(){mask.remove();if(aiCancel===controller)aiCancel=null}};
}
async function migrateStoredKey(){
  const key=String(state.settings?.ai?.key||'').trim();if(!key)return;
  // Do not discard the only copy before OS encryption succeeds.
  await DesktopAI.saveKey(key);
  delete state.settings.ai.key;
}
let pdfRuntime={url:'',doc:null,sequence:0,text:[],viewport:null};
async function pdfDocument(){
  if(pdfRuntime.url===ui.pdfUrl&&pdfRuntime.doc)return pdfRuntime.doc;
  pdfRuntime.doc?.destroy?.();pdfRuntime.doc=null;pdfRuntime.url=ui.pdfUrl;
  if(!window.pdfjsLib)throw Error('PDF 引擎未就绪');
  if(!pdfjsLib.GlobalWorkerOptions.workerSrc){const worker=document.getElementById('pdfjsWorkerCode');if(worker)pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([worker.textContent],{type:'text/javascript'}))}
  const url=ui.pdfUrl,doc=await pdfjsLib.getDocument({url}).promise;
  if(url!==ui.pdfUrl){doc.destroy();throw Error('教材已切换，请重试')}
  pdfRuntime.doc=doc;return doc;
}
function highlightedText(items,strokes,viewport){
  return items.filter(item=>{
    const p=pdfjsLib.Util.transform(viewport.transform,item.transform),height=Math.max(8,Math.hypot(p[2],p[3]));
    const left=p[4],right=left+item.width*viewport.scale,top=p[5]-height,bottom=p[5]+height*.5;
    return strokes.some(s=>{const xs=s.pts.map(p=>p.x),ys=s.pts.map(p=>p.y);return Math.max(...xs)>=left&&Math.min(...xs)<=right&&Math.max(...ys)>=top&&Math.min(...ys)<=bottom});
  }).map(x=>x.str).join(' ');
}
async function annotationSource(wholeLesson=false){
  const book=bookCatalog().find(x=>x.bookId===ui.pdfBookId);if(!book)throw Error('请选择教材');
  const doc=await pdfDocument();let text='',range='第 '+ui.annPage+' 页';
  if(wholeLesson){
    const lesson=(book.lessons||[]).find(l=>String(l.lessonNo)===String(ui.teachLesson));
    if(!lesson)throw Error('本课页码尚未校对，请先使用本页分析，或在教材目录登记课次页码');
    if(lesson.pageEnd-lesson.pageStart>15)throw Error('课次范围超过 16 页，请核对页码');
    if(lesson.pageStart<1||lesson.pageEnd>doc.numPages)throw Error('已登记课次超出 PDF 页数，请重新校对');
    for(let n=lesson.pageStart;n<=lesson.pageEnd;n++){const page=await doc.getPage(n);const data=await page.getTextContent();const words=data.items.map(x=>x.str).join(' ').trim();if(words)text+='\n第 '+n+' 页：'+words}
    range='第 '+lesson.lessonNo+' 课 '+lesson.title+'（PDF '+lesson.pageStart+'–'+lesson.pageEnd+' 页）';
  }else{
    const strokes=annPageStrokes();if(!strokes.length)throw Error('请先划出要分析的内容');
    const page=await doc.getPage(ui.annPage),data=await page.getTextContent();
    text=highlightedText(data.items,strokes,page.getViewport({scale:ui.annScale}));
  }
  if(!text.trim()){
    const input=await configureDialog('该区域没有可提取文字',`<p>扫描页或划线未覆盖文字。请填写对应原文；未填写不会发送坐标让 AI 猜测内容。</p>${area('text','本页对应原文','',7)}`,'使用此原文');
    if(!input?.text?.trim())throw Error('已取消：未提供课文原文');text=input.text.trim();
  }
  if(text.length>24000)throw Error('课文范围过长，请缩小到具体页面');
  return '教材：'+book.title+' · '+book.publisher+'\n范围：'+range+'\n原文：\n'+text;
}
function reciteBookKey(){return (currentClass()?.id||'')+'|'+(currentClass()?.bookId||'')+'|'+ui.teachLesson}
function restoreReciteText(){const item=state.reciteTexts?.[reciteBookKey()];ui.reciteRaw=item?.text||'';ui.reciteText=ui.reciteRaw;ui.reciteGaps=[];ui.reciteCur=0;ui.reciteHints=0}
let clockTick=null;
function updateClock(){
  const clock=document.querySelector('.ck-time');if(clock)clock.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  const node=document.querySelector('[data-countdown]');if(!node)return;
  const left=ui.countdownEnd?Math.max(0,Math.ceil((ui.countdownEnd-Date.now())/1000)):(ui.countdownLeft??Number(state.widgets?.clock?.countdownMin||5)*60);
  node.textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
  if(ui.countdownEnd&&left===0){ui.countdownEnd=null;ui.countdownLeft=0;toast('课堂计时结束')}
}
function startClockTicker(){if(clockTick||typeof window.setInterval!=='function')return;clockTick=window.setInterval(updateClock,1000)}
function printDocumentHTML(body){return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>打印</title><style>'+document.querySelector('style').textContent+'\nbody{height:auto;overflow:visible;background:white}#printSheet{display:block!important}</style><body><main id="printSheet"><div class="print-paper">'+body+'</div></main></body></html>'}
function historyAPI(){return window.desktop?.history||{
  async list(){return requestJSON('/api/history',{headers:{'X-Workbench-Token':sqliteToken}})},
  async read(revision){return requestJSON('/api/history/'+revision,{headers:{'X-Workbench-Token':sqliteToken}})}
}}
async function showHistory(){
  const rows=await historyAPI().list();
  const modal=uiModalShell(`<section class="modal task-dialog"><h3>历史版本</h3><p>恢复前先导出当前备份。恢复会产生新版本，不覆盖旧快照。</p><div class="modal-body stack">${rows.map(x=>`<div class="row space"><span>版本 ${x.revision} · ${E(x.saved_at||'')}</span><button class="btn sm" data-revision="${x.revision}">查看恢复预览</button></div>`).join('')||'<p>首次保存后尚无历史版本。</p>'}</div><button class="btn" data-close>关闭</button></section>`);
  modal.addEventListener('click',async e=>{
    if(e.target.closest('[data-close]')||e.target===modal){modal.remove();modal._restoreFocus();return}
    const b=e.target.closest('[data-revision]');if(!b)return;b.disabled=true;
    try{const item=await historyAPI().read(Number(b.dataset.revision));if(!item?.intact)throw Error('这是旧版不完整快照，不能整体恢复');
      checkedStoredState(item.state);ui.importCandidate=item.state;modal.remove();modal._restoreFocus();ui.view='settings';renderApp();toast('已载入版本 '+item.revision+' 的预览，确认后才会恢复');
    }catch(error){toast(error.message);b.disabled=false}
  });
}
