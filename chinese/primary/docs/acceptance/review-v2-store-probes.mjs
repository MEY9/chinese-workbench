// Runs under Electron's Node runtime; only synthetic temporary databases.
import { Store } from '../../desktop/src/main/store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wb-review-v2-'));
let db,restored;
try {
  db=new Store(path.join(dir,'probe.sqlite3'));
  const state=Object.fromEntries(['classes','students','progress','preps','dictations','assignments','followups','tasks','customBooks','legacyWrong'].map(k=>[k,[]]));
  Object.assign(state,{version:1,selectedClassId:'c1',settings:{ai:{key:'SYNTHETIC_LEGACY_KEY'}},bankOverride:{}});
  state.classes.push({id:'c1',name:'Synthetic'});
  state.students.push({id:'s1',classId:'c1',no:'01',name:'Synthetic'});
  db.write(state,0,'review-legacy-0');
  delete state.settings.ai.key;
  db.write(state,1,'review-clean-01');
  const legacyKeyRemainsInHistory=db.readHistory(1).state.settings.ai.key==='SYNTHETIC_LEGACY_KEY';
  for(let rev=2;rev<27;rev++){
    state.students[0].name='Synthetic '+rev;
    db.write(state,rev,'review-version-'+rev);
  }
  const history=db.listHistory();
  const allIntact=history.every(h=>db.readHistory(h.revision).intact);
  const snap=db.readHistory(history[history.length-1].revision).state;
  restored=new Store(path.join(dir,'restored.sqlite3'));
  restored.write(snap,0,'review-restore-1');
  console.log(JSON.stringify({historyCount:history.length,allRetainedSnapshotsIntact:allIntact,restoredStudentCount:restored.read().state.students.length,restoredHistoricalNameMatches:restored.read().state.students[0].name===snap.students[0].name,legacyKeyRemainsInHistory},null,2));
}finally{
  restored?.close();db?.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('wb-review-v2-'))throw Error('Unexpected temp path');
  fs.rmSync(dir,{recursive:true,force:true});
}
