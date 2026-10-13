import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

async function createNode(db:PoolClient,w:string,u:string,parent:string|null,kind:string,name:string,metadata:any,body?:any){
  const n=await db.query<{id:string}>(`insert into "content_nodes" ("workspace_id","parent_id","kind","name","metadata","created_by_user_id","updated_by_user_id") values ($1,$2,$3::content_node_kind,$4,$5::jsonb,$6,$6) returning "id"`,[w,parent,kind,name.slice(0,255),JSON.stringify(metadata??{}),u]);
  if(body)await db.query(`insert into "documents" ("workspace_id","node_id","body","created_by_user_id","updated_by_user_id") values ($1,$2,$3::jsonb,$4,$4)`,[w,n.rows[0]!.id,JSON.stringify(body),u]);
  return n.rows[0]!.id;
}
async function event(db:PoolClient,w:string,projectId:string|null,type:string,targetType:string,targetId:string,u:string,reason?:string,metadata:any={}){
  await db.query(`insert into "lab_integrity_events" ("workspace_id","project_id","event_type","target_type","target_id","actor_user_id","reason","metadata") values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[w,projectId,type,targetType,targetId,u,reason??null,JSON.stringify(metadata)]);
}
export async function assertLabProjectAccess(pool:Pool,w:string,projectId:string,u:string,write=false){
  const p=await pool.query<any>(`select p.*,m."role" from "lab_projects" p left join "lab_project_members" m on m."project_id"=p."id" and m."user_id"=$3 where p."workspace_id"=$1 and p."id"=$2 and p."archived_at" is null`,[w,projectId,u]);
  const x=p.rows[0]; if(!x)throw new Error("LAB_PROJECT_NOT_FOUND");
  if(x.restricted&&!x.role&&x.created_by_user_id!==u)throw new Error("LAB_PROJECT_RESTRICTED");
  if(write&&x.role==="viewer")throw new Error("LAB_PROJECT_READ_ONLY");
  return x;
}
export async function createLabProject(pool:Pool,input:{workspaceId:string;userId:string;name:string;description:string;classification:string;restricted:boolean;requestId?:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const root=await createNode(db,input.workspaceId,input.userId,null,"folder",input.name,{labProject:true,classification:input.classification,restricted:input.restricted});
    for(const section of["ELN","Protocols","Samples","Data"])await createNode(db,input.workspaceId,input.userId,root,"folder",section,{labSection:section.toLowerCase()});
    const r=await db.query<any>(`insert into "lab_projects" ("workspace_id","name","description","classification","restricted","root_node_id","created_by_user_id","updated_by_user_id") values ($1,$2,$3,$4::lab_classification,$5,$6,$7,$7) returning *`,[input.workspaceId,input.name,input.description,input.classification,input.restricted,root,input.userId]);
    await db.query(`insert into "lab_project_members" ("project_id","user_id","role","added_by_user_id") values ($1,$2,'owner',$2)`,[r.rows[0].id,input.userId]);
    await event(db,input.workspaceId,r.rows[0].id,"lab.project_created","lab_project",r.rows[0].id,input.userId,undefined,{classification:input.classification,restricted:input.restricted});
    await appendWorkspaceAudit(db,{workspaceId:input.workspaceId,actorUserId:input.userId,action:"lab.project_created",targetType:"lab_project",targetId:r.rows[0].id,requestId:input.requestId,metadata:{rootNodeId:root}});
    return{...r.rows[0],rootNodeId:root};
  });
}
export async function addLabProjectMember(pool:Pool,input:{workspaceId:string;projectId:string;actorUserId:string;userId:string;role:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const p=await assertLabProjectAccess(pool,input.workspaceId,input.projectId,input.actorUserId,true);
    const member=await db.query(`select 1 from "workspace_members" where "workspace_id"=$1 and "user_id"=$2 and "status"='active'`,[input.workspaceId,input.userId]);
    if(!member.rowCount)throw new Error("USER_NOT_WORKSPACE_MEMBER");
    await db.query(`insert into "lab_project_members" ("project_id","user_id","role","added_by_user_id") values ($1,$2,$3,$4) on conflict ("project_id","user_id") do update set "role"=excluded."role"`,[input.projectId,input.userId,input.role,input.actorUserId]);
    await event(db,input.workspaceId,input.projectId,"lab.project_member_changed","lab_project",input.projectId,input.actorUserId,undefined,{userId:input.userId,role:input.role,classification:p.classification});
  });
}
export async function updateLabProjectStatus(pool:Pool,input:{workspaceId:string;projectId:string;userId:string;status:"planned"|"active"|"paused"|"completed"|"archived";reason:string}){
  return withWorkspaceTransaction(pool,async db=>{
    await assertLabProjectAccess(pool,input.workspaceId,input.projectId,input.userId,true);
    const r=await db.query<any>(`update "lab_projects" set "status"=$4::lab_project_status,"archived_at"=case when $4='archived' then now() else null end,"version"="version"+1,"updated_by_user_id"=$3,"updated_at"=now() where "workspace_id"=$1 and "id"=$2 returning *`,[input.workspaceId,input.projectId,input.userId,input.status]);
    await event(db,input.workspaceId,input.projectId,"lab.project_status","lab_project",input.projectId,input.userId,input.reason,{status:input.status}); return r.rows[0];
  });
}
export async function createLabExperiment(pool:Pool,input:{workspaceId:string;userId:string;projectId:string;title:string;objective:string;hypothesis:string;plannedStartAt?:Date;plannedEndAt?:Date}){
  return withWorkspaceTransaction(pool,async db=>{
    await assertLabProjectAccess(pool,input.workspaceId,input.projectId,input.userId,true);
    const r=await db.query<any>(`insert into "lab_experiments" ("workspace_id","project_id","title","objective","hypothesis","planned_start_at","planned_end_at","created_by_user_id","updated_by_user_id") values ($1,$2,$3,$4,$5,$6,$7,$8,$8) returning *`,[input.workspaceId,input.projectId,input.title,input.objective,input.hypothesis,input.plannedStartAt??null,input.plannedEndAt??null,input.userId]);
    await event(db,input.workspaceId,input.projectId,"lab.experiment_created","experiment",r.rows[0].id,input.userId); return r.rows[0];
  });
}
export async function updateLabExperimentStatus(pool:Pool,input:{workspaceId:string;experimentId:string;userId:string;status:"planned"|"running"|"completed"|"failed"|"cancelled";reason:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const e=await db.query<any>(`select * from "lab_experiments" where "workspace_id"=$1 and "id"=$2 for update`,[input.workspaceId,input.experimentId]); if(!e.rows[0])throw new Error("EXPERIMENT_NOT_FOUND");
    await assertLabProjectAccess(pool,input.workspaceId,e.rows[0].project_id,input.userId,true);
    const r=await db.query<any>(`update "lab_experiments" set "status"=$4::experiment_status,"version"="version"+1,"updated_by_user_id"=$3,"updated_at"=now() where "workspace_id"=$1 and "id"=$2 returning *`,[input.workspaceId,input.experimentId,input.userId,input.status]);
    await event(db,input.workspaceId,e.rows[0].project_id,"lab.experiment_status","experiment",input.experimentId,input.userId,input.reason,{status:input.status}); return r.rows[0];
  });
}
export async function createElnEntry(pool:Pool,input:{workspaceId:string;userId:string;projectId:string;experimentId?:string;title:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const p=await assertLabProjectAccess(pool,input.workspaceId,input.projectId,input.userId,true);
    if(input.experimentId){const e=await db.query(`select 1 from "lab_experiments" where "workspace_id"=$1 and "project_id"=$2 and "id"=$3`,[input.workspaceId,input.projectId,input.experimentId]);if(!e.rowCount)throw new Error("EXPERIMENT_NOT_FOUND");}
    const nodeId=await createNode(db,input.workspaceId,input.userId,p.root_node_id,"lab_record",input.title,{labRole:"eln",projectId:input.projectId},{type:"doc",blocks:[{id:randomUUID(),type:"heading",level:1,text:input.title},{id:randomUUID(),type:"heading",level:2,text:"Objective / hypothesis"},{id:randomUUID(),type:"paragraph",text:""},{id:randomUUID(),type:"heading",level:2,text:"Materials & methods"},{id:randomUUID(),type:"paragraph",text:""},{id:randomUUID(),type:"heading",level:2,text:"Results / observations"},{id:randomUUID(),type:"paragraph",text:""}]});
    const r=await db.query<any>(`insert into "eln_entries" ("workspace_id","project_id","experiment_id","node_id","title","created_by_user_id","updated_by_user_id") values ($1,$2,$3,$4,$5,$6,$6) returning *`,[input.workspaceId,input.projectId,input.experimentId??null,nodeId,input.title,input.userId]);
    await event(db,input.workspaceId,input.projectId,"eln.created","eln_entry",r.rows[0].id,input.userId,undefined,{nodeId});return{...r.rows[0],nodeId};
  });
}
export async function addElnObservation(pool:Pool,input:{workspaceId:string;entryId:string;userId:string;text:string;kind:string;observedAt?:Date;structured:any}){
  const entry=await pool.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2`,[input.workspaceId,input.entryId]);if(!entry.rows[0])throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,input.workspaceId,entry.rows[0].project_id,input.userId,true);if(entry.rows[0].status!=="draft")throw new Error("ELN_READ_ONLY");
  const r=await pool.query<any>(`insert into "eln_observations" ("workspace_id","entry_id","kind","text","structured","observed_at","created_by_user_id") values ($1,$2,$3,$4,$5::jsonb,$6,$7) returning *`,[input.workspaceId,input.entryId,input.kind,input.text,JSON.stringify(input.structured),input.observedAt??new Date(),input.userId]);return r.rows[0];
}
export async function linkElnRecord(pool:Pool,input:{workspaceId:string;entryId:string;userId:string;targetType:string;targetId:string;label?:string}){
  const entry=await pool.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2`,[input.workspaceId,input.entryId]);if(!entry.rows[0])throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,input.workspaceId,entry.rows[0].project_id,input.userId,true);if(entry.rows[0].status!=="draft")throw new Error("ELN_READ_ONLY");
  await pool.query(`insert into "eln_links" ("entry_id","target_type","target_id","label","created_by_user_id") values ($1,$2,$3,$4,$5) on conflict do nothing`,[input.entryId,input.targetType,input.targetId,input.label??null,input.userId]);
}
async function documentHash(db:PoolClient,w:string,nodeId:string){const d=await db.query<any>(`select "body","revision" from "documents" where "workspace_id"=$1 and "node_id"=$2`,[w,nodeId]);if(!d.rows[0])throw new Error("DOCUMENT_NOT_FOUND");return createHash("sha256").update(JSON.stringify({body:d.rows[0].body,revision:d.rows[0].revision,nodeId})).digest("hex");}
export async function signElnEntry(pool:Pool,input:{workspaceId:string;entryId:string;userId:string;reason:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const e=await db.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2 for update`,[input.workspaceId,input.entryId]);const x=e.rows[0];if(!x)throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,input.workspaceId,x.project_id,input.userId,true);if(x.status==="signed")return x;
    const hash=await documentHash(db,input.workspaceId,x.node_id);
    await db.query(`insert into "eln_signatures" ("entry_id","workspace_id","signature_type","content_hash","reason","signed_by_user_id") values ($1,$2,'author',$3,$4,$5)`,[input.entryId,input.workspaceId,hash,input.reason,input.userId]);
    const r=await db.query<any>(`update "eln_entries" set "status"='signed',"signed_at"=now(),"signed_by_user_id"=$3,"content_hash"=$4,"version"="version"+1,"updated_by_user_id"=$3,"updated_at"=now() where "workspace_id"=$1 and "id"=$2 returning *`,[input.workspaceId,input.entryId,input.userId,hash]);
    await event(db,input.workspaceId,x.project_id,"eln.signed","eln_entry",input.entryId,input.userId,input.reason,{contentHash:hash});return r.rows[0];
  });
}
export async function witnessElnEntry(pool:Pool,input:{workspaceId:string;entryId:string;userId:string;reason:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const e=await db.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2 for update`,[input.workspaceId,input.entryId]);const x=e.rows[0];if(!x)throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,input.workspaceId,x.project_id,input.userId,true);if(x.status!=="signed"||!x.content_hash)throw new Error("ELN_NOT_SIGNED");if(x.signed_by_user_id===input.userId)throw new Error("ELN_WITNESS_MUST_DIFFER");
    if(x.witnessed_at)return x;const nowHash=await documentHash(db,input.workspaceId,x.node_id);if(nowHash!==x.content_hash)throw new Error("ELN_SIGNATURE_HASH_MISMATCH");
    await db.query(`insert into "eln_signatures" ("entry_id","workspace_id","signature_type","content_hash","reason","signed_by_user_id") values ($1,$2,'witness',$3,$4,$5)`,[input.entryId,input.workspaceId,nowHash,input.reason,input.userId]);
    const r=await db.query<any>(`update "eln_entries" set "witnessed_at"=now(),"witnessed_by_user_id"=$3,"version"="version"+1,"updated_by_user_id"=$3,"updated_at"=now() where "workspace_id"=$1 and "id"=$2 returning *`,[input.workspaceId,input.entryId,input.userId]);
    await event(db,input.workspaceId,x.project_id,"eln.witnessed","eln_entry",input.entryId,input.userId,input.reason,{contentHash:nowHash});return r.rows[0];
  });
}
export async function amendElnEntry(pool:Pool,input:{workspaceId:string;entryId:string;userId:string;reason:string;title:string;body:string}){
  return withWorkspaceTransaction(pool,async db=>{
    const e=await db.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2`,[input.workspaceId,input.entryId]);const x=e.rows[0];if(!x)throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,input.workspaceId,x.project_id,input.userId,true);if(x.status!=="signed")throw new Error("ELN_NOT_SIGNED");
    const nodeId=await createNode(db,input.workspaceId,input.userId,null,"lab_record",input.title,{labRole:"eln-amendment",entryId:input.entryId},{type:"doc",blocks:[{id:randomUUID(),type:"heading",level:2,text:input.title},{id:randomUUID(),type:"paragraph",text:input.body}]});
    const r=await db.query<any>(`insert into "eln_amendments" ("workspace_id","entry_id","node_id","reason","created_by_user_id") values ($1,$2,$3,$4,$5) returning *`,[input.workspaceId,input.entryId,nodeId,input.reason,input.userId]);
    await event(db,input.workspaceId,x.project_id,"eln.amended","eln_entry",input.entryId,input.userId,input.reason,{amendmentId:r.rows[0].id,nodeId});return{...r.rows[0],nodeId};
  });
}
export async function getElnEntry(pool:Pool,w:string,id:string,u:string){
  const e=await pool.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "id"=$2`,[w,id]);const x=e.rows[0];if(!x)throw new Error("ELN_NOT_FOUND");await assertLabProjectAccess(pool,w,x.project_id,u,false);
  const[obs,links,sigs,amend]=await Promise.all([pool.query<any>(`select * from "eln_observations" where "workspace_id"=$1 and "entry_id"=$2 order by "observed_at","id"`,[w,id]),pool.query<any>(`select * from "eln_links" where "entry_id"=$1 order by "created_at"`,[id]),pool.query<any>(`select * from "eln_signatures" where "workspace_id"=$1 and "entry_id"=$2 order by "signed_at"`,[w,id]),pool.query<any>(`select * from "eln_amendments" where "workspace_id"=$1 and "entry_id"=$2 order by "created_at"`,[w,id])]);return{entry:x,observations:obs.rows,links:links.rows,signatures:sigs.rows,amendments:amend.rows};
}
export async function listLabProjects(pool:Pool,w:string,u:string){
  const r=await pool.query<any>(`select p.*,m."role",count(distinct e."id")::int as "experiment_count",count(distinct en."id")::int as "eln_count" from "lab_projects" p left join "lab_project_members" m on m."project_id"=p."id" and m."user_id"=$2 left join "lab_experiments" e on e."project_id"=p."id" left join "eln_entries" en on en."project_id"=p."id" where p."workspace_id"=$1 and p."archived_at" is null and (not p."restricted" or p."created_by_user_id"=$2 or m."user_id"=$2) group by p."id",m."role" order by p."updated_at" desc,p."id"`,[w,u]);return r.rows;
}
export async function labProjectDetail(pool:Pool,w:string,id:string,u:string){
  const p=await assertLabProjectAccess(pool,w,id,u,false);const[experiments,eln,members]=await Promise.all([pool.query<any>(`select * from "lab_experiments" where "workspace_id"=$1 and "project_id"=$2 order by "updated_at" desc`,[w,id]),pool.query<any>(`select * from "eln_entries" where "workspace_id"=$1 and "project_id"=$2 order by "created_at" desc`,[w,id]),pool.query<any>(`select m.*,u."external_auth_id" from "lab_project_members" m join "users" u on u."id"=m."user_id" where m."project_id"=$1 order by m."role",m."created_at"`,[id])]);return{project:p,experiments:experiments.rows,elnEntries:eln.rows,members:members.rows};
}