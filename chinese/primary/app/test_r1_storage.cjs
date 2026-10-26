const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'src/reliability.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8').split("window.addEventListener('beforeunload'")[0];
function harness(protocol = 'http:') {
  const local = new Map(), faults = {}, mutations = new Map(), app = { innerHTML: '', setAttribute() {} };
  let persisted = null, revision = 0, requests = 0, puts = 0, token = 'token-1';
  const response = (status, data) => ({ ok: status === 200, status, json: async () => structuredClone(data) });
  const context = vm.createContext({
    window: { BANK: {}, TEXTBOOKS: [], addEventListener() {} },
    document: { addEventListener() {}, querySelector() { return app; }, querySelectorAll() { return []; } },
    localStorage: { get length() { return local.size; }, key(i) { return [...local.keys()][i]; }, getItem(k) { return local.get(k) ?? null; }, setItem() { throw Error('Browser writes forbidden'); } },
    indexedDB: { open() { throw Error('Legacy DB unavailable'); } },
    location: { protocol, hash: '' }, console, structuredClone, AbortController, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto,
    fetch: async (url, options = {}) => {
      requests++;
      if (faults.offline) throw Error('offline');
      if (url === '/api/session') return response(200, { token, storage: 'SQLite', app: 'primary-chinese-workbench' });
      if (options.headers['X-Workbench-Token'] !== token) return response(403, { error: '会话已更新' });
      if (options.method !== 'PUT') return response(200, { state: persisted, revision, storage: 'SQLite' });
      puts++;
      const body = JSON.parse(options.body);
      if (faults.conflict) return response(409, { error: '其他窗口已保存新记录' });
      if (faults.reject) return response(503, { error: '事务已回滚' });
      if (!mutations.has(body.mutationId)) {
        assert.equal(body.revision, revision);
        persisted = body.state; revision++; mutations.set(body.mutationId, revision);
      }
      if (faults.dropAll || faults.dropOnce) { faults.dropOnce = false; throw Error('response lost'); }
      return response(200, { revision: mutations.get(body.mutationId), storage: 'SQLite' });
    },
  });
  vm.runInContext(code, context);
  return { context, run: s => vm.runInContext(s, context), local, faults, app,
    get state() { return persisted; }, get revision() { return revision; }, get requests() { return requests; }, get puts() { return puts; },
    restart() { token = 'token-2'; }, setState(value) { persisted = value; },
  };
}
(async () => {
  let h = harness();
  await h.run('loadState()');
  assert.equal(h.state, null, 'Startup must not write an empty database');
  assert.equal(h.run('storageMode'), 'SQLite');
  h.run("state.classes.push({id:'c1',name:'三一班',grade:3,term:'上册',bookId:''});state.selectedClassId='c1'");
  await h.run('save()');
  assert.equal(h.state.classes[0].name, '三一班');
  await h.run('loadState()');
  assert.equal(h.run('state.classes.length'), 1);
  h.restart(); await h.run('save()');
  assert.equal(h.revision, 2, 'Server restart refreshes session token');
  h.faults.dropOnce = true;
  const before = h.revision;
  await h.run('save()');
  assert.equal(h.revision, before + 1, 'Lost response retried with same mutation ID');
  h.faults.reject = true;
  await assert.rejects(h.run('save()'), /事务已回滚/);
  assert.equal(h.revision, before + 1);
  h.faults.reject = false; h.faults.conflict = true;
  await assert.rejects(h.run('save()'), /其他窗口/);
  const puts = h.puts;
  await assert.rejects(h.run('save()'), /重新读取数据库/);
  assert.equal(h.puts, puts, 'Conflict blocks writes until reload');
  h.faults.conflict = false;
  await h.run('loadState()'); await h.run('save()');
  h.faults.dropAll = true;
  await assert.rejects(h.run('save()'), e => e.uncertain === true);
  assert.equal(h.run('storageNeedsReload'), true);
  h.faults.dropAll = false;
  await h.run('loadState()');
  assert.equal(h.run('sqliteRevision'), h.revision);
  h = harness(); h.setState({ version: 1 });
  await assert.rejects(h.run('loadState()'), /数据结构/);
  assert.equal(h.puts, 0, 'Invalid data is never replaced by defaults');
  h = harness(); h.faults.offline = true;
  await assert.rejects(h.run('loadState()'), /offline/);
  assert.equal(h.state, null, 'No browser fallback');
  h = harness('file:');
  const legacy = h.run('defaultState()');
  h.local.set('wb_r1_state', JSON.stringify(legacy));
  await assert.rejects(h.run('loadState()'), /已切换至 SQLite/);
  assert.equal(h.run('storageRecovery.fallbackRaw'), JSON.stringify(legacy));
  assert.equal(h.run('storageRecovery.writable'), false);
  h.run('state=defaultState()');
  await assert.rejects(h.run('save()'), /本机 SQLite/);
  assert.equal(h.requests, 0);
  assert.equal(h.local.get('wb_r1_state'), JSON.stringify(legacy));
  h = harness('file:');
  const primary = h.run('defaultState()');
  let closed = false;
  h.context.indexedDB = { open(name, version) {
    assert.equal(name, 'primary_chinese_teacher_v1');
    assert.equal(version, undefined, 'Legacy database must not be upgraded');
    const request = {};
    request.result = { close() { closed = true; }, transaction(store, mode) {
      assert.equal(mode, 'readonly');
      const tx = { objectStore() { return { get() { return { result: primary }; } }; } };
      queueMicrotask(() => tx.oncomplete()); return tx;
    } };
    queueMicrotask(() => request.onsuccess()); return request;
  } };
  await assert.rejects(h.run('loadState()'), /已切换至 SQLite/);
  assert.deepEqual(h.run('storageRecovery.primary'), primary);
  assert.equal(closed, true);
  assert.equal(h.requests, 0);
  console.log('SQLite client: load/save, session renewal, idempotency, conflict, uncertain result, recovery and read-only legacy migration passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
