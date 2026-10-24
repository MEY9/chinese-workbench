// 开屏问题根治:IPC 兜底通道 + 恢复页文案
const fs = require('fs');
let src = fs.readFileSync('app.js', 'utf8');
function rep(a, b) {
  if (!src.includes(a)) throw new Error('ANCHOR MISS: ' + a.slice(0, 60));
  src = src.replace(a, b);
}

// 1) requestJSON:IPC 直连兜底(HTTP 失败时自动切换,之后直走 IPC)
const oldReq = `async function requestJSON(path,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(apiBase()+path,{...options,signal:controller.signal,cache:'no-store'});const value=await response.json();if(!response.ok){const error=Error(value.error||'本机服务请求失败');error.status=response.status;throw error}return value}finally{clearTimeout(timer)}
}`;
const newReq = `async function ipcRequest(path,options={}){
  if(path==='/api/session')return {token:'ipc',storage:'SQLite',app:'primary-chinese-workbench'};
  if(path==='/api/state'&&(!options.method||options.method==='GET'))return window.desktop.loadState();
  if(path==='/api/state'&&options.method==='PUT'){const b=JSON.parse(options.body);return window.desktop.saveState(b.state,b.revision,b.mutationId)}
  throw Error('接口不存在');
}
async function requestJSON(path,options={}){
  if(window.desktop&&window.desktop.loadState&&window.__IPC_FALLBACK)return ipcRequest(path,options);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(apiBase()+path,{...options,signal:controller.signal,cache:'no-store'});
    const value=await response.json();
    if(!response.ok){const error=Error(value.error||'本机服务请求失败');error.status=response.status;throw error}
    return value
  }catch(e){
    // 桌面环境 HTTP 不通(防火墙/杀软/时序):永久切换 IPC 直连,不再走网络
    if(window.desktop&&window.desktop.loadState){window.__IPC_FALLBACK=true;return ipcRequest(path,options)}
    throw e
  }finally{clearTimeout(timer)}
}`;
rep(oldReq, newReq);

// 2) 恢复页文案:桌面模式下不再指 start.cmd
rep('<a href="http://127.0.0.1:8765/">打开 SQLite 工作台</a>（先运行 app 文件夹中的 start.cmd）',
    '<b>桌面版会自动重连内置数据库(已内置双通道),点「重新读取」即可。</b>');

fs.writeFileSync('app.js', src);
console.log('boot fix applied');
