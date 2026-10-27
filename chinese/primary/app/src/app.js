'use strict';
const DB_NAME='primary_chinese_teacher_v1', DB_STORE='kv', STATE_KEY='state';
const NAV=[['home','今日','M3 10.5 12 3l8.5 7.5V21h-6v-6h-5v6h-6z'],['teaching','教学','M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z'],['classroom','课堂','M3 4h18v12H3zM8 20h8m-4-4v4'],['marking','批改','M4 20h16M5 16l2-10 10-2 3 3-2 10-10 2z'],['grades','成绩','M4 19V5m0 14h16M8 15v-4m4 4V8m4 7v-6'],['news','新闻','M3 5h14v10H7l-4 4V5zm14 3h4v12l-4-4h-2z'],['resources','资料与打印','M5 9V3h14v6M5 18H3v-7h18v7h-2m-14 0v3h14v-3z'],['profile','档案','M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a3 3 0 1 0 0-6m-14 16v-3a5 5 0 0 1 10 0v3zm12 0v-3a4 4 0 0 0-2-3.5'],['classes','班级','M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a3 3 0 1 0 0-6m-14 16v-3a5 5 0 0 1 10 0v3zm12 0v-3a4 4 0 0 0-2-3.5'],['settings','设置','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-13v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2']];
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const uid=()=>globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const A=v=>E(v).replace(/`/g,'&#96;');
const nl=v=>E(v).replace(/\n/g,'<br>');
const icon=path=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const btn=(text,act,cls='',attrs='')=>(['aiPrep','aiMark','aiSummary','aiParent','genComments','gradeAI','newsAI','annAnalyze','annLesson','reciteAI'].includes(act)&&ui.aiReady===false)?'':`<button type="button" class="btn ${cls}" data-act="${act}" ${attrs}>${E(text)}</button>`;
const notice=(text,blue=false)=>`<div class="notice ${blue?'blue':''}">${E(text)}</div>`;
const field=(name,label,value='',type='text',extra='')=>`<label class="field">${E(label)}<input name="${name}" type="${type}" value="${A(value)}" ${extra}></label>`;
const area=(name,label,value='',rows=3)=>`<label class="field">${E(label)}<textarea name="${name}" rows="${rows}">${E(value)}</textarea></label>`;
const formVal=(form,name)=>new FormData(form).get(name)?.toString().trim()||'';
function countVal(form,name,label,max=999){const value=Number(formVal(form,name)||0);if(!Number.isInteger(value)||value<0||value>max)throw Error(`${label}须为 0–${max} 的整数`);return value}
const ISSUE_TEMPLATES=[['字词','字词|（填写具体错字或词语）'],['句子','句子|（填写具体语句问题）'],['阅读','阅读|（填写题号与理解问题）'],['习作','习作|（填写具体表达问题）']];
const MEASURE_TEMPLATES=[['集中讲评','下节课集中讲评，并记录学生修正情况。'],['分层练习','按错例安排分层练习，课后核对完成情况。'],['再次复查','安排一次针对性复查，记录仍需帮助的学生。']];
function appendLine(current,line){return current.trim()?current.replace(/\s*$/,'')+'\n'+line:line}
function templateButtons(templates,fieldName){return `<div class="template-tools"><span class="small muted">常用模板，插入后可编辑</span><div class="row">${templates.map(([label,value])=>btn(label,'insertTemplate','sm',`data-field="${fieldName}" data-template="${A(value)}"`)).join('')}</div></div>`}
function updateStudentPickCount(form){const label=form?.querySelector?.('[data-selected-count]');if(label)label.textContent=`已选 ${form.querySelectorAll('input[name^="studentPick_"]:checked').length} 人（不选为全班）`}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
let db=null,storageMode='SQLite',state=null,saveChain=Promise.resolve(),sqliteToken='',sqliteRevision=0,storageNeedsReload=false;
let operationBusy=false,operationCommitted=false;
let storageRecovery={message:'',primary:undefined,fallbackRaw:null,writable:false};
let ui={view:'home',teachLesson:'1',markTab:'dictation',markId:null,newAssignment:false,newFollowup:null,editingFollowupId:null,editingTaskId:null,bookGrade:'current',bookTerm:'all',bookPublisher:'all',resourceTab:'textbooks',dirty:false,formDrafts:{},dictWords:[],dictIndex:-1,dictRunning:false,dictToken:0,dictTimer:null,dictReveal:false,pdfUrl:null,pdfBookId:null,pdfTemporary:false,pdfFileName:'',rollMode:'random',rollPicked:[],rollCurrent:null,rollSeq:0,annPage:1,annPages:1,annTool:'red',annLayer:'备课',annDraw:false,annStrokes:[],annUndo:[],annScale:1.5,reciteText:'',reciteGaps:[],reciteDensity:'标准',reciteCur:0,reciteHints:0,profileStudent:null,news:{list:[],date:'',source:'',err:''},newsLoading:false,gradeSel:null,gradeEditing:null,seatEdit:false,importCandidate:null,undoStatus:null};

function formDraftKey(form){return form.dataset.form+'|'+(form.dataset.id||'')}
function captureFormDraft(form){if(!form?.dataset.form)return;ui.formDrafts[formDraftKey(form)]=Object.fromEntries(new FormData(form).entries());ui.dirty=true;if(form.dataset.form==='dictTask'){ui.dictForm=ui.formDrafts[formDraftKey(form)];if(ui.dictRunning){stopDict();dictDisplay()}}}
function discardDrafts(){ui.gradeDrafts={};ui.formDrafts={};ui.dirty=false}
function restoreFormDrafts(){for(const form of document.querySelectorAll?.('form[data-form]')||[]){const values=ui.formDrafts[formDraftKey(form)];if(!values)continue;for(const [name,value] of Object.entries(values)){const control=form.elements?.namedItem(name);if(control&&control.type!=='checkbox')control.value=value}for(const control of form.querySelectorAll?.('input[type="checkbox"][name]')||[])control.checked=Object.hasOwn(values,control.name);updateStudentPickCount(form)}}
const PROMPTS_DEFAULT={
  markAnalysis:'你是小学语文特级教师。根据听写错频数据,输出:①共性错误规律(80字内)②讲评重点 2 条 ③复练建议 1 条。条理清晰,不要客套。',
  reciteGap:'你是小学语文老师助手。把课文改写成挖空版:把最关键的词替换为⟦答案⟧占位(保留原字在占位内)。只输出改写后的课文,不要解释,挖空 6 到 12 处。',
  reportCard:'你是小学语文班主任,写期末评语:100字内,基于数据先扬后抑,语气温暖鼓励,结尾给建议。直接输出评语正文。不要出现姓名,用"你"称呼。',
  studentSummary:'你是小学语文老师。基于给出的真实数据写学期小结,80 字内,先扬后抑,语气鼓励。只输出小结正文。',
  gradeAnalysis:'你是小学语文教研员。基于成绩统计写解读:120字内,指出总体水平、与上次对比的变化、2 条教学建议。只输出正文。',
  prepDraft:'你是小学语文特级教师。按"教学目标 3 条/教学环节 4 步/提问链 3 个/作业 2 项"输出教案草稿,markdown 列表,简洁实用。',
  annAnalysis:'你是小学语文教师助手。只依据提供的教材原文，给出教学重点、两个课堂提问和板书建议。信息不足请明确说明，禁止推测未提供的课文内容。输出草稿。',
  annLesson:'你是小学语文特级教师。仅基于提供的完整课次原文,输出整课备课建议:教学目标(3条)/教学环节(4步)/提问链(3个)/作业设计(2项)。markdown 列表,简洁。',
  newsSummary:'你是语文老师助手。对给出的今日新闻输出:①三句话摘要;②「教学联想」:挑 1 条新闻说明可作课堂写作素材或与语文课结合的点(60字内)。',
  parentLetter:'你是小学语文班主任。基于学生数据写一段发给家长的沟通文字:120字内,先肯定再建议,语气亲切,不出现姓名,用"孩子"称呼。只输出正文。',
};
function promptFor(key){const p=(state.settings&&state.settings.prompts)||{};return p[key]||PROMPTS_DEFAULT[key]}

const CONFIRM_VERBS={editGradeMeta:"编辑成绩单信息",goRoll:"进入点名",goRecite:"进入背诵",gradeBack:"返回成绩列表",pickGrade:"切换成绩单",pickStudent:"切换学生",profileBack:"返回档案列表",editRecord:"编辑另一条记录",editComment:"编辑另一条评语",printSeats:"进入座位表",openPoints:"进入积分榜",openPdf:"打开教材",closePdf:"关闭教材","navigate":"离开当前页面","selectLesson":"切换课次","newLesson":"新建课次","openTask":"离开当前页面","editTask":"编辑该待办","markTab":"切换批改页签","selectMark":"切换批改记录","followupResult":"编辑该复查","resourceTab":"切换资料页签","bindBook":"绑定教材","switchClass":"切换班级","reopenDict":"重新报词"};
function defaultState(){return {version:1,classes:[],selectedClassId:null,students:[],progress:[],preps:[],dictations:[],assignments:[],followups:[],tasks:[],customBooks:[],legacyWrong:[],records:[],reciteLogs:[],reciteTexts:{},reportCards:{},reportArchive:[],annotations:[],aiCache:{},grades:[],seats:[],points:{},newsCache:{date:'',list:[],source:''},widgets:{marquee:{texts:['今天也要元气满满,孩子们加油!'],style:'ribbon'},clock:{countdownMin:0}},bankOverride:{},settings:{ai:{base:'https://api.deepseek.com',model:'deepseek-flash'},voice:'',prompts:{}},legacyLessonNo:null,legacyPicks:{},createdAt:new Date().toISOString()}}
function readLegacy(key,fallback){try{const x=localStorage.getItem(key);return x===null?fallback:JSON.parse(x)}catch{return fallback}}
function migrateLegacy(){const s=defaultState();const oldClasses=readLegacy('wb_classes',[]);if(Array.isArray(oldClasses)){s.classes=oldClasses.filter(x=>typeof x==='string'&&x.trim()).map(name=>({id:uid(),name:name.trim(),grade:3,term:'上册',publisher:'旧版未指定',editionYear:'',bookId:'',createdAt:new Date().toISOString()}))}const oldSelected=readLegacy('wb_cls','');s.selectedClassId=s.classes.find(c=>c.name===oldSelected)?.id||s.classes[0]?.id||null;const wrong=readLegacy('wb_wrong',[]);s.legacyWrong=Array.isArray(wrong)?wrong.filter(x=>x&&typeof x.w==='string').map(x=>({id:uid(),word:x.w,pinyin:x.p||'',date:x.ts||Date.now(),classId:null})):[];const overrides=readLegacy('wb_bank',{});if(overrides&&typeof overrides==='object'&&!Array.isArray(overrides))s.bankOverride=overrides;const settings=readLegacy('wb_settings',{});if(settings?.ai)s.settings.ai={key:settings.ai.key||'',base:settings.ai.base||'https://api.deepseek.com',model:settings.ai.model||'deepseek-flash'};s.settings.voice=readLegacy('wb_voice','')||'';s.legacyLessonNo=readLegacy('wb_lesson',null);try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('wb_dpick_'))s.legacyPicks[k.slice(9)]=readLegacy(k,[])}}catch{}return s}
// Legacy browser storage is read only and used exclusively for exporting migration backups.
function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME);request.onupgradeneeded=()=>request.transaction.abort();request.onblocked=()=>reject(Error('旧数据库被其他窗口占用，请关闭其他工作台窗口后重试'));request.onsuccess=()=>resolve(request.result);request.onerror=()=>request.error?.name==='AbortError'?resolve(null):reject(request.error)})}
function getDB(key=STATE_KEY){return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const q=tx.objectStore(DB_STORE).get(key);tx.oncomplete=()=>resolve(q.result);tx.onerror=()=>reject(tx.error||q.error||Error('旧数据读取失败'));tx.onabort=()=>reject(tx.error||Error('旧数据读取中断'))})}
function checkedStoredState(value){if(!validImport({format:'teacher-workbench-r1',version:1,state:value}))throw Error('数据结构或关联记录无效，请先导出副本，再选择有效备份恢复');return value}
function apiBase(){return ''}
async function ipcRequest(path,options={}){
  if(path==='/api/session')return {token:'ipc',storage:'SQLite',app:'primary-chinese-workbench'};
  if(path==='/api/state'&&(!options.method||options.method==='GET'))return window.desktop.loadState();
  if(path==='/api/state'&&options.method==='PUT'){const b=JSON.parse(options.body);return window.desktop.saveState(b.state,b.revision,b.mutationId).catch(e=>{const m=String((e&&e.message)||e).replace(/^Error:s*/,'');const err=new Error(m);if(/其他窗口|操作标识/.test(m))err.status=409;throw err})}
  throw Error('接口不存在');
}
async function requestJSON(path,options={}){
  // 桌面模式:数据读写直走进程 IPC,无端口/无网络/无注入时序
  if(window.desktop&&window.desktop.loadState)return ipcRequest(path,options);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(apiBase()+path,{...options,signal:controller.signal,cache:'no-store'});
    const value=await response.json();
    if(!response.ok){const error=Error(value.error||'本机服务请求失败');error.status=response.status;throw error}
    return value
  }finally{clearTimeout(timer)}
}

async function aikeyRequest(options={}){
  if(!sqliteToken)await refreshSession();
  const send=()=>requestJSON('/api/aikey',{...options,headers:{'Content-Type':'application/json','X-Workbench-Token':sqliteToken}});
  try{return await send()}catch(e){if(e.status!==403)throw e;await refreshSession();return send()}
}
async function refreshSession(){const session=await requestJSON('/api/session');if(session.app!=='primary-chinese-workbench'||session.storage!=='SQLite'||!session.token)throw Error('当前地址不是 SQLite 教师工作台服务');sqliteToken=session.token}
async function sqliteRequest(options={}){
  if(!sqliteToken)await refreshSession();
  const send=()=>requestJSON('/api/state',{...options,headers:{'Content-Type':'application/json','X-Workbench-Token':sqliteToken}});
  try{return await send()}catch(e){if(e.status!==403)throw e;await refreshSession();return send()}
}
async function loadState(){
  storageRecovery={message:'',primary:undefined,fallbackRaw:null,writable:false};
  if(location.protocol==='file:'&&!window.desktop){
    const errors=[];
    try{storageRecovery.fallbackRaw=localStorage.getItem('wb_r1_state')}catch(e){errors.push('备用存储读取失败')}
    try{db=await openDB();if(db)storageRecovery.primary=await getDB()}catch(e){errors.push(e.message)}finally{db?.close?.();db=null}
    if(storageRecovery.primary==null&&storageRecovery.fallbackRaw===null){const old=migrateLegacy();if(old.classes.length||old.legacyWrong.length||Object.keys(old.bankOverride).length||['wb_settings','wb_voice','wb_lesson'].some(key=>{try{return localStorage.getItem(key)!==null}catch{return false}}))storageRecovery.primary=old}
    throw Error('已切换至 SQLite。此文件页面仅用于导出旧记录。请先导出下方已有副本，再从本机服务的设置页面导入。'+errors.join('；'));
  }
  await refreshSession();const result=await sqliteRequest();sqliteRevision=result.revision;
  storageRecovery.primary=result.state;storageRecovery.writable=true;
  state=result.state===null?defaultState():Object.assign(defaultState(),structuredClone(checkedStoredState(result.state)));migrateScopedBuckets();
  await migrateStoredKey();state.records=state.records||[];state.reciteLogs=state.reciteLogs||[];state.aiCache=state.aiCache||{};state.newsCache=state.newsCache||{date:'',list:[],source:''};state.grades=state.grades||[];state.seats=state.seats||[];state.points=state.points||{};state.widgets=state.widgets||{marquee:{texts:['今天也要元气满满,孩子们加油!'],style:'ribbon'},clock:{countdownMin:0}};
  storageNeedsReload=false;
  // Reconcile bundled book references in memory; persist with the next explicit user save.
  reconcileBooks();migrateReports();try{ui.aiReady=await DesktopAI.hasKey()}catch{ui.aiReady=false}
}
function setSaving(busy){const app=document.querySelector('#app');if(app){app.inert=busy;app.setAttribute?.('aria-busy',String(busy))}}
async function stateOperation(work,form=null){
  if(operationBusy)return toast('正在处理，请稍候');
  operationBusy=true;operationCommitted=false;
  const previousState=structuredClone(state),previousUi=structuredClone(ui);
  try{return await work()}
  catch(e){
    if(!operationCommitted){
      state=previousState;ui=previousUi;stopDict();
      if(form)captureFormDraft(form);
      try{renderApp()}catch(renderError){console.error(renderError)}
    }
    console.error(e);toast(operationCommitted?'数据已保存，但页面显示失败，请刷新后查看。':e.uncertain?e.message:`操作未保存：${e.message}。表单内容已保留。`);
  }finally{operationBusy=false;setSaving(false)}
}
function save(){
  ui.undoStatus=null;const snapshot=structuredClone(state);setSaving(true);
  saveChain=saveChain.catch(()=>{}).then(async()=>{
    if(location.protocol==='file:'&&!window.desktop)throw Error('请从本机 SQLite 服务或桌面版保存');
    if(storageNeedsReload)throw Error('请先在设置中重新读取数据库，核对最新记录后再保存');
    const body=JSON.stringify({state:snapshot,revision:sqliteRevision,mutationId:uid()});
    let result;
    for(let attempt=0;attempt<2;attempt++){
      try{result=await sqliteRequest({method:'PUT',body});break}catch(e){
        if(e.status){if(e.status===409)storageNeedsReload=true;throw e}
        if(attempt===1){storageNeedsReload=true;const error=Error('连接中断，保存结果尚未确认。请保留表单内容，在设置中重新读取数据库核对记录');error.uncertain=true;throw error}
      }
    }
    sqliteRevision=result.revision;if(operationBusy)operationCommitted=true;if(Object.keys(ui.formDrafts).length===0)ui.dirty=false;
  });return saveChain.finally(()=>setSaving(false));
}
function resetRecordContext(){
  stopDict();if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);
  discardDrafts();Object.assign(ui,{teachLesson:'1',markId:null,activeDictId:null,dictWords:[],dictForm:null,dictIndex:-1,dictReveal:false,newAssignment:false,newFollowup:null,editingFollowupId:null,editingTaskId:null,csvCandidate:null,csvClassId:null,importCandidate:null,undoStatus:null,pdfUrl:null,pdfBookId:null,pdfTemporary:false,pdfFileName:''});
}
function clearDictContext(){stopDict();Object.assign(ui,{activeDictId:null,dictWords:[],dictForm:null,dictIndex:-1,dictReveal:false})}
function clearCsvPreview(){ui.csvCandidate=null;ui.csvClassId=null}
function clearClassContext(){
  clearDictContext();clearCsvPreview();if('speechSynthesis'in window)speechSynthesis.cancel();
  Object.assign(ui,{teachLesson:'1',markId:null,newAssignment:false,newFollowup:null,editingFollowupId:null,editingTaskId:null,gradeSel:null,gradeDetail:null,profileStudent:null,editRecordId:null,editCommentId:null,reciteStudent:null,rollPicked:[],rollCurrent:null,rollSeq:0,seatSwapA:null,reciteRaw:'',reciteText:'',reciteGaps:[],countdownEnd:null,countdownLeft:null});
  if(['pdf','rollcall','recite','seats','points','comments'].includes(ui.view))ui.view=parentView(ui.view);
}
function validState(x){return x&&x.version===1&&['classes','students','progress','preps','dictations','assignments','followups','tasks','customBooks','legacyWrong'].every(k=>Array.isArray(x[k]))&&x.settings&&typeof x.settings==='object'}
function currentClass(){return state.classes.find(x=>x.id===state.selectedClassId)||null}
function inClass(items){return items.filter(x=>x.classId===state.selectedClassId)}
function inBook(items){const bookId=currentClass()?.bookId||'';return inClass(items).filter(x=>(x.bookId||'')===bookId)}
function bookCatalog(){return [...(window.TEXTBOOKS||[]),...state.customBooks].map(b=>({...b,lessons:state.bookLessons?.[b.bookId]||b.lessons||[]}))}
function reconcileBooks(){let changed=false;const packed=window.TEXTBOOKS||[];state.customBooks=state.customBooks.filter(custom=>{const match=packed.find(x=>x.publisher===custom.publisher&&Number(x.grade)===Number(custom.grade)&&x.term===custom.term&&x.editionYear===custom.editionYear);if(!match)return true;for(const c of state.classes)if(c.bookId===custom.bookId){c.bookId=match.bookId;c.publisher=match.publisher;c.editionYear=match.editionYear}for(const key of ['progress','preps','dictations','assignments','followups'])for(const rec of state[key])if(rec.bookId===custom.bookId)rec.bookId=match.bookId;changed=true;return false});return changed}
function activeBook(){const c=currentClass();return c?bookCatalog().find(b=>b.bookId===c.bookId)||null:null}
function bankLessons(){return (window.BANK?.lessons||[]).map(l=>state.bankOverride[l.no]?{...l,...state.bankOverride[l.no]}:l)}
function classLessonRecords(){const c=currentClass();if(!c)return[];const records=inBook(state.progress);const dict=new Map(records.map(x=>[String(x.lessonNo),x]));if(c.grade===3&&c.term==='上册'&&!c.bookId){for(const l of bankLessons())if(!dict.has(String(l.no)))dict.set(String(l.no),{classId:c.id,lessonNo:String(l.no),title:l.title,status:'未开始',sample:true})}return [...dict.values()].sort((a,b)=>(Number(a.lessonNo)||999)-(Number(b.lessonNo)||999)||String(a.lessonNo).localeCompare(String(b.lessonNo),'zh-CN'))}
function selectedLesson(){return classLessonRecords().find(x=>String(x.lessonNo)===String(ui.teachLesson))||null}
function nowStr(){const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())}
function dateText(s){return s?E(s):'未安排'}
function toast(message,type){const box=document.querySelector('#toast');
  type=type||(/失败|错误|请先|无法|不正确|不存在/.test(message)?'error':/成功|已保存|已创建|已导入|已删除|已记录|已归档|已更新|已复制|已采纳|已审定|已完成|已记入/.test(message)?'success':'info');
  const icon=type==='error'?'!':type==='success'?'✓':'i';
  box.classList.remove('show','t-success','t-error','t-info');box.classList.add('show','t-'+type);
  box.innerHTML='<span class="t-ic">'+icon+'</span><span class="t-msg">'+E(message)+'</span><i class="t-bar"></i>';  if(typeof box.querySelector!=='function'){box.textContent=icon+' '+message}
  clearTimeout(box._timer);box._timer=setTimeout(()=>box.classList.remove('show'),2600)}
function countSource(type){return type==='dictation'?state.dictations:state.assignments}
function sourceTitle(type,id){const r=countSource(type).find(x=>x.id===id&&x.classId===state.selectedClassId);return r?.title||r?.content||'原记录已删除'}
function derived(){
  if(!currentClass())return {all:[],lecture:0,mark:0,teach:0,follow:0};
  const now=today(),tasks=[];
  for(const p of inBook(state.progress))if(p.planDate&&lessonDay(p.planDate)<=now&&p.status==='未开始')tasks.push({kind:'teach',title:`第${p.lessonNo}课 · 计划上课`,detail:p.planDate,view:'teaching',id:p.id});
  for(const d of inBook(state.dictations))if(d.markedCount<d.participantCount)tasks.push({kind:'mark',title:`${d.title} · 待批 ${d.participantCount-d.markedCount} 份`,detail:d.date,view:'marking',id:d.id});
  for(const a of inBook(state.assignments))if(a.markedCount<a.participantCount)tasks.push({kind:'mark',title:`${a.content} · 待批 ${a.participantCount-a.markedCount} 份`,detail:a.date,view:'marking',id:a.id});
  for(const f of inBook(state.followups))if(f.status!=='完成'&&(!f.dueDate||f.dueDate<=now))tasks.push({kind:f.kind==='讲评'?'lecture':'follow',title:f.title,detail:f.dueDate||'未设日期',view:'marking',id:f.id});
  for(const t of inClass(state.tasks))if(t.status!=='完成'&&(!t.dueDate||t.dueDate<=now))tasks.push({kind:'manual',title:t.title,detail:t.dueDate||'未设日期',view:'teaching',id:t.id});
  return {all:tasks,lecture:tasks.filter(x=>x.kind==='lecture').length,mark:tasks.filter(x=>x.kind==='mark').length,teach:tasks.filter(x=>x.kind==='teach').length,follow:tasks.filter(x=>x.kind==='follow').length};
}
function stopDict(){ui.dictToken++;ui.dictRunning=false;clearTimeout(ui.dictTimer);ui.dictTimer=null;if('speechSynthesis'in window)speechSynthesis.cancel()}
async function switchView(view){if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))return;if(!NAV.some(x=>x[0]===parentView(view)))view='home';if(ui.view==='dictation'&&view!=='dictation')stopDict();if(ui.view==='pdf'&&view!=='pdf'){if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);ui.pdfUrl=null;ui.pdfBookId=null;ui.pdfTemporary=false;ui.pdfFileName=''}ui.view=view;if(view!=='teaching')ui.editingTaskId=null;if(view!=='marking')ui.editingFollowupId=null;if(ui.view!=='recite'&&'speechSynthesis'in window)speechSynthesis.cancel();discardDrafts();location.hash=view;renderApp()}
function renderRecovery(){document.querySelector('#app').innerHTML=`<main class="page"><section class="card stack"><h1>${'恢复本机教学记录'}</h1><p role="alert">${E(storageRecovery.message)}</p><p><b>桌面版会自动重连内置数据库(内置双通道),点「重新读取」即可。</b></p><p>读取失败不会清空原存储。请先保留副本，再选择有效的 JSON 备份；PDF 文件不受此操作影响。</p><div class="row">${storageRecovery.primary!==undefined?btn('导出主存储副本','exportRecovery','','data-source="primary"'):''}${storageRecovery.fallbackRaw!==null?btn('导出备用存储副本','exportRecovery','','data-source="fallback"'):''}${btn('重新读取','retryStorage')}</div>${storageRecovery.writable?`<label class="btn primary" for="backupFile">选择 JSON 备份恢复</label><input id="backupFile" type="file" accept=".json,application/json" hidden>${ui.importCandidate?renderImportPreview():''}`:'<p>请在本机服务页面导入备份；如果服务连接失败，请先运行 start.cmd，再重新读取。</p>'}<p class="small muted">有效备份默认排除 API Key。副本与教材 PDF 请保存在自己管理的文件夹中。</p></section></main>`}
function renderNews(){
  const n=ui.news;const hasCache=state.newsCache&&state.newsCache.list.length;
  const aiOut=state.aiCache&&state.aiCache['news:'+n.date];
  return heading('新闻 · 每天60秒','来自开源 60s API(多源容错);内容抓取自公开新闻,仅供教师个人浏览。',btn(n.newsLoading?'刷新中…':'↻ 刷新','newsRefresh','sm'))+
  `<div class="grid cols2">
  <section class="card">
    <div class="row space"><h2>${n.date?E(n.date):'今日新闻'} ${n.source?'<span class="pill">'+E(n.source)+'</span>':''}</h2></div>
    ${ui.newsLoading?'<p class="muted">正在从多个新闻源拉取…</p>':
      n.list.length?`<ol class="newslist">${n.list.map(x=>'<li>'+E(x)+'</li>').join('')}</ol>${n.err?'<p class="small" style="color:var(--coral)">'+E(n.err)+'</p>':''}`
      :'<p class="muted">暂无内容。点击右上「刷新」拉取(需要联网;新闻页是全应用唯一主动联网的功能)。</p>'}
    
    <p class="small muted">隐私说明:新闻拉取不携带任何本机数据;学生数据永不参与。</p>
  </section>
  <section class="stack">
    <div class="card ai-card"><h2>✦ AI 新闻摘要 + 教学联想</h2>
      <div id="newsAIOut">${aiOut?E(aiOut):'<span class="muted small">把今日新闻压缩成 3 句摘要,并联想 1 个可与语文课结合的点(如今日热词/写作素材)。</span>'}</div>
      <div class="row mt">${btn('✦ 生成','newsAI','sky sm')}${aiOut?btn('复制','newsAICopy','grass sm'):''}</div>
    </div>
    <div class="card"><h2>数据来源</h2><p class="small muted">开源项目 <a href="#" data-act="openNewsRepo">vikiboss/60s</a>(MIT),经社区公共实例获取;每日更新,15 条精选。网络不可用时可离线查看当日缓存。</p></div>
  </section></div>`}
function renderClassroom(){if(!currentClass())return noClass();const done=ui.rollPicked.length,pool=rollPool();return heading('课堂','随机点名、抽背与听写,投影大屏友好。')+`
<div class="grid cols2">
<section class="card"><h2>随机点名 · 模式</h2><div class="stack">
${[['random','纯随机','每次从全班抽取'],['seq','顺延','按学号依次'],['norepeat','不重复','本轮已点不再抽']].map(([k,t,d])=>`<button class="btn ${ui.rollMode===k?'active':''}" data-act="rollMode" data-mode="${k}" style="text-align:left"><b>${t}</b> <small>${d}</small></button>`).join('')}
<div class="inset small muted">本轮已点 ${done} 人 · 全班 ${pool.length} 人${ui.rollCurrent?`<br>上一次:<b>${E(ui.rollCurrent.no)}号 ${E(ui.rollCurrent.name)}</b>`:''}</div>
${btn('打开点名大屏','goRoll','primary mt')}
</div></section>
<section class="card"><h2>课堂工具</h2><div class="stack">
${btn('听写报词台','navigate','','data-view="dictation"')}
${btn('背诵训练(挖空督背)','goRecite','')}
<p class="small muted">点名大屏:空格键抽取、回车记录表现,适合投影。</p>
</div></section>
</div>`}
function renderRollcall(){
  const pool=rollPool();const remain=pool.length-ui.rollPicked.length;
  const cur=ui.rollCurrent;
  return `<div class="rollstage">
  <div class="roll-head"><b>随机点名 · ${E((currentClass()||{}).name||'')}</b>
    <div class="row gap8">${[['random','纯随机'],['seq','顺延'],['norepeat','不重复']].map(([k,t])=>`<button class="chip ${ui.rollMode===k?'on':''}" data-act="rollMode" data-mode="${k}">${t}</button>`).join('')}</div>
    <span class="grow"></span>
    ${btn('✓ 记录表现','rollMark','primary sm')+btn('下一位','rollSkip','sm')+btn('新一轮','rollReset','sm')+btn('退出','navigate','sm','data-view="classroom"')}
  </div>
  <div class="roll-center">
    <div class="roll-avatar"><div class="roll-ava-in">${cur?E(cur.no):'?'}</div></div>
    ${cur?`<div class="roll-name">${E(cur.no)}号 · ${E(cur.name)}</div>`:'<div class="roll-name dim">按空格键开始抽取</div>'}
    ${cur?'<div class="roll-meta">第 '+ui.rollSeq+' 次抽取</div>':''}
    <div class="roll-chips"><span class="chip">本轮已抽 ${ui.rollPicked.length}/${pool.length}</span><span class="chip">剩余 ${remain} 人</span></div>
  </div>
  <div class="roll-foot"><span>本节课已点:${ui.rollPicked.map(x=>E(x.no)).join('、')||'—'}</span><span class="grow"></span><span>空格=抽取 · 回车=记录表现</span></div>
</div>`}
function renderRecite(){
  if(!currentClass())return noClass();const students=inClass(state.students).sort(studentOrder),gaps=ui.reciteGaps||[];
  const body=E(ui.reciteText||'').replace(/⟦(\d+)⟧/g,(_,n)=>Number(n)<ui.reciteCur?`<b>${E(gaps[Number(n)]||'')}</b>`:'<span class="gap-slot">____</span>');
  return heading('背诵训练','选择本班学生，教师确认训练结果后归档。',btn('返回课堂','navigate','sm','data-view="classroom"'))+`
  <section class="card"><div class="fieldrow"><label class="field">本次学生<select id="reciteStudent"><option value="">请选择学生</option>${students.map(s=>`<option value="${A(s.id)}" ${ui.reciteStudent===s.id?'selected':''}>${E(s.no)} · ${E(s.name)}</option>`).join('')}</select></label><div>教材：${E(activeBook()?.title||'未绑定')} · 第 ${E(ui.teachLesson)} 课</div></div></section>
  <div class="grid cols2 mt"><section class="card"><h2>课文与挖空</h2><form data-form="recite" class="stack">${area('reciteText','课文原文',ui.reciteRaw||'',6)}<div class="row">${btn('保存到本班课文库','reciteSave','primary')}${btn('普通挖空','reciteAuto')}${btn('AI 挖空','reciteAI')}${btn('还原原文','reciteReset')}</div></form><div class="row mt">${['轻松','标准','挑战'].map(d=>btn(d,'reciteDensity',ui.reciteDensity===d?'active':'',`data-d="${d}"`)).join('')}</div><div class="recite-body">${body||'请先填写并保存原文。'}</div></section>
  <section class="card"><h2>本次训练</h2><p>提示 ${ui.reciteHints||0} 次 · 共 ${gaps.length} 空</p><div class="stack mt">${btn('朗读原文','reciteSpeak')}${btn('上一空','recitePrev')}${btn('下一空','reciteNext')}${btn('提示首字','reciteHintFirst')}${btn('提示整词','reciteHintFull')}${btn('完成并确认结果','reciteDone','primary')}</div></section></div>`;
}
function rollNext(){
  const pool=rollPool().sort(studentOrder);if(!pool.length)return toast('名册为空，请先导入学生');
  ui.rollPicked=ui.rollPicked||[];let pick;
  if(ui.rollMode==='seq'){const i=pool.findIndex(x=>x.id===ui.rollCurrent?.id);pick=pool[(i+1)%pool.length]}
  else {const done=new Set(ui.rollPicked.map(x=>x.id));const available=pool.filter(x=>ui.rollMode!=='norepeat'||!done.has(x.id));if(!available.length)return toast('本轮已点完，请点“新一轮”后继续');pick=available[Math.floor(Math.random()*available.length)]}
  ui.rollCurrent=pick;ui.rollSeq=(ui.rollSeq||0)+1;if(!ui.rollPicked.some(x=>x.id===pick.id))ui.rollPicked.push(pick);renderApp();
}
async function newsFetch(force){
  if(ui.newsLoading)return;
  const todayStr=today();
  if(!force&&state.newsCache&&state.newsCache.date===todayStr&&state.newsCache.list.length){ui.news={list:state.newsCache.list,date:state.newsCache.date,source:state.newsCache.source,err:''};renderApp();return}
  ui.newsLoading=true;renderApp();
  try{
    let payload=null;
    if(window.desktop&&window.desktop.news){payload=await window.desktop.news.fetch()}
    else{payload=await requestJSON('/api/news')}
    if(payload&&payload.news&&payload.news.length){
      state.newsCache={date:payload.date||todayStr,list:payload.news,source:payload.source||'',tip:payload.tip||''};
      ui.news={list:state.newsCache.list,date:state.newsCache.date,source:state.newsCache.source,err:''};
      ui.newsLoading=false;ui.dirty=true;await save();renderApp();return;
    }
    throw Error(payload.error||'新闻源无数据');
  }catch(e){
    ui.newsLoading=false;
    ui.news={list:(state.newsCache&&state.newsCache.list)||[],date:(state.newsCache&&state.newsCache.date)||'',source:(state.newsCache&&state.newsCache.source)||'',
      err:'新闻拉取失败:'+String(e.message||e).slice(0,60)+'。显示的是当日缓存(如有)。'};
    renderApp();
  }
}
function reciteAutoGaps(){
  const text=ui.reciteText;if(!text.trim())return toast('先录入课文');
  const density={'轻松':2,'标准':3,'挑战':4}[ui.reciteDensity]||3;
  const words=[];const rx=/[\u4e00-\u9fff]{2,4}/g;let m,i=0;
  const parts=[];let last=0;
  while((m=rx.exec(text))&&words.length<30){
    if((i++)%density===0){words.push(m[0]);parts.push([m.index,m.index+m[0].length])}
  }
  // 构建带 ⟦i⟧ 占位的文本与 gaps
  let out='';let cursor=0;const gaps=[];
  parts.forEach(([s,e],idx)=>{out+=text.slice(cursor,s)+'⟦'+idx+'⟧'+text.slice(s,e);cursor=e;gaps.push(text.slice(s,e))});
  out+=text.slice(cursor);
  ui.reciteText=out;ui.reciteGaps=gaps;ui.reciteCur=0;ui.reciteHints=0;renderApp();
}
function renderApp(){if(storageRecovery.message)return renderRecovery();const c=currentClass();const NAVC={home:'var(--sky)',teaching:'var(--sky)',marking:'var(--sky)',resources:'var(--sky)',classes:'var(--sky)',settings:'var(--sky)',classroom:'var(--sky)',profile:'var(--sky)',news:'var(--sky)'};
const nav=NAV.map(([key,label,path])=>`<button type="button" data-act="navigate" data-view="${key}" style="--nc:${NAVC[key]||'#3157D4'}" class="${parentView(ui.view)===key?'on':''}" aria-current="${parentView(ui.view)===key?'page':'false'}">${icon(path)}${label}</button>`).join('');const options=state.classes.map(x=>`<option value="${A(x.id)}" ${x.id===state.selectedClassId?'selected':''}>${E(x.name)} · ${x.grade}年级${E(x.term)}</option>`).join('');let body;switch(ui.view){case'home':body=renderHome();break;case'teaching':body=renderTeaching();break;case'dictation':body=renderDictation();break;case'marking':body=renderMarking();break;case'resources':body=renderResources();break;case'pdf':body=renderPdfReader();break;case'classroom':body=renderClassroom();break;case'comments':body=renderComments();break;case'rollcall':body=renderRollcall();break;case'news':body=renderNews();break;case'grades':body=renderGrades();break;case'seats':body=renderSeats();break;case'points':body=renderPoints();break;case'recite':body=renderRecite();break;case'profile':body=renderProfile();break;case'classes':body=renderClasses();break;case'settings':body=renderSettings();break;default:body=renderHome()}document.querySelector('#app').innerHTML=`<aside class="sidebar"><div><div class="brand"><img class="brand-logo" src="data:image/png;base64,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" alt="logo">小学语文工作台</div></div><nav class="nav" aria-label="主导航">${nav}</nav></aside><div class="shell"><header class="topbar ${window.desktop?'desktop-topbar':''}"><label class="sr" for="classSwitch">当前班级</label><select id="classSwitch" aria-label="当前班级"><option value="">${c?'选择班级':'尚未建立班级'}</option>${options}</select><span class="small muted">${c?E(c.publisher||'未绑定教材')+' · '+c.grade+'年级'+E(c.term):'先建立班级'}</span>${ui.undoStatus?btn('撤销上次状态切换','undoStatus','sm'):''}<span class="right small muted" id="nowText">${E(nowStr())}</span></header><main id="mainContent" tabindex="-1" data-view="${A(ui.view)}" class="page${ui.view==='pdf'?' pdf-full':ui.view==='home'?' home-fill':''}">${body}</main></div>`;restoreFormDrafts();tintStatusSelects();enhanceSelects();if(!window.__clockTimer&&typeof setInterval==='function'){window.__clockTimer=setInterval(()=>{const el=document.getElementById('nowText');if(el)el.textContent=nowStr()},1000)}
  startClockTicker();updateClock();try{document.body.classList.add('platform-'+(window.desktop&&window.desktop.platform||'win'))}catch(e){}if(ui.view==='pdf'&&ui.pdfBookId)setTimeout(()=>{try{annBindCanvas()}catch(e){}},60)}
function heading(title,subtitle='',actions=''){return `<div class="page-head book-heading"><div class="chapter-copy"><span class="chapter-kicker">语文 · 教学手记</span><h1>${E(title)}</h1>${subtitle?`<p class="lead">${E(subtitle)}</p>`:''}</div>${actions?`<div class="row chapter-actions">${actions}</div>`:''}<img class="chapter-art" src="__BOOK_LANDSCAPE__" alt="" aria-hidden="true" decoding="async" draggable="false"></div>`}
function noClass(){return heading('先建立一个班级','工作台会按班级保存教学记录。')+`<div class="card empty papertexture"><div class="mark">田</div><h2>还没有班级</h2><p>建立班级后即可安排课次、听写和批改。</p>${btn('建立班级','navigate','primary','data-view="classes"')}</div>`}
function renderHome(){const c=currentClass();if(!c)return noClass();const d=derived();const recent=[...inBook(state.dictations).map(x=>({...x,kind:'听写'})),...inBook(state.assignments).map(x=>({...x,kind:'作业'}))].sort((a,b)=>String(b.updatedAt||b.date).localeCompare(String(a.updatedAt||a.date))).slice(0,5);const MCARDS=[['计划上课',d.teach,'teaching','','M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z','#3157D4'],['待批改',d.mark,'marking','dictation','M4 20h16M5 16l2-10 10-2 3 3-2 10-10 2z','#AF1D88'],['待讲评',d.lecture,'marking','followups','M4 5h16v10H9l-5 5V5z','#AF1D88'],['待复查',d.follow,'marking','followups','M10.5 3a7.5 7.5 0 1 0 4.6 13.4L21 21m-4.9-4.6A7.5 7.5 0 0 0 10.5 3z','#3157D4']];const cards=MCARDS.map(([label,n,v,tab,path,color])=>`<button class="card metric" style="--mc:${color}" data-act="navigate" data-view="${v}" data-tab="${tab}" type="button"><i class="mic" aria-hidden="true">${icon(path)}</i><div class="mtxt"><span>${label}</span><b>${n}</b><small>查看来源 →</small></div></button>`).join('');const todo=d.all.length?`<div class="stack">${d.all.map((t,i)=>`<div class="item row space"><i class="nb" style="background:${NB_COLORS[i%NB_COLORS.length]}">${i+1}</i><div><div class="item-title">${E(t.title)}</div><small>${E(t.detail)} · ${E(t.kind==='mark'?'批改记录':['follow','lecture'].includes(t.kind)?'讲评/复查记录':'教学记录')}</small></div>${btn('去处理','openTask','sm',`data-kind="${A(t.kind)}" data-id="${A(t.id)}" data-target="${t.view}"`)}</div>`).join('')}</div>`:`<div class="empty"><div class="mark">◇</div><h2>还没有待办</h2><p>先建立教学计划或记录一次作业，今天的任务会自动出现在这里。</p><div class="row" style="justify-content:center">${btn('建立教学计划','navigate','primary','data-view="teaching"')}${btn('添加作业记录','newAssignment','','')}</div></div>`;return heading('今天先做什么','以下内容来自本班已保存的教学记录。')+`<div class="widgets-row">${widgetMarquee()}${widgetClock()}</div><div class="metrics">${cards}</div><div class="grid cols2"><section class="card papertexture"><h2>今日待办</h2>${todo}</section><section class="card papertexture"><h2>教学进度</h2>${inBook(state.progress).length?`<p class="small muted" style="margin-bottom:10px">已安排 ${inBook(state.progress).length} 个课次</p><div class="tl">${inBook(state.progress).slice(-3).map(p=>`<div class="tl-item"><i class="dot${p.status==='已上课'?' done':''}${p.status==='已讲评'?' done2':''}"></i><div class="tl-txt"><b>第${E(p.lessonNo)}课 ${E(p.title||'')}</b><small>${E(p.status)} · 计划 ${dateText(p.planDate)}</small></div></div>`).join('')}</div>`:'<p class="muted">尚未安排课次。</p>'}${btn('查看进度','navigate','sm','data-view="teaching"')}</section></div><section class="card mt"><h2>最近批改</h2>${recent.length?`<div class="tablewrap"><table><thead><tr><th>任务</th><th>日期</th><th>已批 / 参与</th><th>下一步</th></tr></thead><tbody>${recent.map(x=>`<tr><td>${E(x.title||x.content)}</td><td>${dateText(x.date)}</td><td>${x.markedCount||0} / ${x.participantCount||0}</td><td>${btn('查看记录','openTask','sm',`data-kind="mark" data-id="${A(x.id)}" data-target="marking"`)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">暂无批改记录。</p>'}</section>`}

function weekOverview(){
 const c=currentClass(),records=inBook(state.progress).filter(x=>x.planDate).sort((a,b)=>a.planDate.localeCompare(b.planDate));
 const groups=new Map();
 for(const rec of records){const date=new Date(lessonDay(rec.planDate)+'T12:00:00');if(Number.isNaN(date.getTime()))continue;let label;if(c?.semesterStart){const first=new Date(c.semesterStart+'T12:00:00');label=Number.isNaN(first.getTime())?'日期待核':date<first?'学期开始前':`第 ${Math.floor((date-new Date(lessonDay(c.semesterStart)+'T12:00:00'))/604800000)+1} 周`}else{const monday=new Date(date);monday.setDate(date.getDate()-(date.getDay()+6)%7);label=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')} 起`};if(!groups.has(label))groups.set(label,[]);groups.get(label).push(rec)}
 return `<section class="card mt"><div class="row space"><h2>学期 / 周计划</h2><span class="small muted">${c?.semesterStart?`学期起始 ${E(c.semesterStart)}`:'可在班级设置中填写学期起始日'}</span></div>${groups.size?[...groups].map(([week,items])=>`<div class="item"><b>${E(week)}</b><div class="row mt">${items.map(x=>btn(`第${x.lessonNo}课 ${x.title||''} · ${x.status||'未开始'}`,'selectLesson','sm',`data-no="${A(x.lessonNo)}"`)).join('')}</div></div>`).join(''):'<p class="muted">保存课次的计划日期后，周计划会按日期自动汇总。</p>'}</section>`
}
function renderManualTasks(){const tasks=inClass(state.tasks);if(!tasks.length)return '<p class="muted">暂无手动待办。</p>';return tasks.map(t=>`<div class="item"><div class="row space"><span><b>${E(t.title)}</b> <small>${dateText(t.dueDate)} · ${E(t.status)}</small></span><div class="row">${btn('编辑','editTask','sm',`data-id="${A(t.id)}"`)}${btn(t.status==='完成'?'重新打开':'完成','toggleTask','sm',`data-id="${A(t.id)}"`)}${btn('删除','deleteTask','sm danger',`data-id="${A(t.id)}"`)}</div></div>${ui.editingTaskId===t.id?`<form data-form="manualTaskEdit" data-id="${A(t.id)}" class="stack inset mt"><div class="fieldrow">${field('title','待办事项',t.title,'text','required')}${field('dueDate','日期',t.dueDate||'','date')}</div><div class="row"><button type="submit" class="btn primary">保存修改</button>${btn('取消','cancelTaskEdit','sm')}</div></form>`:''}</div>`).join('')}

function renderTeaching(){const c=currentClass();if(!c)return noClass();const lessons=classLessonRecords(),chosen=selectedLesson(),p=chosen&&!chosen.sample?chosen:null,prep=state.preps.find(x=>x.classId===c.id&&(x.bookId||'')===(c.bookId||'')&&String(x.lessonNo)===String(ui.teachLesson));const lessonList=lessons.length?lessons.map(x=>`<button type="button" class="btn ${String(x.lessonNo)===String(ui.teachLesson)?'on':''}" data-act="selectLesson" data-no="${A(x.lessonNo)}"><b>第${E(x.lessonNo)}课</b> ${E(x.title||'未命名')} <small>${E(x.status||'未开始')}${x.sample?' · 样例待核':''}</small></button>`).join(''):'<p class="muted">还没有课次，使用下方按钮添加。</p>';return heading('教学进度','按班级记录计划、上课和备课。',btn('创建听写','navigate','primary','data-view="dictation"')+btn('新增作业','newAssignment'))+`${c.bookId?'':notice('当前未绑定已校对教材；三年级上册词库仅为样例。课次标题与词语请以实际教材核对。',true)}${weekOverview()}<div class="grid cols2"><section class="card"><div class="row space"><h2>课次安排</h2>${btn('新增课次','newLesson','sm')}</div><div class="lessonlist stack">${lessonList}</div></section><section class="card papertexture"><h2>第${E(ui.teachLesson||'新')}课 · 进度</h2><form data-form="progress" class="stack"><div class="fieldrow">${field('lessonNo','课次编号',ui.teachLesson,'text','required')}${field('title','课次标题',p?.title||chosen?.title||'','text','required')}</div><div class="fieldrow">${field('planDate','计划日期(精确到分)',(p?.planDate||'').slice(0,16),'datetime-local')}${field('actualDate','实际日期(精确到分)',(p?.actualDate||'').slice(0,16),'datetime-local')}</div><label class="field">状态<select name="status"><option ${!p||p.status==='未开始'?'selected':''}>未开始</option><option ${p?.status==='已上课'?'selected':''}>已上课</option><option ${p?.status==='已讲评'?'selected':''}>已讲评</option></select></label>${area('note','进度备注',p?.note||'',2)}<div class="row"><button class="btn primary" type="submit">保存进度</button>${btn('新建听写','navigate','','data-view="dictation"')}${btn('新建作业记录','newAssignment')}</div></form></section></div><section class="card papertexture mt"><h2>第${E(ui.teachLesson||'新')}课 · 备课记录</h2><form data-form="prep" class="stack"><div class="fieldrow">${area('goals','教学目标',prep?.goals||'')}${area('focus','重难点',prep?.focus||'')}</div><div class="fieldrow">${area('activities','活动顺序',prep?.activities||'',4)}${area('materials','板书与材料备注',prep?.materials||'',4)}</div>${area('reflection','课后反思',prep?.reflection||'',2)}<div class="row"><button class="btn primary" type="submit">保存备课</button>${btn('打印备课摘要','printPrep')+btn('AI 备课结构草稿','aiPrep')}</div></form></section><section class="card mt"><h2>手动待办</h2><form data-form="manualTask" class="row">${field('title','待办事项','','text','required')}${field('dueDate','日期',today(),'date')}<button class="btn" type="submit">添加</button></form><div class="stack mt">${renderManualTasks()}</div></section>`}

function ensureDraftWords(){if(ui.dictWords.length)return;const c=currentClass();if(c?.grade===3&&c.term==='上册'&&!c.bookId){const lesson=bankLessons().find(l=>String(l.no)===String(ui.teachLesson));ui.dictWords=(lesson?.words||[]).map(x=>({w:x.w,p:x.p||'',on:true}));const picks=state.legacyPicks[String(ui.teachLesson)];if(Array.isArray(picks))ui.dictWords.forEach(x=>x.on=picks.includes(x.w))}}
function renderDictation(){if(!currentClass())return noClass();ensureDraftWords();const selected=ui.dictWords.filter(x=>x.on);const list=ui.dictWords.map((x,i)=>`<div class="wordrow"><label><input type="checkbox" data-act="wordToggle" data-index="${i}" ${x.on?'checked':''} aria-label="选中${A(x.w)}"></label><span><b>${E(x.w)}</b> <small>${E(x.p)}</small></span>${btn('↑','wordUp','sm',`data-index="${i}" aria-label="${A(x.w)}上移"`)}${btn('↓','wordDown','sm',`data-index="${i}" aria-label="${A(x.w)}下移"`)}</div>`).join('');return heading('创建听写','选词、调整顺序并保存任务；词库样例请先与教材核对。',btn('返回教学','navigate','','data-view="teaching"'))+`<div class="grid cols2"><section class="card"><div class="row space"><h2>第${E(ui.teachLesson)}课 · 词语</h2><div class="row">${btn('全选','wordAll','sm')}${btn('清空','wordNone','sm')}</div></div>${notice('本机内置词库仅为待核样例；未核对前请教师自行确认每个词与拼音。',true)}<div class="stack">${list||'<p class="muted">本课没有词语。请在下方添加。</p>'}</div><form data-form="addWord" class="row mt">${field('word','添加词语','','text','required')}${field('pinyin','拼音（可空）')}<button class="btn" type="submit">添加</button></form></section><section class="stack"><div class="card"><h2>听写任务</h2><form data-form="dictTask" class="stack">${field('title','任务名称',ui.dictForm?.title||`第${ui.teachLesson}课词语听写`,'text','required')}<div class="fieldrow">${field('date','日期',ui.dictForm?.date||today(),'date')}${field('participants','参与人数',ui.dictForm?.participants??(inClass(state.students).length||0),'number','min="0"')}</div><div class="fieldrow three">${field('rate','语速（0.4–1.2）',ui.dictForm?.rate||'0.7','number','min="0.4" max="1.2" step="0.1"')}${field('times','每词遍数',ui.dictForm?.times||'2','number','min="1" max="3"')}${field('gap','间隔秒数',ui.dictForm?.gap||'8','number','min="3" max="30"')}</div><p class="small muted">已选 ${selected.length} 词；空选不能开始。系统无中文语音时可手动报词。</p><div class="row"><button type="submit" class="btn primary">保存任务</button>${btn('打印学生纸','printDictStudent')}${btn('打印教师答案','printDictAnswer')+btn('打开本次批改','goCurrentMark')}</div></form></div><div class="card dictstage"><div class="counter" id="dCounter">${ui.dictIndex>=0?`${ui.dictIndex+1} / ${selected.length}`:`0 / ${selected.length}`}</div><div class="bar"><i style="width:${selected.length&&ui.dictIndex>=0?(ui.dictIndex+1)/selected.length*100:0}%"></i></div><div class="word" id="dWord">${ui.dictIndex<0?'准备开始':ui.dictReveal?E(selected[ui.dictIndex]?.w||''):`第 ${ui.dictIndex+1} 个`}</div><p class="muted" id="dHint">${ui.dictRunning?'正在按设置自动推进':'可开始报词，也可手动上一词/下一词'}</p><div class="row" style="justify-content:center">${btn('上一词','dictPrev','sm')}${btn(ui.dictRunning?'暂停':'开始 / 继续','dictMain','primary')}${btn('显示词语','dictReveal','sm')}${btn('下一词','dictNext','sm')}</div></div></section></div>`}
function selectedDictWords(){return ui.dictWords.filter(x=>x.on).map(x=>({w:x.w,p:x.p}))}
function dictDisplay(){const words=selectedDictWords();const word=document.querySelector('#dWord'),count=document.querySelector('#dCounter'),bar=document.querySelector('.dictstage .bar i'),hint=document.querySelector('#dHint');if(!word)return;word.textContent=ui.dictIndex<0?'准备开始':ui.dictReveal?words[ui.dictIndex]?.w||'':`第 ${ui.dictIndex+1} 个`;count.textContent=`${Math.max(0,ui.dictIndex+1)} / ${words.length}`;bar.style.width=words.length&&ui.dictIndex>=0?`${(ui.dictIndex+1)/words.length*100}%`:'0%';hint.textContent=ui.dictRunning?'正在按设置自动推进':'可开始报词，也可手动上一词/下一词';const main=document.querySelector('[data-act="dictMain"]');if(main)main.textContent=ui.dictRunning?'暂停':'开始 / 继续'}
function dictSettings(){const f=document.querySelector('form[data-form="dictTask"]');return {rate:clamp(f?.elements.rate.value||.7,.4,1.2),times:clamp(f?.elements.times.value||2,1,3),gap:clamp(f?.elements.gap.value||8,3,30)}}
function dictSpeakCurrent(){const words=selectedDictWords(),item=words[ui.dictIndex],token=++ui.dictToken;if(!item||!ui.dictRunning)return;if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){toast('未检测到系统语音，请用手动报词模式');stopDict();dictDisplay();return}const voice=speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));if(!voice){toast('未找到中文语音，请用手动报词模式');stopDict();dictDisplay();return}const opt=dictSettings();let remaining=opt.times;const speakOnce=()=>{if(!ui.dictRunning||token!==ui.dictToken)return;if(remaining--<=0){ui.dictTimer=setTimeout(()=>{if(ui.dictRunning&&token===ui.dictToken)dictAdvance(true)},opt.gap*1000);return}const utterance=new SpeechSynthesisUtterance(item.w);utterance.lang='zh-CN';utterance.voice=voice;utterance.rate=opt.rate;utterance.onend=()=>{if(token===ui.dictToken)ui.dictTimer=setTimeout(speakOnce,260)};utterance.onerror=()=>{if(token===ui.dictToken){stopDict();toast('语音播放失败，可手动下一词');dictDisplay()}};speechSynthesis.speak(utterance)};speechSynthesis.cancel();speakOnce()}
function dictAdvance(auto=false){const words=selectedDictWords();if(!words.length)return;if(ui.dictIndex>=words.length-1){stopDict();toast('听写结束，请登记批改');dictDisplay();return}clearTimeout(ui.dictTimer);ui.dictIndex++;ui.dictReveal=false;if(ui.dictRunning)dictSpeakCurrent();dictDisplay()}
function dictMove(delta){const words=selectedDictWords();if(!words.length)return;clearTimeout(ui.dictTimer);ui.dictToken++;if('speechSynthesis'in window)speechSynthesis.cancel();ui.dictIndex=clamp(ui.dictIndex+delta,0,words.length-1);ui.dictReveal=false;if(ui.dictRunning)dictSpeakCurrent();dictDisplay()}

function renderMarking(){if(!currentClass())return noClass();const tabs=[['dictation','听写批改'],['assignment','作业批改'],['followups','讲评与复查']].map(([key,label])=>`<button data-act="markTab" data-tab="${key}" class="${ui.markTab===key?'on':''}" type="button">${label}</button>`).join('');let content=ui.markTab==='dictation'?renderDictMarking():ui.markTab==='assignment'?renderAssignmentMarking():renderFollowups();return heading('批改','共性错例、个别跟进与下次复查连在同一任务下。',btn('期末评语','comments','accent')+btn('新增作业','newAssignment','primary'))+`<div class="tabs">${tabs}</div>${content}`}
function renderDictMarking(){const list=inBook(state.dictations).sort((a,b)=>String(b.date).localeCompare(String(a.date)));const rec=list.find(x=>x.id===ui.markId)||list[0];if(rec)ui.markId=rec.id;const side=list.map(x=>`<button type="button" class="btn ${x.id===rec?.id?'active':''}" data-act="selectMark" data-id="${A(x.id)}" data-tab="dictation"><b>${E(x.title)}</b><br><small>${dateText(x.date)} · 已批 ${x.markedCount||0}/${x.participantCount||0}</small></button>`).join('');if(!rec)return `<div class="card empty"><h2>尚无听写任务</h2><p>先从教学页创建并保存一项听写。</p>${btn('去创建听写','navigate','primary','data-view="dictation"')}</div>`;const rows=rec.words.map((x,i)=>`<tr><td><span class="tzw-row">${tzWord(x.w,x.p)}</span></td><td><input type="number" name="err_${i}" min="0" max="${rec.participantCount||999}" value="${Number(rec.wordErrors?.[x.w]||0)}" aria-label="${A(x.w)}错人数" style="width:90px"></td></tr>`).join('');const studentRows=inClass(state.students).sort((a,b)=>String(a.no).localeCompare(String(b.no),'zh-CN')).map(s=>`<tr><td>${E(s.no)} ${E(s.name)}</td><td><select name="stu_status_${A(s.id)}"><option value="未录" ${rec.studentMarks?.[s.id]?.status==='未录'?'selected':''}>未录</option><option value="已批" ${rec.studentMarks?.[s.id]?.status==='已批'?'selected':''}>已批</option><option value="未交" ${rec.studentMarks?.[s.id]?.status==='未交'?'selected':''}>未交</option><option value="待复查" ${rec.studentMarks?.[s.id]?.status==='待复查'?'selected':''}>待复查</option></select></td><td><input type="text" name="stu_words_${A(s.id)}" value="${A((rec.studentMarks?.[s.id]?.wrongWords||[]).join('、'))}" placeholder="错词用顿号分隔" aria-label="${A(s.name)}错词"></td></tr>`).join('');return `<div class="grid cols2"><section class="card"><h2>听写任务</h2><div class="stack">${side}</div>${btn('重新报词 / 打印答案','reopenDict','sm mt',`data-id="${A(rec.id)}"`)}</section><section class="card papertexture"><h2>${E(rec.title)}</h2><p class="muted">第${E(rec.lessonNo)}课 · ${dateText(rec.date)} · ${rec.words.length}词</p><div class="steps"><span class="st done">${icon('M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z')}<span>第${E(rec.lessonNo)}课</span></span><i class="ln"></i><span class="st done">${icon('M4 5h16v11H9l-5 5V5z')}<span>听写任务</span></span><i class="ln"></i><span class="st cur">${icon('M4 20h16M5 16l2-10 10-2 3 3-2 10-10 2z')}<span>批改记录</span></span><i class="ln"></i><span class="st">${icon('M5 13l4 4L19 7')}<span>复查</span></span></div><form data-form="dictMark" data-id="${A(rec.id)}" class="stack"><div class="fieldrow">${field('participants','参与人数',rec.participantCount||0,'number','min="0"')}${field('marked','已批份数',rec.markedCount||0,'number','min="0"')}</div>${area('summary','全班情况',rec.summary||'',2)}<h3>共性错词频次</h3><div class="tablewrap"><table><thead><tr><th>词语</th><th>错人数</th></tr></thead><tbody>${rows}</tbody></table></div><details><summary>按学生登记（可选，${inClass(state.students).length}人）</summary>${btn('按逐生结果汇总','summarizeMarks','sm mt')}<p class="small muted">只录全班错频也可完成批改。逐生登记后可点击汇总，核对后再保存。</p><div class="tablewrap" style="max-height:360px"><table><thead><tr><th>学生</th><th>状态</th><th>错词</th></tr></thead><tbody>${studentRows||'<tr><td colspan="3">请先导入名册</td></tr>'}</tbody></table></div></details><div class="ai-card inset"><b>✦ AI 错词分析</b> <span class="small muted">(已脱敏)</span>
  <div id="aiMarkOut" class="small" style="margin-top:8px">${state.aiCache&&state.aiCache['mark:'+rec.id]?E(state.aiCache['mark:'+rec.id]):'分析该班共性错词规律,给出讲评重点与复练建议。'}</div>
  <div class="row mt">${btn(state.aiCache&&state.aiCache['mark:'+rec.id]?'重新分析':'✦ 分析','aiMark','sky sm',`data-id="${A(rec.id)}"`)}${state.aiCache&&state.aiCache['mark:'+rec.id]?btn('采纳为讲评措施','aiMarkKeep','grass sm',`data-id="${A(rec.id)}"`):''}</div></div>
${area('measures','讲评措施',rec.measures||'',2)}${templateButtons(MEASURE_TEMPLATES,'measures')}<div class="row"><button class="btn primary" type="submit">保存批改</button>${btn('建立复查','newFollowup','','data-source-type="dictation" data-source-id="'+A(rec.id)+'"')}${btn('打印复练单','printPractice','','data-id="'+A(rec.id)+'"')}</div></form></section></div>`}
function renderAssignmentMarking(){if(ui.newAssignment)return `<section class="card papertexture"><h2>新建作业</h2><form data-form="assignmentNew" class="stack"><div class="fieldrow">${field('date','作业日期',today(),'date','required')}${field('lessonNo','涉及课次',ui.teachLesson||'')}</div>${field('content','作业内容','','text','required')}${field('participants','参与人数',inClass(state.students).length,'number','min="0"')}<div class="row"><button class="btn primary" type="submit">建立作业记录</button>${btn('取消','cancelAssignment')}</div></form></section>`;const list=inBook(state.assignments).sort((a,b)=>String(b.date).localeCompare(String(a.date)));const rec=list.find(x=>x.id===ui.markId)||list[0];if(rec)ui.markId=rec.id;const side=list.map(x=>`<button type="button" class="btn ${x.id===rec?.id?'active':''}" data-act="selectMark" data-id="${A(x.id)}" data-tab="assignment"><b>${E(x.content)}</b><br><small>${dateText(x.date)} · 已批 ${x.markedCount||0}/${x.participantCount||0}</small></button>`).join('');if(!rec)return `<div class="card empty"><h2>尚无作业记录</h2><p>登记纸面作业；教师线下批改后录入结果，不会自动发给学生。</p>${btn('新增作业','newAssignment','primary')}</div>`;const issues=(rec.issues||[]).map(x=>`${x.tag}|${x.text}`).join('\n');return `<div class="grid cols2"><section class="card"><h2>作业记录</h2><div class="stack">${side}</div>${btn('新增作业','newAssignment','sm mt')}</section><section class="card papertexture"><h2>批改记录</h2><form data-form="assignment" data-id="${A(rec.id)}" class="stack"><div class="fieldrow">${field('date','作业日期',rec.date||today(),'date','required')}${field('lessonNo','涉及课次',rec.lessonNo||'')}</div>${field('content','作业内容',rec.content||'','text','required')}<div class="fieldrow">${field('participants','参与人数',rec.participantCount||0,'number','min="0"')}${field('marked','已批份数',rec.markedCount||0,'number','min="0"')}</div>${area('summary','全班情况',rec.summary||'',2)}${area('issues','典型错例（每行 标签|错例；标签可用字词/句子/阅读/习作）',issues,4)}${templateButtons(ISSUE_TEMPLATES,'issues')}${area('measures','处理措施',rec.measures||'',3)}${templateButtons(MEASURE_TEMPLATES,'measures')}<div class="row"><button class="btn primary" type="submit">保存记录</button>${btn('建立讲评/复查','newFollowup','','data-source-type="assignment" data-source-id="'+A(rec.id)+'"')}${btn('打印批改记录','printAssignment','','data-id="'+A(rec.id)+'"')}</div></form></section></div>`}
function followupPicker(roster,selectedIds=[]){if(!roster.length)return '<p class="small muted">当前班级名册为空；请先添加学生，或留空代表全班。</p>';const selected=new Set(selectedIds);return `<details class="roster-picker"><summary>从本班名册勾选学生 · ${roster.length} 人</summary><div class="row"><span class="small muted" data-selected-count aria-live="polite">已选 ${roster.filter(x=>selected.has(x.id)).length} 人（不选为全班）</span>${btn('全选','followupPickAll','sm')}${btn('清空','followupPickNone','sm')}</div><div class="roster-grid">${roster.map(s=>`<label class="roster-choice"><input type="checkbox" name="studentPick_${A(s.id)}" value="on" ${selected.has(s.id)?'checked':''}><span>${E(s.no)} · ${E(s.name)}</span></label>`).join('')}</div></details>`}
function followupStudentIds(form,previousIds=[]){const students=inClass(state.students),data=new FormData(form),ids=students.filter(x=>data.get('studentPick_'+x.id)!=null).map(x=>x.id),nos=formVal(form,'studentNos').split(/[、,，\s]+/).filter(Boolean);for(const no of nos){const student=students.find(x=>x.no===no);if(!student)throw Error(`学号 ${no} 不在本班`);if(!ids.includes(student.id))ids.push(student.id)}if(data.get('keepUnknown')!=null)for(const id of previousIds)if(!state.students.some(x=>x.id===id)&&!ids.includes(id))ids.push(id);return ids}

function renderFollowups(){
 const list=inBook(state.followups).sort((a,b)=>String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
 const src=ui.newFollowup?.sourceId?sourceTitle(ui.newFollowup.sourceType,ui.newFollowup.sourceId):'';
 const roster=inClass(state.students).sort((a,b)=>String(a.no).localeCompare(String(b.no),'zh-CN'));
 const picker=followupPicker(roster);
 const create=ui.newFollowup?`<div class="inset mt"><h3>新建讲评或复查</h3><form data-form="followupNew" class="stack"><label class="field">事项类型<select name="kind"><option>复查</option><option>讲评</option></select></label>${field('title','事项标题',src?src+' · 复查':'','text','required')}${field('dueDate','计划日期',today(),'date')}${field('studentNos','补充学号（顿号或逗号分隔，可留空）')}${picker}<p class="small muted">勾选名册或补充学号；两者合并。都不选则面向全班。来源：${E(src||'独立事项')}</p><div class="row"><button type="submit" class="btn primary">保存事项</button>${btn('取消','cancelFollowup')}</div></form></div>`:'';
 const rows=list.length?list.map(x=>{const missing=(x.studentIds||[]).filter(id=>!roster.some(s=>s.id===id));const edit=ui.editingFollowupId===x.id?`<form data-form="followupResult" data-id="${A(x.id)}" class="stack inset mt"><label class="field">事项类型<select name="kind"><option ${x.kind==='复查'?'selected':''}>复查</option><option ${x.kind==='讲评'?'selected':''}>讲评</option></select></label>${field('title','事项标题',x.title,'text','required')}${field('dueDate','计划日期',x.dueDate||'','date')}${field('studentNos','补充学号（可留空）')}${followupPicker(roster,x.studentIds||[])}${missing.length?`<label class="row small"><input type="checkbox" name="keepUnknown" value="on" checked> 保留 ${missing.length} 个已不在名册的历史学生关联</label>`:''}${area('result','处理结果',x.result||'',2)}<div class="row"><button type="submit" class="btn primary">保存事项</button>${btn('取消','cancelFollowup')}</div></form>`:'';return `<div class="item row space followup-entry"><div><div class="item-title">${E(x.title)} <span class="status ${x.status==='完成'?'blue':'magenta'}">${E(x.status)}</span></div><small>计划 ${dateText(x.dueDate)} · 来源：${E(x.sourceType?sourceTitle(x.sourceType,x.sourceId):'手动')} ${x.studentIds?.length?`· ${x.studentIds.length}名学生`:'· 全班'}</small>${x.result?`<div>${nl(x.result)}</div>`:''}${edit}</div><div class="row">${btn('编辑事项与结果','followupResult','sm',`data-id="${A(x.id)}"`)}${btn(x.status==='完成'?'重新打开':'标记完成','toggleFollowup','sm',`data-id="${A(x.id)}"`)}</div></div>`}).join(''):'<div class="empty"><h2>暂无讲评或复查</h2><p>从作业或听写批改中建立，首页会按日期显示待办。</p></div>';
 return `<section class="card"><div class="row space"><h2>讲评与复查</h2>${btn('新增独立复查','newFollowup','sm')}</div>${create}${rows}</section>`;
}

function renderResources(){
  const c=currentClass(),active=activeBook(),all=bookCatalog();
  const books=all.filter(x=>ui.bookGrade==='all'||ui.bookGrade==='current'&&!c||Number(x.grade)===Number(ui.bookGrade==='current'?c.grade:ui.bookGrade));
  const tabs=[['textbooks','教材 PDF'],['library','打印资料']].map(([key,label])=>`<button type="button" aria-pressed="${ui.resourceTab===key}" data-act="resourceTab" data-tab="${key}" class="${ui.resourceTab===key?'on':''}">${label}</button>`).join('');
  const context=c?`<div class="resource-context"><div><span class="eyebrow">当前班级教材</span><strong>${E(c.name)} · ${E(c.grade)}年级${E(c.term)}</strong><p>${active?E(active.title)+' · '+E(active.publisher):'尚未绑定教材；可在下方目录选择同年级、同册别的版本。'}</p></div><div class="row">${active?.file?btn('阅读当前教材','openPdf','primary',`data-id="${A(active.bookId)}"`):''}${btn('班级教材设置','navigate','sm','data-view="classes"')}</div></div>`:'';
  return heading('资料与打印','按班级找教材、阅读 PDF，并制作课堂纸张。')+context+`<div class="tabs" role="group" aria-label="资料类型">${tabs}</div>`+(ui.resourceTab==='textbooks'?renderTextbooks(books):renderLibrary()+renderClassLegacyWords());
}
function renderClassLegacyWords(){
  const words=inClass(state.legacyWrong);
  if(!words.length)return '';
  return `<details class="card mt"><summary>旧版归班错词 · ${words.length} 条</summary><div class="picklist mt">${words.map(x=>`<span class="pick">${E(x.word)} <small>${E(x.pinyin)}</small></span>`).join('')}</div></details>`;
}
function renderLibrary(){
  if(!currentClass())return `<div class="card empty"><h2>先建立班级</h2><p>纸张上的班级信息和备课摘要需要当前班级。</p>${btn('建立班级','navigate','primary','data-view="classes"')}</div>`;
  const c=currentClass(),sample=c.grade===3&&c.term==='上册'&&!c.bookId;
  const lesson=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));
  const words=sample?lesson?.words||[]:[],chars=sample?lesson?.chars||[]:[];
  const quick=`<section class="card"><h2>表格与登记</h2>
  <div class="row">${btn('收作业登记表','printHW','grass sm')}${btn('背诵默写跟踪表','printReciteTrack','grass sm')}${btn('座位表(可编辑)','printSeats','sky sm')}${btn('卫生值日表','printDuty','sky sm')}${btn('班级积分榜','openPoints','primary sm')}</div>
  <p class="small muted">表格基于本班名册自动生成;座位表可点名字换位。</p>
  <h2>字帖与个性化</h2>
  <div class="row">${btn('描红字帖(本课)','printCopybook','grass sm')}${btn('按学生错词生成练习','printPersonalized','primary sm')}</div>
  <p class="small muted">个性化练习:按每个学生的听写错词自动生成"一人一卷"看拼音写词语（不需 AI；仅使用本班当前教材已批改的学生错词，缺拼音会提示补全）。</p>
  <h2>常用纸张</h2><p class="muted">空白听写纸可直接打印；备课摘要读取本班当前课次已保存的记录。</p><div class="row mt">${btn('打印空听写纸','printBlankDict','primary')}${btn('打印当前课备课摘要','printPrep')}${btn('到批改记录打印复练单','navigate','sm','data-view="marking"')}</div></section>`;
  if(!sample)return quick+`<section class="card mt"><h2>本册词库尚未逐课校对</h2><p class="muted">教材 PDF 可阅读课文；听写词单请在教学页手动录入。</p>${btn('创建听写','navigate','sm','data-view="dictation"')}</section>`;
  return quick+`<section class="card mt"><h2>三年级上册词库样例 · 第${E(ui.teachLesson)}课</h2>${notice('这是待核样例，打印或朗读前请与实际教材核对。',true)}<p class="muted">${E(lesson?.title||'未命名')}</p><h3 class="mt">生字</h3><div class="picklist">${chars.map(x=>`<span class="pick">${E(x.c)} <small>${E(x.p)}</small></span>`).join('')||'<p class="muted">暂无生字。</p>'}</div><h3 class="mt">词语</h3><div class="picklist">${words.map(x=>`<span class="pick">${E(x.w)} <small>${E(x.p)}</small></span>`).join('')||'<p class="muted">暂无词语。</p>'}</div><div class="row mt">${btn('朗读词语','speakWords')}${btn('打印生字表','printChars')}${btn('打印看拼音写词语','printPinyin')}</div><details class="mt"><summary>编辑个人样例词库</summary><form data-form="bankEdit" class="stack mt">${field('title','课次标题',lesson?.title||'')}${area('chars','写字表（每行 汉字|拼音）',chars.map(x=>`${x.c}|${x.p}`).join('\n'),4)}${area('words','词语表（每行 词语|拼音）',words.map(x=>`${x.w}|${x.p}`).join('\n'),6)}<p class="small muted">保存仅修改本机样例，不代表教材内容已核对。</p><button class="btn primary" type="submit">保存本课修改</button></form></details></section>`;
}
function renderTextbooks(input){
  const c=currentClass(),all=bookCatalog(),publishers=[...new Set(all.map(x=>x.publisher))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const options='<option value="current" '+(ui.bookGrade==='current'?'selected':'')+'>'+(c?'当前班级年级 · '+c.grade+'年级':'全部年级')+'</option><option value="all" '+(ui.bookGrade==='all'?'selected':'')+'>全部年级</option>'+[1,2,3,4,5,6].map(g=>`<option value="${g}" ${String(ui.bookGrade)===String(g)?'selected':''}>${g}年级</option>`).join('');
  const termOptions=[['all','上下册'],['上册','上册'],['下册','下册']].map(([v,label])=>`<option value="${v}" ${ui.bookTerm===v?'selected':''}>${label}</option>`).join('');
  const pubOptions='<option value="all">全部出版社</option>'+publishers.map(x=>`<option value="${A(x)}" ${ui.bookPublisher===x?'selected':''}>${E(x)}</option>`).join('');
  const books=input.filter(x=>(ui.bookTerm==='all'||x.term===ui.bookTerm)&&(ui.bookPublisher==='all'||x.publisher===ui.bookPublisher)).sort((a,b)=>Number(c?.bookId===b.bookId)-Number(c?.bookId===a.bookId)||Number(a.grade)-Number(b.grade)||a.term.localeCompare(b.term,'zh-CN'));
  const rows=books.map(b=>{
    const active=c?.bookId===b.bookId,eligible=c&&Number(c.grade)===Number(b.grade)&&c.term===b.term,bundled=!!b.file,lessons=Array.isArray(b.lessons)?b.lessons:[];
    const lessonList=lessons.length?`<details class="mt"><summary>已核课次目录 · ${lessons.length} 课</summary><div class="stack mt">${lessons.map(x=>`<div class="item row space"><span>第${E(x.lessonNo)}课 ${E(x.title)} <small>PDF 第 ${E(x.pageStart)}–${E(x.pageEnd)} 页 · ${E(x.verifiedBy)} ${E(x.verifiedAt)}</small></span>${btn('打开此页','openPdf','sm',`data-id="${A(b.bookId)}" data-page="${A(x.pageStart)}"`)}</div>`).join('')}</div></details>`:'<p class="small muted">课次与页码待人工校对，暂不能按课跳转。</p>';
    return `<article class="textbook-row${active?' current':''}"><div class="textbook-main"><div><div class="item-title">${E(b.title)} ${active?'<span class="pill">本班已绑定</span>':''}</div><p class="small muted">${E(b.publisher)} · ${E(b.grade)}年级${E(b.term)} · ${b.contentVerified?'内容已核':'版权页和内容待核'}${b.editionYear?' · 登记年份 '+E(b.editionYear):''}</p></div><div class="row">${eligible&&!active?btn('绑定到本班','bindBook','sm',`data-id="${A(b.bookId)}"`):''}${bundled?btn('阅读 PDF','openPdf',active?'primary sm':'sm',`data-id="${A(b.bookId)}"`):btn('临时预览 PDF','tempPdf','sm',`data-id="${A(b.bookId)}"`)}</div></div><div class="textbook-foot"><b>${bundled?'PDF 已在本机':'PDF 尚未入包'}</b><span>${bundled?'可离线阅读':'临时预览只在本次会话有效'}</span></div>${bundled?lessonList:''}</article>`;
  }).join('');
  const packed=window.TEXTBOOKS||[],packedPublishers=[...new Set(packed.map(x=>x.publisher))];
  return `<section class="card"><div class="row space"><div><h2>教材目录</h2><p class="muted">本机已入包 ${packed.length} 册 PDF，出版社：${E(packedPublishers.join('、')||'暂无')}。课次和内容仍须人工校对。</p></div><span class="small muted">显示 ${books.length} / ${all.length} 册</span></div><div class="book-filters"><label class="field">年级<select id="bookGrade">${options}</select></label><label class="field">册别<select id="bookTerm">${termOptions}</select></label><label class="field">出版社<select id="bookPublisher">${pubOptions}</select></label></div><div class="textbook-list">${rows||'<div class="empty"><h2>没有符合筛选的教材</h2><p>调整筛选条件后再试。</p></div>'}</div></section><details class="card mt"><summary>登记其他出版社或版本</summary><p class="small muted mt">登记只建立目录，不代表 PDF 已入包或课文已经校对。</p><form data-form="book" class="stack mt">${field('publisher','出版社 / 教材系列','','text','required')}<div class="fieldrow">${field('grade','年级',c?.grade||3,'number','min="1" max="6" required')}<label class="field">册别<select name="term"><option ${c?.term==='上册'?'selected':''}>上册</option><option ${c?.term==='下册'?'selected':''}>下册</option></select></label></div>${field('editionYear','版本年份 / 修订版','','text','required')}${field('title','教材名称','','text','required')}<button class="btn primary" type="submit">登记教材</button></form></details><input id="tempPdfFile" type="file" accept="application/pdf,.pdf" hidden>`;
}
function renderPdfReader(){
  if(!ui.pdfTemporary&&ui.pdfBookId)return renderPdfAnnotator();
  const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId),temporary=true;
  const title=temporary?ui.pdfFileName||'临时 PDF 预览':b?.title||'教材 PDF';
  const meta=temporary?'本次会话临时预览 · 关闭页面后需重新选文件':b?b.publisher+' · '+b.grade+'年级'+b.term:'';
  const external='';
  return `<div class="pdf-reader"><div class="pdf-bar"><button class="btn sm" data-act="closePdf">‹ 返回教材目录</button><div class="pdf-ident"><b>${E(title)}</b><small>${E(meta)}</small></div><span class="right">${external}</span></div><iframe class="pdf-frame" title="${A(title)} PDF 阅读器" src="${A(ui.pdfUrl||'')}"></iframe></div>`;
}
/* ================= F33 首页小组件:跑马灯 + 时钟 ================= */
function widgetMarquee(){const cfg=(state.widgets&&state.widgets.marquee)||{};if(cfg.off)return '';const items=(cfg.texts&&cfg.texts.length?cfg.texts:['今天也要元气满满,孩子们加油!']);const text=items.join('　✦　');return `<div class="marquee${cfg.style==='plain'?' plain':''}"><span class="mq-ic">📣</span><div class="mq-track"><span>${E(text)}</span></div></div>`}
function widgetClock(){const config=state.widgets?.clock||{};if(config.off)return '';return `<section class="clockw"><div class="ck-time">${E(nowStr().slice(-8))}</div><p>${E(today())}</p><div class="ck-cd">课堂计时 <b data-countdown></b></div><div class="row mt">${btn('开始','clockStart','sm')}${btn('暂停','clockPause','sm')}${btn('重置','clockReset','sm')}</div></section>`}
/* Classroom and PDF helpers */
function rollPool(){return inClass(state.students).slice()}
function annKey(){return (ui.pdfBookId||'tmp')+'|'+ui.annLayer+'|p'+ui.annPage}
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
      ${[['red','#AF1D88'],['blue','#3157D4'],['green','#1C2745']].map(([k,c])=>`<button class="ann-pen ${ui.annTool===k?'on':''}" data-act="annTool" data-tool="${k}" style="--pc:${c}" title="${k}"></button>`).join('')}
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
      <div class="card ai-card"><h2>✦ AI 划线分析</h2><div id="annAIOut" class="small">${state.aiCache&&state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]?E(state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]):'<span class="muted">在本页划出教学重点,然后让 AI 归纳:重点是什么、怎么提问、板书写什么。</span>'}</div>
        <div class="row mt">${btn('✦ 分析本页划线','annAnalyze','sky sm')}${btn('整课分析','annLesson','sm')}${btn('校对课次页码','editBookLesson','sm')}</div>
        <p class="small muted" style="margin-top:8px">发送内容:对应原文（发送前可核对）(教材为公开出版物,不含学生数据)。</p>
      </div>
      <div class="card"><h2>本课词单</h2><div class="picklist">${(()=>{const l={words:currentClass()?.bookId===ui.pdfBookId?scopedWords():[]};return l.words.length?l.words.slice(0,12).map(x=>`<span class="pick">${E(x.w)}</span>`).join(''):'<span class="muted small">未绑定课次词库</span>'})()}</div></div>
      <div class="card"><h2>图层说明</h2><p class="small muted">「备课」「上课」两套图层互不覆盖;标注随工作台数据本地保存,可随备份导出。</p></div>
    </div>
  </div></div>`}
async function annLoadPage(){
  const canvas=document.getElementById('annCanvas');if(!canvas)return;const sequence=++pdfRuntime.sequence;
  try{const doc=await pdfDocument();if(sequence!==pdfRuntime.sequence||!canvas.isConnected)return;ui.annPages=doc.numPages;ui.annPage=Math.max(1,Math.min(ui.annPage,doc.numPages));
    const page=await doc.getPage(ui.annPage),viewport=page.getViewport({scale:ui.annScale}),dpr=window.devicePixelRatio||1;if(sequence!==pdfRuntime.sequence||!canvas.isConnected)return;
    canvas.width=viewport.width*dpr;canvas.height=viewport.height*dpr;canvas.style.width='100%';canvas.__viewport={w:viewport.width,h:viewport.height};canvas.__dpr=dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);await page.render({canvasContext:ctx,viewport}).promise;if(sequence!==pdfRuntime.sequence||!canvas.isConnected)return;
    const ink=canvas.parentElement.querySelector('.ink');if(ink){ink.width=canvas.width;ink.height=canvas.height}const input=document.getElementById('annPageNo');if(input){input.max=String(doc.numPages);input.value=String(ui.annPage)}annRedraw();
  }catch(error){if(canvas.isConnected){const message=document.createElement('p');message.textContent='PDF 渲染失败：'+error.message;canvas.replaceWith(message)}}
}
function annRedraw(){
  const canvas=document.getElementById('annCanvas');if(!canvas)return;
  const layer=canvas.parentElement.querySelector('.ink');if(!layer)return;
  const ctx=layer.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,layer.width,layer.height);const dpr=canvas.__dpr||1;ctx.setTransform(dpr,0,0,dpr,0,0);
  const colors={red:'#AF1D88',blue:'#3157D4',green:'#1C2745'};
  for(const s of annPageStrokes()){
    ctx.strokeStyle=colors[s.color]||s.color;ctx.lineWidth=s.width||3;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=.85;
    ctx.beginPath();s.pts.forEach((p,i)=>{i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke();
  }
  if(ui.annLive&&ui.annLive.length){const c=colors[ui.annTool]||'#FF6B57';ctx.strokeStyle=c;ctx.lineWidth=ui.annWidth||3;ctx.lineCap='round';ctx.beginPath();ui.annLive.forEach((p,i)=>{i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke()}
}
function renderComments(){
  if(!currentClass())return noClass();const students=inClass(state.students).sort(studentOrder),done=students.filter(s=>reportFor(s.id)?.status==='reviewed').length;
  return heading('期末评语',reportTerm()+' · AI 草稿需逐条审定。',btn('返回批改','navigate','sm','data-view="marking"')+btn('生成草稿','genComments','primary')+btn('打印已审定评语','printComments'))+
  `<section class="card"><h2>已审定 ${done}/${students.length}</h2><div class="stack">${students.map(student=>{const rc=reportFor(student.id),editing=ui.editCommentId===student.id;return `<article class="item"><div class="row space"><b>${E(student.no)} · ${E(student.name)}</b><span class="status">${rc?.status==='reviewed'?'已审定':rc?.text?'草稿，待审定':'未填写'}</span>${btn('编辑与审定','editComment','sm',`data-id="${A(student.id)}"`)}</div>${editing?`<form data-form="commentDraft" data-id="${A(student.id)}" class="stack mt">${area('commentText','评语',rc?.text||'',4)}<div class="row">${btn('保存草稿','saveCommentDraft','',`data-id="${A(student.id)}"`)}${btn('确认审定','saveComment','primary',`data-id="${A(student.id)}"`)}</div></form>`:`<p class="mt">${E(rc?.text||'尚无评语')}</p>`}</article>`}).join('')||'<p>请先导入学生。</p>'}</div></section>`+renderReportArchive();
}
function newGradeObj(){const c=currentClass();return {id:uid(),classId:c.id,name:'成绩单 '+(inClass(state.grades).length+1),date:today(),scores:[]}}
function migrateScopedBuckets(){
  if(state&&state.points&&!state.pointsByClass){state.pointsLegacy=state.points;delete state.points}
  if(state&&Array.isArray(state.seats)&&state.seats.length){state.seatsLegacy=state.seats;delete state.seats}
}
function classBucket(key){const c=currentClass();if(!c)return null;state[key]=state[key]||{};return state[key][c.id]=state[key][c.id]||{}}
function classSeats(){const b=classBucket('seatsByClass');if(!b)return[];if(!Array.isArray(b.list)||!b.list.length)b.list=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);return b.list}
function classPoints(){const b=classBucket('pointsByClass');return b||{}}
function renderSeats(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const seats=classSeats();
  const cols=6;const grid=[];seats.forEach((id,i)=>{const r=Math.floor(i/cols);(grid[r]=grid[r]||[]).push(id)});
  return heading('座位表','点两个座位交换;打印自动排版。',btn('🖨 打印座位表','doPrintSeats','primary sm')+btn('重置为名册序','resetSeats','ghost sm'))+
  '<div class="card"><div class="seat-grid">'+grid.map(row=>row.map(id=>{const s=st.find(x=>x.id===id);if(!s)return '<div class="seat empty-seat">空</div>';
    return `<button class="seat ${ui.seatSwapA===id?'sel':''}" data-act="seatSwap" data-id="${A(s.id)}" data-no="${A(s.no)}">${E(s.no)}号<br><small>${E(s.name)}</small></button>`}).join('')).join('<div class="aisle"></div>')+'</div></div>';
}
function renderPoints(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const pts=classPoints();
  const ranked=st.slice().sort((a,b)=>(pts[b.id]||0)-(pts[a.id]||0));
  const legacyHint=(state.pointsLegacy&&Object.keys(state.pointsLegacy).length)?notice('检测到旧版积分 '+Object.keys(state.pointsLegacy).length+' 条(未区分班级,已停止使用;原始数据仍保留在备份导出的 pointsLegacy 字段)。',true):'';
  return heading('班级积分榜','课堂表现即时加减分,自动排序。')+legacyHint+(st.length?
  '<div class="card"><table><thead><tr><th>名次</th><th>学生</th><th>积分</th><th>操作</th></tr></thead><tbody>'+
  ranked.map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号 ${E(s.name)}</td><td><b style="color:var(--sky)">${pts[s.id]||0}</b></td><td><button class="btn grass sm" data-act="pointPlus" data-id="${A(s.id)}" data-no="${A(s.no)}">＋</button> <button class="btn ghost sm" data-act="pointMinus" data-no="${A(s.no)}">－</button></td></tr>`).join('')+
