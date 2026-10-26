// Source-level review probes: synthetic fixtures only, no browser or network.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../app/src/app.js'), 'utf8');
const results = {};
function fn(name) {
  const start = source.search(new RegExp('^(?:async )?function '+name+'\\(', 'm'));
  if(start < 0) throw new Error('Missing function '+name);
  const tail = source.slice(start);
  const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next < 0 ? tail : tail.slice(0, next+1);
}
function context(values={}) { return vm.createContext({ E:String, A:String, heading:()=>'', btn:()=>'', field:()=>'', ...values }); }
function action(name) {
  const start = source.indexOf("case'"+name+"':");
  if(start<0) throw new Error('Missing action '+name);
  const end = source.indexOf('\ncase', start+1);
  return 'async function invoke(){switch("'+name+'") {'+source.slice(start,end)+'}};invoke()';
}
(async()=>{
  const go = source.split('\n').find(l=>l.startsWith("case'goRoll':"));
  const c = context({ui:{view:'classroom'},renderApp:()=>{}});
  vm.runInContext('switch("goRoll"){'+go+'}',c);
  results.rollcallButtonDestination = c.ui.view;

  const progress = [{id:'p1',classId:'c1',lessonNo:'1',title:'Synthetic lesson',planDate:'2026-10-25T09:00',status:'未开始'}];
  const d = context({state:{progress,dictations:[],assignments:[],followups:[],tasks:[]},currentClass:()=>({id:'c1'}),today:()=> '2026-10-25',inBook:x=>x,inClass:x=>x});
  vm.runInContext(fn('derived')+fn('weekOverview'),d);
  results.todaysPlannedLessonCount = vm.runInContext('derived().teach',d);
  results.weekViewTreatsTimedLessonAsUnscheduled = vm.runInContext('weekOverview()',d).includes('保存课次的计划日期后');

  let draws=0;
  const ink={getContext:()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){draws++}})};
  const canvas={querySelector:()=>null,parentElement:{querySelector:()=>ink}};
  const a=context({document:{getElementById:()=>canvas},ui:{annLive:null},annPageStrokes:()=>[{color:'blue',pts:[{x:0,y:0},{x:10,y:10}]}]});
  vm.runInContext(fn('annRedraw')+'annRedraw()',a);
  results.annotationStrokesDrawnWithSiblingLayer = draws;

  const g=context({state:{settings:{},aiCache:{},students:[{id:'s1',no:'01',name:'Synthetic student'}],grades:[{id:'new',name:'New',date:'2026-10-25',scores:[{studentId:'s1',score:'80'}]},{id:'old',name:'Old',date:'2026-10-24',scores:[{studentId:'s1',score:''}]}]},ui:{gradeSel:'new',gradeDetail:'new'},currentClass:()=>({id:'c1'}),inClass:x=>x,passLine:()=>60});
  vm.runInContext(fn('gradeStats')+fn('renderGrades'),g);
  results.blankPreviousGradeCreatesFalseIncrease = vm.runInContext('renderGrades()',g).includes('+80');
  g.state.grades=[];
  try{vm.runInContext('renderGrades()',g);results.gradeDetailAfterSwitchToEmptyClassError=null}
  catch(e){results.gradeDetailAfterSwitchToEmptyClassError=e.message}

  let saved=0;
  const r=context({state:{reciteLogs:[]},ui:{profileStudent:null,reciteHints:0,reciteGaps:['sample']},currentClass:()=>({id:'c1'}),save:async()=>{saved++},toast:()=>{},renderApp:()=>{},uid:()=> 'log1',today:()=> '2026-10-25'});
  await vm.runInContext(action('reciteDone'),r);
  results.reciteWithoutStudentSavedCount=saved;
  r.ui.profileStudent='student-from-other-class';
  await vm.runInContext(action('reciteDone'),r);
  results.reciteAcceptsStaleStudentId=r.state.reciteLogs.some(x=>x.classId==='c1'&&x.studentId==='student-from-other-class');

  const fields={note:{value:'Synthetic ordinary note'},type:{value:'闪光点'},date:{value:'2026-10-25'},sensitive:{value:'on',checked:false}};
  const form={dataset:{id:'s1'},elements:{namedItem:n=>fields[n]},querySelectorAll:()=>[]};
  const rec=context({state:{records:[]},ui:{formDrafts:{}},document:{querySelector:()=>form},currentClass:()=>({id:'c1'}),formDraftKey:()=> 'record|s1',save:async()=>{},toast:()=>{},renderApp:()=>{},uid:()=> 'r1',today:()=> '2026-10-25'});
  await vm.runInContext(action('saveRecordBtn'),rec);
  results.uncheckedSensitiveBoxSavedAsSensitive=rec.state.records[0].sensitive;

  const comments=context({state:{students:[{id:'s1',no:'01',name:'Synthetic student'}],reportCards:{s1:{text:'Unreviewed synthetic AI draft',aiDraftUsed:true}}},ui:{},currentClass:()=>({id:'c1'}),inClass:x=>x});
  vm.runInContext(fn('renderComments'),comments);
  results.unreviewedAIDraftCountedAsApproved=vm.runInContext('renderComments()',comments).includes('已审定 1/1');

  let print='';
  const p=context({ui:{teachLesson:'1'},bankLessons:()=>[{no:1,chars:[{c:'样',p:'yàng'}]}],printHeader:()=>'',printHTML:html=>{print=html},toast:()=>{}});
  await vm.runInContext(action('printCopybook'),p);
  results.copybookUsesUnscopedSampleBank=print.includes('样');
  results.unwiredButtons=['printDuty','promptsSave'].filter(n=>!source.includes("case'"+n+"':")&&!source.includes("act === '"+n+"'"));
  results.ttsDefinitionFound=/\b(?:const|let|var|class)\s+TTS\b/.test(source);
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
