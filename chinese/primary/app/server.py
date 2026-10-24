"""Local-only teacher workbench with transactional SQLite storage (stdlib only)."""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import secrets
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
COLLECTIONS = ('classes', 'students', 'progress', 'preps', 'dictations', 'assignments', 'followups', 'tasks', 'customBooks', 'legacyWrong')
SCOPED = ('students', 'progress', 'preps', 'dictations', 'assignments', 'followups', 'tasks')
MAX_BODY = 16 * 1024 * 1024


def count(value):
    try:
        number = float(value)
        return int(number) if number >= 0 and int(number) == number else -1
    except (ValueError, TypeError, OverflowError):
        return -1


NEWS_SOURCES = ('60s.crystelf.top', 'api.elysiayanyu.top', '60s.7se.cn', '60s.mizhoubaobei.top')
_news_cache = {'date': '', 'payload': None}


def fetch_news():
    """服务端代抓 60s 新闻(多源容错);10 分钟内复用缓存,避免频繁外呼。"""
    import datetime
    today = datetime.date.today().isoformat()
    if _news_cache['payload'] and _news_cache['date'] == today:
        return _news_cache['payload']
    for host in NEWS_SOURCES:
        try:
            req = urllib.request.Request('https://' + host + '/v2/60s', headers={'User-Agent': 'yuwen-workbench/1.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            payload = None
            d = data.get('data')
            if isinstance(d, dict) and isinstance(d.get('news'), list) and d['news']:
                payload = {'date': str(d['data'].get('date') or today), 'news': [str(x) for x in d['data']['news']], 'source': host}
            elif isinstance(d, list) and d:
                payload = {'date': str(data.get('time') or today)[:10], 'news': [str(x) for x in d], 'source': host}
            if payload:
                _news_cache['date'] = today
                _news_cache['payload'] = payload
                return payload
        except Exception:
            continue
    return None


class Conflict(Exception):
    pass


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def validate(state):
    if not isinstance(state, dict) or state.get('version') != 1:
        raise ValueError('数据版本不正确')
    for key in COLLECTIONS:
        rows = state.get(key)
        if not isinstance(rows, list):
            raise ValueError(f'{key} 必须为列表')
        ids = []
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f'{key} 记录无效')
            ident = row.get('bookId' if key == 'customBooks' else 'id')
            if not isinstance(ident, str) or not ident.strip():
                raise ValueError(f'{key} 缺少记录 ID')
            ids.append(ident)
        if len(set(ids)) != len(ids):
            raise ValueError(f'{key} 中有重复 ID')
    classes = {x['id'] for x in state['classes']}
    if state.get('selectedClassId') is not None and state['selectedClassId'] not in classes:
        raise ValueError('当前班级不存在')
    for key in SCOPED:
        if any(x.get('classId') not in classes for x in state[key]):
            raise ValueError(f'{key} 引用了不存在的班级')
    for key in ('settings', 'bankOverride'):
        if not isinstance(state.get(key), dict):
            raise ValueError(f'{key} 格式错误')
    if 'ai' in state['settings'] and not isinstance(state['settings']['ai'], dict):
        raise ValueError('AI 配置格式错误')
    def texts(row, fields):
        if any(key in row and not isinstance(row[key], str) for key in fields):
            raise ValueError('文本字段格式错误')
    texts(state['settings'], ('voice',))
    texts(state['settings'].get('ai', {}), ('key', 'base', 'model'))
    if 'legacyPicks' in state and not isinstance(state['legacyPicks'], dict):
        raise ValueError('旧词单选择格式错误')
    for key in COLLECTIONS:
        for row in state[key]:
            texts(row, ('bookId', 'planDate', 'actualDate', 'dueDate', 'summary', 'measures', 'result', 'sourceId', 'sourceType', 'goals', 'focus', 'activities', 'materials', 'reflection'))
            if key != 'legacyWrong':
                texts(row, ('date',))
    for row in state['bankOverride'].values():
        if not isinstance(row, dict):
            raise ValueError('词库格式错误')
        texts(row, ('title', 'conf'))
        for key, word in (('chars', 'c'), ('words', 'w')):
            if key in row and (not isinstance(row[key], list) or any(not isinstance(w, dict) or not isinstance(w.get(word), str) or not isinstance(w.get('p'), str) for w in row[key])):
                raise ValueError('词库字词格式错误')
    for c in state['classes']:
        if not isinstance(c.get('name'), str) or str(c.get('grade')) not in ('1', '2', '3', '4', '5', '6') or c.get('term') not in ('上册', '下册') or not isinstance(c.get('bookId'), str):
            raise ValueError('班级信息无效')
    numbers = set()
    for student in state['students']:
        if not isinstance(student.get('no'), str) or not isinstance(student.get('name'), str):
            raise ValueError('学生信息无效')
        number = (student['classId'], student['no'])
        if number in numbers:
            raise ValueError('同班学号重复')
        numbers.add(number)
    for key in ('dictations', 'assignments'):
        for row in state[key]:
            counts = [count(row.get('participantCount')), count(row.get('markedCount'))]
            if min(counts) < 0 or counts[1] > counts[0]:
                raise ValueError('参与人数或已批份数无效')
            if key == 'dictations':
                if not isinstance(row.get('title'), str) or not isinstance(row.get('words'), list) or any(not isinstance(w, dict) or not isinstance(w.get('w'), str) or not isinstance(w.get('p'), str) for w in row['words']):
                    raise ValueError('听写词单无效')
            elif not isinstance(row.get('content'), str) or not isinstance(row.get('issues'), list) or any(not isinstance(i, dict) or not isinstance(i.get('tag'), str) or not isinstance(i.get('text'), str) for i in row['issues']):
                raise ValueError('作业错例无效')
    student_classes = {x['id']: x['classId'] for x in state['students']}
    for d in state['dictations']:
        errors = d.get('wordErrors', {})
        if not isinstance(errors, dict) or any(type(n) is not int or n < 0 or n > count(d['participantCount']) for n in errors.values()):
            raise ValueError('错词人数无效')
        marks = d.get('studentMarks', {})
        if not isinstance(marks, dict):
            raise ValueError('学生批改记录无效')
        for sid, mark in marks.items():
            if sid in student_classes and student_classes[sid] != d['classId']:
                raise ValueError('批改学生不属于同班')
            if not isinstance(mark, dict) or not isinstance(mark.get('wrongWords'), list) or any(not isinstance(w, str) for w in mark['wrongWords']):
                raise ValueError('学生错词记录无效')
            texts(mark, ('status', 'studentNo'))
    for p in state['progress']:
        if not isinstance(p.get('lessonNo'), str) or not isinstance(p.get('title'), str) or p.get('status') not in ('未开始', '已上课', '已讲评'):
            raise ValueError('教学进度无效')
    for book in state['customBooks']:
        if any(not isinstance(book.get(k), str) for k in ('publisher', 'title', 'editionYear')) or book.get('file') or str(book.get('grade')) not in ('1', '2', '3', '4', '5', '6') or book.get('term') not in ('上册', '下册'):
            raise ValueError('自定义教材无效')
    for word in state['legacyWrong']:
        if not isinstance(word.get('word'), str) or word.get('classId') is not None and word['classId'] not in classes:
            raise ValueError('旧错词记录无效')
    sources = {'dictation': {x['id']: x for x in state['dictations']}, 'assignment': {x['id']: x for x in state['assignments']}}
    for f in state['followups']:
        if not isinstance(f.get('title'), str) or f.get('kind') not in ('讲评', '复查') or f.get('status') not in ('待办', '完成') or not isinstance(f.get('studentIds'), list):
            raise ValueError('复查记录无效')
        if any(not isinstance(sid, str) or (sid in student_classes and student_classes[sid] != f['classId']) for sid in f['studentIds']):
            raise ValueError('复查学生不属于同一班级')
        source_type = f.get('sourceType')
        if source_type and source_type not in sources or f.get('sourceId') and not source_type:
            raise ValueError('复查来源类型无效')
        source = sources.get(source_type, {}).get(f.get('sourceId'))
        if source and (source['classId'] != f['classId'] or source.get('bookId', '') != f.get('bookId', '')):
            raise ValueError('复查来源与班级或教材不一致')
    for task in state['tasks']:
        if not isinstance(task.get('title'), str) or task.get('status') not in ('待办', '完成'):
            raise ValueError('待办记录无效')
    # Validate finite JSON before any transaction is started.
    encode(state)


class Database:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db, db:
            if db.execute('PRAGMA user_version').fetchone()[0] > 1:
                raise RuntimeError('数据库版本较新，请使用对应版本的软件')
            if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('SQLite 完整性检查失败，请保留数据库文件并从备份恢复')
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT)')
            db.execute('INSERT OR IGNORE INTO metadata VALUES(1,0,NULL)')
            for key in COLLECTIONS:
                foreign = ', class_id TEXT NOT NULL REFERENCES classes(id)' if key in SCOPED else ''
                db.execute(f'CREATE TABLE IF NOT EXISTS "{key}" (id TEXT PRIMARY KEY, position INTEGER NOT NULL, payload TEXT NOT NULL{foreign})')
            db.execute('CREATE TABLE IF NOT EXISTS history (revision INTEGER PRIMARY KEY, saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, payload TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, digest TEXT NOT NULL, revision INTEGER NOT NULL)')
            db.execute('PRAGMA user_version=1')

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA synchronous=FULL')
        return db

    @staticmethod
    def _read(db):
        revision, payload = db.execute('SELECT revision,payload FROM metadata WHERE id=1').fetchone()
        if payload is None:
            return None, revision
        state = json.loads(payload)
        for key in COLLECTIONS:
            state[key] = [json.loads(row[0]) for row in db.execute(f'SELECT payload FROM "{key}" ORDER BY position')]
        return state, revision

    def read(self):
        with closing(self.connect()) as db, db:
            db.execute('BEGIN')
            state, revision = self._read(db)
            return {'state': state, 'revision': revision, 'storage': 'SQLite'}

    def write(self, state, expected, mutation):
        validate(state)
        if type(expected) is not int or expected < 0 or not isinstance(mutation, str) or not 8 <= len(mutation) <= 128:
            raise ValueError('保存版本或操作标识无效')
        payload = encode(state)
        digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        with closing(self.connect()) as db, db:
            db.execute('BEGIN IMMEDIATE')
            old_mutation = db.execute('SELECT digest,revision FROM mutations WHERE id=?', (mutation,)).fetchone()
            if old_mutation:
                if old_mutation[0] != digest:
                    raise Conflict('操作标识已使用，请重新读取数据')
                return {'revision': old_mutation[1], 'storage': 'SQLite'}
            previous, revision = self._read(db)
            if expected != revision:
                raise Conflict('其他窗口已保存新记录。请保留当前表单内容，重新读取最新数据后再修改')
            if previous is not None:
                db.execute('INSERT INTO history(revision,payload) VALUES(?,?)', (revision, encode(previous)))
            for key in reversed(COLLECTIONS):
                db.execute(f'DELETE FROM "{key}"')
            for key in COLLECTIONS:
                for position, row in enumerate(state[key]):
                    values = [row['bookId' if key == 'customBooks' else 'id'], position, encode(row)]
                    if key in SCOPED:
                        values.append(row['classId'])
                    db.execute(f'INSERT INTO "{key}" VALUES({",".join("?" for _ in values)})', values)
            revision += 1
            root = {k: v for k, v in state.items() if k not in COLLECTIONS}
            db.execute('UPDATE metadata SET revision=?,payload=? WHERE id=1', (revision, encode(root)))
            db.execute('INSERT INTO mutations VALUES(?,?,?)', (mutation, digest, revision))
            db.execute('DELETE FROM history WHERE revision NOT IN (SELECT revision FROM history ORDER BY revision DESC LIMIT 20)')
            db.execute('DELETE FROM mutations WHERE revision < ?', (max(0, revision - 100),))
            return {'revision': revision, 'storage': 'SQLite'}


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, database):
        super().__init__(address, Handler)
        self.database = database
        self.token = secrets.token_urlsafe(32)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never log request bodies, student data or session tokens.
        pass

    def allowed(self, authenticated=False):
        port = self.server.server_port
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        if host not in hosts or origin and origin not in {f'http://{h}' for h in hosts} or self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.reply(403, {'error': '只允许本机工作台访问'})
            return False
        if authenticated and not secrets.compare_digest(self.headers.get('X-Workbench-Token', '').encode('utf-8'), self.server.token.encode('utf-8')):
            self.reply(403, {'error': '会话已更新，请重试'})
            return False
        return True

    def reply(self, status, value):
        body = encode(value).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.allowed():
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/api/session':
            return self.reply(200, {'token': self.server.token, 'storage': 'SQLite', 'app': 'primary-chinese-workbench'})
        if path == '/api/news':
            news = fetch_news()
            if news:
                return self.reply(200, news)
            return self.reply(502, {'error': '全部新闻源暂不可达,请稍后刷新'})
        if path == '/api/state':
            if not self.allowed(True):
                return
            try:
                return self.reply(200, self.server.database.read())
            except sqlite3.Error:
                return self.reply(503, {'error': 'SQLite 读取失败，请保留数据库文件并重试'})
        file = ROOT / 'index.html' if path in ('/', '/index.html') else ROOT / path.lstrip('/')
        file = file.resolve()
        allowed = file == ROOT / 'index.html' or (file.parent == ROOT / 'textbooks' and file.suffix == '.pdf')
        if not allowed or not file.is_file():
            return self.reply(404, {'error': '文件不存在'})
        size = file.stat().st_size
        start, end, status = 0, size - 1, 200
        requested = self.headers.get('Range')
        if requested:
            try:
                unit, bounds = requested.split('=', 1)
                low, high = bounds.split('-', 1)
                if unit != 'bytes' or ',' in bounds:
                    raise ValueError()
                if low:
                    start = int(low); end = min(int(high), size - 1) if high else size - 1
                else:
                    start = max(0, size - int(high))
                if start < 0 or start >= size or end < start:
                    raise ValueError()
                status = 206
            except ValueError:
                return self.reply(416, {'error': '无效文件范围'})
        self.send_response(status)
        self.send_header('Content-Type', mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        with file.open('rb') as source:
            source.seek(start)
            remaining = end - start + 1
            while remaining:
                block = source.read(min(65536, remaining))
                if not block:
                    break
                self.wfile.write(block); remaining -= len(block)

    def do_POST(self):
        if not self.allowed():
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/api/ai' and self.command == 'POST':
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 1024 * 1024:
                return self.reply(413, {'error': '请求过大'})
            req = json.loads(self.rfile.read(size))
            base = str(req.get('base') or 'https://api.deepseek.com').replace('/chat/completions', '').rstrip('/')
            model = str(req.get('model') or 'deepseek-flash')
            key = str(req.get('key') or '')
            messages = req.get('messages')
            temperature = req.get('temperature', 0.5)
            if not key or not isinstance(messages, list):
                return self.reply(400, {'error': '缺少 Key 或消息'})
            body = json.dumps({'model': model, 'messages': messages, 'temperature': temperature, 'stream': False}).encode('utf-8')
            r2 = urllib.request.Request(base + '/chat/completions', data=body, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
            try:
                with urllib.request.urlopen(r2, timeout=60) as resp:
                    out = json.loads(resp.read().decode('utf-8'))
                return self.reply(200, {'content': out['choices'][0]['message']['content']})
            except urllib.error.HTTPError as e:
                return self.reply(502, {'error': 'AI HTTP %d: %s' % (e.code, e.read().decode('utf-8', 'ignore')[:200])})
            except Exception as e:
                return self.reply(502, {'error': 'AI 请求失败: %s' % e})
        self.reply(404, {'error': '接口不存在'})

    def do_PUT(self):
        if not self.allowed(True):
            return
        if urlsplit(self.path).path != '/api/state':
            return self.reply(404, {'error': '接口不存在'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.reply(415, {'error': '需要 JSON 请求'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                return self.reply(413, {'error': '请求大小超出限制'})
            value = json.loads(self.rfile.read(size), parse_constant=lambda x: (_ for _ in ()).throw(ValueError('无效数字')))
            if not isinstance(value, dict):
                raise ValueError('请求结构无效')
            result = self.server.database.write(value.get('state'), value.get('revision'), value.get('mutationId'))
            return self.reply(200, result)
        except Conflict as exc:
            return self.reply(409, {'error': str(exc)})
        except (ValueError, TypeError, KeyError, OverflowError) as exc:
            return self.reply(400, {'error': str(exc)})
        except sqlite3.Error:
            return self.reply(503, {'error': 'SQLite 写入失败，事务已回滚；请检查磁盘后重试'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--database', type=Path, default=ROOT / 'data' / 'workbench.sqlite3')
    args = parser.parse_args()
    database = Database(args.database)
    server = Server(('127.0.0.1', args.port), database)
    print(f'SQLite workbench: http://127.0.0.1:{server.server_port} | database: {database.path}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
