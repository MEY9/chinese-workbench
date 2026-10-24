// v2.9.0 十项渲染层升级(幂等 swap;git/CI 单独处理)
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let css = fs.readFileSync('style.css', 'utf8');
const NL = String.fromCharCode(13, 10);
const applied = [];
function swap(name, a, b) {
  if (src.includes(b)) { return; }
  if (!src.includes(a)) { console.log('MISS[' + name + ']:', a.slice(0, 64)); return; }
  src = src.replace(a, b); applied.push(name); fs.writeFileSync('app.js', src);
}

/* ③ 手动待办多余大括号 */
swap('brace fix', '${renderManualTasks()}}</div></section>', '${renderManualTasks()}</div></section>');

/* ④ 顶栏日期精确到秒(每秒刷新) */
swap('topbar clock', '<span class="right small muted">${E(today())}</span>',
     '<span class="right small muted" id="nowText">${E(nowStr())}</span>');
swap('nowStr helper', 'function today()', 'function nowStr(){const d=new Date();const p=n=>String(n).padStart(2,\'0\');return d.getFullYear()+\'-\'+p(d.getMonth()+1)+\'-\'+p(d.getDate())+\' \'+p(d.getHours())+\':\'+p(d.getMinutes())+\':\'+p(d.getSeconds())}\nfunction today()');
swap('clock interval', 'restoreFormDrafts();tintStatusSelects();',
     'restoreFormDrafts();tintStatusSelects();enhanceSelects();if(!window.__clockTimer){window.__clockTimer=setInterval(()=>{const el=document.getElementById(\'nowText\');if(el)el.textContent=nowStr()},1000)}');

/* ⑤ 自绘下拉框组件 */
swap('enhanceSelects fn', 'function tintStatusSelects(){', [
'function enhanceSelects(){let all;try{all=document.querySelectorAll(\'select\')}catch(e){return}if(!all||!all.forEach)return;',
'  all.forEach(sel=>{',
'    if(sel.__enh)return;sel.__enh=1;',
'    const wrap=document.createElement(\'div\');wrap.className=\'sel-wrap\';',
'    sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);sel.classList.add(\'sel-native\');',
'    const btn=document.createElement(\'button\');btn.type=\'button\';btn.className=\'sel-btn\';',
'    const list=document.createElement(\'div\');list.className=\'sel-list\';list.hidden=true;',
'    const syncBtn=()=>{const o=sel.selectedOptions[0];btn.innerHTML=\'<span class="sel-val">\'+E(o?o.textContent.trim():\'\')+\'</span><i class="sel-ar"></i>\'};',
'    const buildList=()=>{list.innerHTML=[...sel.options].map((o,i)=>\'<button type="button" class="sel-opt\'+(i===sel.selectedIndex?\' on\':\'\')+\'" data-i="\'+i+\'">\'+E(o.textContent.trim())+\'</button>\').join(\'\')};',
'    btn.addEventListener(\'click\',e=>{e.stopPropagation();document.querySelectorAll(\'.sel-list\').forEach(l=>{if(l!==list)l.hidden=true});if(list.hidden)buildList();list.hidden=!list.hidden});',
'    list.addEventListener(\'click\',e=>{const b=e.target.closest(\'.sel-opt\');if(!b)return;sel.selectedIndex=+b.dataset.i;sel.dispatchEvent(new Event(\'change\',{bubbles:true}));syncBtn();list.hidden=true});',
'    document.addEventListener(\'click\',()=>{list.hidden=true});',
'    sel.addEventListener(\'change\',syncBtn);',
'    wrap.appendChild(btn);wrap.appendChild(list);syncBtn();',
'  });',
'}',
'function tintStatusSelects(){'].join(NL));

/* ⑥ 新闻页去掉朗读 */
swap('news speak off', "<div class=" + '"row mt"' + ">${btn('🔊 朗读全部','newsSpeak','sky sm')}${btn('🛑 停止朗读','newsStop','ghost sm')}</div>", '');
swap('newsSpeak case off', "case'newsSpeak':{const n=ui.news;if(!n.list.length){toast('先刷新拉取新闻');break}TTS.speak('今天'+(n.date||'')+'。'+n.list.slice(0,10).join('。'),{rate:0.95});break}", '');
swap('newsStop case off', "case'newsStop':speechSynthesis.cancel();break;", '');

/* ⑦+⑧+⑪ 成绩册:两级页面 + 删除 + 及格线 */
// gradeStats 增加及格线参数
swap('gradeStats passline', "function gradeStats(scores){",
     "function passLine(){return Number((state.settings&&state.settings.passLine))||60}\nfunction gradeStats(scores){");
