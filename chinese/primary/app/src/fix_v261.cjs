// v2.6.1 交互收尾:小组件/课文保存 case 补齐 + 死代码清理 + 模型下拉 + 首页填充
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
const NL = String.fromCharCode(13, 10);
let n = 0;
function rep(a, b) {
  if (!src.includes(a)) throw new Error('MISS: ' + a.slice(0, 70));
  src = src.replace(a, b); n++;
  fs.writeFileSync('app.js', src);
}

// 1) 补 widgetSave / reciteSave 两个 click case(挂在 saveRecordBtn 后)
rep("case'aiMark':{const d=inClass(state.dictations).find",
`case'widgetSave':{const wf=document.querySelector('form[data-form=widgets]');if(!wf)break;
  const gv2=n3=>{const el=wf.elements.namedItem(n3);return el?String(el.value||'').trim():''};
  state.widgets={marquee:{texts:(gv2('marquee')||'').split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean),off:false,style:'ribbon'},clock:{off:gv2('clockOn')!=='on',countdownMin:Number(gv2('countdown'))||0}};
  ui.dirty=true;await save();renderApp();toast('小组件已更新');break}
case'reciteSave':{const rf=document.querySelector('form[data-form=recite]');if(!rf)break;
  ui.reciteRaw=new FormData(rf).get('reciteText')||'';toast('课文已保存,可挖空');break}
case'aiMark':{const d=inClass(state.dictations).find`);
n++;

// 2) 清理 submit 开关中已死的 record/widgets/recite case(按钮已改 type=button)
const deadRe = /case'(record|widgets|recite)':\{const c=currentClass\(\);if\(!c\)break;\r?\n/g;
src = src.replace(/case'record':\{const c=currentClass\(\);if\(!c\)break;/, '');
src = src.replace(/case'widgets':\{const c2?=?[^}]*break;\r?\n/, '');
// 精确清理三个(逐个定位)
function stripCase(name) {
  const i = src.indexOf("case'" + name + "':{");
  if (i < 0) { console.log('dead case', name, 'not found (ok)'); return; }
  // 找到配对 break(到下一个 \r\ncase' 或行尾 }
  const endMark = "break}" + String.fromCharCode(13, 10);
  const j = src.indexOf("break}" + String.fromCharCode(13, 10), i);
  if (j > i && j - i < 1200) { src = src.slice(0, i) + src.slice(j + ("break}" + String.fromCharCode(13, 10)).length); console.log('stripped dead case', name); }
}
stripCase('record'); stripCase('widgets'); stripCase('recite');
fs.writeFileSync('app.js', src);

// 3) 设置页:模型改为下拉(两个选项)+ v4-pro 红色提示;小组件表单去掉样式选项
rep("${field('model','模型',ai.model||'')}",
`<label class="field">模型<select name="model"><option value="deepseek-flash" ${(ai.model||'deepseek-flash')==='deepseek-flash'?'selected':''}>deepseek-flash(推荐,日常使用)</option><option value="deepseek-v4-pro" ${ai.model==='deepseek-v4-pro'?'selected':''}>deepseek-v4-pro(更强,消耗更大)</option></select></label>
<div id="modelWarn" class="notice" ${ai.model==='deepseek-v4-pro'?'':'hidden'}>⚠ 你选择了 deepseek-v4-pro:它更聪明,但消耗量明显更大、费用更高。日常批改、草稿和小任务用 deepseek-flash 就够了。</div>`);
n++;

// 4) 小组件表单去掉样式下拉(固定彩带)
rep(`<div class="fieldrow"><label class="field">样式<select name="mqStyle"><option value="ribbon" ${((state.widgets||{}).marquee||{}).style!=='plain'?'selected':''}>彩带底</option><option value="plain" ${((state.widgets||{}).marquee||{}).style==='plain'?'selected':''}>纯文字</option></select></label>`,
`<div class="fieldrow"><label class="field">样式<select name="mqStyle" hidden><option value="ribbon" selected></option></select></label>`);

// 5) widgetSave 直接固定 ribbon(读不到 mqStyle 也无妨)
src = src.replace("style:gv2('mqStyle')||'ribbon'", "style:'ribbon'");
fs.writeFileSync('app.js', src);

// 6) 模型下拉 change 时切换红色提示(change 监听器头部)
rep("document.addEventListener('change',async event=>{const el0=event.target;",
"document.addEventListener('change',async event=>{const el0=event.target;if(el0.name==='model'){const w=document.getElementById('modelWarn');if(w)w.hidden=el0.value!=='deepseek-v4-pro'}");
n++;

// 7) 首页填充:home 视图主栅格拉伸,填满窗口高度
rep("<main class=\"page${ui.view==='pdf'?' pdf-full':''}\">", "<main class=\"page${ui.view==='pdf'?' pdf-full':ui.view==='home'?' home-fill':''}\">");
const cssAdd = NL + NL + `/* ============ L13 首页填充(高窗口不留大片空白) ============ */
.page.home-fill{display:flex;flex-direction:column}
.page.home-fill>.grid{flex:1;align-items:stretch}
.page.home-fill .grid>.card{display:flex;flex-direction:column}
.page.home-fill .card .empty{flex:1;display:flex;flex-direction:column;justify-content:center}
.page.home-fill .card .tl{flex:1}
.page.home-fill>.card:last-of-type{flex:0 0 auto}
.page.home-fill>.metrics{flex:0 0 auto}`;
if (!css.includes('L13 首页填充')) { css = css + cssAdd; fs.writeFileSync('style.css', css); }
n++;
fs.writeFileSync('style.css', css);
console.log('all done, edits:', n);
