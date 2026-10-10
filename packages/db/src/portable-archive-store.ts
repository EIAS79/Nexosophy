import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { withWorkspaceTransaction } from "./workspace-store-common.js";

export type PortableNode = {
  id:string; parentId:string|null; kind:string; name:string;
  metadata:Record<string,unknown>;
  richDocument?:Record<string,unknown>|null;
  spatialDocument?:Record<string,unknown>|null;
  spatialElements:Array<Record<string,unknown>>;
  tags:string[];
  asset?:{originalFilename:string;mimeType:string;sizeBytes:number;included:false}|null;
};
export type PortableRelation = {
  fromNodeId:string; toNodeId:string; type:string; label:string|null; metadata:Record<string,unknown>;
};
export type PortableManifest = {
  format:"nexosophy-archive"; version:1; exportedAt:string;
  source:{scope:"node"|"workspace"|"template";sourceNodeId:string|null};
  fidelity:"portable_archive";
  redactions:string[];
  nodes:PortableNode[]; relations:PortableRelation[];
};

const allowedKinds=new Set(["folder","note","document","whiteboard","dataset","spreadsheet","notebook","report","research_item","lab_record","attachment","shortcut"]);
const relationTypes=new Set(["related","references","supports","depends_on","contradicts","duplicates","derived_from"]);
const redacted=new Set(["objectkey","object_key","checksumsha256","checksum_sha256","authorization","cookie","password","secret","token","accesstoken","refreshtoken","storageuploadid","storage_upload_id"]);

function safeUrl(value:string):string|null{
  try{const u=new URL(value);return ["https:","http:","mailto:"].includes(u.protocol)?u.toString():null;}catch{return null;}
}
export function sanitizePortableValue(value:unknown,depth=0):unknown{
  if(depth>12)return "[truncated]";
  if(Array.isArray(value))return value.slice(0,20000).map(v=>sanitizePortableValue(v,depth+1));
  if(value&&typeof value==="object"){
    const out:Record<string,unknown>={};
    for(const [k,v] of Object.entries(value as Record<string,unknown>).slice(0,20000)){
      const n=k.toLowerCase();
      if(redacted.has(n))continue;
      if(n==="assetid"||n==="asset_id"){out[k]=null;out.missingAssetReference=true;continue;}
      if((n==="url"||n==="href"||n.endsWith("url"))&&typeof v==="string"){out[k]=safeUrl(v);continue;}
      out[k]=sanitizePortableValue(v,depth+1);
    }
    return out;
  }
  if(typeof value==="string")return value.slice(0,2_000_000);
  if(value===null||typeof value==="number"||typeof value==="boolean")return value;
  return null;
}

