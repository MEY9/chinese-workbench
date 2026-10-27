// DOM interaction checks only: no live database, browser, network or student data.
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../app/src/selects.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><body><div id="app"><form id="form">
<label>年级<select id="grade" name="grade" required><option value="">请选择</option><option value="1">一年级</option><option disabled value="2">二年级（停用）</option><option value="3">三年级</option></select></label>
<label>册别<select name="term"><option>上册</option><option>下册</option></select></label>
<fieldset disabled><label>锁定<select id="disabled"><option>不可改</option></select></label></fieldset>
</form><button id="outside">其他操作</button></div></body>`, {runScripts:'outside-only', pretendToBeVisual:true});
const w = dom.window, d = w.document;
w.eval(source);
const tick = () => new Promise(resolve => w.setTimeout(resolve, 0));
const trigger = id => d.getElementById(id).parentElement.querySelector('.book-select-trigger');
const key = (target, value) => target.dispatchEvent(new w.KeyboardEvent('keydown', {key:value, bubbles:true,cancelable:true}));
const option = index => d.querySelector(`.book-select-menu [data-index="${index}"]`);
try {
  assert.equal(d.querySelectorAll('.book-select-trigger').length, 3);
  assert.equal(trigger('grade').getAttribute('aria-label'), '年级：请选择');
  assert.equal(d.getElementById('grade').tabIndex, -1);
  assert.ok(trigger('disabled').disabled);
  trigger('disabled').click();
  assert.equal(d.querySelector('.book-select-menu'), null);

  let changes=0, inputs=0;
  d.getElementById('grade').addEventListener('change',()=>changes++);
  d.getElementById('grade').addEventListener('input',()=>inputs++);
  trigger('grade').click();
  assert.equal(trigger('grade').getAttribute('aria-expanded'), 'true');
  assert.equal(d.querySelector('.book-select-search').hidden, true);
  key(trigger('grade'),'ArrowDown');
  key(trigger('grade'),'ArrowDown');
  assert.equal(d.querySelector('.book-select-option.is-active').dataset.index, '3');
  key(trigger('grade'),'Enter');
  assert.equal(d.getElementById('grade').value,'3');
  assert.equal(new w.FormData(d.getElementById('form')).get('grade'),'3');
  assert.equal(changes,1); assert.equal(inputs,1);
  assert.equal(d.activeElement,trigger('grade'));
  trigger('grade').click(); option(3).click();
  assert.equal(changes,1,'unchanged values do not trigger duplicate saves');
  trigger('grade').click(); key(trigger('grade'),'Home'); key(trigger('grade'),'Escape');
  assert.equal(d.getElementById('grade').value,'3','Escape cancels pending navigation');
  trigger('grade').click(); option(2).click();
  assert.equal(d.getElementById('grade').value,'3','disabled rows cannot be chosen');
  d.getElementById('outside').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
  assert.equal(d.querySelector('.book-select-menu'),null);

  d.getElementById('form').reset(); await tick();
  assert.equal(trigger('grade').querySelector('.book-select-value').textContent,'请选择');
  d.getElementById('form').checkValidity();
  assert.equal(d.activeElement,trigger('grade'));
  assert.equal(trigger('grade').getAttribute('aria-invalid'),'true');

  const modal = d.createElement('div'); modal.setAttribute('role','dialog');
  modal.innerHTML='<label>本次学生<select id="students" name="student">'+Array.from({length:50},(_,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')}号 · 测试学生${i+1}</option>`).join('')+'</select></label>';
  d.body.append(modal); await tick();
  let escapedDialog=0; modal.addEventListener('keydown',e=>{if(e.key==='Escape')escapedDialog++});
  trigger('students').click();
  assert.equal(d.querySelector('.book-select-menu').parentElement,modal);
  const search=d.querySelector('.book-select-search');
  assert.equal(d.activeElement,search);
  search.value='５０号'; search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(d.querySelectorAll('.book-select-option').length,1);
  key(search,'Enter');
  assert.equal(d.getElementById('students').value,'49');
  trigger('students').click();
  d.querySelector('.book-select-search').value='不存在';
  d.querySelector('.book-select-search').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.book-select-empty').hidden,false);
  key(d.querySelector('.book-select-search'),'Enter');
  assert.equal(d.getElementById('students').value,'49');
  key(d.querySelector('.book-select-search'),'Escape');
  assert.equal(escapedDialog,0,'Escape closes only the selection menu');
  trigger('students').click();
  key(d.querySelector('.book-select-search'),'Tab');
  assert.equal(d.querySelector('.book-select-menu'),null);
  assert.equal(d.activeElement,trigger('students'));
  trigger('students').click();modal.remove();await tick();
  assert.equal(d.querySelector('.book-select-menu'),null,'removed dialogs leave no orphan panel');

  const select=d.getElementById('grade');
  select.innerHTML='<optgroup label="分组"><option value="safe">&lt;img src=x onerror=alert(1)&gt;</option></optgroup>';
  await tick();trigger('grade').click();
  assert.equal(d.querySelector('.book-select-menu img'),null,'option labels are never interpreted as HTML');
  assert.equal(d.querySelector('.book-select-group').textContent,'分组');
  select.add(new w.Option('动态新增', 'dynamic'));await tick();
  assert.equal(d.querySelectorAll('.book-select-option').length,2,'open menus track dependent options');
  trigger('grade').getBoundingClientRect=()=>({left:970,right:1030,top:730,bottom:774,width:60,height:44});
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(d.querySelector('.book-select-menu').dataset.side,'above');
  assert.ok(parseFloat(d.querySelector('.book-select-menu').style.left)+parseFloat(d.querySelector('.book-select-menu').style.width)<=w.innerWidth);
  select.disabled=true;await tick();
  assert.equal(d.querySelector('.book-select-menu'),null);
  assert.equal(trigger('grade').disabled,true);
  select.disabled=false;select.multiple=true;await tick();
  assert.equal(select.parentElement.tagName,'LABEL','unsupported multiselect restores native field');
  assert.equal(select.getAttribute('aria-hidden'),null);
  select.multiple=false;await tick();
  assert.ok(trigger('grade'));
  for(let i=0;i<10;i++)w.WorkbenchSelects.enhance();
  assert.equal(d.querySelectorAll('.book-select-trigger').length,3,'repeated enhancement is idempotent');
  // Restore focus to the replacement control after an application rerender.
  select.innerHTML='<option value="a">甲</option><option value="b">乙</option>';await tick();
  select.addEventListener('change',()=>{d.querySelector('#app').innerHTML='<label>年级<select id="grade"><option>新页面</option></select></label>';w.WorkbenchSelects.enhance()},{once:true});
  trigger('grade').click();option(1).click();await tick();
  assert.equal(d.activeElement,trigger('grade'));
  assert.equal(d.querySelectorAll('.book-select-trigger').length,1);
  console.log('Select interactions passed: values/events, keyboard, cancel, disabled, forms/reset/validation, search/IME labels, modal lifecycle, XSS, dynamic options and rerender focus.');
} finally {w.WorkbenchSelects.destroy();await tick();w.close();}

