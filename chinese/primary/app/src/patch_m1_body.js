/* ================= F33 首页小组件:跑马灯 + 时钟 ================= */
function widgetMarquee(){const cfg=(state.widgets&&state.widgets.marquee)||{};if(cfg.off)return '';const items=(cfg.texts&&cfg.texts.length?cfg.texts:['今天也要元气满满,孩子们加油!']);const text=items.join('　✦　');return `<div class="marquee${cfg.style==='plain'?' plain':''}"><span class="mq-ic">📣</span><div class="mq-track"><span>${E(text)}</span></div></div>`}
function widgetClock(){const cfg=(state.widgets&&state.widgets.clock)||{};if(cfg.off)return '';const now=new Date();const hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');const wd='日一二三四五六'[now.getDay()];const date=(now.getMonth()+1)+'月'+now.getDate()+'日 星期'+wd;const cd=cfg.countdownMin?`<div class="ck-cd">课堂倒计时 <b>${Number(cfg.countdownMin)}</b> 分钟</div>`:'';return `<div class="clockw"><div class="ck-time">${hh}<i>:</i>${mm}</div><div class="ck-date">${date}</div>${cd}</div>`}
/* ================= F10 随机点名与抽背 ================= */
function rollPool(){return inClass(state.students).slice()}
function renderClassroom(){if(!currentClass())return noClass();const done=ui.rollPicked.length,pool=rollPool();return heading('课堂','随机点名、抽背与听写,投影大屏友好。')+`
<div class="grid cols2">
<section class="card"><h2>随机点名 · 模式</h2><div class="stack">
${[['random','纯随机','每次从全班抽取'],['seq','顺延','按学号依次'],['norepeat','不重复','本轮已点不再抽']].map(([k,t,d])=>`<button class="btn ${ui.rollMode===k?'active':''}" data-act="rollMode" data-mode="${k}" style="text-align:left"><b>${t}</b> <small>${d}</small></button>`).join('')}
<div class="inset small muted">本轮已点 ${done} 人 · 全班 ${pool.length} 人${ui.rollCurrent?`<br>上一次:<b>${E(ui.rollCurrent.no)}号 ${E(ui.rollCurrent.name)}</b>`:''}</div>
${btn('打开点名大屏','goRoll','primary mt')}
</div></section>
<section class="card"><h2>课堂工具</h2><div class="stack">
${btn('听写报词台','navigate','','data-view="dictation"')}
${btn('背诵训练(挖空督背)','navigate','','data-view="recite"')}
<p class="small muted">点名大屏:空格键抽取、回车记录表现,适合投影。</p>
</div></section>
</div>`}
function renderRollcall(){
  const pool=rollPool();const remain=pool.length-ui.rollPicked.length;
  const cur=ui.rollCurrent;
  return `<div class="rollstage">
  <div class="roll-head"><b>随机点名 · ${E(S.cls)}</b>
    <div class="row gap8">${[['random','纯随机'],['seq','顺延'],['norepeat','不重复']].map(([k,t])=>`<button class="chip ${ui.rollMode===k?'on':''}" data-act="rollMode" data-mode="${k}">${t}</button>`).join('')}</div>
    <span class="grow"></span>
    ${btn('✓ 记录表现','rollMark','primary sm')+btn('跳过','rollSkip','sm')+btn('退出','navigate','sm','data-view="classroom"')}
  </div>
  <div class="roll-center">
    <div class="roll-avatar"><div class="roll-ava-in">${cur?E(cur.no):'?'}</div></div>
    ${cur?`<div class="roll-name">${E(cur.no)}号 · ${E(cur.name)}</div>`:'<div class="roll-name dim">按空格键开始抽取</div>'}
    ${cur?'<div class="roll-meta">第 '+ui.rollSeq+' 次抽取</div>':''}
    <div class="roll-chips"><span class="chip">本轮已抽 ${ui.rollPicked.length}/${pool.length}</span><span class="chip">剩余 ${remain} 人</span></div>
  </div>
  <div class="roll-foot"><span>本节课已点:${ui.rollPicked.map(x=>E(x.no)).join('、')||'—'}</span><span class="grow"></span><span>空格=抽取 · 回车=记录表现</span></div>
</div>`}
function rollNext(){
  const pool=rollPool();if(!pool.length)return toast('名册为空,请先导入学生');
  let pick=null;
  if(ui.rollMode==='seq'){const lastNo=ui.rollPicked.length?ui.rollPicked[ui.rollPicked.length-1].no:'0';pick=pool.slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN')).find(x=>x.no>lastNo)||pool[0]}
  else{const done=new Set(ui.rollPicked.map(x=>x.id));const avail=pool.filter(x=>!(ui.rollMode==='norepeat'&&done.has(x.id)));if(!avail.length)return toast('本轮已点完全班,自动重置');pick=avail[Math.floor(Math.random()*avail.length)]}
  ui.rollCurrent=pick;ui.rollSeq++;if(!ui.rollPicked.find(x=>x.id===pick.id))ui.rollPicked.push(pick);
  renderApp();
}
/* ================= F12 背诵训练 ================= */
function reciteAutoGaps(){
  const text=ui.reciteText;if(!text.trim())return toast('先录入课文');
  const density={'轻松':2,'标准':3,'挑战':4}[ui.reciteDensity]||3;
  const words=[];const rx=/[\u4e00-\u9fff]{2,4}/g;let m,i=0;
  const parts=[];let last=0;
  while((m=rx.exec(text))&&words.length<30){
    if((i++)%density===0){words.push(m[0]);parts.push([m.index,m.index+m[0].length])}
  }
  // 构建带 ⟦i⟧ 占位的文本与 gaps
  let out='';let cursor=0;const gaps=[];
  parts.forEach(([s,e],idx)=>{out+=text.slice(cursor,s)+'⟦'+idx+'⟧'+text.slice(s,e);cursor=e;gaps.push(text.slice(s,e))});
  out+=text.slice(cursor);
  ui.reciteText=out;ui.reciteGaps=gaps;ui.reciteCur=0;ui.reciteHints=0;renderApp();
}
function renderRecite(){
  if(!currentClass())return noClass();
  const text=ui.reciteText;const gaps=ui.reciteGaps;
  const body=text?E(text).split('\n').map(line=>{
    let html=line;
    gaps.forEach((g,i)=>{const ph='⟦'+i+'⟧';const shown=ui.reciteCur>i?E(g):(ui.reciteCur===i?'〔____〕':'<span class="gap-slot"></span>');html=html.replace(ph,`<span class="gap${ui.reciteCur===i?' cur':''}">${shown}</span>`)});
    return '<p>'+html+'</p>';
  }).join(''):'<p class="muted">在下方粘贴课文,然后点「AI 挖空」或「普通挖空」。</p>';
  return heading('背诵训练','挖空背诵 · 督背提示 · 完成记录进学生档案。')+
  `<div class="grid cols2">
  <section class="card"><div class="row space"><h2>课文挖空</h2><span class="row gap8">${btn('AI 挖空','reciteAI','sky sm')+btn('普通挖空','reciteAuto','sm')+btn('重置','reciteReset','ghost sm')}</span></div>
  <div class="recite-body">${body}</div>
  <details><summary>录入 / 编辑课文</summary><textarea name="reciteText" rows="6" placeholder="粘贴课文文本…">${E(ui.reciteRaw||'')}</textarea><div class="row mt" style="align-items:center">${btn('保存课文','reciteSave','grass sm')}<span class="small muted">挖空密度</span>${['轻松','标准','挑战'].map(d=>`<button class="chip ${ui.reciteDensity===d?'on':''}" data-act="reciteDensity" data-d="${d}">${d}</button>`).join('')}</div></details>
  <div class="row mt">${btn('🔊 朗读全文','reciteSpeak','sky sm')}${btn('上一空','recitePrev','sm')}${btn('下一空','reciteNext','sm')}</div>
  </section>
  <section class="stack">
    <div class="card"><h2>督背面板</h2>
      <div class="stack">${gaps.length?`
        <div class="inset" style="text-align:center"><b style="font-size:20px">第 ${Math.min(ui.reciteCur+1,gaps.length)} 空</b> <small class="muted">/ 共 ${gaps.length} 空</small></div>
        ${btn('💡 提示首字','reciteHintFirst','grass')}
        ${btn('💡 提示整词','reciteHintFull','grass')}
        ${btn('我不会,跳过','reciteSkip','ghost')}`:'<p class="muted">先挖空课文</p>'}
    </div></div>
    <div class="card"><h2>本次记录</h2><p>提示次数:<b>${ui.reciteHints}</b></p>
    ${gaps.length?btn('完成训练(记入档案)','reciteDone','primary'):''}</div>
  </section></div>`;
}
/* ================= F29 学生档案 ================= */
function recTypes(){return [['闪光点','#4CAF6E'],['需关注','#FF6B57'],['课堂表现','#4E9AF1'],['谈心谈话','#9B7BF5'],['家访','#FFB020'],['帮扶','#2FBFB0'],['家校联系','#FF6B57'],['其他','#8F887A']]}
function renderProfile(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  if(!st.length)return heading('学生档案','一生一档。')+'<div class="card empty"><div class="mark">田</div><h2>还没有学生</h2><p>先到「班级」导入名册。</p></div>';
  const cur=st.find(x=>x.id===ui.profileStudent)||st[0];ui.profileStudent=cur.id;
  state.records=state.records||[];state.reciteLogs=state.reciteLogs||[];state.aiCache=state.aiCache||{};
  const recs=state.records.filter(r=>r.studentId===cur.id).sort((a,b)=>b.date.localeCompare(a.date));
  const dictHist=inClass(state.dictations).map(d=>({date:d.date,n:(d.studentMarks?.[cur.id]?.wrongWords||[]).length,marked:d.studentMarks?.[cur.id]?.status||'未录'})).filter(x=>x.marked!=='未录').slice(-5);
  const g=[];inClass(state.assignments).forEach(a=>(a.scores||[]).forEach(s=>{if(s.studentId===cur.id)g.push(Number(s.score||0))}));
  const avg=g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):null;
  const maxN=Math.max(1,...dictHist.map(x=>x.n));
  return heading('学生档案 · 一生一档','学业概览自动聚合;观察记录随手记;AI 小结基于真实记录且已脱敏。')+
  `<div class="chips">${st.map(x=>`<button class="chip ${x.id===cur.id?'on':''}" data-act="pickStudent" data-id="${A(x.id)}">${E(x.no)}号</button>`).join('')}</div>
  <div class="grid cols2">
  <div class="stack">
    <section class="card"><h2>基本情况</h2><div class="row" style="gap:18px"><b style="font-size:30px">${E(cur.no)}号</b>
      <span class="muted">${E(cur.name)}</span>
      ${recs.filter(r=>r.type==='需关注').length?`<span class="status magenta">⚠ ${recs.filter(r=>r.type==='需关注').length} 条需关注</span>`:'<span class="status blue">暂无待关注</span>'}
      <span class="grow"></span></div>
      <form data-form="record" data-id="${A(cur.id)}" class="stack mt">
        <div class="fieldrow"><label class="field">类型<select name="type">${recTypes().map(([t])=>`<option>${t}</option>`).join('')}</select></label>
        <label class="field">日期<input type="date" name="date" value="${today()}" required></label></div>
        <label class="field">内容<textarea name="note" rows="2" placeholder="30 秒随手记…" required></textarea></label>
        <label class="row"><input type="checkbox" name="sensitive"> 敏感记录(仅本地,永不进入 AI)</label>
        <div>${btn('保存记录','saveRecordBtn','grass sm')}</div>
      </form>
    </section>
    <section class="card"><h2>学业概览 <small class="muted">(自动聚合)</small></h2>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        <div class="inset" style="text-align:center"><small>听写错词累计</small><b style="display:block;font-size:22px">${dictHist.reduce((a,x)=>a+x.n,0)}</b></div>
        <div class="inset" style="text-align:center"><small>作文均分</small><b style="display:block;font-size:22px">${avg==null?'—':avg}</b></div>
        <div class="inset" style="text-align:center"><small>背诵通过</small><b style="display:block;font-size:22px">${state.reciteLogs.filter(r=>r.studentId===cur.id&&r.pass).length}</b></div>
        <div class="inset" style="text-align:center"><small>待复查</small><b style="display:block;font-size:22px">${inClass(state.followups).filter(f=>f.status==='待办'&&(f.studentIds||[]).includes(cur.id)).length}</b></div>
      </div>
      ${dictHist.length?`<p class="small muted">最近听写错词数</p><div class="bars">${dictHist.map(x=>`<div class="bar-i"><i style="height:${Math.max(8,Math.round(x.n/maxN*64))}px"></i><small>${x.date.slice(5)}</small></div>`).join('')}</div>`:'<p class="muted small">暂无听写批改记录</p>'}
    </section>
    <section class="card"><h2>观察记录时间线</h2>
      ${recs.length?`<div class="tl">${recs.slice(0,10).map(r=>{const c=(recTypes().find(x=>x[0]===r.type)||['','#999'])[1];return `<div class="tl-item"><i class="dot" style="background:${c};box-shadow:0 0 0 4px color-mix(in srgb,${c} 18%,#fff)"></i><div class="tl-txt"><b>${E(r.type)} · ${dateText(r.date)}</b><small>${E(r.note)}</small></div><button class="btn ghost sm" data-act="delRecord" data-id="${A(r.id)}">✕</button></div>`}).join('')}</div>`:'<p class="muted">还没有记录,点上方「随手记」。</p>'}
    </section>
  </div>
  <div class="stack">
    <section class="card"><h2>✦ AI 学期小结</h2>
      <div id="aiSummaryOut">${state.aiCache['summary:'+cur.id]?`<p>${E(state.aiCache['summary:'+cur.id])}</p><div class="row">${btn('采纳并归档','aiSummaryKeep','grass sm')}${btn('重新生成','aiSummary','ghost sm')}</div>`:btn('生成小结','aiSummary','primary sm')}</div>
      <p class="small muted" style="margin-top:10px">🔒 已脱敏:AI 不会收到学生姓名,仅收到「该生(${E(cur.no)}号)」与学业数据。</p>
    </section>
    <section class="card"><h2>打印</h2><div class="stack">${btn('学生档案汇总','printProfile','sky sm')}${btn('谈心谈话记录表','printTalk','sm')}</div></section>
  </div></div>`;
}
function profileDataSummary(cur){
  const recs=(state.records||[]).filter(r=>r.studentId===cur.id);
  const dictHist=inClass(state.dictations).map(d=>({n:(d.studentMarks?.[cur.id]?.wrongWords||[]).length,marked:d.studentMarks?.[cur.id]?.status})).filter(x=>x.marked!=='未录');
  const wrongTop={};inClass(state.dictations).forEach(d=>{const w=(d.studentMarks?.[cur.id]?.wrongWords)||[];w.forEach(x=>{wrongTop[x]=(wrongTop[x]||0)+1})});
  const topWrong=Object.entries(wrongTop).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,c])=>w+'(错'+c+'次)').join('、')||'无';
  return `该生(${cur.no}号)数据:听写记录 ${dictHist.length} 次,累计错词 ${dictHist.reduce((a,x)=>a+x.n,0)} 个,常错词:${topWrong};观察记录 ${recs.length} 条(需关注 ${recs.filter(r=>r.type==='需关注').length} 条、闪光点 ${recs.filter(r=>r.type==='闪光点').length} 条)。请基于以上真实数据给出学期小结(80字内,语气鼓励,先扬后抑)。`;
}
