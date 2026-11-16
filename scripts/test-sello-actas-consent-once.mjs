import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import ts from "typescript"
import {runInNewContext} from "node:vm"

const files=[
 "src/app/login/page.tsx",
 "src/app/consentimiento/page.tsx",
 "src/proxy.ts",
 "src/app/configuracion/privacidad/page.tsx",
 "src/app/admin/actas-familiares/page.tsx",
 "src/app/api/admin/actas-familiares/route.ts",
 "src/lib/family-consent/account-status.ts",
 "src/app/api/privacy/self/route.ts",
 "src/app/api/admin/actas-privacidad/route.ts",
 "src/app/admin/actas-privacidad/page.tsx",
]
for(const path of files){
 const result=ts.transpileModule(readFileSync(path,"utf8"),{
  fileName:path, reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}
 })
 const errors=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
 assert.equal(errors.length,0,path+": "+errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "))
}
const login=readFileSync(files[0],"utf8")
const firstConsent=readFileSync(files[1],"utf8")
const proxy=readFileSync(files[2],"utf8")
const profile=readFileSync(files[3],"utf8")
const actPage=readFileSync(files[4],"utf8")
const actApi=readFileSync(files[5],"utf8")
const actsSql=readFileSync("supabase/migrations/202610120010_sello_family_acts.sql","utf8")
const privacySql=readFileSync("supabase/migrations/202610120011_sello_privacy_persist_once.sql","utf8")
assert.match(login,/fetch\('\/api\/privacy\/self'/)
assert.match(login,/router\.push\('\/consentimiento'\)/)
assert.doesNotMatch(login,/record_sello_privacy_choices/,"Inicio de sesión y registro no deben regrabar cada vez")
assert.doesNotMatch(login,/minor=\{false\} guardianEmail/,"Inicio de sesión no debe pedir formulario de registro")
assert.doesNotMatch(login,/sello_terms_acknowledged|sello_optional_choices_requested/,"Consentimiento posterior a autenticación")
assert.match(firstConsent,/record_sello_privacy_choices/)
assert.match(firstConsent,/terms/)
assert.match(proxy,/requiredInitialPrivacy/)
assert.match(proxy,/\/consentimiento/)
assert.match(profile,/terms_acknowledged_at/)
assert.match(profile,/sello_privacy_choice_events/)
assert.match(actsSql,/BORRADOR-ACTA-2026-001/)
assert.match(actsSql,/request_id is null and student_user_id is null/,"Los borradores no pueden acceder a usuarios reales")
assert.match(actsSql,/sello_act_approved/)
assert.match(actsSql,/sello_capture_approved_act/)
assert.match(privacySql,/then public\.sello_privacy_choices\.terms_acknowledged_at/)
assert.match(privacySql,/sello_capture_initial_privacy/)
assert.match(privacySql,/on conflict\(user_id\) do nothing/,"Alta nueva no puede sobrescribir decisiones anteriores")
assert.match(actApi,/requireAdminSession/)
assert.match(actApi,/createFamilyAdminClient/)
assert.match(actApi,/record_type/)
assert.match(actPage,/BORRADOR · SIN VALIDEZ/)
assert.match(actPage,/no habilita|No habilita/)
console.log("OK: acta ficticia privada sin permisos, archivo real y consentimiento por versión persistente")

const status=readFileSync("src/lib/family-consent/account-status.ts","utf8")
const review=readFileSync("src/app/api/admin/actas-privacidad/route.ts","utf8")
const migration=readFileSync("supabase/migrations/20261116000900_sello_account_consent_review.sql","utf8")
assert.match(status,/category==="unknown"&&!isAdmin/)
assert.match(status,/category==="minor"&&/)
assert.match(status,/approval!=="approved"/)
assert.match(review,/profile\?\.role!=="admin"/)
assert.match(review,/event\.data\.user_id===user\.id/)
assert.match(migration,/enable row level security/)
assert.match(migration,/is distinct from 'true'/)
console.log("OK: acceso administrativo, revisión individual y consentimiento posterior a autenticación")

const compiled=ts.transpileModule(status,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
let fixtures={}
function query(table){
 const filters={}
 const builder={
  select(){return builder},eq(k,v){filters[k]=v;return builder},in(){return builder},order(){return builder},limit(){return builder},
  async maybeSingle(){
   let data=fixtures[table]??null
   if(table==="sello_privacy_reviews")data=filters.decision==="approved"?(fixtures.approved?{event_id:1}:null):(fixtures.latestReview?{decision:fixtures.latestReview}:null)
   return {data,error:null}
  }
 }
 return builder
}
const ctx={exports:{},Date,Number,process:{env:{}},require:name=>name.endsWith("/server")?{createFamilyAdminClient:()=>({from:query})}:{hasLegacyConsentGrace:()=>false,shouldEnforceFamilyConsent:()=>true}}
runInNewContext(compiled,ctx,{timeout:3000})
const account=ctx.exports.getAccountStatus
const user={id:"test",created_at:"2026-02-01T00:00:00Z"}
const consent={version:"sello-2026-10-v1",terms_acknowledged_at:"2026-11-15T00:00:00Z",choices:{}}
const adult={declared_birth_date:"1980-01-01",captured_at:"2026-10-11T00:00:00Z"}
const minor={declared_birth_date:"2015-01-01",captured_at:"2026-10-11T00:00:00Z"}
fixtures={profiles:{role:"admin",blocked:false},sello_privacy_choices:consent}
assert.equal((await account(user)).next,"/dashboard","Admin antiguo sin fecha no se confunde con menor")
fixtures.sello_age_review_requests={status:"pending"}
assert.equal((await account(user)).next,"/dashboard","La revisión de edad del administrador no bloquea su acceso")
fixtures={profiles:{role:"admin",blocked:false}}
assert.equal((await account(user)).next,"/consentimiento","Admin también registra condiciones")
fixtures={profiles:{role:"admin",blocked:false},family_age_status:minor,sello_privacy_choices:consent}
assert.equal((await account(user)).next,"/autorizacion-pendiente","Admin menor conocido mantiene control familiar")
fixtures={profiles:{role:"docente",blocked:false},family_age_status:adult,sello_privacy_choices:consent,sello_privacy_choice_events:{id:1}}
assert.equal((await account(user)).next,"/autorizacion-pendiente","Adulto espera revisión institucional")
fixtures.approved=true
assert.equal((await account(user)).next,"/dashboard","Adulto aprobado entra")
fixtures={profiles:{role:"estudiante",blocked:false},sello_privacy_choices:consent,approved:true}
assert.equal((await account(user)).age,"unknown")
assert.equal((await account(user)).next,"/autorizacion-pendiente","Edad desconocida requiere regularización")
fixtures={profiles:{role:"estudiante",blocked:false},family_age_status:minor,sello_privacy_choices:consent,approved:true}
assert.equal((await account(user)).next,"/autorizacion-pendiente","Menor requiere aprobación familiar además de la personal")
fixtures.family_authorization_requests={status:"approved",document_version:"family-2026-10-v1",decisions:{platform_access:true}}
assert.equal((await account(user)).next,"/dashboard")
fixtures={profiles:{role:"admin",blocked:true},sello_privacy_choices:consent}
assert.equal((await account(user)).next,"/bloqueado","No abrir cuenta bloqueada")
assert.equal(ctx.exports.ageCategory("2020-02-31"),"unknown","No normalizar fechas inválidas")
console.log("OK: escenarios de acceso ejecutados con cuentas simuladas")

const pendingPage=readFileSync("src/app/autorizacion-pendiente/page.tsx","utf8")
assert.match(pendingPage,/regularizar"\)===\s*"1"/)
assert.match(pendingPage,/data.next==="\/dashboard"&&!voluntaryAdminAge/)
console.log("OK: salida automática de la revisión de edad para administración")
