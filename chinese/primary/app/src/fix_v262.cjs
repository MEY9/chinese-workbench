// v2.6.2 收尾:①删除未发布迁移文案 ②名册模板下载 ③模型下拉+红提示 ④小组件样式去除 ⑤首页填充
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
let css = fs.readFileSync('style.css', 'utf8');
const NL = String.fromCharCode(13, 10);
let n = 0;
function rep(a, b) {
  if (!src.includes(a)) throw new Error('MISS: ' + a.slice(0, 70));
  src = src.replace(a, b); n++;
  fs.writeFileSync('app.js', src);
}

// ===== ① 删除"数据迁移与隐私"整段(未发布,无迁移场景) =====
const migStart = src.indexOf('<section class="card mt"><h2>数据迁移与隐私</h2>');
if (migStart >= 0) {
  const migEnd = src.indexOf('</section>', migStart) + '</section>'.length;
  src = src.slice(0, migStart) + src.slice(migEnd);
  n++; console.log('迁移文案段已删除');
} else {
  // 兼容其它结构:按标题逐行删
  const t = src.indexOf('数据迁移与隐私');
  if (t >= 0) { console.log('标题存在但结构不同 @', t, '——打印上下文'); console.log(src.slice(t - 120, t + 200)); }
}

// ===== ② 学生名册模板下载(班级页 CSV 说明处加按钮) =====
rep('CSV 表头：学号,姓名。支持匿名代号；同名以学号区分。导入前预览冲突，取消不会修改数据。',
    'CSV 表头：学号,姓名。支持匿名代号；同名以学号区分。导入前预览冲突，取消不会修改数据。${btn(' + "'⬇ 下载名册模板'" + ',' + "'downloadRosterTpl'" + ',' + "'sm'" + ')}');
rep("case'newsRefresh':newsFetch(true);break;",
"case'downloadRosterTpl':{const rows=['学号,姓名','01,张三','02,李四','03,王小明','04,（示例行可删除）'];const csv='\\ufeff'+rows.join(String.fromCharCode(13,10));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='学生名册模板.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);toast('模板已下载,填好后导入');break}\ncase'newsRefresh':newsFetch(true);break;");

// ===== ③ 模型 input → 下拉 + 红色消耗提示 =====
rep("${field('model','模型',ai.model||'')}",
  '<label class="field">模型<select name="model">'
  + '<option value="deepseek-flash"${(ai.model||"deepseek-flash")==="deepseek-flash"?" selected":""}>deepseek-flash(推荐,日常使用)</option>'
  + '<option value="deepseek-v4-pro"${ai.model==="deepseek-v4-pro"?" selected":""}>deepseek-v4-pro(更强,消耗更大)</option>'
  + '</select></label>'
  + '<div id="modelWarn" class="notice"${ai.model==="deepseek-v4-pro"?"":" hidden"}>⚠ 你选择了 deepseek-v4-pro:它更聪明,但消耗量明显更大、费用更高。日常批改与草稿用 deepseek-flash 就足够。</div>');

// ===== ④ 模型 change 切换提示 =====
rep("document.addEventListener('change',async event=>{const el0=event.target;",
  "document.addEventListener('change',async event=>{const el0=event.target;if(el0.name==='model'){const w=document.getElementById('modelWarn');if(w)w.hidden=el0.value!=='deepseek-v4-pro'}");

// ===== ⑤ 小组件表单去掉样式选项(固定彩带底) =====
const styleIdx = src.indexOf('<div class="fieldrow"><label class="field">样式<select name="mqStyle">');
if (styleIdx >= 0) {
  const segEnd = src.indexOf('</label></div>', styleIdx) + '</label></div>'.length;
  src = src.slice(0, styleIdx) + '<input type="hidden" name="mqStyle" value="ribbon">' + src.slice(segEnd);
  n++; console.log('样式下拉已去除');
}
if (src.includes("style:gv2('mqStyle')||'ribbon'")) {
  src = src.replace("style:gv2('mqStyle')||'ribbon'", "style:'ribbon'");
  n++; console.log('widgetSave 固定 ribbon');
}

// ===== ⑥ 首页填充 =====
rep('<main class="page${ui.view===\'pdf\'?\' pdf-full\':\'\'}">',
    '<main class="page${ui.view===\'pdf\'?\' pdf-full\':ui.view===\'home\'?\' home-fill\':\'\'}">');

fs.writeFileSync('app.js', src);

// ===== CSS L13 =====
const cssAdd = NL + NL + [
'/* ============ L13 首页填充(高窗口不留大片空白) ============ */',
'.page.home-fill{display:flex;flex-direction:column}',
'.page.home-fill>.grid{flex:1;align-items:stretch}',
'.page.home-fill>.grid>.card{display:flex;flex-direction:column}',
'.page.home-fill .card>.empty{flex:1;display:flex;flex-direction:column;justify-content:center}',
'.page.home-fill>.metrics{flex:0 0 auto}',
'.page.home-fill>.widgets-row{flex:0 0 auto}'
].join(NL);
if (!css.includes('L13 首页填充')) { css = css + cssAdd; n++; }
fs.writeFileSync('style.css', css);
console.log('v2.6.2 收尾完成, edits:', n);
