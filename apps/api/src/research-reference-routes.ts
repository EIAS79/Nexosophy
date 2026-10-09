import type { AuthVerifier } from "@nexosophy/auth";
import {
  bibliographyQuerySchema,
  createReferenceSchema,
  createThesisSchema,
  insertCitationSchema,
} from "@nexosophy/contracts";
import {
  addResearchStatement,
  addReferenceToCollection,
  addThesisChapter,
  appendThesisDecision,
  attachReferenceAsset,
  createLiteratureCollection,
  createReference,
  createReferenceAnnotation,
  createSupervisionMeeting,
  createThesisMilestone,
  createThesisProject,
  exportReferenceText,
  generateBibliography,
  getReference,
  importReferenceText,
  insertCitation,
  listReferences,
  mergeReferences,
  resolveIdentifierBoundary,
  thesisDashboard,
  thesisDetail,
  updateSubmissionChecklist,
  updateThesisStatus,
  linkThesisNode,
  upsertEthicsRecord,
  upsertLiteratureMatrixRow,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";
import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function fail(reply:any,request:any,e:unknown,status=400){
  const code=e instanceof Error?e.message:"RESEARCH_ERROR";
  return sendWorkspaceError(reply,request.id,status,code,code.toLowerCase().replaceAll("_"," ").replace(/^./,(x:string)=>x.toUpperCase())+".");
}
function text(v:unknown,max=200000){return typeof v==="string"?v.slice(0,max):"";}
function optionalUuid(v:unknown){return typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v)?v:undefined;}