export async function buildPortableManifest(pool:Pool,input:{
  workspaceId:string;rootNodeId?:string|null;scope?:"node"|"workspace"|"template";includeRelations?:boolean;
}):Promise<PortableManifest>{
  const root=input.rootNodeId??null;
  const cte=root
    ? `with recursive selected as (
         select n.*,0 as depth from "content_nodes" n
         where n."workspace_id"=$1 and n."id"=$2 and n."trashed_at" is null
         union all
         select c.*,p.depth+1 from "content_nodes" c join selected p on c."parent_id"=p."id"
         where c."workspace_id"=$1 and c."trashed_at" is null
       )`
    : `with recursive selected as (
         select n.*,0 as depth from "content_nodes" n
         where n."workspace_id"=$1 and n."parent_id" is null and n."trashed_at" is null
         union all
         select c.*,p.depth+1 from "content_nodes" c join selected p on c."parent_id"=p."id"
         where c."workspace_id"=$1 and c."trashed_at" is null
       )`;
  const selected=await pool.query<any>(
    cte+` select "id","parent_id","kind"::text as "kind","name","metadata",depth
           from selected order by depth,"created_at","id" limit 20001`,
    root?[input.workspaceId,root]:[input.workspaceId]
  );
  if(!selected.rows.length)throw new Error("EXPORT_SOURCE_NOT_FOUND");
  if(selected.rows.length>20000)throw new Error("EXPORT_NODE_LIMIT_EXCEEDED");
  const ids=selected.rows.map((r:any)=>r.id);
  const [docs,spatial,elements,tags,assets]=await Promise.all([
    pool.query<any>(`select "node_id","body" from "documents" where "workspace_id"=$1 and "node_id"=any($2::uuid[])`,[input.workspaceId,ids]),
    pool.query<any>(`select "node_id","page_mode"::text as "page_mode","background_kind"::text as "background_kind","paper_size","orientation","settings" from "spatial_documents" where "workspace_id"=$1 and "node_id"=any($2::uuid[])`,[input.workspaceId,ids]),
    pool.query<any>(`select "id","node_id","type"::text as "type","x","y","width","height","rotation","z_rank","group_id","locked","payload" from "spatial_elements" where "workspace_id"=$1 and "node_id"=any($2::uuid[]) order by "node_id","z_rank","id"`,[input.workspaceId,ids]),
    pool.query<any>(`select nt."node_id",t."name" from "content_node_tags" nt join "workspace_tags" t on t."id"=nt."tag_id" where nt."workspace_id"=$1 and nt."node_id"=any($2::uuid[]) order by nt."node_id",t."normalized_name"`,[input.workspaceId,ids]),
    pool.query<any>(`select "node_id","original_filename","declared_mime","detected_mime","size_bytes" from "assets" where "workspace_id"=$1 and "node_id"=any($2::uuid[]) and "trust_state"<>'deleted'`,[input.workspaceId,ids]),
  ]);
  const docMap=new Map(docs.rows.map((r:any)=>[r.node_id,r.body]));
  const spatialMap=new Map(spatial.rows.map((r:any)=>[r.node_id,{pageMode:r.page_mode,backgroundKind:r.background_kind,paperSize:r.paper_size,orientation:r.orientation,settings:sanitizePortableValue(r.settings??{})}]));
  const elemMap=new Map<string,any[]>();for(const r of elements.rows){const a=elemMap.get(r.node_id)??[];a.push({id:r.id,type:r.type,x:Number(r.x),y:Number(r.y),width:Number(r.width),height:Number(r.height),rotation:Number(r.rotation),zRank:Number(r.z_rank),groupId:r.group_id,locked:Boolean(r.locked),payload:sanitizePortableValue(r.payload??{})});elemMap.set(r.node_id,a);}
  const tagMap=new Map<string,string[]>();for(const r of tags.rows){const a=tagMap.get(r.node_id)??[];a.push(r.name);tagMap.set(r.node_id,a);}
  const assetMap=new Map<string,any>();for(const r of assets.rows){if(r.node_id)assetMap.set(r.node_id,{originalFilename:r.original_filename,mimeType:r.detected_mime??r.declared_mime,sizeBytes:Number(r.size_bytes),included:false});}
  const idSet=new Set(ids);
  const nodes:PortableNode[]=selected.rows.map((r:any)=>({
    id:r.id,parentId:r.parent_id&&idSet.has(r.parent_id)?r.parent_id:null,kind:r.kind,name:r.name,
    metadata:sanitizePortableValue(r.metadata??{}) as Record<string,unknown>,
    richDocument:docMap.has(r.id)?sanitizePortableValue(docMap.get(r.id)) as Record<string,unknown>:null,
    spatialDocument:(spatialMap.get(r.id) as Record<string,unknown>|undefined)??null,
    spatialElements:elemMap.get(r.id)??[],tags:tagMap.get(r.id)??[],asset:assetMap.get(r.id)??null
  }));
  let relations:PortableRelation[]=[];
  if(input.includeRelations!==false){
    const rr=await pool.query<any>(`select "from_node_id","to_node_id","relation_type"::text as "relation_type","label","metadata" from "content_relations" where "workspace_id"=$1 and "from_node_id"=any($2::uuid[]) and "to_node_id"=any($2::uuid[]) order by "created_at","id"`,[input.workspaceId,ids]);
    relations=rr.rows.map((r:any)=>({fromNodeId:r.from_node_id,toNodeId:r.to_node_id,type:r.relation_type,label:r.label,metadata:sanitizePortableValue(r.metadata??{}) as Record<string,unknown>}));
  }
  return {format:"nexosophy-archive",version:1,exportedAt:new Date().toISOString(),source:{scope:input.scope??(root?"node":"workspace"),sourceNodeId:root},fidelity:"portable_archive",redactions:["storage credentials/object keys","checksums","session/auth secrets","audit/history/trash activity","binary asset bytes","stale asset IDs"],nodes,relations};
}

