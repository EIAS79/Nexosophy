"use client";
import {Button} from "@nexosophy/ui";
import {useCallback,useEffect,useState} from "react";

type Ref={id:string;title:string;year:number|null;authors:Array<{family?:string;given?:string;literal?:string}>};
export function CitationPanel({workspaceId,nodeId}:{workspaceId:string;nodeId:string}){
 const[refs,setRefs]=useState<Ref[]>([]),[selected,setSelected]=useState(""),[style,setStyle]=useState("apa7"),[locator,setLocator]=useState(""),[status,setStatus]=useState("");
 const load=useCallback(async()=>{const r=await fetch(`/api/research/${workspaceId}?view=references&limit=200`,{cache:"no-store"});if(r.ok){const x=await r.json() as{items:Ref[]};setRefs(x.items);}},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 async function insert(){if(!selected)return;setStatus("Inserting citation…");const r=await fetch(`/api/research/${workspaceId}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"citation",documentNodeId:nodeId,referenceId:selected,styleId:style,locator:locator||undefined})});if(!r.ok){const x=await r.json().catch(()=>null) as any;setStatus(x?.error?.message??"Citation failed.");return;}setStatus("Citation inserted. Refresh the document editor to see the new anchor.");}
 return <section className="dashboard-card" aria-label="Citation tools"><div className="dashboard-head"><div><p className="eyebrow">Academic writing</p><h2>Citations</h2><p>Citation anchors stay linked to canonical reference IDs.</p></div><a href={`/app/workspaces/${workspaceId}/research?tab=references`}>Reference library</a></div><div className="workspace-subnav"><select value={selected} onChange={e=>setSelected(e.currentTarget.value)}><option value="">Choose reference…</option>{refs.map(r=><option key={r.id} value={r.id}>{r.title} {r.year?"("+r.year+")":""}</option>)}</select><select value={style} onChange={e=>setStyle(e.currentTarget.value)}><option value="apa7">APA 7</option><option value="ieee">IEEE</option><option value="harvard">Harvard</option></select><input value={locator} onChange={e=>setLocator(e.currentTarget.value)} placeholder="Page / locator"/><Button variant="secondary" onClick={()=>void insert()} disabled={!selected}>Insert citation</Button></div><p aria-live="polite">{status}</p></section>;
}