'</tbody></table></div>':'<p class="muted">先导入名册</p>')
}
function passLine(){const n=Number(state.settings?.passLine);return Number.isFinite(n)&&n>=0&&n<=100?n:60}
function gradeStats(scores){
  const nums=[],absentN=(scores||[]).filter(s=>s&&s.absent).length;
  (scores||[]).forEach(s=>{if(!s||s.absent)return;const v=String(s.score==null?'':s.score).trim();if(v==='')return;
    const n=Number(v);if(!isFinite(n)||n<0||n>100)return;nums.push(n)});
  if(!nums.length)return absentN?{avg:null,max:null,min:null,excRate:0,passRate:0,n:0,absentN}:null;
  const avg=nums.reduce((a,b)=>a+b,0)/nums.length;
  const sorted=[...nums].sort((a,b)=>a-b);
  const excellent=nums.filter(n=>n>=85).length, pass=nums.filter(n=>n>=passLine()).length;
  return {avg:Math.round(avg*10)/10, max:sorted[sorted.length-1], min:sorted[0],
          excRate:Math.round(excellent/nums.length*100), passRate:Math.round(pass/nums.length*100), n:nums.length, absentN};
}
function renderGrades(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort(studentOrder),gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(!ui.gradeDetail){
    return heading('成绩册','每次测评有记录，每个变化有依据。',btn('新建成绩单','newGrade','primary'))+
    `<section class="grade-overview"><div><span class="eyebrow">${E(currentClass().name)} · 本学期</span><h2>${gs.length} <span>份成绩单</span></h2><p>按测评日期排列，空白与缺考不计入均分。</p></div><details class="grade-rule"><summary>统计规则 · 及格线 ${passLine()} 分</summary><form data-form="passLine" class="row">${field('pass','及格分数线',passLine(),'number','min="0" max="100" required')}<button class="btn sm" type="submit">保存规则</button><small>优秀线为 85 分；及格线对所有班级生效。</small></form></details></section>`+
    (gs.length?'<div class="grade-list">'+gs.map(g=>{const scores=st.map(student=>(g.scores||[]).find(x=>x.studentId===student.id)||{}),stats=gradeStats(scores),n=stats?.n||0,absent=stats?.absentN||0,left=Math.max(0,st.length-n-absent),percent=st.length?Math.round((n+absent)/st.length*100):0;
      return `<article class="card grade-card"><div class="grade-card-title"><span class="grade-document" aria-hidden="true">${icon('M6 3h9l4 4v14H5V3zm8 0v5h5M8 12h8m-8 4h5')}</span><div><small>${E(g.date)}</small><h2>${E(g.name)}</h2></div><span class="status ${left?'':'blue'}">${!st.length?'尚无名册':left?'待录 '+left+' 人':'录入完成'}</span></div><div class="grade-card-stats"><div><small>平均分</small><strong>${stats?.avg??'—'}</strong></div><div><small>及格率</small><strong>${n?stats.passRate+'%':'—'}</strong></div><div><small>已录 / 全班</small><strong>${n}<span> / ${st.length}</span></strong></div></div><div class="grade-progress" role="progressbar" aria-label="成绩登记进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><div class="row space grade-card-footer"><small>${absent?'缺考 '+absent+' 人 · ':''}${left?'还需核对 '+left+' 人':'请核对后归档'}</small><div class="row">${btn('删除','delGrade','quiet sm',`data-id="${A(g.id)}" aria-label="删除成绩单 ${A(g.name)}"`)}${btn(left?'继续录入':'查看成绩','pickGrade','primary sm',`data-id="${A(g.id)}"`)}</div></div></article>`}).join('')+'</div>':`<section class="card empty"><div class="mark" aria-hidden="true"></div><h2>从一份成绩单开始</h2><p>创建测评后，按本班名册录入成绩并查看变化。</p><div class="mt">${btn('创建第一份成绩单','newGrade','primary')}</div></section>`);
  }
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];if(!cur){ui.gradeDetail=null;ui.gradeSel=null;return renderGrades()}ui.gradeSel=cur.id;
  const savedScores=Object.fromEntries((cur.scores||[]).map(x=>[x.studentId,x])),byStu={...savedScores,...ui.gradeDrafts?.[cur.id]},stats=gradeStats(st.map(s=>savedScores[s.id]||{}));
  const prev=gs.filter(x=>x.id!==cur.id&&x.date<=cur.date)[0],prevMap={};for(const row of prev?.scores||[])prevMap[row.studentId]=scoreValue(row);
  const n=stats?.n||0,absent=stats?.absentN||0;
  return heading(cur.name,`${currentClass().name} · ${cur.date}`,btn('返回成绩册','gradeBack','quiet')+btn('编辑信息','editGradeMeta','sm'))+
  `<div class="grade-metrics"><div><small>平均分</small><strong>${stats?.avg??'—'}</strong></div><div><small>最高 / 最低</small><strong>${n?stats.max+' / '+stats.min:'—'}</strong></div><div><small>优秀率 · ≥85</small><strong>${n?stats.excRate+'%':'—'}</strong></div><div><small>及格率 · ≥${passLine()}</small><strong>${n?stats.passRate+'%':'—'}</strong></div></div>
  <section class="card grade-editor"><div class="row space grade-editor-head"><div><h2>按名册录入</h2><p class="small muted">已录 ${n} 人 · 缺考 ${absent} 人 · 待录 ${Math.max(0,st.length-n-absent)} 人。保存后更新统计。</p></div><span class="keyboard-hint">Enter 下一位 · Shift + Enter 上一位</span></div>
  <div class="tablewrap grade-table-wrap"><table class="grade-table"><thead><tr><th scope="col">学生</th><th scope="col">分数 · 0–100</th><th scope="col">状态 / 等级</th><th scope="col">${prev?'较上次':'分数变化'}</th></tr></thead><tbody>
  ${st.map(student=>{const row=byStu[student.id],entry=gradeEntryState(row),previous=prevMap[student.id],diff=entry.value!==null&&previous!=null?Math.round((entry.value-previous)*10)/10:null;
    return `<tr><th scope="row"><span class="student-number">${E(student.no)}</span><span>${E(student.name)}</span></th><td><div class="grade-input-group"><input type="number" step="any" min="0" max="100" inputmode="decimal" placeholder="未录入" aria-label="${A(student.no+'号 '+student.name)}的分数" value="${row?.absent?'':A(row?.score??'')}" data-act="gradeInput" data-grade="${A(cur.id)}" data-sid="${A(student.id)}" ${row?.absent?'disabled':''}><label><input type="checkbox" data-act="gradeAbsent" data-grade="${A(cur.id)}" data-sid="${A(student.id)}" ${row?.absent?'checked':''}>缺考</label></div></td><td><span data-grade-level class="status ${entry.kind}">${entry.label}</span></td><td><b data-grade-diff data-previous="${previous??''}" class="${diff===null?'muted':diff<0?'score-down':'score-up'}">${diff===null?'—':(diff>0?'+':'')+diff}</b></td></tr>`}).join('')||'<tr><td colspan="4">本班暂无学生，请先到班级页导入名册。</td></tr>'}</tbody></table></div>
  <p class="small muted grade-table-note">${prev?'对比：'+E(prev.name)+' · '+E(prev.date)+'。':'暂无可比较的上次成绩。'}空白表示未录入；0 分参与统计；缺考不参与统计。</p>
  <div class="grade-savebar"><span data-grade-save-state role="status" class="save-state ${ui.dirty?'pending':''}">${ui.dirty?'有修改待保存':'当前记录已保存'}</span><div class="row">${btn('打印登记表','printGradeSheet','quiet sm')}${btn('AI 解读','gradeAI','sm')}${btn('保存全部分数','saveGrades','primary')}</div></div></section>
  ${state.aiCache?.['grade:'+cur.id]?`<section class="card ai-card mt"><h2>AI 成绩解读 · 供教师参考</h2><p class="preserve-lines">${E(state.aiCache['grade:'+cur.id])}</p></section>`:''}`;
}

