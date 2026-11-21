import test from 'node:test'
import assert from 'node:assert/strict'
import {signEvidencePut} from '../src/lib/innova-storage/r2-put-sign.mjs'

const accountId='0123456789abcdef0123456789abcdef'
const base={
  accountId,
  accessKeyId:'TESTACCESSKEY',
  secretAccessKey:'secret-key-not-real',
  key:'demo/video.mp4',
  contentType:'video/mp4',
  now:new Date('2026-11-21T12:00:00.000Z')
}
test('PUT signature matches independent boto3/botocore S3 SigV4 golden vector',()=>{
  const got=signEvidencePut(base)
  assert.equal(got.method,'PUT')
  assert.deepEqual(got.headers,{'Content-Type':'video/mp4'})
  assert.equal(got.expires_in,60)
  assert.equal(got.url,'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/innova-crealab/evidencias/demo/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TESTACCESSKEY%2F20261121%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20261121T120000Z&X-Amz-Expires=60&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Signature=e1a5baf4774f7dc3282fdafb97d9b5814f914308a92d0584440548b7f7e81470')
})
test('invalid R2 targets, MIME and object key cannot be signed',()=>{
  for(const changes of [
    {accountId:'wrong'}, {accessKeyId:''},{secretAccessKey:''},
    {contentType:'text/html; charset=UTF-8'}, {contentType:'video/mp4\nX-Test: injected'},
    {key:'../user/file.jpg'},{key:'a//b'}, {key:'x\\escape'},
    {key:'a/'+'x'.repeat(1100)}
  ])assert.throws(()=>signEvidencePut({...base,...changes}))
})
test('signature changes for different MIME or object key; never accepts generic method',()=>{
 const a=signEvidencePut(base)
 const b=signEvidencePut({...base,contentType:'image/jpeg'})
 const c=signEvidencePut({...base,key:'demo/other.jpg'})
 assert.notEqual(a.url,b.url)
 assert.notEqual(a.url,c.url)
 assert.equal(new URL(a.url).searchParams.get('X-Amz-SignedHeaders'),'content-type;host')
})
