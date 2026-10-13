/** Isolated, real S3-compatible object-store acceptance on disposable local MinIO.
 * No domain, cloud storage keys, production data or external credentials.
 */
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { S3CompatibleStorageAdapter } from "@nexosophy/storage";

const endpoint = "http://127.0.0.1:9000";
const region = "us-east-1";
const bucket = "nexosophy-stage2-ci";
const accessKeyId = "nexosophytest";
const secretAccessKey = "nexosophy-local-object-store-secret";
if (process.env.NODE_ENV !== "test" || process.env.APP_ENV !== "local" ||
    process.env.RUN_STAGE2_INTEGRATION !== "1") {
  throw new Error("S3 acceptance must run only in disposable local CI.");
}
const hexSha = (x: Buffer | string) => createHash("sha256").update(x).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

async function createDisposableBucket() {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = timestamp.slice(0,8);
  const contentHash = hexSha("");
  const canonicalHeaders = "host:127.0.0.1:9000\n" +
    "x-amz-content-sha256:" + contentHash + "\n" +
    "x-amz-date:" + timestamp + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const scope = day + "/" + region + "/s3/aws4_request";
  const request = ["PUT", "/" + bucket, "", canonicalHeaders, signedHeaders, contentHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, hexSha(request)].join("\n");
  const dateKey = hmac("AWS4" + secretAccessKey, day);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const result = await fetch(endpoint + "/" + bucket, {
    method: "PUT",
    headers: {
      "x-amz-date": timestamp,
      "x-amz-content-sha256": contentHash,
      authorization: "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + scope +
        ", SignedHeaders=" + signedHeaders + ", Signature=" + signature,
    },
  });
  assert.ok(result.ok || result.status === 409,
    "Local bucket could not be created: HTTP " + result.status + " " + (await result.text()).slice(0,400));
}
await createDisposableBucket();
const store = new S3CompatibleStorageAdapter({
  endpoint, region, bucket, accessKeyId, secretAccessKey,
});
const base = "stage2/" + randomBytes(8).toString("hex");
const singleKey = base + "/small test.txt";
const multipartKey = base + "/large.bin";
const abortKey = base + "/aborted.bin";
const content = Buffer.from("Nexosophy S3 signed URL and object round-trip\n");
try {
  const put = await store.createUploadUrl({
    key: singleKey, contentType: "text/plain", expiresInSeconds: 50,
  });
  const putReply = await fetch(put.url, {
    method: "PUT", ...(put.headers ? { headers: put.headers } : {}), body: content,
  });
  assert.equal(putReply.status, 200, "Presigned PUT must reach the storage provider");
  const head = await store.headObject(singleKey);
  assert.equal(head.size, content.byteLength);
  assert.equal(head.contentType, "text/plain");
  const signedGet = await store.createDownloadUrl({ key: singleKey, expiresInSeconds: 50 });
  const download = await fetch(signedGet.url);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);
  console.log("PASS S3 single-part upload/download, HEAD validation and escaped object keys");

  const initiated = await store.createMultipartUpload({
    key: multipartKey, contentType: "application/octet-stream",
    metadata: { "uploaded-by": "local-stage2-acceptance" },
  });
  const chunks = [randomBytes(5 * 1024 * 1024), randomBytes(128 * 1024)];
  const parts: Array<{partNumber: number;etag: string}> = [];
  for (const [index, chunk] of chunks.entries()) {
    const partNumber = index + 1;
    const signed = await store.createMultipartPartUrl({
      key: multipartKey, uploadId: initiated.uploadId, partNumber,
      expiresInSeconds: 60,
    });
    const uploaded = await fetch(signed.url, { method: "PUT", body: chunk });
    assert.equal(uploaded.status, 200, "Multipart part upload HTTP status");
    const etag = uploaded.headers.get("etag");
    assert.ok(etag, "Provider must report part ETag");
    parts.push({ partNumber, etag });
  }
  const complete = await store.completeMultipartUpload({
    key: multipartKey, uploadId: initiated.uploadId, parts,
  });
  assert.ok(complete.etag);
  assert.equal((await store.headObject(multipartKey)).size,
    chunks.reduce((n, part)=>n+part.length,0));
  const multipartGet = await store.createDownloadUrl({ key: multipartKey, expiresInSeconds: 60 });
  const payload = Buffer.from(await (await fetch(multipartGet.url)).arrayBuffer());
  assert.deepEqual(payload, Buffer.concat(chunks), "Multipart download must preserve bytes");
  console.log("PASS S3 multipart 5 MiB+part direct-to-storage roundtrip and checksum-equivalent bytes");

  const abandoned = await store.createMultipartUpload({
    key: abortKey, contentType: "application/octet-stream",
  });
  await store.abortMultipartUpload({ key: abortKey, uploadId: abandoned.uploadId });
  await assert.rejects(store.headObject(abortKey), /HEAD failed/);
  const quicklyExpiring = await store.createDownloadUrl({
    key: singleKey, expiresInSeconds: 1,
  });
  assert.equal(new URL(quicklyExpiring.url).searchParams.get("X-Amz-Expires"), "1");
  // The local emulator verifies multipart persistence but not provider URL expiry;
  // reserve the HTTP expiration assertion for external storage acceptance.
  await sleep(50);
  console.log("PASS S3 multipart abort and one-second presigned TTL parameter");
} finally {
  await Promise.allSettled([
    store.deleteObject(singleKey),
    store.deleteObject(multipartKey),
  ]);
}
