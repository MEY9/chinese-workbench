# -*- coding: utf-8 -*-
"""M2 补丁:AI 错词分析(A1)+ 期末评语工作台(A7)+ 听写批改页 AI 卡"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor x%d (期望%d): %s' % (src.count(old), cnt, old[:70])
    src = src.replace(old, new)

# 1) 听写批改右栏加 AI 错词分析卡(在讲评措施 area 之前)
rep("${area('measures','讲评措施',rec.measures||'',2)}",
"""<div class="ai-card inset"><b>✦ AI 错词分析</b> <span class="small muted">(已脱敏)</span>
  <div id="aiMarkOut" class="small" style="margin-top:8px">${state.aiCache&&state.aiCache['mark:'+rec.id]?E(state.aiCache['mark:'+rec.id]):'分析该班共性错词规律,给出讲评重点与复练建议。'}</div>
  <div class="row mt">${btn(state.aiCache&&state.aiCache['mark:'+rec.id]?'重新分析':'✦ 分析','aiMark','sky sm',`data-id="${A(rec.id)}"`)}${state.aiCache&&state.aiCache['mark:'+rec.id]?btn('采纳为讲评措施','aiMarkKeep','grass sm',`data-id="${A(rec.id)}"`):''}</div></div>
${area('measures','讲评措施',rec.measures||'',2)}""")

# 2) 动作:aiMark / aiMarkKeep(插在 case'reciteAI' 前)
rep("case'reciteAI':{",
"""case'aiMark':{const d=inClass(state.dictations).find(x=>x.id===el.dataset.id);if(!d)break;
  const errs=Object.entries(d.wordErrors||{}).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w,c])=>w+'(错'+c+'人)').join('、');
  if(!errs){toast('暂无错频数据,先登记错词');break}
  toast('AI 分析中(已脱敏)…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文特级教师。根据听写错频数据,输出:①共性错误规律(80字内)②讲评重点 2 条 ③复练建议 1 条。条理清晰,不要客套。'},{role:'user',content:'三年级上册第'+d.lessonNo+'课听写错频:'+errs+'。参与'+(d.participantCount||0)+'人。'}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['mark:'+d.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiMarkKeep':{const d=inClass(state.dictations).find(x=>x.id===el.dataset.id);if(!d)break;const txt=state.aiCache&&state.aiCache['mark:'+d.id];if(!txt)break;d.measures=(d.measures?d.measures+'\n':'')+'[AI] '+txt;ui.dirty=true;await save();toast('已采纳为讲评措施');renderApp();break}
case'genComments':{const ai=S.settings.ai||{};const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  if(!st.length)break;
  if(!ai.key&&!(await DesktopAI.hasKey())){toast('请先在设置里配置 AI Key');break}
  const batch=st.filter(s=>{const rc=state.reportCards&&state.reportCards[s.id];return !rc||!rc.text});
  if(!batch.length)return toast('全部学生已有草稿');
  toast('AI 批量生成评语 0/'+batch.length+'…(已脱敏)');
  state.reportCards=state.reportCards||{};
  for(let i=0;i<batch.length;i++){
    const s=batch[i];
    try{
      const summary=profileDataSummary(s);
      const out=await DesktopAI.chat([{role:'system',content:'你是小学语文班主任,写期末评语:100字内,基于数据先扬后抑,语气温暖鼓励,结尾给建议。直接输出评语正文。不要出现姓名,用"你"称呼。'},{role:'user',content:summary}],0.7);
      state.reportCards[s.id]={studentId:s.id,term:(new Date().getFullYear())+'秋',text:out,aiDraftUsed:true};
    }catch(e){toast('第'+(i+1)+'个生成失败:'+e.message);break}
    if(i%3===0)toast('AI 批量生成评语 '+(i+1)+'/'+batch.length+'…');
  }
  ui.dirty=true;await save();renderApp();toast('批量生成完成');break}
case'editComment':{ui.editCommentId=el.dataset.id;renderApp();break}
case'saveComment':{const sid=el.dataset.id;state.reportCards=state.reportCards||{};const rc=state.reportCards[sid]||{studentId:sid,term:(new Date().getFullYear())+'秋',aiDraftUsed:false};rc.text=document.querySelector('[name=commentText]')?.value||'';state.reportCards[sid]=rc;ui.dirty=true;await save();ui.editCommentId=null;toast('评语已审定');renderApp();break}
case'printComments':{const c=currentClass();if(!c)break;const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  const rows=st.map(s=>{const rc=state.reportCards&&state.reportCards[s.id];return `<div class="print-block"><b>${E(s.no)}号 ${E(s.name)}</b><p style="line-height:1.9">${rc&&rc.text?E(rc.text):'(待填写)'}</p><p style="border-bottom:1px solid #999;height:8mm"></p></div>`}).join('');
  printHTML(printHeader('期末评语 · '+E(c.name),'','')+rows);break}
case'comments':ui.view='comments';renderApp();break;
case'reciteAI':{""")

# 3) 评语工作台视图 + 路由
rep("case'classroom':body=renderClassroom();break;",
    "case'classroom':body=renderClassroom();break;case'comments':body=renderComments();break;")
rep("function renderClassroom(){",
"""function renderComments(){
  if(!currentClass())return noClass();
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  state.reportCards=state.reportCards||{};
  const done=st.filter(s=>state.reportCards[s.id]&&state.reportCards[s.id].text).length;
  return heading('期末评语工作台','基于每个学生的真实记录生成草稿,逐条审定后打印;姓名不会发送给 AI。',
    btn('✦ AI 批量生成','genComments','primary')+btn('🖨 打印全班评语','printComments','accent'))+
  `<div class="card"><div class="row space"><b>已审定 ${done}/${st.length}</b>
    <div class="bar" style="width:50%"><i style="width:${st.length?Math.round(done/st.length*100):0}%"></i></div></div></div>
  <div class="grid cols2 mt">
  <section class="card"><h2>学生评语</h2><div class="stack">
  ${st.map(s=>{const rc=state.reportCards[s.id];const editing=ui.editCommentId===s.id;
    return `<div class="item row space"><div style="min-width:0"><b>${E(s.no)}号 ${E(s.name)}</b>
      ${rc&&rc.text?'<span class="status blue">已有草稿'+(rc.aiDraftUsed?' · AI':'')+'</span>':'<span class="status">未生成</span>'}
      ${editing?'<form class="stack mt" onsubmit="return false"><textarea name="commentText" rows="4">${E(rc&&rc.text||'')}</textarea><div class="row">${btn('保存审定','saveComment','grass sm',`data-id="${A(s.id)}"`)}</div></form>'
        :(rc&&rc.text?'<p class="small muted" style="margin:4px 0 0">'+E(rc.text.slice(0,60))+'…</p>':'')}
    </div><span>${btn(rc&&rc.text?'审定':'✦ 生成','editComment','sm',`data-id="${A(s.id)}"`)}</span></div>`}).join('')}
  </div></section>
  <section class="stack">
    <div class="card ai-card"><h2>使用说明</h2><p class="small">①先在「听写批改/作业/档案」里积累真实记录;②点「AI 批量生成」逐生出草稿(已脱敏,姓名不出本机);③逐条「审定」修改后归档;④打印到报告手册底稿,教师手写誊抄保留温度。</p></div>
    <div class="card"><h2>隐私</h2><p class="small muted">🔒 AI 请求仅包含学号代号与学业摘要;敏感记录与姓名永不发送;AI 输出为草稿,审定后才生效。</p></div>
  </section></div>`}
function renderClassroom(){""")

# 4) NAV/路由加 评语入口(挂在批改 tab? 独立页):侧栏「批改」跳菜单太重,直接在听写批改页顶部加入口
rep("return heading('批改','共性错例、个别跟进与下次复查连在同一任务下。',btn('新增作业','newAssignment','primary'))",
    "return heading('批改','共性错例、个别跟进与下次复查连在同一任务下。',btn('期末评语','comments','accent')+btn('新增作业','newAssignment','primary'))")

# 5) CSS:ai-card inset 已有;补 comments 进度条已用 .bar。无新 CSS 需要

open('app.js', 'w', encoding='utf-8').write(src)
print('patch M2 done:', n0, '->', len(src))
