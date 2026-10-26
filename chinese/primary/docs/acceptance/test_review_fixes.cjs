// 复核修复回归:R1–R7 断言(独立合成数据,不访问真实记录/外部 AI)
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../../app/src/app.js'), 'utf8');
const R = {};
const helperSource=fs.readFileSync(path.join(__dirname,'../../app/src/reliability.js'),'utf8');

// ---- R1 gradeStats:空白不计入;缺考单列;非法值排除 ----
{
  const fn = source.slice(source.indexOf('function gradeStats('), source.indexOf('function renderGrades('));
  const ctx = vm.createContext({ passLine: () => 60 });
  vm.runInContext(fn, ctx);
  const blank = vm.runInContext('gradeStats([{score:"100"},{score:""}])', ctx);
  assert.equal(blank.n, 1, 'R1 空白不计入人数');
  assert.equal(blank.avg, 100, 'R1 空白不拉低均分');
  const zero = vm.runInContext('gradeStats([{score:"100"},{score:"0"}])', ctx);
  assert.equal(zero.n, 2, 'R1 真实 0 分计入');
  assert.equal(zero.avg, 50, 'R1 真实 0 分参与均分');
  const absent = vm.runInContext('gradeStats([{score:"100"},{absent:true},{score:"80"}])', ctx);
  assert.equal(absent.n, 2, 'R1 缺考不计入');
  assert.equal(absent.absentN, 1, 'R1 缺考单列计数');
  const illegal = vm.runInContext('gradeStats([{score:"100"},{score:"250"},{score:"abc"}])', ctx);
  assert.equal(illegal.n, 1, 'R1 越界/非法值排除');
  R.R1 = '通过';
}

// ---- R5+R6 profileDataSummary:未批不计;敏感记录不进外发 ----
{
  const summary = source.slice(source.indexOf('function profileDataSummary('), source.indexOf('\nfunction renderClasses('));
  const fake = { id: 's1', no: '01', name: 'Synthetic student' };
  const ctx = vm.createContext({
    state: {
      records: [],
      dictations: [
        { classId: 'c1', studentMarks: {} },                                                        // 无批改记录
        { classId: 'c1', studentMarks: { s1: { status: '未录', wrongWords: [] } } },                // 未录
        { classId: 'c1', studentMarks: { s1: { status: '已录', wrongWords: ['春', '天'] } } },      // 已批有错
      ],
    },
    inClass: rows => rows.filter(r => r.classId === 'c1'),
    fake,
  });
  vm.runInContext(helperSource, ctx);
  vm.runInContext(summary, ctx);
  // 基线:有一条非敏感闪光点
  vm.runInContext('state.records.push({studentId:"s1",type:"闪光点",sensitive:false})', ctx);
  const base = vm.runInContext('profileDataSummary(fake)', ctx);
  assert.match(base, /听写记录 1 次/, 'R5 只有已批听写计入');
  assert.match(base, /累计错词 2 个/, 'R5 错词只来自已批听写');
  assert.match(base, /闪光点 1 条/, 'R5 非敏感记录正常计入');
  // 加敏感记录
  vm.runInContext('state.records.push({studentId:"s1",type:"需关注",sensitive:true,note:"SYNTHETIC_PRIVATE_NOTE"})', ctx);
  const withSensitive = vm.runInContext('profileDataSummary(fake)', ctx);
  assert.equal(base, withSensitive, 'R6 敏感记录增删不改变外发摘要');
  assert.ok(!withSensitive.includes('SYNTHETIC_PRIVATE_NOTE'), 'R6 敏感正文不外发');
  vm.runInContext('state.records=state.records.filter(r=>!r.sensitive)', ctx);
  assert.equal(vm.runInContext('profileDataSummary(fake)', ctx), base, 'R6 删除敏感记录亦不改变外发摘要');
  R.R5 = '通过';
  R.R6 = '通过';
}

// ---- R4 设置保存:key 不进 state ----
{
  const m = source.match(/case'settings':\{([\s\S]*?)break;\}/);
  assert.ok(m, 'R4 settings case 结构');
  const ctx2 = vm.createContext({
    state: { settings: {} },ui:{},renderApp:()=>{},
    form: {},
    formVal: (_f, key) => (key === 'key' ? 'SYNTHETIC_REVIEW_KEY' : 'synthetic'),
    toast: () => {},
  });
  ctx2.DesktopAI = { hasKey:async()=>true, saveKey: async (k) => { ctx2.__saved = k; } };
  vm.runInContext('async function __r(){' + m[1] + '\n};__r()', ctx2);
  setImmediate(() => {
    assert.equal(ctx2.state.settings.ai.key, undefined, 'R4 state 不含明文 key');
    assert.equal(ctx2.state.settings.ai.base, 'synthetic', 'R4 base/model 照常保存');
    assert.equal(ctx2.__saved, 'SYNTHETIC_REVIEW_KEY', 'R4 key 走加密存储接口');
    R.R4 = '通过';
    done();
  });
}

// ---- R2 座位/积分按班级隔离 ----
function r2() {
  const seatSrc = source.slice(source.indexOf('function classBucket('), source.indexOf('function passLine('));
  const ctx = vm.createContext({
    state: {
      selectedClassId: 'c2',
      students: [
        { id: 's1', classId: 'c1', no: '01', name: 'Student A' },
        { id: 's2', classId: 'c2', no: '01', name: 'Student B' },
      ],
      pointsByClass: { c1: { s1: 1 } },
      seatsByClass: { c1: { list: ['s1'] } },
    },
    ui: {}, heading: () => '', btn: () => '', E: String, A: String, notice: () => '',
  });
  vm.runInContext("function currentClass(){return {id:state.selectedClassId}}\nfunction inClass(rows){return rows.filter(r=>r.classId===state.selectedClassId)}", ctx);
  vm.runInContext(seatSrc, ctx);
  const seatsC2 = vm.runInContext('renderSeats()', ctx);
  assert.ok(seatsC2.includes('Student B'), 'R2 乙班座位渲染本班学生');
  assert.ok(!seatsC2.includes('Student A'), 'R2 乙班座位不含甲班学生');
  const pointsC2 = vm.runInContext('renderPoints()', ctx);
  assert.ok(pointsC2.includes('Student B'), 'R2 乙班积分榜含本班学生');
  assert.ok(!/Student B[\s\S]{0,80}>1</.test(pointsC2), 'R2 乙班不继承甲班积分');
  vm.runInContext('state.selectedClassId="c1"', ctx);
  const pointsC1 = vm.runInContext('renderPoints()', ctx);
  assert.ok(/Student A[\s\S]{0,80}>1</.test(pointsC1), 'R2 甲班积分保持');
  R.R2 = '通过';
}

// ---- R7 档案累计全量口径 ----
{
  assert.ok(source.includes('const allDict=inClass(state.dictations)'), 'R7 全量口径变量');
  assert.ok(source.includes('听写错词累计'), 'R7 累计展示');
  assert.ok(source.includes('const dictHist=allDict.slice(-5)'), 'R7 图表取最近5');
  R.R7 = '通过';
}

let finished = false;
function done() {
  if (finished) return;
  finished = true;
  r2();
  console.log(JSON.stringify(R, null, 1));
  console.log('review-fixes regression: ALL PASS');
}
