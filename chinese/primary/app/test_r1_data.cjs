const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = __dirname;
const code = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8').split("window.addEventListener('beforeunload'")[0];
const bank = JSON.parse(fs.readFileSync(path.join(root, 'bank.json'), 'utf8'));
const data = new Map();
const appNode = { innerHTML: '', focus() {} };
const printNode = { innerHTML: '' };
const toastNode = { textContent: '', classList: { add() {}, remove() {} } };
const listeners = {};
const renderedForms = [];
class FakeFormData {
  constructor(form) { this.values = form.values; }
  get(key) { return this.values[key] ?? null; }
  entries() { return Object.entries(this.values); }
}
const context = vm.createContext({
  window: { BANK: bank, TEXTBOOKS: [], print() {}, addEventListener() {} },
  document: { addEventListener(type, listener) { listeners[type] = listener; }, querySelector(selector) { return selector === '#printSheet' ? printNode : selector === '#toast' ? toastNode : appNode; }, querySelectorAll() { return renderedForms; } },
  localStorage: {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i]; },
    getItem(k) { return data.get(k) ?? null; },
    setItem(k, v) { data.set(k, v); },
  },
  crypto: require('node:crypto').webcrypto,
  structuredClone,
  AbortController,
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(fn) { fn(); },
  location: { hash: '', protocol: 'http:', href: 'http://127.0.0.1:8765/' },
  URL,
  Blob,
  FormData: FakeFormData,
  confirm() { return true; },
  prompt() { throw new Error('核心流程不应使用浏览器 prompt'); },
  alert() {},
});
let revision = 0;
context.persistState = value => data.set('wb_r1_state', JSON.stringify(value));
context.fetch = async (url, options = {}) => {
  if (url === '/api/session') return { ok: true, json: async () => ({ token: 'test-token', storage: 'SQLite', app: 'primary-chinese-workbench' }) };
  try {
    const body = JSON.parse(options.body);
    context.persistState(body.state);
    return { ok: true, json: async () => ({ revision: ++revision, storage: 'SQLite' }) };
  } catch (e) { return { ok: false, status: 503, json: async () => ({ error: e.message }) }; }
};
vm.runInContext(code, context);
const run = source => vm.runInContext(source, context);

data.set('wb_classes', JSON.stringify(['三(1)班', '三(2)班']));
data.set('wb_cls', JSON.stringify('三(2)班'));
data.set('wb_wrong', JSON.stringify([{ w: '认真', p: 'rèn zhēn', ts: 1 }]));
run('state=migrateLegacy()');
assert.equal(run('state.classes.length'), 2);
assert.equal(run('currentClass().name'), '三(2)班');
assert.equal(run('state.legacyWrong[0].classId'), null);
assert.equal(run('inClass(state.legacyWrong).length'), 0);
run('state.legacyWrong[0].classId=state.selectedClassId');
assert.equal(run('inClass(state.legacyWrong).length'), 1);
run('state.legacyWrong[0].classId=null');

run(`state.students=Array.from({length:50},(_,i)=>({id:'s'+i,classId:state.selectedClassId,no:String(i+1).padStart(2,'0'),name:'学生'+i}))`);
run(`state.assignments.push({id:'a1',classId:state.selectedClassId,content:'练习',date:today(),participantCount:50,markedCount:40,issues:[]})`);
run(`state.assignments.push({id:'a2',classId:state.classes[0].id,content:'别班作业',date:today(),participantCount:50,markedCount:0,issues:[]})`);
assert.equal(run('derived().mark'), 1);
assert.equal(run('inClass(state.students).length'), 50);
run('state.selectedClassId=state.classes[0].id');
assert.equal(run('derived().mark'), 1);
assert.equal(run('inClass(state.students).length'), 0);

assert.equal(run(`parseCSV('学号,姓名\\n01,"张,三"\\n02,李四').length`), 2);
assert.equal(run(`parseCSV('学号,姓名\\n01,"张,三"')[0].name`), '张,三');
assert.throws(() => run(`parseCSV('学号,姓名\\n01,')`), /空学号或姓名/);

