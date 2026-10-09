import { randomUUID } from "node:crypto";
import type { Pool,PoolClient } from "pg";
import type { PortableManifest } from "./portable-archive-store.js";
import { withWorkspaceTransaction } from "./workspace-store-common.js";

export type TransferFidelity="native_editable"|"partially_editable"|"preview_only"|"portable_archive";
export type TransferRecordInternal={
 id:string;workspaceId:string;kind:"import"|"export";durableJobId:string|null;requestedByUserId:string;
 sourceNodeId:string|null;sourceAssetId:string|null;destinationParentId:string|null;format:string;fidelity:TransferFidelity;
 options:Record<string,unknown>;artifactObjectKey:string|null;artifactFilename:string|null;artifactMime:string|null;
 manifestVersion:string|null;resultRootNodeIds:string[];jobStatus:string|null;progress:Record<string,unknown>;createdAt:Date;updatedAt:Date;
};

async function enqueue(c:PoolClient,input:{workspaceId:string;jobType:string;payload:Record<string,unknown>;dedupeKey:string;}){
 const r=await c.query<{id:string}>(`insert into "durable_jobs" ("workspace_id","queue","job_type","dedupe_key","payload","max_attempts") values ($1,'transfer',$2,$3,$4::jsonb,8) returning "id"`,[input.workspaceId,input.jobType,input.dedupeKey,JSON.stringify(input.payload)]);
 if(!r.rows[0])throw new Error("DURABLE_JOB_CREATE_FAILED");return r.rows[0].id;
}
function mapTransfer(r:any):TransferRecordInternal{return{
 id:r.id,workspaceId:r.workspace_id,kind:r.kind,durableJobId:r.durable_job_id,requestedByUserId:r.requested_by_user_id,
 sourceNodeId:r.source_node_id,sourceAssetId:r.source_asset_id,destinationParentId:r.destination_parent_id,format:r.format,fidelity:r.fidelity,
 options:r.options??{},artifactObjectKey:r.artifact_object_key,artifactFilename:r.artifact_filename,artifactMime:r.artifact_mime,
 manifestVersion:r.manifest_version,resultRootNodeIds:Array.isArray(r.result_root_node_ids)?r.result_root_node_ids:[],
 jobStatus:r.job_status??null,progress:r.progress??{},createdAt:r.created_at,updatedAt:r.updated_at
};}
async function getTransferDb(db:Pool|PoolClient,w:string,id:string){
 const r=await db.query<any>(`select t.*,j."status"::text as "job_status",j."progress" from "transfer_records" t left join "durable_jobs" j on j."id"=t."durable_job_id" where t."workspace_id"=$1 and t."id"=$2 limit 1`,[w,id]);
 if(!r.rows[0])throw new Error("TRANSFER_NOT_FOUND");return mapTransfer(r.rows[0]);
}
export async function getTransfer(pool:Pool,w:string,id:string){return getTransferDb(pool,w,id);}
export async function listTransfers(pool:Pool,w:string,limit=100){const r=await pool.query<any>(`select t.*,j."status"::text as "job_status",j."progress" from "transfer_records" t left join "durable_jobs" j on j."id"=t."durable_job_id" where t."workspace_id"=$1 order by t."created_at" desc,t."id" desc limit $2`,[w,Math.min(Math.max(limit,1),200)]);return r.rows.map(mapTransfer);}