// Exercise the real page renderers and delegated filter handlers in an isolated DOM.
const appDom = new JSDOM('<body><div id="app"></div><div id="toast"></div><div id="printSheet"></div></body>', {runScripts:'outside-only',pretendToBeVisual:true,url:'https://test.invalid/'});
const aw=appDom.window, ad=aw.document;
aw.structuredClone=structuredClone;
aw.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
aw.BANK=JSON.parse(fs.readFileSync(new URL('../app/bank.json',import.meta.url),'utf8'));
aw.TEXTBOOKS=JSON.parse(fs.readFileSync(new URL('../app/textbooks-manifest.json',import.meta.url),'utf8')).books;
aw.eval(source);
const appSource=fs.readFileSync(new URL('../app/src/app.js',import.meta.url),'utf8').replace(/startApp\(\);\s*$/, '');
const reliability=fs.readFileSync(new URL('../app/src/reliability.js',import.meta.url),'utf8');
aw.eval(reliability+'\n'+appSource+`
window.testSelectApp={
 init(){state=defaultState();state.classes=[{id:'c1',name:'测试三班',grade:3,term:'上册',bookId:''}];state.selectedClassId='c1';state.students=[{id:'s1',classId:'c1',no:'01',name:'测试学生'}];ui.aiReady=false;},
 render(view){ui.view=view;renderApp();},
 filter(){return ui.bookGrade;},
 modal(){return configureDialog('教师判断','<label class="field">结果<select name="result"><option value="practice">待复查</option><option value="pass">通过</option></select></label>');}
};window.testSelectApp.init();`);
try {
  let rendered=0;
  for(const view of ['home','teaching','dictation','marking','classroom','grades','news','resources','profile','classes','settings','recite','seats','points','comments']){
    aw.testSelectApp.render(view);
    const fields=[...ad.querySelectorAll('select')];rendered+=fields.length;
    assert.ok(fields.length>0,view+' has a class switch');
    assert.ok(fields.every(select=>select.classList.contains('book-select-native')&&select.parentElement.querySelector('.book-select-trigger')),view+' enhances every select');
  }
  aw.testSelectApp.render('resources');
  ad.querySelector('#bookGrade').parentElement.querySelector('button').click();
  const fourth=[...ad.querySelectorAll('.book-select-option')].find(row=>row.textContent.includes('4年级'));
  assert.ok(fourth);fourth.click();
  await new Promise(resolve=>aw.setTimeout(resolve,0));
  assert.equal(aw.testSelectApp.filter(),'4','real delegated resource filter receives custom selection');
  assert.equal(ad.querySelector('#bookGrade').value,'4');
  const result=aw.testSelectApp.modal();
  const dialog=ad.querySelector('[role="dialog"]');
  dialog.querySelector('.book-select-trigger').click();
  dialog.querySelector('[data-index="1"]').click();
  dialog.querySelector('form').dispatchEvent(new aw.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal((await result).result,'pass','real dialog submission preserves field value');
  console.log(`Application integration passed: 15 routes, ${rendered} rendered select instances, resource filtering and dialog FormData.`);
} finally {aw.WorkbenchSelects.destroy();await new Promise(resolve=>aw.setTimeout(resolve,0));aw.close();}