function replaceVars(value:unknown,values:Record<string,unknown>):unknown{
  if(Array.isArray(value))return value.map(v=>replaceVars(v,values));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,replaceVars(v,values)]));
  if(typeof value!=="string")return value;
  const exact=value.match(/^\{\{([A-Za-z][A-Za-z0-9_.-]{0,79})\}\}$/);
  if(exact&&Object.hasOwn(values,exact[1]!))return values[exact[1]!];
  return value.replace(/\{\{([A-Za-z][A-Za-z0-9_.-]{0,79})\}\}/g,(_m,k:string)=>Object.hasOwn(values,k)?String(values[k]??""):"");
}
export function applyTemplateVariables(manifest:PortableManifest,values:Record<string,unknown>):PortableManifest{return replaceVars(manifest,values) as PortableManifest;}

type MapMode={type:"transfer"|"template";id:string};
async function mapGet(c:PoolClient,m:MapMode,source:string){
  const table=m.type==="transfer"?"transfer_node_map":"template_usage_node_map";
  const owner=m.type==="transfer"?"transfer_id":"usage_id";
  const r=await c.query<{new_node_id:string}>(`select "new_node_id" from "${table}" where "${owner}"=$1 and "source_node_id"=$2`,[m.id,source]);
  return r.rows[0]?.new_node_id??null;
}
async function mapPut(c:PoolClient,m:MapMode,source:string,target:string){
  const table=m.type==="transfer"?"transfer_node_map":"template_usage_node_map";
  const owner=m.type==="transfer"?"transfer_id":"usage_id";
  await c.query(`insert into "${table}" ("${owner}","source_node_id","new_node_id") values ($1,$2,$3) on conflict do nothing`,[m.id,source,target]);
}
async function uniqueName(c:PoolClient,w:string,p:string|null,desired:string){
  const base=desired.trim().slice(0,255)||"Imported item";
  for(let i=0;i<1000;i++){
    const name=i===0?base:(base.slice(0,230)+" (imported "+i+")").slice(0,255);
    const r=await c.query(`select 1 from "content_nodes" where "workspace_id"=$1 and "parent_id" is not distinct from $2::uuid and lower(trim("name"))=lower(trim($3)) and "trashed_at" is null limit 1`,[w,p,name]);
    if(!(r.rowCount??0))return name;
  }
  throw new Error("IMPORT_NAME_COLLISION_LIMIT");
}

export async function instantiatePortableNode(pool:Pool,input:{mode:MapMode;workspaceId:string;actorUserId:string;destinationParentId:string|null;node:PortableNode;}){
  return withWorkspaceTransaction(pool,async c=>{
    const existing=await mapGet(c,input.mode,input.node.id);if(existing)return {nodeId:existing,reused:true};
    let parent=input.destinationParentId;if(input.node.parentId){parent=await mapGet(c,input.mode,input.node.parentId);if(!parent)throw new Error("IMPORT_PARENT_NOT_READY");}
    let kind=allowedKinds.has(input.node.kind)?input.node.kind:"document";
    const metadata=sanitizePortableValue(input.node.metadata??{}) as Record<string,unknown>;
    if(kind==="attachment"||kind==="shortcut"){kind="document";metadata.importFidelity="partially_editable";if(input.node.asset){metadata.importedAttachment=input.node.asset;metadata.missingBinary=true;}}
    const id=randomUUID(),name=await uniqueName(c,input.workspaceId,parent,input.node.name);
    await c.query(`insert into "content_nodes" ("id","workspace_id","parent_id","kind","name","metadata","created_by_user_id","updated_by_user_id") values ($1,$2,$3,$4::content_node_kind,$5,$6::jsonb,$7,$7)`,[id,input.workspaceId,parent,kind,name,JSON.stringify(metadata),input.actorUserId]);
    if(input.node.richDocument&&kind!=="folder"&&kind!=="notebook"){
      await c.query(`insert into "documents" ("workspace_id","node_id","body","created_by_user_id","updated_by_user_id") values ($1,$2,$3::jsonb,$4,$4) on conflict ("workspace_id","node_id") do nothing`,[input.workspaceId,id,JSON.stringify(sanitizePortableValue(input.node.richDocument)),input.actorUserId]);
    }else if(input.node.asset){
      await c.query(`insert into "documents" ("workspace_id","node_id","body","created_by_user_id","updated_by_user_id") values ($1,$2,$3::jsonb,$4,$4)`,[input.workspaceId,id,JSON.stringify({type:"doc",blocks:[{id:randomUUID(),type:"paragraph",text:"Imported attachment placeholder: "+input.node.asset.originalFilename+". Binary bytes were not embedded in this portable archive."}]}),input.actorUserId]);
    }
    for(const tagName of input.node.tags.slice(0,100)){
      const t=await c.query<{id:string}>(`insert into "workspace_tags" ("workspace_id","name","created_by_user_id") values ($1,$2,$3) on conflict ("workspace_id","normalized_name") do update set "updated_at"=now() returning "id"`,[input.workspaceId,tagName.slice(0,80),input.actorUserId]);
      if(t.rows[0])await c.query(`insert into "content_node_tags" ("workspace_id","node_id","tag_id","assigned_by_user_id") values ($1,$2,$3,$4) on conflict do nothing`,[input.workspaceId,id,t.rows[0].id,input.actorUserId]);
    }
    await mapPut(c,input.mode,input.node.id,id);return {nodeId:id,reused:false};
  });
}