function classify(filename:string,mime:string,hint?:string):{format:string;fidelity:TransferFidelity}{
 const lower=filename.toLowerCase(),h=hint?.toLowerCase();
 if(h==="nexosophy"||lower.endsWith(".nexo.json"))return{format:"nexosophy",fidelity:"portable_archive"};
 if(h==="zip"||lower.endsWith(".nexo.zip"))return{format:"zip",fidelity:"portable_archive"};
 if(lower.endsWith(".md")||mime==="text/markdown")return{format:"markdown",fidelity:"native_editable"};
 if(lower.endsWith(".txt")||mime==="text/plain")return{format:"text",fidelity:"native_editable"};
 if(lower.endsWith(".csv")||mime==="text/csv")return{format:"csv",fidelity:"partially_editable"};
 if(lower.endsWith(".bib"))return{format:"bibtex",fidelity:"native_editable"};
 if(lower.endsWith(".ris"))return{format:"ris",fidelity:"native_editable"};
 if(lower.endsWith(".pdf")||mime==="application/pdf")return{format:"pdf",fidelity:"preview_only"};
 if(lower.endsWith(".docx"))return{format:"docx",fidelity:"preview_only"};
 if(lower.endsWith(".pptx"))return{format:"pptx",fidelity:"preview_only"};
 if(lower.endsWith(".xlsx")||lower.endsWith(".xls"))return{format:"xlsx",fidelity:"preview_only"};
 if(mime.startsWith("image/"))return{format:"image",fidelity:"preview_only"};
 if(mime.startsWith("audio/"))return{format:"audio",fidelity:"preview_only"};
 if(mime.startsWith("video/"))return{format:"video",fidelity:"preview_only"};
 return{format:"binary",fidelity:"preview_only"};
}
export async function listImportableAssets(pool:Pool,w:string){
 const r=await pool.query<any>(`select "id","node_id","original_filename","declared_mime","detected_mime","size_bytes","updated_at" from "assets" where "workspace_id"=$1 and "trust_state"='trusted' and "deleted_at" is null order by "updated_at" desc limit 200`,[w]);
 return r.rows.map((x:any)=>({id:x.id,nodeId:x.node_id,originalFilename:x.original_filename,mimeType:x.detected_mime??x.declared_mime,sizeBytes:Number(x.size_bytes),updatedAt:x.updated_at}));
}
export async function getImportAssetStorage(pool:Pool,w:string,id:string){
 const r=await pool.query<any>(`select "object_key","original_filename","declared_mime","detected_mime","size_bytes","node_id","trust_state"::text as "trust_state" from "assets" where "workspace_id"=$1 and "id"=$2 and "deleted_at" is null limit 1`,[w,id]);
 const x=r.rows[0];if(!x||x.trust_state!=="trusted")throw new Error("IMPORT_ASSET_NOT_TRUSTED");
 return{objectKey:x.object_key,originalFilename:x.original_filename,mimeType:x.detected_mime??x.declared_mime,sizeBytes:Number(x.size_bytes),nodeId:x.node_id};
}
export async function createImportTransfer(pool:Pool,input:{workspaceId:string;assetId:string;destinationParentId:string|null;actorUserId:string;formatHint?:string;}){
 const a=await getImportAssetStorage(pool,input.workspaceId,input.assetId),c=classify(a.originalFilename,a.mimeType,input.formatHint);
 return withWorkspaceTransaction(pool,async db=>{const id=randomUUID(),job=await enqueue(db,{workspaceId:input.workspaceId,jobType:"import",payload:{transferId:id},dedupeKey:"import:"+id});await db.query(`insert into "transfer_records" ("id","workspace_id","kind","durable_job_id","requested_by_user_id","source_asset_id","destination_parent_id","format","fidelity") values ($1,$2,'import',$3,$4,$5,$6,$7,$8::transfer_fidelity)`,[id,input.workspaceId,job,input.actorUserId,input.assetId,input.destinationParentId,c.format,c.fidelity]);return getTransferDb(db,input.workspaceId,id);});
}
export async function createExportTransfer(pool:Pool,input:{workspaceId:string;actorUserId:string;scope:"node"|"workspace";nodeId?:string;format:"nexosophy"|"zip"|"markdown"|"html"|"pdf";includeRelations:boolean;}){
 if(input.scope==="node"&&!input.nodeId)throw new Error("EXPORT_NODE_REQUIRED");
 const fidelity:TransferFidelity=input.format==="nexosophy"||input.format==="zip"?"portable_archive":input.format==="pdf"?"preview_only":"partially_editable";
 return withWorkspaceTransaction(pool,async db=>{if(input.nodeId){const q=await db.query(`select 1 from "content_nodes" where "workspace_id"=$1 and "id"=$2 and "trashed_at" is null`,[input.workspaceId,input.nodeId]);if(!(q.rowCount??0))throw new Error("EXPORT_SOURCE_NOT_FOUND");}
 const id=randomUUID(),job=await enqueue(db,{workspaceId:input.workspaceId,jobType:"export",payload:{transferId:id},dedupeKey:"export:"+id});
 await db.query(`insert into "transfer_records" ("id","workspace_id","kind","durable_job_id","requested_by_user_id","source_node_id","format","fidelity","options","manifest_version") values ($1,$2,'export',$3,$4,$5,$6,$7::transfer_fidelity,$8::jsonb,'nexosophy-archive-v1')`,[id,input.workspaceId,job,input.actorUserId,input.nodeId??null,input.format,fidelity,JSON.stringify({scope:input.scope,includeRelations:input.includeRelations})]);return getTransferDb(db,input.workspaceId,id);});
}
export async function cancelTransfer(pool:Pool,w:string,id:string){const t=await getTransfer(pool,w,id);if(t.durableJobId)await pool.query(`update "durable_jobs" set "status"='cancelled',"locked_at"=null,"locked_by"=null,"updated_at"=now() where "id"=$1 and "workspace_id"=$2 and "status" in ('queued','running','failed')`,[t.durableJobId,w]);}
export async function retryTransfer(pool:Pool,w:string,id:string){const t=await getTransfer(pool,w,id);if(!t.durableJobId)throw new Error("TRANSFER_JOB_NOT_FOUND");await pool.query(`update "durable_jobs" set "status"='queued',"attempts"=0,"run_after"=now(),"locked_at"=null,"locked_by"=null,"last_error_code"=null,"last_error_message"=null,"updated_at"=now() where "id"=$1 and "workspace_id"=$2 and "status" in ('failed','dead_letter','cancelled')`,[t.durableJobId,w]);}
export async function isTransferCancelled(pool:Pool,id:string){const r=await pool.query<{status:string}>(`select j."status"::text as "status" from "transfer_records" t join "durable_jobs" j on j."id"=t."durable_job_id" where t."id"=$1`,[id]);return r.rows[0]?.status==="cancelled";}
export async function completeTransfer(pool:Pool,input:{transferId:string;workspaceId:string;requestedByUserId:string;artifactObjectKey?:string|null;artifactFilename?:string|null;artifactMime?:string|null;resultRootNodeIds?:string[];fidelity?:TransferFidelity;}){
 await withWorkspaceTransaction(pool,async db=>{await db.query(`update "transfer_records" set "artifact_object_key"=coalesce($3,"artifact_object_key"),"artifact_filename"=coalesce($4,"artifact_filename"),"artifact_mime"=coalesce($5,"artifact_mime"),"result_root_node_ids"=$6::jsonb,"fidelity"=coalesce($7::transfer_fidelity,"fidelity"),"updated_at"=now() where "workspace_id"=$1 and "id"=$2`,[input.workspaceId,input.transferId,input.artifactObjectKey??null,input.artifactFilename??null,input.artifactMime??null,JSON.stringify(input.resultRootNodeIds??[]),input.fidelity??null]);await db.query(`insert into "outbox_events" ("workspace_id","aggregate_type","aggregate_id","event_type","payload") values ($1,'transfer',$2,'transfer.completed',$3::jsonb)`,[input.workspaceId,input.transferId,JSON.stringify({transferId:input.transferId,userId:input.requestedByUserId,message:"Import/export completed."})]);});
}
export async function createNativeTextImport(pool:Pool,input:{transferId:string;workspaceId:string;actorUserId:string;destinationParentId:string|null;title:string;text:string;format:string;}){
 return withWorkspaceTransaction(pool,async db=>{const e=await db.query<{new_node_id:string}>(`select "new_node_id" from "transfer_node_map" where "transfer_id"=$1 and "source_node_id"='single'`,[input.transferId]);if(e.rows[0])return e.rows[0].new_node_id;
 const id=randomUUID(),kind=input.format==="bibtex"||input.format==="ris"?"research_item":"document",name=(input.title.trim().slice(0,255)||"Imported document");
 await db.query(`insert into "content_nodes" ("id","workspace_id","parent_id","kind","name","metadata","created_by_user_id","updated_by_user_id") values ($1,$2,$3,$4::content_node_kind,$5,$6::jsonb,$7,$7)`,[id,input.workspaceId,input.destinationParentId,kind,name,JSON.stringify({importedFormat:input.format}),input.actorUserId]);
 const blocks=(input.format==="csv"||input.format==="bibtex"||input.format==="ris")?[{id:randomUUID(),type:"code",text:input.text.slice(0,5_000_000)}]:input.text.split(/\n\s*\n/).slice(0,5000).map(t=>({id:randomUUID(),type:"paragraph",text:t.slice(0,200000)}));
 await db.query(`insert into "documents" ("workspace_id","node_id","body","created_by_user_id","updated_by_user_id") values ($1,$2,$3::jsonb,$4,$4)`,[input.workspaceId,id,JSON.stringify({type:"doc",blocks}),input.actorUserId]);await db.query(`insert into "transfer_node_map" ("transfer_id","source_node_id","new_node_id") values ($1,'single',$2)`,[input.transferId,id]);return id;});
}
export async function movePreviewOnlyImportNode(pool:Pool,input:{transferId:string;workspaceId:string;actorUserId:string;assetNodeId:string|null;destinationParentId:string|null;}){
 if(!input.assetNodeId)return[];const e=await pool.query<{new_node_id:string}>(`select "new_node_id" from "transfer_node_map" where "transfer_id"=$1 and "source_node_id"='single'`,[input.transferId]);if(e.rows[0])return[e.rows[0].new_node_id];
 await withWorkspaceTransaction(pool,async db=>{if(input.destinationParentId)await db.query(`update "content_nodes" set "parent_id"=$3,"version"="version"+1,"updated_by_user_id"=$4,"updated_at"=now() where "workspace_id"=$1 and "id"=$2 and "trashed_at" is null`,[input.workspaceId,input.assetNodeId,input.destinationParentId,input.actorUserId]);await db.query(`insert into "transfer_node_map" ("transfer_id","source_node_id","new_node_id") values ($1,'single',$2) on conflict do nothing`,[input.transferId,input.assetNodeId]);});return[input.assetNodeId];
}

