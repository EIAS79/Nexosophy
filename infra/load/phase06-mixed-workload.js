import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import exec from "k6/execution";

const correctnessFailures = new Counter("nexosophy_correctness_failures");
const acceptedConflicts = new Counter("nexosophy_expected_conflicts");
const successfulMutations = new Rate("nexosophy_successful_mutations");

const baseUrl = (__ENV.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const token = __ENV.AUTH_TOKEN || "";
const workspaceId = __ENV.WORKSPACE_ID || "";
const documentNodeIds = (__ENV.DOCUMENT_NODE_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!workspaceId) {
  throw new Error("WORKSPACE_ID is required.");
}
if (!token) {
  throw new Error("AUTH_TOKEN is required.");
}

export const options = {
  scenarios: {
    steady_mixed: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "4m", target: 50 },
        { duration: "30s", target: 10 },
      ],
      gracefulRampDown: "20s",
    },
    burst_reads: {
      executor: "constant-arrival-rate",
      rate: 250,
      timeUnit: "1s",
      duration: "60s",
      preAllocatedVUs: 80,
      maxVUs: 250,
      startTime: "90s",
      exec: "readBurst",
    },
  },
  thresholds: {
    "http_req_duration{class:read}": ["p(95)<250", "p(99)<750"],
    "http_req_duration{class:write}": ["p(95)<500", "p(99)<1200"],
    http_req_failed: ["rate<0.01"],
    nexosophy_correctness_failures: ["count==0"],
    nexosophy_successful_mutations: ["rate>0.98"],
  },
};

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function nodeForVu() {
  if (documentNodeIds.length === 0) return null;
  return documentNodeIds[(exec.vu.idInTest - 1) % documentNodeIds.length] ?? null;
}

function read(path) {
  return http.get(`${baseUrl}${path}`, {
    headers: headers(),
    tags: { class: "read" },
  });
}

function ordinaryReads() {
  const nodes = read(
    `/v1/workspaces/${workspaceId}/nodes?parentId=root&limit=50`,
  );
  if (!check(nodes, { "content page read is 200": (r) => r.status === 200 })) {
    correctnessFailures.add(1);
  }

  const meta = read("/v1/meta");
  if (!check(meta, { "meta read is 200": (r) => r.status === 200 })) {
    correctnessFailures.add(1);
  }
}

function documentRead() {
  const nodeId = nodeForVu();
  if (!nodeId) {
    ordinaryReads();
    return;
  }
  const response = read(
    `/v1/workspaces/${workspaceId}/documents/${nodeId}`,
  );
  if (!check(response, { "document read is 200": (r) => r.status === 200 })) {
    correctnessFailures.add(1);
  }
}

function documentWrite() {
  const nodeId = nodeForVu();
  if (!nodeId) {
    ordinaryReads();
    return;
  }

  const current = read(
    `/v1/workspaces/${workspaceId}/documents/${nodeId}`,
  );
  if (current.status !== 200) {
    correctnessFailures.add(1);
    successfulMutations.add(false);
    return;
  }

  const document = current.json();
  const response = http.put(
    `${baseUrl}/v1/workspaces/${workspaceId}/documents/${nodeId}`,
    JSON.stringify({
      body: document.body,
      expectedRevision: document.revision,
    }),
    {
      headers: headers({
        "Idempotency-Key": `load-${exec.vu.idInTest}-${Date.now()}-${Math.random()}`,
      }),
      tags: { class: "write" },
    },
  );

  if (response.status === 412) {
    acceptedConflicts.add(1);
    successfulMutations.add(true);
    return;
  }

  const ok = check(response, {
    "document save is 200 or expected conflict": (r) => r.status === 200,
  });
  successfulMutations.add(ok);
  if (!ok) correctnessFailures.add(1);
}

function jobRead() {
  const response = read(`/v1/workspaces/${workspaceId}/jobs`);
  if (!check(response, { "job list read is 200": (r) => r.status === 200 })) {
    correctnessFailures.add(1);
  }
}

export default function () {
  const bucket = Math.random();
  if (bucket < 0.55) ordinaryReads();
  else if (bucket < 0.80) documentRead();
  else if (bucket < 0.95) documentWrite();
  else jobRead();

  sleep(Math.random() * 0.7 + 0.15);
}

export function readBurst() {
  const response = read(
    `/v1/workspaces/${workspaceId}/nodes?parentId=root&limit=25`,
  );
  if (![200, 429].includes(response.status)) correctnessFailures.add(1);
}