export async function finalizePortableRelations(pool:Pool,input:{mode:MapMode;workspaceId:string;actorUserId:string;relations:PortableRelation[];}){
  return withWorkspaceTransaction(pool,async c=>{let count=0;for(const r of input.relations.slice(0,50000)){const from=await mapGet(c,input.mode,r.fromNodeId),to=await mapGet(c,input.mode,r.toNodeId);if(!from||!to||from===to)continue;const type=relationTypes.has(r.type)?r.type:"related";const q=await c.query(`insert into "content_relations" ("workspace_id","from_node_id","to_node_id","relation_type","label","metadata","created_by_user_id") values ($1,$2,$3,$4::content_relation_type,$5,$6::jsonb,$7) on conflict ("workspace_id","from_node_id","to_node_id","relation_type") do nothing`,[input.workspaceId,from,to,type,r.label?.slice(0,160)??null,JSON.stringify(sanitizePortableValue(r.metadata??{})),input.actorUserId]);count+=q.rowCount??0;}return count;});
}
export async function mappedRootNodeIds(pool:Pool,mode:MapMode,manifest:PortableManifest){
  const out:string[]=[];for(const n of manifest.nodes.filter(n=>n.parentId===null)){const table=mode.type==="transfer"?"transfer_node_map":"template_usage_node_map";const owner=mode.type==="transfer"?"transfer_id":"usage_id";const r=await pool.query<{new_node_id:string}>(`select "new_node_id" from "${table}" where "${owner}"=$1 and "source_node_id"=$2`,[mode.id,n.id]);if(r.rows[0])out.push(r.rows[0].new_node_id);}return out;
}
export function renderRichDocumentMarkdown(body:unknown){
  const blocks=body&&typeof body==="object"&&Array.isArray((body as any).blocks)?(body as any).blocks:[];
  return blocks.map((b:any)=>{const t=String(b?.text??"");if(b?.type==="heading"){const l=Math.min(6,Math.max(1,Number(b.level??2)));return "#".repeat(l)+" "+t;}if(b?.type==="bulleted_list")return "- "+t;if(b?.type==="quote")return "> "+t;if(b?.type==="code")return "~~~\n"+t+"\n~~~";return t;}).join("\n\n");
}
function esc(v:string){const m:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};return v.replace(/[&<>"']/g,c=>m[c]??c);}
export function renderRichDocumentHtml(title:string,body:unknown){
  const blocks=body&&typeof body==="object"&&Array.isArray((body as any).blocks)?(body as any).blocks:[];
  const html=blocks.map((b:any)=>{const t=esc(String(b?.text??"")).replace(/\n/g,"<br>");if(b?.type==="heading"){const l=Math.min(6,Math.max(1,Number(b.level??2)));return "<h"+l+">"+t+"</h"+l+">";}if(b?.type==="bulleted_list")return "<ul><li>"+t+"</li></ul>";if(b?.type==="quote")return "<blockquote>"+t+"</blockquote>";if(b?.type==="code")return "<pre><code>"+t+"</code></pre>";return "<p>"+t+"</p>";}).join("\n");
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title></head><body><main><h1>'+esc(title)+"</h1>"+html+"</main></body></html>";
}
