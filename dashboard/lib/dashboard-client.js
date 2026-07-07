import { buildDashboardData, cloneDefaultData } from "./dashboard-transform";
import { io } from "socket.io-client";

const DASHBOARD_PLAN_NAME = "DASHBOARD_DEMO";
const API_KEY_STORAGE_KEY = "dashboard-backend-api-key";
const TENANT_REGISTRY_STORAGE_KEY = "dashboard-tenant-registry";
const DEFAULT_BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:4000";
export const DASHBOARD_WORKER_ID = "dashboard-console-worker";

export const BACKEND_API_INVENTORY = [
  { method: "GET", path: "/", feature: "Backend welcome response" },
  { method: "GET", path: "/health", feature: "Backend health" },
  { method: "GET", path: "/plans", feature: "Plan catalog" },
  { method: "POST", path: "/plans", feature: "Plan creation" },
  { method: "POST", path: "/tenants", feature: "Tenant provisioning" },
  { method: "GET", path: "/tenants", feature: "Tenant list for dashboard switching" },
  { method: "GET", path: "/jobs", feature: "Job list" },
  { method: "GET", path: "/jobs/:id", feature: "Job detail" },
  { method: "POST", path: "/jobs", feature: "Job submission" },
  { method: "POST", path: "/jobs/claim", feature: "Claim next pending job" },
  { method: "POST", path: "/jobs/:id/ack", feature: "Acknowledge running job" },
  { method: "POST", path: "/jobs/:id/fail", feature: "Fail running job" },
  { method: "GET", path: "/metrics", feature: "Queue metrics" },
  { method: "GET", path: "/dlq", feature: "Dead-letter queue" },
  { method: "GET", path: "/autoscaling/recommendation", feature: "Autoscaling recommendation" },
  { method: "POST", path: "/workers/run-once", feature: "Run one worker pass" },
  { method: "POST", path: "/workers/simulate", feature: "Start paced multi-worker simulation" },
  { method: "GET", path: "/events/jobs", feature: "Realtime job SSE stream" },
];

export const MISSING_BACKEND_FEATURES = [
  "Schedules management and schedule execution APIs",
  "Template library CRUD and template usage analytics APIs",
  "Alert rules, muting, acknowledgements, and alert history APIs",
  "Dedicated worker fleet telemetry APIs for CPU, memory, zone, and heartbeat health",
  "Queue topology/subscriber graph APIs beyond the raw jobs event stream",
];

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function getSavedApiKey() {
  const storage = getBrowserStorage();
  return storage?.getItem(API_KEY_STORAGE_KEY) ?? process.env.NEXT_PUBLIC_BACKEND_API_KEY ?? "";
}

function saveApiKey(apiKey) {
  const storage = getBrowserStorage();
  storage?.setItem(API_KEY_STORAGE_KEY, apiKey);
}

