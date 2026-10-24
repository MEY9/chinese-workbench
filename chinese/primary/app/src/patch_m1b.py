# -*- coding: utf-8 -*-
"""M1 补丁 B:事件处理(点名/背诵/档案动作)+ AI 基座 + 首页组件注入 + 键盘"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor x%d (期望%d): %s' % (src.count(old), cnt, old[:70])
    src = src.replace(old, new)

# ---------- 1. click 动作 ----------
rep("case'classes':body=renderClasses();break;",
    "case'classes':body=renderClasses();break;case'goRoll':ui.view='rollcall';renderApp();break;case'rollMode':ui.rollMode=el.dataset.mode;renderApp();break;case'rollMark':{const c=ui.rollCurrent;if(!c)break;state.records=state.records||[];state.records.push({id:uid(),classId:c.classId,studentId:c.id,type:'课堂表现',date:today(),note:'随机点名回答问题',followUp:'',sensitive:false});ui.dirty=true;await save();rollNext();break}case'rollSkip':rollNext();break;case'pickStudent':ui.profileStudent=el.dataset.id;renderApp();break;case'delRecord':{if(!(await uiConfirm('删除这条观察记录?',{danger:true,ok:'删除'})))break;state.records=(state.records||[]).filter(r=>r.id!==el.dataset.id);ui.dirty=true;await save();renderApp();break}case'saveRecordBtn':document.querySelector('form[data-form=record]')?.requestSubmit();break;case'reciteAI':{const ai=S.settings.ai||{};if(!ai.key&&!await DesktopAI.hasKey())return toast('请先在设置里配置 AI Key');toast('AI 正在挖空…');try{const text=(ui.reciteRaw||'').trim();if(!text)return toast('先录入课文');const out=await DesktopAI.chat([{role:'system',content:'你是小学语文老师助手。把课文改写成挖空版:把最关键的词替换为 ⟦答案⟧ 占位(保留原字)。只输出改写后的课文,不要解释。挖空 6-12 处。'},{role:'user',content:text}],0.3);ui.reciteText=out.trim();ui.reciteGaps=[];const rx=/⟦([^⟧]+)⟧/g;let m;while((m=rx.exec(ui.reciteText))){ui.reciteGaps.push(m[1])}ui.reciteText=ui.reciteText.replace(/⟦[^⟧]+⟧/g,'⟦GAP⟧');let idx=0;ui.reciteText=ui.reciteText.replace(/⟦GAP⟧/g,()=>('⟦'+(idx++)+'⟧'));ui.reciteCur=0;ui.reciteHints=0;renderApp();toast('AI 挖空完成:'+ui.reciteGaps.length+' 处')}catch(e){toast('AI 失败:'+e.message)}break}case'reciteAuto':reciteAutoGaps();break;case'reciteReset':ui.reciteText=ui.reciteRaw||'';ui.reciteGaps=[];ui.reciteCur=0;renderApp();break;case'reciteDensity':ui.reciteDensity=el.dataset.d;renderApp();break;case'recitePrev':if(ui.reciteCur>0){ui.reciteCur--;renderApp()}break;case'reciteNext':if(ui.reciteCur<ui.reciteGaps.length-1){ui.reciteCur++;renderApp()}break;case'reciteHintFirst':{ui.reciteCur=Math.min(ui.reciteCur,ui.reciteGaps.length-1);const w=ui.reciteGaps[ui.reciteCur]||'';ui.reciteHints++;toast('首字:「'+(w?w[0]:'')+'」');break}case'reciteHintFull':{ui.reciteHints++;ui.reciteCur=Math.min(ui.reciteCur,ui.reciteGaps.length-1);toast('整词:「'+(ui.reciteGaps[ui.reciteCur]||'')+'」');break}case'reciteSkip':ui.reciteCur=Math.min(ui.reciteCur+1,Math.max(0,ui.reciteGaps.length-1));renderApp();break;case'reciteSpeak':{const t=ui.reciteText.replace(/⟦\\d+⟧/g,'____');TTS.speak(t,{rate:0.8});break}case'reciteDone':{const c=currentClass();if(!c)break;state.reciteLogs=state.reciteLogs||[];state.reciteLogs.push({id:uid(),classId:c.id,studentId:ui.profileStudent,date:today(),pass:ui.reciteHints<=ui.reciteGaps.length/2,hints:ui.reciteHints});ui.dirty=true;await save();toast('已记入学生档案');ui.view='profile';renderApp();break}case'aiSummary':{const ai=S.settings.ai||{};const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;toast('AI 生成中(已脱敏)…');try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文老师。基于给出的真实数据写学期小结,80 字内,先扬后抑,语气鼓励。只输出小结正文。'},{role:'user',content:profileDataSummary(cur)}],0.4);state.aiCache=state.aiCache||{};state.aiCache['summary:'+cur.id]=out;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}case'aiSummaryKeep':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;state.records=state.records||[];state.records.push({id:uid(),classId:c2id(c2cur()),studentId:cur.id,type:'其他',date:today(),note:'[AI 学期小结·已审定] '+(state.aiCache['summary:'+cur.id]||''),followUp:'',sensitive:false});delete state.aiCache['summary:'+cur.id];ui.dirty=true;await save();toast('已归档到观察记录');renderApp();break}break;".replace('c2id(c2cur())','currentClass()?.id') + ";break".replace(';break','') , 1) if False else None

# 由于上面长 case 复杂,改为分开注入:在 case'deleteClass' 前插
rep("case'deleteClass':",
"""case'goRoll':ui.view='rollcall';renderApp();break;
case'rollMode':ui.rollMode=el.dataset.mode;renderApp();break;
case'rollMark':{const c=ui.rollCurrent;if(!c)break;state.records=state.records||[];state.records.push({id:uid(),classId:c.classId,studentId:c.id,type:'课堂表现',date:today(),note:'随机点名回答问题',sensitive:false});ui.dirty=true;await save();rollNext();break}
case'rollSkip':rollNext();break;
case'pickStudent':ui.profileStudent=el.dataset.id;renderApp();break;
case'delRecord':{if(!(await uiConfirm('删除这条观察记录?',{danger:true,ok:'删除'})))break;state.records=(state.records||[]).filter(r=>r.id!==el.dataset.id);ui.dirty=true;await save();renderApp();break}
case'saveRecordBtn':document.querySelector('form[data-form=\\'record\\']')?.requestSubmit();break;
case'reciteAI':{const ai=S.settings.ai||{};if(!ai.key&&!(await DesktopAI.hasKey())){toast('请先在设置里配置 AI Key');break}const text=(ui.reciteRaw||'').trim();if(!text){toast('先在「录入课文」里粘贴课文');break}toast('AI 正在挖空…');try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文老师助手。把课文改写成挖空版:把最关键的词替换为⟦答案⟧占位(保留原字在占位内)。只输出改写后的课文,不要解释,挖空 6 到 12 处。'},{role:'user',content:text}],0.3);const gaps=[];const rx=/⟦([^⟧]+)⟧/g;let m;const marked=out.replace(rx,()=>{const mm=/⟦([^⟧]+)⟧/.exec(out.slice(rx.lastIndex-1));return m});let out2=out;let idx=0;out2=out.replace(/⟦([^⟧]+)⟧/g,(_,w)=>{gaps.push(w);return '⟦'+(idx++)+'⟧'});ui.reciteText=out2;ui.reciteGaps=gaps;ui.reciteCur=0;ui.reciteHints=0;renderApp();toast('AI 挖空完成:'+gaps.length+' 处')}catch(e){toast('AI 失败:'+e.message)}break}
case'reciteAuto':reciteAutoGaps();break;
case'reciteReset':ui.reciteText=ui.reciteRaw||'';ui.reciteGaps=[];ui.reciteCur=0;renderApp();break;
case'reciteDensity':ui.reciteDensity=el.dataset.d;renderApp();break;
case'recitePrev':if(ui.reciteCur>0){ui.reciteCur--;renderApp()}break;
case'reciteNext':if(ui.reciteCur<ui.reciteGaps.length-1){ui.reciteCur++;renderApp()}break;
case'reciteHintFirst':{ui.reciteCur=Math.min(ui.reciteCur,Math.max(0,ui.reciteGaps.length-1));ui.reciteHints++;toast('首字:「'+(ui.reciteGaps[ui.reciteCur]||'').slice(0,1)+'」');break}
case'reciteHintFull':{ui.reciteHints++;toast('整词:「'+(ui.reciteGaps[ui.reciteCur]||'')+'」');break}
case'reciteSkip':ui.reciteCur=Math.min(ui.reciteCur+1,Math.max(0,ui.reciteGaps.length-1));renderApp();break;
case'reciteSpeak':TTS.speak(ui.reciteText.replace(/⟦\\d+⟧/g,'____'),{rate:0.8});break;
case'reciteDone':{const c=currentClass();if(!c||!ui.profileStudent)break;state.reciteLogs=state.reciteLogs||[];state.reciteLogs.push({id:uid(),classId:c.id,studentId:ui.profileStudent,date:today(),pass:ui.reciteHints<=ui.reciteGaps.length/2,hints:ui.reciteHints});ui.dirty=true;await save();toast('已记入学生档案');ui.view='profile';renderApp();break}
case'aiSummary':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);if(!cur)break;toast('AI 生成中(已脱敏)…');try{const out=await DesktopAI.chat([{role:'system',content:'你是小学语文老师。基于给出的真实数据写学期小结,80 字内,先扬后抑,语气鼓励。只输出小结正文。'},{role:'user',content:profileDataSummary(cur)}],0.4);state.aiCache=state.aiCache||{};state.aiCache['summary:'+cur.id]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'aiSummaryKeep':{const cur=(inClass(state.students)||[]).find(x=>x.id===ui.profileStudent);const c=currentClass();if(!cur||!c)break;state.records=state.records||[];state.records.push({id:uid(),classId:c.id,studentId:cur.id,type:'其他',date:today(),note:'[AI 学期小结·已审定] '+(state.aiCache['summary:'+cur.id]||''),sensitive:false});delete state.aiCache['summary:'+cur.id];ui.dirty=true;await save();toast('已归档到观察记录');renderApp();break}
case'printProfile':printProfile();break;
case'printTalk':printTalk();break;
case'widgetSave':document.querySelector('form[data-form=widgets]')?.requestSubmit();break;
case'deleteClass':""")

# ---------- 2. 表单:record / reciteText / widgets ----------
rep("if(el.id==='tempPdfFile'){",
"""if(form?.dataset.form==='record'){const c=currentClass();if(!c)return;state.records=state.records||[];
  state.records.push({id:uid(),classId:c.id,studentId:form.dataset.id,type:values.type||'其他',date:values.date||today(),note:values.note||'',sensitive:!!values.sensitive});
  ui.dirty=true;await save();toast('已记录');renderApp();return}
if(form?.dataset.form==='widgets'){state.widgets={marquee:{texts:(values.marquee||'').split('\\n').map(s=>s.trim()).filter(Boolean),off:false,style:values.mqStyle||'ribbon'},clock:{off:!values.clockOn,countdownMin:values.countdown||0}};ui.dirty=true;await save();renderApp();toast('小组件已更新');return}
if(el.id==='reciteRaw'===false&&(form?.dataset.form==='recite')){ui.reciteRaw=values.reciteText||'';toast('课文已保存,可挖空');renderApp();return}
if(el.id==='tempPdfFile'){""")

# reciteText textarea 保存:监听 submit(在 details 里 textarea 无 form 包裹,给它包 form)
rep("<textarea name=\"reciteText\" rows=\"6\" placeholder=\"粘贴课文文本…\">${E(ui.reciteRaw||'')}</textarea>",
    "<form data-form=\"recite\"><textarea name=\"reciteText\" rows=\"6\" placeholder=\"粘贴课文文本…\">${E(ui.reciteRaw||'')}</textarea><button class=\"btn grass sm mt\" type=\"submit\">保存课文</button></form>")

# ---------- 3. DesktopAI 桥 + 键盘 + 默认状态字段 ----------
rep("function tzWord(w,p)",
"""const DesktopAI={async hasKey(){return window.desktop?Boolean(await window.desktop.ai.getKey()):Boolean(S.settings.ai&&S.settings.ai.key)},
async chat(messages,temperature){if(window.desktop)return window.desktop.ai.chat({base:S.settings.ai.base||'https://api.deepseek.com',model:S.settings.ai.model||'deepseek-chat',messages,temperature});
const ai=S.settings.ai||{};return (await fetch((ai.base||'https://api.deepseek.com').replace(/\\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(ai.key||'')},body:JSON.stringify({model:ai.model||'deepseek-chat',messages,temperature})})).json().then(d=>d.choices[0].message.content)}};
window.addEventListener('keydown',e=>{
  if(ui.view==='rollcall'&&!e.repeat&&!/input|textarea|select/i.test(e.target.tagName)){
    if(e.code==='Space'){e.preventDefault();rollNext()}
    if(e.code==='Enter'){e.preventDefault();document.querySelector('[data-act=rollMark]')?.click()}
  }
});
function printProfile(){const c=currentClass();if(!c)return;const cur=(state.students||[]).find(x=>x.id===ui.profileStudent);if(!cur)return toast('先选择学生');
  const recs=(state.records||[]).filter(r=>r.studentId===cur.id);
  printHTML(printHeader('学生档案汇总 · '+E(cur.no)+'号','姓名:'+E(cur.name),'')+
  '<div class="print-block"><b>观察记录('+recs.length+'条)</b>'+ (recs.map(r=>`<p>${E(r.date)} · ${E(r.type)}:${E(r.note)}</p>`).join('')||'<p>无</p>')+'</div>')}
function printTalk(){const c=currentClass();if(!c)return;const cur=(state.students||[]).find(x=>x.id===ui.profileStudent);if(!cur)return toast('先选择学生');
  const talks=(state.records||[]).filter(r=>r.studentId===cur.id&&r.type==='谈心谈话');
  printHTML(printHeader('谈心谈话记录表','班级:'+E(c.name),'')+
  '<div class="print-block"><b>学生</b><p>'+E(cur.no)+'号 '+E(cur.name)+'</p></div>'+
  '<div class="print-block"><b>谈话记录</b>'+(talks.map(r=>`<p>${E(r.date)}:${E(r.note)}</p>`).join('')||'<p>____________</p><p>____________</p>')+'</div>'+
  '<div class="print-block"><b>教师签名</b><p>________________</p></div>')}
function tzWord(w,p)""")

# defaultState 补 records/reciteLogs/aiCache/widgets
rep("legacyWrong:[],bankOverride:{}",
    "legacyWrong:[],records:[],reciteLogs:[],aiCache:{},widgets:{marquee:{texts:['今天也要元气满满,孩子们加油!'],style:'ribbon'},clock:{countdownMin:0}},bankOverride:{}")
# 兼容旧库迁移:loaded state 缺字段补齐
rep("state=result.state===null?defaultState():structuredClone(checkedStoredState(result.state));",
    "state=result.state===null?defaultState():Object.assign(defaultState(),structuredClone(checkedStoredState(result.state)));state.records=state.records||[];state.reciteLogs=state.reciteLogs||[];state.aiCache=state.aiCache||{};state.widgets=state.widgets||{marquee:{texts:['今天也要元气满满,孩子们加油!'],style:'ribbon'},clock:{countdownMin:0}};")

# 首页注入小组件(在 renderHome 的 metrics 之前)
rep("return heading('今天先做什么','以下内容来自本班已保存的教学记录。')+`<div class=\"metrics\">",
    "return heading('今天先做什么','以下内容来自本班已保存的教学记录。')+`<div class=\"widgets-row\">${widgetMarquee()}${widgetClock()}</div><div class=\"metrics\">")

# 设置页:小组件配置卡
rep("<section class=\"card\"><h2>备份与恢复</h2>",
    """<h3>首页小组件</h3><div class="card"><form data-form="widgets" class="stack">
    <label class="field">跑马灯文本(每行一条,轮播)<textarea name="marquee" rows="3">${E(((state.widgets||{}).marquee||{}).texts||['今天也要元气满满,孩子们加油!']).join('\\n')}</textarea></label>
    <div class="fieldrow"><label class="field">样式<select name="mqStyle"><option value="ribbon" ${((state.widgets||{}).marquee||{}).style!=='plain'?'selected':''}>彩带底</option><option value="plain" ${((state.widgets||{}).marquee||{}).style==='plain'?'selected':''}>纯文字</option></select></label>
    <label class="field">课堂倒计时(分钟,0=不显示)<input type="number" name="countdown" min="0" max="120" value="${((state.widgets||{}).clock||{}).countdownMin||0}"></label></div>
    <label class="row"><input type="checkbox" name="clockOn" ${((state.widgets||{}).clock||{}).off?'':'checked'}> 显示时钟</label>
    <div>${btn('保存小组件','widgetSave','sky sm')}</div></form></div></section>
    <section class="card"><h2>备份与恢复</h2>""")

open('app.js', 'w', encoding='utf-8').write(src)
print('patch B done:', n0, '->', len(src))
