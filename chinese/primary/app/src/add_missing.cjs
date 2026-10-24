const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let patched = 0;
function rep(oldS, newS) {
  if (src.includes(newS)) return; // already applied
  if (!src.includes(oldS)) { console.log('ANCHOR MISS:', oldS.slice(0, 50)); return; }
  src = src.replace(oldS, newS);
  patched++;
}
// 1) 动作注入:newGrade 等(锚定 deleteClass)
rep("case'deleteClass':", [
"case'newGrade':{const c=currentClass();if(!c)break;const g=newGradeObj();",
"g.scores=inClass(state.students).map(s=>({studentId:s.id,score:''}));",
"state.grades=state.grades||[];state.grades.push(g);ui.gradeSel=g.id;ui.dirty=true;await save();renderApp();break}",
"case'pickGrade':ui.gradeSel=el.dataset.id;renderApp();break;",
"case'gradeInput':{const g=(state.grades||[]).find(x=>x.id===el.dataset.grade);if(!g)break;",
"let row=g.scores.find(s=>s.studentId===el.dataset.sid);if(!row){row={studentId:el.dataset.sid,score:''};g.scores.push(row)}",
"row.score=el.value;ui.dirty=true;break}",
"case'saveGrades':{ui.dirty=true;await save();toast('分数已保存,统计已更新');renderApp();break}",
"case'gradeAI':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const st=gradeStats(g.scores||[]);if(!st){toast('先录入分数');break}",
"toast('AI 解读中…');",
"try{const prev=inClass(state.grades).filter(x=>x.id!==g.id&&x.date<=g.date).sort((a,b)=>b.date.localeCompare(a.date))[0];",
"const ps=prev?gradeStats(prev.scores||[]):null;",
"const out=await DesktopAI.chat([{role:'system',content:'你是小学语文教研员。基于成绩统计写解读:120字内,指出总体水平、与上次对比的变化、2 条教学建议。只输出正文。'},{role:'user',content:'本次:'+g.name+' 平均'+st.avg+' 优秀率'+st.excRate+'% 及格率'+st.passRate+'% 最高'+st.max+' 最低'+st.min+(ps?';上次:'+ps.avg+' 优秀率'+ps.excRate+'% 及格率'+ps.passRate:';无上次数据')}],0.4);",
"state.aiCache=state.aiCache||{};state.aiCache['grade:'+g.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}",
"case'printGradeSheet':{const g=(state.grades||[]).find(x=>x.id===ui.gradeSel);if(!g)break;const c=currentClass();",
"const byId={};inClass(state.students).forEach(s=>byId[s.id]=s);",
"const rows=(g.scores||[]).map((s,i)=>{const stu=byId[s.studentId]||{no:'?',name:'?'};return `<tr><td>${i+1}</td><td>${E(stu.no)}号</td><td>${E(stu.name)}</td><td style=\"width:24mm\"></td></tr>`}).join('');",
"printHTML(printHeader('成绩登记表 · '+E(g.name),'班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>分数</th></tr>'+rows+'</table>');break}",
"case'deleteClass':"].join('\n'));
// 2) newGradeObj 帮助函数
rep('function gradeStats(scores){', 'function newGradeObj(){const c=currentClass();return {id:uid(),classId:c.id,name:\'成绩单 \'+(inClass(state.grades).length+1),date:today(),scores:[]}}\nfunction gradeStats(scores){');
// 3) 表格包动作(锚定 printCopybook)
rep("case'printCopybook':{", [
"case'printHW':{const c=currentClass();if(!c)break;",
"const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td><td style=\"width:20mm\"></td><td style=\"width:20mm\"></td><td style=\"width:20mm\"></td></tr>`).join('');",
"printHTML(printHeader('作业收缴登记表','班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>已交</th><th>未交原因</th><th>订正</th></tr>'+rows+'</table>');break}",
"case'printReciteTrack':{const c=currentClass();if(!c)break;",
"const rows=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map((s,i)=>{const rl=(state.reciteLogs||[]).filter(r=>r.studentId===s.id);return `<tr><td>${i+1}</td><td>${E(s.no)}号</td><td>${E(s.name)}</td>${'<td style=\"width:16mm\"></td>'.repeat(8)}<td>${rl.length+'次'}</td></tr>`}).join('');",
"printHTML(printHeader('背诵听写默写跟踪表','班级:'+E(c.name),'')+'<table class=\"print-table\"><tr><th>序号</th><th>学号</th><th>姓名</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>累计</th></tr>'+rows+'</table>');break}",
"case'printSeats':{ui.view='seats';renderApp();break}",
"case'doPrintSeats':{const c=currentClass();const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));",
"const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);const cols=6;let html='';",
"for(let i=0;i<seats.length;i+=cols){html+='<tr>'+(seats.slice(i,i+cols).map(id=>{const s=st.find(x=>x.id===id);return '<td style=\"height:16mm;text-align:center\">'+(s?E(s.no)+'号 '+E(s.name):'空')+'</td>'}).join('')+(seats.slice(i,i+cols).length<cols?'<td colspan=\"'+(cols-seats.slice(i,i+cols).length)+'\"></td>':'')+'</tr>')}",
"printHTML(printHeader('座位表','班级:'+E(c.name),'')+'<table class=\"print-table\">'+html+'</table><p style=\"margin-top:5mm;text-align:center\">讲台</p>');break}",
"case'resetSeats':{state.seats=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);ui.dirty=true;await save();renderApp();break}",
"case'seatSwap':{state.seats=state.seats&&state.seats.length?state.seats:inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).map(s=>s.id);",
"if(!ui.seatSwapA){ui.seatSwapA=el.dataset.id;renderApp();break}",
"if(ui.seatSwapA===el.dataset.id){ui.seatSwapA=null;renderApp();break}",
"const i=state.seats.indexOf(ui.seatSwapA),j=state.seats.indexOf(el.dataset.id);",
"if(i>=0&&j>=0){const t=state.seats[i];state.seats[i]=state.seats[j];state.seats[j]=t;ui.dirty=true;await save()}",
"ui.seatSwapA=null;renderApp();break}",
"case'openPoints':ui.view='points';renderApp();break;",
"case'pointPlus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=(state.points[no]||0)+1;ui.dirty=true;await save();renderApp();break}",
"case'pointMinus':{const no=el.dataset.no;state.points=state.points||{};state.points[no]=Math.max(0,(state.points[no]||0)-1);ui.dirty=true;await save();renderApp();break}",
"case'printCopybook':{"].join('\n'));
// 4) 座位/积分视图
rep("case'grades':body=renderGrades();break;", "case'grades':body=renderGrades();break;case'seats':body=renderSeats();break;case'points':body=renderPoints();break;");
rep('function gradeStats(scores){', [
"function renderSeats(){",
"  if(!currentClass())return noClass();",
"  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));",
"  const seats=state.seats&&state.seats.length?state.seats:st.map(s=>s.id);",
"  const cols=6;const grid=[];seats.forEach((id,i)=>{const r=Math.floor(i/cols);(grid[r]=grid[r]||[]).push(id)});",
"  return heading('座位表','点两个座位交换;打印自动排版。',btn('🖨 打印座位表','doPrintSeats','primary sm')+btn('重置为名册序','resetSeats','ghost sm'))+",
"  '<div class=\"card\"><div class=\"seat-grid\">'+grid.map(row=>row.map(id=>{const s=st.find(x=>x.id===id);if(!s)return '<div class=\"seat empty-seat\">空</div>';",
"    return `<button class=\"seat ${ui.seatSwapA===id?'sel':''}\" data-act=\"seatSwap\" data-id=\"${A(s.id)}\" data-no=\"${A(s.no)}\">${E(s.no)}号<br><small>${E(s.name)}</small></button>`}).join('')).join('<div class=\"aisle\"></div>')+'</div></div>';",
"}",
"function renderPoints(){",
"  if(!currentClass())return noClass();",
"  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));",
"  const ranked=st.slice().sort((a,b)=>(state.points[b.no]||0)-(state.points[a.no]||0));",
"  return heading('班级积分榜','课堂表现即时加减分,自动排序。')+(st.length?",
"  '<div class=\"card\"><table><thead><tr><th>名次</th><th>学生</th><th>积分</th><th>操作</th></tr></thead><tbody>'+",
"  ranked.map((s,i)=>`<tr><td>${i+1}</td><td>${E(s.no)}号 ${E(s.name)}</td><td><b style=\"color:var(--sky)\">${state.points[s.no]||0}</b></td><td><button class=\"btn grass sm\" data-act=\"pointPlus\" data-no=\"${A(s.no)}\">＋</button> <button class=\"btn ghost sm\" data-act=\"pointMinus\" data-no=\"${A(s.no)}\">－</button></td></tr>`).join('')+'.slice','')+'</tbody></table></div>':'<p class=\"muted\">先导入名册</p>')",
"}",
"function gradeStats(scores){"].join('\n'));
// 5) 表格卡 + 教案 AI + 首页预警
// tables rep moved to separate file