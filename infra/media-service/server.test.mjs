import { test } from "node:test";
import assert from "node:assert/strict";
import { makeServer, safeToken, scannerMemoryBudgetAllows, validateStorageUrl } from "./server.mjs";

test("scanner rejects insufficient cgroup memory without trusting unscanned uploads", () => {
  assert.equal(scannerMemoryBudgetAllows("536870912"), false);
  assert.equal(scannerMemoryBudgetAllows("805306368"), false);
  assert.equal(scannerMemoryBudgetAllows("1073741824"), true);
  assert.equal(scannerMemoryBudgetAllows("2147483648"), true);
  assert.equal(scannerMemoryBudgetAllows("max"), true);
  assert.equal(scannerMemoryBudgetAllows("invalid"), false);
});

test("media calls require a bearer secret and do not accept absent auth",()=>{
  assert.equal(safeToken(undefined,"valid-secret-0123456789"),false);
  assert.equal(safeToken("Bearer invalid","valid-secret-0123456789"),false);
  assert.equal(safeToken("Bearer valid-secret-0123456789","valid-secret-0123456789"),true);
});
test("media service does not permit anonymous scanning or arbitrary routes",async()=>{
  const server=makeServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  try{
    const health=await fetch("http://127.0.0.1:"+port+"/health");
    assert.equal(health.status,200);
    const blocked=await fetch("http://127.0.0.1:"+port+"/scan",{method:"POST",body:"{}"});
    assert.equal(blocked.status,401);
    const missing=await fetch("http://127.0.0.1:"+port+"/not-found");
    assert.equal(missing.status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test("deny unsafe storage addresses when the allowlist is missing",()=>{
  for(const target of ["http://127.0.0.1:4000/","https://169.254.169.254/latest","file:///etc/passwd"]){
    assert.throws(()=>validateStorageUrl(target));
  }
});
