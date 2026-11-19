// Server-side S3 SigV4 GET signing, no external dependencies.
import {createHash, createHmac} from 'node:crypto'

const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const hash = data => createHash('sha256').update(data).digest('hex')

export function signEvidenceGet({accountId, accessKeyId, secretAccessKey, key, now = new Date()}) {
  if (!/^[a-f0-9]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey) throw new Error('R2 credentials unavailable')
  if (typeof key !== 'string' || !key || key.includes('\\') || /[\x00-\x1f\x7f]/.test(key) || key.split('/').some(s => !s || s === '.' || s === '..')) throw new Error('Invalid object key')
  const host = accountId + '.r2.cloudflarestorage.com'
  const uri = '/innova-crealab/evidencias/' + key.split('/').map(encode).join('/')
  if (Buffer.byteLength('evidencias/' + key, 'utf8') > 1024) throw new Error('Invalid object key length')
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = date.slice(0, 8)
  const scope = day + '/auto/s3/aws4_request'
  const params = {
    'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
    'X-Amz-Credential':accessKeyId + '/' + scope,
    'X-Amz-Date':date,
    'X-Amz-Expires':'60',
    'X-Amz-SignedHeaders':'host',
  }
  const query = Object.keys(params).sort().map(k => encode(k) + '=' + encode(params[k])).join('&')
  const canonical = ['GET',uri,query,'host:'+host+'\n','host','UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256',date,scope,hash(canonical)].join('\n')
  const signingKey = hmac(hmac(hmac(hmac('AWS4'+secretAccessKey,day),'auto'),'s3'),'aws4_request')
  return 'https://'+host+uri+'?'+query+'&X-Amz-Signature='+hmac(signingKey,toSign).toString('hex')
}
