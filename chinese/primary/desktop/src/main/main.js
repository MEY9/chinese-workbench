/**
 * 语文教师工作台 · 主进程
 * 职责:SQLite 存储 / 窗口与打印 / TTS / AI 代理 / 教材 PDF / 安全外壳
 */
import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Store } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const DATA_DIR = isDev ? path.join(__dirname, '../../data') : path.join(app.getPath('userData'), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { w.restore(); w.focus(); } });

const store = new Store(path.join(DATA_DIR, 'workbench.sqlite3'));

/** AI Key 加密存取(safeStorage:Windows DPAPI / macOS Keychain) */
const keyFile = path.join(DATA_DIR, 'ai-key.bin');
function readAIKey() {
  try {
    if (!fs.existsSync(keyFile) || !safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(keyFile));
  } catch { return ''; }
}
function writeAIKey(key) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统加密不可用,无法保存 Key');
  fs.writeFileSync(keyFile + '.pending', safeStorage.encryptString(key));
  fs.renameSync(keyFile + '.pending', keyFile);
}

/* ---------------- IPC ---------------- */
ipcMain.handle('state:load', () => {
  store.migrateSecrets(key => { if (!readAIKey()) writeAIKey(key); });
  return store.read();
});
ipcMain.handle('state:save', (_e, state, expected, mutationId) => store.write(state, expected, mutationId));
ipcMain.handle('history:list', () => store.listHistory());
ipcMain.handle('history:read', (_e, revision) => { if(!Number.isInteger(revision))throw Error('版本无效');return store.readHistory(revision); });
const NEWS_SOURCES = ['60s.crystelf.top', 'api.elysiayanyu.top', '60s.7se.cn', '60s.mizhoubaobei.top'];
let newsCache = { date: '', payload: null };
async function fetchNews() {
  const today = new Date().toISOString().slice(0, 10);
  if (newsCache.payload && newsCache.date === today) return newsCache.payload;
  for (const host of NEWS_SOURCES) {
    try {
      const r = await fetch('https://' + host + '/v2/60s', { signal: AbortSignal.timeout(9000) });
      const d = await r.json();
      let payload = null;
      const dd = d.data;
      if (dd && typeof dd === 'object' && !Array.isArray(dd) && Array.isArray(dd.news) && dd.news.length) {
        payload = { date: String(dd.date || today), news: dd.news.map(String), source: host, tip: String(dd.tip || '') };
      } else if (Array.isArray(dd) && dd.length) {
        payload = { date: String(d.time || today).slice(0, 10), news: dd.map(String), source: host, tip: '' };
      }
      if (payload) { newsCache = { date: today, payload }; return payload; }
    } catch (e) { /* 试下一个源 */ }
  }
  return null;
}
ipcMain.handle('news:fetch', async () => {
  const r = await fetchNews();
  if (!r) throw new Error('全部新闻源暂不可达,请稍后刷新');
  return r;
});
ipcMain.handle('ai:key:has', () => Boolean(readAIKey()));
ipcMain.handle('ai:key:set', (_e, key) => { writeAIKey(String(key || '')); return true; });

/** AI 代理:主进程发请求(渲染层不持有 Key),openai 兼容 chat completions */
let aiController = null;
ipcMain.handle('ai:cancel', () => { aiController?.abort(); return true; });
ipcMain.handle('ai:chat', async (_e, { base, model, messages, temperature }) => {
  const key = readAIKey();
  if (!key) throw new Error('未配置 AI Key');
  const endpoint=new URL(base);
  if(!['http:','https:'].includes(endpoint.protocol))throw Error('AI 地址必须为 HTTP 或 HTTPS');
  if(!Array.isArray(messages)||!messages.length)throw Error('AI 输入为空');
  const ctrl = new AbortController();
  aiController = ctrl;
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages, temperature: temperature ?? 0.5, stream: false }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('AI HTTP ' + r.status + '，请检查服务配置或稍后重试');
    const d = await r.json();
    return d.choices[0].message.content;
  } finally { clearTimeout(timer); if(aiController===ctrl)aiController=null; }
});

/** 打印:渲染层把打印 HTML 放入隐藏窗口后调用 */
ipcMain.handle('print:run', async (_e, html, opts = {}) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await new Promise((resolve, reject) => {
      win.webContents.print(opts, (ok, err) => { ok ? resolve(true) : reject(new Error(err)); });
    });
  } finally { win.destroy(); }
});
ipcMain.handle('print:toPDF', async (_e, html) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { win.destroy(); }
});

/** 教材 PDF:系统默认查看器(子页面/外开由渲染层选择) */
function textbookPath(file) {
  if(!/^[a-z0-9][a-z0-9-]{2,63}\.pdf$/.test(file))throw Error('教材文件名无效');
  const root=isDev?path.join(__dirname,'../../resources/textbooks'):path.join(process.resourcesPath,'textbooks');
  const target=path.join(root,file);
  if(!fs.existsSync(target))throw Error('教材文件未安装，请检查资源包');
  return target;
}
ipcMain.handle('textbook:url', (_e,file) => pathToFileURL(textbookPath(file)).href);
ipcMain.handle('textbook:open', async (_e, file) => {
  const error = await shell.openPath(textbookPath(file));
  if(error)throw Error(error);
  return true;
});
ipcMain.handle('textbook:read', (_e, file) => textbookPath(file));


/* ---------------- 窗口 ---------------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#F2F5FA',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F2F5FA',
      symbolColor: '#2A3B55',
      height: 62
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 需要 require ipcRenderer
      spellcheck: false,
    },
  });
  win.webContents.on('preload-error', (e, p, err) => {
    console.error('[preload-error]', p, err);
  });
  win.webContents.on('did-finish-load', async () => {
    try {
      const has = await win.webContents.executeJavaScript('Boolean(window.desktop&&window.desktop.loadState)');
      console.log('[bridge] window.desktop available:', has);
    } catch (e) { console.error('[bridge-check] failed', e); }
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
;
  if (isDev && process.env.WB_DEVTOOLS==='1') win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
