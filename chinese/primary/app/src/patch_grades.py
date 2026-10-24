# -*- coding: utf-8 -*-
"""F17 成绩册 + F9 表格包 + A9/A6/A10/A11 场景 AI:数据模型与渲染"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)
BS = chr(92)  # backslash

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor count=%r: %s' % (src.count(old), old[:70])
    src = src.replace(old, new)
    open('app.js', 'w', encoding='utf-8').write(src)

# ============ 1. NAV:成绩册入口(挂教学下?独立一级)——独立「成绩」一级 ============
rep("['news','新闻','M3 5h14v10H7l-4 4V5zm14 3h4v12l-4-4h-2z'],",
    "['grades','成绩','M4 19V5m0 14h16M8 15v-4m4 4V8m4 7v-6'],['news','新闻','M3 5h14v10H7l-4 4V5zm14 3h4v12l-4-4h-2z'],")

# ============ 2. ui 状态 + defaultState + 迁移 ============
rep("news:{list:[],date:'',source:'',err:''},newsLoading:false,",
    "news:{list:[],date:'',source:'',err:''},newsLoading:false,gradeSel:null,gradeEditing:null,seatEdit:false,")
rep("aiCache:{},newsCache:{", "aiCache:{},grades:[],seats:[],points:{},newsCache:{")
rep("state.newsCache=state.newsCache||{date:'',list:[],source:''};",
    "state.newsCache=state.newsCache||{date:'',list:[],source:''};state.grades=state.grades||[];state.seats=state.seats||[];state.points=state.points||{};")

# 注意:server.py 校验 COLLECTIONS 不含 grades/seats —— grades 等存进 settings 之外的自定义键会被
# store.write 的 root 序列化接受(metadata payload 任意 JSON)。但 read() 恢复时 root 键也在。OK。

# ============ 3. 路由 ============
rep("case'news':body=renderNews();break;",
    "case'news':body=renderNews();break;case'grades':body=renderGrades();break;")

# ============ 4. 成绩册视图 ============
rep("const NEWS_SOURCES=[",
"""function gradeStats(scores){
  const nums=scores.map(s=>Number(s.score)).filter(n=>!isNaN(n));
  if(!nums.length)return null;
  const avg=nums.reduce((a,b)=>a+b,0)/nums.length;
  const sorted=[...nums].sort((a,b)=>a-b);
  const excellent=nums.filter(n=>n>=85).length, pass=nums.filter(n=>n>=60).length;
  return {avg:Math.round(avg*10)/10, max:sorted[sorted.length-1], min:sorted[0],
          excRate:Math.round(excellent/nums.length*100), passRate:Math.round(pass/nums.length*100), n:nums.length};
}
function renderGrades(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];
  const stats=cur?gradeStats(cur.scores||[]):null;
  const byId={};st.forEach(s=>byId[s.id]=s);
  // 两次对比
  const prev=cur?gs.filter(x=>x.date<=cur.date&&x.id!==cur.id).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const prevMap={};if(prev)prev.scores.forEach(s=>prevMap[s.studentId]=Number(s.score));
  return heading('成绩册','录入、统计与趋势;AI 解读基于真实分数。',btn('＋ 新建成绩单','newGrade','primary'))+
  (gs.length?`<div class="chips">${gs.map(x=>`<button class="chip ${x.id===cur?.id?'on':''}" data-act="pickGrade" data-id="${A(x.id)}">${E(x.name)} · ${E(x.date)}</button>`).join('')}</div>`:'');
  }
