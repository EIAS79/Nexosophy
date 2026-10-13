import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
// Full ClamAV signature scanning can exhaust a 512 MiB Render instance.
// Reject inadequate cgroup limits before spawning clamscan; never downgrade
// signatures, pretend that a file was scanned, or trust a filename instead.
const MIN_CLAMAV_MEMORY_BYTES = 1024n * 1024n * 1024n;
export function scannerMemoryBudgetAllows(limit) {
  const value = String(limit).trim();
  if (value === "max") return true;
  return /^\d+$/.test(value) && BigInt(value) >= MIN_CLAMAV_MEMORY_BYTES;
}
async function scannerHasAdequateMemory() {
  for (const path of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      return scannerMemoryBudgetAllows(await readFile(path, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") return false;
    }
  }
  // Outside Linux cgroups, let the real scanner decide; it still fails closed.
  return true;
}
const MAX_BYTES = Math.min(100 * 1024 * 1024, Number(process.env.MEDIA_MAX_BYTES || 50 * 1024 * 1024));
const STORAGE_HOST = process.env.MEDIA_STORAGE_HOST || "";
const TOKEN = process.env.MEDIA_SERVICE_TOKEN || "";
const PORT = Number(process.env.PORT || 4300);
const ALLOWED_JOBS = new Set([
  "thumbnail", "image_preview", "pdf_preview", "pdf_text", "office_preview",
  "media_metadata", "waveform", "video_poster",
]);

export function validateStorageUrl(raw) {
  const parsed = new URL(raw);
  if (!STORAGE_HOST || parsed.protocol !== "https:" || parsed.hostname !== STORAGE_HOST ||
      parsed.username || parsed.password || (parsed.port && parsed.port !== "443") ||
      parsed.hash || !parsed.searchParams.has("X-Amz-Signature")) {
    throw new Error("STORAGE_URL_DENIED");
  }
  return parsed.toString();
}
export function safeToken(actual, expected=TOKEN) {
  if (!expected || !actual || typeof actual !== "string") return false;
  const a=Buffer.from(actual),b=Buffer.from("Bearer "+expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function command(binary,args,timeout=45000) {
  return exec(binary,args,{timeout,maxBuffer:1024*1024,env:{
    PATH:process.env.PATH || "/usr/bin:/bin",
    HOME:"/tmp", LANG:"C", LC_ALL:"C", 
  }});
}
async function download(sourceUrl,target,maxSize=MAX_BYTES) {
  const response=await fetch(validateStorageUrl(sourceUrl),{
    redirect:"error",signal:AbortSignal.timeout(45000),
  });
  if(!response.ok || !response.body) throw new Error("SOURCE_DOWNLOAD_FAILED");
  const declared=Number(response.headers.get("content-length")||0);
  if(declared>maxSize) throw new Error("SOURCE_TOO_LARGE");
  let total=0;
  const hash=createHash("sha256");
  const chunks=[];
  for await(const chunk of response.body){
    const b=Buffer.from(chunk);total+=b.length;
    if(total>maxSize) throw new Error("SOURCE_TOO_LARGE");
    hash.update(b); chunks.push(b);
  }
  await writeFile(target,Buffer.concat(chunks));
  return {bytes:total,checksumSha256:hash.digest("hex")};
}
async function detectMime(path){
  const {stdout}=await command("file",["--brief","--mime-type",path]);
  const mime=stdout.trim().toLowerCase();
  if(!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime))throw new Error("MIME_DETECTION_FAILED");
  return mime;
}
async function scan(path) {
  // No fallback to file extensions or a pretend 'clean' verdict.
  if (!await scannerHasAdequateMemory()) throw new Error("ANTIVIRUS_NOT_READY");
  try{
    await command("clamscan",["--no-summary","--stdout","--infected",path],90000);
    return {clean:true,resultCode:"clean"};
  }catch(err){
    if(err && err.code===1)return {clean:false,resultCode:"malware_detected"};
    throw new Error("ANTIVIRUS_NOT_READY");
  }
}
async function processMedia(path,output,kind,mime) {
  if(kind==="thumbnail"||kind==="image_preview"){
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(mime))
      throw new Error("UNSUPPORTED_PREVIEW");
    await command("ffmpeg",["-v","error","-nostdin","-threads","1","-y",
      "-i",path,"-frames:v","1","-vf","scale=960:960:force_original_aspect_ratio=decrease",
      "-f","image2",output],45000);
    return "image/png";
  }
  if(kind==="pdf_preview"){
    if(mime!=="application/pdf")throw new Error("UNSUPPORTED_PREVIEW");
    const prefix=output.replace(/\.png$/,"");
    await command("pdftoppm",["-f","1","-l","1","-scale-to","1000","-singlefile",
      "-png",path,prefix],45000);
    return "image/png";
  }
  if(kind==="pdf_text"){
    if(mime!=="application/pdf")throw new Error("UNSUPPORTED_PREVIEW");
    await command("pdftotext",["-f","1","-l","50","-layout",path,output],45000);
    return "text/plain";
  }
  if(kind==="waveform"||kind==="video_poster"){
    if(!mime.startsWith("audio/")&&!mime.startsWith("video/"))
      throw new Error("UNSUPPORTED_PREVIEW");
    const args=kind==="waveform"
      ? ["-i",path,"-filter_complex","showwavespic=s=960x240:colors=white","-frames:v","1"]
      : ["-ss","00:00:01","-i",path,"-frames:v","1","-vf","scale=960:960:force_original_aspect_ratio=decrease"];
    await command("ffmpeg",["-v","error","-nostdin","-threads","1","-y",...args,"-f","image2",output],45000);
    return "image/png";
  }
  if(kind==="media_metadata"){
    const {stdout}=await command("ffprobe",["-v","error","-show_format","-show_streams",
      "-of","json",path],30000);
    // Do not echo embedded secret URLs or unsafe file metadata.
    const parsed=JSON.parse(stdout);
    await writeFile(output,JSON.stringify({
      format:{duration:parsed.format?.duration||null,size:parsed.format?.size||null},
      streams:(parsed.streams||[]).slice(0,30).map(x=>({
        codec_type:x.codec_type,codec_name:x.codec_name,width:x.width,height:x.height,
        duration:x.duration,
      })),
    }));
    return "application/json";
  }
  if(kind==="office_preview"){
    if(![
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword", "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ].includes(mime))throw new Error("UNSUPPORTED_PREVIEW");
    const outdir=resolve(output,"..");
    const extensions={
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":".docx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":".pptx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":".xlsx",
      "application/msword":".doc", "application/vnd.ms-excel":".xls",
      "application/vnd.ms-powerpoint":".ppt",
    };
    const inputWithExtension=join(outdir,"document"+extensions[mime]);
    await copyFile(path,inputWithExtension);
    await command("libreoffice",["-env:UserInstallation=file:///tmp/nx-lo-"+
      process.pid,"--headless","--convert-to","pdf","--outdir",outdir,inputWithExtension],60000);
    const generated=join(outdir,"document.pdf");
    const bytes=await readFile(generated);
    await writeFile(output,bytes);
    return "application/pdf";
  }
  throw new Error("UNSUPPORTED_PREVIEW");
}
async function put(target,bytes){
  if(!target || typeof target.url!=="string")throw new Error("TARGET_REQUIRED");
  const response=await fetch(validateStorageUrl(target.url),{
    method:"PUT",redirect:"error",signal:AbortSignal.timeout(45000),
    headers:target.headers||{},body:bytes,
  });
  if(!response.ok)throw new Error("TARGET_UPLOAD_FAILED");
}
async function handle(type,payload) {
  const temp=await mkdtemp(join(tmpdir(),"nexosophy-media-"));
  const input=join(temp,"original");
  const output=join(temp,type==="process"&&payload.jobType==="office_preview"?"derived.pdf":"derived.png");
  try{
    if(!payload || typeof payload!=="object")throw new Error("INVALID_PAYLOAD");
    const src=type==="scan"?payload.sourceUrl:payload.source?.url;
    if(typeof src!=="string")throw new Error("SOURCE_REQUIRED");
    const content=await download(src,input);
    if(type==="scan"){
      const detectedMime=await detectMime(input);
      if(payload.checksumSha256 && payload.checksumSha256.toLowerCase()!==content.checksumSha256)
        return {clean:false,detectedMime,scanner:"clamav",resultCode:"checksum_mismatch",
          checksumSha256:content.checksumSha256};
      const verdict=await scan(input);
      return {...verdict,detectedMime,scanner:"clamav",checksumSha256:content.checksumSha256};
    }
    const kind=payload.jobType;
    if(!ALLOWED_JOBS.has(kind))throw new Error("UNSUPPORTED_PREVIEW");
    const detectedMime=await detectMime(input);
    const supplied=payload.source?.mimeType;
    // For office ZIP containers, file(1) sees application/zip; trust only
    // an already-scanned declaration from the worker, not the public caller.
    const mime=detectedMime==="application/zip" && String(supplied).startsWith("application/vnd.openxmlformats-")
      ? supplied:detectedMime;
    const actualMime=await processMedia(input,output,kind,mime);
    const result=await readFile(output);
    if(result.length>MAX_BYTES)throw new Error("OUTPUT_TOO_LARGE");
    await put(payload.target,result);
    return {mimeType:actualMime,sizeBytes:result.byteLength,
      checksumSha256:createHash("sha256").update(result).digest("hex"),
      fidelityLabel:"server-generated",metadata:{processor:"nexosophy-media-v1"}};
  }finally{await rm(temp,{recursive:true,force:true});}
}
export function makeServer() {
  return createServer(async (req,res)=>{
    const reply=(code,data)=>{res.writeHead(code,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(data));};
    if(req.method==="GET"&&req.url==="/health")return reply(200,{status:"ok"});
    if(req.method==="GET"&&req.url==="/ready"){
      try{
        if (!await scannerHasAdequateMemory()) {
          return reply(503,{status:"scanner_unavailable",reason:"insufficient_scanner_memory"});
        }
        await command("clamscan",["--version"],4000);
        await command("file",["--version"],4000);
        // clamscan --version alone is not proof that signature database works.
        const file=join(tmpdir(),"nx-clam-ready-"+process.pid);
        await writeFile(file,"clean probe");
        try{await scan(file);}finally{await rm(file,{force:true});}
        return reply(200,{status:"ready"});
      }catch{return reply(503,{status:"scanner_unavailable"});}
    }
    if(req.method!=="POST"||!["/scan","/process"].includes(req.url||""))
      return reply(404,{error:"NOT_FOUND"});
    if(!safeToken(req.headers.authorization))return reply(401,{error:"UNAUTHORIZED"});
    if(req.url==="/scan"&&!await scannerHasAdequateMemory())
      return reply(503,{error:"ANTIVIRUS_NOT_READY"});
    let size=0;const parts=[];
    try{
      for await(const part of req){
        size+=part.length;if(size>16384)throw new Error("REQUEST_TOO_LARGE");
        parts.push(Buffer.from(part));
      }
      const payload=JSON.parse(Buffer.concat(parts).toString("utf8"));
      const result=await handle(req.url==="/scan"?"scan":"process",payload);
      return reply(200,result);
    }catch(error){
      const message=error instanceof Error?error.message:"PROCESSOR_FAILED";
      return reply(message==="REQUEST_TOO_LARGE"?413:503,{error:message});
    }
  });
}
if(process.argv[1] && import.meta.url===new URL("file://"+resolve(process.argv[1])).href){
  if(!TOKEN||TOKEN.length<32||!STORAGE_HOST)throw new Error("Missing MEDIA_SERVICE_TOKEN or MEDIA_STORAGE_HOST");
  const server=makeServer();
  server.listen(PORT,"0.0.0.0",()=>console.info("Nexosophy media service ready on port "+PORT));
}