export async function listTemplateCategories(pool:Pool,w:string){const r=await pool.query<any>(`select * from "template_categories" where "workspace_id" is null or "workspace_id"=$1 order by "sort_order","name","id"`,[w]);return r.rows;}
export async function listTemplates(pool:Pool,input:{workspaceId:string;userId:string;scope?:string;categoryId?:string;q?:string;limit?:number;}){
 const r=await pool.query<any>(`select t.*,c."name" as "category_name" from "templates" t left join "template_categories" c on c."id"=t."category_id" where t."archived_at" is null and ((t."scope"='system' and t."status"='published') or (t."scope"='personal' and t."owner_user_id"=$2) or (t."scope"='workspace' and t."workspace_id"=$1 and (t."status"='published' or t."created_by_user_id"=$2))) and ($3='all' or t."scope"::text=$3) and ($4::uuid is null or t."category_id"=$4) and ($5='' or lower(t."name"||' '||t."description") like '%'||lower($5)||'%') order by t."updated_at" desc limit $6`,[input.workspaceId,input.userId,input.scope??"all",input.categoryId??null,input.q??"",Math.min(Math.max(input.limit??30,1),100)]);
 return r.rows.map((x:any)=>({id:x.id,scope:x.scope,workspaceId:x.workspace_id,ownerUserId:x.owner_user_id,categoryId:x.category_id,categoryName:x.category_name??null,name:x.name,description:x.description,status:x.status,currentVersion:x.current_version,roleSuggestions:x.role_suggestions??[],version:x.version,publishedAt:x.published_at,createdAt:x.created_at,updatedAt:x.updated_at}));
}
export async function createTemplateCapture(pool:Pool,input:{workspaceId:string;actorUserId:string;scope:"personal"|"workspace";categoryId?:string;name:string;description:string;sourceNodeId:string;roleSuggestions:string[];variables:any[];publish:boolean;}){
 return withWorkspaceTransaction(pool,async db=>{const s=await db.query(`select 1 from "content_nodes" where "workspace_id"=$1 and "id"=$2 and "trashed_at" is null`,[input.workspaceId,input.sourceNodeId]);if(!(s.rowCount??0))throw new Error("TEMPLATE_SOURCE_NOT_FOUND");
 const t=await db.query<{id:string}>(`insert into "templates" ("scope","workspace_id","owner_user_id","category_id","name","description","source_node_id","role_suggestions","created_by_user_id","updated_by_user_id") values ($1::template_scope,case when $1='workspace' then $2 else null end,case when $1='personal' then $3 else null end,$4,$5,$6,$7,$8::jsonb,$3,$3) returning "id"`,[input.scope,input.workspaceId,input.actorUserId,input.categoryId??null,input.name,input.description,input.sourceNodeId,JSON.stringify(input.roleSuggestions)]);const templateId=t.rows[0]!.id;const jobId=await enqueue(db,{workspaceId:input.workspaceId,jobType:"capture_template",payload:{templateId,sourceNodeId:input.sourceNodeId,variables:input.variables,publish:input.publish,actorUserId:input.actorUserId},dedupeKey:"template-capture:"+templateId+":1"});return{templateId,jobId};});
}
export async function saveTemplateVersion(pool:Pool,input:{templateId:string;actorUserId:string;manifest:PortableManifest;variables:any[];publish:boolean;}){
 return withWorkspaceTransaction(pool,async db=>{const t=await db.query<{current_version:number}>(`select "current_version" from "templates" where "id"=$1 for update`,[input.templateId]);if(!t.rows[0])throw new Error("TEMPLATE_NOT_FOUND");const v=Number(t.rows[0].current_version)+1;
 const vr=await db.query<{id:string}>(`insert into "template_versions" ("template_id","version","snapshot","created_by_user_id") values ($1,$2,$3::jsonb,$4) returning "id"`,[input.templateId,v,JSON.stringify(input.manifest),input.actorUserId]);for(const [i,x] of input.variables.slice(0,100).entries())await db.query(`insert into "template_variables" ("template_version_id","key","label","type","required","default_value","options","sort_order") values ($1,$2,$3,$4::template_variable_type,$5,$6::jsonb,$7::jsonb,$8)`,[vr.rows[0]!.id,String(x.key??"").slice(0,80),String(x.label??x.key??"").slice(0,120),String(x.type??"text"),Boolean(x.required),x.defaultValue===undefined?null:JSON.stringify(x.defaultValue),JSON.stringify(Array.isArray(x.options)?x.options.slice(0,100):[]),i]);
 await db.query(`update "templates" set "current_version"=$2,"status"=case when $3 then 'published'::template_status else "status" end,"published_at"=case when $3 then coalesce("published_at",now()) else "published_at" end,"updated_by_user_id"=$4,"updated_at"=now(),"version"="version"+1 where "id"=$1`,[input.templateId,v,input.publish,input.actorUserId]);return v;});
}
export async function getTemplateDetail(pool:Pool,input:{workspaceId:string;userId:string;templateId:string;version?:number;}){
 const t=await pool.query<any>(`select t.*,c."name" as "category_name" from "templates" t left join "template_categories" c on c."id"=t."category_id" where t."id"=$3 and t."archived_at" is null and ((t."scope"='system' and t."status"='published') or (t."scope"='personal' and t."owner_user_id"=$2) or (t."scope"='workspace' and t."workspace_id"=$1))`,[input.workspaceId,input.userId,input.templateId]);if(!t.rows[0])throw new Error("TEMPLATE_NOT_FOUND");const x=t.rows[0],version=input.version??x.current_version;if(!version)return{template:x,version:null,variables:[],preview:[]};
 const v=await pool.query<any>(`select * from "template_versions" where "template_id"=$1 and "version"=$2`,[input.templateId,version]);if(!v.rows[0])throw new Error("TEMPLATE_VERSION_NOT_FOUND");const vars=await pool.query<any>(`select "key","label","type"::text as "type","required","default_value","options" from "template_variables" where "template_version_id"=$1 order by "sort_order","key"`,[v.rows[0].id]);const snap=v.rows[0].snapshot as PortableManifest;
 return{template:{id:x.id,scope:x.scope,workspaceId:x.workspace_id,ownerUserId:x.owner_user_id,categoryId:x.category_id,categoryName:x.category_name??null,name:x.name,description:x.description,status:x.status,currentVersion:x.current_version,roleSuggestions:x.role_suggestions??[],version:x.version,publishedAt:x.published_at,createdAt:x.created_at,updatedAt:x.updated_at},version:{id:v.rows[0].id,version:v.rows[0].version,manifestVersion:v.rows[0].manifest_version,createdAt:v.rows[0].created_at},variables:vars.rows.map((z:any)=>({key:z.key,label:z.label,type:z.type,required:z.required,defaultValue:z.default_value,options:z.options??[]})),preview:snap.nodes.slice(0,50).map(n=>({id:n.id,parentId:n.parentId,kind:n.kind,name:n.name}))};
}
export async function instantiateTemplate(pool:Pool,input:{workspaceId:string;userId:string;templateId:string;destinationParentId:string|null;values:Record<string,unknown>;version?:number;}){
 const d=await getTemplateDetail(pool,input);if(!d.version)throw new Error("TEMPLATE_NOT_READY");const values={...input.values};for(const v of d.variables as any[]){if(values[v.key]===undefined&&v.defaultValue!==null)values[v.key]=v.defaultValue;if(v.required&&(values[v.key]===undefined||values[v.key]===""))throw new Error("TEMPLATE_VARIABLE_REQUIRED:"+v.key);}
 return withWorkspaceTransaction(pool,async db=>{const usageId=randomUUID(),jobId=await enqueue(db,{workspaceId:input.workspaceId,jobType:"instantiate_template",payload:{usageId},dedupeKey:"template-instantiate:"+usageId});await db.query(`insert into "template_usage" ("id","template_id","template_version_id","workspace_id","requested_by_user_id","destination_parent_id","durable_job_id","variable_values") values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[usageId,input.templateId,d.version.id,input.workspaceId,input.userId,input.destinationParentId,jobId,JSON.stringify(values)]);return{usageId,jobId};});
}
export async function loadTemplateSnapshotForUsage(pool:Pool,usageId:string){const r=await pool.query<any>(`select u.*,v."snapshot" from "template_usage" u join "template_versions" v on v."id"=u."template_version_id" where u."id"=$1`,[usageId]);if(!r.rows[0])throw new Error("TEMPLATE_USAGE_NOT_FOUND");return{usage:r.rows[0],manifest:r.rows[0].snapshot as PortableManifest};}
export async function completeTemplateUsage(pool:Pool,input:{usageId:string;workspaceId:string;userId:string;rootNodeIds:string[];}){await withWorkspaceTransaction(pool,async db=>{await db.query(`update "template_usage" set "root_node_ids"=$2::jsonb where "id"=$1`,[input.usageId,JSON.stringify(input.rootNodeIds)]);await db.query(`insert into "outbox_events" ("workspace_id","aggregate_type","aggregate_id","event_type","payload") values ($1,'template_usage',$2,'template.instantiated',$3::jsonb)`,[input.workspaceId,input.usageId,JSON.stringify({usageId:input.usageId,userId:input.userId,rootNodeIds:input.rootNodeIds,message:"Template is ready."})]);});}
