// 重写 renderGrades:JS 处理 JS 字符串,无转义问题
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
const start = src.indexOf('function renderGrades(){');
const tailMarker = 'function renderGrades(){return renderGradesImpl()}';
const end = src.indexOf(tailMarker);
if (start < 0 || end < start) throw new Error('anchor not found: ' + start + ',' + end);
const tailEnd = end + tailMarker.length;
const body = `function renderGrades(){
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
  (gs.length?\`<div class="chips">\${gs.map(x=>\`<button class="chip \${x.id===cur?.id?'on':''}" data-act="pickGrade" data-id="\${A(x.id)}">\${E(x.name)} · \${E(x.date)}</button>\`).join('')}</div>\`:'')+
  (!cur?\`<div class="card empty"><div class="mark">田</div><h2>还没有成绩单</h2><p>点「新建成绩单」,按名单录入分数。</p></div>\`:\`
  <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div class="inset" style="text-align:center"><small>平均分</small><b style="display:block;font-size:24px">\${stats?stats.avg:'—'}</b></div>
    <div class="inset" style="text-align:center"><small>最高 / 最低</small><b style="display:block;font-size:24px">\${stats?stats.max+' / '+stats.min:'—'}</b></div>
    <div class="inset" style="text-align:center"><small>优秀率(≥85)</small><b style="display:block;font-size:24px">\${stats?stats.excRate+'%':'—'}</b></div>
    <div class="inset" style="text-align:center"><small>及格率(≥60)</small><b style="display:block;font-size:24px">\${stats?stats.passRate+'%':'—'}</b></div>
  </div>
  \${state.aiCache&&state.aiCache['grade:'+cur.id]?\`<div class="card ai-card"><h2>✦ AI 成绩解读</h2><p class="small">\${E(state.aiCache['grade:'+cur.id])}</p></div>\`:''}
  <section class="card"><h2>\${E(cur.name)} · 分数录入</h2>
  <div class="tablewrap"><table><thead><tr><th>学生</th><th>分数</th><th>等级</th><th>较上次</th></tr></thead><tbody>
  \${st.map(s=>{const sc=byStu[s.id];const v=sc?Number(sc.score):null;const pv=prevMap[s.id];
    const grade=v==null?'':(v>=85?'优':v>=75?'良':v>=60?'及格':'待及格');
    const gcls=v==null?'':(v>=75?'status blue':v>=60?'status':'status magenta');
    const diff=(v!=null&&pv!=null)?(v-pv):null;
    return \`<tr><td>\${E(s.no)}号 \${E(s.name)}</td>
      <td><input type="number" min="0" max="100" value="\${v==null?'':v}" data-act="gradeInput" data-grade="\${A(cur.id)}" data-sid="\${A(s.id)}" style="width:76px"></td>
      <td><span class="\${gcls}">\${grade}</span></td>
      <td>\${diff==null?'—':'<b style="color:'+(diff>=0?'var(--grass)':'var(--coral)')+'">'+(diff>0?'+':'')+diff+'</b>'}</td></tr>\`}).join('')}
  \${st.length?'':'<tr><td colspan=4>请先导入名册</td></tr>'}
  </tbody></table></div>
  <div class="row mt">\${btn('保存全部分数','saveGrades','primary sm')}\${btn('🖨 打印成绩登记表','printGradeSheet','sm')}</div>
  </section>\`)
}`;
src = src.slice(0, start) + body + src.slice(tailEnd);
fs.writeFileSync('app.js', src);
console.log('renderGrades rewritten by JS');
