/** 预加载:安全暴露最小 API 给渲染层 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state, expected, mutationId) => ipcRenderer.invoke('state:save', state, expected, mutationId),
  news: { fetch: () => ipcRenderer.invoke('news:fetch') },
  ai: {
    getKey: () => ipcRenderer.invoke('ai:key:get'),
    setKey: (k) => ipcRenderer.invoke('ai:key:set', k),
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  },
  print: {
    run: (html, opts) => ipcRenderer.invoke('print:run', html, opts),
    toPDF: (html) => ipcRenderer.invoke('print:toPDF', html),
  },
  textbook: {
    open: (file) => ipcRenderer.invoke('textbook:open', file),
  },
});
