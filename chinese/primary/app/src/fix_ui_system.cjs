// v2.5 视觉/交互体系升级
// ① 移除 L9.5 冷色覆盖层(统一为 G1 已批欢快主题) ② 交互体系:内联校验/涟漪/Toast 升级/视图过渡
const fs = require('fs');

/* ===== ① style.css:移除 L9.5 冷色层,追加 L11 交互体系 ===== */
let css = fs.readFileSync('style.css', 'utf8');
const l95 = css.indexOf('/* ============ L9.5');
const l10 = css.indexOf('/* ============ L10');
if (l95 > 0 && l10 > l95) {
  css = css.slice(0, l95) + css.slice(l10);
  console.log('L9.5 cold layer removed,', css.length, 'chars');
} else { console.log('L9.5 not found (already removed)'); }

css += String.fromCharCode(10) + `/* ============ L11 交互体系:校验/涟漪/Toast/过渡 ============ */
/* 内联校验(替代原生气泡) */
.field-error{color:var(--coral);font-size:12px;font-weight:650;display:flex;gap:4px;align-items:center;margin-top:3px;animation:errin .18s ease-out}
@keyframes errin{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
input.invalid,textarea.invalid,select.invalid{border-color:var(--coral)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--coral) 16%,transparent)!important}
form.shake{animation:shake .36s ease-out}
@keyframes shake{20%{transform:translateX(-5px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}

/* 涟漪(按钮/导航/选项卡) */
.btn,.nav button,.tabs button,.pick,.chip,.seat{position:relative;overflow:hidden}
.ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.22;transform:scale(0);animation:rip .55s ease-out;pointer-events:none}
@keyframes rip{to{transform:scale(2.8);opacity:0}}

/* Toast 升级:图标+类型+进度条 */
#toast{display:flex;align-items:center;gap:9px;overflow:hidden}
#toast .t-ic{width:21px;height:21px;border-radius:50%;background:rgba(255,255,255,.22);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
#toast .t-bar{position:absolute;left:0;bottom:0;height:3px;background:rgba(255,255,255,.5);animation:tbar 2.6s linear forwards}
@keyframes tbar{from{width:100%}to{width:0}}
#toast.t-success{background:linear-gradient(180deg,#5CB97A,var(--grass))}
#toast.t-error{background:linear-gradient(180deg,#FF8A76,var(--coral))}
#toast.t-info{background:linear-gradient(180deg,#3B4A66,var(--ink))}

/* 视图过渡(铺纸感) */
.page>*{animation:viewin .22s ease-out}
@keyframes viewin{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}

/* 模态弹性入场 */
@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.94)}to{opacity:1;transform:none}}
.modal{animation:pop .26s cubic-bezier(.34,1.45,.64,1)}
.preview{animation:pop .26s cubic-bezier(.34,1.45,.64,1)}

/* 细节 */
details>summary:hover{background:var(--mango-bg)}
.chip:hover{transform:translateY(-1px)}
.field input:hover,.field select:hover,.field textarea:hover{border-color:#DEC9A4}
@media(prefers-reduced-motion:reduce){.page>*{animation:none!important}}
`;
fs.writeFileSync('style.css', css);
console.log('css L11 appended');

/* ===== ② app.js:校验体系 + 涟漪 + Toast ===== */
let app = fs.readFileSync('app.js', 'utf8');
function rep(a, b) {
  if (!app.includes(a)) throw new Error('ANCHOR MISS: ' + a.slice(0, 70));
  app = app.replace(a, b);
  fs.writeFileSync('app.js', app);
}

// Toast 升级(智能类型识别)
rep('function toast(message){const box=document.querySelector(\'#toast\');box.textContent=message;box.classList.add(\'show\');clearTimeout(box._timer);box._timer=setTimeout(()=>box.classList.remove(\'show\'),2600)}',
`function toast(message,type){const box=document.querySelector('#toast');
  type=type||(/失败|错误|请先|无法|不正确|不存在/.test(message)?'error':/成功|已保存|已创建|已导入|已删除|已记录|已归档|已更新|已复制|已采纳|已审定|已完成|已记入/.test(message)?'success':'info');
  const icon=type==='error'?'!':type==='success'?'✓':'i';
  box.classList.remove('show','t-success','t-error','t-info');box.classList.add('show','t-'+type);
  box.innerHTML='<span class="t-ic">'+icon+'</span><span>'+E(message)+'</span><i class="t-bar"></i>';
  clearTimeout(box._timer);box._timer=setTimeout(()=>box.classList.remove('show'),2600)}`);

// 提交时内联校验(替代原生气泡)
rep("document.addEventListener('submit',async event=>{const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();",
`document.addEventListener('submit',async event=>{const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
  {form.querySelectorAll('.field-error').forEach(x=>x.remove());form.querySelectorAll('.invalid').forEach(x=>x.classList.remove('invalid'));
   if(!form.checkValidity()){form.querySelectorAll(':invalid').forEach(el=>{el.classList.add('invalid');const fe=document.createElement('div');fe.className='field-error';fe.textContent='⚠ '+(el.validationMessage||'请检查此字段');(el.closest('.field')||el.parentElement).appendChild(fe)});form.classList.add('shake');setTimeout(()=>form.classList.remove('shake'),380);form.querySelector(':invalid')?.focus();return}}`);

// novalidate 强制(渲染后)+ 修输入即清错 + 涟漪监听
rep("restoreFormDrafts();tintStatusSelects();",
`restoreFormDrafts();tintStatusSelects();
  document.querySelectorAll('form').forEach(f=>{if(!f.novalidate)f.novalidate=true});`)

// 全局一次性监听:修输入清错 + 涟漪
rep("window.addEventListener('keydown',e=>{",
`document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('invalid')){e.target.classList.remove('invalid');const fe=e.target.parentElement&&e.target.parentElement.querySelector(':scope>.field-error');if(fe)fe.remove()}});
document.addEventListener('pointerdown',e=>{const t=e.target.closest('.btn,.nav button,.tabs button,.pick,.chip,.seat');if(!t||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=t.getBoundingClientRect();const s=Math.max(r.width,r.height)*1.15;const sp=document.createElement('span');sp.className='ripple';sp.style.width=sp.style.height=s+'px';sp.style.left=(e.clientX-r.left-s/2)+'px';sp.style.top=(e.clientY-r.top-s/2)+'px';t.appendChild(sp);setTimeout(()=>sp.remove(),560)});
window.addEventListener('keydown',e=>{`)

fs.writeFileSync('app.js', app);
console.log('app.js interaction system done,', app.length, 'chars');
