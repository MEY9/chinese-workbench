/**
 * 语文教师工作台 · 主进程
 * 职责:SQLite 存储 / 窗口与打印 / TTS / AI 代理 / 教材 PDF / 安全外壳
 */
import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
  fs.writeFileSync(keyFile, safeStorage.encryptString(key));
}

/* ---------------- IPC ---------------- */
ipcMain.handle('state:load', () => store.read());
ipcMain.handle('state:save', (_e, state, expected, mutationId) => store.write(state, expected, mutationId));
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
ipcMain.handle('ai:key:get', () => readAIKey());
ipcMain.handle('ai:key:set', (_e, key) => { writeAIKey(String(key || '')); return true; });

/** AI 代理:主进程发请求(渲染层不持有 Key),openai 兼容 chat completions */
ipcMain.handle('ai:chat', async (_e, { base, model, key: payloadKey, messages, temperature }) => {
  const key = (payloadKey && String(payloadKey).trim()) || readAIKey();
  if (!key) throw new Error('未配置 AI Key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages, temperature: temperature ?? 0.5, stream: false }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('AI HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    return d.choices[0].message.content;
  } finally { clearTimeout(timer); }
});

/** 打印:渲染层把打印 HTML 放入隐藏窗口后调用 */
ipcMain.handle('print:run', async (_e, html, opts = {}) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return new Promise((resolve, reject) => {
    win.webContents.print(opts, (ok, err) => { win.destroy(); ok ? resolve(true) : reject(new Error(err)); });
  });
});
ipcMain.handle('print:toPDF', async (_e, html) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const data = await win.webContents.printToPDF({ pageSize: 'A4', margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } });
  win.destroy();
  return data;
});
ipcMain.handle('print:savePDF', async (_e, html, suggested) => {
  const data = await ipcMain.emit('print:toPDF'); // not used directly; kept simple below
  return data;
});

/** 教材 PDF:系统默认查看器(子页面/外开由渲染层选择) */
ipcMain.handle('textbook:open', (_e, file) => {
  const p = path.join(isDev ? path.join(__dirname, '../../..') : process.resourcesPath, 'textbooks', path.basename(file));
  if (!fs.existsSync(p)) throw new Error('教材文件不存在:' + path.basename(file));
  shell.openPath(p);
  return true;
});
ipcMain.handle('textbook:read', (_e, file) => {
  const p = path.join(isDev ? path.join(__dirname, '../../..') : process.resourcesPath, 'textbooks', path.basename(file));
  if (!fs.existsSync(p)) throw new Error('教材文件不存在');
  return p; // 交给 webview/file 协议加载
});


/* ---------------- 窗口 ---------------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#FFF9F0',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#FFF9F0',
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
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
