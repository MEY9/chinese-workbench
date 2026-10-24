// v2.7.0 幂等收尾:全部"检查已存在再改",可重复运行
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let css = fs.readFileSync('style.css', 'utf8');
const NL = String.fromCharCode(13, 10);
let done = [], skipped = [];
function once(name, anchor, insert, mode) {
  // mode 'before'|'after' 插入;先检查标记是否已存在
  if (src.includes(insert.slice(0, Math.min(60, insert.length)))) { skipped.push(name); return; }
  if (!src.includes(anchor)) { console.log('ANCHOR-MISS[' + name + ']:', anchor.slice(0, 60)); return; }
  src = mode === 'before' ? src.replace(anchor, insert + NL + anchor) : src.replace(anchor, anchor + NL + insert);
  done.push(name);
  fs.writeFileSync('app.js', src);
}
function swap(name, a, b) {
  if (src.includes(b)) { skipped.push(name); return; }
  if (!src.includes(a)) { console.log('SWAP-MISS[' + name + ']:', a.slice(0, 60)); return; }
  src = src.replace(a, b); done.push(name);
  fs.writeFileSync('app.js', src);
}

/* ① 恢复模块(视图/路由/cases)——fix_v27 前段已应用? 检查 */
once('views seats/points', 'function gradeStats(scores){',
  ['function newGradeObj(){const c=currentClass();return {id:uid(),classId:c.id,name:\'成绩单 \'+(inClass(state.grades).length+1),date:today(),scores:[]}}',
   'function renderSeats(){if(!currentClass())return noClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,\'zh-CN\'));const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);const cols=6;const grid=[];seats.forEach((id,i)=>{const r=Math.floor(i/cols);(grid[r]=grid[r]||[]).push(id)});return heading(\'座位表\',\'点两个座位交换;打印自动排版。\',btn(\'🖨 打印座位表\',\'doPrintSeats\',\'primary sm\')+btn(\'重置为名册序\',\'resetSeats\',\'ghost sm\'))+\'<div class="card"><div class="seat-grid">\'+grid.map(row=>row.map(id=>{const s=st.find(x=>x.id===id);if(!s)return \'<div class="seat empty-seat">空</div>\';return \'<button class="seat \'+(ui.seatSwapA===id?\'sel\':\'\')+\'" data-act="seatSwap" data-id="\'+A(s.id)+\'" data-no="\'+A(s.no)+\'">\'+E(s.no)+\'号<br><small>\'+E(s.name)+\'</small></button>\'}).join(\'\')).join(\'<div class="aisle"></div>\')+\'</div></div>\'}',
   'function renderPoints(){if(!currentClass())return noClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,\'zh-CN\'));const ranked=st.slice().sort((a,b)=>(state.points[b.no]||0)-(state.points[a.no]||0));return heading(\'班级积分榜\',\'课堂表现即时加减分,自动排序。\')+(st.length?\'<div class="card"><table><thead><tr><th>名次</th><th>学生</th><th>积分</th><th>操作</th></tr></thead><tbody>\'+ranked.map((s,i)=>\'<tr><td>\'+(i+1)+\'</td><td>\'+E(s.no)+\'号 \'+E(s.name)+\'</td><td><b style="color:var(--sky)">\'+(state.points[s.no]||0)+\'</b></td><td><button class="btn grass sm" data-act="pointPlus" data-no="\'+A(s.no)+\'">＋</button> <button class="btn ghost sm" data-act="pointMinus" data-no="\'+A(s.no)+\'">－</button></td></tr>\').join(\'\')+\'</tbody></table></div>\':\'<p class="muted">先导入名册</p>\')}'
  ].join(NL), 'before');
once('routes seats/points', "case'grades':body=renderGrades();break;",
  "case'grades':body=renderGrades();break;case'seats':body=renderSeats();break;case'points':body=renderPoints();break;", 'swap-like');

// routes 用 swap 语义:直接替换整段
swap('routes seats/points', "case'grades':body=renderGrades();break;",
     "case'grades':body=renderGrades();break;case'seats':body=renderSeats();break;case'points':body=renderPoints();break;");

