/* Browser UI contract for the multipart upload component, using disposable
 * route fixtures. It deliberately does not claim cloud S3, worker or scanner
 * acceptance; those require separate live integration evidence.
 */
const assert = require("node:assert/strict");

async function checkUploadBrowser(page, workspaceId, origin) {
  const endpoint = "/api/uploads/" + workspaceId;
  const sessions = new Map();
  let partUploads = 0;
  let checksums = 0;
  let downloadsDenied = 0;

  await page.route("**" + endpoint + "**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (payload, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    if (request.method() === "GET") {
      const session = sessions.get(url.searchParams.get("uploadSessionId"));
      if (!session) return json({ error: { message: "Unknown upload" } }, 404);
      return json({
        session: {
          id: session.id,
          partSizeBytes: 1024 * 1024,
          expectedParts: 1,
          status: session.failed ? "failed" : "complete",
        },
        parts: [],
        asset: { id: session.assetId, trustState: session.failed ? "quarantined" : "trusted" },
      });
    }
    if (request.method() !== "POST") return json({}, 405);
    const body = request.postDataJSON();
    if (body.action === "initiate") {
      const id = "browser-session-" + sessions.size;
      const assetId = "browser-asset-" + sessions.size;
      const session = { id, assetId, failed: body.filename.includes("quarantine") };
      sessions.set(id, session);
      return json({
        asset: { id: assetId },
        upload: { id, partSizeBytes: 1024 * 1024, expectedParts: 1 },
      });
    }
    if (body.action === "signPart") {
      assert.equal(body.partNumber, 1);
      assert.ok(sessions.has(body.uploadSessionId));
      return json({
        partNumber: 1,
        url: origin + "/__stage2_local_signed_part?X-Amz-Signature=fixture",
      });
    }
    if (body.action === "recordPart") {
      assert.ok(sessions.has(body.uploadSessionId));
      assert.ok(/^[a-f0-9]{64}$/.test(body.checksumSha256));
      assert.equal(body.etag, '"stage2-etag"');
      checksums++;
      return json({ recorded: true });
    }
    if (body.action === "complete") {
      assert.ok(sessions.has(body.uploadSessionId));
      return json({ completed: true });
    }
    if (body.action === "download" || body.action === "variantDownload") {
      downloadsDenied++;
      return json({ error: { message: "Do not mint fixture download URLs." } }, 403);
    }
    return json({ error: { message: "Unsupported mock action" } }, 400);
  });

  await page.route("**/__stage2_local_signed_part?**", async (route) => {
    const request = route.request();
    assert.equal(request.method(), "PUT");
    const contents = request.postDataBuffer();
    assert.ok(contents && contents.length > 0);
    partUploads++;
    return route.fulfill({ status: 200, headers: { etag: '"stage2-etag"' }, body: "" });
  });

  await page.goto(origin + "/app/workspaces/" + workspaceId + "/files");
  await page.getByRole("heading", { name: "Upload files" }).waitFor();
  const sample = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  await page.locator('section[aria-label="Upload files"] input[type="file"]').setInputFiles([
    { name: "browser-clean-fixture.png", mimeType: "image/png", buffer: sample },
    { name: "browser-quarantine-fixture.png", mimeType: "image/png", buffer: sample },
  ]);
  await page.getByText("Upload verified and ready.", { exact: true }).waitFor({ timeout: 20_000 });
  await page
    .getByText("Security validation failed. The file remains quarantined.", {
      exact: true,
    })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Retry security scan" }).waitFor();
  assert.equal(partUploads, 2, "Both multipart PUTs must hit their signed URL");
  assert.equal(checksums, 2, "Both uploads must record SHA-256 part checksums");
  assert.equal(downloadsDenied, 0, "No untrusted file may request a download URL");
  console.log(
    "PASS Stage 2 browser multipart upload UI and quarantined scan state (mocked storage/scanner)",
  );
  await page.unroute("**" + endpoint + "**");
  await page.unroute("**/__stage2_local_signed_part?**");
}

module.exports = { checkUploadBrowser };
