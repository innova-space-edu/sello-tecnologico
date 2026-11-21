import assert from 'node:assert/strict'
import {signEvidenceGet} from '../src/lib/innova-storage/r2-sign.mjs'
const options={accountId:'0123456789abcdef0123456789abcdef',accessKeyId:'FAKEKEY',secretAccessKey:'FAKESECRET',key:'folder/archivo ñ (1).pdf',now:new Date('2026-11-19T12:00:00Z')}
const signed=signEvidenceGet(options)
// Independently generated with botocore 1.43.18, path-style S3, auto region.
assert.equal(new URL(signed).searchParams.get('X-Amz-Signature'),'6cdb6f538fe11ffc694c4b381426ed06f863308ee0345f52b1fc7d258dc2a56d')
assert.equal(new URL(signed).searchParams.get('X-Amz-Expires'),'60')
for(const key of ['../x','a/../b','a//b','a/./b','a\\b','', 'a\x00b']) assert.throws(()=>signEvidenceGet({...options,key}))
assert.throws(()=>signEvidenceGet({...options,secretAccessKey:''}))
console.log('PASS: botocore reference signature, expiry, invalid keys')