function loadTenantRegistry() {
  const storage = getBrowserStorage();
  const rawValue = storage?.getItem(TENANT_REGISTRY_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTenantRegistry(registry) {
  const storage = getBrowserStorage();
  storage?.setItem(TENANT_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
}

function upsertTenantRegistryEntry(entry) {
  const existing = loadTenantRegistry();
  const next = [
    entry,
    ...existing.filter((tenant) => tenant.apiKey !== entry.apiKey),
  ];
  saveTenantRegistry(next);
  return next;
}

async function fetchBackend(pathname, options = {}) {
  const { apiKey, method = "GET", body, headers = {} } = options;
  const response = await fetch(`${DEFAULT_BACKEND_BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Backend request failed for ${pathname}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchBackendText(pathname) {
  const response = await fetch(`${DEFAULT_BACKEND_BASE_URL}${pathname}`);

  if (!response.ok) {
    throw new Error(`Backend request failed for ${pathname}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function getBackendBaseUrl() {
  return DEFAULT_BACKEND_BASE_URL;
}

export function getActiveTenantApiKey() {
  return getSavedApiKey();
}

export function listStoredTenants() {
  return loadTenantRegistry();
}

export function activateTenantApiKey(apiKey) {
  saveApiKey(apiKey);
}

async function ensurePlan() {
  const plans = await fetchBackend("/plans");
  const existingPlan = plans.find((plan) => plan.name === DASHBOARD_PLAN_NAME);

  if (existingPlan) {
    return existingPlan;
  }

  try {
    return await fetchBackend("/plans", {
      method: "POST",
      body: {
        name: DASHBOARD_PLAN_NAME,
        rateLimitPerMinute: 120,
        maxConcurrentJobs: 8,
        defaultMaxAttempts: 3,
        maxAllowedAttempts: 5,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("409")) {
      throw error;
    }

    const refreshedPlans = await fetchBackend("/plans");
    const conflictedPlan = refreshedPlans.find((plan) => plan.name === DASHBOARD_PLAN_NAME);
    if (!conflictedPlan) {
      throw error;
    }

    return conflictedPlan;
  }
}

async function seedTenantIfNeeded(apiKey) {
  const existingJobs = await fetchBackend("/jobs", { apiKey });
  if (existingJobs.length > 0) {
    return;
  }

  const timestamp = Date.now();
  const seedJobs = [
    {
      idempotencyKey: `dashboard-success-${timestamp}`,
      payload: { type: "import", name: "Customer Import", queue: "default" },
      maxAttempts: 3,
    },
    {
      idempotencyKey: `dashboard-failure-${timestamp + 1}`,
      payload: { type: "billing", name: "Invoice Export", queue: "billing", fail: true },
      maxAttempts: 1,
    },
    {
      idempotencyKey: `dashboard-pending-${timestamp + 2}`,
      payload: { type: "maintenance", name: "Retention Sweep", queue: "maintenance" },
      maxAttempts: 3,
    },
    {
      idempotencyKey: `dashboard-running-${timestamp + 3}`,
      payload: { type: "notifications", name: "Email Dispatch", queue: "default" },
      maxAttempts: 3,
    },
  ];

  for (const job of seedJobs) {
    await fetchBackend("/jobs", {
      apiKey,
      method: "POST",
      body: job,
    });
  }

  await fetchBackend("/workers/run-once", {
    apiKey,
    method: "POST",
  });

  await fetchBackend("/workers/run-once", {
    apiKey,
    method: "POST",
  });

  await fetchBackend("/jobs/claim", {
    apiKey,
    method: "POST",
    headers: {
      "x-worker-id": DASHBOARD_WORKER_ID,
    },
  });
}

export async function resolveBrowserApiKey() {
  const savedApiKey = getSavedApiKey();
  if (savedApiKey) {
    return savedApiKey;
  }

  const plan = await ensurePlan();
  const tenant = await fetchBackend("/tenants", {
    method: "POST",
    body: {
      name: `Dashboard ${new Date().toISOString()}`,
      planId: plan.id,
    },
  });

  saveApiKey(tenant.api_key);
  upsertTenantRegistryEntry({
    id: tenant.id,
    name: tenant.name,
    apiKey: tenant.api_key,
    planId: tenant.plan_id,
    createdAt: new Date().toISOString(),
  });
  await seedTenantIfNeeded(tenant.api_key);

  return tenant.api_key;
}

export async function fetchBackendHealth() {
  const [hello, health] = await Promise.all([
    fetchBackendText("/"),
    fetchBackend("/health"),
  ]);

  return { hello, health };
}

export async function fetchPlanCatalog() {
  return fetchBackend("/plans");
}

export async function createTenant(name, planId) {
  const tenant = await fetchBackend("/tenants", {
    method: "POST",
    body: {
      name,
      planId,
    },
  });

  const registryEntry = {
    id: tenant.id,
    name: tenant.name,
    apiKey: tenant.api_key,
    planId: tenant.plan_id,
    createdAt: new Date().toISOString(),
  };

  upsertTenantRegistryEntry(registryEntry);
  saveApiKey(tenant.api_key);
  await seedTenantIfNeeded(tenant.api_key);

  return registryEntry;
}

export async function fetchTenantsFromBackend() {
  return fetchBackend("/tenants");
}

export async function createJob({ idempotencyKey, payload, maxAttempts }) {
  const apiKey = await resolveBrowserApiKey();

  return fetchBackend("/jobs", {
    apiKey,
    method: "POST",
    body: {
      idempotencyKey,
      payload,
      maxAttempts,
    },
  });
}

export async function createSampleJob() {
  const timestamp = Date.now();

  return createJob({
    idempotencyKey: `dashboard-manual-${timestamp}`,
    payload: {
      type: "manual",
      name: `Manual Job ${new Date(timestamp).toLocaleTimeString()}`,
      queue: "default",
    },
    maxAttempts: 3,
  });
}

export async function claimNextJob() {
  const apiKey = await resolveBrowserApiKey();
  return fetchBackend("/jobs/claim", {
    apiKey,
    method: "POST",
    headers: {
      "x-worker-id": DASHBOARD_WORKER_ID,
    },
  });
}

export async function ackJob(jobId) {
  const apiKey = await resolveBrowserApiKey();
  return fetchBackend(`/jobs/${jobId}/ack`, {
    apiKey,
    method: "POST",
    headers: {
      "x-worker-id": DASHBOARD_WORKER_ID,
    },
  });
}

export async function failJob(jobId, reason = "Failed from dashboard") {
  const apiKey = await resolveBrowserApiKey();
  return fetchBackend(`/jobs/${jobId}/fail`, {
    apiKey,
    method: "POST",
    headers: {
      "x-worker-id": DASHBOARD_WORKER_ID,
    },
    body: {
      reason,
    },
  });
}

export async function fetchJobDetail(jobId) {
  const apiKey = await resolveBrowserApiKey();
  return fetchBackend(`/jobs/${jobId}`, { apiKey });
}

export async function runWorkerOnce() {
  const apiKey = await resolveBrowserApiKey();
  return fetchBackend("/workers/run-once", {
    apiKey,
    method: "POST",
  });
}

export async function startWorkerSimulation(apiKey, config) {
  return fetchBackend("/workers/simulate", {
    apiKey,
    method: "POST",
    body: config,
  });
}

async function startSseJobEventsStream(apiKey, onEvent, onStatusChange) {
  const response = await fetch(`${DEFAULT_BACKEND_BASE_URL}/events/jobs`, {
    headers: {
      "x-api-key": apiKey,
      Accept: "text/event-stream",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Backend event stream failed: ${response.status} ${response.statusText}`);
  }

  onStatusChange?.("connected");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let cancelled = false;

  const pump = async () => {
    while (!cancelled) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!dataLine) {
          continue;
        }

        const rawData = dataLine.replace(/^data:\s*/, "");
        try {
          const parsed = JSON.parse(rawData);
          onEvent(parsed);
        } catch {
          // Ignore malformed frames from partial reconnects.
        }
      }
    }

    onStatusChange?.("closed");
  };

  pump().catch(() => {
    onStatusChange?.("error");
  });

  return () => {
    cancelled = true;
    onStatusChange?.("closed");
    reader.cancel().catch(() => {});
  };
}

async function startWebSocketJobEventsStream(apiKey, onEvent, onStatusChange) {
  return new Promise((resolve, reject) => {
    const socket = io(`${DEFAULT_BACKEND_BASE_URL}/jobs`, {
      auth: { apiKey },
      transports: ["websocket"],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 3,
    });

    let settled = false;

    const cleanup = () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("job.status", handleEvent);
      socket.disconnect();
    };

    const handleEvent = (event) => {
      onEvent(event);
    };

    const handleConnect = () => {
      onStatusChange?.("connected");
      if (!settled) {
        settled = true;
        resolve(() => {
          onStatusChange?.("closed");
          cleanup();
        });
      }
    };

    const handleConnectError = (error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
        return;
      }

      onStatusChange?.("error");
    };

    const handleDisconnect = (reason) => {
      if (reason !== "io client disconnect") {
        onStatusChange?.("error");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("job.status", handleEvent);
  });
}

export async function startJobEventsStream(onEvent, onStatusChange) {
  const apiKey = await resolveBrowserApiKey();

  try {
    return await startWebSocketJobEventsStream(apiKey, onEvent, onStatusChange);
  } catch {
    onStatusChange?.("fallback");
    return startSseJobEventsStream(apiKey, onEvent, onStatusChange);
  }
}

export async function fetchDashboardContentClientSide() {
  try {
    const apiKey = await resolveBrowserApiKey();
    const [{ hello, health }, plans, metrics, jobs, dlq, autoscaling] = await Promise.all([
      fetchBackendHealth(),
      fetchPlanCatalog(),
      fetchBackend("/metrics", { apiKey }),
      fetchBackend("/jobs", { apiKey }),
      fetchBackend("/dlq", { apiKey }),
      fetchBackend("/autoscaling/recommendation", { apiKey }),
    ]);

    const dashboardData = buildDashboardData({
      metrics,
      jobs,
      dlq,
      autoscaling,
      backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    });

    return {
      ...dashboardData,
      rawJobs: jobs,
      rawJobsSource: jobs,
      rawMetrics: metrics,
      rawDlqSource: Array.isArray(dlq) ? dlq : dlq?.records ?? [],
      rawAutoscaling: autoscaling,
      rawBackendBaseUrl: DEFAULT_BACKEND_BASE_URL,
      backendHealth: health,
      backendGreeting: hello,
      planCatalog: plans,
      backendApiInventory: BACKEND_API_INVENTORY,
      missingBackendFeatures: MISSING_BACKEND_FEATURES,
      workerId: DASHBOARD_WORKER_ID,
      eventStreamStatus: "connecting",
      selectedJobDetail: null,
      enableLiveUpdates: true,
      enableEventStream: true,
      enableMutations: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser integration error.";
    return {
      ...cloneDefaultData(),
      rawJobs: [],
      backendHealth: null,
      backendGreeting: null,
      planCatalog: [],
      backendApiInventory: BACKEND_API_INVENTORY,
      missingBackendFeatures: MISSING_BACKEND_FEATURES,
      workerId: DASHBOARD_WORKER_ID,
      eventStreamStatus: "error",
      selectedJobDetail: null,
      enableLiveUpdates: false,
      enableEventStream: false,
      enableMutations: false,
      integrationNotice: `Direct browser integration fallback active: ${message}. The backend may need CORS enabled for ${window.location.origin}.`,
    };
  }
}
