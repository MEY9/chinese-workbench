/**
 * SQLite 存储层 —— 自 server.py 1:1 移植(表结构/校验/事务/乐观并发/历史)
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const COLLECTIONS = ['classes', 'students', 'progress', 'preps', 'dictations', 'assignments', 'followups', 'tasks', 'customBooks', 'legacyWrong'];
const SCOPED = ['students', 'progress', 'preps', 'dictations', 'assignments', 'followups', 'tasks'];

const encode = (v) => JSON.stringify(v);

class Conflict extends Error {}

function countOf(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : -1;
}

function validate(state) {
  if (!state || state.version !== 1) throw new Error('数据版本不正确');
  for (const key of COLLECTIONS) {
    const rows = state[key];
    if (!Array.isArray(rows)) throw new Error(key + ' 必须为列表');
    const ids = rows.map((row) => {
      if (!row || typeof row !== 'object') throw new Error(key + ' 记录无效');
      const id = key === 'customBooks' ? row.bookId : row.id;
      if (typeof id !== 'string' || !id.trim()) throw new Error(key + ' 缺少记录 ID');
      return id;
    });
    if (new Set(ids).size !== ids.length) throw new Error(key + ' 中有重复 ID');
  }
  const classes = new Set(state.classes.map((c) => c.id));
  if (state.selectedClassId !== null && !classes.has(state.selectedClassId)) throw new Error('当前班级不存在');
  for (const key of SCOPED) {
    if (state[key].some((x) => !classes.has(x.classId))) throw new Error(key + ' 引用了不存在的班级');
  }
  for (const key of ['settings', 'bankOverride']) {
    if (typeof state[key] !== 'object' || state[key] === null) throw new Error(key + ' 格式错误');
  }
  // 同班学号唯一
  const numbers = new Set();
  for (const s of state.students) {
    const k = s.classId + '|' + s.no;
    if (numbers.has(k)) throw new Error('同班学号重复');
    numbers.add(k);
  }
  // 听写/作业计数
  for (const key of ['dictations', 'assignments']) {
    for (const row of state[key]) {
      const p = countOf(row.participantCount), m = countOf(row.markedCount);
      if (p < 0 || m < 0 || m > p) throw new Error('参与人数或已批份数无效');
    }
  }
  // 听写学生批改归属
  const studentClass = new Map(state.students.map((s) => [s.id, s.classId]));
  for (const d of state.dictations) {
    for (const [sid, mark] of Object.entries(d.studentMarks || {})) {
      if (studentClass.has(sid) && studentClass.get(sid) !== d.classId) throw new Error('批改学生不属于同班');
    }
  }
  // 复查来源
  const sources = { dictation: new Map(state.dictations.map((x) => [x.id, x])), assignment: new Map(state.assignments.map((x) => [x.id, x])) };
  for (const f of state.followups) {
    if (f.sourceType && !sources[f.sourceType]) throw new Error('复查来源类型无效');
    const src = (sources[f.sourceType] || new Map()).get(f.sourceId);
    if (src && (src.classId !== f.classId || (src.bookId || '') !== (f.bookId || ''))) throw new Error('复查来源与班级或教材不一致');
  }
  encode(state); // 确认可序列化
}

export class Store {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = FULL');
    const userVersion = this.db.pragma('user_version', { simple: true });
    if (userVersion > 1) throw new Error('数据库版本较新,请使用对应版本的软件');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT);
      INSERT OR IGNORE INTO metadata VALUES (1, 0, NULL);
      CREATE TABLE IF NOT EXISTS history (revision INTEGER PRIMARY KEY, saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, digest TEXT NOT NULL, revision INTEGER NOT NULL);
    `);
    for (const key of COLLECTIONS) {
      const fk = SCOPED.includes(key) ? ', class_id TEXT NOT NULL REFERENCES classes(id)' : '';
      this.db.exec(`CREATE TABLE IF NOT EXISTS "${key}" (id TEXT PRIMARY KEY, position INTEGER NOT NULL, payload TEXT NOT NULL${fk})`);
    }
    this.db.pragma('user_version = 1');
  }

  read() {
    const { revision, payload } = this.db.prepare('SELECT revision, payload FROM metadata WHERE id=1').get();
    const state = payload ? JSON.parse(payload) : null;
    if (state) {
      for (const key of COLLECTIONS) {
        state[key] = this.db.prepare(`SELECT payload FROM "${key}" ORDER BY position`).all().map((r) => JSON.parse(r.payload));
      }
    }
    return { state, revision, storage: 'SQLite' };
  }

  listHistory() {
    return this.db.prepare('SELECT revision, length(payload) AS bytes FROM history ORDER BY revision DESC').all();
  }

  readHistory(revision) {
    const row = this.db.prepare('SELECT revision, payload FROM history WHERE revision=?').get(revision);
    if (!row) return null;
    let payload = null;
    try { payload = JSON.parse(row.payload); } catch { payload = null; }
    const missing = payload ? COLLECTIONS.filter((k) => !Array.isArray(payload[k])) : [...COLLECTIONS];
    return { revision: row.revision, state: payload, intact: Boolean(payload) && missing.length === 0, missingCollections: missing };
  }

  close() { this.db.close(); }

  write(state, expected, mutationId) {
    validate(state);
    if (!Number.isInteger(expected) || expected < 0 || typeof mutationId !== 'string' || mutationId.length < 8 || mutationId.length > 128) {
      throw new Error('保存版本或操作标识无效');
    }
    const digest = crypto.createHash('sha256').update(encode(state)).digest('hex');
    const txn = this.db.transaction(() => {
      const existing = this.db.prepare('SELECT digest, revision FROM mutations WHERE id=?').get(mutationId);
      if (existing) {
        if (existing.digest !== digest) throw new Conflict('操作标识已使用,请重新读取数据');
        return { revision: existing.revision, storage: 'SQLite' };
      }
      const prev = this.db.prepare('SELECT revision, payload FROM metadata WHERE id=1').get();
      if (prev.revision !== expected) throw new Conflict('其他窗口已保存新记录。请保留当前表单内容,重新读取最新数据后再修改');
      if (prev.payload) {
        // 历史快照必须含全部集合,否则无法还原完整状态(旧版只存 metadata 会缺 classes/students 等)
        let full = {};
        try { full = JSON.parse(prev.payload); } catch { full = {}; }
        for (const key of COLLECTIONS) {
          full[key] = this.db.prepare(`SELECT payload FROM "${key}" ORDER BY position`).all().map((r) => JSON.parse(r.payload));
        }
        this.db.prepare('INSERT INTO history(revision, payload) VALUES (?, ?)').run(prev.revision, encode(full));
      }
      for (const key of [...COLLECTIONS].reverse()) this.db.prepare(`DELETE FROM "${key}"`).run();
      for (const key of COLLECTIONS) {
        const insert = this.db.prepare(
          SCOPED.includes(key)
            ? `INSERT INTO "${key}" VALUES (?, ?, ?, ?)`
            : `INSERT INTO "${key}" VALUES (?, ?, ?)`);
        state[key].forEach((row, position) => {
          const id = key === 'customBooks' ? row.bookId : row.id;
          const values = [id, position, encode(row)];
          if (SCOPED.includes(key)) values.push(row.classId);
          insert.run(...values);
        });
      }
      const revision = prev.revision + 1;
      const root = { ...state };
      for (const key of COLLECTIONS) delete root[key];
      this.db.prepare('UPDATE metadata SET revision=?, payload=? WHERE id=1').run(revision, encode(root));
      this.db.prepare('INSERT INTO mutations VALUES (?, ?, ?)').run(mutationId, digest, revision);
      this.db.prepare('DELETE FROM history WHERE revision NOT IN (SELECT revision FROM history ORDER BY revision DESC LIMIT 20)').run();
      this.db.prepare('DELETE FROM mutations WHERE revision < ?').run(Math.max(0, revision - 100));
      return { revision, storage: 'SQLite' };
    });
    try { return txn(); } catch (e) { if (e instanceof Conflict) throw e; throw e; }
  }
}

export { Conflict };
