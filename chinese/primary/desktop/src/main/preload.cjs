/** 预加载:安全暴露最小 API 给渲染层 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state, expected, mutationId) => ipcRenderer.invoke('state:save', state, expected, mutationId),
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    read: revision => ipcRenderer.invoke('history:read', revision),
  },
  news: { fetch: () => ipcRenderer.invoke('news:fetch') },
  ai: {
    hasKey: () => ipcRenderer.invoke('ai:key:has'),
    setKey: (k) => ipcRenderer.invoke('ai:key:set', k),
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    cancel: () => ipcRenderer.invoke('ai:cancel'),
  },
  print: {
    run: (html, opts) => ipcRenderer.invoke('print:run', html, opts),
    toPDF: (html) => ipcRenderer.invoke('print:toPDF', html),
  },
  textbook: {
    open: (file) => ipcRenderer.invoke('textbook:open', file),
    url: file => ipcRenderer.invoke('textbook:url', file),
  },
});