/* 丢失的 click cases:挂 case'saveRecordBtn': 前 */
const CASES = [
"case'newGrade':{const c=currentClass();if(!c)break;const g=newGradeObj();g.scores=inClass(state.students).map(s=>({studentId:s.id,score:''}));state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.dirty=true;await save();renderApp();break}",
"case'pickGrade':ui.gradeSel=el.dataset.id;renderApp();break;",
"case'gradeInput':{const g=(state.grades||[]).find(x=>x.id===el.dataset.grade);if(!g)break;let row=g.scores.find(s=>s.studentId===el.dataset.sid);if(!row){row={studentId:el.dataset.sid,score:''};g.scores.push(row)}row.score=el.value;ui.dirty=true;break}",
"case'saveGrades':{ui.dirty=true;await save();toast('分数已保存,统计已更新');renderApp();break}",
"case'gradeAI':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const st=gradeStats(g.scores||[]);if(!st){toast('先录入分数');break}toast('AI 解读中…');try{const prev=inClass(state.grades).filter(x=>x.id!==g.id&&x.date<=g.date).sort((a,b)=>b.date.localeCompare(a.date))[0];const ps=prev?gradeStats(prev.scores||[]):null;const out=await DesktopAI.chat([{role:'system',content:promptFor('gradeAnalysis')},{role:'user',content:'本次:'+g.name+' 平均'+st.avg+' 优秀率'+st.excRate+'% 及格率'+st.passRate+'% 最高'+st.max+' 最低'+st.min+(ps?';上次:'+ps.avg+' 优秀率'+ps.excRate+'% 及格率'+ps.passRate:';无上次数据')}],0.4);state.aiCache=state.aiCache||{};state.aiCache['grade:'+g.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}",
"case'printGradeSheet':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const c=currentClass();const byId={};inClass(state.students).forEach(s=>byId[s.id]=s);const rows=(g.scores||[]).map((s,i)=>{const stu=byId[s.studentId]||{no:'?',name:'?'};return '<tr><td>'+(i+1)+'</td><td>'+E(stu.no)+'号</td><td>'+E(stu.name)+'</td><td style=\"width:24mm\"></td></tr>'}).join('');printHTML(printHeader('成绩登记表 · '+E(g.name),'班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>分数</th></tr>'+rows+'</table>');break}",
"case'printHW':{const c=currentClass();if(!c)break;const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+E(s.no)+'号</td><td>'+E(s.name)+'</td><td style=\"width:20mm\"></td><td style=\"width:20mm\"></td><td style=\"width:20mm\"></td></tr>').join('');printHTML(printHeader('作业收缴登记表','班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>已交</th><th>未交原因</th><th>订正</th></tr>'+rows+'</table>');break}",
"case'printReciteTrack':{const c=currentClass();if(!c)break;const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>{const rl=(state.reciteLogs||[]).filter(r=>r.studentId===s.id);return '<tr><td>'+(i+1)+'</td><td>'+E(s.no)+'号</td><td>'+E(s.name)+'</td>'+'<td style=\"width:16mm\"></td>'.repeat(8)+'<td>'+rl.length+'次</td></tr>'}).join('');printHTML(printHeader('背诵听写默写跟踪表','班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>累计</th></tr>'+rows+'</table>');break}",
"case'printSeats':{ui.view='seats';renderApp();break}",
"case'doPrintSeats':{const c=currentClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);const cols=6;let html='';for(let i=0;i<seats.length;i+=cols){html+='<tr>'+(seats.slice(i,i+cols).map(id=>{const s=st.find(x=>x.id===id);return '<td style=\"height:16mm;text-align:center\">'+(s?E(s.no)+'号 '+E(s.name):'空')+'</td>'}).join('')+(seats.slice(i,i+cols).length<cols?'<td colspan=\"'+(cols-seats.slice(i,i+cols).length)+'\"></td>':'')+'</tr>')}printHTML(printHeader('座位表','班级:'+E(c.name),'')+'<table class=\"print-table\">'+html+'</table><p style=\"margin-top:5mm;text-align:center\">讲台</p>');break}",
"case'resetSeats':{state.seats=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);ui.dirty=true;await save();renderApp();break}",
"case'seatSwap':{state.seats=state.seats&&state.seats.length?state.seats:inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);if(!ui.seatSwapA){ui.seatSwapA=el.dataset.id;renderApp();break}if(ui.seatSwapA===el.dataset.id){ui.seatSwapA=null;renderApp();break}const i=state.seats.indexOf(ui.seatSwapA),j=state.seats.indexOf(el.dataset.id);if(i>=0&&j>=0){const t=state.seats[i];state.seats[i]=state.seats[j];state.seats[j]=t;ui.dirty=true;await save()}ui.seatSwapA=null;renderApp();break}",
"case'openPoints':ui.view='points';renderApp();break;",
"case'pointPlus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=(state.points[no]||0)+1;ui.dirty=true;await save();renderApp();break}",
"case'pointMinus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=Math.max(0,(state.points[no]||0)-1);ui.dirty=true;await save();renderApp();break}",
"case'aiPrep':{const c=currentClass();if(!c)break;const l=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));if(!l)return toast('当前课次无词库数据');toast('AI 教案草稿生成中…');try{const out=await DesktopAI.chat([{role:'system',content:promptFor('prepDraft')},{role:'user',content:'部编版三年级上册 第'+l.no+'课 '+l.title+';写字表:'+l.chars.map(x=>x.c).join('')+';词语:'+l.words.slice(0,10).map(x=>x.w).join('、')}],0.5);const p=state.preps&&state.preps.find(x=>x.classId===c.id&&String(x.lessonNo)===String(ui.teachLesson));if(p){p.goals='[AI 草稿]'+String.fromCharCode(10)+out;ui.dirty=true;await save();toast('草稿已填入备课记录,请修改后保存')}else toast('请先保存本课备课记录,再生成草稿');renderApp()}catch(e){toast('AI 失败:'+e.message)}break}",
"case'aiTest':{const f=el.closest('.card');const gv=n=>{const e2=f&&f.querySelector('[name='+n+']');return e2?e2.value.trim():''};const base=gv('base')||S.settings.ai.base||'https://api.deepseek.com',model=gv('model')||S.settings.ai.model||'deepseek-flash',key=gv('key')||S.settings.ai.key||'';if(!key)return toast('请先填写 API Key');toast('测试连接中…');try{const t0=performance.now();await DesktopAI.chatDirect(base,model,key,[{role:'user',content:'你好'}],0);toast('✓ 连接成功('+Math.round(performance.now()-t0)+'ms)')}catch(e){toast('✕ 连接失败:'+String(e.message).slice(0,60))}break}",
"case'promptsSave':{const pf=document.querySelector('form[data-form=prompts]');if(!pf)break;state.settings.prompts=state.settings.prompts||{};Object.keys(PROMPTS_DEFAULT).forEach(k=>{const elx=pf.elements.namedItem('p_'+k);if(elx){const v=elx.value.trim();if(v&&v!==PROMPTS_DEFAULT[k])state.settings.prompts[k]=v;else delete state.settings.prompts[k]}});delete ui.formDrafts['prompts|'];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();renderApp();toast('提示词已保存');break}",
];
once('grade/table cases', "case'saveRecordBtn':{", CASES.join(NL), 'before');

