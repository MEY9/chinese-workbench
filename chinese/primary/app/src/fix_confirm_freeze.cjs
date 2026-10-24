// v2.5.2 修复:确认框全部前置到 stateOperation 之外(消灭 busy 冻结)
// 原理:stateOperation 内任何 await uiConfirm 都会在等待用户期间持有 operationBusy,
//      导致后续保存全部"正在处理,请稍候"。确认必须在进入事务之前完成。
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let n = 0;

// ① 提取 click 监听器中所有 dirty 确认守卫 → 生成 CONFIRM_VERB 表,并从 case 内删除
const VERBS = {
  navigate: '离开当前页面', selectLesson: '切换课次', newLesson: '新建课次',
  openTask: '离开当前页面', editTask: '编辑该待办', markTab: '切换批改页签',
  selectMark: '切换批改记录', followupResult: '编辑该复查', resourceTab: '切换资料页签',
  bindBook: '绑定教材', switchClass: '切换班级', reopenDict: '重新报词',
};
// 单字符串确认:if(ui.dirty&&!(await uiConfirm('MSG')))break;  → 删除,记 MSG
const dirtyGuardRe = /if\(ui\.dirty&&!\(await uiConfirm\('([^']*)'\)\)\)break;/g;
const msgByContent = {};
let m;
while ((m = dirtyGuardRe.exec(src))) {
  // 从 case 上下文找 act 名
  const caseIdx = src.lastIndexOf("case'", m.index);
  const caseSeg = src.slice(caseIdx, m.index);
  const actM = caseSeg.match(/case'([a-zA-Z]*)'/g);
  const act = actM ? actM[actM.length - 1].replace(/case'|'/g, '') : '';
  msgByContent[act] = m[1];
  n++;
}
src = src.replace(dirtyGuardRe, '');

// deleteTask / delRecord / annClearPage 等非 dirty 确认(同样会冻结)→ 前置处理标记
// 用统一策略:这些确认改为「先在 case 外完成」——由于结构差异大,改为把 uiConfirm 换成
// 不阻塞 busy 的实现:在 stateOperation 里遇到 uiConfirm 时……不可行;因此统一前置。

// ② 注入预确认块(click 派发器,进入 stateOperation 之前)
const clickHead = "const el=event.target.closest('[data-act]');if(!el)return;const act=el.dataset.act;";
if (!src.includes(clickHead)) throw new Error('click head anchor miss');
const preBlock = clickHead + `
  // 确认框前置:在进入事务(busy)之前完成所有用户确认,避免等待期间冻结保存
  const confirmMsg = (ui.dirty && VERBS[act]) || null;
  if (confirmMsg && !(await uiConfirm('当前表单有未保存的更改，' + confirmMsg + '？'))) return;
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
  if (act === 'delRecord') {
    if (!(await uiConfirm('删除这条观察记录？', { danger: true, ok: '删除' }))) return;
  }
  if (act === 'annClearPage') {
    if (!(await uiConfirm('清空本页全部标注？', { danger: true, ok: '清空' }))) return;
  }`;
src = src.replace(clickHead, preBlock);
n++;

// ③ case 内删除已被前置的确认(保留空值检查)
const pairs = [
  [`case'navigate':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))break;`, `case'navigate':{`],
  [`case'selectLesson':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换课次吗？')))break;`, `case'selectLesson':`],
  [`case'newLesson':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定新建课次吗？')))break;`, `case'newLesson':{`],
  [`case'openTask':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))break;`, `case'openTask':{`],
  [`case'editTask':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定编辑待办吗？')))break;`, `case'editTask':{`],
  [`case'markTab':if(ui.dirty&&!(await uiConfirm('当前批改有未保存的更改，确定切换吗？')))break;`, `case'markTab':`],
  [`case'selectMark':if(ui.dirty&&!(await uiConfirm('当前批改有未保存更改，确定切换记录吗？')))break;`, `case'selectMark':`],
  [`case'followupResult':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定编辑复查吗？')))break;`, `case'followupResult':`],
  [`case'resourceTab':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换吗？')))break;`, `case'resourceTab':`],
  [`case'bindBook':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定绑定教材吗？')))break;`, `case'bindBook':{`],
  [`case'switchClass':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换班级吗？')))break;`, `case'switchClass':`],
  [`case'reopenDict':{if(ui.dirty&&!(await uiConfirm('当前批改有未保存更改，确定离开吗？')))break;`, `case'reopenDict':{`],
];
for (const [a, b] of pairs) {
  if (src.includes(a)) { src = src.replace(a, b); n++; console.log('stripped:', a.slice(4, 30)); }
  else console.log('SKIP (variant):', a.slice(4, 40));
}

// ④ deleteClass/deleteStudent/deleteTask case 内的确认删除(前置已做)
const delClassOld = "case'deleteClass':{const c=state.classes.find(x=>x.id===el.dataset.id);if(!c)break;if(!(await uiConfirm(`删除“${c.name}”及其学生、教学和批改记录？请先从设置页导出备份。`,{danger:true,ok:'删除'})))break;";
if (src.includes(delClassOld)) { src = src.replace(delClassOld, "case'deleteClass':{const c=state.classes.find(x=>x.id===el.dataset.id);if(!c)break;"); n++; console.log('stripped deleteClass confirm'); }
const delStuOld = "case'deleteStudent':{const s=inClass(state.students).find(x=>x.id===el.dataset.id);if(!s||!(await uiConfirm(`删除学生“${s.name}”？相关批改记录会保留原始编号。`,{danger:true,ok:'删除'})))break;";
if (src.includes(delStuOld)) { src = src.replace(delStuOld, "case'deleteStudent':{const s=inClass(state.students).find(x=>x.id===el.dataset.id);if(!s)break;"); n++; console.log('stripped deleteStudent confirm'); }

// ⑤ 删除任务/记录/标注的确认(改为前置后,case 内删除)
const delTaskRe = /if\(!t\|\|!\(await uiConfirm\('删除这条待办\?'\)\)\)break;/;
if (delTaskRe.test(src)) { src = src.replace(delTaskRe, 'if(!t)break;'); n++; }
const delRecRe = /if\(!\(await uiConfirm\('删除这条观察记录\?'\)\)\)break;/;
if (delRecRe.test(src)) { src = src.replace(delRecRe, ''); n++; }
const annRe = /if\(!\(await uiConfirm\('清空本页全部标注\?'\)\)\)break;/;
if (annRe.test(src)) { src = src.replace(annRe, ''); n++; }

// ⑥ VERBS 常量注入(defaultState 前)
if (!src.includes('const CONFIRM_VERBS')) {
  const verbs = JSON.stringify(VERBS);
  src = src.replace('function defaultState()', 'const CONFIRM_VERBS=' + verbs + ';\nfunction defaultState()');
  n++;
}
fs.writeFileSync('app.js', src);
console.log('done, edits:', n);
