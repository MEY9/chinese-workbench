// Read-only release checks: no windows, real records or external services.
import asar from '@electron/asar';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const packageDir=path.resolve(root,process.env.WB_PACKAGE_DIR || 'dist');
const archive=path.join(packageDir,'win-unpacked/resources/app.asar');
const bundled=relative=>asar.extractFile(archive,path.join(...relative.split('/')));
const current=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(JSON.parse(bundled('package.json')).version,current.version);
assert.equal(bundled('src/renderer/index.html').toString(),fs.readFileSync(path.join(root,'../app/index.html'),'utf8'));
for(const file of ['main.js','store.js','preload.cjs'])assert.equal(bundled('src/main/'+file).toString(),fs.readFileSync(path.join(root,'src/main',file),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'../app/textbooks-manifest.json'),'utf8'));
const books=process.env.WB_PUBLIC_PACKAGE === '1' ? [] : manifest.books;
if(process.env.WB_PUBLIC_PACKAGE === '1'){
  const resourceDir=path.join(packageDir,'win-unpacked/resources');
  const pdfFiles=fs.readdirSync(resourceDir,{recursive:true}).filter(file=>file.toLowerCase().endsWith('.pdf'));
  assert.equal(pdfFiles.length,0,'Public installer must not include textbook PDFs');
}
for(const book of books){
  const pdf=fs.readFileSync(path.join(packageDir,'win-unpacked/resources/textbooks',book.file));
  assert.equal(crypto.createHash('sha256').update(pdf).digest('hex'),book.sha256);
}
console.log(`Packaged ${current.version} verified: renderer, main process, SQLite store, IPC and ${books.length} textbook hashes.`);
