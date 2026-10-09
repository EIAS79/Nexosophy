import { NextResponse,type NextRequest } from "next/server";
import { NexosophyApiError,nexosophyApi } from "../../../../lib/api-server";
function err(e:unknown){if(e instanceof NexosophyApiError)return NextResponse.json({error:{code:e.code,message:e.message}},{status:e.status});throw e;}

export async function GET(req:NextRequest,{params}:{params:Promise<{workspaceId:string}>}){
 const{workspaceId}=await params,v=req.nextUrl.searchParams.get("view")??"dashboard",q=new URLSearchParams(req.nextUrl.searchParams);q.delete("view");
 try{
  let path=`/v1/workspaces/${workspaceId}/research`;
  if(v==="thesis")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(q.get("projectId")??"")}`;
  else if(v==="references")path=`/v1/workspaces/${workspaceId}/references?${q.toString()}`;
  else if(v==="reference")path=`/v1/workspaces/${workspaceId}/references/${encodeURIComponent(q.get("referenceId")??"")}`;
  else if(v==="bibliography"){q.delete("referenceId");path=`/v1/workspaces/${workspaceId}/references/bibliography?${q.toString()}`;}
  else if(v==="export")path=`/v1/workspaces/${workspaceId}/references/export?${q.toString()}`;
  return NextResponse.json(await nexosophyApi(path));
 }catch(e){return err(e);}
}

export async function POST(req:NextRequest,{params}:{params:Promise<{workspaceId:string}>}){
 const{workspaceId}=await params,b=await req.json() as any;
 try{
  let path="",method="POST",body:any={...b};delete body.action;
  if(b.action==="thesis")path=`/v1/workspaces/${workspaceId}/research/theses`;
  else if(b.action==="statement")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/statements`;
  else if(b.action==="chapter")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/chapters`;
  else if(b.action==="milestone")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/milestones`;
  else if(b.action==="meeting")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/meetings`;
  else if(b.action==="decision")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/decisions`;
  else if(b.action==="status"){path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/status`;method="PATCH";}
  else if(b.action==="thesisLink")path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/links`;
  else if(b.action==="ethics"){path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/ethics`;method="PUT";}
  else if(b.action==="checklist"){path=`/v1/workspaces/${workspaceId}/research/theses/${encodeURIComponent(String(b.projectId??""))}/checklist/${encodeURIComponent(String(b.itemId??""))}`;method="PATCH";}
  else if(b.action==="reference")path=`/v1/workspaces/${workspaceId}/references`;
  else if(b.action==="resolve")path=`/v1/workspaces/${workspaceId}/references/resolve`;
  else if(b.action==="merge")path=`/v1/workspaces/${workspaceId}/references/merge`;
  else if(b.action==="attach")path=`/v1/workspaces/${workspaceId}/references/${encodeURIComponent(String(b.referenceId??""))}/attachments`;
  else if(b.action==="annotation")path=`/v1/workspaces/${workspaceId}/references/${encodeURIComponent(String(b.referenceId??""))}/annotations`;
  else if(b.action==="collection")path=`/v1/workspaces/${workspaceId}/references/collections`;
  else if(b.action==="collectionItem")path=`/v1/workspaces/${workspaceId}/references/collections/${encodeURIComponent(String(b.collectionId??""))}/items`;
  else if(b.action==="matrix"){path=`/v1/workspaces/${workspaceId}/references/${encodeURIComponent(String(b.referenceId??""))}/matrix`;method="PUT";}
  else if(b.action==="citation")path=`/v1/workspaces/${workspaceId}/references/citations`;
  else if(b.action==="import")path=`/v1/workspaces/${workspaceId}/references/import`;
  else return NextResponse.json({error:{code:"VALIDATION_ERROR",message:"Unknown research action."}},{status:400});
  for(const key of ["projectId","itemId","referenceId","collectionId"])delete body[key];
  return NextResponse.json(await nexosophyApi(path,{method,body:JSON.stringify(body)}),{status:method==="POST"?201:200});
 }catch(e){return err(e);}
}
