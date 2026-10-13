/** Disposable S3 wire-protocol receiver for adapter acceptance.
 * Independently verifies SigV4 method, scope, SHA256 and presigned expiry.
 * NOT an object-storage production implementation.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const secret = "nexosophy-local-object-store-secret";
const access = "nexosophytest";
const bucket = "nexosophy-stage2-ci";
type StoredObject = { body: Buffer; mime: string; etag: string };
type PartialUpload = { key: string; mime: string; parts: Map<number, StoredObject> };
function digest(data: string | Uint8Array) { return createHash("sha256").update(data).digest("hex"); }
function hmac(key: string | Buffer, msg: string) { return createHmac("sha256",key).update(msg).digest(); }
function encode(v: string) { return encodeURIComponent(v).replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase()); }
function canonicalQuery(params: URLSearchParams) {
  return [...params.entries()]
    .sort(([k1,v1],[k2,v2])=>k1===k2?(v1<v2?-1:v1>v2?1:0):(k1<k2?-1:1))
    .map(([k,v])=>encode(k)+"="+encode(v)).join("&");
}
function signature(scope: string, date: string, request: string) {
  const [day,region,service,terminal] = scope.split("/");
  if (!day || !region || service!=="s3" || terminal!=="aws4_request") return null;
  const key = hmac(hmac(hmac(hmac("AWS4"+secret,day),region),service),terminal);
  return createHmac("sha256",key)
    .update(["AWS4-HMAC-SHA256",date,scope,digest(request)].join("\n")).digest("hex");
}
function equalHex(a: string, b: string) {
  return /^[a-f\d]{64}$/i.test(a)&&/^[a-f\d]{64}$/i.test(b)&&
    timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
function authorized(request: IncomingMessage, url: URL, bytes: Buffer) {
  const host = request.headers.host;
  if(host!=="127.0.0.1:9000")return false;
  const rawAuth = request.headers.authorization;
  let scope: string, date: string, signed: string, provided: string, payload: string;
  let query: URLSearchParams;
  if (rawAuth) {
    const match = /^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([a-f\d]{64})$/i.exec(rawAuth);
    if(!match)return false;
    const credential=match[1]!;
    if(!credential.startsWith(access+"/"))return false;
    scope=credential.slice(access.length+1);
    date=String(request.headers["x-amz-date"]??"");
    signed=match[2]!;
    provided=match[3]!;
    payload=String(request.headers["x-amz-content-sha256"]??"");
    if(payload!==digest(bytes))return false;
    query=url.searchParams;
  }else{
    query=new URLSearchParams(url.searchParams);
    const credential=query.get("X-Amz-Credential")??"";
    if(!credential.startsWith(access+"/")||query.get("X-Amz-Algorithm")!=="AWS4-HMAC-SHA256")return false;
    scope=credential.slice(access.length+1);
    date=query.get("X-Amz-Date")??"";
    signed=query.get("X-Amz-SignedHeaders")??"";
    provided=query.get("X-Amz-Signature")??"";
    const expires=Number(query.get("X-Amz-Expires")??"");
    if(!Number.isInteger(expires)||expires<1||expires>3600)return false;
    const time=Date.UTC(Number(date.slice(0,4)),Number(date.slice(4,6))-1,Number(date.slice(6,8)),
      Number(date.slice(9,11)),Number(date.slice(11,13)),Number(date.slice(13,15)));
    if(!Number.isFinite(time)||Date.now()>time+expires*1000||time>Date.now()+120000)return false;
    query.delete("X-Amz-Signature");
    payload="UNSIGNED-PAYLOAD";
  }
  if(!/^\d{8}T\d{6}Z$/.test(date)||!scope.startsWith(date.slice(0,8)+"/"))return false;
  const names=signed.split(";");
  if(names.length<1||names.some((n,i)=>!n||i>0&&names[i-1]!>=n))return false;
  const canonHeaders=names.map(n=>{
    const value=n==="host"?host:request.headers[n];
    return n+":"+String(value??"").trim()+"\n";
  }).join("");
  const canon=[request.method??"",url.pathname,canonicalQuery(query),canonHeaders,signed,payload].join("\n");
  const expected=signature(scope,date,canon);
  return expected!==null&&equalHex(provided,expected);
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[]=[];let count=0;
  for await(const part of req){
    const chunk=Buffer.from(part); count+=chunk.length;
    if(count>16*1024*1024)throw new Error("Request exceeds test capacity");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function reply(res: ServerResponse,code: number, content?:Buffer|string,headers?:Record<string,string>) {
  res.writeHead(code,headers??{});res.end(content);
}
export async function startS3AcceptanceServer(): Promise<()=>Promise<void>> {
  const objects=new Map<string,StoredObject>();
  const uploads=new Map<string,PartialUpload>();
  let bucketCreated=false;
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url??"/","http://127.0.0.1:9000");
      const bytes=await body(req);
      if(!authorized(req,url,bytes))return reply(res,403,"Invalid or expired AWS signature");
      const segments=url.pathname.slice(1).split("/");
      if(segments.shift()!==bucket)return reply(res,404);
      const key=decodeURIComponent(segments.join("/"));
      if(!key) {
        if(req.method==="PUT"){bucketCreated=true;return reply(res,200);}
        return reply(res,404);
      }
      if(!bucketCreated)return reply(res,404);
      const uploadId=url.searchParams.get("uploadId");
      if(req.method==="POST"&&url.searchParams.has("uploads")){
        const id=randomUUID();
        uploads.set(id,{key,mime:String(req.headers["content-type"]??"application/octet-stream"),parts:new Map()});
        return reply(res,200,`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`,{"content-type":"application/xml"});
      }
      if(uploadId){
        const upload=uploads.get(uploadId);
        if(!upload||upload.key!==key)return reply(res,404);
        if(req.method==="DELETE"){uploads.delete(uploadId);return reply(res,204);}
        if(req.method==="PUT"){
          const num=Number(url.searchParams.get("partNumber"));
          if(!Number.isInteger(num)||num<1)return reply(res,400);
          const etag='"'+digest(bytes)+'"';
          upload.parts.set(num,{body:bytes,mime:upload.mime,etag});
          return reply(res,200,undefined,{etag});
        }
        if(req.method==="POST"){
          const xml=bytes.toString("utf8");
          const requested=[...xml.matchAll(/<Part><PartNumber>(\d+)<\/PartNumber><ETag>([^<]+)<\/ETag><\/Part>/g)];
          if(!requested.length)return reply(res,400);
          const pieces:Buffer[]=[];
          for(const item of requested){
            const found=upload.parts.get(Number(item[1]));
            if(!found||found.etag!==item[2])return reply(res,400);
            pieces.push(found.body);
          }
          const merged=Buffer.concat(pieces);
          const etag='"'+digest(merged)+'"';
          objects.set(key,{body:merged,mime:upload.mime,etag});
          uploads.delete(uploadId);
          return reply(res,200,`<CompleteMultipartUploadResult><ETag>${etag}</ETag></CompleteMultipartUploadResult>`,{"content-type":"application/xml"});
        }
      }
      if(req.method==="PUT"){
        const etag='"'+digest(bytes)+'"';
        objects.set(key,{body:bytes,mime:String(req.headers["content-type"]??"application/octet-stream"),etag});
        return reply(res,200,undefined,{etag});
      }
      if(req.method==="DELETE"){objects.delete(key);return reply(res,204);}
      const obj=objects.get(key);
      if(!obj)return reply(res,404);
      const headers={"content-type":obj.mime,"content-length":String(obj.body.length),"etag":obj.etag};
      if(req.method==="HEAD")return reply(res,200,undefined,headers);
      if(req.method==="GET")return reply(res,200,obj.body,headers);
      return reply(res,405);
    }catch(error){
      res.writeHead(500);res.end(error instanceof Error?error.message:"Error");
    }
  });
  await new Promise<void>((resolve,reject)=>{
    server.once("error",reject);
    server.listen(9000,"127.0.0.1",()=>resolve());
  });
  return ()=>new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}
