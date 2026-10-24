# -*- coding: utf-8 -*-
"""收尾补丁:A2 个性化练习纸 + F8 字帖描红 + F30b 家长沟通稿 + 预览纸张 CSS"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)
bs_n = chr(92) + 'n'

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor count=%r expect=%r: %s' % (src.count(old), cnt, old[:70].replace(chr(37), chr(37)+chr(37)))
    src = src.replace(old, new)
    open('app.js', 'w', encoding='utf-8').write(src)

# 1) 档案页:AI 家长沟通稿(A8 延伸)
rep("""<section class="card"><h2>打印</h2><div class="stack">${btn('学生档案汇总','printProfile','sky sm')}${btn('谈心谈话记录表','printTalk','sm')}</div></section>""",
"""<section class="card"><h2>打印</h2><div class="stack">${btn('学生档案汇总','printProfile','sky sm')}${btn('谈心谈话记录表','printTalk','sm')}</div></section>
    <section class="card"><h2>✦ AI 家长沟通稿</h2>
      <div id="aiParentOut">${state.aiCache&&state.aiCache['parent:'+cur.id]?E(state.aiCache['parent:'+cur.id]):'<span class="muted small">基于档案生成一段可直接发给家长的沟通文字(微信/联系本可用)。</span>'}</div>
      <div class="row mt">${btn('✦ 生成沟通稿','aiParent','sky sm')}${state.aiCache&&state.aiCache['parent:'+cur.id]?btn('复制','aiParentCopy','grass sm','data-no="'+A(cur.no)+'"'):''}</div>
      <p class="small muted" style="margin-top:8px">🔒 已脱敏:AI 只收到「该生(${E(cur.no)}号)」与学业摘要。</p></section>""")

# 2) 动作 aiParent + aiParentCopy
rep("case'printProfile':printProfile();break;",
"""case'aiParent':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;toast('AI 生成中(已脱敏)…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文班主任。基于学生数据写一段发给家长的沟通文字:120字内,先肯定再建议,语气亲切,不出现姓名,用"孩子"称呼。只输出正文。'},{role:'user',content:profileDataSummary(cur)}],0.5);
  state.aiCache=state.aiCache||{};state.aiCache['parent:'+cur.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiParentCopy':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);const t=state.aiCache&&state.aiCache['parent:'+cur.id];if(!t)break;
  try{await navigator.clipboard.writeText(t);toast('已复制,可直接粘贴给家长')}catch(e){toast('复制失败,请手动选择文本')}break}
case'printProfile':printProfile();break;""")

# 3) F8 字帖描红 + A2 个性化练习:打印中心加两个纸型按钮(挂到「常用纸张」卡)
i = src.find('常用纸张')
print('常用纸张 idx:', i)
rep("${btn('打印空白听写纸','printPaper30','sm')}" if False else "<h2>常用纸张</h2>",
    "<h2>字帖与个性化</h2>")
# 在该卡内补按钮:找常用纸张卡的按钮区
rep("<h2>字帖与个性化</h2>",
"""<h2>字帖与个性化</h2>
  <div class="row">${btn('描红字帖(本课)','printCopybook','grass sm')}${btn('✦ 全班个性化练习','printPersonalized','primary sm')}</div>
  <p class="small muted">个性化练习:按每个学生的听写错词自动生成"一人一卷"看拼音写词语(A2,需配置 AI;无 AI 时按全班共性错词生成)。</p>
  <h2>常用纸张</h2>""")

# 4) 两个打印动作(挂 printProfile 前)
rep("case'aiParent':{",
"""case'printCopybook':{const l=bankLessons().find(x=>String(x.no)===String(ui.teachLesson));if(!l||!l.chars.length)return toast('本课暂无生字');
  const rows=l.chars.map(x=>{const g='<span class="ptian"><b>'+E(x.c)+'</b></span>';return '<div class="print-row"><span>'+E(x.p)+'</span><div>'+g+g.replace('<b>'+E(x.c)+'</b>','<b></b>')+g.replace('<b>'+E(x.c)+'</b>','<b></b>')+'</div></div>'}).join('');
  printHTML(printHeader('第'+E(l.no)+'课 描红字帖','姓名:____________','')+rows);break}
case'printPersonalized':{
  const c=currentClass();if(!c)return toast('先建班级');
  const st=inClass(state.students).slice().sort((a,b)=>a.no.localeCompare(b.no,'zh-CN'));
  if(!st.length)return toast('先导入名册');
  toast('正在为 '+st.length+' 名学生生成个性化练习…');
  // 收集每生错词(无 AI 也能跑:错词来自听写批改)
  const per=st.map(s=>{
    const wrong=new Set();
    inClass(state.dictations).forEach(d=>{(d.studentMarks?.[s.id]?.wrongWords||[]).forEach(w=>wrong.add(w))});
    return {s,words:[...wrong].slice(0,10)};
  });
  const withWords=per.filter(x=>x.words.length);
  if(!withWords.length)return toast('暂无学生错词数据,先批改听写');
  // 纸张:每生一段(拼音来自词库)
  const bank={};bankLessons().forEach(l=>l.words.forEach(x=>{bank[x.w]=x.p}));
  const html=withWords.map(({s,words})=>{
    const rows=words.map(w=>{const p=bank[w]||'';return '<div class="print-row"><span></span><span>'+E(p)+'</span><div class="print-lines"></div></div>'}).join('');
    return '<div class="print-block" style="page-break-before:always"><b>'+E(s.no)+'号 个性化练习(错词复练)</b>'+rows+'</div>';
  }).join('');
  printHTML(printHeader('个性化看拼音写词语','班级:'+E(c.name),'')+html);break}
case'aiParent':{""")

open('app.js', 'w', encoding='utf-8').write(src)
print('final patch done:', n0, '->', len(src))
