// v2.8.0 五项修复:①AI 服务端代理回退 ②PDF worker Blob 注册+引擎初始化重写 ③成绩 gradeInput change 写入+按钮美化 ④日期精确到分钟 ⑤品牌只留左上角名称并真正绑定
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let css = fs.readFileSync('style.css', 'utf8');
const NL = String.fromCharCode(13, 10);
let applied = [];
function swap(name, a, b) {
  if (src.includes(b)) { return; }
  if (!src.includes(a)) { console.log('MISS[' + name + ']:', a.slice(0, 60)); return; }
  src = src.replace(a, b); applied.push(name);
  fs.writeFileSync('app.js', src);
}

/* ⑤ 品牌:侧栏绑定(当前是写死的) + 表单只留一个字段 */
swap('sidebar brand bind', "${icon('M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z')}语文工作台</div>",
     "${icon('M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z')}${E((state.brand&&state.brand.name)||'语文工作台')}</div>");
// 品牌卡:去掉副标语字段与"应用名称"文案,只留左上角名称
swap('brand form single', '<div class="fieldrow"><label class="field">应用名称(≤12字)<input name="bname" maxlength="12" value="${E((state.brand||{}).name||\'语文工作台\')}"></label>',
     '<label class="field">左上角名称(≤12字)<input name="bname" maxlength="12" value="${E((state.brand||{}).name||\'语文工作台\')}"></label>');
swap('brand remove slogan', '<label class="field">副标语(≤20字)<input name="bslogan" maxlength="20" value="${E((state.brand||{}).slogan||\'小学语文教师\')}"></label></div>', '</div>');
swap('brandSave single', "state.brand={name:gv3('bname')||'语文工作台',slogan:gv3('bslogan')||'小学语文教师'};",
     "state.brand={name:gv3('bname')||'语文工作台',slogan:(state.brand&&state.brand.slogan)||'小学语文教师'};");
// 标题联动简化(只用名称)
swap('doc title', "document.title=((state.brand||{}).name||'语文工作台')+String.fromCharCode(183)+((state.brand||{}).slogan||'')",
     "document.title=((state.brand||{}).name||'语文工作台')");

/* ① AI:非桌面优先走服务器代理 /api/ai(失败再直连) */
swap('ai server proxy', "async chat(messages,temperature){if(window.desktop)return window.desktop.ai.chat({base:S.settings.ai.base||'https://api.deepseek.com',model:S.settings.ai.model||'deepseek-flash',key:S.settings.ai.key||'',messages,temperature});",
`async chat(messages,temperature){
  if(window.desktop)return window.desktop.ai.chat({base:S.settings.ai.base||'https://api.deepseek.com',model:S.settings.ai.model||'deepseek-flash',key:S.settings.ai.key||'',messages,temperature});
  const ai=S.settings.ai||{};
  if(ai.key){try{
    const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:ai.base||'https://api.deepseek.com',model:ai.model||'deepseek-flash',key:ai.key,messages,temperature:temperature==null?0.5:temperature})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d.content;
  }catch(e){/* 代理失败退直连 */}}`);

/* ② PDF:引擎初始化重写(内联全局 + Blob worker),删残留动态 import */
const annOld = "  if(!window.pdfjsLib){try{const m=await import('./vendor/pdf.min.mjs');window.pdfjsLib=m;pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.mjs'}catch(e){canvas.replaceWith(Object.assign(document.createElement('p'),{textContent:'PDF 引擎加载失败:'+e.message}));return}}";
const annNew = [
"  if(!window.pdfjsLib){canvas.replaceWith(Object.assign(document.createElement('p'),{textContent:'PDF 引擎未就绪,请刷新页面重试'}));return}",
"  if(!pdfjsLib.GlobalWorkerOptions.workerSrc){",
"    const wc=document.getElementById('pdfjsWorkerCode');",
"    if(wc){const blob=new Blob([wc.textContent],{type:'text/javascript'});pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(blob)}",
"  }"].join(NL);
swap('pdf engine init', annOld, annNew);

/* ③ 成绩:gradeInput 走 change(此前是 click case,input 无 click) */
swap('gradeInput change', "if(el.name==='model'){const w=document.getElementById('modelWarn');if(w)w.hidden=el0.value!=='deepseek-v4-pro'}",
`if(el.name==='model'){const w=document.getElementById('modelWarn');if(w)w.hidden=el0.value!=='deepseek-v4-pro'}
  if(el0.dataset&&el0.dataset.act==='gradeInput'){const g=(state.grades||[]).find(x=>x.id===el0.dataset.grade);if(g){let row=g.scores.find(s=>s.studentId===el0.dataset.sid);if(!row){row={studentId:el0.dataset.sid,score:''};g.scores.push(row)}row.score=el0.value;ui.dirty=true}return}`);

/* ④ 日期精确到分钟 */
swap('planDate minute', "${field('planDate','计划日期',p?.planDate||'','date')}${field('actualDate','实际日期',p?.actualDate||'','date')}",
     "${field('planDate','计划日期(精确到分)',(p?.planDate||'').slice(0,16),'datetime-local')}${field('actualDate','实际日期(精确到分)',(p?.actualDate||'').slice(0,16),'datetime-local')}");
// dateText 兼容 datetime
swap('dateText datetime', 'function dateText', 'function dateText');
// 找 dateText 函数体并扩展(若尚未兼容)
if (!src.includes("replace('T',' ')")) {
  const dtIdx = src.indexOf('function dateText');
  if (dtIdx > 0) {
    const dtEnd = src.indexOf('}', dtIdx);
    const body = src.slice(dtIdx, dtEnd);
    const newBody = body.replace(/return ([^;]+);/, (m, v) => "return String(" + v + ").replace('T',' ');");
    if (newBody !== body) { src = src.slice(0, dtIdx) + newBody + src.slice(dtEnd); applied.push('dateText T'); fs.writeFileSync('app.js', src); }
  }
}

/* ③' 成绩页头部按钮美化(AI 解读 → 图标化大按钮排) */
swap('grades head buttons', "btn('＋ 新建成绩单','newGrade','primary')+(cur?btn('✦ AI 解读','gradeAI','sky sm'):'')",
     "btn('＋ 新建成绩单','newGrade','primary')+(cur?btn('✦ AI 解读成绩','gradeAI','sky'):'')+(gs.length?btn('🖨 打印登记表','printGradeSheet','ghost sm'):'')");

fs.writeFileSync('app.js', src);
console.log('applied:', applied.join(', ') || '(all already present)');
