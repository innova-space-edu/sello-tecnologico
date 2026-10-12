"use client"
import { familyPurposes } from "@/lib/family-consent/config"

export const selloChoices = () => Object.fromEntries(familyPurposes("sello").map(p => [p.key, false])) as Record<string, boolean>
type Props = {
 expanded: boolean; setExpanded: (value: boolean) => void
 terms: boolean; setTerms: (value: boolean) => void
 choices: Record<string, boolean>; setChoices: (value: Record<string, boolean>) => void
 minor: boolean; guardianEmail: string; setGuardianEmail: (value: string) => void
}
export default function SelloConsentPanel(p: Props) {
 return <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm">
  <label className="flex cursor-pointer items-start gap-3 font-semibold text-blue-900">
   <input type="checkbox" checked={p.expanded} onChange={e => p.setExpanded(e.target.checked)} className="mt-1 h-4 w-4"/>
   <span>Ver formulario de consentimiento y términos de Sello Tecnológico
    <span className="block text-xs font-normal">Marca la casilla para desplegar las condiciones y decidir cada uso por separado.</span>
   </span>
  </label>
  {p.expanded && <div className="mt-4 space-y-4 border-t border-blue-200 pt-4">
   <p className="text-xs text-slate-700">La plataforma trata datos necesarios de cuenta, proyectos y actividad escolar, además de herramientas opcionales. Consulta la <a className="underline" target="_blank" rel="noreferrer" href="/proteccion-datos">información sobre privacidad</a>.</p>
   <label className="flex items-start gap-2 text-xs">
    <input type="checkbox" className="mt-1" checked={p.terms} onChange={e => p.setTerms(e.target.checked)}/>
    <span>Declaro haber leído y aceptado las condiciones necesarias de acceso; esto no habilita automáticamente los usos opcionales.</span>
   </label>
   <p className="text-xs font-semibold">Finalidades independientes</p>
   {familyPurposes("sello").filter(x => x.key !== "platform_access").map(item=>
    <label key={item.key} className="flex items-start gap-3 rounded-lg border bg-white p-3 text-xs">
     <input type="checkbox" className="mt-1" disabled={p.minor} checked={!p.minor && p.choices[item.key]===true}
       onChange={e=>p.setChoices({...p.choices,[item.key]:e.target.checked})}/>
     <span><strong className="block text-slate-800">{item.title}</strong><span className="text-slate-600">{item.description}</span></span>
    </label>
   )}
   {p.minor && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
    <p className="text-xs font-bold text-amber-950">Menor de edad: autorización familiar obligatoria antes del ingreso</p>
    <p className="text-xs">El menor no puede autorizar por sí mismo estas finalidades. La invitación y firma no habilitan la cuenta: la institución debe comprobar identidad y facultades del representante y aprobar el formulario.</p>
    <label className="block text-xs font-semibold">Correo del padre, madre o representante con facultades legales
     <input type="email" required value={p.guardianEmail} onChange={e=>p.setGuardianEmail(e.target.value)}
       placeholder="familia@correo.cl" className="mt-1 w-full rounded-lg border bg-white p-3 font-normal"/>
    </label>
   </div>}
   <p className="text-xs text-slate-600">No ingreses datos sensibles innecesarios. La aceptación del aviso no implica una renuncia de derechos. Podrás retirar autorizaciones opcionales.</p>
  </div>}
 </section>
}