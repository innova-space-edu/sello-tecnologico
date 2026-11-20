import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, authorizeEvidence, createHandler } from './server.mjs'

const EVIDENCE = 'cb497fe7-f927-401c-81e2-bf09d4256cc6'
const USER = '5f3b4094-8c86-4e2d-bdb3-f0e1cb26f93b'
const PROJECT = 'a318bb9b-69dc-4166-b9e9-339567aacb8e'
const FILE_URL = 'https://xfleqorozycfdmefdejs.supabase.co/storage/v1/object/public/evidencias/file.jpg'
const row = { id: EVIDENCE, project_id: PROJECT, created_by: USER, file_url: FILE_URL, file_size: 50_000_000, file_type: 'video/mp4' }
const registry = { evidence_id:EVIDENCE, project_id: PROJECT, created_by: USER, legacy_url:FILE_URL, source_key: USER + '/video.mp4', size_bytes:50_000_000, mime_type:'video/mp4', sha256:'a'.repeat(64), enabled:true }
const environment = {
  INNOVA_STORAGE_DELL_ENABLED: 'true', SUPABASE_URL: 'https://xfleqorozycfdmefdejs.supabase.co',
  SUPABASE_ANON_KEY:'anon-test', SUPABASE_SERVICE_ROLE_KEY:'service-test',
  R2_ACCESS_KEY_ID:'r2-read-test', R2_SECRET_ACCESS_KEY:'r2-private-test',
  R2_ACCOUNT_ID:'84ed45de70a021c365e93b960c406d48',
  ALLOWED_ORIGINS:'https://sello-tecnologico.vercel.app'
}
const config = loadConfig(environment)
const responder = data => ({ok:true,status:200,json:async()=>data})
function fakeDeps({ owner=USER, evidence=row, reg=registry, quota=true, blocked=false }={}) {
  const calls=[]
  const fetcher=async (url,opts)=>{
    const path=new URL(url).pathname
    calls.push({path,auth:opts.headers.Authorization,apiKey:opts.headers.apikey})
    if(path==='/auth/v1/user') return responder({id:owner})
    if(path==='/rest/v1/profiles') return responder([{role:'estudiante',blocked}])
    if(path==='/rest/v1/evidences') return responder(evidence ? [evidence]:[])
    if(path==='/rest/v1/innova_r2_evidence_registry') return responder(reg ? [reg]:[])
    if(path==='/rest/v1/rpc/innova_reserve_r2_gateway_read') return responder(quota)
    throw new Error('Unexpected endpoint')
  }
  return {calls,fetcher}
}
const signer = opts => {
  assert.equal(opts.key,registry.source_key)
  assert.equal(opts.accessKeyId,'r2-read-test')
  return 'https://r2.example.invalid/private?expires=60'
}
test('full authorization: user JWT RLS, registry, quota then signed link',async()=>{
  const {calls,fetcher}=fakeDeps()
  const result=await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,config,fetcher,signer)
  assert.equal(result.status,200)
  assert.equal(result.body.size_bytes,50_000_000)
  assert.equal(result.body.expires_in,60)
  assert.equal(calls.length,5)
  assert.ok(calls.slice(0,3).every(x=>x.auth==='Bearer my-valid-jwt-token-1234567890' && x.apiKey==='anon-test'))
  assert.ok(calls.slice(3).every(x=>x.auth==='Bearer service-test' && x.apiKey==='service-test'))
})
test('all malformed or short tokens denied before network',async()=>{
  const {calls,fetcher}=fakeDeps()
  assert.equal((await authorizeEvidence('short',EVIDENCE,config,fetcher,signer)).status,401)
  assert.equal(calls.length,0)
})
test('never issue link when evidence is invisible under RLS',async()=>{
  const deps=fakeDeps({evidence:null})
  assert.equal((await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,config,deps.fetcher,signer)).status,404)
  assert.equal(deps.calls.some(x=>x.path.includes('rpc')),false)
})
test('deny reference tampering and nonowner',async()=>{
  for(const changes of [
    {evidence:{...row,file_url:'https://attacker.invalid/file'}},
    {evidence:{...row,created_by:'00000000-0000-0000-0000-000000000001'}},
    {reg:{...registry,enabled:false}},
    {reg:{...registry,size_bytes:100_000_001}},
    {owner:'00000000-0000-0000-0000-000000000002'}
  ]) {
    const deps=fakeDeps(changes)
    assert.equal((await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,config,deps.fetcher,signer)).status,404)
    assert.equal(deps.calls.some(x=>x.path.includes('rpc')),false)
  }
})
test('quota rejection and blocked account prevent a signed link',async()=>{
  const quota=fakeDeps({quota:false})
  assert.equal((await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,config,quota.fetcher,signer)).status,429)
  const blocked=fakeDeps({blocked:true})
  assert.equal((await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,config,blocked.fetcher,signer)).status,403)
  assert.equal(blocked.calls.length,2)
})
test('disabled by default; only explicit allowed origins',async()=>{
  const off=loadConfig({})
  assert.equal(off.enabled,false)
  assert.equal((await authorizeEvidence('my-valid-jwt-token-1234567890',EVIDENCE,off)).status,404)
  assert.throws(()=>loadConfig({...environment,ALLOWED_ORIGINS:'*'}))
  assert.throws(()=>loadConfig({...environment,SUPABASE_SERVICE_ROLE_KEY:''}))
  assert.throws(()=>loadConfig({...environment,SUPABASE_URL:'https://other.supabase.co'}))
  const handler=createHandler(config)
  const req={headers:{origin:'https://untrusted.example'},method:'OPTIONS',url:'/v1/evidences/'+EVIDENCE+'/authorize'}
  let code
  const res={setHeader(){},writeHead(status){code=status},end(){}}
  await handler(req,res)
  assert.equal(code,403)
})
console.log('PASS: Dell gateway auth, fail-closed, RLS/role, 50MB grants, quotas, origin restrictions')

test('HTTP handler accepts browser bearer tokens and supplies exact-origin CORS headers',async()=>{
  const deps=fakeDeps()
  const handler=createHandler(config,deps.fetcher,signer)
  const headers={}
  let status=0
  let body
  const req={
    method:'POST',
    url:'/v1/evidences/'+EVIDENCE+'/authorize',
    headers:{
      origin:'https://sello-tecnologico.vercel.app',
      authorization:'Bearer my-valid-jwt-token-1234567890'
    }
  }
  const res={
    setHeader(k,v){headers[k]=v},
    writeHead(code){status=code},
    end(data){body=JSON.parse(data)}
  }
  await handler(req,res)
  assert.equal(status,200)
  assert.equal(headers['Access-Control-Allow-Origin'],'https://sello-tecnologico.vercel.app')
  assert.equal(headers['Cache-Control'],'private, no-store')
  assert.equal(body.expires_in,60)
  assert.equal(deps.calls.length,5)
})
