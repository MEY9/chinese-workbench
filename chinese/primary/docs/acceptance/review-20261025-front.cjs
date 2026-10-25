// Isolated source-level probes. No real records, browser storage or AI calls.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../app/src/app.js'), 'utf8');
const summary = source.slice(source.indexOf('function profileDataSummary('), source.indexOf('\nfunction renderClasses('));
const fake = { id: 's1', no: '01', name: 'Synthetic student' };
const ctx = vm.createContext({
  state: { records: [], dictations: [{ classId: 'c1', studentMarks: {} }] },
  inClass: rows => rows.filter(r => r.classId === 'c1'),
  fake
});
vm.runInContext(summary, ctx);
const missingMarkSummary = vm.runInContext('profileDataSummary(fake)', ctx);
ctx.state.records.push({ studentId: 's1', type: '需关注', sensitive: true, note: 'SYNTHETIC_PRIVATE_NOTE' });
const sensitiveSummary = vm.runInContext('profileDataSummary(fake)', ctx);
const settingsHandler = source.match(/case'settings':(state\.settings\.ai=[\s\S]*?)break;/)[1];
const settingsCtx = vm.createContext({ state: { settings: {} }, form: {}, formVal: (_f, key) => key === 'key' ? 'SYNTHETIC_REVIEW_KEY' : 'synthetic' });
vm.runInContext(settingsHandler, settingsCtx);
const classroomCtx = vm.createContext({
  state: { selectedClassId: 'c2', students: [
    { id: 's1', classId: 'c1', no: '01', name: 'Student A' },
    { id: 's2', classId: 'c2', no: '01', name: 'Student B' }
  ], seats: ['s1'], points: { '01': 1 }, settings: {} },
  ui: {}, heading: () => '', btn: () => '', E: String, A: String,
});
vm.runInContext(`function currentClass(){return {id:state.selectedClassId}}
  function inClass(rows){return rows.filter(r=>r.classId===state.selectedClassId)}`, classroomCtx);
vm.runInContext(source.slice(source.indexOf('function renderSeats('), source.indexOf('function renderGrades(')), classroomCtx);
const blankGradeStats = vm.runInContext('gradeStats([{score:"100"},{score:""}])', classroomCtx);
const secondClassSeats = vm.runInContext('renderSeats()', classroomCtx);
const secondClassPoints = vm.runInContext('renderPoints()', classroomCtx);
console.log(JSON.stringify({
  missingMarkSummary,
  sensitiveSummary,
  sensitiveCountsChangeOutboundSummary: missingMarkSummary !== sensitiveSummary,
  sensitiveNoteTextIncluded: sensitiveSummary.includes('SYNTHETIC_PRIVATE_NOTE'),
  settingsHandlerKeepsPlaintextKey: settingsCtx.state.settings.ai.key === 'SYNTHETIC_REVIEW_KEY',
  blankGradeStats,
  secondClassSeatRenderedAsEmpty: secondClassSeats.includes('empty-seat') && !secondClassSeats.includes('Student B'),
  secondClassInheritsFirstClassPoints: secondClassPoints.includes('Student B') && secondClassPoints.includes('var(--sky)">1</b>')
}, null, 2));