/* ② dirty 清理(saveRecordBtn/widgetSave 尾部核对) */
// saveRecordBtn:已有 delete 行?检查其后是否还残留 ui.dirty=true;
const srb = src.indexOf("case'saveRecordBtn':{");
if (srb > 0) {
  const tail = src.slice(srb, srb + 1400);
  if (tail.includes('delete ui.formDrafts[formDraftKey(rf)];ui.dirty=Object.keys(ui.formDrafts).length>0;' + NL + '  ui.dirty=true;')) {
    src = src.replace('delete ui.formDrafts[formDraftKey(rf)];ui.dirty=Object.keys(ui.formDrafts).length>0;' + NL + '  ui.dirty=true;await save();',
                      'delete ui.formDrafts[formDraftKey(rf)];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();');
    done.push('srb dirty dedup'); fs.writeFileSync('app.js', src);
  } else skipped.push('srb dirty dedup');
}
const wsv = src.indexOf("case'widgetSave':{");
if (wsv > 0) {
  const tail2 = src.slice(wsv, wsv + 900);
  if (!tail2.includes('delete ui.formDrafts[formDraftKey(wf)]')) {
    // 在 ui.dirty=true;await save();renderApp();toast('小组件已更新') 前插清理
    const marker = "ui.dirty=true;await save();renderApp();toast('小组件已更新');";
    if (tail2.includes(marker)) {
      src = src.replace(marker, "delete ui.formDrafts[formDraftKey(wf)];ui.dirty=Object.keys(ui.formDrafts).length>0;await save();renderApp();toast('小组件已更新');");
      done.push('widgetSave dirty'); fs.writeFileSync('app.js', src);
    }
  } else skipped.push('widgetSave dirty');
}

