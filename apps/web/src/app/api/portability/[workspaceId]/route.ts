import { NextResponse,type NextRequest } from "next/server";
import { NexosophyApiError,nexosophyApi } from "../../../../lib/api-server";

function err(e:unknown){if(e instanceof NexosophyApiError)return NextResponse.json({error:{code:e.code,message:e.message}},{status:e.status});throw e;}
export async function GET(req:NextRequest,{params}:{params:Promise<{workspaceId:string}>}){
 const{workspaceId}=await params,v=req.nextUrl.searchParams.get("view")??"transfers",q=new URLSearchParams(req.nextUrl.searchParams);q.delete("view");
 try{
  const path=v==="templates"?`/v1/workspaces/${workspaceId}/templates?${q}`:v==="categories"?`/v1/workspaces/${workspaceId}/templates/categories`:v==="assets"?`/v1/workspaces/${workspaceId}/import-assets`:v==="template"?`/v1/workspaces/${workspaceId}/templates/${encodeURIComponent(q.get("templateId")??"")}`:v==="download"?`/v1/workspaces/${workspaceId}/transfers/${encodeURIComponent(q.get("transferId")??"")}/download`:`/v1/workspaces/${workspaceId}/transfers`;
  return NextResponse.json(await nexosophyApi(path));
 }catch(e){return err(e);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{workspaceId:string}>}){
 const{workspaceId}=await params,b=await req.json() as any;
 try{
  if(b.action==="createTemplate"){const{action,...payload}=b;return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/templates`,{method:"POST",body:JSON.stringify(payload)}),{status:202});}
  if(b.action==="instantiate"){return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/templates/${encodeURIComponent(String(b.templateId??""))}/instantiate`,{method:"POST",body:JSON.stringify({destinationParentId:b.destinationParentId??null,values:b.values??{},version:b.version})}),{status:202});}
  if(b.action==="import"){return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/transfers/import`,{method:"POST",body:JSON.stringify({assetId:b.assetId,destinationParentId:b.destinationParentId??null,formatHint:b.formatHint})}),{status:202});}
  if(b.action==="export"){return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/transfers/export`,{method:"POST",body:JSON.stringify({scope:b.scope,nodeId:b.nodeId,format:b.format,includeRelations:b.includeRelations!==false})}),{status:202});}
  if(b.action==="cancel"||b.action==="retry"){await nexosophyApi(`/v1/workspaces/${workspaceId}/transfers/${encodeURIComponent(String(b.transferId??""))}/action`,{method:"POST",body:JSON.stringify({action:b.action})});return new NextResponse(null,{status:204});}
  return NextResponse.json({error:{code:"VALIDATION_ERROR",message:"Unknown portability action."}},{status:400});
 }catch(e){return err(e);}
}