function recTypes(){return [['闪光点','var(--sky)'],['需关注','var(--coral)'],['课堂表现','var(--sky)'],['谈心谈话','var(--ink2)'],['家访','var(--ink2)'],['帮扶','var(--sky)'],['家校联系','var(--ink2)'],['其他','var(--ink2)']]}
function renderProfile(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  if(!st.length)return heading('学生档案','一生一档。')+'<div class="card empty"><div class="mark">田</div><h2>还没有学生</h2><p>先到「班级」导入名册。</p></div>';
  if(!ui.profileStudent){
    return heading('学生档案','点击学生进入一生一档。')+'<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px">'+st.map(s=>{
      const recs=(state.records||[]).filter(r=>r.studentId===s.id);
      const warn=recs.filter(r=>r.type==='需关注').length;
      return '<button class="card stu-card" style="text-align:left;padding:16px" data-act="pickStudent" data-id="'+A(s.id)+'"><b style="font-size:20px">'+E(s.no)+'号</b> '+E(s.name)+'<br><small class="muted">记录 '+recs.length+' 条'+(warn?' · <span style="color:var(--coral)">需关注</span>':'')+'</small></button>'}).join('')+'</div>';
  }
  const cur=st.find(x=>x.id===ui.profileStudent);if(!cur){ui.profileStudent=null;return renderProfile()}
  state.records=state.records||[];state.reciteLogs=state.reciteLogs||[];state.aiCache=state.aiCache||{};
  const recs=state.records.filter(r=>r.studentId===cur.id).sort((a,b)=>b.date.localeCompare(a.date));const editing=recs.find(r=>r.id===ui.editRecordId);
  const allDict=inClass(state.dictations).map(d=>({date:d.date,n:(d.studentMarks&&d.studentMarks[cur.id]?d.studentMarks[cur.id].wrongWords||[]:[]).length,marked:d.studentMarks&&d.studentMarks[cur.id]?d.studentMarks[cur.id].status:'未录'})).filter(x=>assessedMark({status:x.marked})).sort((a,b)=>a.date.localeCompare(b.date));
  const dictHist=allDict.slice(-5);
  const g=[];inClass(state.assignments).forEach(a=>(a.scores||[]).forEach(s=>{if(s.studentId===cur.id)g.push(Number(s.score||0))}));
  const avg=g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):null;
  const maxN=Math.max(1,...dictHist.map(x=>x.n));
  return heading('学生档案 · 一生一档','学业概览自动聚合;观察记录随手记;AI 小结基于真实记录且已脱敏。',btn('‹ 返回列表','profileBack','sm'))+
  `<div class="grid cols2">
  <div class="stack">
    <section class="card"><h2>基本情况</h2><div class="row" style="gap:18px"><b style="font-size:30px">${E(cur.no)}号</b>
      <span class="muted">${E(cur.name)}</span>
      ${recs.filter(r=>r.type==='需关注').length?`<span class="status magenta">⚠ ${recs.filter(r=>r.type==='需关注').length} 条需关注</span>`:'<span class="status blue">暂无待关注</span>'}
      <span class="grow"></span></div>
      <form data-form="record" data-id="${A(cur.id)}" data-record="${A(editing?.id||'')}" class="stack mt">
        <div class="fieldrow"><label class="field">类型<select name="type">${recTypes().map(([t])=>`<option ${editing?.type===t?'selected':''}>${t}</option>`).join('')}</select></label>
        <label class="field">日期<input type="date" name="date" value="${editing?.date||today()}" required></label></div>
        <label class="field">内容<textarea name="note" rows="2" placeholder="30 秒随手记…" required>${E(editing?.note||'')}</textarea></label>
        <label class="row"><input type="checkbox" name="sensitive" ${editing?.sensitive?'checked':''}> 敏感记录(仅本地,永不进入 AI)</label>
        <div><button type="button" class="btn grass sm" data-act="saveRecordBtn">保存记录</button></div>
      </form>
    </section>
    <section class="card"><h2>学业概览 <small class="muted">(自动聚合)</small></h2>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        <div class="inset" style="text-align:center"><small>听写错词累计(全部${allDict.length}次)</small><b style="display:block;font-size:22px">${allDict.reduce((a,x)=>a+x.n,0)}</b></div>
        <div class="inset" style="text-align:center"><small>作文均分</small><b style="display:block;font-size:22px">${avg==null?'—':avg}</b></div>
        <div class="inset" style="text-align:center"><small>背诵通过</small><b style="display:block;font-size:22px">${state.reciteLogs.filter(r=>r.studentId===cur.id&&r.pass).length}</b></div>
        <div class="inset" style="text-align:center"><small>待复查</small><b style="display:block;font-size:22px">${inClass(state.followups).filter(f=>f.status==='待办'&&(!(f.studentIds||[]).length||(f.studentIds||[]).includes(cur.id))).length}</b></div>
      </div>
      ${dictHist.length?`<p class="small muted">最近听写错词数</p><div class="bars">${dictHist.map(x=>`<div class="bar-i"><i style="height:${Math.max(8,Math.round(x.n/maxN*64))}px"></i><small>${x.date.slice(5)}</small></div>`).join('')}</div>`:'<p class="muted small">暂无听写批改记录</p>'}
    </section>
    <section class="card"><h2>观察记录时间线</h2>
      ${recs.length?`<div class="tl">${recs.map(r=>{const c=(recTypes().find(x=>x[0]===r.type)||['','#999'])[1];return `<div class="tl-item"><i class="dot" style="background:${c};box-shadow:0 0 0 4px color-mix(in srgb,${c} 18%,#fff)"></i><div class="tl-txt"><b>${E(r.type)} · ${dateText(r.date)}</b><small>${E(r.note)}</small></div>${btn('编辑','editRecord','sm',`data-id="${A(r.id)}"`)}<button class="btn ghost sm" data-act="delRecord" data-id="${A(r.id)}" aria-label="删除观察记录">删除</button></div>`}).join('')}</div>`:'<p class="muted">还没有记录。</p>'}
    </section>
  </div>
  <div class="stack">
    <section class="card"><h2>✦ AI 学期小结</h2>
      <div id="aiSummaryOut">${state.aiCache['summary:'+cur.id]?'<p>'+E(state.aiCache['summary:'+cur.id])+'</p>'+btn('编辑并审定归档','aiSummaryKeep','primary sm')+btn('重新生成','aiSummary','sm'):btn('生成小结','aiSummary','primary sm')}</div>
      <p class="small muted" style="margin-top:10px">🔒 已脱敏:AI 不会收到学生姓名。</p>
    </section>
    <section class="card"><h2>✦ AI 家长沟通稿</h2>
      <div id="aiParentOut">${state.aiCache['parent:'+cur.id]?E(state.aiCache['parent:'+cur.id]):'<span class="muted small">基于已保存的学业摘要生成沟通草稿；发送给家长前请审核。</span>'}</div>
      <div class="row mt">${btn('✦ 生成沟通稿','aiParent','sky sm')}${state.aiCache['parent:'+cur.id]?btn('复制','aiParentCopy','grass sm'):''}</div>
      <p class="small muted" style="margin-top:8px">🔒 已脱敏。</p></section>
    <section class="card"><h2>打印</h2><div class="stack">${btn('导出该生档案 JSON','exportStudent','sm')}${btn('学生档案汇总','printProfile','sky sm')}${btn('谈心谈话记录表','printTalk','sm')}</div></section>
  </div></div>`;
}