/* ③ DesktopAI:hasKey 双通道 + chatDirect */
swap('DesktopAI hasKey', "const DesktopAI={async hasKey(){return window.desktop?Boolean(await window.desktop.ai.getKey()):Boolean(S.settings.ai&&S.settings.ai.key)},",
"const DesktopAI={async hasKey(){return window.desktop?Boolean(await window.desktop.ai.getKey()||S.settings.ai&&S.settings.ai.key):Boolean(S.settings.ai&&S.settings.ai.key)},");
once('chatDirect', "async chat(messages,temperature){",
"async chatDirect(base,model,key,messages,temperature){if(window.desktop)return window.desktop.ai.chat({base,model,key,messages,temperature});const r=await fetch(base.replace(/\\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages,temperature})});if(!r.ok)throw new Error('HTTP '+r.status);return (await r.json()).choices[0].message.content},", 'before');
// chat 桌面分支带 key
swap('chat passkey', "if(window.desktop)return window.desktop.ai.chat({base:S.settings.ai.base||'https://api.deepseek.com',model:S.settings.ai.model||'deepseek-flash',messages,temperature});",
     "if(window.desktop)return window.desktop.ai.chat({base:S.settings.ai.base||'https://api.deepseek.com',model:S.settings.ai.model||'deepseek-flash',key:S.settings.ai.key||'',messages,temperature});");

/* ④ 提示词体系 */
once('PROMPTS table', 'const CONFIRM_VERBS=', [
'const PROMPTS_DEFAULT={',
"  markAnalysis:'你是小学语文特级教师。根据听写错频数据,输出:①共性错误规律(80字内)②讲评重点 2 条 ③复练建议 1 条。条理清晰,不要客套。',",
"  reciteGap:'你是小学语文老师助手。把课文改写成挖空版:把最关键的词替换为⟦答案⟧占位(保留原字在占位内)。只输出改写后的课文,不要解释,挖空 6 到 12 处。',",
"  reportCard:'你是小学语文班主任,写期末评语:100字内,基于数据先扬后抑,语气温暖鼓励,结尾给建议。直接输出评语正文。不要出现姓名,用\"你\"称呼。',",
"  studentSummary:'你是小学语文老师。基于给出的真实数据写学期小结,80 字内,先扬后抑,语气鼓励。只输出小结正文。',",
"  gradeAnalysis:'你是小学语文教研员。基于成绩统计写解读:120字内,指出总体水平、与上次对比的变化、2 条教学建议。只输出正文。',",
"  prepDraft:'你是小学语文特级教师。按\"教学目标 3 条/教学环节 4 步/提问链 3 个/作业 2 项\"输出教案草稿,markdown 列表,简洁实用。',",
"  annAnalysis:'你是小学语文特级教师。老师在教学材 PDF 上划了重点(以笔画区域相对坐标提供)。请推测这些划线针对的教学内容,输出:①教学重点归纳(60字内)②2 个课堂提问建议 ③板书要点。条理清晰。',",
"  annLesson:'你是小学语文特级教师。基于教师标注分布与课次词库,输出整课备课建议:教学目标(3条)/教学环节(4步)/提问链(3个)/作业设计(2项)。markdown 列表,简洁。',",
"  newsSummary:'你是语文老师助手。对给出的今日新闻输出:①三句话摘要;②「教学联想」:挑 1 条新闻说明可作课堂写作素材或与语文课结合的点(60字内)。',",
"  parentLetter:'你是小学语文班主任。基于学生数据写一段发给家长的沟通文字:120字内,先肯定再建议,语气亲切,不出现姓名,用\"孩子\"称呼。只输出正文。',",
"};",
"function promptFor(key){const p=(state.settings&&state.settings.prompts)||{};return p[key]||PROMPTS_DEFAULT[key]}",
''].join(NL), 'before');

swap('defaultState prompts', "settings:{ai:{key:'',base:'https://api.deepseek.com',model:'deepseek-flash'},voice:''}",
     "settings:{ai:{key:'',base:'https://api.deepseek.com',model:'deepseek-flash'},voice:'',prompts:{}}");

