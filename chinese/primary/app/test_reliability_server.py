from contextlib import closing
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from server import Database, read_server_ai_key, write_server_ai_key
from test_sqlite_server import fixture


class ReliabilityTests(unittest.TestCase):
    def test_encrypted_key_and_legacy_upgrade(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'ai.key'
            write_server_ai_key('SYNTHETIC_KEY', path)
            self.assertNotIn(b'SYNTHETIC_KEY', path.read_bytes())
            self.assertEqual(read_server_ai_key(path), 'SYNTHETIC_KEY')
            path.write_text('LEGACY_SYNTHETIC', encoding='utf-8')
            self.assertEqual(read_server_ai_key(path), 'LEGACY_SYNTHETIC')
            self.assertNotIn(b'LEGACY_SYNTHETIC', path.read_bytes())

    def test_history_restore_and_migration_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Database(Path(directory) / 'db.sqlite3')
            state = fixture()
            store.write(state, 0, 'mutation-001')
            with closing(store.connect()) as db, db:
                payload = json.loads(db.execute('SELECT payload FROM metadata').fetchone()[0])
                payload['settings']['ai']['key'] = 'SYNTHETIC_OLD'
                db.execute('UPDATE metadata SET payload=?', (json.dumps(payload),))
            def failed(_key):
                raise RuntimeError('encryption failed')
            with self.assertRaises(RuntimeError):
                store.migrate_secrets(failed)
            self.assertEqual(store.read()['state']['settings']['ai']['key'], 'SYNTHETIC_OLD')
            captured = []
            store.migrate_secrets(captured.append)
            self.assertEqual(captured, ['SYNTHETIC_OLD'])
            self.assertNotIn('key', store.read()['state']['settings']['ai'])
            for revision in range(1, 25):
                state['students'][0]['name'] = 'Synthetic ' + str(revision)
                store.write(state, revision, 'mutation-version-' + str(revision))
            history = store.history_list()
            self.assertEqual(len(history), 20)
            self.assertTrue(all(store.history_read(x['revision'])['intact'] for x in history))
            restored = Database(Path(directory) / 'restored.sqlite3')
            snapshot = store.history_read(history[-1]['revision'])['state']
            restored.write(snapshot, 0, 'restored-001')
            self.assertEqual(restored.read()['state'], snapshot)


if __name__ == '__main__':
    unittest.main()
