import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import ts from "typescript"

const files=[
 "src/app/login/page.tsx",
 "src/app/consentimiento/page.tsx",
 "src/proxy.ts",
 "src/app/configuracion/privacidad/page.tsx",
 "src/app/admin/actas-familiares/page.tsx",
 "src/app/api/admin/actas-familiares/route.ts",
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
assert.match(login,/\.from\('sello_privacy_choices'\)/)
assert.match(login,/router\.push\('\/consentimiento'\)/)
assert.doesNotMatch(login,/record_sello_privacy_choices/,"Inicio de sesión y registro no deben regrabar cada vez")
assert.doesNotMatch(login,/minor=\{false\} guardianEmail/,"Inicio de sesión no debe pedir formulario de registro")
assert.match(login,/sello_optional_choices_requested/)
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
