/** 渲染层存储适配器:桌面 IPC 优先,回退浏览器存储(开发预览用) */
(function () {
  'use strict';
  const isDesktop = !!(window.desktop && window.desktop.loadState);
  window.StorageAdapter = {
    mode: isDesktop ? 'SQLite' : 'Browser',
    async load() {
      if (isDesktop) {
        const r = await window.desktop.loadState();
        return { state: r.state, revision: r.revision, storage: r.storage };
      }
      // 浏览器回退:读 localStorage 旧格式
      const raw = localStorage.getItem('wb_r1_state');
      return { state: raw ? JSON.parse(raw) : null, revision: -1, storage: 'Browser' };
    },
    async save(state, revision) {
      if (isDesktop) {
        const mutationId = localStorage.getItem('wb_mutation') || (localStorage.setItem('wb_mutation', crypto.randomUUID()), localStorage.getItem('wb_mutation'));
        return window.desktop.saveState(state, revision, mutationId);
      }
      localStorage.setItem('wb_r1_state', JSON.stringify(state));
      return { revision, storage: 'Browser' };
    },
    aiChat: async (payload) => {
      if (isDesktop) return window.desktop.ai.chat(payload);
      // 浏览器回退:直接 fetch(仅开发预览)
      const r = await fetch(payload.base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + payload.key },
        body: JSON.stringify({ model: payload.model, messages: payload.messages, temperature: payload.temperature ?? 0.5 }),
      });
      if (!r.ok) throw new Error('AI HTTP ' + r.status);
      return (await r.json()).choices[0].message.content;
    },
    getAIKey: async () => (isDesktop ? window.desktop.ai.getKey() : localStorage.getItem('wb_ai_key') || ''),
    setAIKey: async (k) => (isDesktop ? window.desktop.ai.setKey(k) : localStorage.setItem('wb_ai_key', k)),
    print: async (html) => (isDesktop ? window.desktop.print.run(html) : (document.getElementById('printSheet').innerHTML = html, window.print())),
  };
})();