swap('gradeStats use pass', "const excellent=nums.filter(n=>n>=85).length, pass=nums.filter(n=>n>=60).length;",
     "const excellent=nums.filter(n=>n>=85).length, pass=nums.filter(n=>n>=passLine()).length;");
// renderGrades 整体改为两级(定位函数首尾)
const rgStart = src.indexOf('function renderGrades(){');
const rgEnd = src.indexOf('function renderSeats(){');
if (rgStart < 0 || rgEnd < rgStart) { console.log('MISS renderGrades bounds'); }
else {
  const newGrades = [
'function renderGrades(){',
'  if(!currentClass())return noClass();',
"  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));",
"  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));",
'  // ===== 列表页 =====',
'  if(!ui.gradeDetail){',
"    return heading('成绩册','成绩单列表;点击进入录入。',btn('＋ 新建成绩单','newGrade','primary'))+",
"    `<section class=\"card\"><h2>及格线</h2><form data-form=\"passLine\" class=\"row\">${field('pass','及格分数线(默认60)',(state.settings&&state.settings.passLine)||60,'number','min=\"0\" max=\"100\"')}<button class=\"btn sky sm\" type=\"submit\">保存</button></form></section>`+",
"    (gs.length?`<div class=\"stack\">${gs.map(g=>{const s2=gradeStats(g.scores||[]);",
"      return `<div class=\"card\" style=\"padding:14px 18px\"><div class=\"row space\"><div><b style=\"font-size:16px\">${E(g.name)}</b> <small class=\"muted\">${E(g.date)}</small><br><small>平均 <b>${s2?s2.avg:'—'}</b> · 及格率(≥${passLine()}) <b>${s2?s2.passRate+'%':'—'}</b> · 已录 ${s2?s2.n:0} 人</small></div>",
"      <span class=\"row gap8\">${btn('进入','pickGrade','primary sm',`data-id=\"${A(g.id)}\"`)}${btn('删除','delGrade','sm danger',`data-id=\"${A(g.id)}\"`)}</span></div></div>`}).join('')}</div>`",
"    :'<div class=\"card empty\"><div class=\"mark\">田</div><h2>还没有成绩单</h2><p>点「新建成绩单」创建。</p></div>');",
'  }',
'  // ===== 详情页 =====',
'  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];',
'  if(cur)ui.gradeSel=cur.id;',
'  const stats=cur?gradeStats(cur.scores||[]):null;',
"  const prev=cur?gs.filter(x=>x.id!==cur.id&&x.date<=cur.date).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;",
'  const prevMap={};if(prev)(prev.scores||[]).forEach(s=>prevMap[s.studentId]=Number(s.score));',
'  const scores=cur?(cur.scores||[]):[];',
'  const byStu={};scores.forEach(s=>byStu[s.studentId]=s);',
"  return heading('成绩册 · '+E(cur?cur.name:''),(cur?('创建于 '+E(cur.date)):''),btn('‹ 返回列表','gradeBack','sm'))+",
"  `<div class=\"grid\" style=\"grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px\">",
"    <div class=\"inset\" style=\"text-align:center\"><small>平均分</small><b style=\"display:block;font-size:24px\">${stats?stats.avg:'—'}</b></div>",
"    <div class=\"inset\" style=\"text-align:center\"><small>最高 / 最低</small><b style=\"display:block;font-size:24px\">${stats?stats.max+' / '+stats.min:'—'}</b></div>",
"    <div class=\"inset\" style=\"text-align:center\"><small>优秀率(≥85)</small><b style=\"display:block;font-size:24px\">${stats?stats.excRate+'%':'—'}</b></div>",
"    <div class=\"inset\" style=\"text-align:center\"><small>及格率(≥${passLine()})</small><b style=\"display:block;font-size:24px\">${stats?stats.passRate+'%':'—'}</b></div>",
'  </div>',
"  ${state.aiCache&&state.aiCache['grade:'+cur.id]?`<div class=\"card ai-card\"><h2>✦ AI 成绩解读</h2><p class=\"small\">${E(state.aiCache['grade:'+cur.id])}</p></div>`:''}",
"  <section class=\"card\"><h2>${E(cur.name)} · 分数录入</h2>",
'  <div class="tablewrap"><table><thead><tr><th>学生</th><th>分数</th><th>等级</th><th>较上次</th></tr></thead><tbody>',
'  ${st.map(s=>{const sc=byStu[s.id];const v=sc?Number(sc.score):null;const pv=prevMap[s.id];',
"    const grade=v==null?'':(v>=85?'优':v>=75?'良':v>=passLine()?'及格':'待及格');",
"    const gcls=v==null?'':(v>=75?'status blue':v>=passLine()?'status':'status magenta');",
'    const diff=(v!=null&&pv!=null)?(v-pv):null;',
'    return `<tr><td>${E(s.no)}号 ${E(s.name)}</td>',
'      <td><input type="number" min="0" max="100" value="${v==null?\'\':v}" data-act="gradeInput" data-grade="${A(cur.id)}" data-sid="${A(s.id)}" style="width:76px"></td>',
"      <td><span class=\"${gcls}\">${grade}</span></td>",
"      <td>${diff==null?'—':'<b style=\"color:'+(diff>=0?'var(--grass)':'var(--coral)')+'\">'+(diff>0?'+':'')+diff+'</b>'}</td></tr>`}).join('')}",
"  ${st.length?'':'<tr><td colspan=4>请先导入名册</td></tr>'}",
'  </tbody></table></div>',
"  <div class=\"row mt\">${btn('保存全部分数','saveGrades','primary sm')}${btn('✦ AI 解读','gradeAI','sky sm')}${btn('🖨 打印登记表','printGradeSheet','ghost sm')}</div>",
'  </section>`;',
'}' + NL + NL
  ].join(NL);
  src = src.slice(0, rgStart) + newGrades + src.slice(rgEnd);
  applied.push('grades two-level');
  fs.writeFileSync('app.js', src);
}
// newGrade 进入详情;pickGrade=进入;gradeBack
swap('newGrade detail', "state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.dirty=true;await save();renderApp();break}",
     "state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.gradeDetail=g.id;ui.dirty=true;await save();renderApp();break}");