function profileDataSummary(cur){
  const recs=(state.records||[]).filter(r=>r.studentId===cur.id&&!r.sensitive);
  const dictHist=inClass(state.dictations).map(d=>({n:(d.studentMarks?.[cur.id]?.wrongWords||[]).length,marked:d.studentMarks?.[cur.id]?.status})).filter(x=>assessedMark({status:x.marked}));
  const wrongTop={};inClass(state.dictations).forEach(d=>{const mk=d.studentMarks?.[cur.id];if(!assessedMark(mk))return;(mk.wrongWords||[]).forEach(x=>{wrongTop[x]=(wrongTop[x]||0)+1})});
  const topWrong=Object.entries(wrongTop).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,c])=>w+'(错'+c+'次)').join('、')||'无';
  return `该生(${cur.no}号)数据:听写记录 ${dictHist.length} 次,累计错词 ${dictHist.reduce((a,x)=>a+x.n,0)} 个,常错词:${topWrong};观察记录 ${recs.length} 条(需关注 ${recs.filter(r=>r.type==='需关注').length} 条、闪光点 ${recs.filter(r=>r.type==='闪光点').length} 条)。请基于以上真实数据给出学期小结(80字内,语气鼓励,先扬后抑)。`;
}

function renderClasses(){const c=currentClass();const roster=c?inClass(state.students).sort((a,b)=>String(a.no).localeCompare(String(b.no),'zh-CN')):[];const catalog=bookCatalog().filter(x=>!c||Number(x.grade)===Number(c.grade)&&x.term===c.term);const bookOptions=`<option value="">不绑定（教材待定）</option>`+catalog.map(b=>`<option value="${A(b.bookId)}" ${c?.bookId===b.bookId?'selected':''}>${E(b.publisher)} · ${E(b.title)} · ${E(b.editionYear||'')}</option>`).join('');return heading('班级','学生、教材和教学记录均按班级隔离。')+`<div class="grid cols2"><section class="card"><h2>建立班级</h2><form data-form="class" class="stack">${field('name','班级名称','','text','required')}<div class="fieldrow">${field('grade','年级','3','number','min="1" max="6" required')}<label class="field">册别<select name="term"><option>上册</option><option>下册</option></select></label></div><button class="btn primary" type="submit">建立班级</button></form><h2 class="mt">已有班级</h2>${state.classes.map(x=>`<div class="item row space"><div><b>${E(x.name)}</b><br><small>${x.grade}年级${E(x.term)} · ${E(x.publisher)}</small></div><div class="row">${btn('切换','switchClass','sm',`data-id="${A(x.id)}"`)}${btn('删除','deleteClass','sm danger',`data-id="${A(x.id)}"`)}</div></div>`).join('')||'<p class="muted">尚未建立班级。</p>'}</section><section class="card papertexture"><h2>当前班级设置</h2>${c?`<form data-form="classEdit" class="stack">${field('name','班级名称',c.name,'text','required')}${field('semesterStart','学期起始日期（用于周计划）',c.semesterStart||'','date')}<div class="fieldrow">${field('grade','年级',c.grade,'number','min="1" max="6" required')}<label class="field">册别<select name="term"><option ${c.term==='上册'?'selected':''}>上册</option><option ${c.term==='下册'?'selected':''}>下册</option></select></label></div><label class="field">绑定教材<select name="bookId">${bookOptions}</select></label><p class="small muted">切换教材不会自动把旧课次转成新教材课次；旧记录保留原教材关联。有教学记录后，换年级或册别请建立新班级。</p><button class="btn primary" type="submit">保存班级设置</button></form>`:'<p class="muted">建立班级后可绑定教材。</p>'}</section></div>${c?`<section class="card mt"><div class="row space"><h2>学生名册 · ${roster.length}人</h2><label class="btn sm" for="csvFile">导入 UTF-8 CSV</label></div><input id="csvFile" type="file" accept=".csv,text/csv" hidden><p class="small muted">CSV 表头：学号,姓名。支持匿名代号；同名以学号区分。导入前预览冲突，取消不会修改数据。${btn('⬇ 下载名册模板','downloadRosterTpl','sm')}</p><form data-form="student" class="row">${field('no','学号 / 代号','','text','required')}${field('name','姓名 / 匿名名','','text','required')}<button class="btn" type="submit">添加学生</button></form>${ui.csvCandidate?renderCsvPreview():''}<div class="tablewrap mt" style="max-height:440px"><table><thead><tr><th>学号</th><th>姓名</th><th>操作</th></tr></thead><tbody>${roster.map(s=>`<tr><td>${E(s.no)}</td><td>${E(s.name)}</td><td>${btn('编辑','editStudent','sm',`data-id="${A(s.id)}"`)}${btn('删除','deleteStudent','sm danger',`data-id="${A(s.id)}"`)}</td></tr>`).join('')||'<tr><td colspan="3">名册为空</td></tr>'}</tbody></table></div></section>`:''}`}
function renderCsvPreview(){const rows=ui.csvCandidate||[],seen=new Set(inClass(state.students).map(x=>x.no));let conflicts=0;const preview=rows.map(x=>{const conflict=seen.has(x.no);if(conflict)conflicts++;seen.add(x.no);return {...x,conflict}});return `<div class="inset mt"><h3>导入到 ${E(state.classes.find(c=>c.id===ui.csvClassId)?.name||'未选择班级')}：${rows.length}行，${conflicts}个学号冲突</h3><p class="small muted">重复学号（含本次文件内部重复）将跳过；取消后原数据保持不变。</p><div class="tablewrap" style="max-height:200px"><table><thead><tr><th>学号</th><th>姓名</th><th>结果</th></tr></thead><tbody>${preview.slice(0,10).map(x=>`<tr><td>${E(x.no)}</td><td>${E(x.name)}</td><td>${x.conflict?'冲突，跳过':'可导入'}</td></tr>`).join('')}</tbody></table></div><div class="row mt">${btn('确认导入','confirmCsv','primary')}${btn('取消','cancelCsv')}</div></div>`}
function renderSettings(){
  const ai=state.settings.ai||{},widget=state.widgets||{},configured=ui.aiReady===true;
  const chapters=[['appearance','01','课堂偏好','寄语、时钟与课堂计时'],['data','02','数据保管','备份、导入与历史恢复'],['ai','03','AI 助手','服务配置与连接状态'],['prompts','04','高级提示词','按教学场景调整草稿']];
  const prompts=[['markAnalysis','错词分析','批改记录'],['reciteGap','背诵挖空','课堂训练'],['reportCard','期末评语','学期总结'],['studentSummary','学生小结','学生档案'],['gradeAnalysis','成绩解读','成绩册'],['prepDraft','备课结构','备课记录'],['annAnalysis','划线分析','教材阅读'],['annLesson','整课分析','教材阅读'],['newsSummary','新闻摘要','每日新闻'],['parentLetter','家长沟通稿','学生档案']];
  const title=(n,t,desc)=>`<div class="setting-section-head"><span class="section-seal" aria-hidden="true">${n}</span><div><h2>${t}</h2><p>${desc}</p></div></div>`;
  return heading('工作台设置','整理好这本教学手记，让每天的工作顺手一些。')+`<div class="settings-book"><aside class="settings-index"><div class="index-heading"><span>本册目录</span><small>SETTINGS</small></div><nav aria-label="设置目录">${chapters.map(([id,n,name,desc],i)=>`<button type="button" data-act="settingsSection" data-section="${id}" aria-controls="settings-${id}" class="${i===0?'on':''}"><span>${n}</span><div><b>${name}</b><small>${desc}</small></div><i aria-hidden="true">›</i></button>`).join('')}</nav><figure class="grimoire-vignette"><img src="__BOOK_GRIMOIRE__" alt="" decoding="async" draggable="false"><figcaption>把日常积累，装订成册。</figcaption></figure><div class="index-footnote">设置分区独立保存<br>业务数据保存在本机 SQLite</div></aside><div class="settings-pages">
  <section class="card setting-page" id="settings-appearance" tabindex="-1">${title('01','课堂偏好','让首页保留你需要的信息。')}<form data-form="widgets" class="stack"><label class="field">课堂寄语<textarea name="marquee" rows="3" placeholder="每行一条寄语">${E(Array.isArray(widget.marquee?.texts)?widget.marquee.texts.join('\n'):'今天也要元气满满，孩子们加油！')}</textarea><small class="field-help">每行一条，在首页轮播。</small></label><input type="hidden" name="mqStyle" value="ribbon"><div class="setting-control-row"><div><b>首页时钟</b><p>显示当前时间和课堂计时工具。</p></div><label class="toggle-control"><input type="checkbox" name="clockOn" ${widget.clock?.off?'':'checked'}><span>显示</span></label></div>${field('countdown','课堂计时 · 分钟',widget.clock?.countdownMin||5,'number','min="1" max="180" required')}<div class="setting-actions"><small>仅保存本区的课堂偏好</small>${btn('保存课堂偏好','widgetSave','primary')}</div></form></section>
  <section class="card setting-page" id="settings-data" tabindex="-1">${title('02','数据保管','给每一份教学记录留好副本。')}<div class="backup-primary"><div><b>导出一份完整业务备份</b><p>包含班级、学生和教学记录，可用于迁移或恢复。</p></div>${btn('导出备份','exportBackup','primary')}</div><div class="setting-option"><div><b>从备份恢复</b><p>选择 JSON 文件后先预览；确认后会覆盖当前业务数据。</p></div>${btn('选择备份文件','selectBackup','sm')}</div><input id="backupFile" type="file" accept=".json,application/json" hidden>${ui.importCandidate?renderImportPreview():''}<div class="setting-option"><div><b>历史版本</b><p>查看本机保留的历史快照，选择版本进入恢复预览。</p></div>${btn('查看历史','viewHistory','sm')}</div><details class="setting-note"><summary>存储位置与重新读取</summary><p>桌面版使用系统应用数据目录，本机服务使用 app/data；两者使用各自的 SQLite 数据库。</p><p>PDF 教材需单独保留，API 密钥不进入业务备份。</p><div>${btn('重新读取数据库','retryStorage','sm')}</div></details></section>
  <section class="card setting-page" id="settings-ai" tabindex="-1">${title('03','AI 助手','按需辅助备课和整理，生成内容由教师审阅。')}<div class="ai-connection"><span class="status ${configured?'blue':''}">${configured?'密钥已配置':'尚未配置密钥'}</span><span>课堂记录、成绩与打印无需配置 AI</span></div><form data-form="settings" class="stack">${field('base','服务地址 · Base URL',ai.base||'','url','required')}${field('model','模型名称',ai.model||'deepseek-flash','text','required')}${field('key','API 密钥','','password','autocomplete="new-password"')}<p class="field-help">留空保留现有密钥。密钥由系统加密保存；发送内容会在请求前展示给你确认。</p><div class="setting-actions"><small>先保存配置，再测试连接</small><div class="row">${btn('测试已保存配置','aiTest','sm')}<button class="btn primary" type="submit">保存 AI 配置</button></div></div></form></section>
  <section class="card setting-page" id="settings-prompts" tabindex="-1">${title('04','高级提示词','保留默认设置即可使用，需要时再调整。')}<form data-form="prompts" class="stack"><div class="prompt-chapters">${prompts.map(([key,label,where])=>`<details><summary><b>${label}</b><small>${where}</small></summary><label class="field"><span class="sr">${label}提示词</span><textarea name="p_${key}" rows="6">${E(promptFor(key))}</textarea></label></details>`).join('')}</div><div class="setting-actions"><small>清空某项即恢复该项默认提示词</small>${btn('保存提示词','promptsSave','primary')}</div></form></section>
  </div></div>`;
}

