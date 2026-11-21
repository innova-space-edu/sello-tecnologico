import assert from 'node:assert/strict'
import {matchesEvidence,safeMediaType} from '../src/lib/innova-storage/read-guard.mjs'
const row={id:'ev1',project_id:'proj1',created_by:'author',file_url:'https://example.test/a.jpg',file_type:'image/jpeg',file_size:123}
const entry={evidence_id:'ev1',project_id:'proj1',created_by:'author',legacy_url:row.file_url,mime_type:'image/jpeg',size_bytes:123,source_key:'a.jpg',sha256:'a'.repeat(64),enabled:true}
assert.equal(matchesEvidence(row,entry,'author','estudiante'),true)
assert.equal(matchesEvidence(row,entry,'staff','admin'),true)
assert.equal(matchesEvidence(row,entry,'other','estudiante'),false)
assert.equal(matchesEvidence(row,entry,'other','docente'),false)
assert.equal(matchesEvidence(row,{...entry,enabled:false},'author','estudiante'),false)
for(const [field,value] of Object.entries({id:'ev2',project_id:'proj2',created_by:'attacker',file_url:'https://example.test/b.jpg',file_type:'text/html',file_size:456})) {
  assert.equal(matchesEvidence({...row,[field]:value},entry,'author','estudiante'),false)
}
assert.equal(matchesEvidence({...row,file_size:1000001},{...entry,size_bytes:1000001},'author','estudiante'),false)
assert.equal(matchesEvidence(row,{...entry,sha256:'bad'},'author','estudiante'),false)
assert.equal(safeMediaType('image/jpeg'),'image/jpeg')
for(const mime of ['text/html','image/svg+xml','application/pdf','application/javascript']) assert.equal(safeMediaType(mime),'application/octet-stream')
console.log('PASS: owner/admin, deny other users, immutable registry, size/hash bounds, safe MIME')
