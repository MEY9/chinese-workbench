// 主进程与预加载:新闻代抓 IPC(桌面版无 CORS 顾虑)
const fs = require('fs');
let main = fs.readFileSync('main.js', 'utf8');
if (!main.includes('news:fetch')) {
  const anchor = "ipcMain.handle('ai:key:get'";

  const newsCode = [
    "const NEWS_SOURCES = ['60s.crystelf.top', 'api.elysiayanyu.top', '60s.7se.cn', '60s.mizhoubaobei.top'];",
    "let newsCache = { date: '', payload: null };",
    "async function fetchNews() {",
    "  const today = new Date().toISOString().slice(0, 10);",
    "  if (newsCache.payload && newsCache.date === today) return newsCache.payload;",
    "  for (const host of NEWS_SOURCES) {",
    "    try {",
    "      const r = await fetch('https://' + host + '/v2/60s', { signal: AbortSignal.timeout(9000) });",
    "      const d = await r.json();",
    "      let payload = null;",
    "      const dd = d.data;",
    "      if (dd && typeof dd === 'object' && !Array.isArray(dd) && Array.isArray(dd.news) && dd.news.length) {",
    "        payload = { date: String(dd.date || today), news: dd.news.map(String), source: host, tip: String(dd.tip || '') };",
    "      } else if (Array.isArray(dd) && dd.length) {",
    "        payload = { date: String(d.time || today).slice(0, 10), news: dd.map(String), source: host, tip: '' };",
    "      }",
    "      if (payload) { newsCache = { date: today, payload }; return payload; }",
    "    } catch (e) { /* 试下一个源 */ }",
    "  }",
    "  return null;",
    "}",
    "ipcMain.handle('news:fetch', async () => {",
    "  const r = await fetchNews();",
    "  if (!r) throw new Error('全部新闻源暂不可达,请稍后刷新');",
    "  return r;",
    "});"
  ].join(String.fromCharCode(10));

  main = main.replace(anchor, newsCode + String.fromCharCode(10) + anchor);
  fs.writeFileSync('main.js', main);
  console.log('main.js news IPC added');
}

let pre = fs.readFileSync('preload.cjs', 'utf8');
if (!pre.includes('news:')) {
  pre = pre.replace("  ai: {", "  news: { fetch: () => ipcRenderer.invoke('news:fetch') },\n  ai: {");
  fs.writeFileSync('preload.cjs', pre);
  console.log('preload news added');
}