// 调用点:把 system 字面量替换为 promptFor(key)(逐个 swap)
const promptSites = [
  ["{role:'system',content:'你是小学语文特级教师。根据听写错频数据,输出:①共性错误规律(80字内)②讲评重点 2 条 ③复练建议 1 条。条理清晰,不要客套。'}", 'markAnalysis'],
  ["{role:'system',content:'你是小学语文老师助手。把课文改写成挖空版:把最关键的词替换为⟦答案⟧占位(保留原字在占位内)。只输出改写后的课文,不要解释,挖空 6 到 12 处。'}", 'reciteGap'],
  ["{role:'system',content:'你是小学语文班主任,写期末评语:100字内,基于数据先扬后抑,语气温暖鼓励,结尾给建议。直接输出评语正文。不要出现姓名,用\"你\"称呼。'}", 'reportCard'],
  ["{role:'system',content:'你是小学语文老师。基于给出的真实数据写学期小结,80 字内,先扬后抑,语气鼓励。只输出小结正文。'}", 'studentSummary'],
  ["{role:'system',content:'你是小学语文教研员。基于成绩统计写解读:120字内,指出总体水平、与上次对比的变化、2 条教学建议。只输出正文。'}", 'gradeAnalysis'],
  ["{role:'system',content:'你是小学语文特级教师。按\"教学目标 3 条/教学环节 4 步/提问链 3 个/作业 2 项\"输出教案草稿,markdown 列表,简洁实用。'}", 'prepDraft'],
  ["{role:'system',content:'你是小学语文特级教师。老师在教学材 PDF 上划了重点(以笔画区域描述提供:页面宽高的相对坐标)。请推测这些划线针对的教学内容,输出:①教学重点归纳(60字内)②2 个课堂提问建议 ③板书要点。条理清晰。'}", 'annAnalysis'],
  ["{role:'system',content:'你是小学语文特级教师。基于教师标注分布与课次词库,输出整课备课建议:教学目标(3条)/教学环节(4步)/提问链(3个)/作业设计(2项)。markdown 列表,简洁。'}", 'annLesson'],
  ["{role:'system',content:'你是语文老师助手。对给出的今日新闻输出:①三句话摘要;②「教学联想」:挑 1 条新闻说明可作课堂写作素材或与语文课结合的点(60字内)。'}", 'newsSummary'],
  ["{role:'system',content:'你是小学语文班主任。基于学生数据写一段发给家长的沟通文字:120字内,先肯定再建议,语气亲切,不出现姓名,用\"孩子\"称呼。只输出正文。'}", 'parentLetter'],
];
for (const [lit, key] of promptSites) {
  swap('prompt:' + key, lit, "{role:'system',content:promptFor('" + key + "')}");
}

/* ⑤ 设置页:AI 卡测试按钮 + 按钮语义 + 提示词编辑卡 */
swap('AI save btn', '<button class="btn" type="submit">保存配置</button>',
     '<button class="btn primary" type="submit">保存 AI 配置(本卡独立保存)</button> <button type="button" class="btn" data-act="aiTest">测试连接</button>');
swap('widget btn label', 'data-act="widgetSave">保存小组件</button>',
     'data-act="widgetSave">保存小组件(本卡独立保存)</button>');
swap('brand btn label', "case'brand':", "case'brand':"); // brand 走 submit,标签在 HTML
swap('brand html label', '>保存品牌</button>', '>保存品牌(本卡独立保存)</button>');

once('prompts card', '<section class="card"><h2>品牌(左侧栏名称与标语)</h2>',
['<section class="card"><h2>AI 提示词(高级,可自定义)</h2><form data-form="prompts" class="stack">',
'<details><summary>错词分析 · 批改页</summary><textarea name="p_markAnalysis" rows="3">${E(promptFor(\'markAnalysis\'))}</textarea></details>',
'<details><summary>背诵挖空 · 背诵训练</summary><textarea name="p_reciteGap" rows="3">${E(promptFor(\'reciteGap\'))}</textarea></details>',
'<details><summary>期末评语 · 评语工作台</summary><textarea name="p_reportCard" rows="3">${E(promptFor(\'reportCard\'))}</textarea></details>',
'<details><summary>学期小结 · 学生档案</summary><textarea name="p_studentSummary" rows="3">${E(promptFor(\'studentSummary\'))}</textarea></details>',
'<details><summary>成绩解读 · 成绩册</summary><textarea name="p_gradeAnalysis" rows="3">${E(promptFor(\'gradeAnalysis\'))}</textarea></details>',
'<details><summary>教案草稿 · 教学页</summary><textarea name="p_prepDraft" rows="3">${E(promptFor(\'prepDraft\'))}</textarea></details>',
'<details><summary>划线分析 · 教材标注</summary><textarea name="p_annAnalysis" rows="3">${E(promptFor(\'annAnalysis\'))}</textarea></details>',
'<details><summary>整课分析 · 教材标注</summary><textarea name="p_annLesson" rows="3">${E(promptFor(\'annLesson\'))}</textarea></details>',
'<details><summary>新闻摘要 · 新闻页</summary><textarea name="p_newsSummary" rows="3">${E(promptFor(\'newsSummary\'))}</textarea></details>',
'<details><summary>家长沟通稿 · 学生档案</summary><textarea name="p_parentLetter" rows="3">${E(promptFor(\'parentLetter\'))}</textarea></details>',
'<div><button type="button" class="btn sky sm" data-act="promptsSave">保存提示词(本卡独立保存)</button> <small class="muted">清空即恢复默认</small></div></form></section>',
''].join(NL), 'before');

fs.writeFileSync('app.js', src);
console.log('DONE. applied:', done.length, '| skipped(已存在):', skipped.length);
console.log('applied:', done.join(', '));
