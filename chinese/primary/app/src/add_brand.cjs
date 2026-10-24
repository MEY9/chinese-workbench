// 品牌卡 + submit case(剩余两处)
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
const NL = String.fromCharCode(13, 10);
let n = 0;
function rep(a, b) {
  if (!src.includes(a)) throw new Error('MISS: ' + a.slice(0, 70));
  src = src.replace(a, b); n++;
  fs.writeFileSync('app.js', src);
}
// 6) 设置页品牌卡
rep('<section class="card"><h2>备份与恢复</h2>',
'<section class="card"><h2>品牌(左侧栏名称与标语)</h2><form data-form="brand" class="stack">' + NL +
'<div class="fieldrow"><label class="field">应用名称(≤12字)<input name="bname" maxlength="12" value="${E((state.brand||{}).name||' + "'语文工作台'" + ')}"></label>' + NL +
'<label class="field">副标语(≤20字)<input name="bslogan" maxlength="20" value="${E((state.brand||{}).slogan||' + "'小学语文教师'" + ')}"></label></div>' + NL +
'<div>${btn(' + "'保存品牌'" + ',' + "'brandSave'" + ',' + "'sky sm'" + ')}</div></form></section>' + NL +
'<section class="card"><h2>备份与恢复</h2>');
// 7) submit case brand
rep("case'record':{const c=currentClass();if(!c)break;",
"case'brand':{state.brand={name:formVal(form,'bname')||'语文工作台',slogan:formVal(form,'bslogan')||'小学语文教师'};ui.dirty=true;await save();renderApp();toast('品牌已更新');break}" + NL + "case'record':{const c=currentClass();if(!c)break;");
fs.writeFileSync('app.js', src);
console.log('brand card + case added:', n);
