"use client";
import {Button} from "@nexosophy/ui";
import {useState,type FormEvent} from "react";

async function post(w:string,b:any){
 const r=await fetch(`/api/research/${w}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)});
 if(!r.ok){const x=await r.json().catch(()=>null) as any;throw new Error(x?.error?.message??"Research action failed.");}
 if(r.status===204)return null;return r.json();
}
export function ThesisProjectManager({workspaceId,projectId,data}:{workspaceId:string;projectId:string;data:any}){
 const[status,setStatus]=useState(data.project.status),[message,setMessage]=useState("");
 async function act(body:any,success:string){try{await post(workspaceId,{projectId,...body});setMessage(success);window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Action failed.");}}
 async function statement(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await act({action:"statement",type:String(f.get("type")),text:String(f.get("text"))},"Statement added.");}
 async function chapter(){const title=window.prompt("Chapter title")?.trim();if(title)await act({action:"chapter",title},"Chapter created.");}
 async function milestone(){const title=window.prompt("Milestone title")?.trim();if(!title)return;const due=window.prompt("Due date/time (optional ISO or YYYY-MM-DD)")?.trim();await act({action:"milestone",title,dueAt:due?new Date(due).toISOString():undefined},"Milestone created as a canonical task.");}
 async function meeting(){const title=window.prompt("Meeting title","Supervisor meeting")?.trim();if(!title)return;const start=window.prompt("Start date/time (e.g. 2026-10-20T10:00)")?.trim();if(!start)return;const startsAt=new Date(start),endsAt=new Date(startsAt.getTime()+3600000);await act({action:"meeting",title,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,agenda:window.prompt("Agenda")??""},"Meeting created with calendar event and notes.");}
 async function decision(){const decision=window.prompt("Decision")?.trim();if(decision)await act({action:"decision",decision,rationale:window.prompt("Rationale")??""},"Decision recorded.");}
 async function ethics(){const next=window.prompt("Ethics status: not_required, planned, submitted, approved, rejected, expired","planned")?.trim();if(next)await act({action:"ethics",status:next,authority:window.prompt("Authority")||undefined,referenceNumber:window.prompt("Reference number")||undefined,notes:window.prompt("Notes")||""},"Ethics record updated.");}
 async function link(){const nodeId=window.prompt("Dataset / experiment / related node ID")?.trim();if(!nodeId)return;const kind=window.prompt("Link kind","dataset")?.trim()||"related";await act({action:"thesisLink",nodeId,kind},"Research node linked.");}
 async function updateStatus(next:string){setStatus(next);await act({action:"status",status:next},"Thesis status updated.");}
 return <div className="dashboard-grid">
  <section className="dashboard-card"><h2>Project controls</h2><label>Status <select value={status} onChange={e=>void updateStatus(e.currentTarget.value)}>{["proposal","research","writing","review","submitted","defended","archived"].map(x=><option key={x}>{x}</option>)}</select></label><div className="workspace-subnav"><Button variant="secondary" onClick={()=>void chapter()}>Add chapter</Button><Button variant="secondary" onClick={()=>void milestone()}>Add milestone</Button><Button variant="secondary" onClick={()=>void meeting()}>Supervisor meeting</Button><Button variant="secondary" onClick={()=>void decision()}>Decision</Button><Button variant="secondary" onClick={()=>void ethics()}>Ethics</Button><Button variant="secondary" onClick={()=>void link()}>Link data/experiment</Button></div></section>
  <section className="dashboard-card"><h2>Research questions / hypotheses</h2><form onSubmit={e=>void statement(e)}><select name="type"><option value="question">Question</option><option value="hypothesis">Hypothesis</option><option value="objective">Objective</option></select><textarea name="text" required rows={3}/><Button type="submit">Add statement</Button></form>{data.statements.map((x:any)=><p key={x.id}><strong>{x.type}:</strong> {x.text}</p>)}</section>
  <section className="dashboard-card"><h2>Chapters</h2>{data.chapters.map((x:any)=><p key={x.id}><a href={`/app/workspaces/${workspaceId}/node/${x.node_id}`}>{x.title}</a> · {x.status}</p>)}</section>
  <section className="dashboard-card"><h2>Milestones</h2>{data.milestones.map((x:any)=><p key={x.id}>{x.title} · {x.task_status} · {x.due_at?new Date(x.due_at).toLocaleDateString():"no due date"}</p>)}</section>
  <section className="dashboard-card"><h2>Supervision</h2>{data.supervisors.map((x:any)=><p key={x.id}>{x.name} · {x.role}</p>)}{data.meetings.map((x:any)=><p key={x.id}>{x.title} · {new Date(x.starts_at).toLocaleString()} · <a href={`/app/workspaces/${workspaceId}/node/${x.notes_node_id}`}>notes</a></p>)}</section>
  <section className="dashboard-card"><h2>Decision log</h2>{data.decisions.map((x:any)=><p key={x.id}><strong>{x.decision}</strong><br/>{x.rationale}</p>)}</section>
  <section className="dashboard-card"><h2>Ethics & submission</h2>{data.ethics.map((x:any)=><p key={x.id}>{x.status} · {x.authority??""} · {x.reference_number??""}</p>)}{data.checklist.map((x:any)=><label key={x.id}><input type="checkbox" checked={x.done} onChange={e=>void act({action:"checklist",itemId:x.id,done:e.currentTarget.checked},"Checklist updated.")}/> {x.label}</label>)}</section>
  <section className="dashboard-card"><h2>Literature review matrix</h2>{data.literatureMatrix.map((x:any)=><p key={x.id}><strong>{x.title}</strong> · {x.method??""} · {x.findings??""} · {x.relevance??""}</p>)}</section>
  <p aria-live="polite">{message}</p>
 </div>;
}
