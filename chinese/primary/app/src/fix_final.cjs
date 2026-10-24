// v2.4.1:preload.cjs 强制 CommonJS + file:// 浏览器兜底(开屏永不阻断)
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
const CRLF = String.fromCharCode(13, 10);
function rep(a, b) {
  if (!src.includes(a)) throw new Error('ANCHOR MISS: ' + a.slice(0, 70));
  src = src.replace(a, b);
  fs.writeFileSync('app.js', src);
  console.log('ok:', a.slice(0, 50).replace(CRLF, '␊'));
}

// 1) loadState:file:// 无桥 → 浏览器存储兜底,直接进主界面(不再 throw)
rep(`  if(location.protocol==='file:'&&!window.desktop){${CRLF}    const errors=[];`,
`  if(location.protocol==='file:'&&!window.desktop){
    // 浏览器存储兜底:桌面桥缺失时也保证可用(数据存本机浏览器存储,可导出)
    storageMode='Browser';storageRecovery.writable=true;
    let raw=null;try{raw=localStorage.getItem('wb_r1_state')}catch(e){}
    if(raw===null){const old=migrateLegacy();if(old.classes.length||old.legacyWrong.length||Object.keys(old.bankOverride).length)raw=JSON.stringify(old)}
    state=raw?structuredClone(checkedStoredState(JSON.parse(raw))):defaultState();
    storageNeedsReload=false;reconcileBooks();return;`);

// 2) save():file:// 无桥 → 存浏览器存储(不再 throw)
rep("    if(location.protocol==='file:'&&!window.desktop)throw Error('请通过本机 SQLite 服务打开工作台');",
"    if(location.protocol==='file:'&&!window.desktop){localStorage.setItem('wb_r1_state',JSON.stringify(snapshot));return}");

// 3) 版本标注:让界面显示当前存储模式
rep("function renderSettings(){const ai=state.settings.ai||{};",
    "function renderSettings(){const ai=state.settings.ai||{};storageMode=storageMode||'Browser';");

fs.writeFileSync('app.js', src);
console.log('app.js fallback done');