function renderGradesBody(){return ''}
function renderGradesFull(){
  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];
  return renderGrades();
}
function renderGrades(){return renderGradesImpl()}
const NEWS_SOURCES=[""")

# 上面嵌套有误,重写干净:直接替换 renderGrades 主体
rep("""function renderGrades(){
  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];
  const stats=cur?gradeStats(cur.scores||[]):null;
  const byId={};st.forEach(s=>byId[s.id]=s);
  // 两次对比
  const prev=cur?gs.filter(x=>x.date<=cur.date&&x.id!==cur.id).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const prevMap={};if(prev)prev.scores.forEach(s=>prevMap[s.studentId]=Number(s.score));
  return heading('成绩册','录入、统计与趋势;AI 解读基于真实分数。',btn('＋ 新建成绩单','newGrade','primary'))+
  (gs.length?`<div class="chips">${gs.map(x=>`<button class="chip ${x.id===cur?.id?'on':''}" data-act="pickGrade" data-id="${A(x.id)}">${E(x.name)} · ${E(x.date)}</button>`).join('')}</div>`:'');
  }
function renderGradesBody(){return ''}
function renderGradesFull(){
  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];
  return renderGrades();
}
function renderGrades(){return renderGradesImpl()}""",
"""function renderGrades(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const gs=inClass(state.grades||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const cur=gs.find(x=>x.id===ui.gradeSel)||gs[0];
  const stats=cur?gradeStats(cur.scores||[]):null;
  const prev=cur?gs.filter(x=>x.id!==cur.id&&x.date<=cur.date).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const prevMap={};if(prev)(prev.scores||[]).forEach(s=>prevMap[s.studentId]=Number(s.score));
  const scores=cur?(cur.scores||[]):[];
  const byStu={};scores.forEach(s=>byStu[s.studentId]=s);
  return heading('成绩册','录入、统计与趋势;AI 解读基于真实分数。',
    btn('＋ 新建成绩单','newGrade','primary')+(cur?btn('✦ AI 解读','gradeAI','sky sm'):''))+
  (gs.length?`<div class="chips">${gs.map(x=>`<button class="chip ${x.id===cur?.id?'on':''}" data-act="pickGrade" data-id="${A(x.id)}">${E(x.name)} · ${E(x.date)}</button>`).join('')}</div>`:'')+
  (!cur?`<div class="card empty"><div class="mark">田</div><h2>还没有成绩单</h2><p>点「新建成绩单」,按名单录入分数。</p></div>`:`
  <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div class="inset" style="text-align:center"><small>平均分</small><b style="display:block;font-size:24px">${stats?stats.avg:'—'}</b></div>
    <div class="inset" style="text-align:center"><small>最高 / 最低</small><b style="display:block;font-size:24px">${stats?stats.max+' / '+stats.min:'—'}</b></div>
    <div class="inset" style="text-align:center"><small>优秀率(≥85)</small><b style="display:block;font-size:24px">${stats?stats.excRate+'%':'—'}</b></div>
    <div class="inset" style="text-align:center"><small>及格率(≥60)</small><b style="display:block;font-size:24px">${stats?stats.passRate+'%':'—'}</b></div>
  </div>
  ${state.aiCache&&state.aiCache['grade:'+cur.id]?`<div class="card ai-card"><h2>✦ AI 成绩解读</h2><p class="small">${E(state.aiCache['grade:'+cur.id])}</p></div>`:''}
  <section class="card"><h2>${E(cur.name)} · 分数录入</h2>
  <div class="tablewrap"><table><thead><tr><th>学生</th><th>分数</th><th>等级</th><th>较上次</th></tr></thead><tbody>
  ${st.map(s=>{const sc=byStu[s.id];const v=sc?Number(sc.score):null;const pv=prevMap[s.id];
    const grade=v==null?'':(v>=85?'优':v>=75?'良':v>=60?'及格':'待及格');
    const gcls=v==null?'':(v>=85?'status blue':v>=75?'status blue':v>=60?'status':'status magenta');
    const diff=(v!=null&&pv!=null)?(v-pv):(null);
    return `<tr><td>${E(s.no)}号 ${E(s.name)}</td>
      <td><input type="number" min="0" max="100" value="${v==null?'':v}" data-act="gradeInput" data-grade="${A(cur.id)}" data-sid="${A(s.id)}" style="width:76px"></td>
      <td><span class="${gcls}">${grade}</span></td>
      <td>${diff==null?'—':`<b style="color:${diff>=0?'var(--grass)':'var(--coral)'}">${diff>0?'+':''}${diff}</b>`}</td></tr>`}).join('')}
  ${st.length?'':'<tr><td colspan=4>请先导入名册</td></tr>'}
  </tbody></table></div>
  <div class="row mt">${btn('保存全部分数','saveGrades','primary sm')}${btn('🖨 打印成绩登记表','printGradeSheet','sm')}</div>
  </section>`)
}
function newGradeObj(){const c=currentClass();return {id:uid(),classId:c.id,name:'成绩单 '+(inClass(state.grades).length+1),date:today(),scores:[]}}""")

# 5. 动作:newGrade/pickGrade/gradeInput/save/打印/AI
rep("case'newsRefresh':newsFetch(true);break;",
"""case'newGrade':{const c=currentClass();if(!c)break;const g=newGradeObj();
  g.scores=inClass(state.students).map(s=>({studentId:s.id,score:''}));
  state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.dirty=true;await save();renderApp();break}
case'pickGrade':ui.gradeSel=el.dataset.id;renderApp();break;
case'gradeInput':{const g=(state.grades||[]).find(x=>x.id===el.dataset.grade);if(!g)break;
  let row=g.scores.find(s=>s.studentId===el.dataset.sid);if(!row){row={studentId:el.dataset.sid,score:''};g.scores.push(row)}
  row.score=el.value;ui.dirty=true;break}
case'saveGrades':{ui.dirty=true;await save();toast('分数已保存,统计已更新');renderApp();break}
case'gradeAI':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const st=gradeStats(g.scores||[]);if(!st){toast('先录入分数');break}
  toast('AI 解读中…');
  try{const prev=inClass(state.grades).filter(x=>x.id!==g.id&&x.date<=g.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const ps=prev?gradeStats(prev.scores||[]):null;
  const out=await DesktopAI.chat([{role:'system',content:'你是小学语文教研员。基于两次成绩统计写解读:120字内,指出总体水平、与上次对比的变化、2 条教学建议。只输出正文。'},{role:'user',content:'本次:'+g.name+' 平均'+st.avg+' 优秀率'+st.excRate+'% 及格率'+st.passRate+'% 最高'+st.max+' 最低'+st.min+(ps?';上次:'+ps.avg+' 优秀率'+ps.excRate+'% 及格率'+ps.passRate:';无上次数据')}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['grade:'+g.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'printGradeSheet':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const c=currentClass();
  const byId={};inClass(state.students).forEach(s=>byId[s.id]=s);
  const rows=(g.scores||[]).map((s,i)=>{const stu=byId[s.studentId]||{no:'?',name:'?'};return `<tr><td>${i+1}</td><td>${E(stu.no)}号</td><td>${E(stu.name)}</td><td style="width:24mm"></td></tr>`}).join('');
  printHTML(printHeader('成绩登记表 · '+E(g.name),'班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>分数</th></tr>'+rows+'</table>');break}
case'newsRefresh':newsFetch(true);break;""")

# 6. F9 表格包:renderResources 加「表格与登记」区
rep("<h2>字帖与个性化</h2>",
"""<h2>表格与登记</h2>
  <div class="row">${btn('收作业登记表','printHW','grass sm')}${btn('背诵默写跟踪表','printReciteTrack','grass sm')}${btn('座位表(可编辑)','printSeats','sky sm')}${btn('卫生值日表','printDuty','sky sm')}${btn('班级积分榜','openPoints','primary sm')}</div>
  <p class="small muted">表格基于本班名册自动生成;座位表在打印前可点名字换位。</p>
  <h2>字帖与个性化</h2>""")

rep("case'printCopybook':{",
"""case'printHW':{const c=currentClass();if(!c)break;
  const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td><td style="width:20mm"></td><td style="width:20mm"></td><td style="width:20mm"></td></tr>`).join('');
  printHTML(printHeader('作业收缴登记表','班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>已交</th><th>未交原因</th><th>订正</th></tr>'+rows+'</table>');break}
case'printReciteTrack':{const c=currentClass();if(!c)break;
  const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>{const rl=(state.reciteLogs||[]).filter(r=>r.studentId===s.id);return `<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td>${'<td style="width:16mm"></td>'.repeat(8)}<td>${rl.length+'次'}</td></tr>`}).join('');
  printHTML(printHeader('背诵听写默写跟踪表','班级:'+E(c.name),'')+'<table class="print-table"><tr><th>序号</th><th>学号</th><th>姓名</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>累计</th></tr>'+rows+'</table>');break}
case'printSeats':{ui.view='seats';renderApp();break}
case'printDuty':{const c=currentClass();if(!c)break;
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const groups=[];for(let i=0;i<st.length;i+=Math.ceil(st.length/5))groups.push(st.slice(i,i+Math.ceil(st.length/5)));
  const names=['周一','周二','周三','周四','周五'];
  const rows=groups.map((g,i)=>`<tr><th style="width:14mm">${names[i]||''}</th><td>${g.map(s=>E(s.no)+'号').join('、')}</td><td style="width:30mm"></td></tr>`).join('');
  printHTML(printHeader('卫生值日表','班级:'+E(c.name),'')+'<table class="print-table">'+rows+'</table><p style="margin-top:6mm">值日要求:______________________________</p>');break}
case'openPoints':ui.view='points';renderApp();break;
case'pointPlus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=(state.points[no]||0)+1;ui.dirty=true;await save();renderApp();break}
case'pointMinus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=Math.max(0,(state.points[no]||0)-1);ui.dirty=true;await save();renderApp();break}
case'seatSwap':{ui.seatSwapA=el.dataset.id;toast('已选中'+el.dataset.no+'号,再点另一个座位交换');break}
case'printCopybook':{""")

# 7. 座位表页 + 积分榜视图
rep("case'grades':body=renderGrades();break;",
    "case'grades':body=renderGrades();break;case'seats':body=renderSeats();break;case'points':body=renderPoints();break;")
rep("function gradeStats(scores){",
"""function renderSeats(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const cols=6;
  const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);
  const grid=[];seats.forEach((id,i)=>{const r=Math.floor(i/cols);(grid[r]=grid[r]||[]).push(id)});
  return heading('座位表','点两个座位交换;打印自动排版。',btn('🖨 打印座位表','doPrintSeats','primary sm')+btn('重置为名册序','resetSeats','ghost sm'))+
  '<div class="card"><div class="seat-grid">'+grid.map(row=>row.map(id=>{const s=st.find(x=>x.id===id);if(!s)return '<div class="seat empty-seat">空</div>';
    return `<button class="seat ${ui.seatSwapA===id?'sel':''}" data-act="seatSwap" data-id="${A(s.id)}" data-no="${A(s.no)}">${E(s.no)}号<br><small>${E(s.name)}</small></button>`}).join('')).join('<div class="aisle"></div>')+'</div></div>';
}
function renderPoints(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const ranked=st.slice().sort((a,b)=>(state.points[b.no]||0)-(state.points[a.no]||0));
  return heading('班级积分榜','课堂表现即时加减分,自动排序。')+
  '<div class="card"><table><thead><tr><th>名次</th><th>学生</th><th>积分</th><th>操作</th></tr></thead><tbody>'+
  ranked.map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号 ${E(s.name)}</td><td><b style="color:var(--sky)">${state.points[s.no]||0}</b></td><td><button class="btn grass sm" data-act="pointPlus" data-no="${A(s.no)}">＋</button> <button class="btn ghost sm" data-act="pointMinus" data-no="${A(s.no)}">－</button></td></tr>`).join('')+
  '</tbody></table></div>';
}
function gradeStats(scores){""")

# 8. 座位/积分 打印与重置动作
rep("case'printHW':{",
"""case'doPrintSeats':{const c=currentClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);const cols=6;let html='';
  for(let i=0;i<seats.length;i+=cols){html+='<tr>'+(seats.slice(i,i+cols).map(id=>{const s=st.find(x=>x.id===id);return '<td style="height:16mm;text-align:center">'+(s?E(s.no)+'号 '+E(s.name):'空')+'</td>'}).join('')+(seats.slice(i,i+cols).length<cols?'<td colspan="'+(cols-seats.slice(i,i+cols).length)+'"></td>':'')+'</tr>')}
  printHTML(printHeader('座位表','班级:'+E(c.name),'')+'<table class="print-table">'+html+'</table><p style="margin-top:5mm;text-align:center">讲台</p>');break}
case'resetSeats':{state.seats=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);ui.dirty=true;await save();renderApp();break}
case'printHW':{""")

# 9. 座位交换逻辑(seatSwap 选中后第二次点击交换)
rep("case'annTool':ui.annTool=el.dataset.tool;renderApp();break;",
"""case'seatSwap':{state.seats=state.seats&&state.seats.length?state.seats:inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);
  if(!ui.seatSwapA){ui.seatSwapA=el.dataset.id;renderApp();break}
  if(ui.seatSwapA===el.dataset.id){ui.seatSwapA=null;renderApp();break}
  const i=state.seats.indexOf(ui.seatSwapA),j=state.seats.indexOf(el.dataset.id);
  if(i>=0&&j>=0){const t=state.seats[i];state.seats[i]=state.seats[j];state.seats[j]=t;ui.dirty=true;await save()}
  ui.seatSwapA=null;renderApp();break}
case'annTool':ui.annTool=el.dataset.tool;renderApp();break;""")

# 11. A10 教案草稿(教学页备课记录卡加 AI 按钮)
rep("${btn('打印备课摘要','printPrep')}",
    "${btn('打印备课摘要','printPrep')}${btn('✦ AI 教案草稿','aiPrep','sky sm')}")
rep("case'seatSwap':{",
"""case'aiPrep':{const c=currentClass();if(!c)break;const l=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));
  if(!l)return toast('当前课次无词库数据');
  toast('AI 教案草稿生成中…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文特级教师。按"教学目标 3 条/教学环节 4 步/提问链 3 个/作业 2 项"输出教案草稿,markdown 列表,简洁实用。'},{role:'user',content:'部编版三年级上册 第'+l.no+'课 '+l.title+';写字表:'+l.chars.map(x=>x.c).join('')+';词语:'+l.words.slice(0,10).map(x=>x.w).join('、')}],0.5);
  const p=state.preps&&state.preps.find(x=>x.classId===c.id&&String(x.lessonNo)===String(ui.teachLesson));
  if(p){p.goals='[AI 草稿]\\n'+out;ui.dirty=true;await save();toast('草稿已填入备课记录,请修改后保存')}
  else toast('请先保存本课备课记录,再生成草稿');
  renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'seatSwap':{""")

# 12. A11 预警:首页今日待办聚合处加"学业预警"项(连续两次下滑检测)
rep("const cards=[['计划上课',d.teach,'teaching',''],['待批改',d.mark,'marking','dictation'],['待讲评',d.lecture,'marking','followups'],['待复查',d.follow,'marking','followups']]",
"""const alerts=[];(state.grades||[]).slice(-2).forEach(()=>{});
if((state.grades||[]).length>=2){const last=(state.grades||[])[(state.grades||[]).length-1],prev=(state.grades||[])[(state.grades||[]).length-2];
  if(prev&&last&&prev.scores&&last.scores){const pm={};prev.scores.forEach(s=>pm[s.studentId]=Number(s.score));
    const dropped=last.scores.filter(s=>pm[s.studentId]!=null&&Number(s.score)<pm[s.studentId]-8).length;
    if(dropped>=3)alerts.push('⚠ '+dropped+' 名学生较上次成绩下滑 8 分以上,建议到「学生档案」逐个查看')}}
const cards=[['计划上课',d.teach,'teaching',''],['待批改',d.mark,'marking','dictation'],['待讲评',d.lecture,'marking','followups'],['待复查',d.follow,'marking','followups']]""")

open('app.js', 'w', encoding='utf-8').write(src)
print('final patch done:', n0, '->', len(src))
