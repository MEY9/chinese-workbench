// Isolated review probe. Never opens the application's real database.
import { Store } from '../../desktop/src/main/store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-review-'));
let store;
try {
  store = new Store(path.join(dir, 'probe.sqlite3'));
  const state = Object.fromEntries(['classes','students','progress','preps','dictations','assignments','followups','tasks','customBooks','legacyWrong'].map(k => [k, []]));
  Object.assign(state, { version: 1, selectedClassId: 'c1', settings: { ai: { key: 'SYNTHETIC_REVIEW_KEY' } }, bankOverride: {} });
  state.classes.push({ id: 'c1', name: 'Synthetic class' });
  state.students.push({ id: 's1', classId: 'c1', no: '01', name: 'Synthetic student' });
  store.write(state, 0, 'review-mutation-1');
  state.classes[0].name = 'Updated synthetic class';
  store.write(state, 1, 'review-mutation-2');
  const history = JSON.parse(store.db.prepare('SELECT payload FROM history WHERE revision=1').get().payload);
  const root = JSON.parse(store.db.prepare('SELECT payload FROM metadata WHERE id=1').get().payload);
  console.log(JSON.stringify({
    latestStudentCount: store.read().state.students.length,
    historyHasClasses: Array.isArray(history.classes),
    historyHasStudents: Array.isArray(history.students),
    metadataContainsSyntheticKey: root.settings.ai.key === 'SYNTHETIC_REVIEW_KEY',
    historyContainsSyntheticKey: history.settings.ai.key === 'SYNTHETIC_REVIEW_KEY'
  }, null, 2));
} finally {
  store?.close();
  if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('wb-review-')) throw new Error('Unexpected temporary directory');
  fs.rmSync(dir, { recursive: true, force: true });
}