export async function registerResearchReferenceRoutes(
  app:FastifyInstance,
  pool:DatabasePool,
  verifier:AuthVerifier=denyWorkspaceAuth,
){
  app.get("/v1/workspaces/:workspaceId/research",async(request,reply)=>{
    const{workspaceId}=request.params as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    return thesisDashboard(pool,workspaceId);
  });

  app.get("/v1/workspaces/:workspaceId/research/theses/:projectId",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    try{return await thesisDetail(pool,workspaceId,projectId);}catch(e){return fail(reply,request,e,404);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=createThesisSchema.parse(request.body),p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    try{const x=await createThesisProject(pool,{workspaceId,userId:p.internalUserId,...b,requestId:request.id});reply.code(201);return x;}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/statements",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    if(!["question","hypothesis","objective"].includes(String(b?.type)))return fail(reply,request,new Error("STATEMENT_TYPE_INVALID"));
    reply.code(201);return addResearchStatement(pool,{workspaceId,projectId,userId:p.internalUserId,type:b.type,text:text(b?.text,100000)});
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/chapters",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    try{reply.code(201);return await addThesisChapter(pool,{workspaceId,projectId,userId:p.internalUserId,title:text(b?.title,300)});}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/milestones",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    try{reply.code(201);return await createThesisMilestone(pool,{workspaceId,projectId,userId:p.internalUserId,title:text(b?.title,500),description:text(b?.description),dueAt:typeof b?.dueAt==="string"?new Date(b.dueAt):undefined,kind:text(b?.kind,80)||"milestone"});}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/meetings",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    try{reply.code(201);return await createSupervisionMeeting(pool,{workspaceId,projectId,userId:p.internalUserId,title:text(b?.title,500)||"Supervision meeting",startsAt:new Date(String(b?.startsAt)),endsAt:new Date(String(b?.endsAt)),timezone:text(b?.timezone,120)||"UTC",agenda:text(b?.agenda)});}catch(e){return fail(reply,request,e);}
  });

  app.patch("/v1/workspaces/:workspaceId/research/theses/:projectId/status",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    const status=String(b?.status);
    if(!["proposal","research","writing","review","submitted","defended","archived"].includes(status))return fail(reply,request,new Error("THESIS_STATUS_INVALID"));
    try{await updateThesisStatus(pool,{workspaceId,projectId,userId:p.internalUserId,status:status as any});reply.code(204);return;}catch(e){return fail(reply,request,e,404);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/links",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    try{await linkThesisNode(pool,{workspaceId,projectId,nodeId:String(b?.nodeId??""),kind:text(b?.kind,120)||"related"});reply.code(204);return;}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/research/theses/:projectId/decisions",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    reply.code(201);return appendThesisDecision(pool,{workspaceId,projectId,userId:p.internalUserId,decision:text(b?.decision,100000),rationale:text(b?.rationale,100000)});
  });

  app.put("/v1/workspaces/:workspaceId/research/theses/:projectId/ethics",async(request,reply)=>{
    const{workspaceId,projectId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    if(!["not_required","planned","submitted","approved","rejected","expired"].includes(String(b?.status)))return fail(reply,request,new Error("ETHICS_STATUS_INVALID"));
    return upsertEthicsRecord(pool,{workspaceId,projectId,status:b.status,authority:text(b?.authority,300)||undefined,referenceNumber:text(b?.referenceNumber,200)||undefined,submittedOn:text(b?.submittedOn,20)||undefined,approvedOn:text(b?.approvedOn,20)||undefined,expiresOn:text(b?.expiresOn,20)||undefined,notes:text(b?.notes)});
  });

  app.patch("/v1/workspaces/:workspaceId/research/theses/:projectId/checklist/:itemId",async(request,reply)=>{
    const{workspaceId,projectId,itemId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    try{return await updateSubmissionChecklist(pool,{workspaceId,projectId,itemId,done:b?.done===true});}catch(e){return fail(reply,request,e,404);}
  });

  app.get("/v1/workspaces/:workspaceId/references",async(request,reply)=>{
    const{workspaceId}=request.params as any,q=request.query as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    return{items:await listReferences(pool,{workspaceId,q:text(q?.q,500),limit:Number(q?.limit)||100})};
  });

  app.get("/v1/workspaces/:workspaceId/references/:referenceId",async(request,reply)=>{
    const{workspaceId,referenceId}=request.params as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    try{return await getReference(pool,workspaceId,referenceId);}catch(e){return fail(reply,request,e,404);}
  });

  app.post("/v1/workspaces/:workspaceId/references",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=createReferenceSchema.parse(request.body),p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    try{const x=await createReference(pool,{workspaceId,userId:p.internalUserId,...b});reply.code(x.duplicateOf?200:201);return x;}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/references/resolve",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    const type=String(b?.type);if(!["doi","isbn","pmid","arxiv","other"].includes(type))return fail(reply,request,new Error("IDENTIFIER_TYPE_INVALID"));
    return resolveIdentifierBoundary(pool,{workspaceId,type:type as any,value:text(b?.value,500)});
  });

  app.post("/v1/workspaces/:workspaceId/references/merge",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    try{await mergeReferences(pool,{workspaceId,userId:p.internalUserId,keepReferenceId:String(b?.keepReferenceId??""),mergeReferenceId:String(b?.mergeReferenceId??"")});reply.code(204);return;}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/references/:referenceId/attachments",async(request,reply)=>{
    const{workspaceId,referenceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    try{await attachReferenceAsset(pool,{workspaceId,referenceId,assetId:String(b?.assetId??""),label:text(b?.label,200)||undefined});reply.code(204);return;}catch(e){return fail(reply,request,e);}
  });

  app.post("/v1/workspaces/:workspaceId/references/:referenceId/annotations",async(request,reply)=>{
    const{workspaceId,referenceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    reply.code(201);return createReferenceAnnotation(pool,{workspaceId,userId:p.internalUserId,referenceId,noteNodeId:optionalUuid(b?.noteNodeId),quote:text(b?.quote,100000)||undefined,comment:text(b?.comment,100000),pageLocator:text(b?.pageLocator,100)||undefined});
  });

  app.post("/v1/workspaces/:workspaceId/references/collections",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    reply.code(201);return createLiteratureCollection(pool,{workspaceId,projectId:optionalUuid(b?.projectId),name:text(b?.name,200)});
  });

  app.post("/v1/workspaces/:workspaceId/references/collections/:collectionId/items",async(request,reply)=>{
    const{workspaceId,collectionId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    await addReferenceToCollection(pool,collectionId,String(b?.referenceId??""));reply.code(204);return;
  });

  app.put("/v1/workspaces/:workspaceId/references/:referenceId/matrix",async(request,reply)=>{
    const{workspaceId,referenceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    return upsertLiteratureMatrixRow(pool,{workspaceId,projectId:optionalUuid(b?.projectId),referenceId,question:text(b?.question,100000)||undefined,method:text(b?.method,100000)||undefined,sample:text(b?.sample,100000)||undefined,findings:text(b?.findings,200000)||undefined,limitations:text(b?.limitations,100000)||undefined,relevance:text(b?.relevance,100000)||undefined,custom:typeof b?.custom==="object"&&b.custom?b.custom:{}});
  });

  app.post("/v1/workspaces/:workspaceId/references/citations",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=insertCitationSchema.parse(request.body),p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.update",request,reply)))return;
    try{reply.code(201);return await insertCitation(pool,{workspaceId,userId:p.internalUserId,...b,requestId:request.id});}catch(e){return fail(reply,request,e);}
  });

  app.get("/v1/workspaces/:workspaceId/references/bibliography",async(request,reply)=>{
    const{workspaceId}=request.params as any,q=bibliographyQuerySchema.parse(request.query),p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    return{items:await generateBibliography(pool,{workspaceId,styleId:q.styleId,documentNodeId:q.documentNodeId})};
  });

  app.post("/v1/workspaces/:workspaceId/references/import",async(request,reply)=>{
    const{workspaceId}=request.params as any,b=request.body as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.create",request,reply)))return;
    const format=b?.format==="ris"?"ris":"bibtex";return importReferenceText(pool,{workspaceId,userId:p.internalUserId,format,text:text(b?.text,10_000_000)});
  });

  app.get("/v1/workspaces/:workspaceId/references/export",async(request,reply)=>{
    const{workspaceId}=request.params as any,q=request.query as any,p=await requireWorkspacePrincipal(request,reply,verifier);
    if(!p)return;if(!(await authorizeWorkspace(pool,p,workspaceId,"content.read",request,reply)))return;
    return exportReferenceText(pool,{workspaceId,format:q?.format==="ris"?"ris":"bibtex"});
  });
}