swap('pickGrade detail', "case'pickGrade':ui.gradeSel=el.dataset.id;renderApp();break;",
     "case'pickGrade':ui.gradeSel=el.dataset.id;ui.gradeDetail=el.dataset.id;renderApp();break;" + NL +
     "case'gradeBack':ui.gradeDetail=null;renderApp();break;");
// 删除成绩单(确认前置 + case)
swap('delGrade pre-confirm', "  if (act === 'delRecord') {",
     "  if (act === 'delGrade') {\n    const g0 = (state.grades||[]).find(x => x.id === el.dataset.id);\n    if (g0 && !(await uiConfirm('删除「' + g0.name + '」及其全部分数?', { danger: true, ok: '删除' }))) return;\n  }\n  if (act === 'delRecord') {");
swap('delGrade case', "case'gradeBack':ui.gradeDetail=null;renderApp();break;",
     "case'gradeBack':ui.gradeDetail=null;renderApp();break;" + NL +
     "case'delGrade':{state.grades=(state.grades||[]).filter(x=>x.id!==el.dataset.id);if(ui.gradeSel===el.dataset.id){ui.gradeSel=null;ui.gradeDetail=null}ui.dirty=true;await save();renderApp();toast('成绩单已删除');break}");
// passLine 表单 submit case
swap('passLine case', "case'record':{const c=currentClass();if(!c)break;",
     "case'passLine':{const v=Number(formVal(form,'pass'));state.settings=state.settings||{};state.settings.passLine=(v>=0&&v<=100)?v:60;ui.dirty=true;await save();renderApp();toast('及格线已设为 '+state.settings.passLine);break}" + NL + "case'record':{const c=currentClass();if(!c)break;");
// gradeAI/aiCache 里 cur.id 兼容(已有)
// saveGrades/gradeAI 的 gradeSel fallback 已有