run('state.selectedClassId=state.classes[1].id');
run(`state.dictations=[{id:'d1',classId:state.selectedClassId,lessonNo:'4',title:'第4课听写',date:today(),words:[{w:'认真',p:'rèn zhēn'},{w:'成绩',p:'chéng jì'}],wordErrors:{'认真':2,'成绩':1},participantCount:50,markedCount:40}]`);
run(`printPractice('d1')`);
assert.match(printNode.innerHTML, /rèn zhēn/);
assert.doesNotMatch(printNode.innerHTML, /认真|成绩/);
run(`ui.dictWords=[{w:'认真',p:'rèn zhēn',on:true}];ui.teachLesson='4';printDict(false)`);
assert.doesNotMatch(printNode.innerHTML, /认真/);

for (const view of ['home', 'teaching', 'dictation', 'marking', 'resources', 'classes', 'settings']) {
  run(`ui.view='${view}';renderApp()`);
  assert.match(appNode.innerHTML, /语文工作台/);
}

async function submit(kind, values, id = '') {
  const form = { dataset: { form: kind, id }, values };
  await listeners.submit({ target: { closest() { return form; } }, preventDefault() {} });
}
async function click(act, dataset = {}) {
  const element = { dataset: { act, ...dataset } };
  await listeners.click({ target: { closest() { return element; } } });
}
(async () => {
  run(`state.tasks.push({id:'task-other',classId:state.classes[0].id,title:'别班待办',status:'待办'});state.followups.push({id:'followup-other',classId:state.classes[0].id,bookId:'',title:'别班复查',kind:'复查',status:'待办',result:'已核',studentIds:[]});state.dictations.push({id:'dict-other',classId:state.classes[0].id,bookId:'',title:'别班听写',words:[],participantCount:1,markedCount:0});state.students.push({id:'student-other',classId:state.classes[0].id,no:'99',name:'别班学生'})`);
  await click('toggleTask', { id: 'task-other' });
  await click('toggleFollowup', { id: 'followup-other' });
  await click('deleteStudent', { id: 'student-other' });
  await click('newFollowup', { sourceType: 'assignment', sourceId: 'a2' });
  assert.equal(run('ui.newFollowup'), null);
  printNode.innerHTML = '打印区未变';
  run(`printAssignment('a2')`);
  assert.equal(printNode.innerHTML, '打印区未变');
  await submit('dictMark', { participants: '1', marked: '1', summary: '越班写入' }, 'dict-other');
  await submit('assignment', { participants: '50', marked: '1', issues: '', content: '越班写入', date: '2026-10-23', lessonNo: '4' }, 'a2');
  assert.equal(run(`state.tasks.find(x=>x.id==='task-other').status`), '待办');
  assert.equal(run(`state.followups.find(x=>x.id==='followup-other').status`), '待办');
  assert.equal(run(`state.students.some(x=>x.id==='student-other')`), true);
  assert.equal(run(`state.dictations.find(x=>x.id==='dict-other').markedCount`), 0);
  assert.equal(run(`state.assignments.find(x=>x.id==='a2').content`), '别班作业');
  assert.equal(run(`sourceTitle('assignment','a2')`), '原记录已删除');
  run(`state.tasks=state.tasks.filter(x=>x.id!=='task-other');state.followups=state.followups.filter(x=>x.id!=='followup-other');state.dictations=state.dictations.filter(x=>x.id!=='dict-other');state.students=state.students.filter(x=>x.id!=='student-other')`);
  await submit('progress', { lessonNo: '4', title: '测试课', planDate: '2026-10-23', actualDate: '', status: '未开始', note: '班级计划' });
  assert.equal(run('inClass(state.progress).find(x=>x.lessonNo==="4").title'), '测试课');
  const draftControl = { value: '' };
  const draftForm = { dataset: { form: 'prep', id: '' }, values: { goals: '尚未保存的备课目标' }, elements: { namedItem(name) { return name === 'goals' ? draftControl : null; } } };
  renderedForms.push(draftForm);
  context.draftForm = draftForm;
  run('captureFormDraft(draftForm)');
  context.confirm = () => false;
  const viewBeforeCancel = run('ui.view');
  await click('navigate', { view: 'dictation' });
  assert.equal(run('ui.view'), viewBeforeCancel);
  assert.equal(run('ui.formDrafts["prep|"]?.goals'), '尚未保存的备课目标');
  context.confirm = () => true;
  await submit('progress', { lessonNo: '4', title: '测试课', planDate: '2026-10-24', actualDate: '', status: '未开始', note: '改日期' });
  assert.equal(run('ui.dirty'), true);
  assert.equal(draftControl.value, '尚未保存的备课目标');
  renderedForms.length = 0;
  await submit('prep', { goals: '识字', focus: '词语', activities: '朗读', materials: '田字格', reflection: '' });
  assert.equal(run('ui.dirty'), false);
  assert.equal(run('inClass(state.preps).length'), 1);
  run(`ui.dictWords=[{w:'认真',p:'rèn zhēn',on:true}];ui.activeDictId=null`);
  await submit('dictTask', { title: '听写', date: '2026-10-23', participants: '50', rate: '0.7', times: '2', gap: '8' });
  assert.equal(run('inClass(state.dictations).length'), 2);
  assert.equal(run('inClass(state.dictations).at(-1).words[0].w'), '认真');
  await click('newAssignment');
  assert.equal(run('ui.newAssignment'), true);
  assert.equal(run('inBook(state.assignments).length'), 1);
  assert.match(appNode.innerHTML, /建立作业记录/);
  await submit('assignmentNew', { date: '2026-10-23', lessonNo: '4', content: '课后练习', participants: '50' });
  assert.equal(run('inBook(state.assignments).length'), 2);
  const assignmentId = run('ui.markId');
  await submit('assignment', { participants: '50', marked: '40', issues: '字词|（填写具体错字或词语）', content: '课后练习', date: '2026-10-23', lessonNo: '4' }, assignmentId);
  assert.equal(run('inBook(state.assignments).at(-1).markedCount'), 0);
  await submit('assignment', { participants: '50', marked: '40', issues: '字词|同音字误写', content: '课后练习', date: '2026-10-23', lessonNo: '4' }, assignmentId);
  assert.equal(run('inBook(state.assignments).at(-1).issues[0].text'), '同音字误写');
  await click('newFollowup', { sourceType: 'assignment', sourceId: run('ui.markId') });
  assert.equal(run('ui.newFollowup.sourceType'), 'assignment');
  assert.match(appNode.innerHTML, /从本班名册勾选学生 · 50 人/);
  assert.equal((appNode.innerHTML.match(/name="studentPick_s\d+"/g) || []).length, 50);
  await submit('followupNew', { kind: '复查', title: '错例复查', dueDate: '2026-10-24', studentNos: '01、02' });
  assert.equal(run('inBook(state.followups).at(-1).studentIds.length'), 2);
  await click('newFollowup', { sourceType: 'assignment', sourceId: run('ui.markId') });
  await submit('followupNew', { kind: '讲评', title: '分组讲评', dueDate: '2026-10-25', studentNos: '02、03', studentPick_s0: 'on', studentPick_s1: 'on' });
  assert.equal(run('inBook(state.followups).at(-1).studentIds.length'), 3);
  const editFollowupId = run('inBook(state.followups).at(-1).id');
  run("ui.markTab='followups';ui.view='marking';renderApp()");
  await click('followupResult', { id: editFollowupId });
  assert.match(appNode.innerHTML, /编辑事项与结果/);
  await submit('followupResult', { kind: '复查', title: '订正复查', dueDate: '2026-10-26', result: '已核对订正', studentNos: '03', studentPick_s0: 'on' }, editFollowupId);
  assert.equal(run('inBook(state.followups).at(-1).title'), '订正复查');
  assert.equal(run('inBook(state.followups).at(-1).dueDate'), '2026-10-26');
  assert.equal(run('inBook(state.followups).at(-1).studentIds.length'), 2);
  run("inBook(state.followups).at(-1).studentIds.push('removed-student')");
  await submit('followupResult', { kind: '复查', title: '订正复查', dueDate: '2026-10-26', result: '已核对订正', studentPick_s0: 'on', keepUnknown: 'on' }, editFollowupId);
  assert.equal(run('inBook(state.followups).at(-1).studentIds.includes("removed-student")'), true);
  await submit('followupResult', { kind: '复查', title: '订正复查', dueDate: '2026-10-26', result: '已核对订正', studentPick_s0: 'on' }, editFollowupId);
  assert.equal(run('inBook(state.followups).at(-1).studentIds.includes("removed-student")'), false);
  assert.equal(run('appendLine("字词|错例", "句子|问题")'), '字词|错例\n句子|问题');
  run("ui.markTab='assignment';ui.markId=inBook(state.assignments).at(-1).id;renderApp()");
  assert.match(appNode.innerHTML, /常用模板，插入后可编辑/);
  assert.match(appNode.innerHTML, /data-field="issues"/);
  const pickControls = ['s0', 's1'].map(id => ({ name: 'studentPick_' + id, type: 'checkbox', checked: false }));
  const pickCount = { textContent: '' };
  const pickForm = {
    dataset: { form: 'followupNew', id: '' },
    get values() { return Object.fromEntries(pickControls.filter(x => x.checked).map(x => [x.name, 'on'])); },
    elements: { namedItem() { return null; } },
    querySelector() { return pickCount; },
    querySelectorAll(selector) { return selector.includes(':checked') ? pickControls.filter(x => x.checked) : pickControls; },
  };
  renderedForms.push(pickForm);
  const allButton = { dataset: { act: 'followupPickAll' }, closest() { return pickForm; } };
  await listeners.click({ target: { closest() { return allButton; } } });
  assert.equal(pickControls.filter(x => x.checked).length, 2);
  assert.match(pickCount.textContent, /已选 2 人/);
  pickControls[0].checked = false;
  pickControls[1].checked = false;
  run('restoreFormDrafts()');
  assert.equal(pickControls.filter(x => x.checked).length, 2);
  renderedForms.length = 0;
  run('discardDrafts()');
  const issueControl = { value: '字词|已核错例', focus() {} };
  const templateForm = { dataset: { form: 'assignment', id: 'a-template' }, get values() { return { issues: issueControl.value }; }, elements: { namedItem(name) { return name === 'issues' ? issueControl : null; } } };
  const templateButton = { dataset: { act: 'insertTemplate', field: 'issues', template: '句子|（填写具体语句问题）' }, closest() { return templateForm; } };
  await listeners.click({ target: { closest() { return templateButton; } } });
  assert.equal(issueControl.value, '字词|已核错例\n句子|（填写具体语句问题）');
  assert.equal(run('ui.formDrafts["assignment|a-template"].issues'), issueControl.value);
  run('discardDrafts()');
  await submit('manualTask', { title: '复查订正', dueDate: '2026-10-25' });
  const taskId = run('inClass(state.tasks).at(-1).id');
  run("ui.view='teaching';renderApp()");
  await click('editTask', { id: taskId });
  assert.match(appNode.innerHTML, /data-form="manualTaskEdit"/);
  await submit('manualTaskEdit', { title: '复查书写订正', dueDate: '2026-10-27' }, taskId);
  assert.equal(run('inClass(state.tasks).at(-1).title'), '复查书写订正');
  assert.equal(run('inClass(state.tasks).at(-1).dueDate'), '2026-10-27');
  await click('toggleTask', { id: taskId });
  assert.equal(run('inClass(state.tasks).at(-1).status'), '完成');
  assert.match(appNode.innerHTML, /撤销上次状态切换/);
  await click('undoStatus');
  assert.equal(run('inClass(state.tasks).at(-1).status'), '待办');
  context.confirm = () => false;
  await click('deleteTask', { id: taskId });
  assert.equal(run('inClass(state.tasks).some(x=>x.id==="'+taskId+'")'), true);
  context.confirm = () => true;
  await click('deleteTask', { id: taskId });
  assert.equal(run('inClass(state.tasks).some(x=>x.id==="'+taskId+'")'), false);
  run("inBook(state.followups).at(-1).result='已完成讲评'");
  const followupId = run('inBook(state.followups).at(-1).id');
  await click('toggleFollowup', { id: followupId });
  assert.equal(run('inBook(state.followups).at(-1).status'), '完成');
  await click('undoStatus');
  assert.equal(run('inBook(state.followups).at(-1).status'), '待办');
  assert.match(run('renderTeaching()'), /学期 \/ 周计划/);
  await click('reopenDict', { id: run('inBook(state.dictations).at(-1).id') });
  assert.equal(run('ui.activeDictId'), run('inBook(state.dictations).at(-1).id'));
  assert.equal(run('ui.view'), 'dictation');
  run("inBook(state.dictations).at(-1).markedCount=2;inBook(state.dictations).at(-1).wordErrors={'认真':2}");
  await submit('dictTask', { title: '听写', date: '2026-10-23', participants: '1', rate: '0.7', times: '2', gap: '8' });
  assert.equal(run('inBook(state.dictations).at(-1).participantCount'), 50);
  assert.match(toastNode.textContent, /参与人数不能小于/);
  await submit('progress', { lessonNo: '5', title: '重编号课次', planDate: '2026-10-24', actualDate: '', status: '未开始', note: '' });
  assert.equal(run('inBook(state.preps)[0].lessonNo'), '5');
  assert.equal(run('inBook(state.dictations).at(-1).lessonNo'), '5');
  assert.equal(run('inBook(state.assignments).at(-1).lessonNo'), '5');
  const backup = run('({format:"teacher-workbench-r1",version:1,state:structuredClone(state)})');
  context.backup = backup;
  assert.equal(run('validImport(backup)'), true);
  const crossStudent = structuredClone(backup);
  const otherClassId = crossStudent.state.classes.find(x => x.id !== crossStudent.state.followups.at(-1).classId).id;
  crossStudent.state.students.push({ id: 'student-other-class', classId: otherClassId, no: '999', name: '隔离测试' });
  crossStudent.state.followups.at(-1).studentIds = ['student-other-class'];
  context.crossStudent = crossStudent;
  assert.equal(run('validImport(crossStudent)'), false);
  const crossSource = structuredClone(backup);
  crossSource.state.followups.at(-1).sourceType = 'assignment';
  crossSource.state.assignments.push({ ...crossSource.state.assignments[0], id: 'assignment-other-class', classId: otherClassId });
  crossSource.state.followups.at(-1).sourceId = 'assignment-other-class';
  context.crossSource = crossSource;
  assert.equal(run('validImport(crossSource)'), false);
  backup.state.students[0].classId = 'nonexistent';
  assert.equal(run('validImport(backup)'), false);
  context.fixture = JSON.parse(fs.readFileSync(path.join(root, '..', 'docs', 'acceptance', 'fixtures', 'R1-2班50人.json'), 'utf8'));
  assert.equal(run('validImport(fixture)'), true);
  run(`state.customBooks.push({bookId:'local-book',publisher:'测试出版社',grade:3,term:'上册',editionYear:'2026',title:'测试教材'});state.classes[1].bookId='local-book';state.progress[0].bookId='local-book'`);
  context.window.TEXTBOOKS = [{ bookId: 'packaged-book', publisher: '测试出版社', grade: 3, term: '上册', editionYear: '2026', title: '测试教材', file: 'packaged-book.pdf' }];
  assert.equal(run('reconcileBooks()'), true);
  assert.equal(run('state.classes[1].bookId'), 'packaged-book');
  assert.equal(run('state.progress[0].bookId'), 'packaged-book');
  assert.equal(run('state.customBooks.length'), 0);
  run("ui.view='resources';ui.resourceTab='textbooks';ui.bookGrade='current';renderApp()");
  assert.match(appNode.innerHTML, /当前班级教材/);
  assert.match(appNode.innerHTML, /本班已绑定/);
  assert.doesNotMatch(appNode.innerHTML, /data-act="bindBook"[^>]*data-id="packaged-book"/);
  run("ui.pdfBookId='packaged-book';ui.pdfTemporary=true;ui.pdfFileName='个人扫描稿.pdf';ui.pdfUrl='blob:test'");
  assert.match(run('renderPdfReader()'), /个人扫描稿.pdf/);
  assert.match(run('renderPdfReader()'), /临时预览/);
  assert.doesNotMatch(run('renderPdfReader()'), /统编版/);
  // Failed writes must preserve committed records and retain retryable form input.
  const storageSetItem = context.persistState;
  const expectedErrors = [];
  context.console = { ...console, error(error) { expectedErrors.push(error); } };
  run("ui.view='marking';ui.markTab='assignment';ui.newAssignment=true;discardDrafts();renderApp()");
  const beforeFailedCreate = run('JSON.stringify(state)');
  const beforeFailedDisk = data.get('wb_r1_state');
  const retryValues = { date: '2026-10-23', lessonNo: '1', content: '保存失败重试作业', participants: '50' };
  context.persistState = () => { throw new Error('模拟磁盘配额不足'); };
  await submit('assignmentNew', retryValues);
  assert.equal(run('JSON.stringify(state)'), beforeFailedCreate);
  assert.equal(data.get('wb_r1_state'), beforeFailedDisk);
  assert.equal(run('ui.newAssignment'), true);
  assert.equal(run('ui.formDrafts["assignmentNew|"].content'), retryValues.content);
  assert.match(toastNode.textContent, /操作未保存/);
  assert.equal(appNode.inert, false);
  context.persistState = storageSetItem;
  const beforeRetryCount = run('state.assignments.length');
  await Promise.all([submit('assignmentNew', retryValues), submit('assignmentNew', retryValues)]);
  assert.equal(run('state.assignments.length'), beforeRetryCount + 1);
  assert.equal(run('ui.dirty'), false);
  await submit('manualTask', { title: '失败后应保留的待办', dueDate: '2026-10-23' });
  const protectedTaskId = run('inClass(state.tasks).at(-1).id');
  context.persistState = () => { throw new Error('模拟写入失败'); };
  await click('toggleTask', { id: protectedTaskId });
  assert.equal(run('inClass(state.tasks).at(-1).status'), '待办');
  await click('deleteTask', { id: protectedTaskId });
  assert.equal(run('inClass(state.tasks).at(-1).id'), protectedTaskId);
  context.persistState = storageSetItem;
  run("ui.view='settings';ui.importCandidate=structuredClone(state);ui.importCandidate.classes[1].name='恢复后的班级';ui.activeDictId='stale-dict';ui.dictWords=[{w:'旧词',p:'jiù cí',on:true}];ui.dictForm={title:'旧听写'};ui.csvCandidate=[{no:'999',name:'旧预览'}]");
  const beforeRestore = run('JSON.stringify(state)');
  context.persistState = () => { throw new Error('模拟备份恢复写入失败'); };
  await click('confirmImport');
  assert.equal(run('JSON.stringify(state)'), beforeRestore);
  assert.equal(run('ui.importCandidate.classes[1].name'), '恢复后的班级');
  assert.equal(run('ui.activeDictId'), 'stale-dict');
  context.persistState = storageSetItem;
  await click('confirmImport');
  assert.equal(run('state.classes[1].name'), '恢复后的班级');
  assert.equal(run('ui.activeDictId'), null);
  assert.equal(run('ui.dictWords.length'), 0);
  assert.equal(run('ui.dictForm'), null);
  assert.equal(run('ui.csvCandidate'), null);
  assert.equal(run('ui.importCandidate'), null);
  assert.equal(JSON.parse(data.get('wb_r1_state')).classes[1].name, '恢复后的班级');
  assert.equal(expectedErrors.length, 4);
  run("globalThis.originalRenderApp=renderApp;renderApp=()=>{throw Error('模拟保存后的渲染失败')}");
  await submit('manualTask', { title: '写入成功应保留', dueDate: '2026-10-23' });
  run('renderApp=globalThis.originalRenderApp');
  assert.equal(run('state.tasks.at(-1).title'), '写入成功应保留');
  assert.equal(JSON.parse(data.get('wb_r1_state')).tasks.at(-1).title, '写入成功应保留');
  assert.match(toastNode.textContent, /数据已保存/);
  assert.equal(expectedErrors.length, 5);
  // A CSV preview belongs to the class that selected the file, even before confirmation.
  run(`state=defaultState();state.classes=[{id:'wa',name:'流程甲班',grade:3,term:'上册',bookId:''},{id:'wb',name:'流程乙班',grade:3,term:'上册',bookId:''}];state.selectedClassId='wa';resetRecordContext();ui.view='classes';renderApp()`);
  const csvChange = () => listeners.change({ target: { id: 'csvFile', dataset: {}, files: [{ async text() { return '学号,姓名\n01,学生甲'; } }], closest() { return null; } } });
  await csvChange();
  assert.equal(run('ui.csvClassId'), 'wa');
  assert.match(appNode.innerHTML, /导入到 流程甲班/);
  await click('switchClass', { id: 'wb' });
  assert.equal(run('ui.csvCandidate'), null);
  run(`ui.csvCandidate=[{no:'01',name:'学生甲'}];ui.csvClassId='wa'`);
  await click('confirmCsv');
  assert.equal(run('state.students.length'), 0);
  assert.match(toastNode.textContent, /班级已变化/);
  await csvChange();
  await click('confirmCsv');
  assert.equal(run('state.students.length'), 1);
  assert.equal(run('state.students[0].classId'), 'wb');
  await csvChange();
  await listeners.change({ target: { id: 'classSwitch', value: 'wa', dataset: {}, closest() { return null; } } });
  assert.equal(run('ui.csvCandidate'), null);
  assert.equal(run('ui.csvClassId'), null);
  // Historical marking remains tied to the same word set; reordering is safe.
  run(`state.dictations=[{id:'workflow-dict',classId:'wa',bookId:'',lessonNo:'4',title:'原听写',date:'2026-10-23',words:[{w:'认真',p:'rèn zhēn'},{w:'成绩',p:'chéng jì'}],wordErrors:{'认真':1},studentMarks:{},participantCount:3,markedCount:2}];ui.view='marking';ui.markTab='dictation';renderApp()`);
  await click('reopenDict', { id: 'workflow-dict' });
  const taskValues = { title: '已批听写的报词设置', date: '2026-10-22', participants: '3', rate: '0.8', times: '1', gap: '5' };
  run('ui.dictWords[1].on=false');
  await submit('dictTask', taskValues);
  assert.equal(run('state.dictations[0].words.length'), 2);
  assert.match(toastNode.textContent, /已有批改记录/);
  run('ui.dictWords[1].on=true;ui.dictWords.reverse()');
  await submit('dictTask', taskValues);
  assert.equal(run('state.dictations[0].words[0].w'), '成绩');
  assert.equal(run('state.dictations[0].wordErrors["认真"]'), 1);
  assert.equal(run('ui.dictForm.title'), taskValues.title);
  assert.match(appNode.innerHTML, /value="2026-10-22"/);
  run(`ui.dictRunning=true;ui.view='teaching'`);
  await click('selectLesson', { no: '5' });
  assert.equal(run('ui.activeDictId'), null);
  assert.equal(run('ui.dictForm'), null);
  assert.equal(run('ui.dictRunning'), false);
  run(`ui.dictWords=[{w:'重复',p:'chóng fù',on:true},{w:'重复',p:'chóng fù',on:true}]`);
  await submit('dictTask', taskValues);
  assert.equal(run('state.dictations.length'), 1);
  assert.match(toastNode.textContent, /重复词语/);
  // Invalid counts must not silently change the teacher's entered data.
  run(`ui.view='marking';ui.markTab='dictation';ui.markId='workflow-dict';renderApp()`);
  const beforeInvalidMark = run('JSON.stringify(state.dictations[0])');
  await submit('dictMark', { participants: '3', marked: '2', err_0: '3', err_1: '0' }, 'workflow-dict');
  assert.equal(run('JSON.stringify(state.dictations[0])'), beforeInvalidMark);
  assert.equal(run('ui.formDrafts["dictMark|workflow-dict"].err_0'), '3');
  assert.match(toastNode.textContent, /错人数须为/);
  await submit('dictMark', { participants: '3', marked: '2', err_0: '1', err_1: '2' }, 'workflow-dict');
  assert.equal(run('state.dictations[0].wordErrors["认真"]'), 2);
  assert.equal(run('ui.dirty'), false);
  await submit('assignmentNew', { content: '人数校验', participants: '2.5', date: '2026-10-23', lessonNo: '5' });
  assert.equal(run('state.assignments.length'), 0);
  assert.match(toastNode.textContent, /参与人数须为/);
  appNode.style = {};
  context.speechEditForm = { dataset: { form: 'dictTask' }, values: { title: '编辑报词设置' } };
  run('ui.dictRunning=true;captureFormDraft(speechEditForm)');
  assert.equal(run('ui.dictRunning'), false);
  run(`discardDrafts();ui.view='classes';ui.newFollowup={sourceType:'dictation',sourceId:'workflow-dict'};ui.csvCandidate=[{no:'02',name:'待导学生'}];ui.csvClassId='wa'`);
  await submit('class', { name: '新建丙班', grade: '3', term: '上册' });
  assert.equal(run('ui.newFollowup'), null);
  assert.equal(run('ui.csvCandidate'), null);
  run(`ui.newFollowup={sourceType:'dictation',sourceId:'workflow-dict'}`);
  await submit('followupNew', { kind: '复查', title: '错误来源应阻止', dueDate: '2026-10-24', studentNos: '' });
  assert.equal(run('state.followups.length'), 0);
  assert.match(toastNode.textContent, /原记录已变化/);
  await click('switchClass', { id: 'wa' });
  run(`state.customBooks.push({bookId:'workflow-book',publisher:'测试出版社',grade:3,term:'上册',editionYear:'2026',title:'测试教材'});ui.newFollowup={sourceType:'dictation',sourceId:'workflow-dict'}`);
  await click('bindBook', { id: 'workflow-book' });
  assert.equal(run('ui.newFollowup'), null);
  run(`ui.newFollowup={sourceType:'dictation',sourceId:'workflow-dict'}`);
  await submit('followupNew', { kind: '复查', title: '旧教材来源应阻止', dueDate: '2026-10-24', studentNos: '' });
  assert.equal(run('state.followups.length'), 0);
  assert.match(toastNode.textContent, /原记录已变化/);
  run(`ui.view='classes';ui.formDrafts={'student|':{no:'10',name:'未保存学生'}};ui.dirty=true`);
  const classCountBeforeCancel = run('state.classes.length');
  context.confirm = () => false;
  await submit('class', { name: '草稿确认班', grade: '3', term: '上册' });
  assert.equal(run('state.classes.length'), classCountBeforeCancel);
  assert.equal(run('ui.formDrafts["student|"].name'), '未保存学生');
  context.confirm = () => true;
  await click('deleteClass', { id: 'wb' });
  assert.equal(run('ui.formDrafts["student|"].name'), '未保存学生');
  await submit('class', { name: '草稿确认班', grade: '3', term: '上册' });
  assert.equal(run('currentClass().name'), '草稿确认班');
  assert.equal(run('Object.keys(ui.formDrafts).length'), 0);
  console.log('R1 data, forms, render and print checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