function renderImportPreview(){const s=ui.importCandidate;return `<div class="inset mt"><h3>备份预览</h3><p>版本 ${s.version} · 班级 ${s.classes.length} · 学生 ${s.students.length} · 听写 ${s.dictations.length} · 作业 ${s.assignments.length} · 复查 ${s.followups.length}</p><p class="small muted">导入将整体覆盖当前业务数据。导入失败时原数据不变。</p><div class="row">${btn('确认覆盖导入','confirmImport','accent')}${btn('取消','cancelImport')}</div></div>`}
function legacyPanel(){const words=state.legacyWrong||[];if(!words.length)return '<p class="muted">没有旧版错词。</p>';return `<div class="tablewrap" style="max-height:260px"><table><thead><tr><th>词语</th><th>拼音</th><th>归属</th></tr></thead><tbody>${words.map(x=>`<tr><td>${E(x.word)}</td><td>${E(x.pinyin)}</td><td><select data-act="assignLegacy" data-id="${A(x.id)}" aria-label="${A(x.word)}归属班级"><option value="" ${!x.classId?'selected':''}>个人词单（未归班）</option>${state.classes.map(c=>`<option value="${A(c.id)}" ${x.classId===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`}

document.addEventListener('input',event=>{captureFormDraft(event.target.closest('form[data-form]'));if(event.target.dataset?.act==='gradeInput')captureGradeDraft(event.target)});
document.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.isComposing||event.target.dataset?.act!=='gradeInput')return;const fields=[...document.querySelectorAll('[data-act=gradeInput]:not(:disabled)')],i=fields.indexOf(event.target),next=fields[i+(event.shiftKey?-1:1)];if(next){event.preventDefault();next.focus();next.select()}});
document.addEventListener('change',async event=>{const el0=event.target;if(el0.id==='reciteStudent'){ui.reciteStudent=el0.value;return}if(el0.id==='annLayerSel'){ui.annLayer=el0.value;renderApp();return}if(el0.name==='model'){const w=document.getElementById('modelWarn');if(w)w.hidden=el0.value!=='deepseek-v4-pro'}
  if(el0.dataset?.act==='gradeAbsent'){const inp=document.querySelector('[data-act=gradeInput][data-sid="'+el0.dataset.sid+'"]');if(inp){inp.disabled=el0.checked;if(el0.checked){inp.dataset.beforeAbsent=inp.value;inp.value=''}else if(inp.dataset.beforeAbsent!==undefined){inp.value=inp.dataset.beforeAbsent;delete inp.dataset.beforeAbsent}}captureGradeDraft(el0);return}
  if(el0.dataset?.act==='gradeInput'){captureGradeDraft(el0);return}
  if(el0.id==='classSwitch'&&ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换班级吗？'))){renderApp();return}
  return stateOperation(async()=>{const el=event.target;captureFormDraft(el.closest?.('form[data-form]'));if(el.id==='bookGrade'){ui.bookGrade=el.value;renderApp();document.querySelector('#bookGrade')?.focus();return}if(el.id==='bookTerm'){ui.bookTerm=el.value;renderApp();document.querySelector('#bookTerm')?.focus();return}if(el.id==='bookPublisher'){ui.bookPublisher=el.value;renderApp();document.querySelector('#bookPublisher')?.focus();return}if(el.id==='classSwitch'){if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换班级吗？'))){renderApp();return}if(el.value&&!state.classes.some(c=>c.id===el.value))return toast('班级不存在');state.selectedClassId=el.value||null;discardDrafts();clearClassContext();await save();renderApp();return}if(el.id==='csvFile'){try{if(!currentClass())return toast('请先选择班级');if(!el.files?.[0])return;ui.csvCandidate=parseCSV(await el.files[0].text());ui.csvClassId=state.selectedClassId;renderApp()}catch(e){toast(`CSV 错误：${e.message}`)}return}if(el.id==='backupFile'){try{const value=JSON.parse(await el.files[0].text());if(!validImport(value))throw Error('备份结构或版本不正确');ui.importCandidate=value.state;renderApp()}catch(e){toast(`备份无效：${e.message}`)}return}if(el.id==='tempPdfFile'){const f=el.files?.[0];if(!f)return;if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return toast('请选择 PDF 文件');if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);ui.pdfUrl=URL.createObjectURL(f);ui.pdfTemporary=true;ui.pdfFileName=f.name;ui.pdfReturn='resources';ui.view='pdf';location.hash='pdf';renderApp();return}if(el.dataset.act==='assignLegacy'){const item=state.legacyWrong.find(x=>x.id===el.dataset.id);if(!item)return;if(el.value&&!state.classes.some(c=>c.id===el.value))return toast('班级不存在');item.classId=el.value||null;await save();renderApp();return}if(el.name?.startsWith('studentPick_')){updateStudentPickCount(el.closest('form[data-form]'));return}if(el.dataset.act==='wordToggle'){ui.dictWords[Number(el.dataset.index)].on=el.checked;ui.dirty=true;stopDict();ui.dictIndex=-1;renderApp()}})});
document.addEventListener('click',async event=>{const el=event.target.closest('[data-act]');if(!el)return;const act=el.dataset.act;
  // 确认框前置:在进入事务(busy)之前完成所有用户确认,避免等待期间冻结保存
  const confirmMsg = (ui.dirty && CONFIRM_VERBS[act]) || null;
  if(confirmMsg){if(!(await uiConfirm('当前表单有未保存的更改，'+confirmMsg+'？')))return;discardDrafts();}
  if (act === 'deleteClass') {
    const c0 = state.classes.find(x => x.id === el.dataset.id);
    if (!c0) return;
    if (!(await uiConfirm('删除“' + c0.name + '”及其学生、教学和批改记录？请先从设置页导出备份。', { danger: true, ok: '删除' }))) return;
  }
  if (act === 'deleteStudent') {
    const s0 = inClass(state.students).find(x => x.id === el.dataset.id);
    if (!s0) return;
    if (!(await uiConfirm('删除学生“' + s0.name + '”？相关批改记录会保留原始编号。', { danger: true, ok: '删除' }))) return;
  }
  if (act === 'deleteTask') {
    const t0 = inClass(state.tasks).find(x => x.id === el.dataset.id);
    if (t0 && !(await uiConfirm('删除这条待办？', { danger: true, ok: '删除' }))) return;
  }
  if (act === 'delGrade') {
    const g0 = (state.grades||[]).find(x => x.id === el.dataset.id);
    if (g0 && !(await uiConfirm('删除「' + g0.name + '」及其全部分数?', { danger: true, ok: '删除' }))) return;
  }
  if (act === 'delRecord') {
    if (!(await uiConfirm('删除这条观察记录？', { danger: true, ok: '删除' }))) return;
  }
return stateOperation(async()=>{switch(act){
case'selectBackup':document.getElementById('backupFile')?.click();break;
case'settingsSection':{const section=document.getElementById('settings-'+el.dataset.section);if(section){section.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});section.focus({preventScroll:true});for(const button of document.querySelectorAll('[data-act=settingsSection]'))button.classList.toggle('on',button===el)}break}
case'navigate':{discardDrafts();const v=el.dataset.view;if(v==='marking'&&el.dataset.tab)ui.markTab=el.dataset.tab;if(v==='dictation'&&ui.view!=='dictation'){ui.dictWords=[];ui.dictIndex=-1;ui.activeDictId=null;ui.dictForm=null}switchView(v);break}
case'selectLesson':discardDrafts();ui.teachLesson=el.dataset.no;clearDictContext();renderApp();break;
case'newLesson':{ui.teachLesson='';ui.dictWords=[];ui.activeDictId=null;ui.dictForm=null;discardDrafts();renderApp();document.querySelector('form[data-form="progress"] [name="lessonNo"]')?.focus();break}
case'newAssignment':{if(!currentClass())return toast('先建立班级');if(ui.dirty)return toast('请先保存当前表单');ui.newAssignment=true;ui.markTab='assignment';ui.markId=null;discardDrafts();switchView('marking');document.querySelector('form[data-form="assignmentNew"] [name="content"]')?.focus();break}
case'cancelAssignment':ui.newAssignment=false;discardDrafts();renderApp();break;
case'openTask':{discardDrafts();const t=el.dataset.target;if(t==='teaching'&&el.dataset.kind==='teach'){const p=inBook(state.progress).find(x=>x.id===el.dataset.id);if(p)ui.teachLesson=String(p.lessonNo)}if(t==='marking'){ui.markId=el.dataset.id;if(['follow','lecture'].includes(el.dataset.kind))ui.markTab='followups';else ui.markTab=inBook(state.dictations).some(x=>x.id===ui.markId)?'dictation':'assignment'}switchView(t);break}
case'editTask':{discardDrafts();ui.editingTaskId=el.dataset.id;renderApp();document.querySelector('form[data-form="manualTaskEdit"] [name="title"]')?.focus();break}
case'cancelTaskEdit':{const key='manualTaskEdit|'+(ui.editingTaskId||'');delete ui.formDrafts[key];ui.dirty=Object.keys(ui.formDrafts).length>0;ui.editingTaskId=null;renderApp();break}
case'deleteTask':{const t=inClass(state.tasks).find(x=>x.id===el.dataset.id);if(!t)break;state.tasks=state.tasks.filter(x=>x.id!==t.id);if(ui.editingTaskId===t.id)ui.editingTaskId=null;delete ui.formDrafts['manualTaskEdit|'+t.id];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();renderApp();break}
case'toggleTask':{if(ui.dirty)return toast('请先保存当前表单');const t=inClass(state.tasks).find(x=>x.id===el.dataset.id);if(t){const previous=t.status;t.status=t.status==='完成'?'待办':'完成';await save();ui.undoStatus={kind:'task',id:t.id,classId:t.classId,previous,current:t.status};renderApp()}break}
case'wordAll':case'wordNone':ui.dictWords.forEach(x=>x.on=act==='wordAll');ui.dirty=true;stopDict();ui.dictIndex=-1;renderApp();break;
case'wordUp':case'wordDown':{const i=Number(el.dataset.index),j=i+(act==='wordUp'?-1:1);if(j>=0&&j<ui.dictWords.length){[ui.dictWords[i],ui.dictWords[j]]=[ui.dictWords[j],ui.dictWords[i]];ui.dirty=true;stopDict();ui.dictIndex=-1;renderApp()}break}
case'dictMain':{const words=selectedDictWords();if(!words.length)return toast('请先勾选至少一个词');if(!ui.activeDictId||ui.dirty)return toast('先保存当前听写任务与词单');if(ui.dictRunning){stopDict();dictDisplay();break}ui.dictRunning=true;if(ui.dictIndex<0||ui.dictIndex>=words.length)ui.dictIndex=0;ui.dictReveal=false;dictSpeakCurrent();dictDisplay();break}
case'dictNext':dictAdvance(false);break;case'dictPrev':dictMove(-1);break;case'dictReveal':ui.dictReveal=!ui.dictReveal;dictDisplay();break;
case'markTab':ui.markTab=el.dataset.tab;ui.markId=null;ui.newAssignment=false;ui.newFollowup=null;ui.editingFollowupId=null;discardDrafts();renderApp();break;
case'selectMark':ui.markId=el.dataset.id;ui.markTab=el.dataset.tab;ui.newAssignment=false;discardDrafts();renderApp();break;
case'newFollowup':{
  if(!currentClass())return toast('先建立班级');
  if(ui.dirty)return toast('请先保存当前记录');
  const sourceType=el.dataset.sourceType||'',sourceId=el.dataset.sourceId||'';
  if(sourceType||sourceId){if(!['dictation','assignment'].includes(sourceType)||!sourceId||!inBook(countSource(sourceType)).some(x=>x.id===sourceId))return toast('来源记录不属于本班当前教材，请重新选择')}
  ui.newFollowup={sourceType,sourceId};
  ui.editingFollowupId=null;ui.markTab='followups';discardDrafts();switchView('marking');
  document.querySelector('form[data-form="followupNew"] [name="title"]')?.focus();break
}
case'cancelFollowup':ui.newFollowup=null;ui.editingFollowupId=null;discardDrafts();renderApp();break;
case'followupPickAll':case'followupPickNone':{const form=el.closest?.('form[data-form="followupNew"],form[data-form="followupResult"]');if(!form?.querySelectorAll)break;for(const item of form.querySelectorAll('input[name^="studentPick_"]'))item.checked=act==='followupPickAll';captureFormDraft(form);updateStudentPickCount(form);break}
case'insertTemplate':{const form=el.closest?.('form[data-form]'),fieldName=el.dataset.field,control=form?.elements?.namedItem(fieldName);if(!control||!['issues','measures'].includes(fieldName))break;control.value=appendLine(control.value,el.dataset.template||'');captureFormDraft(form);control.focus();break}

case'undoStatus':{const last=ui.undoStatus;if(!last)break;if(ui.dirty)return toast('请先保存或放弃当前表单更改');const records=last.kind==='task'?state.tasks:state.followups;const rec=records.find(x=>x.id===last.id&&x.classId===last.classId);if(!rec||rec.status!==last.current){ui.undoStatus=null;renderApp();return toast('该记录已变化，无法撤销')}rec.status=last.previous;if(last.kind==='followup')rec.updatedAt=new Date().toISOString();await save();renderApp();toast('已撤销状态切换');break}
case'toggleFollowup':{if(ui.dirty)return toast('请先保存当前表单');const f=inBook(state.followups).find(x=>x.id===el.dataset.id);if(!f)break;if(f.status!=='完成'&&!f.result?.trim()){ui.editingFollowupId=f.id;renderApp();return toast('先填写处理结果，再标记完成')}const previous=f.status;f.status=f.status==='完成'?'待办':'完成';f.updatedAt=new Date().toISOString();await save();ui.undoStatus={kind:'followup',id:f.id,classId:f.classId,previous,current:f.status};renderApp();break}

case'resourceTab':ui.resourceTab=el.dataset.tab;discardDrafts();renderApp();document.querySelector('[data-act="resourceTab"][data-tab="'+ui.resourceTab+'"]')?.focus();break;
case'bindBook':{discardDrafts();const c=currentClass(),b=bookCatalog().find(x=>x.bookId===el.dataset.id);if(!c||!b)break;if(c.grade!==Number(b.grade)||c.term!==b.term)return toast('教材年级或册别与班级不符');c.bookId=b.bookId;c.publisher=b.publisher;c.editionYear=b.editionYear||'';clearClassContext();await save();renderApp();break}
case'openPdf':{const b=(window.TEXTBOOKS||[]).find(x=>x.bookId===el.dataset.id);if(b?.file&&/^[a-z0-9][a-z0-9-]{2,63}\.pdf$/.test(b.file)){const page=Number(el.dataset.page);ui.pdfUrl=window.desktop?await window.desktop.textbook.url(b.file):new URL('textbooks/'+b.file,location.href).href;ui.pdfBookId=b.bookId;ui.pdfTemporary=false;ui.pdfFileName='';ui.pdfReturn=ui.view;ui.view='pdf';location.hash='pdf';const les=(b.lessons||[]).find(l=>String(l.lessonNo)===String(ui.teachLesson));ui.annPage=Number.isInteger(page)&&page>0?page:les?.pageStart||1;renderApp()}break}
case'tempPdf':ui.pdfBookId=el.dataset.id;document.querySelector('#tempPdfFile')?.click();break;
case'closePdf':if(ui.pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(ui.pdfUrl);ui.pdfUrl=null;ui.view=ui.pdfReturn||'resources';renderApp();break;
case'annPageFromLesson':{const b=bookCatalog().find(x=>x.bookId===ui.pdfBookId);const les=(b&&b.lessons||[]).find(l=>String(l.lessonNo)===String(ui.teachLesson));if(les&&les.pageStart){ui.annPage=les.pageStart;toast('已定位到第'+les.pageStart+'页(课次页码目录)')}else toast('本课页码目录待录入');renderApp();break}
case'switchClass':if(!state.classes.some(c=>c.id===el.dataset.id))return toast('班级不存在');state.selectedClassId=el.dataset.id;discardDrafts();clearClassContext();await save();renderApp();break;
case'goRoll':await switchView('rollcall');break;
case'goRecite':restoreReciteText();await switchView('recite');break;
case'rollReset':ui.rollPicked=[];ui.rollCurrent=null;ui.rollSeq=0;renderApp();break;

case'promptsSave':{const form=document.querySelector('form[data-form=prompts]');state.settings.prompts=state.settings.prompts||{};for(const key of Object.keys(PROMPTS_DEFAULT)){const value=formVal(form,'p_'+key);if(value)state.settings.prompts[key]=value;else delete state.settings.prompts[key]}delete ui.formDrafts[formDraftKey(form)];await save();renderApp();toast('提示词已保存');break}
case'printDuty':{const students=inClass(state.students).sort(studentOrder);if(!students.length)return toast('请先导入学生');const input=await configureDialog('卫生值日表',field('tasks','值日区域（用顿号分隔）','教室、走廊、黑板、讲台')+field('week','周次/日期','本周'),'生成预览');if(!input)break;const tasks=input.tasks.split(/[、,，]/).map(x=>x.trim()).filter(Boolean);if(!tasks.length)return toast('请填写至少一个区域');const rows=Array.from({length:5},(_,d)=>'<tr><th>周'+['一','二','三','四','五'][d]+'</th>'+tasks.map((t,i)=>'<td>'+students.filter((_,n)=>n%(5*tasks.length)===d*tasks.length+i).map(s=>E(s.no)+' '+E(s.name)).join('、')+'</td>').join('')+'</tr>').join('');printHTML(printHeader('卫生值日表',currentClass().name+' · '+input.week)+'<table class="print-table"><tr><th>日期</th>'+tasks.map(t=>'<th>'+E(t)+'</th>').join('')+'</tr>'+rows+'</table>');break}
case'viewHistory':await showHistory();break;
case'editGradeMeta':{const g=inClass(state.grades).find(x=>x.id===ui.gradeSel);if(!g)break;const input=await configureDialog('成绩单信息',field('name','考试/练习名称',g.name,'text','required')+field('date','日期',g.date,'date','required'));if(!input)break;g.name=input.name.trim();g.date=input.date;await save();renderApp();break}
case'goCurrentMark':{if(!ui.activeDictId)return toast('请先保存听写任务');ui.markId=ui.activeDictId;ui.markTab='dictation';await switchView('marking');break}
case'clockStart':{if(ui.countdownEnd)break;const seconds=ui.countdownLeft??Number(state.widgets?.clock?.countdownMin||5)*60;if(seconds<=0)return toast('计时已结束，请先重置');ui.countdownEnd=Date.now()+seconds*1000;updateClock();break}
case'clockPause':if(ui.countdownEnd)ui.countdownLeft=Math.max(0,Math.ceil((ui.countdownEnd-Date.now())/1000));ui.countdownEnd=null;updateClock();break;
case'clockReset':ui.countdownEnd=null;ui.countdownLeft=Number(state.widgets?.clock?.countdownMin||5)*60;updateClock();break;

case'rollMode':ui.rollMode=el.dataset.mode;renderApp();break;
case'rollMark':{const c=inClass(state.students).find(x=>x.id===ui.rollCurrent?.id);if(!c)return toast('请先从本班抽取学生');state.records=state.records||[];state.records.push({id:uid(),classId:c.classId,studentId:c.id,type:'课堂表现',date:today(),note:'随机点名回答问题',sensitive:false});ui.dirty=true;await save();rollNext();break}
case'rollSkip':rollNext();break;
case'pickStudent':ui.profileStudent=el.dataset.id;renderApp();break;
case'editRecord':ui.editRecordId=el.dataset.id;renderApp();break;
case'exportStudent':{const student=inClass(state.students).find(x=>x.id===ui.profileStudent);if(!student)break;const payload={format:'student-profile',version:1,exportedAt:new Date().toISOString(),student,records:(state.records||[]).filter(x=>x.studentId===student.id),recitations:(state.reciteLogs||[]).filter(x=>x.studentId===student.id),grades:inClass(state.grades).map(g=>({name:g.name,date:g.date,result:g.scores.find(x=>x.studentId===student.id)})),dictations:inClass(state.dictations).filter(d=>d.studentMarks?.[student.id]).map(d=>({date:d.date,title:d.title,mark:d.studentMarks[student.id]}))};download('学生档案-'+student.no+'.json',JSON.stringify(payload,null,2),'application/json');break}
case'editStudent':{const student=inClass(state.students).find(x=>x.id===el.dataset.id);if(!student)break;const input=await configureDialog('编辑学生',field('no','学号',student.no,'text','required')+field('name','姓名或代号',student.name,'text','required'));if(!input)break;if(inClass(state.students).some(x=>x.id!==student.id&&x.no===input.no.trim()))return toast('同班学号已存在');student.no=input.no.trim();student.name=input.name.trim();await save();renderApp();break}
case'profileBack':ui.profileStudent=null;renderApp();break;
case'delRecord':{if(!(await uiConfirm('删除这条观察记录？可通过历史版本恢复。',{danger:true})))break;state.records=state.records.filter(r=>r.id!==el.dataset.id||r.studentId!==ui.profileStudent);await save();renderApp();break}
case'newGrade':{const c=currentClass();if(!c)break;const g=newGradeObj();
  g.scores=inClass(state.students).map(s=>({studentId:s.id,score:''}));
  state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.gradeDetail=g.id;ui.dirty=true;await save();renderApp();break}
case'pickGrade':ui.gradeSel=el.dataset.id;ui.gradeDetail=el.dataset.id;renderApp();break;
case'gradeBack':ui.gradeDetail=null;renderApp();break;
case'delGrade':{state.grades=(state.grades||[]).filter(x=>x.id!==el.dataset.id);if(ui.gradeSel===el.dataset.id){ui.gradeSel=null;ui.gradeDetail=null}ui.dirty=true;await save();renderApp();toast('成绩单已删除');break}
case'gradeInput':break;
case'saveGrades':{const gid=ui.gradeSel||((document.querySelector('[data-act=gradeInput]')||{}).dataset||{}).grade;const g=(state.grades||[]).find(x=>x.id===gid);if(!g)break;
  const rows=[];let bad=0;
  inClass(state.students).forEach(s=>{
    const ab=document.querySelector('[data-act=gradeAbsent][data-sid="'+s.id+'"]');
    if(ab&&ab.checked){rows.push({studentId:s.id,score:'',absent:true});return}
    const raw=String(((document.querySelector('[data-act=gradeInput][data-sid="'+s.id+'"]')||{}).value)||'').trim();
    if(raw===''){rows.push({studentId:s.id,score:''});return}
    const n=Number(raw);
    if(!isFinite(n)||n<0||n>100){bad++;return}
    rows.push({studentId:s.id,score:raw})});
  if(bad)return toast(bad+' 个分数无效(需 0-100 的数字),本次未保存');
  g.scores=rows;ui.dirty=true;await save();if(ui.gradeDrafts)delete ui.gradeDrafts[gid];toast('分数已保存(空白与缺考不计入统计)');renderApp();break}
case'gradeAI':{if(ui.dirty)return toast('请先保存分数，再生成解读');const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const st=gradeStats(g.scores||[]);if(!st?.n){toast('先录入有效分数');break}
  toast('AI 解读中…');
  try{const prev=inClass(state.grades).filter(x=>x.id!==g.id&&x.date<=g.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const ps=prev?gradeStats(prev.scores||[]):null;
  const out=await DesktopAI.chat([{role:'system',content:promptFor('gradeAnalysis')},{role:'user',content:'本次:'+g.name+' 平均'+st.avg+' 优秀率'+st.excRate+'% 及格率'+st.passRate+'% 最高'+st.max+' 最低'+st.min+(ps?';上次:'+ps.avg+' 优秀率'+ps.excRate+'% 及格率'+ps.passRate:';无上次数据')}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['grade:'+g.id]=out;await save();renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'printGradeSheet':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const c=currentClass();
  const byId={};inClass(state.students).forEach(s=>byId[s.id]=s);
  const rows=inClass(state.students).slice().sort(studentOrder).map((stu,i)=>{return `<tr><td>${i+1}</td><td>${E(stu.no)}号</td><td>${E(stu.name)}</td><td style="width:24mm"></td></tr>`}).join('');
  printHTML(printHeader('成绩登记表 · '+E(g.name),'班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>分数</th></tr>'+rows+'</table>');break}
case'printHW':{const c=currentClass();if(!c)break;
  const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td><td style="width:20mm"></td><td style="width:20mm"></td><td style="width:20mm"></td></tr>`).join('');
  printHTML(printHeader('作业收缴登记表','班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>已交</th><th>未交原因</th><th>订正</th></tr>'+rows+'</table>');break}
case'printReciteTrack':{const c=currentClass();if(!c)break;
  const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>{const rl=(state.reciteLogs||[]).filter(r=>r.studentId===s.id);return `<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td>${'<td style="width:16mm"></td>'.repeat(8)}<td>${rl.length+'次'}</td></tr>`}).join('');
  printHTML(printHeader('背诵听写默写跟踪表','班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>累计</th></tr>'+rows+'</table>');break}
case'printSeats':{ui.view='seats';renderApp();break}
case'doPrintSeats':{const c=currentClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const seats=classSeats();const cols=6;let html='';
  for(let i=0;i<seats.length;i+=cols){html+='<tr>'+(seats.slice(i,i+cols).map(id=>{const s=st.find(x=>x.id===id);return '<td style="height:16mm;text-align:center">'+(s?E(s.no)+'号 '+E(s.name):'空')+'</td>'}).join('')+(seats.slice(i,i+cols).length<cols?'<td colspan="'+(cols-seats.slice(i,i+cols).length)+'"></td>':'')+'</tr>')}
  printHTML(printHeader('座位表','班级:'+E(c.name),'')+'<table class="print-table">'+html+'</table><p style="margin-top:5mm;text-align:center">讲台</p>');break}
case'resetSeats':{const b=classBucket('seatsByClass');if(!b)break;b.list=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);ui.dirty=true;await save();renderApp();break}
case'seatSwap':{const b=classBucket('seatsByClass');if(!b)break;if(!Array.isArray(b.list)||!b.list.length)b.list=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);
  if(!ui.seatSwapA){ui.seatSwapA=el.dataset.id;renderApp();break}
  if(ui.seatSwapA===el.dataset.id){ui.seatSwapA=null;renderApp();break}
  const i=b.list.indexOf(ui.seatSwapA),j=b.list.indexOf(el.dataset.id);
  if(i>=0&&j>=0){const t=b.list[i];b.list[i]=b.list[j];b.list[j]=t;ui.dirty=true;await save()}
  ui.seatSwapA=null;renderApp();break}
case'openPoints':ui.view='points';renderApp();break;
case'pointPlus':{const id=el.dataset.id||el.dataset.no;const pts=classPoints();if(!pts)break;pts[id]=(pts[id]||0)+1;ui.dirty=true;await save();renderApp();break}
case'pointMinus':{const id=el.dataset.id||el.dataset.no;const pts=classPoints();if(!pts)break;pts[id]=Math.max(0,(pts[id]||0)-1);ui.dirty=true;await save();renderApp();break}
case'aiPrep':{const lesson=selectedLesson();if(!lesson)return toast('请先保存当前课次');const source='教材：'+(activeBook()?.title||'未绑定，内容须教师核对')+'\n课次：'+lesson.lessonNo+' '+lesson.title+'\n已录词单：'+scopedWords().map(x=>x.w).join('、');const result=await DesktopAI.chat([{role:'system',content:promptFor('prepDraft')+'仅依据给定课名和词单提供结构建议，未提供课文时不得声称已分析原文。'},{role:'user',content:source}],.4);const input=await configureDialog('教案草稿（审阅后采纳到活动）',area('activities','活动草稿',result,10),'采纳');if(!input)break;let prep=inBook(state.preps).find(x=>String(x.lessonNo)===String(ui.teachLesson));if(!prep){prep={id:uid(),classId:currentClass().id,bookId:currentClass().bookId||'',lessonNo:ui.teachLesson};state.preps.push(prep)}prep.activities=input.activities;await save();renderApp();break}
case'aiTest':{if(ui.formDrafts['settings|'])return toast('请先保存 AI 配置，再测试连接');if(!(await DesktopAI.hasKey()))return toast('请先保存 API 密钥');toast('测试连接中…');try{const t0=performance.now();await DesktopAI.chat([{role:'user',content:'你好'}],0);toast('连接成功（'+Math.round(performance.now()-t0)+'ms）')}catch(error){toast('连接测试未完成：'+String(error.message).slice(0,80))}break}
case'saveRecordBtn':{const rf=document.querySelector('form[data-form=record]');if(!rf)break;
  const gv=n2=>{const el=rf.elements.namedItem(n2);return el?String(el.value||'').trim():''};
  rf.querySelectorAll('.field-error').forEach(x=>x.remove());rf.querySelectorAll('.invalid').forEach(x=>x.classList.remove('invalid'));
  const c=currentClass();if(!c){toast('请先选择班级');break}
  const note=gv('note');if(!note){const ta=rf.elements.namedItem('note');ta.classList.add('invalid');const fe=document.createElement('div');fe.className='field-error';fe.textContent='⚠ 请填写记录内容。';ta.parentElement.appendChild(fe);ta.focus();break}
  state.records=state.records||[];
  const student=inClass(state.students).find(x=>x.id===rf.dataset.id);if(!student)return toast('当前学生已变化，请重新选择');const data={classId:c.id,studentId:student.id,type:gv('type')||'其他',date:gv('date')||today(),note,sensitive:!!rf.elements.namedItem('sensitive')?.checked};const old=state.records.find(x=>x.id===rf.dataset.record&&x.studentId===student.id);if(old)Object.assign(old,data);else state.records.push({id:uid(),...data});ui.editRecordId=null;
  delete ui.formDrafts[formDraftKey(rf)];ui.dirty=Object.keys(ui.formDrafts).length>0;
  delete ui.formDrafts[formDraftKey(rf)];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();toast('已记录');renderApp();break}

case'widgetSave':{const wf=document.querySelector('form[data-form=widgets]');if(!wf)break;
  if(wf.reportValidity&&!wf.reportValidity())break;
  const gv2=n3=>{const el=wf.elements.namedItem(n3);return el?String(el.value||'').trim():''};
  const minutes=Number(gv2('countdown'));if(!Number.isInteger(minutes)||minutes<1||minutes>180)return toast('计时请输入 1–180 的整数分钟');
  state.widgets={marquee:{texts:(gv2('marquee')||'').split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean),off:false,style:'ribbon'},clock:{off:!wf.elements.namedItem('clockOn')?.checked,countdownMin:minutes}};
  delete ui.formDrafts[formDraftKey(wf)];ui.dirty=Object.keys(ui.formDrafts).length>0;ui.countdownEnd=null;ui.countdownLeft=null;
  ui.dirty=true;await save();renderApp();toast('小组件已更新');break}
case'reciteSave':{const form=document.querySelector('form[data-form=recite]');const text=formVal(form,'reciteText');if(!text)return toast('请填写课文');state.reciteTexts=state.reciteTexts||{};state.reciteTexts[reciteBookKey()]={classId:currentClass().id,bookId:currentClass().bookId||'',lessonNo:ui.teachLesson,text,updatedAt:new Date().toISOString()};ui.reciteRaw=text;ui.reciteText=text;ui.reciteGaps=[];delete ui.formDrafts[formDraftKey(form)];await save();renderApp();toast('课文已保存到本班课文库');break}
case'aiMark':{const d=inClass(state.dictations).find(x=>x.id===el.dataset.id);if(!d)break;
  const errs=Object.entries(d.wordErrors||{}).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w,c])=>w+'(错'+c+'人)').join('、');
  if(!errs){toast('暂无错频数据,先登记错词');break}
  toast('AI 分析中(已脱敏)…');
  try{const out=await DesktopAI.chat([{role:'system',content:promptFor('markAnalysis')},{role:'user',content:'三年级上册第'+d.lessonNo+'课听写错频:'+errs+'。参与'+(d.participantCount||0)+'人。'}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['mark:'+d.id]=out;await save();renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiMarkKeep':{const d=inClass(state.dictations).find(x=>x.id===el.dataset.id);if(!d)break;const txt=state.aiCache&&state.aiCache['mark:'+d.id];if(!txt)break;d.measures=(d.measures?d.measures+'\n':'')+'[AI] '+txt;ui.dirty=true;await save();toast('已采纳为讲评措施');renderApp();break}
case'genComments':{const students=inClass(state.students).sort(studentOrder).filter(x=>!reportFor(x.id)?.text);if(!students.length)return toast('本学期每位学生都已有评语');const inputs=students.map(student=>({student,messages:[{role:'system',content:promptFor('reportCard')},{role:'user',content:profileDataSummary(student)}]}));if(!(await approveAI([{role:'user',content:inputs.map(x=>x.messages[1].content).join('\n\n')}])))break;let completed=0;for(const item of inputs){try{const text=await DesktopAI.chat(item.messages,.7,{preview:false});state.reportCards=state.reportCards||{};state.reportCards[reportKey(item.student.id)]={studentId:item.student.id,classId:currentClass().id,term:reportTerm(),text,status:'draft',aiDraftUsed:true,updatedAt:new Date().toISOString()};await save();completed++;toast(`已保存草稿 ${completed}/${inputs.length}`)}catch(error){toast(`已保存 ${completed} 份，其余可重试：${error.message}`);break}}renderApp();break}
case'editComment':{ui.editCommentId=el.dataset.id;renderApp();break}
case'saveCommentDraft':case'saveComment':{const student=inClass(state.students).find(x=>x.id===el.dataset.id);if(!student)break;const form=document.querySelector('form[data-form=commentDraft]'),text=formVal(form,'commentText');if(!text)return toast('请填写评语');state.reportCards=state.reportCards||{};state.reportCards[reportKey(student.id)]={...(reportFor(student.id)||{}),studentId:student.id,classId:currentClass().id,term:reportTerm(),text,status:act==='saveComment'?'reviewed':'draft',reviewedAt:act==='saveComment'?new Date().toISOString():null,updatedAt:new Date().toISOString()};delete ui.formDrafts[formDraftKey(form)];await save();ui.editCommentId=null;renderApp();toast(act==='saveComment'?'评语已审定':'草稿已保存');break}
case'printComments':{const students=inClass(state.students).sort(studentOrder).filter(s=>reportFor(s.id)?.status==='reviewed');if(!students.length)return toast('请先审定至少一条评语');printHTML(printHeader('期末评语 · '+currentClass().name,reportTerm())+students.map(s=>`<section class="print-block"><b>${E(s.no)}号 ${E(s.name)}</b><p>${nl(reportFor(s.id).text)}</p></section>`).join(''));break}
case'comments':ui.view='comments';renderApp();break;
case'downloadRosterTpl':{const rows=['学号,姓名','01,张三','02,李四','03,王小明','04,（示例行可删除）'];const csv='\ufeff'+rows.join(String.fromCharCode(13,10));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='学生名册模板.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);toast('模板已下载,填好后导入');break}
case'newsRefresh':newsFetch(true);break;


case'newsAI':{if(!ui.news.list.length){toast('先刷新拉取新闻');break}toast('AI 摘要生成中…');
  try{const out=await DesktopAI.chat([{role:'system',content:promptFor('newsSummary')},{role:'user',content:ui.news.list.join(';')}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['news:'+ui.news.date]=out;await save();renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'newsAICopy':{const t=state.aiCache&&state.aiCache['news:'+ui.news.date];if(!t)break;try{await navigator.clipboard.writeText(t);toast('已复制')}catch(e){toast('复制失败')}break}
case'openNewsRepo':window.open('https://github.com/vikiboss/60s','_blank');break;
case'annTool':ui.annTool=el.dataset.tool;renderApp();break;
case'annUndo':{const k=annKey();const arr=(state.annotations||[]);for(let i=arr.length-1;i>=0;i--){if(arr[i].key===k){arr.splice(i,1);ui.dirty=true;await save();break}}renderApp();break}
case'editBookLesson':{await editBookLesson();break}
case'adoptLegacyReport':{const old=state.reportArchive?.[Number(el.dataset.index)],student=inClass(state.students).find(x=>x.id===old?.studentId);if(!student)return toast('该历史评语无法匹配本班学生');if(reportFor(student.id)?.text&&!(await uiConfirm('用历史评语覆盖当前学期草稿？')))break;state.reportCards[reportKey(student.id)]={...old,classId:currentClass().id,studentId:student.id,term:reportTerm(),status:'draft',updatedAt:new Date().toISOString()};await save();ui.editCommentId=student.id;renderApp();break}
case'summarizeMarks':{summarizeMarkForm();break}
case'annClearPage':{if(!(await uiConfirm('清空本页当前图层的全部标注？可在历史版本中恢复。',{danger:true})))break;state.annotations=(state.annotations||[]).filter(a=>a.key!==annKey());await save();annRedraw();break}
case'annGo':{const page=Number(document.getElementById('annPageNo')?.value);if(!Number.isInteger(page)||page<1||page>(ui.annPages||1))return toast('请输入有效页码');ui.annPage=page;renderApp();break}
case'annLayer':ui.annLayer=document.getElementById('annLayerSel')?.value||ui.annLayer;renderApp();break;
case'annAnalyze':case'annLesson':{try{const content=await annotationSource(act==='annLesson');const out=await DesktopAI.chat([{role:'system',content:promptFor(act==='annLesson'?'annLesson':'annAnalysis')},{role:'user',content}],.4);state.aiCache=state.aiCache||{};state.aiCache['ann:'+ui.pdfBookId+'|'+ui.annLayer+'|'+ui.annPage]=out;await save();renderApp()}catch(error){toast(error.message)}break}
case'reciteAI':{const ai=state.settings.ai||{};if(!ai.key&&!(await DesktopAI.hasKey())){toast('请先在设置里配置 AI Key');break}const text=(ui.reciteRaw||'').trim();if(!text){toast('先在「录入课文」里粘贴课文');break}toast('AI 正在挖空…');try{const out=await DesktopAI.chat([{role:'system',content:promptFor('reciteGap')},{role:'user',content:text}],0.3);const gaps=[];const rx=/⟦([^⟧]+)⟧/g;let m;const marked=out.replace(rx,()=>{const mm=/⟦([^⟧]+)⟧/.exec(out.slice(rx.lastIndex-1));return m});let out2=out;let idx=0;out2=out.replace(/⟦([^⟧]+)⟧/g,(_,w)=>{gaps.push(w);return '⟦'+(idx++)+'⟧'});ui.reciteText=out2;ui.reciteGaps=gaps;ui.reciteCur=0;ui.reciteHints=0;renderApp();toast('AI 挖空完成:'+gaps.length+' 处')}catch(e){toast('AI 失败:'+e.message)}break}
case'reciteAuto':reciteAutoGaps();break;
case'reciteReset':ui.reciteText=ui.reciteRaw||'';ui.reciteGaps=[];ui.reciteCur=0;renderApp();break;
case'reciteDensity':ui.reciteDensity=el.dataset.d;renderApp();break;
case'recitePrev':if(ui.reciteCur>0){ui.reciteCur--;renderApp()}break;
case'reciteNext':if(ui.reciteCur<ui.reciteGaps.length-1){ui.reciteCur++;renderApp()}break;
case'reciteHintFirst':{ui.reciteCur=Math.min(ui.reciteCur,Math.max(0,ui.reciteGaps.length-1));ui.reciteHints++;toast('首字:「'+(ui.reciteGaps[ui.reciteCur]||'').slice(0,1)+'」');break}
case'reciteHintFull':{ui.reciteHints++;toast('整词:「'+(ui.reciteGaps[ui.reciteCur]||'')+'」');break}
case'reciteSkip':ui.reciteCur=Math.min(ui.reciteCur+1,Math.max(0,ui.reciteGaps.length-1));renderApp();break;
case'reciteSpeak':{if(!ui.reciteRaw?.trim())return toast('请先保存课文');if(!('speechSynthesis'in window))return toast('系统没有朗读功能');const voice=speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));if(!voice)return toast('未找到中文语音，请使用教师朗读');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(ui.reciteRaw);utterance.voice=voice;utterance.rate=.8;speechSynthesis.speak(utterance);break}
case'reciteDone':{const c=currentClass(),student=inClass(state.students).find(x=>x.id===ui.reciteStudent);if(!c||!student)return toast('请先选择本班学生');if(!ui.reciteRaw?.trim())return toast('请先保存本次训练课文');const input=await configureDialog('确认背诵结果',`<p>${E(student.no)}号 ${E(student.name)} · 第 ${E(ui.teachLesson)} 课 · 提示 ${ui.reciteHints||0} 次</p><label class="field">教师判断<select name="result"><option value="practice">完成练习，待复查</option><option value="pass">背诵通过</option></select></label>${area('note','观察备注','',2)}`,'确认归档');if(!input)break;state.reciteLogs=state.reciteLogs||[];state.reciteLogs.push({id:uid(),classId:c.id,studentId:student.id,bookId:c.bookId||'',lessonNo:ui.teachLesson,date:today(),pass:input.result==='pass',hints:ui.reciteHints||0,note:input.note||''});await save();ui.profileStudent=student.id;ui.view='profile';renderApp();toast('训练记录已归档');break}
case'aiSummary':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;toast('AI 生成中(已脱敏)…');try{const out=await DesktopAI.chat([{role:'system',content:promptFor('studentSummary')},{role:'user',content:profileDataSummary(cur)}],0.4);state.aiCache=state.aiCache||{};state.aiCache['summary:'+cur.id]=out;await save();renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiSummaryKeep':{const student=inClass(state.students).find(x=>x.id===ui.profileStudent);if(!student)break;const input=await configureDialog('审定学期小结',area('text','小结草稿',state.aiCache?.['summary:'+student.id]||'',6),'审定归档');if(!input?.text?.trim())break;state.records.push({id:uid(),classId:currentClass().id,studentId:student.id,type:'其他',date:today(),note:input.text.trim(),sensitive:false,source:'AI草稿经教师审定'});delete state.aiCache['summary:'+student.id];await save();renderApp();toast('小结已审定归档');break}
case'printCopybook':{const lesson=sampleLesson();if(!lesson?.chars?.length)return toast('当前教材没有已核生字表，请先使用听写词单打印，不能套用其他教材样例');if(!(await uiConfirm('本课为三上待核样例，已与实际教材核对后再打印。')))break;const rows=lesson.chars.map(x=>`<div class="print-row"><span>${E(x.p)}</span><div>${Array.from({length:6},(_,i)=>`<span class="ptian"><b${i<3?' style="color:#b5b5b5"':''}>${i<3?E(x.c):''}</b></span>`).join('')}</div></div>`).join('');printHTML(printHeader('第 '+lesson.no+' 课 · 描红练习','姓名：____________')+rows);break}
case'printPersonalized':{
  const c=currentClass();if(!c)return toast('先建班级');
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  if(!st.length)return toast('先导入名册');
  toast('正在为 '+st.length+' 名学生生成个性化练习…');
  // 收集每生错词(无 AI 也能跑:错词来自听写批改)
  const per=st.map(s=>{
    const wrong=new Set();
    inBook(state.dictations).forEach(d=>{if(assessedMark(d.studentMarks?.[s.id]))(d.studentMarks[s.id].wrongWords||[]).forEach(w=>wrong.add(w))});
    return {s,words:[...wrong].slice(0,10)};
  });
  const withWords=per.filter(x=>x.words.length);
  if(!withWords.length)return toast('暂无学生错词数据,先批改听写');
  // 纸张:每生一段(拼音来自词库)
  const bank=Object.fromEntries(scopedPinyin());const missing=[...new Set(withWords.flatMap(x=>x.words).filter(w=>!bank[w]))];if(missing.length)return toast('以下错词缺少拼音，请先在对应听写词单补全：'+missing.join('、'));
  const html=withWords.map(({s,words})=>{
    const rows=words.map(w=>{const p=bank[w]||'';return '<div class="print-row"><span></span><span>'+E(p)+'</span><div class="print-lines"></div></div>'}).join('');
    return '<section class="student-print-page">'+printHeader('个性化错词复练',E(c.name)+' · '+E(s.no)+'号')+rows+'</section>';
  }).join('');
  printHTML(html);break}
case'aiParent':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;toast('AI 生成中(已脱敏)…');
  try{const out=await DesktopAI.chat([{role:'system',content:promptFor('parentLetter')},{role:'user',content:profileDataSummary(cur)}],0.5);
  state.aiCache=state.aiCache||{};state.aiCache['parent:'+cur.id]=out;await save();renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiParentCopy':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);const t=state.aiCache&&state.aiCache['parent:'+cur.id];if(!t)break;
  try{await navigator.clipboard.writeText(t);toast('已复制,可直接粘贴给家长')}catch(e){toast('复制失败,请手动选择文本')}break}
case'printProfile':printProfile();break;
case'printTalk':printTalk();break;

case'deleteClass':{const c=state.classes.find(x=>x.id===el.dataset.id);if(!c)break;const id=c.id;state.classes=state.classes.filter(x=>x.id!==id);for(const key of ['students','progress','preps','dictations','assignments','followups','tasks','records','reciteLogs','grades'])state[key]=(state[key]||[]).filter(x=>x.classId!==id);for(const key of ['pointsByClass','seatsByClass'])if(state[key])delete state[key][id];for(const key of ['reciteTexts','reportCards'])if(state[key])for(const k of Object.keys(state[key]))if(state[key][k]?.classId===id||k.startsWith(id+'|'))delete state[key][k];for(const word of state.legacyWrong)if(word.classId===id)word.classId=null;if(state.selectedClassId===id){state.selectedClassId=state.classes[0]?.id||null;clearClassContext();discardDrafts()}await save();renderApp();break}
case'deleteStudent':{const s=inClass(state.students).find(x=>x.id===el.dataset.id);if(!s)break;state.students=state.students.filter(x=>x.id!==s.id);await save();renderApp();break}
case'confirmCsv':{if(!currentClass()||ui.csvClassId!==state.selectedClassId){clearCsvPreview();renderApp();return toast('班级已变化，请为当前班级重新选择名册文件')}const existing=new Set(inClass(state.students).map(x=>x.no));let added=0;for(const x of ui.csvCandidate||[]){if(existing.has(x.no))continue;state.students.push({id:uid(),classId:state.selectedClassId,no:x.no,name:x.name,createdAt:new Date().toISOString()});existing.add(x.no);added++}clearCsvPreview();await save();renderApp();toast(`已导入 ${added} 人`);break}
case'cancelCsv':clearCsvPreview();renderApp();break;
case'exportBackup':exportBackup();break;
case'exportRecovery':await exportRecovery(el.dataset.source);break;
case'retryStorage':await startApp();break;
case'confirmImport':{if(storageRecovery.message&&!storageRecovery.writable)return toast('请先恢复本机存储访问，再导入备份');if(!ui.importCandidate)break;const next=structuredClone(ui.importCandidate);if(!validImport({format:'teacher-workbench-r1',version:1,state:next}))throw Error('备份结构或关联记录无效');if(next.settings?.ai)delete next.settings.ai.key;state=Object.assign(defaultState(),next);migrateScopedBuckets();migrateReports();reconcileBooks();await save();resetRecordContext();if(storageRecovery.message)ui.view='settings';storageRecovery.message='';renderApp();toast('备份恢复完成');break}
case'cancelImport':ui.importCandidate=null;renderApp();break;
case'showLegacy':uiInfo(state.legacyWrong.length?state.legacyWrong.map(x=>`<b>${E(x.word)}</b> <span class="py">${E(x.pinyin)}</span>`).join('<br>'):'没有旧版未归班错词','旧版未归班错词');break;
case'speakWords':speakWords();break;
case'printChars':printChars();break;case'printPinyin':printPinyin();break;case'printBlankDict':printBlankDict();break;case'printPrep':printPrep();break;
case'printDictStudent':printDict(false);break;case'printDictAnswer':printDict(true);break;case'reopenDict':{const r=inBook(state.dictations).find(x=>x.id===el.dataset.id);if(!r)break;ui.teachLesson=String(r.lessonNo);ui.dictWords=r.words.map(x=>({...x,on:true}));ui.activeDictId=r.id;ui.dictForm={title:r.title,date:r.date,participants:r.participantCount,rate:r.rate,times:r.times,gap:r.gap};ui.dictIndex=-1;discardDrafts();switchView('dictation');break}case'printPractice':printPractice(el.dataset.id);break;case'printAssignment':printAssignment(el.dataset.id);break;
}})});

document.addEventListener('submit',async event=>{const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
  {if(form.querySelectorAll&&form.checkValidity){form.querySelectorAll('.field-error').forEach(x=>x.remove());form.querySelectorAll('.invalid').forEach(x=>x.classList.remove('invalid'));
   if(!form.checkValidity()){form.querySelectorAll(':invalid').forEach(el=>{el.classList.add('invalid');const fe=document.createElement('div');fe.className='field-error';fe.textContent='⚠ '+(el.validationMessage||'请检查此字段');(el.closest('.field')||el.parentElement).appendChild(fe)});form.classList.add('shake');setTimeout(()=>form.classList.remove('shake'),380);form.querySelector(':invalid')?.focus();return}}}const kind=form.dataset.form;return stateOperation(async()=>{switch(kind){
case'progress':{const c=currentClass(),no=formVal(form,'lessonNo'),title=formVal(form,'title');if(!c||!no||!title)return toast('课次编号和标题不能为空');if(inBook(state.progress).some(x=>String(x.lessonNo)===no&&String(x.lessonNo)!==String(ui.teachLesson)))return toast('此课次编号已有进度记录');let p=state.progress.find(x=>x.classId===c.id&&(x.bookId||'')===(c.bookId||'')&&String(x.lessonNo)===String(ui.teachLesson));if(!p){p={id:uid(),classId:c.id,bookId:c.bookId||'',lessonNo:no,createdAt:new Date().toISOString()};state.progress.push(p)}else if(String(p.lessonNo)!==no){for(const key of ['preps','dictations','assignments'])for(const related of inBook(state[key]))if(String(related.lessonNo)===String(p.lessonNo))related.lessonNo=no}Object.assign(p,{lessonNo:no,title,planDate:formVal(form,'planDate'),actualDate:formVal(form,'actualDate'),status:formVal(form,'status'),note:formVal(form,'note'),updatedAt:new Date().toISOString()});ui.teachLesson=no;break}
case'prep':{const c=currentClass();if(!c)return;if(!ui.teachLesson)return toast('请先保存课次进度');let p=state.preps.find(x=>x.classId===c.id&&(x.bookId||'')===(c.bookId||'')&&String(x.lessonNo)===String(ui.teachLesson));if(!p){p={id:uid(),classId:c.id,bookId:c.bookId||'',lessonNo:ui.teachLesson,createdAt:new Date().toISOString()};state.preps.push(p)}for(const key of ['goals','focus','activities','materials','reflection'])p[key]=formVal(form,key);p.updatedAt=new Date().toISOString();break}
case'manualTask':{if(!currentClass())return;state.tasks.push({id:uid(),classId:state.selectedClassId,title:formVal(form,'title'),dueDate:formVal(form,'dueDate'),status:'待办',createdAt:new Date().toISOString()});break}
case'manualTaskEdit':{const t=inClass(state.tasks).find(x=>x.id===form.dataset.id),title=formVal(form,'title');if(!t||!title)return toast('请填写待办事项');t.title=title;t.dueDate=formVal(form,'dueDate');t.updatedAt=new Date().toISOString();ui.editingTaskId=null;break}
case'addWord':{const w=formVal(form,'word');if(!w)return;if(ui.dictWords.some(x=>x.w===w))return toast('该词已在词单中，请直接勾选');stopDict();ui.dictIndex=-1;ui.dictWords.push({w,p:formVal(form,'pinyin'),on:true});delete ui.formDrafts[formDraftKey(form)];ui.dirty=true;renderApp();return}
case'dictTask':{const c=currentClass(),words=selectedDictWords();if(!ui.teachLesson)return toast('请先保存课次进度');if(!c||!words.length)return toast('至少选择一个词才能保存');const participants=countVal(form,'participants','参与人数');let r=inBook(state.dictations).find(x=>x.id===ui.activeDictId);if(ui.activeDictId&&!r)return toast('当前听写记录不属于本班或本教材，请重新选择');if(r&&(participants<r.markedCount||Object.values(r.wordErrors||{}).some(n=>n>participants)))return toast('参与人数不能小于已批份数或错词人数，请先在批改页核对');const selectedWords=new Set(words.map(x=>x.w));if(selectedWords.size!==words.length)return toast('词单中有重复词语，请取消重复项后保存');if(r&&(r.markedCount>0||Object.values(r.wordErrors||{}).some(n=>n>0)||Object.keys(r.studentMarks||{}).length)&&(r.words.length!==words.length||r.words.some(x=>!selectedWords.has(x.w))))return toast('本任务已有批改记录，修改词语请新建听写；本任务可调整顺序、拼音和报词设置');stopDict();if(!r){r={id:uid(),classId:c.id,bookId:c.bookId||'',lessonNo:ui.teachLesson,wordErrors:{},studentMarks:{},markedCount:0,summary:'',measures:'',status:'待听写',createdAt:new Date().toISOString()};state.dictations.push(r)}Object.assign(r,{title:formVal(form,'title'),date:formVal(form,'date'),participantCount:participants,words,rate:clamp(formVal(form,'rate'),.4,1.2),times:clamp(formVal(form,'times'),1,3),gap:clamp(formVal(form,'gap'),3,30),updatedAt:new Date().toISOString()});ui.activeDictId=r.id;ui.dictForm={title:r.title,date:r.date,participants:r.participantCount,rate:r.rate,times:r.times,gap:r.gap};break}
case'dictMark':{const r=inBook(state.dictations).find(x=>x.id===form.dataset.id);if(!r)return;const participants=countVal(form,'participants','参与人数'),marked=countVal(form,'marked','已批份数');if(marked>participants)return toast('已批份数不能大于参与人数');r.participantCount=participants;r.markedCount=marked;r.summary=formVal(form,'summary');r.measures=formVal(form,'measures');const errors={};r.words.forEach((x,i)=>{const value=countVal(form,'err_'+i,`“${x.w}”错人数`,marked);if(value)errors[x.w]=value});r.wordErrors=errors;const marks={...(r.studentMarks||{})};for(const s of inClass(state.students)){const status=formVal(form,'stu_status_'+s.id),wrongWords=formVal(form,'stu_words_'+s.id).split(/[、,，\s]+/).filter(Boolean);if(status!=='未录'||wrongWords.length)marks[s.id]={status,wrongWords,studentNo:s.no};else delete marks[s.id]}r.studentMarks=marks;r.status=marked===participants&&participants>0?'已结束':'待批改';r.updatedAt=new Date().toISOString();break}
case'assignmentNew':{const c=currentClass(),content=formVal(form,'content'),participants=countVal(form,'participants','参与人数');if(!c||!content)return toast('请填写作业内容');const r={id:uid(),classId:c.id,bookId:c.bookId||'',date:formVal(form,'date')||today(),lessonNo:formVal(form,'lessonNo'),content,participantCount:participants,markedCount:0,summary:'',issues:[],measures:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.assignments.push(r);ui.markId=r.id;ui.newAssignment=false;break}
case'followupNew':{const c=currentClass(),title=formVal(form,'title'),kind=formVal(form,'kind'),source=ui.newFollowup||{};if(!c||!title)return toast('请填写事项标题');if((source.sourceType||source.sourceId)&&(!['dictation','assignment'].includes(source.sourceType)||!inBook(countSource(source.sourceType)).some(x=>x.id===source.sourceId)))return toast('原记录已变化，请从当前班级和教材的批改记录重新建立复查');const studentIds=followupStudentIds(form);state.followups.push({id:uid(),classId:c.id,bookId:c.bookId||'',sourceType:source.sourceType||'',sourceId:source.sourceId||'',kind,title,dueDate:formVal(form,'dueDate'),status:'待办',studentIds,result:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});ui.newFollowup=null;break}
case'followupResult':{const r=inBook(state.followups).find(x=>x.id===form.dataset.id),title=formVal(form,'title'),result=formVal(form,'result');if(!r||!title)return toast('请填写事项标题');if(r.status==='完成'&&!result)return toast('已完成事项需要填写处理结果');const studentIds=followupStudentIds(form,r.studentIds||[]);Object.assign(r,{title,kind:formVal(form,'kind'),dueDate:formVal(form,'dueDate'),studentIds,result,updatedAt:new Date().toISOString()});ui.editingFollowupId=null;break}
case'assignment':{const r=inBook(state.assignments).find(x=>x.id===form.dataset.id);if(!r)return;const participants=countVal(form,'participants','参与人数'),marked=countVal(form,'marked','已批份数');if(marked>participants)return toast('已批份数不能大于参与人数');const parsedIssues=formVal(form,'issues').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('|');return {tag:i<0?'其他':x.slice(0,i).trim(),text:i<0?x:x.slice(i+1).trim()}});if(parsedIssues.some(x=>!x.text||/（填写[^）]*）/.test(x.text)))return toast('请把模板提示替换为具体错例');r.date=formVal(form,'date');r.lessonNo=formVal(form,'lessonNo');r.content=formVal(form,'content');r.participantCount=participants;r.markedCount=marked;r.summary=formVal(form,'summary');r.issues=parsedIssues;r.measures=formVal(form,'measures');r.updatedAt=new Date().toISOString();break}
case'book':{const publisher=formVal(form,'publisher'),grade=Number(formVal(form,'grade')),term=formVal(form,'term'),editionYear=formVal(form,'editionYear'),title=formVal(form,'title');if(!publisher||!title||!editionYear||grade<1||grade>6)return toast('请完整填写教材元数据');if(bookCatalog().some(x=>x.publisher===publisher&&Number(x.grade)===grade&&x.term===term&&x.editionYear===editionYear))return toast('同出版社、年级、册别、版次的教材已存在');state.customBooks.push({bookId:uid(),publisher,grade,term,editionYear,title,file:'',status:'待导入',createdAt:new Date().toISOString()});ui.bookGrade=String(grade);ui.bookTerm=term;ui.bookPublisher=publisher;break}
case'passLine':{const v=Number(formVal(form,'pass'));state.settings=state.settings||{};state.settings.passLine=(v>=0&&v<=100)?v:60;ui.dirty=true;await save();renderApp();toast('及格线已设为 '+state.settings.passLine);break}
case'class':{const name=formVal(form,'name'),grade=Number(formVal(form,'grade')),term=formVal(form,'term');if(!name||grade<1||grade>6)return toast('请填写班级名称和 1–6 年级');if(Object.keys(ui.formDrafts).some(key=>key!==formDraftKey(form))&&!(await uiConfirm('建立新班级会切换当前班级，并放弃其他未保存表单，继续吗？')))return;const c={id:uid(),name,grade,term,publisher:'待绑定教材',editionYear:'',bookId:'',semesterStart:'',createdAt:new Date().toISOString()};state.classes.push(c);state.selectedClassId=c.id;discardDrafts();clearClassContext();break}
case'classEdit':{const c=currentClass();if(!c)return;const grade=Number(formVal(form,'grade')),term=formVal(form,'term'),bookId=formVal(form,'bookId');if(grade<1||grade>6)return toast('年级应为 1–6');if((grade!==Number(c.grade)||term!==c.term)&&['progress','preps','dictations','assignments','followups'].some(key=>state[key].some(x=>x.classId===c.id)))return toast('本班已有教学记录；更换年级或册别请新建班级，以保留历史');const b=bookCatalog().find(x=>x.bookId===bookId);if(b&&(Number(b.grade)!==grade||b.term!==term))return toast('教材年级和册别与班级不符');const changedBook=c.bookId!==bookId;Object.assign(c,{name:formVal(form,'name'),grade,term,bookId,publisher:b?.publisher||'待绑定教材',editionYear:b?.editionYear||'',semesterStart:formVal(form,'semesterStart')});if(changedBook)clearClassContext();else{clearDictContext();ui.markId=null}break}



case'student':{const c=currentClass(),no=formVal(form,'no'),name=formVal(form,'name');if(!c||!no||!name)return toast('学号和姓名不能为空');if(inClass(state.students).some(x=>x.no===no))return toast('该班学号已存在');state.students.push({id:uid(),classId:c.id,no,name,createdAt:new Date().toISOString()});break}
case'bankEdit':{const c=currentClass();if(!c||c.grade!==3||c.term!=='上册'||c.bookId)return;const parseRows=(text,kind)=>text.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const [value,p]=x.split('|').map(v=>v?.trim()||'');return kind==='char'?{c:value,p}:{w:value,p}});const chars=parseRows(formVal(form,'chars'),'char'),words=parseRows(formVal(form,'words'),'word');if(chars.some(x=>!x.c||!x.p)||words.some(x=>!x.w||!x.p))return toast('每行需要文字和拼音，以 | 分隔');state.bankOverride[ui.teachLesson]={title:formVal(form,'title'),chars,words,conf:'mid'};break}
case'settings':{state.settings.ai={base:formVal(form,'base'),model:formVal(form,'model')};const nk=String(formVal(form,'key')||'').trim();
  if(nk)await DesktopAI.saveKey(nk);ui.aiReady=await DesktopAI.hasKey();break;}
default:return}delete ui.formDrafts[formDraftKey(form)];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();renderApp();toast('已保存')},form)});

function parseCSV(text){text=text.replace(/^\uFEFF/,'');const table=[],row=[];let cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()))table.push(row.splice(0))}else cell+=ch}if(quoted)throw Error('引号未闭合');row.push(cell);if(row.some(x=>x.trim()))table.push(row);if(!table.length)throw Error('CSV 为空');const head=table.shift().map(x=>x.trim());const noIndex=head.findIndex(x=>['学号','编号','no'].includes(x)),nameIndex=head.findIndex(x=>['姓名','名字','name'].includes(x));if(noIndex<0||nameIndex<0)throw Error('表头必须包含“学号,姓名”');const rows=table.map((r,i)=>({no:(r[noIndex]||'').trim(),name:(r[nameIndex]||'').trim(),line:i+2}));if(rows.some(x=>!x.no||!x.name))throw Error('有空学号或姓名');if(rows.length>2000)throw Error('单次最多导入 2000 人');return rows}
function validImport(value){
  if(!value||value.format!=='teacher-workbench-r1'||value.version!==1||!validState(value.state))return false;
  const s=value.state,keys=['classes','students','progress','preps','dictations','assignments','followups','tasks','customBooks','legacyWrong'];
  const record=x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
  const textFields=(x,names)=>names.every(k=>x[k]===undefined||typeof x[k]==='string');
  if(!record(s.settings)||!record(s.bankOverride)||s.legacyPicks!==undefined&&!record(s.legacyPicks))return false;
  if(!textFields(s.settings,['voice'])||s.settings.ai!==undefined&&(!record(s.settings.ai)||!textFields(s.settings.ai,['key','base','model'])))return false;
  for(const entry of Object.values(s.bankOverride)){
    if(!record(entry)||!textFields(entry,['title','conf']))return false;
    for(const [key,wordKey] of [['chars','c'],['words','w']])if(entry[key]!==undefined&&(!Array.isArray(entry[key])||entry[key].some(w=>!record(w)||typeof w[wordKey]!=='string'||typeof w.p!=='string')))return false;
  }
  for(const key of keys){
    if(s[key].some(x=>!record(x)||typeof (key==='customBooks'?x.bookId:x.id)!=='string'||!(key==='customBooks'?x.bookId:x.id).trim()))return false;
    const ids=s[key].map(x=>key==='customBooks'?x.bookId:x.id);
    if(new Set(ids).size!==ids.length)return false;
    if(s[key].some(x=>!textFields(x,['bookId','planDate','actualDate','dueDate','summary','measures','result','sourceId','sourceType','goals','focus','activities','materials','reflection']))||key!=='legacyWrong'&&s[key].some(x=>!textFields(x,['date'])))return false;
  }
  const classIds=new Set(s.classes.map(x=>x.id));
  if(s.selectedClassId!==null&&!classIds.has(s.selectedClassId))return false;
  for(const key of ['students','progress','preps','dictations','assignments','followups','tasks'])if(s[key].some(x=>!classIds.has(x.classId)))return false;
  if(s.classes.some(x=>typeof x.name!=='string'||!Number.isInteger(Number(x.grade))||Number(x.grade)<1||Number(x.grade)>6||!['上册','下册'].includes(x.term)||typeof x.bookId!=='string'))return false;
  if(s.students.some(x=>typeof x.no!=='string'||typeof x.name!=='string'))return false;
  if(s.customBooks.some(x=>typeof x.publisher!=='string'||typeof x.title!=='string'||typeof x.editionYear!=='string'||x.file||!Number.isInteger(Number(x.grade))||Number(x.grade)<1||Number(x.grade)>6||!['上册','下册'].includes(x.term)))return false;
  if(s.dictations.some(x=>typeof x.title!=='string'||!Array.isArray(x.words)||x.words.some(w=>!w||typeof w.w!=='string'||typeof w.p!=='string')))return false;
  if(s.assignments.some(x=>typeof x.content!=='string'||!Array.isArray(x.issues)||x.issues.some(issue=>!issue||typeof issue.tag!=='string'||typeof issue.text!=='string')))return false;
  if(s.followups.some(x=>typeof x.title!=='string'||!['讲评','复查'].includes(x.kind)||!['待办','完成'].includes(x.status)||!Array.isArray(x.studentIds)||x.studentIds.some(id=>typeof id!=='string')))return false;
  if(s.tasks.some(x=>typeof x.title!=='string'||!['待办','完成'].includes(x.status)))return false;
  const studentClass=new Map(s.students.map(x=>[x.id,x.classId]));
  for(const f of s.followups){
    if(f.studentIds.some(id=>studentClass.has(id)&&studentClass.get(id)!==f.classId))return false;
    if(f.sourceType&&!['dictation','assignment'].includes(f.sourceType))return false;
    if(f.sourceId&&!f.sourceType)return false;
    const source=f.sourceType==='dictation'?s.dictations.find(x=>x.id===f.sourceId):f.sourceType==='assignment'?s.assignments.find(x=>x.id===f.sourceId):null;
    if(source&&(source.classId!==f.classId||(source.bookId||'')!==(f.bookId||'')))return false;
  }
  if(s.progress.some(x=>typeof x.lessonNo!=='string'||typeof x.title!=='string'||!['未开始','已上课','已讲评'].includes(x.status)))return false;
  const studentNumbers=s.students.map(x=>`${x.classId}\u0000${x.no}`);
  if(new Set(studentNumbers).size!==studentNumbers.length)return false;
  for(const key of ['dictations','assignments'])if(s[key].some(x=>!Number.isInteger(Number(x.participantCount))||!Number.isInteger(Number(x.markedCount))||Number(x.participantCount)<0||Number(x.markedCount)<0||Number(x.markedCount)>Number(x.participantCount)))return false;
  for(const d of s.dictations){
    if(d.wordErrors!==undefined&&(!record(d.wordErrors)||Object.values(d.wordErrors).some(n=>!Number.isInteger(n)||n<0||n>Number(d.participantCount))))return false;
    if(d.studentMarks!==undefined){
      if(!record(d.studentMarks))return false;
      for(const [id,mark] of Object.entries(d.studentMarks)){
        if(studentClass.has(id)&&studentClass.get(id)!==d.classId)return false;
        if(!record(mark)||!textFields(mark,['status','studentNo'])||!Array.isArray(mark.wrongWords)||mark.wrongWords.some(w=>typeof w!=='string'))return false;
      }
    }
  }
  return extendedStateValid(s);
}
function download(name,content,mime){const blob=content instanceof Blob?content:new Blob([content],{type:mime||'application/octet-stream'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportBackup(){const copy=structuredClone(state);if(copy.settings?.ai)delete copy.settings.ai.key;const payload={format:'teacher-workbench-r1',version:1,exportedAt:new Date().toISOString(),state:copy};download(`小学语文教师工作台-备份-${today()}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');toast('备份已导出；请妥善保管文件')}
async function exportRecovery(source){
  if(!['primary','fallback'].includes(source))return;
  const raw=source==='primary'?storageRecovery.primary:storageRecovery.fallbackRaw;
  if(raw==null)return toast('没有可导出的副本');
  let copy;try{copy=typeof raw==='string'?JSON.parse(raw):structuredClone(raw)}catch{}
  if(validImport({format:'teacher-workbench-r1',version:1,state:copy})){
    if(copy.settings?.ai)copy.settings.ai.key='';
    download(`教学记录-${source}-${today()}.json`,JSON.stringify({format:'teacher-workbench-r1',version:1,exportedAt:new Date().toISOString(),state:copy},null,2),'application/json;charset=utf-8');
  }else if(await uiConfirm('这份故障副本保留原始内容，可能包含 API Key 和学生记录。请仅存到自己管理的文件夹，用于修复。',{ok:'保存故障副本'})){
    download(`教学记录-故障副本-${source}-${today()}.txt`,typeof raw==='string'?raw:JSON.stringify(raw,null,2),'text/plain;charset=utf-8');
  }
}
function speakWords(){const c=currentClass();if(!c||c.grade!==3||c.term!=='上册'||c.bookId)return toast('当前教材尚无词库');const words=bankLessons().find(x=>String(x.no)===String(ui.teachLesson))?.words||[];if(!words.length)return toast('没有词语');if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return toast('系统语音不可用');const voice=speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));if(!voice)return toast('未找到中文语音');let i=0;speechSynthesis.cancel();const next=()=>{if(i>=words.length)return toast('朗读完毕');const utterance=new SpeechSynthesisUtterance(words[i++].w);utterance.voice=voice;utterance.lang='zh-CN';utterance.rate=.7;utterance.onend=()=>setTimeout(next,450);utterance.onerror=()=>toast('朗读失败');speechSynthesis.speak(utterance)};next()}
function printHeader(title,meta,recordDate=today()){const c=currentClass();return `<div class="print-title">${E(title)}</div><div class="print-meta"><span>班级：${E(c?.name||'________')}</span><span>${E(meta||'')}</span><span>日期：${E(recordDate||today())}</span></div>`}
const NB_COLORS=['#3157D4','#AF1D88'];
function enhanceSelects(){window.WorkbenchSelects?.enhance()}
function tintStatusSelects(){let list;try{list=document.querySelectorAll('select')}catch(e){return}if(!list||typeof list.forEach!=='function')return;list.forEach(s=>{if(!s||!s.classList||!s.dataset)return;const paint=()=>{s.classList.remove('st-ok','st-wait','st-rev');const v=s.value;if(v==='已批'||v==='已上课')s.classList.add('st-ok');else if(v==='未交')s.classList.add('st-wait');else if(v==='待复查'||v==='已讲评')s.classList.add('st-rev')};paint();if(!s.dataset.tint){s.dataset.tint='1';if(typeof s.addEventListener==='function')s.addEventListener('change',paint)}})}
const DesktopAI={
async hasKey(){if(window.desktop)return Boolean(await window.desktop.ai.hasKey());const result=await aikeyRequest();return Boolean(result.has)},
async saveKey(key){key=String(key||'').trim();if(!key)return;if(window.desktop)return window.desktop.ai.setKey(key);return aikeyRequest({method:'POST',body:JSON.stringify({key})})},
async chat(messages,temperature,options={}){
  if(options.preview!==false&&!(await approveAI(messages)))throw Error('已取消生成');
  const pending=aiProgress(),ai=state.settings.ai||{},timer=setTimeout(()=>pending.controller.abort(),120000);
  try{if(window.desktop){const result=await window.desktop.ai.chat({base:ai.base||'https://api.deepseek.com',model:ai.model||'deepseek-flash',messages,temperature});if(pending.controller.signal.aborted)throw Error('已取消生成');return result}
    const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','X-Workbench-Token':sqliteToken},body:JSON.stringify({base:ai.base||'https://api.deepseek.com',model:ai.model||'deepseek-flash',messages,temperature:temperature??.5}),signal:pending.controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'AI 请求失败');return data.content;
  }catch(error){if(pending.controller.signal.aborted)throw Error('生成已取消或超时，已保存记录不受影响');throw error}finally{clearTimeout(timer);pending.close()}
}};

document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('invalid')){e.target.classList.remove('invalid');const fe=e.target.parentElement&&e.target.parentElement.querySelector(':scope>.field-error');if(fe)fe.remove()}});
document.addEventListener('pointerdown',e=>{const t=e.target.closest('.btn,.nav button,.tabs button,.pick,.chip,.seat');if(!t||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=t.getBoundingClientRect();const s=Math.max(r.width,r.height)*1.15;const sp=document.createElement('span');sp.className='ripple';sp.style.width=sp.style.height=s+'px';sp.style.left=(e.clientX-r.left-s/2)+'px';sp.style.top=(e.clientY-r.top-s/2)+'px';t.appendChild(sp);setTimeout(()=>sp.remove(),560)});
window.addEventListener('keydown',e=>{
  if(ui.view==='rollcall'&&!e.repeat&&!/input|textarea|select/i.test(e.target.tagName)){
    if(e.code==='Space'){e.preventDefault();rollNext()}
    if(e.code==='Enter'){e.preventDefault();document.querySelector('[data-act=rollMark]')?.click()}
  }
});
function printProfile(){const c=currentClass();if(!c)return;const cur=(state.students||[]).find(x=>x.id===ui.profileStudent);if(!cur)return toast('先选择学生');
  const recs=(state.records||[]).filter(r=>r.studentId===cur.id);
  printHTML(printHeader('学生档案汇总 · '+E(cur.no)+'号','姓名:'+E(cur.name),'')+
  '<div class="print-block"><b>观察记录('+recs.length+'条)</b>'+ (recs.map(r=>`<p>${E(r.date)} · ${E(r.type)}:${E(r.note)}</p>`).join('')||'<p>无</p>')+'</div>')}
function printTalk(){const c=currentClass();if(!c)return;const cur=(state.students||[]).find(x=>x.id===ui.profileStudent);if(!cur)return toast('先选择学生');
  const talks=(state.records||[]).filter(r=>r.studentId===cur.id&&r.type==='谈心谈话');
  printHTML(printHeader('谈心谈话记录表','班级:'+E(c.name),'')+
  '<div class="print-block"><b>学生</b><p>'+E(cur.no)+'号 '+E(cur.name)+'</p></div>'+
  '<div class="print-block"><b>谈话记录</b>'+(talks.map(r=>`<p>${E(r.date)}:${E(r.note)}</p>`).join('')||'<p>____________</p><p>____________</p>')+'</div>'+
  '<div class="print-block"><b>教师签名</b><p>________________</p></div>')}
function annBindCanvas(){
  const canvas=document.getElementById('annCanvas');if(!canvas||canvas.__bound)return;canvas.__bound=1;
  const ink=document.createElement('canvas');ink.style.cssText='position:absolute;inset:0;width:100%;height:100%';ink.className='ink';
  canvas.parentElement.style.position='relative';
  ink.width=canvas.width;ink.height=canvas.height;
  canvas.parentElement.appendChild(ink);
  annLoadPage();
  const pos=e=>{const r=ink.getBoundingClientRect();const vp=canvas.__viewport||{w:1000,h:1400};return {x:(e.clientX-r.left)/r.width*vp.w,y:(e.clientY-r.top)/r.height*vp.h}};
  ink.addEventListener('pointerdown',e=>{if(e.button!==0||operationBusy||!canvas.__viewport)return;ink.setPointerCapture(e.pointerId);ui.annDraw=true;ui.annLive=[pos(e)]});
  ink.addEventListener('pointermove',e=>{if(!ui.annDraw)return;ui.annLive.push(pos(e));annRedraw()});
  const up=async e=>{if(!ui.annDraw)return;ui.annDraw=false;const points=ui.annLive?.slice();ui.annLive=null;
    if(points?.length>1)await stateOperation(async()=>{state.annotations=state.annotations||[];state.annotations.push({id:uid(),key:annKey(),color:ui.annTool,width:ui.annWidth||3,pts:points});await save()});
    annRedraw()};
  ink.addEventListener('pointerup',up);ink.addEventListener('pointercancel',()=>{ui.annDraw=false;ui.annLive=null;annRedraw()});
  // Canvas scales uniformly with its parent; no per-render resize listener is needed.
}
function tzWord(w,p){const ps=(p||'').trim().split(/\s+/);const ok=!!p&&ps.length===w.length&&w.length>0;return '<span class="tzw">'+(ok?'':`<em class="fullpy">${E(p||'')}</em>`)+w.split('').map((ch,i)=>`<i class="tz">${ok?`<em>${E(ps[i])}</em>`:''}<b>${E(ch)}</b></i>`).join('')+'</span>'}
function uiModalShell(inner){
  const previous=document.activeElement,m=document.createElement('div');
  m.className='modal-mask';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
  m.innerHTML=inner;document.body.appendChild(m);enhanceSelects();
  m._restoreFocus=()=>{if(previous?.isConnected&&typeof previous.focus==='function')previous.focus()};
  m.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const items=[...m.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&!x.hidden&&x.tabIndex!==-1&&!x.classList.contains('book-select-native'));
    if(!items.length)return;
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus()}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus()}
  });
  m.querySelector('button')?.focus();
  return m;
}
function uiConfirm(msg,opt={}){
  let legacy=false;try{legacy=(typeof document==='undefined')||!document.createElement||!document.body}catch(e){legacy=true}
  if(legacy)return Promise.resolve(Boolean(confirm(msg)));
  return new Promise(res=>{
    const danger=!!opt.danger;
    const m=uiModalShell(`<div class="modal${danger?' danger':''}"><div class="modal-ic">${danger?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5.5v8.5"/><path d="M12 17.6v.6"/></svg>':'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V7z"/><path d="M9.3 12.2l2 2 3.6-4.2"/></svg>'}</div><h3>${E(opt.title||(danger?'请确认操作':'请确认'))}</h3><p>${E(msg)}</p><div class="mrow"><button type="button" class="btn" data-m="0">取消</button><button type="button" class="btn ${danger?'danger':'primary'}" data-m="1">${E(opt.ok||'确定')}</button></div></div>`);
    const finish=ok=>{m.remove();m._restoreFocus();res(ok)};
    m.addEventListener('click',e=>{const button=e.target.closest('[data-m]');if(button||e.target===m)finish(button?.dataset.m==='1')});
    m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false)}});
  });
}
function uiInfo(html,title='提示'){
  let legacy=false;try{legacy=(typeof document==='undefined')||!document.createElement||!document.body}catch(e){legacy=true}
  if(legacy){alert(String(html).replace(/<[^>]+>/g,'\n'));return}
  const m=uiModalShell(`<div class="modal"><h3>${E(title)}</h3><div class="modal-body">${html}</div><div class="mrow"><button type="button" class="btn primary" data-m="1">知道了</button></div></div>`);
  const finish=()=>{m.remove();m._restoreFocus()};
  m.addEventListener('click',e=>{if(e.target.closest('[data-m]')||e.target===m)finish()});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish()}});
}
function printHTML(body){
  if(!document.createElement||!document.body){document.querySelector('#printSheet').innerHTML=`<div class="print-paper">${body}</div>`;requestAnimationFrame(()=>window.print());return}
  const modal=uiModalShell(`<section class="preview"><div class="desk"><div class="a4paper"><div class="print-paper">${body}</div></div></div><p class="small">A4 内容预览；最终分页请在系统打印或导出的 PDF 中核对。</p><div class="mrow pactions"><button class="btn" data-print="close">关闭</button>${window.desktop?'<button class="btn" data-print="pdf">导出 PDF</button>':''}<button class="btn primary" data-print="run">打印</button></div></section>`);
  const close=()=>{modal.remove();modal._restoreFocus()};
  modal.addEventListener('click',async event=>{const button=event.target.closest('[data-print]');if(!button)return;if(button.dataset.print==='close'){close();return}button.disabled=true;
    try{if(window.desktop){const html=printDocumentHTML(body);if(button.dataset.print==='pdf'){const bytes=await window.desktop.print.toPDF(html);download('教学打印-'+today()+'.pdf',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}))}else await window.desktop.print.run(html)}else{document.querySelector('#printSheet').innerHTML=`<div class="print-paper">${body}</div>`;window.print()}}
    catch(error){toast('打印失败：'+error.message)}finally{button.disabled=false}
  });modal.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
}
function printChars(){const c=currentClass(),l=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));if(!c||c.grade!==3||c.term!=='上册'||c.bookId||!l?.chars?.length)return toast('当前课次无可打印生字');printHTML(printHeader(`第${l.no}课 生字表`,l.title)+`<div class="print-grid">${l.chars.map(x=>`<div class="print-cell"><small>${E(x.p)}</small><br><b style="font-size:20pt">${E(x.c)}</b></div>`).join('')}</div><p>本页为样例词库，请与实际教材核对。</p>`)}
function printPinyin(){const c=currentClass(),l=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));if(!c||c.grade!==3||c.term!=='上册'||c.bookId||!l?.words?.length)return toast('当前课次无可打印词语');if(l.words.some(x=>!x.p))return toast('有词语缺少拼音，先到词库编辑补全');printHTML(printHeader(`第${l.no}课 看拼音写词语`,`姓名：____________`)+l.words.map((x,i)=>`<div class="print-row"><span>${i+1}.</span><span>${E(x.p)}</span><div class="print-lines"></div></div>`).join(''))}
function printBlankDict(){printHTML(printHeader('听写纸','姓名：____________')+Array.from({length:30},(_,i)=>`<div class="print-row"><span>${i+1}.</span><span></span><div class="print-lines"></div></div>`).join(''))}
function printPrep(){const c=currentClass(),p=state.preps.find(x=>x.classId===c?.id&&(x.bookId||'')===(c?.bookId||'')&&String(x.lessonNo)===String(ui.teachLesson));if(!p)return toast('先保存本课备课记录');const parts=[['教学目标',p.goals],['重难点',p.focus],['活动顺序',p.activities],['板书与材料',p.materials],['课后反思',p.reflection]];printHTML(printHeader(`第${E(p.lessonNo)}课 备课摘要`,c?.publisher||'')+parts.map(([label,value])=>`<div class="print-block"><b>${label}</b><div>${nl(value)||'—'}</div></div>`).join(''))}
function printDict(answer){const words=selectedDictWords();if(!words.length)return toast('先勾选听写词语');if(!answer&&words.some(x=>!x.p))return toast('有词语没有拼音，学生纸请先补全拼音');const title=`第${E(ui.teachLesson)}课 ${answer?'教师答案':'看拼音写词语'}`;const rows=words.map((x,i)=>`<div class="print-row"><span>${i+1}.</span><span>${answer?`${E(x.w)} · ${E(x.p)}`:E(x.p)}</span><div class="print-lines"></div></div>`).join('');const date=inBook(state.dictations).find(x=>x.id===ui.activeDictId)?.date||today();printHTML(printHeader(title,'姓名：____________',date)+rows)}
function printPractice(id){const r=inBook(state.dictations).find(x=>x.id===id);if(!r)return;const words=r.words.filter(x=>(r.wordErrors?.[x.w]||0)>0).sort((a,b)=>(r.wordErrors[b.w]||0)-(r.wordErrors[a.w]||0));if(!words.length)return toast('请先记录至少一个共性错词');if(words.some(x=>!x.p))return toast('有错词缺拼音，无法制作不泄题的学生纸');printHTML(printHeader(`第${E(r.lessonNo)}课 错词复练单`,'姓名：____________',r.date)+words.map((x,i)=>`<div class="print-row"><span>${i+1}.</span><span>${E(x.p)}</span><div class="print-lines"></div></div>`).join(''))}
function printAssignment(id){const r=inBook(state.assignments).find(x=>x.id===id);if(!r)return;printHTML(printHeader('作业批改记录',`第${r.lessonNo||'—'}课`,r.date)+`<div class="print-block"><b>作业内容</b>${E(r.content)}</div><div class="print-block"><b>批改情况</b>已批 ${r.markedCount} / 参与 ${r.participantCount}</div><div class="print-block"><b>全班情况</b>${nl(r.summary)||'—'}</div><div class="print-block"><b>典型错例</b>${(r.issues||[]).map(x=>`<p>${E(x.tag)}：${E(x.text)}</p>`).join('')||'—'}</div><div class="print-block"><b>处理措施</b>${nl(r.measures)||'—'}</div>`)}

async function startApp(){try{await loadState();resetRecordContext();if(state.legacyLessonNo)ui.teachLesson=String(state.legacyLessonNo);const fromHash=location.hash.slice(1);if(NAV.some(x=>x[0]===parentView(fromHash))&&fromHash!=='pdf')ui.view=fromHash;else if(fromHash==='pdf')ui.view='resources';renderApp();startClockTicker();if(ui.view==='news')newsFetch(false);if(storageMode!=='SQLite')throw Error('存储配置错误')}catch(e){storageRecovery.message=e.message;ui.importCandidate=null;renderRecovery();console.error(e)}}
window.addEventListener('beforeunload',event=>{stopDict();if(ui.dirty||operationBusy){event.preventDefault();event.returnValue=''}});
window.addEventListener('hashchange',()=>{if(storageRecovery.message||operationBusy)return;const view=location.hash.slice(1);if(view&&view!==ui.view&&NAV.some(x=>x[0]===view))switchView(view)});
startApp();