/* ⑪ 档案两级:先列表后详情 */
const pfStart = src.indexOf('function renderProfile(){');
const pfEnd = src.indexOf('function profileDataSummary(');
if (pfStart < 0 || pfEnd < pfStart) { console.log('MISS renderProfile bounds'); }
else {
  const head = [
'function renderProfile(){',
'  if(!currentClass())return noClass();',
"  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));",
'  if(!st.length)return heading(\'学生档案\',\'一生一档。\')+\'<div class="card empty"><div class="mark">田</div><h2>还没有学生</h2><p>先到「班级」导入名册。</p></div>\';',
'  // ===== 学生列表页 =====',
'  if(!ui.profileStudent){',
"    return heading('学生档案','点击学生进入一生一档。')+'<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px\">'+st.map(s=>{",
"      const recs=(state.records||[]).filter(r=>r.studentId===s.id);",
'      const warn=recs.filter(r=>r.type===\'需关注\').length;',
'      return \'<button class="card stu-card" style="text-align:left;padding:16px" data-act="pickStudent" data-id="\' + A(s.id) + \'"><b style="font-size:20px">\' + E(s.no) + \'号</b> \' + E(s.name) + \'<br><small class="muted">记录 \' + recs.length + \' 条\' + (warn ? \' · <span style="color:var(--coral)">需关注</span>\' : \'\') + \'</small></button>\'}).join(\'\') + \'</div>\';',
'  }',
'  const cur=st.find(x=>x.id===ui.profileStudent);if(!cur){ui.profileStudent=null;return renderProfile()}',
'  state.records=state.records||[];state.reciteLogs=state.reciteLogs||[];state.aiCache=state.aiCache||{};',
'  const recs=state.records.filter(r=>r.studentId===cur.id).sort((a,b)=>b.date.localeCompare(a.date));',
'  const dictHist=inClass(state.dictations).map(d=>({date:d.date,n:(d.studentMarks?.[cur.id]?.wrongWords||[]).length,marked:d.studentMarks?.[cur.id]?.status||\'未录\'})).filter(x=>x.marked!==\'未录\').slice(-5);',
'  const g=[];inClass(state.assignments).forEach(a=>(a.scores||[]).forEach(s=>{if(s.studentId===cur.id)g.push(Number(s.score||0))}));',
'  const avg=g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):null;',
'  const maxN=Math.max(1,...dictHist.map(x=>x.n));',
'  return heading(\'学生档案 · 一生一档\',\'学业概览自动聚合;观察记录随手记;AI 小结基于真实记录且已脱敏。\',btn(\'‹ 返回列表\',\'profileBack\',\'sm\'))+'
  ].join(NL);
  // 原 renderProfile 的 return heading(...) 起替换 head,保留其后正文
  const origBody = src.slice(pfStart, pfEnd);
  const retIdx = origBody.indexOf("return heading('学生档案");
  const bodyAfterHeading = origBody.slice(retIdx);
  // bodyAfterHeading 以 return heading(...) + `...` 开头 —— 去掉其中的 chips 行
  let body = bodyAfterHeading.replace(/^return heading\([^)]+\)\+/, '');
  body = body.replace(/`<div class="chips">\$\{st\.map\(x=>[^\n]*\n?/, '`');
  const newProfile = head + NL + body + NL;
  src = src.slice(0, pfStart) + newProfile + src.slice(pfEnd);
  applied.push('profile two-level');
  fs.writeFileSync('app.js', src);
}
swap('profileBack case', "case'pickStudent':ui.profileStudent=el.dataset.id;renderApp();break;",
     "case'pickStudent':ui.profileStudent=el.dataset.id;renderApp();break;" + NL + "case'profileBack':ui.profileStudent=null;renderApp();break;");

/* ② 全局 busy 状态样式 + ⑨ 移除登记教材表单 */
const rpStart = src.indexOf('<section class="card"><h2>登记教材元数据</h2>');
if (rpStart >= 0) {
  const rpEnd = src.indexOf('</section>', rpStart) + '</section>'.length;
  src = src.slice(0, rpStart) + src.slice(rpEnd);
  applied.push('remove book form'); fs.writeFileSync('app.js', src);
}

/* CSS:busy 指示 + 自绘下拉 + 学生卡 */
css += NL + NL + [
'/* ============ L14 v2.9:busy 指示 / 自绘下拉 / 学生卡 ============ */',
'body:has(#app[aria-busy="true"])::after{content:"";position:fixed;top:0;left:0;right:0;height:3px;z-index:200;background:linear-gradient(90deg,var(--sky),var(--lilac),var(--coral));background-size:200% 100%;animation:busybar 1.1s linear infinite}',
'@keyframes busybar{to{background-position:-200% 0}}',
'body:has(#app[aria-busy="true"]) #app{opacity:.72}',
'.sel-wrap{position:relative;display:block}',
'.sel-native{position:absolute;inset:0;opacity:0;pointer-events:none;width:100%;height:100%}',
'.sel-btn{width:100%;text-align:left;display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid var(--line-strong);border-radius:10px;padding:9px 12px;box-shadow:0 1px 2px -1px rgba(160,120,60,.15);transition:border-color .15s}',
'.sel-btn:hover{border-color:#DEC9A4}',
'.sel-btn .sel-val{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.sel-ar{width:0;height:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:6px solid var(--sky);flex:none}',
'.sel-list{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1.5px solid var(--line-strong);border-radius:12px;box-shadow:0 10px 30px -8px rgba(28,39,69,.35);z-index:60;max-height:260px;overflow:auto;padding:5px}',
'.sel-opt{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 12px;border-radius:8px;font-size:14px;color:var(--ink)}',
'.sel-opt:hover{background:var(--mango-bg)}',
'.sel-opt.on{background:var(--sky-bg);color:var(--sky);font-weight:700}',
'.stu-card{cursor:pointer;transition:transform .15s,box-shadow .15s}',
'.stu-card:hover{transform:translateY(-3px)}'
].join(NL);
fs.writeFileSync('style.css', css);
console.log('applied:', applied.join(', '));
