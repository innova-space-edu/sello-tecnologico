'use client'
import { usePathname } from 'next/navigation'
import FollowupRealtimeRefresh from './FollowupRealtimeRefresh'
export default function FollowupRealtimeMount(){
 const path=usePathname()
 if(!path.startsWith('/seguimientos'))return null
 const id=path.match(/^\/seguimientos\/([0-9a-f-]{36})/i)?.[1]
 return <FollowupRealtimeRefresh mode={id?'detail':'list'} followupId={id}/>
}
