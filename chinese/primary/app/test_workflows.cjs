const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'src/reliability.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'src/app.js'),'utf8').split("window.addEventListener('beforeunload'")[0];
const listeners={},errors=[],nodes={};
const app={innerHTML:'',setAttribute(){},focus(){}};
class FormDataMock{constructor(form){this.form=form}get(key){const c=this.form.elements?.namedItem(key);return c?c.type==='checkbox'?(c.checked?c.value:null):c.value:this.form.values?.[key]??null}entries(){return Object.entries(this.form.values||{})}}
const ctx=vm.createContext({
  window:{BANK:JSON.parse(fs.readFileSync(path.join(__dirname,'bank.json'),'utf8')),TEXTBOOKS:[],addEventListener(){},print(){}},
  document:{addEventListener(type,fn){(listeners[type]??=[]).push(fn)},querySelector(sel){return nodes[sel]||app},querySelectorAll(){return []},getElementById(id){return nodes['#'+id]}},
  console:{...console,error(e){errors.push(e)}},location:{hash:'',protocol:'http:',href:'http://127.0.0.1/'},
  crypto:require('node:crypto').webcrypto,structuredClone,AbortController,URL,Blob,FormData:FormDataMock,
  setTimeout,clearTimeout,requestAnimationFrame:f=>f(),confirm:()=>true,
  localStorage:{length:0,getItem:()=>null},
});
vm.runInContext(source,ctx);
const run=code=>vm.runInContext(code,ctx);
run(`state=defaultState();state.classes=[{id:'c1',name:'甲班',grade:3,term:'上册',bookId:''},{id:'c2',name:'乙班',grade:1,term:'上册',bookId:'b2'}];state.selectedClassId='c1';state.students=[{id:'s1',classId:'c1',no:'01',name:'甲一'},{id:'s2',classId:'c2',no:'01',name:'乙一'}];ui.aiReady=true;globalThis.renders=0;globalThis.saved=null;globalThis.message='';globalThis.dialogResult=null;globalThis.capturedPrint='';globalThis.realRenderGrades=renderGrades;globalThis.realRenderComments=renderComments;renderApp=()=>{renders++};toast=text=>{message=text};save=async()=>{saved=structuredClone(state)};uiConfirm=async()=>true;configureDialog=async()=>dialogResult;printHTML=html=>{capturedPrint=html};`);
async function click(act,data={}){
  const el={dataset:{act,...data},closest(){return null}};
  for(const fn of listeners.click||[])await fn({target:{closest:()=>el}});
  assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
}
function form(values,dataset={}){const controls=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,typeof value==='object'?value:{value}]));return {dataset,values,elements:{namedItem:n=>controls[n]},querySelectorAll:()=>[],querySelector:()=>null}}
(async()=>{
  await click('goRoll');assert.equal(run('ui.view'),'rollcall');
  await click('rollSkip');assert.equal(run('ui.rollCurrent.id'),'s1');
  run("ui.rollMode='norepeat'");await click('rollSkip');assert.match(run('message'),/新一轮/);await click('rollReset');assert.equal(run('ui.rollPicked.length'),0);
  run("state.progress=[{id:'p1',classId:'c1',bookId:'',lessonNo:'1',title:'计划课',planDate:today()+'T09:00',status:'未开始'}]");
  assert.equal(run('derived().teach'),1);assert.match(run('weekOverview()'),/计划课/);
  assert.equal(run("gradeStats([{score:'100'},{score:''}]).avg"),100);
  assert.equal(run("gradeStats([{score:'100'},{score:'0'}]).avg"),50);
  run("state.grades=[{id:'g1',classId:'c1',name:'本次',date:'2026-10-25',scores:[{studentId:'s1',score:'80'}]},{id:'g0',classId:'c1',name:'上次',date:'2026-10-24',scores:[{studentId:'s1',score:''}]}];ui.gradeSel='g1';ui.gradeDetail='g1'");
  assert.ok(!run('realRenderGrades()').includes('+80'));
  await click('switchClass',{id:'c2'});assert.equal(run('ui.gradeDetail'),null);assert.doesNotThrow(()=>run('realRenderGrades()'));
  await click('switchClass',{id:'c1'});
  await click('goRecite');assert.equal(run('ui.view'),'recite');
  await click('reciteDone');assert.match(run('message'),/选择本班学生/);assert.equal(run('state.reciteLogs.length'),0);
  run("ui.reciteStudent='s2';ui.reciteRaw='课文'");await click('reciteDone');assert.equal(run('state.reciteLogs.length'),0);
  run("ui.reciteStudent='s1';dialogResult={result:'practice',note:'待复查'}");await click('reciteDone');assert.equal(run('state.reciteLogs[0].pass'),false);
  nodes['form[data-form=recite]']=form({reciteText:'保存的原文'},{form:'recite'});await click('reciteSave');run("ui.reciteRaw='';restoreReciteText()");assert.equal(run('ui.reciteRaw'),'保存的原文');
  nodes['form[data-form=record]']=form({note:'普通观察',type:'闪光点',date:'2026-10-25',sensitive:{type:'checkbox',value:'on',checked:false}},{form:'record',id:'s1'});
  await click('saveRecordBtn');assert.equal(run('state.records[0].sensitive'),false);
  const base=run("profileDataSummary(state.students[0])");run("state.records.push({id:'secret',classId:'c1',studentId:'s1',date:'2026-10-25',type:'需关注',note:'私密合成记录',sensitive:true})");assert.equal(run('profileDataSummary(state.students[0])'),base);
  run("state.dictations=[{id:'d1',classId:'c1',bookId:'',words:[],studentMarks:{s1:{status:'未交',wrongWords:[]}}}]");assert.match(run('profileDataSummary(state.students[0])'),/听写记录 0 次/);
  run("state.reportCards[reportKey('s1')]={studentId:'s1',text:'草稿',status:'draft'}");assert.match(run('realRenderComments()'),/已审定 0\/1/);await click('printComments');assert.match(run('message'),/先审定/);
  nodes['form[data-form=commentDraft]']=form({commentText:'教师审阅后的评语'},{form:'commentDraft',id:'s1'});await click('saveComment',{id:'s1'});assert.equal(run("reportFor('s1').status"),'reviewed');await click('printComments');assert.match(run('capturedPrint'),/教师审阅后的评语/);
  nodes['form[data-form=prompts]']=form({p_markAnalysis:'自定义测试提示词'},{form:'prompts'});await click('promptsSave');assert.equal(run('state.settings.prompts.markAnalysis'),'自定义测试提示词');
  run("dialogResult={tasks:'教室、走廊',week:'第1周'}");await click('printDuty');assert.match(run('capturedPrint'),/卫生值日表/);
  run("state.selectedClassId='c2';capturedPrint=''");await click('printCopybook');assert.equal(run('capturedPrint'),'');assert.match(run('message'),/当前教材/);
  run("state.selectedClassId='c1';state.pointsByClass={};state.seatsByClass={}");await click('pointPlus',{id:'s1'});await click('switchClass',{id:'c2'});assert.equal(run('classPoints().s2||0'),0);assert.deepEqual(JSON.parse(run('JSON.stringify(classSeats())')),['s2']);
  // Actual drawing calls, including DPR transform, instead of testing source strings.
  let lines=0;const context={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){lines++}};
  nodes['#annCanvas']={__dpr:2,parentElement:{querySelector:()=>({width:200,height:200,getContext:()=>context})}};
  run("ui.pdfBookId='book';ui.annLayer='备课';ui.annPage=1;state.annotations=[{id:'ink1',key:annKey(),color:'blue',pts:[{x:1,y:1},{x:2,y:2}]}];annRedraw()");assert.equal(lines,1);
  const valid=run('defaultState()');ctx.invalid={...valid,grades:[{id:'g',name:'bad',date:'2026-10-25',scores:[{studentId:'s',score:'250'}]}]};assert.equal(run("validImport({format:'teacher-workbench-r1',version:1,state:invalid})"),false);
  run("state.selectedClassId='c1';state.reportCards={s1:{text:'旧版评语'}};migrateReports()");assert.match(run('renderReportArchive()'),/旧版评语/);await click('adoptLegacyReport',{index:'0'});assert.equal(run("reportFor('s1').status"),'draft');
  assert.match(run("tzWord('春天','chūn tiān')"),/chūn/);assert.match(run("tzWord('春天','chūn tiān')"),/tiān/);
  run("state.dictations=[{id:'summary',classId:'c1',bookId:'',words:[{w:'春天',p:'chūn tiān'}]}]");
  const marking=form({participants:'1',marked:'0',err_0:'0',stu_status_s1:'已批',stu_words_s1:'春天'},{id:'summary'});nodes['form[data-form="dictMark"]']=marking;
  run('summarizeMarkForm()');assert.equal(marking.elements.namedItem('marked').value,'1');assert.equal(marking.elements.namedItem('err_0').value,'1');
  run("ui.countdownEnd=Date.now()+60000");const timer=run('ui.countdownEnd');await click('clockStart');assert.equal(run('ui.countdownEnd'),timer);
  // Grade UX: missing/absent/zero stay distinct, edits remain drafts until save.
  assert.equal(run("gradeEntryState({score:'0'}).value"),0);
  assert.equal(run("gradeEntryState({score:'90',absent:true}).label"),'缺考');
  assert.equal(run("gradeEntryState({score:''}).label"),'未录入');
  assert.equal(run("gradeEntryState({score:'120'}).label"),'分数无效');
  run("state.selectedClassId='c1';state.grades=[{id:'ux-grade',classId:'c1',name:'期中测评',date:'2026-10-26',scores:[{studentId:'s1',score:'80'}]}];ui.gradeSel='ux-grade';ui.gradeDetail='ux-grade';ui.gradeDrafts={};ui.dirty=false");
  const editScore={value:'92',dataset:{grade:'ux-grade',sid:'s1'}},absentBox={checked:false};
  const gradeRow={querySelector:selector=>selector.includes('gradeAbsent')?absentBox:editScore};editScore.closest=()=>gradeRow;ctx.gradeTestInput=editScore;
  run('captureGradeDraft(gradeTestInput)');assert.equal(run('state.grades[0].scores[0].score'),'80');assert.equal(run("ui.gradeDrafts['ux-grade'].s1.score"),'92');
  const editingHTML=run('realRenderGrades()');assert.match(editingHTML,/value="92"/);assert.match(editingHTML,/有修改待保存/);assert.match(editingHTML,/aria-label="01号 甲一的分数"/);
  run('discardDrafts()');assert.match(run('realRenderGrades()'),/value="80"/);assert.equal(run('ui.dirty'),false);
  run("state.grades[0].scores=[]");await click('printGradeSheet');assert.match(run('capturedPrint'),/甲一/);
  // Settings controls preserve independent drafts and validate classroom duration.
  const widgetsForm=form({marquee:'今天的课堂',clockOn:{type:'checkbox',value:'on',checked:true},countdown:'25'},{form:'widgets'});nodes['form[data-form=widgets]']=widgetsForm;
  run("ui.formDrafts={'widgets|':{},'settings|':{model:'unsaved-model'}}");await click('widgetSave');assert.equal(run('state.widgets.clock.countdownMin'),25);assert.equal(run("ui.formDrafts['settings|'].model"),'unsaved-model');
  widgetsForm.elements.namedItem('countdown').value='0';await click('widgetSave');assert.equal(run('state.widgets.clock.countdownMin'),25);assert.match(run('message'),/1–180/);
  await click('aiTest');assert.match(run('message'),/先保存 AI 配置/);
  console.log('Workflow regression passed: classroom, dates, grades, class isolation, recitation, records, privacy, review, printing, prompts, annotations and invalid imports.');
})().catch(error=>{console.error(error);process.exitCode=1});
