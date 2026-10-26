import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from './src/main/store.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wb-store-test-'));let db,restored;
try{
  const file=path.join(dir,'db.sqlite3');db=new Store(file);
  const state=Object.fromEntries(['classes','students','progress','preps','dictations','assignments','followups','tasks','customBooks','legacyWrong'].map(k=>[k,[]]));
  Object.assign(state,{version:1,selectedClassId:'c1',settings:{ai:{}},bankOverride:{}});
  state.classes=[{id:'c1',name:'Synthetic'}];state.students=[{id:'s1',classId:'c1',no:'01',name:'Synthetic'}];
  db.write(state,0,'mutation-001');assert.equal(db.write(state,0,'mutation-001').revision,1);
  assert.throws(()=>db.write(state,0,'mutation-conflict'),/其他窗口/);
  // Simulate an old database directly; the new write API rejects plaintext keys.
  const root=JSON.parse(db.db.prepare('SELECT payload FROM metadata').get().payload);root.settings.ai.key='SYNTHETIC_LEGACY_SECRET';
  db.db.prepare('UPDATE metadata SET payload=?').run(JSON.stringify(root));
  db.db.prepare('INSERT INTO history(revision,payload) VALUES(0,?)').run(JSON.stringify({...state,settings:{ai:{key:'SYNTHETIC_LEGACY_SECRET'}}}));
  assert.throws(()=>db.migrateSecrets(()=>{throw Error('encryption unavailable')}),/encryption unavailable/);
  assert.equal(db.read().state.settings.ai.key,'SYNTHETIC_LEGACY_SECRET');
  let secured='';db.migrateSecrets(key=>{secured=key});assert.equal(secured,'SYNTHETIC_LEGACY_SECRET');assert.equal(db.read().state.settings.ai.key,undefined);assert.equal(db.readHistory(0).state.settings.ai.key,undefined);
  assert.ok(!fs.readFileSync(file).includes(Buffer.from('SYNTHETIC_LEGACY_SECRET')));
  for(let revision=1;revision<27;revision++){state.students[0].name='Synthetic '+revision;db.write(state,revision,'mutation-'+revision+'-unique')}
  const history=db.listHistory();assert.equal(history.length,20);assert.ok(history.every(x=>db.readHistory(x.revision).intact));
  const snapshot=db.readHistory(history.at(-1).revision).state;restored=new Store(path.join(dir,'restored.sqlite3'));restored.write(snapshot,0,'restore-001');assert.deepEqual(restored.read().state,snapshot);
  assert.throws(()=>db.write({...state,settings:{ai:{key:'forbidden'}}},27,'forbidden-01'),/密钥/);
  console.log('Desktop Store passed: idempotency, conflict, 20 complete histories, restoration, migration rollback and plaintext scrubbing.');
}finally{restored?.close();db?.close();if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('wb-store-test-'))throw Error('Unexpected temp target');fs.rmSync(dir,{recursive:true,force:true})}
