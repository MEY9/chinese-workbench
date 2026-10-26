"""Real SQLite and local HTTP integration tests, using temporary files only."""
from contextlib import closing
import copy
import http.client
import json
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
from pathlib import Path
from server import Database, Server, COLLECTIONS, Conflict, ROOT


def fixture():
    state = {key: [] for key in COLLECTIONS}
    state.update(version=1, selectedClassId='c1', bankOverride={}, settings={'ai': {}, 'voice': ''})
    state['classes'] = [dict(id='c1', name='测试班', grade=3, term='上册', bookId='')]
    state['students'] = [dict(id='s1', classId='c1', no='01', name='测试学生')]
    state['tasks'] = [dict(id='t1', classId='c1', title='备课', status='待办')]
    return state


class SQLiteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'records.sqlite3'
        self.db = Database(self.path)
        self.server = Server(('127.0.0.1', 0), self.db)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None, token=True):
        h = {'Content-Type': 'application/json'}
        if token:
            h['X-Workbench-Token'] = self.server.token
        h.update(headers or {})
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        c.request(method, path, json.dumps(body).encode() if body is not None else None, h)
        r = c.getresponse()
        result = r.status, r.read(), dict(r.getheaders())
        c.close()
        return result

    def test_roundtrip_restart_and_real_tables(self):
        state = fixture()
        self.assertIsNone(self.db.read()['state'])
        status, body, _ = self.request('PUT', '/api/state', dict(state=state, revision=0, mutationId='first-save'))
        self.assertEqual(status, 200, body)
        self.assertEqual(Database(self.path).read()['state'], state)
        self.assertEqual(json.loads(self.request('GET', '/api/state')[1])['state'], state)
        self.assertEqual(self.path.read_bytes()[:16], b'SQLite format 3\x00')
        with closing(sqlite3.connect(self.path)) as db, db:
            self.assertEqual(db.execute('SELECT count(*) FROM students').fetchone()[0], 1)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_conflicts_idempotency_and_history(self):
        original = fixture()
        self.db.write(original, 0, 'mutation-1')
        self.assertEqual(self.db.write(original, 0, 'mutation-1')['revision'], 1)
        changed = copy.deepcopy(original)
        changed['tasks'][0]['title'] = '修改后的备课'
        with self.assertRaises(Conflict):
            self.db.write(changed, 0, 'mutation-1')
        self.assertEqual(self.request('PUT', '/api/state', dict(state=changed, revision=0, mutationId='mutation-2'))[0], 409)
        self.assertEqual(self.db.read()['state'], original)
        self.db.write(changed, 1, 'mutation-2')
        with closing(sqlite3.connect(self.path)) as db, db:
            self.assertEqual(json.loads(db.execute('SELECT payload FROM history WHERE revision=1').fetchone()[0]), original)

    def test_failed_transaction_preserves_all_tables(self):
        original = fixture()
        self.db.write(original, 0, 'mutation-1')
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("CREATE TRIGGER fail_task BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'test disk failure'); END")
        changed = copy.deepcopy(original)
        changed['students'][0]['name'] = '不得写入'
        status, _, _ = self.request('PUT', '/api/state', dict(state=changed, revision=1, mutationId='mutation-2'))
        self.assertEqual(status, 503)
        self.assertEqual(self.db.read(), dict(state=original, revision=1, storage='SQLite'))
        with closing(sqlite3.connect(self.path)) as db, db:
            self.assertEqual(db.execute('SELECT count(*) FROM history').fetchone()[0], 0)

    def test_invalid_relationships_rejected(self):
        state = fixture()
        state['students'][0]['classId'] = 'missing'
        self.assertEqual(self.request('PUT', '/api/state', dict(state=state, revision=0, mutationId='mutation-1'))[0], 400)
        self.assertIsNone(self.db.read()['state'])

    def test_ai_endpoints_require_session_and_valid_payload(self):
        for endpoint in ('/api/aikey', '/api/ai'):
            self.assertEqual(self.request('POST', endpoint, {}, token=False)[0], 403)
            self.assertEqual(self.request('POST', endpoint, [1, 2])[0], 400)
        self.assertEqual(self.request('POST', '/api/ai', {'base': 'file:///invalid'})[0], 400)
        self.assertFalse((self.path.parent / 'ai.key').exists())

    def test_invalid_grade_does_not_change_database(self):
        state = fixture()
        state['grades'] = [{'id': 'g1', 'scores': [{'studentId': 's1', 'score': '250'}]}]
        self.assertEqual(self.request('PUT', '/api/state', dict(state=state, revision=0, mutationId='bad-grade'))[0], 400)
        self.assertIsNone(self.db.read()['state'])

    def test_existing_teacher_acceptance_fixture(self):
        source = ROOT.parent / 'docs' / 'acceptance' / 'fixtures' / 'R1-2班50人.json'
        state = json.loads(source.read_text(encoding='utf-8-sig'))['state']
        self.db.write(state, 0, 'fixture-import')
        self.assertEqual(Database(self.path).read()['state'], state)
        self.assertEqual(len(state['students']), 100)
        self.assertEqual(len(state['assignments']), 120)

    def test_local_access_and_static_allowlist(self):
        self.assertEqual(self.request('GET', '/api/session', token=False)[0], 200)
        self.assertEqual(self.request('GET', '/api/state', token=False)[0], 403)
        self.assertEqual(self.request('GET', '/api/state', headers={'Origin': 'https://example.com'})[0], 403)
        self.assertEqual(self.request('GET', '/api/session', headers={'Host': 'attacker.test'})[0], 403)
        for path in ['/data/workbench.sqlite3', '/server.py', '/../server.py', '/%2e%2e/server.py']:
            self.assertEqual(self.request('GET', path)[0], 404)
        self.assertEqual(self.request('GET', '/')[0], 200)
        # Static range behavior must not depend on untracked real textbooks.
        static_root = (Path(self.temp.name) / 'static').resolve()
        (static_root / 'textbooks').mkdir(parents=True)
        (static_root / 'textbooks' / 'fixture.pdf').write_bytes(b'%PDF-1.4\nsynthetic range fixture\n%%EOF')
        with patch('server.ROOT', static_root):
            status, body, headers = self.request('GET', '/textbooks/fixture.pdf', headers={'Range': 'bytes=0-4'})
        self.assertEqual(status, 206)
        self.assertEqual(body, b'%PDF-')
        self.assertTrue(headers['Content-Range'].startswith('bytes 0-4/'))


if __name__ == '__main__':
    unittest.main()
