# -*- coding: utf-8 -*-
"""欢快主题改造补丁:模态框/打印预览/彩色导航/统计贴片/序号章/时间线/步骤条/田字格错词卡"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('src/app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, f'anchor x{src.count(old)} (期望{cnt}): {old[:60]}...'
    src = src.replace(old, new)

# ---------- 1. 模态框 / 打印预览 / 帮助函数(替换 printHTML 定义) ----------
rep('function printHTML(body){document.querySelector(\'#printSheet\').innerHTML=`<div class="print-paper">${body}</div>`;requestAnimationFrame(()=>window.print())}',
'''const NB_COLORS=['#4E9AF1','#FF6B57','#4CAF6E','#9B7BF5','#FFB020'];
function tzWord(w,p){const ps=(p||'').split(' ');const ok=ps.length===w.length&&w.length>0;return '<span class="tzw">'+(ok?'':`<em class="fullpy">${E(p||'')}</em>`)+w.split('').map(ch=>`<i class="tz"><b>${E(ch)}</b></i>`).join('')+'</span>'}
function uiModalShell(inner){const m=document.createElement('div');m.className='modal-mask';m.innerHTML=inner;document.body.appendChild(m);return m}
function uiConfirm(msg,opt={}){let legacy=false;try{legacy=(typeof document==='undefined')||!document.createElement||!document.body}catch(e){legacy=true}
if(legacy)return Promise.resolve(Boolean(confirm(msg)));
return new Promise(res=>{const danger=!!opt.danger;const m=uiModalShell(`<div class="modal${danger?' danger':''}"><div class="modal-ic">${danger?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5.5v8.5"/><path d="M12 17.6v.6"/></svg>':'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V7z"/><path d="M9.3 12.2l2 2 3.6-4.2"/></svg>'}</div><h3>${E(opt.title||(danger?'请确认操作':'请确认'))}</h3><p>${E(msg)}</p><div class="mrow"><button class="btn" data-m="0">取消</button><button class="btn ${danger?'danger':'primary'}" data-m="1">${E(opt.ok||'确定')}</button></div></div>`);m.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b||e.target===m){const ok=b?b.dataset.m==='1':false;m.remove();res(ok)}})})}
function uiInfo(html,title='提示'){let legacy=false;try{legacy=(typeof document==='undefined')||!document.createElement||!document.body}catch(e){legacy=true}
if(legacy){alert(String(html).replace(/<[^>]+>/g,'\\n'));return}
const m=uiModalShell(`<div class="modal"><h3>${E(title)}</h3><div class="modal-body">${html}</div><div class="mrow"><button class="btn primary" data-m="1">知道了</button></div></div>`);m.addEventListener('click',e=>{if(e.target.closest('[data-m]')||e.target===m)m.remove()})}
function printHTML(body){let legacy=false;try{legacy=(typeof document==='undefined')||!document.createElement||!document.body}catch(e){legacy=true}
if(legacy){document.querySelector('#printSheet').innerHTML=`<div class="print-paper">${body}</div>`;requestAnimationFrame(()=>window.print());return}
const m=uiModalShell(`<div class="preview"><div class="desk"><div class="a4paper"><div class="print-paper">${body}</div></div></div><div class="mrow pactions"><button class="btn" data-m="0">关闭</button><button class="btn primary" data-m="1">🖨 打印</button></div></div>`);
m.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b){if(b.dataset.m==='1'){document.querySelector('#printSheet').innerHTML=`<div class="print-paper">${body}</div>`;requestAnimationFrame(()=>window.print())}m.remove()}})}''')

# ---------- 2. 导航配色 ----------
rep("const nav=NAV.map(([key,label,path])=>`<button type=\"button\" data-act=\"navigate\" data-view=\"${key}\" class=\"",
    "const NAVC={home:'#FF6B57',teaching:'#FFB020',marking:'#4CAF6E',resources:'#4E9AF1',classes:'#9B7BF5',settings:'#2FBFB0'};\nconst nav=NAV.map(([key,label,path])=>`<button type=\"button\" data-act=\"navigate\" data-view=\"${key}\" style=\"--nc:${NAVC[key]||'#4E9AF1'}\" class=\"")

# ---------- 3. 统计卡:图标贴片 ----------
rep("const cards=[['计划上课',d.teach,'teaching',''],['待批改',d.mark,'marking','dictation'],['待讲评',d.lecture,'marking','followups'],['待复查',d.follow,'marking','followups']].map(([label,n,v,tab])=>`<button class=\"card metric\" data-act=\"navigate\" data-view=\"${v}\" data-tab=\"${tab}\" type=\"button\"><span>${label}</span><b>${n}</b><small>查看来源 →</small></button>`).join('');",
    "const MCARDS=[['计划上课',d.teach,'teaching','','M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z','#4E9AF1'],['待批改',d.mark,'marking','dictation','M4 20h16M5 16l2-10 10-2 3 3-2 10-10 2z','#FF6B57'],['待讲评',d.lecture,'marking','followups','M4 5h16v10H9l-5 5V5z','#9B7BF5'],['待复查',d.follow,'marking','followups','M10.5 3a7.5 7.5 0 1 0 4.6 13.4L21 21m-4.9-4.6A7.5 7.5 0 0 0 10.5 3z','#4CAF6E']];const cards=MCARDS.map(([label,n,v,tab,path,color])=>`<button class=\"card metric\" style=\"--mc:${color}\" data-act=\"navigate\" data-view=\"${v}\" data-tab=\"${tab}\" type=\"button\"><i class=\"mic\" aria-hidden=\"true\">${icon(path)}</i><div class=\"mtxt\"><span>${label}</span><b>${n}</b><small>查看来源 →</small></div></button>`).join('');")

# ---------- 4. 待办序号章 ----------
rep("const todo=d.all.length?`<div class=\"stack\">${d.all.map(t=>`<div class=\"item row space\"><div>",
    "const todo=d.all.length?`<div class=\"stack\">${d.all.map((t,i)=>`<div class=\"item row space\"><i class=\"nb\" style=\"background:${NB_COLORS[i%NB_COLORS.length]}\">${i+1}</i><div>")

# ---------- 5. 教学进度时间线 ----------
rep("${inBook(state.progress).length?`<p>已安排 ${inBook(state.progress).length} 个课次</p><div class=\"stack\">${inBook(state.progress).slice(-4).map(p=>`<div class=\"item\"><b>第${E(p.lessonNo)}课 ${E(p.title||'')}</b><br><small>${E(p.status)} · 计划 ${dateText(p.planDate)}</small></div>`).join('')}</div>`:'<p class=\"muted\">尚未安排课次。</p>'}",
    "${inBook(state.progress).length?`<p class=\"small muted\" style=\"margin-bottom:10px\">已安排 ${inBook(state.progress).length} 个课次</p><div class=\"tl\">${inBook(state.progress).slice(-3).map(p=>`<div class=\"tl-item\"><i class=\"dot${p.status==='已上课'?' done':''}${p.status==='已讲评'?' done2':''}\"></i><div class=\"tl-txt\"><b>第${E(p.lessonNo)}课 ${E(p.title||'')}</b><small>${E(p.status)} · 计划 ${dateText(p.planDate)}</small></div></div>`).join('')}</div>`:'<p class=\"muted\">尚未安排课次。</p>'}")

# ---------- 6. 批改页:田字格错词 + 步骤条 ----------
rep("<tr><td>${E(x.w)} <small>${E(x.p||'')}</small></td><td><input type=\"number\" name=\"err_${i}\"",
    "<tr><td><span class=\"tzw-row\">${tzWord(x.w,x.p)}</span></td><td><input type=\"number\" name=\"err_${i}\"")
rep("<p class=\"muted\">第${E(rec.lessonNo)}课 · ${dateText(rec.date)} · ${rec.words.length}词</p>",
    "<p class=\"muted\">第${E(rec.lessonNo)}课 · ${dateText(rec.date)} · ${rec.words.length}词</p><div class=\"steps\"><span class=\"st done\">${icon('M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z')}<span>第${E(rec.lessonNo)}课</span></span><i class=\"ln\"></i><span class=\"st done\">${icon('M4 5h16v11H9l-5 5V5z')}<span>听写任务</span></span><i class=\"ln\"></i><span class=\"st cur\">${icon('M4 20h16M5 16l2-10 10-2 3 3-2 10-10 2z')}<span>批改记录</span></span><i class=\"ln\"></i><span class=\"st\">${icon('M5 13l4 4L19 7')}<span>复查</span></span></div>")

# ---------- 7. confirm → uiConfirm(15 处) ----------
pairs = [
 ("function switchView(view){if(ui.dirty&&!confirm('当前表单有未保存的更改，确定离开吗？'))return;",
  "async function switchView(view){if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))return;"),
 ("if(el.id==='classSwitch'){if(ui.dirty&&!confirm('当前表单有未保存的更改，确定切换班级吗？')){renderApp();return}",
  "if(el.id==='classSwitch'){if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换班级吗？'))){renderApp();return}"),
 ("case'navigate':{if(ui.dirty&&!confirm('当前表单有未保存的更改，确定离开吗？'))break;",
  "case'navigate':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))break;"),
 ("case'selectLesson':if(ui.dirty&&!confirm('当前表单有未保存的更改，确定切换课次吗？'))break;",
  "case'selectLesson':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换课次吗？')))break;"),
 ("case'newLesson':{if(ui.dirty&&!confirm('当前表单有未保存的更改，确定新建课次吗？'))break;",
  "case'newLesson':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定新建课次吗？')))break;"),
 ("case'openTask':{if(ui.dirty&&!confirm('当前表单有未保存的更改，确定离开吗？'))break;",
  "case'openTask':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定离开吗？')))break;"),
 ("case'markTab':if(ui.dirty&&!confirm('当前批改有未保存的更改，确定切换吗？'))break;",
  "case'markTab':if(ui.dirty&&!(await uiConfirm('当前批改有未保存的更改，确定切换吗？')))break;"),
 ("case'selectMark':if(ui.dirty&&!confirm('当前批改有未保存更改，确定切换记录吗？'))break;",
  "case'selectMark':if(ui.dirty&&!(await uiConfirm('当前批改有未保存更改，确定切换记录吗？')))break;"),
 ("case'resourceTab':if(ui.dirty&&!confirm('当前表单有未保存的更改，确定切换吗？'))break;",
  "case'resourceTab':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换吗？')))break;"),
 ("case'bindBook':{if(ui.dirty&&!confirm('当前表单有未保存的更改，确定绑定教材吗？'))break;",
  "case'bindBook':{if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定绑定教材吗？')))break;"),
 ("case'switchClass':if(ui.dirty&&!confirm('当前表单有未保存的更改，确定切换班级吗？'))break;",
  "case'switchClass':if(ui.dirty&&!(await uiConfirm('当前表单有未保存的更改，确定切换班级吗？')))break;"),
 ("if(!confirm(`删除“${c.name}”及其学生、教学和批改记录？请先从设置页导出备份。`))break;",
  "if(!(await uiConfirm(`删除“${c.name}”及其学生、教学和批改记录？请先从设置页导出备份。`,{danger:true,ok:'删除'})))break;"),
 ("if(!s||!confirm(`删除学生“${s.name}”？相关批改记录会保留原始编号。`))break;",
  "if(!s||!(await uiConfirm(`删除学生“${s.name}”？相关批改记录会保留原始编号。`,{danger:true,ok:'删除'})))break;"),
 ("if(!confirm('确认用所选备份整体覆盖当前 R1 数据？'))break;",
  "if(!(await uiConfirm('确认用所选备份整体覆盖当前 R1 数据？',{danger:true,ok:'覆盖导入'})))break;"),
 ("case'reopenDict':{if(ui.dirty&&!confirm('当前批改有未保存更改，确定离开吗？'))break;",
  "case'reopenDict':{if(ui.dirty&&!(await uiConfirm('当前批改有未保存更改，确定离开吗？')))break;"),
]
for old, new in pairs:
    rep(old, new)

# ---------- 8. alert → uiInfo ----------
rep("case'showLegacy':alert(state.legacyWrong.length?state.legacyWrong.map(x=>`${x.word} ${x.pinyin}`).join('\\n'):'没有旧版未归班错词');break;",
    "case'showLegacy':uiInfo(state.legacyWrong.length?state.legacyWrong.map(x=>`<b>${E(x.word)}</b> <span class=\"py\">${E(x.pinyin)}</span>`).join('<br>'):'没有旧版未归班错词','旧版未归班错词');break;")

open('src/app.js', 'w', encoding='utf-8').write(src)
print(f'patched: {n0} -> {len(src)} bytes, 全部锚点命中')
# 确认无残留原生 confirm(除回退实现内的)
import re
left = [m.start() for m in re.finditer(r'(?<!Boolean\()confirm\(', src)]
print('剩余原生 confirm 引用:', left)
