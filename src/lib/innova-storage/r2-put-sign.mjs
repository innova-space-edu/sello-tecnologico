// Future upload pilot only. This module does not enable uploads by itself.
// Cloudflare R2 SigV4 PUT; requires the browser to send EXACT Content-Type.
// Never accept a mutable user-supplied object key at the HTTP boundary.
import {createHash,createHmac} from 'node:crypto'

const enc = v => encodeURIComponent(v).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())
const digest = value => createHash('sha256').update(value).digest('hex')
const mac = (secret,value) => createHmac('sha256',secret).update(value).digest()

export function signEvidencePut({accountId,accessKeyId,secretAccessKey,key,contentType,now=new Date()}){
  if(!/^[a-f0-9]{32}$/.test(accountId)||!accessKeyId||!secretAccessKey)throw Error('R2 credentials unavailable')
  if(typeof key!=='string'||!key||key.includes('\\')||/[\x00-\x1f\x7f]/.test(key)||
     key.split('/').some(v=>!v||v==='.'||v==='..')||
     Buffer.byteLength('evidencias/'+key)>1024)throw Error('Invalid private R2 object key')
  if(typeof contentType!=='string'||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/.test(contentType)||contentType.length>100)
    throw Error('Invalid content type')
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid date')
  const host=accountId+'.r2.cloudflarestorage.com'
  const uri='/innova-crealab/evidencias/'+key.split('/').map(enc).join('/')
  const date=now.toISOString().replace(/[:-]|\.\d{3}/g,'')
  const day=date.slice(0,8), scope=day+'/auto/s3/aws4_request'
  const params={
    'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
    'X-Amz-Credential':accessKeyId+'/'+scope,
    'X-Amz-Date':date,
    'X-Amz-Expires':'60',
    'X-Amz-SignedHeaders':'content-type;host',
  }
  const query=Object.keys(params).sort().map(k=>enc(k)+'='+enc(params[k])).join('&')
  const canonical=['PUT',uri,query,'content-type:'+contentType+'\nhost:'+host+'\n','content-type;host','UNSIGNED-PAYLOAD'].join('\n')
  const toSign=['AWS4-HMAC-SHA256',date,scope,digest(canonical)].join('\n')
  const k=mac(mac(mac(mac('AWS4'+secretAccessKey,day),'auto'),'s3'),'aws4_request')
  const signature=createHmac('sha256',k).update(toSign).digest('hex')
  return {
    url:'https://'+host+uri+'?'+query+'&X-Amz-Signature='+signature,
    method:'PUT',
    headers:{'Content-Type':contentType},
    expires_in:60,
  }
}
