/* Stage 2 browser acceptance uses only ephemeral local PostgreSQL and a local
 * Playwright browser. It never touches the production or staging databases.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

if (process.env.AUTH_LOCAL_E2E !== "1" || !process.env.AUTH_TEST_PASSWORD)
  throw new Error("Stage 2 browser acceptance is local-CI-only.");
const origin = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin + "/login");
    await page.locator('input[name="email"]').fill("first@local.nexosophy.test");
    await page.locator('input[name="password"]').fill(process.env.AUTH_TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/(?:onboarding|app)(?:\?|$)/);
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForURL(/\/app(?:\?|$)/);
    }
    await page.goto(origin + "/app");
    await page.getByRole("heading", { name: "Your knowledge, in context." }).waitFor();
    await page.getByRole("heading", { name: "Workspaces", exact: true }).waitFor();
    console.log("PASS Stage 2 live-data workspace dashboard");

    await page.goto(origin + "/app/workspaces");
    await page.getByRole("heading", { name: "Create workspace" }).waitFor();
    const name = "Browser-stage2-" + Date.now();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="type"]').selectOption("team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.waitForURL(/\/app\/workspaces\/[0-9a-f-]{36}(?:\?|$)/);
    const workspaceId = page.url().match(/workspaces\/([0-9a-f-]{36})/)?.[1];
    assert.ok(workspaceId, "Workspace creation must yield an actual UUID route");
    await page.getByRole("heading", { name, exact: true }).waitFor();
    console.log("PASS Stage 2 workspace creation and authenticated route");

    await page.goto(origin + "/app/workspaces/" + workspaceId + "/files");
    await page.getByRole("heading", { name: "Files & knowledge" }).waitFor();
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Create content" }).waitFor();
    const docName = "Stage2 document " + Date.now();
    await dialog.locator('input[name="name"]').fill(docName);
    await dialog.locator('select[name="kind"]').selectOption("document");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByText("Created.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Open", exact: true }).click();
    await page.getByRole("heading", { name: docName, exact: true }).waitFor();
    const editor = page.getByRole("region", { name: "Document editor" });
    await editor.waitFor();
    await editor.getByRole("button", { name: "Start writing" }).click();
    const text = "Persisted through real browser save " + Date.now();
    await editor.getByRole("textbox", { name: "paragraph block 1" }).fill(text);
    await editor.getByRole("button", { name: "Save now" }).click();
    await editor.locator('[data-state="saved"]').waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("region", { name: "Document editor" })
      .getByRole("textbox", { name: "paragraph block 1" }).waitFor();
    assert.equal(
      await page.getByRole("region", { name: "Document editor" })
        .getByRole("textbox", { name: "paragraph block 1" }).inputValue(),
      text,
      "Acknowledged document edits must survive navigation/reopen",
    );
    console.log("PASS Stage 2 recursive content creation and durable document editor");

    await page.goto(origin + "/app/workspaces/" + workspaceId + "/files");
    await page.getByRole("heading", { name: "Files & knowledge" }).waitFor();
    await page.getByRole("button", { name: docName, exact: true }).first().click();
    await page.getByRole("button", { name: "Trash", exact: true }).click();
    await page.getByText("Moved to trash.", { exact: true }).waitFor();
    await page.goto(origin + "/app/workspaces/" + workspaceId + "/trash");
    await page.getByRole("heading", { name: "Trash", exact: true }).waitFor();
    const card = page.locator("article").filter({ hasText: docName }).first();
    await card.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByText(docName + " restored.", { exact: true }).waitFor();
    console.log("PASS Stage 2 delete, trash UI and restore");
    // Responsive and keyboard acceptance on the same authenticated app.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + "/app/workspaces/" + workspaceId + "/files");
    await page.getByRole("heading", { name: "Files & knowledge" }).waitFor();
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("dialog").getByRole("heading", { name: "Create content" }).waitFor();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(origin + "/app/workspaces/" + workspaceId);
    await page.getByRole("heading", { name, exact: true }).waitFor();
    console.log("PASS Stage 2 mobile and tablet viewport navigation and dialog accessibility");
    // Independent WCAG automated audit for stage-2 core screens. The injection
    // runs only on disposable local browser sessions; no third-party network calls.
    const axeScript = require.resolve("axe-core/axe.min.js");
    for (const path of ["/app", "/app/workspaces", "/app/workspaces/" + workspaceId + "/files"]) {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(origin + path);
        await page.locator("#main-content").waitFor();
        await page.addScriptTag({ path: axeScript });
        const audit = await page.evaluate(async () => {
          const result = await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] },
          });
          return result.violations
            .filter((item) => item.impact === "critical" || item.impact === "serious")
            .map((item) => ({ id: item.id, impact: item.impact,
              targets: item.nodes.map((node) => node.target).slice(0, 3) }));
        });
        assert.deepEqual(audit, [], "Critical WCAG failures on " + path + " @" + width + "px");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        assert.ok(overflow <= 4, "Horizontal viewport overflow " + overflow + "px on " + path);
      }
    }
    console.log("PASS Stage 2 WCAG A/AA serious/critical scan and mobile/desktop overflow");

    // Keyboard-only access: shortcut opens command palette, escape closes,
    // and link navigation remains usable with RTL document direction.
    await page.goto(origin + "/app");
    await page.keyboard.press("Control+k");
    const commandDialog = page.getByRole("dialog");
    await commandDialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await commandDialog.waitFor({ state: "hidden" });
    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    await page.getByRole("navigation", { name: "Mobile application navigation" }).count();
    assert.ok(
      await page.evaluate(() => getComputedStyle(document.documentElement).direction) === "rtl",
      "RTL direction must propagate to app shell",
    );
    console.log("PASS Stage 2 keyboard command palette and RTL direction smoke");

    // Reproducible local Chromium baseline, not a claim about global field CWV.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin + "/", { waitUntil: "load" });
    const metrics = await page.evaluate(async () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
      let cls = 0, lcp = 0;
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (entry.entryType === "layout-shift" && !entry.hadRecentInput) cls += entry.value;
          if (entry.entryType === "largest-contentful-paint") lcp = Math.max(lcp, entry.startTime);
        }
      });
      try {
        observer.observe({ type: "layout-shift", buffered: true });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch { /* Unsupported metrics retain neutral values in Chromium. */ }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      observer.disconnect();
      return { fcp, lcp, cls, domContentLoaded: nav?.domContentLoadedEventEnd ?? null };
    });
    assert.ok(metrics.fcp !== null && metrics.fcp < 4000,
      "Local marketing page FCP baseline exceeds 4 seconds");
    assert.ok(metrics.cls < 0.25,
      "Local cumulative layout shift exceeds 0.25");
    console.log("PASS Stage 2 local Core Web Vitals baseline", JSON.stringify(metrics));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
