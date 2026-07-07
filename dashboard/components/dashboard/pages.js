"use client";

import { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultDashboardData,
  eventsLegend,
  toneIconMap,
} from "./data";
import { DashboardShell } from "./shell";
import {
  ActionButton,
  DropdownButton,
  FilterSelect,
  GhostIconButton,
  MetricCard,
  MiniBarList,
  Panel,
  Sparkline,
  StatusPill,
} from "./ui";
import { OutlineIcon } from "./icons";
import {
  ackJob,
  activateTenantApiKey,
  BACKEND_API_INVENTORY,
  claimNextJob,
  createJob,
  createTenant,
  createSampleJob,
  failJob,
  fetchTenantsFromBackend,
  fetchDashboardContentClientSide,
  fetchJobDetail,
  getActiveTenantApiKey,
  MISSING_BACKEND_FEATURES,
  runWorkerOnce,
  startWorkerSimulation,
  startJobEventsStream,
} from "../../lib/dashboard-client";
import { buildDashboardData } from "../../lib/dashboard-transform";

const DEFAULT_ENVIRONMENT = "Production";
const TIME_RANGE_OPTIONS = [
  "Last 15 minutes",
  "Last 1 hour",
  "Last 6 hours",
  "Last 24 hours",
  "Last 7 days",
  "All time",
];

const TIME_RANGE_MS = {
  "Last 15 minutes": 15 * 60 * 1000,
  "Last 1 hour": 60 * 60 * 1000,
  "Last 6 hours": 6 * 60 * 60 * 1000,
  "Last 24 hours": 24 * 60 * 60 * 1000,
  "Last 7 days": 7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_JOB_PAYLOAD = JSON.stringify(
  {
    type: "manual",
    name: "Invoice Export",
    queue: "default",
    environment: DEFAULT_ENVIRONMENT,
    invoiceId: "INV-1001",
  },
  null,
  2,
);

function getJobQueue(job) {
  return job?.payload?.queue ?? job?.payload?.type ?? "default";
}

function getJobEnvironment(job) {
  return job?.payload?.environment ?? DEFAULT_ENVIRONMENT;
}

function getJobFilterTimestamp(job) {
  return job?.completed_at ?? job?.started_at ?? job?.created_at ?? null;
}

function getDlqQueue(record) {
  return record?.payload?.queue ?? record?.payload?.type ?? "default";
}

function getDlqEnvironment(record) {
  return record?.payload?.environment ?? DEFAULT_ENVIRONMENT;
}

function formatRelativeTimeFromNow(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function buildIdempotencyKey(snapshotTime) {
  const timestamp = typeof snapshotTime === "string" || typeof snapshotTime === "number"
    ? new Date(snapshotTime).getTime()
    : snapshotTime instanceof Date
      ? snapshotTime.getTime()
      : Number.NaN;

  return `dashboard-manual-${Number.isFinite(timestamp) ? timestamp : Date.now()}`;
}

function formatAbsoluteDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function matchesTimeRange(value, timeRange) {
  if (timeRange === "All time") {
    return true;
  }

  const maxAge = TIME_RANGE_MS[timeRange];
  const timestamp = value ? new Date(value).getTime() : Number.NaN;

  if (!maxAge || !Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= maxAge;
}

function filterJobs(jobs, { environmentFilter, queueFilter, timeRangeFilter }) {
  return jobs.filter((job) => {
    const matchesEnvironment =
      environmentFilter === "All Environments" || getJobEnvironment(job) === environmentFilter;
    const matchesQueue = queueFilter === "All Queues" || getJobQueue(job) === queueFilter;
    const matchesTime = matchesTimeRange(getJobFilterTimestamp(job), timeRangeFilter);
    return matchesEnvironment && matchesQueue && matchesTime;
  });
}

function filterDlqRecords(records, { environmentFilter, queueFilter, timeRangeFilter }) {
  return records.filter((record) => {
    const matchesEnvironment =
      environmentFilter === "All Environments" || getDlqEnvironment(record) === environmentFilter;
    const matchesQueue = queueFilter === "All Queues" || getDlqQueue(record) === queueFilter;
    const matchesTime = matchesTimeRange(record.failed_at ?? record.failedAt, timeRangeFilter);
    return matchesEnvironment && matchesQueue && matchesTime;
  });
}

function buildFilteredDashboardData(sourceData, filters) {
  const rawJobs = sourceData.rawJobsSource ?? sourceData.rawJobs ?? [];
  const rawDlqRecords = sourceData.rawDlqSource ?? sourceData.dlqRecords ?? [];
  const filteredJobs = filterJobs(rawJobs, filters);
  const filteredDlqRecords = filterDlqRecords(rawDlqRecords, filters);
  const hasActiveFilters =
    filters.environmentFilter !== "All Environments" ||
    filters.queueFilter !== "All Queues" ||
    filters.timeRangeFilter !== "Last 24 hours";

  const derivedDashboardData = buildDashboardData({
    metrics: hasActiveFilters ? undefined : sourceData.rawMetrics,
    jobs: filteredJobs,
    dlq: filteredDlqRecords,
    autoscaling: sourceData.rawAutoscaling,
    backendBaseUrl: sourceData.rawBackendBaseUrl,
    snapshotTime: sourceData.snapshotTime,
  });

  if (hasActiveFilters && filteredJobs.length === 0) {
    derivedDashboardData.eventTimeline = [];
    derivedDashboardData.overviewEventsRows = [];
    derivedDashboardData.recentActivity = [];
    derivedDashboardData.jobStageDistribution = [];
    derivedDashboardData.jobQueues = [];
    derivedDashboardData.workers = [];
    derivedDashboardData.workerActivity = [];
    derivedDashboardData.eventFeed = [];
    derivedDashboardData.queueRows = [];
    derivedDashboardData.alerts = [];
  }

  return {
    ...sourceData,
    ...derivedDashboardData,
    rawJobs: filteredJobs,
    dlqRecords: derivedDashboardData.dlqRecords,
    backendHealth: sourceData.backendHealth ?? null,
    backendGreeting: sourceData.backendGreeting ?? null,
    planCatalog: sourceData.planCatalog ?? [],
    backendApiInventory: sourceData.backendApiInventory ?? BACKEND_API_INVENTORY,
    missingBackendFeatures: sourceData.missingBackendFeatures ?? MISSING_BACKEND_FEATURES,
    workerId: sourceData.workerId ?? "",
    eventStreamStatus: sourceData.eventStreamStatus ?? "idle",
    selectedJobDetail: sourceData.selectedJobDetail ?? null,
    snapshotTime: sourceData.snapshotTime ?? new Date().toISOString(),
    enableLiveUpdates: sourceData.enableLiveUpdates ?? false,
    enableEventStream: sourceData.enableEventStream ?? false,
    enableMutations: sourceData.enableMutations ?? false,
  };
}

const DashboardDataContext = createContext({
  ...defaultDashboardData,
  rawJobs: [],
  rawJobsSource: [],
  rawMetrics: null,
  rawDlqSource: [],
  rawAutoscaling: null,
  rawBackendBaseUrl: "",
  backendHealth: null,
  backendGreeting: null,
  planCatalog: [],
  backendApiInventory: [],
  missingBackendFeatures: [],
  workerId: "",
  dlqRecords: [],
  eventStreamStatus: "idle",
  liveJobEvents: [],
  selectedJobDetail: null,
  snapshotTime: new Date().toISOString(),
  enableLiveUpdates: false,
  enableEventStream: false,
  enableMutations: false,
  isRefreshing: false,
  isRunningWorker: false,
  isSubmittingJob: false,
  environmentFilter: "All Environments",
  environmentOptions: ["All Environments", DEFAULT_ENVIRONMENT],
  queueScopeFilter: "All Queues",
  queueScopeOptions: ["All Queues"],
  timeRangeFilter: "Last 24 hours",
  timeRangeOptions: TIME_RANGE_OPTIONS,
  setEnvironmentFilter: () => {},
  setQueueScopeFilter: () => {},
  setTimeRangeFilter: () => {},
  refreshDashboardData: async () => {},
  submitSampleJob: async () => {},
  submitCustomJob: async () => {},
  triggerWorkerPass: async () => {},
  claimNextPendingJob: async () => {},
  acknowledgeJob: async () => {},
  failRunningJob: async () => {},
  inspectJob: async () => {},
});

function buildInitialClientData(data) {
  return {
    ...defaultDashboardData,
    ...(data ?? {}),
    rawJobs: data?.rawJobs ?? [],
    rawJobsSource: data?.rawJobsSource ?? data?.rawJobs ?? [],
    rawMetrics: data?.rawMetrics ?? null,
    rawDlqSource: data?.rawDlqSource ?? data?.dlqRecords ?? [],
    rawAutoscaling: data?.rawAutoscaling ?? null,
    rawBackendBaseUrl: data?.rawBackendBaseUrl ?? "",
    backendHealth: data?.backendHealth ?? null,
    backendGreeting: data?.backendGreeting ?? null,
    planCatalog: data?.planCatalog ?? [],
    backendApiInventory: data?.backendApiInventory ?? [],
    missingBackendFeatures: data?.missingBackendFeatures ?? [],
    workerId: data?.workerId ?? "",
    dlqRecords: data?.dlqRecords ?? [],
    eventStreamStatus: data?.eventStreamStatus ?? "idle",
    selectedJobDetail: data?.selectedJobDetail ?? null,
    snapshotTime: data?.snapshotTime ?? new Date().toISOString(),
    integrationNotice: data?.integrationNotice ?? "Loading live dashboard data...",
    enableLiveUpdates: data?.enableLiveUpdates ?? false,
    enableEventStream: data?.enableEventStream ?? false,
    enableMutations: data?.enableMutations ?? false,
  };
}

function DashboardDataProvider({ data, children }) {
  const [dashboardData, setDashboardData] = useState(() => buildInitialClientData(data));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [isRunningWorker, setIsRunningWorker] = useState(false);
  const [liveJobEvents, setLiveJobEvents] = useState([]);
  const [eventStreamStatus, setEventStreamStatus] = useState("idle");
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [environmentFilter, setEnvironmentFilter] = useState("All Environments");
  const [queueScopeFilter, setQueueScopeFilter] = useState("All Queues");
  const [timeRangeFilter, setTimeRangeFilter] = useState("Last 24 hours");
  const liveEventSequence = useRef(0);
  const liveRefreshTimeout = useRef(null);

  async function syncDashboardData({ showRefreshingState = true } = {}) {
    if (!dashboardData.enableLiveUpdates) {
      return;
    }

    if (showRefreshingState) {
      setIsRefreshing(true);
    }

    try {
      const nextData = await fetchDashboardContentClientSide();

      startTransition(() => {
        setDashboardData(nextData);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown client refresh error.";

      startTransition(() => {
        setDashboardData((current) => ({
          ...current,
          integrationNotice: `Browser refresh fallback active: ${message}`,
        }));
      });
    } finally {
      if (showRefreshingState) {
        setIsRefreshing(false);
      }
    }
  }

  async function refreshDashboardData() {
    await syncDashboardData();
  }

  function queueLiveDashboardRefresh() {
    if (!dashboardData.enableLiveUpdates) {
      return;
    }

    if (liveRefreshTimeout.current !== null) {
      window.clearTimeout(liveRefreshTimeout.current);
    }

    liveRefreshTimeout.current = window.setTimeout(() => {
      liveRefreshTimeout.current = null;
      syncDashboardData({ showRefreshingState: false });
    }, 120);
  }

  useEffect(() => {
    if (!dashboardData.enableLiveUpdates) {
      return;
    }

    refreshDashboardData();
  }, [dashboardData.enableLiveUpdates]);

  useEffect(() => {
    if (!dashboardData.enableEventStream) {
      return;
    }

    let stopStream;

    startJobEventsStream(
      (event) => {
        const eventKey =
          event.id ??
          event.eventId ??
          `${event.type ?? "event"}-${event.jobId ?? "unknown"}-${event.status ?? "unknown"}-${event.timestamp ?? event.occurredAt ?? "notimestamp"}-${liveEventSequence.current++}`;

        setLiveJobEvents((current) => [{ ...event, __eventKey: String(eventKey) }, ...current].slice(0, 8));
        queueLiveDashboardRefresh();
      },
      (status) => {
        setEventStreamStatus(status);
      },
    )
      .then((cleanup) => {
        stopStream = cleanup;
      })
      .catch(() => {
        setEventStreamStatus("error");
      });

    return () => {
      if (liveRefreshTimeout.current !== null) {
        window.clearTimeout(liveRefreshTimeout.current);
      }
      stopStream?.();
    };
  }, [dashboardData.enableEventStream, dashboardData.enableLiveUpdates]);

  async function submitSampleJob() {
    if (!dashboardData.enableMutations) {
      return;
    }

    setIsSubmittingJob(true);
    try {
      await createSampleJob();
      await refreshDashboardData();
    } finally {
      setIsSubmittingJob(false);
    }
  }

  async function submitCustomJob(jobRequest) {
    if (!dashboardData.enableMutations) {
      return null;
    }

    setIsSubmittingJob(true);
    try {
      const createdJob = await createJob(jobRequest);
      await refreshDashboardData();
      return createdJob;
    } finally {
      setIsSubmittingJob(false);
    }
  }

  async function triggerWorkerPass() {
    if (!dashboardData.enableMutations) {
      return;
    }

    setIsRunningWorker(true);
    try {
      await runWorkerOnce();
      await refreshDashboardData();
    } finally {
      setIsRunningWorker(false);
    }
  }

  async function claimNextPendingJob() {
    if (!dashboardData.enableMutations) {
      return;
    }

    setIsRunningWorker(true);
    try {
      await claimNextJob();
      await refreshDashboardData();
    } finally {
      setIsRunningWorker(false);
    }
  }

  async function acknowledgeJob(jobId) {
    if (!dashboardData.enableMutations) {
      return;
    }

    await ackJob(jobId);
    await refreshDashboardData();
  }

  async function failRunningJob(jobId) {
    if (!dashboardData.enableMutations) {
      return;
    }

    await failJob(jobId);
    await refreshDashboardData();
  }

  async function inspectJob(jobId) {
    if (!dashboardData.enableMutations) {
      return;
    }

    const job = await fetchJobDetail(jobId);
    setSelectedJobDetail(job);
  }

  const environmentOptions = useMemo(() => {
    const environments = new Set(
      (dashboardData.rawJobsSource ?? []).map((job) => getJobEnvironment(job)),
    );
    environments.add(DEFAULT_ENVIRONMENT);
    return ["All Environments", ...[...environments].sort()];
  }, [dashboardData.rawJobsSource]);

  const queueScopeOptions = useMemo(() => {
    const queues = new Set(
      (dashboardData.rawJobsSource ?? []).map((job) => getJobQueue(job)),
    );
    return ["All Queues", ...[...queues].sort()];
  }, [dashboardData.rawJobsSource]);

  const filteredDashboardData = useMemo(
    () =>
      buildFilteredDashboardData(dashboardData, {
        environmentFilter,
        queueFilter: queueScopeFilter,
        timeRangeFilter,
      }),
    [dashboardData, environmentFilter, queueScopeFilter, timeRangeFilter],
  );

  const contextValue = useMemo(
    () => ({
      ...filteredDashboardData,
      isRefreshing,
      isSubmittingJob,
      isRunningWorker,
      liveJobEvents,
      eventStreamStatus,
      selectedJobDetail,
      environmentFilter,
      environmentOptions,
      queueScopeFilter,
      queueScopeOptions,
      timeRangeFilter,
      timeRangeOptions: TIME_RANGE_OPTIONS,
      setEnvironmentFilter,
      setQueueScopeFilter,
      setTimeRangeFilter,
      refreshDashboardData,
      submitSampleJob,
      submitCustomJob,
      triggerWorkerPass,
      claimNextPendingJob,
      acknowledgeJob,
      failRunningJob,
      inspectJob,
    }),
    [
      filteredDashboardData,
      isRefreshing,
      isSubmittingJob,
      isRunningWorker,
      liveJobEvents,
      eventStreamStatus,
      selectedJobDetail,
      environmentFilter,
      environmentOptions,
      queueScopeFilter,
      queueScopeOptions,
      timeRangeFilter,
      submitCustomJob,
    ],
  );

  return (
    <DashboardDataContext.Provider value={contextValue}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  return useContext(DashboardDataContext);
}

function DefaultToolbar() {
  const {
    enableLiveUpdates,
    enableMutations,
    isRefreshing,
    isSubmittingJob,
    isRunningWorker,
    environmentFilter,
    environmentOptions,
    queueScopeFilter,
    queueScopeOptions,
    timeRangeFilter,
    timeRangeOptions,
    setEnvironmentFilter,
    setQueueScopeFilter,
    setTimeRangeFilter,
    refreshDashboardData,
    submitSampleJob,
    claimNextPendingJob,
    triggerWorkerPass,
  } = useDashboardData();

  return (
    <>
      <ActionButton label={isSubmittingJob ? "Submitting..." : "Quick Sample"} onClick={submitSampleJob} disabled={!enableMutations || isSubmittingJob} />
      <ActionButton label={isRunningWorker ? "Claiming..." : "Claim Next"} onClick={claimNextPendingJob} disabled={!enableMutations || isRunningWorker} />
      <ActionButton label={isRunningWorker ? "Running..." : "Run Worker"} onClick={triggerWorkerPass} disabled={!enableMutations || isRunningWorker} tone="blue" />
      <FilterSelect
        ariaLabel="Filter dashboard by environment"
        value={environmentFilter}
        onChange={(event) => setEnvironmentFilter(event.target.value)}
        options={environmentOptions}
      />
      <FilterSelect
        ariaLabel="Filter dashboard by queue"
        value={queueScopeFilter}
        onChange={(event) => setQueueScopeFilter(event.target.value)}
        options={queueScopeOptions}
      />
      <FilterSelect
        ariaLabel="Filter dashboard by time range"
        value={timeRangeFilter}
        onChange={(event) => setTimeRangeFilter(event.target.value)}
        options={timeRangeOptions}
      />
      <button
        className="refreshButton"
        type="button"
        aria-label="Refresh"
        title={isRefreshing ? "Refreshing..." : "Refresh"}
        disabled={!enableLiveUpdates || isRefreshing}
        onClick={refreshDashboardData}
      >
        <OutlineIcon type="refresh" />
      </button>
    </>
  );
}

function SubmitJobPanel() {
  const {
    enableMutations,
    isSubmittingJob,
    submitCustomJob,
    snapshotTime,
    rawJobsSource,
    workerId,
    refreshDashboardData,
    claimNextPendingJob,
    acknowledgeJob,
    failRunningJob,
    inspectJob,
  } = useDashboardData();
  const [idempotencyKey, setIdempotencyKey] = useState(() => buildIdempotencyKey(snapshotTime));
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [payloadText, setPayloadText] = useState(DEFAULT_JOB_PAYLOAD);
  const [notice, setNotice] = useState("");
  const [submittedJobId, setSubmittedJobId] = useState(null);

  const submittedJob = useMemo(
    () => (rawJobsSource ?? []).find((job) => String(job.id) === String(submittedJobId)) ?? null,
    [rawJobsSource, submittedJobId],
  );
  const canClaimSubmittedJob = submittedJob?.status === "PENDING";
  const canAckOrFailSubmittedJob =
    submittedJob?.status === "RUNNING" && submittedJob?.lease_owner === workerId;

  async function handleSubmit(event) {
    event.preventDefault();

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setNotice("Payload must be valid JSON.");
      return;
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      setNotice("Payload must be a JSON object.");
      return;
    }

    const attempts = Number(maxAttempts);
    if (!Number.isInteger(attempts) || attempts <= 0) {
      setNotice("Max attempts must be a positive whole number.");
      return;
    }

    try {
      const job = await submitCustomJob({
        idempotencyKey: idempotencyKey.trim(),
        payload,
        maxAttempts: attempts,
      });
      setSubmittedJobId(job?.id ?? null);
      setNotice(`Submitted job ${job?.id ?? "successfully"}.`);
      setIdempotencyKey(buildIdempotencyKey(Date.now()));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to submit job.");
    }
  }

  async function handleRefreshSubmittedJob() {
    try {
      await refreshDashboardData();
      if (submittedJobId) {
        await inspectJob(submittedJobId);
      }
      setNotice("Refreshed submitted job state.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to refresh submitted job.");
    }
  }

  async function handleInspectSubmittedJob() {
    if (!submittedJobId) {
      return;
    }

    try {
      await inspectJob(submittedJobId);
      setNotice(`Loaded details for job ${submittedJobId}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to inspect submitted job.");
    }
  }

  async function handleClaimSubmittedJob() {
    try {
      await claimNextPendingJob();
      setNotice(`Triggered claim flow for pending jobs. Check job ${submittedJobId ?? ""} status.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to claim pending job.");
    }
  }

  async function handleAckSubmittedJob() {
    if (!submittedJobId) {
      return;
    }

    try {
      await acknowledgeJob(submittedJobId);
      setNotice(`Acknowledged job ${submittedJobId}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to acknowledge submitted job.");
    }
  }

  async function handleFailSubmittedJob() {
    if (!submittedJobId) {
      return;
    }

    try {
      await failRunningJob(submittedJobId);
      setNotice(`Marked job ${submittedJobId} as failed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to fail submitted job.");
    }
  }

  function handleLoadSample() {
    setPayloadText(DEFAULT_JOB_PAYLOAD);
    setIdempotencyKey(buildIdempotencyKey(Date.now()));
    setMaxAttempts("3");
    setNotice("");
  }

  return (
    <Panel
      title="Submit Job"
      action={<span className="mutedCopy">WebSocket live updates with SSE fallback</span>}
    >
      <form className="tenantForm" onSubmit={handleSubmit}>
        <label className="tenantField">
          <span>Idempotency Key</span>
          <input
            className="tenantInput"
            type="text"
            value={idempotencyKey}
            onChange={(event) => setIdempotencyKey(event.target.value)}
            placeholder="invoice-12345"
            disabled={!enableMutations || isSubmittingJob}
          />
        </label>
        <label className="tenantField">
          <span>Max Attempts</span>
          <input
            className="tenantInput"
            type="number"
            min="1"
            max="10"
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
            disabled={!enableMutations || isSubmittingJob}
          />
        </label>
        <label className="tenantField">
          <span>Payload JSON</span>
          <textarea
            className="tenantInput composerTextarea"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            spellCheck="false"
            disabled={!enableMutations || isSubmittingJob}
          />
        </label>
        <div className="composerActions">
          <ActionButton label={isSubmittingJob ? "Submitting..." : "Submit Job"} type="submit" disabled={!enableMutations || isSubmittingJob} />
          <ActionButton label="Load Sample" onClick={handleLoadSample} disabled={!enableMutations || isSubmittingJob} tone="blue" />
        </div>
        <p className="mutedCopy">
          Submit any JSON object payload. Include fields like `queue`, `type`, `name`, or your own business fields.
        </p>
        {notice ? <p className="mutedCopy">{notice}</p> : null}
        {submittedJobId ? (
          <div className="submissionFollowup">
            <div className="submissionFollowupHeader">
              <div>
                <p className="primaryCell">Last submitted job</p>
                <p className="secondaryCell">{submittedJobId}</p>
              </div>
              {submittedJob ? (
                <StatusPill
                  status={submittedJob.status}
                  tone={
                    submittedJob.status === "SUCCESS" ? "green" :
                    submittedJob.status === "RUNNING" ? "blue" :
                    submittedJob.status === "PENDING" ? "amber" :
                    "red"
                  }
                />
              ) : (
                <span className="mutedCopy">Waiting for latest state…</span>
              )}
            </div>
            {submittedJob ? (
              <div className="submissionFollowupMeta">
                <span>Queue {getJobQueue(submittedJob)}</span>
                <span>Attempts {submittedJob.attempt_count} / {submittedJob.max_attempts}</span>
                <span>Lease {submittedJob.lease_owner ?? "unclaimed"}</span>
                <span>Created {formatRelativeTimeFromNow(submittedJob.created_at)}</span>
              </div>
            ) : null}
            <div className="composerActions">
              <ActionButton label="Inspect" onClick={handleInspectSubmittedJob} disabled={!enableMutations || isSubmittingJob} />
              <ActionButton label="Refresh Job" onClick={handleRefreshSubmittedJob} disabled={!enableMutations || isSubmittingJob} tone="blue" />
              <ActionButton
                label="Claim Next"
                onClick={handleClaimSubmittedJob}
                disabled={!enableMutations || isSubmittingJob || !canClaimSubmittedJob}
              />
              <ActionButton
                label="Ack"
                onClick={handleAckSubmittedJob}
                disabled={!enableMutations || isSubmittingJob || !canAckOrFailSubmittedJob}
                tone="green"
              />
              <ActionButton
                label="Fail"
                onClick={handleFailSubmittedJob}
                disabled={!enableMutations || isSubmittingJob || !canAckOrFailSubmittedJob}
                tone="red"
              />
            </div>
            <p className="mutedCopy">
              Claim works while the job is pending. Ack and Fail become available once this dashboard worker owns the running lease.
            </p>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

function MetricsGrid({ items }) {
  return (
    <section className="metricsGrid">
      {items.map((item, index) => (
        <MetricCard key={`${item.label}-${index}`} item={item} />
      ))}
    </section>
  );
}

function OverviewMetricsGrid() {
  const { overviewMetricCards } = useDashboardData();
  return <MetricsGrid items={overviewMetricCards} />;
}

function JobMetricsGrid() {
  const { jobMetricCards } = useDashboardData();
  return <MetricsGrid items={jobMetricCards} />;
}

function WorkerMetricsGrid() {
  const { workerMetricCards } = useDashboardData();
  return <MetricsGrid items={workerMetricCards} />;
}

function EventMetricsGrid() {
  const { eventMetricCards } = useDashboardData();
  return <MetricsGrid items={eventMetricCards} />;
}

function QueueMetricsGrid() {
  const { queueMetricCards } = useDashboardData();
  return <MetricsGrid items={queueMetricCards} />;
}

function TimelineChart() {
  const { eventTimeline } = useDashboardData();

  return (
    <div className="timelinePanel">
      <div className="timelineScale">
        <span>80</span>
        <span>40</span>
        <span>0</span>
      </div>
      <div className="timelineChart">
        <div className="timelineGrid" />
        <div className="timelineBars">
          {eventTimeline.map(([tone, height], index) => (
            <span
              key={`${tone}-${index}`}
              className={`timelineBar tone-${tone}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="timelineLabels">
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>20:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
        </div>
      </div>
    </div>
  );
}

function SplitLayout({ left, right }) {
  return (
    <section className="mainGrid">
      <div className="leftColumn">{left}</div>
      <div className="rightColumn">{right}</div>
    </section>
  );
}

function formatFeedTime(value) {
  if (!value || value === "live") {
    return "live";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(11, 19);
}

function UnsupportedFeaturePanel({ title, message }) {
  return (
    <Panel title={title}>
      <p className="mutedCopy">{message}</p>
    </Panel>
  );
}

function OverviewEventsPanel() {
  const { overviewEventsRows } = useDashboardData();

  return (
    <Panel
      className="panelLarge"
      title={
        <div className="panelTitleRow">
          <h2>Events</h2>
          <div className="legend">
            {eventsLegend.map((item, index) => (
              <span key={`${item.label}-${item.tone}-${index}`} className="legendItem">
                <span className={`legendSwatch tone-${item.tone}`} />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      }
      action={<DropdownButton label="Last 24 hours" />}
    >
      <TimelineChart />
      <div className="eventsList">
        {overviewEventsRows.map((row) => (
          <div key={row.id} className="eventRow">
            <div className="eventNameCell">
              <span className={`eventStatusIcon tone-${row.tone}`}>
                <OutlineIcon type={toneIconMap[row.tone]} />
              </span>
              <div>
                <p className="primaryCell">{row.name}</p>
                <p className="secondaryCell">{row.id}</p>
              </div>
            </div>
            <StatusPill status={row.status} tone={row.tone} />
            <p className="detailCell">
              {row.detail.split("\n").map((line, index) => (
                <span key={`${row.id}-detail-${index}`}>{line}</span>
              ))}
            </p>
            <p className="detailCell">
              {row.queue.split("\n").map((line, index) => (
                <span key={`${row.id}-queue-${index}`}>{line}</span>
              ))}
            </p>
            <GhostIconButton label={`${row.name} options`} />
          </div>
        ))}
      </div>
      <a href="#" className="panelLink">
        View all events
      </a>
    </Panel>
  );
}

function QueuePanel() {
  const { queueBreakdown, throughputMetrics } = useDashboardData();
  const circumference = 2 * Math.PI * 66;
  const total = queueBreakdown.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const segments = queueBreakdown.map((item) => {
    const value = total === 0 ? 0 : (item.value / total) * 100;
    const segment = { tone: item.tone, offset, value };
    offset += value;
    return segment;
  });

  return (
    <Panel
      className="queuePanel"
      title="Queue"
      action={<a href="#" className="panelLink topLink">View all queues</a>}
    >
      <div className="queueMain">
        <div className="donutWrap">
          <svg viewBox="0 0 180 180" className="donutChart" aria-hidden="true">
            <circle cx="90" cy="90" r="66" className="donutBase" />
            {segments.map((segment) => (
              <circle
                key={segment.tone}
                cx="90"
                cy="90"
                r="66"
                className={`donutSegment tone-${segment.tone}`}
                strokeDasharray={`${(segment.value / 100) * circumference} ${circumference}`}
                strokeDashoffset={`${-(segment.offset / 100) * circumference}`}
              />
            ))}
          </svg>
          <div className="donutCenter">
            <strong>{total}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="queueLegend">
          {queueBreakdown.map((item, index) => (
            <div key={`${item.label}-${item.tone}-${index}`} className="queueLegendRow">
              <div className="queueLegendLabel">
                <span className={`legendSwatch tone-${item.tone}`} />
                <span>{item.label}</span>
              </div>
              <span>{item.value.toLocaleString()}</span>
              <span className="mutedValue">{item.percent}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="miniMetrics">
        {throughputMetrics.map((item, index) => (
          <div key={`${item.label}-${index}`} className="miniMetric">
            <p className="miniMetricLabel">{item.label}</p>
            <p className="miniMetricValue">
              {item.value}
              <span>{item.suffix}</span>
            </p>
            <Sparkline points={item.sparkline} tone={item.tone} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DlqRecordsPanel() {
  const { dlqRecords } = useDashboardData();

  return (
    <Panel
      className="panelLarge"
      title="DLQ Records"
      action={dlqRecords.length > 0 ? <span className="mutedCopy">{dlqRecords.length} items</span> : null}
    >
      {dlqRecords.length === 0 ? (
        <p className="mutedCopy">No records are currently in the dead-letter queue.</p>
      ) : (
        <div className="jobsTable dlqTable">
          <div className="jobsTableHeader dlqTableHeader">
            <span>Job</span>
            <span>Reason</span>
            <span>Failed</span>
            <span>Payload</span>
          </div>
          {dlqRecords.map((record) => (
            <div key={record.id} className="jobsRow dlqRow">
              <div>
                <p className="primaryCell">{record.jobId}</p>
                <p className="secondaryCell">{record.id}</p>
              </div>
              <div>
                <StatusPill status="DLQ" tone="red" />
                <p className="secondaryCell">{record.reason}</p>
              </div>
              <span>{record.failedAt}</span>
              <span className="jobsPayloadCell">{JSON.stringify(record.payload)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function JobsTablePanel({ compact = false }) {
  const { jobs, rawJobs, workerId, acknowledgeJob, failRunningJob, inspectJob } = useDashboardData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [queueFilter, setQueueFilter] = useState("All Queues");
  const [page, setPage] = useState(1);

  const queueOptions = useMemo(() => {
    const uniqueQueues = [...new Set(jobs.map(([, , , queue]) => queue))].sort();
    return ["All Queues", ...uniqueQueues];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(([name, id, status, queue]) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query === "" || name.toLowerCase().includes(query) || id.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All Statuses" || status === statusFilter;
      const matchesQueue = queueFilter === "All Queues" || queue === queueFilter;
      return matchesSearch && matchesStatus && matchesQueue;
    });
  }, [jobs, queueFilter, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, queueFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / 25));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * 25;
  const visibleJobs = filteredJobs.slice(pageStart, pageStart + 25);
  const visibleStart = filteredJobs.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + visibleJobs.length, filteredJobs.length);

  return (
    <Panel className={compact ? "" : "panelLarge"}>
      <div className="panelHeader jobsHeader">
        <div className="jobsHeaderLeft">
          <h2>Jobs</h2>
          <label className="searchField">
            <OutlineIcon type="search" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="jobsFilters">
          <FilterSelect
            ariaLabel="Filter jobs by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={["All Statuses", "Running", "Queued", "Completed", "Failed"]}
          />
          <FilterSelect
            ariaLabel="Filter jobs by queue"
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
            options={queueOptions}
          />
        </div>
      </div>

      <div className="jobsTable">
        <div className="jobsTableHeader">
          <span>Job Name</span>
          <span>Status</span>
          <span>Queue</span>
          <span>Started</span>
          <span>Duration</span>
          <span>Worker</span>
          <span />
        </div>
        {visibleJobs.map(([name, id, status, queue, started, duration, worker, tone]) => {
          const rawJob = rawJobs.find((job) => String(job.id) === id);
          const canAckOrFail = rawJob?.status === "RUNNING" && rawJob?.lease_owner === workerId;

          return (
          <div key={id} className="jobsRow">
            <div>
              <p className="primaryCell">{name}</p>
              <p className="secondaryCell">{id}</p>
            </div>
            <div>
              <StatusPill status={status} tone={tone} />
            </div>
            <span>{queue}</span>
            <span>{started}</span>
            <span>{duration}</span>
            <span>{worker}</span>
            <div className="rowActions">
              <ActionButton label="Inspect" onClick={() => inspectJob(id)} />
              {canAckOrFail ? <ActionButton label="Ack" onClick={() => acknowledgeJob(id)} tone="green" /> : null}
              {canAckOrFail ? <ActionButton label="Fail" onClick={() => failRunningJob(id)} tone="red" /> : null}
              <GhostIconButton label={`${name} actions`} />
            </div>
          </div>
        )})}
      </div>

      <div className="jobsFooter">
        <a href="#" className="panelLink">
          View all jobs
        </a>
        <div className="paginationRow">
          <span>{filteredJobs.length === 0 ? "0 of 0" : `${visibleStart}-${visibleEnd} of ${filteredJobs.length}`}</span>
          <div className="paginationButtons">
            <button className="pageButton" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <OutlineIcon type="chevronLeft" />
            </button>
            <button className="pageButton" type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <OutlineIcon type="chevronRight" />
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RecentActivityPanel() {
  const { recentActivity } = useDashboardData();

  return (
    <Panel
      className="activityPanel"
      title="Recent Activity"
      action={<a href="#" className="panelLink topLink">View all</a>}
    >
      <div className="activityList">
        {recentActivity.map(([title, id, age, tone]) => (
          <div key={id} className="activityRow">
            <div className="activityMain">
              <span className={`eventStatusIcon tone-${tone}`}>
                <OutlineIcon type={toneIconMap[tone]} />
              </span>
              <div>
                <p className="primaryCell">{title}</p>
                <p className="secondaryCell">{id}</p>
              </div>
            </div>
            <div className="activityMeta">
              <span>{age}</span>
              <GhostIconButton label={`${title} options`} />
            </div>
          </div>
        ))}
      </div>
      <a href="#" className="panelLink">
        View all activity
      </a>
    </Panel>
  );
}

function JobsInsightsPanel() {
  const { jobQueues, jobStageDistribution } = useDashboardData();

  return (
    <Panel title="Pipeline Distribution" action={<DropdownButton label="Past 6 hours" />}>
      <MiniBarList items={jobStageDistribution} />
      <div className="stackedCards">
        {jobQueues.map((queue) => (
          <div key={queue.name} className="stackedCard">
            <div className="stackedCardHeader">
              <div>
                <p className="primaryCell">{queue.name}</p>
                <p className="secondaryCell">{queue.workers}</p>
              </div>
              <StatusPill status={`${queue.running} running`} tone={queue.tone} />
            </div>
            <div className="dataKeyValue">
              <span>Queued</span>
              <span>{queue.queued}</span>
            </div>
            <div className="dataKeyValue">
              <span>Throughput</span>
              <span>{queue.throughput}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WorkersGridPanel() {
  const { workers } = useDashboardData();

  return (
    <Panel title="Worker Fleet" action={<DropdownButton label="us-east-1" />}>
      <div className="resourceGrid">
        {workers.map((worker) => (
          <article key={worker.name} className="resourceCard">
            <div className="resourceCardHeader">
              <div>
                <p className="primaryCell">{worker.name}</p>
                <p className="secondaryCell">{worker.queue} · {worker.zone}</p>
              </div>
              <StatusPill status={worker.status} tone={worker.statusTone} />
            </div>
            <div className="resourceMetrics">
              <div><span>CPU</span><strong>{worker.cpu}</strong></div>
              <div><span>Memory</span><strong>{worker.memory}</strong></div>
              <div><span>Jobs</span><strong>{worker.jobs}</strong></div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function WorkerActivityPanel() {
  const { workerActivity, isRunningWorker, triggerWorkerPass } = useDashboardData();

  return (
    <Panel title="Fleet Activity" action={<ActionButton label={isRunningWorker ? "Running..." : "Run once"} onClick={triggerWorkerPass} disabled={isRunningWorker} tone="blue" />}>
      <div className="activityList">
        {workerActivity.map(([title, description, age, tone], index) => (
          <div key={`${title}-${age}-${index}`} className="activityRow">
            <div className="activityMain">
              <span className={`eventStatusIcon tone-${tone}`}>
                <OutlineIcon type={toneIconMap[tone]} />
              </span>
              <div>
                <p className="primaryCell">{title}</p>
                <p className="secondaryCell">{description}</p>
              </div>
            </div>
            <span className="mutedValue">{age}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EventFeedPanel() {
  const { eventFeed, liveJobEvents } = useDashboardData();
  const displayEvents = liveJobEvents.length > 0
    ? liveJobEvents.map((event) => ({
        key: event.__eventKey ?? `${event.type}-${event.jobId}-${event.status}`,
        title: event.type.replaceAll("_", " "),
        stream: "events.jobs",
        detail: `job ${event.jobId} · status ${event.status}${event.workerId ? ` · ${event.workerId}` : ""}${event.reason ? ` · ${event.reason}` : ""}`,
        tone:
          event.type === "JOB_FAILED" || event.type === "JOB_MOVED_TO_DLQ" ? "red" :
          event.type === "JOB_ACKED" ? "green" :
          event.type === "JOB_CLAIMED" ? "blue" :
          "amber",
        time: formatFeedTime(event.occurredAt ?? event.timestamp ?? "live"),
      }))
    : eventFeed.map((item, index) => ({ ...item, key: item.key ?? `${item.title}-${item.time}-${index}` }));

  return (
    <Panel title="Live Feed" action={<DropdownButton label="All streams" />}>
      <div className="activityList">
        {displayEvents.map((item) => (
          <div key={item.key} className="activityRow">
            <div className="activityMain">
              <span className={`eventStatusIcon tone-${item.tone}`}>
                <OutlineIcon type={toneIconMap[item.tone]} />
              </span>
              <div>
                <p className="primaryCell">{item.title}</p>
                <p className="secondaryCell">{item.stream} · {item.detail}</p>
              </div>
            </div>
            <span className="mutedValue">{item.time}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EventSubscribersPanel() {
  const { eventSubscribers, eventStreamStatus } = useDashboardData();
  const subscribers = [
    {
      name: "browser.sse.events.jobs",
      latency: eventStreamStatus === "connected" ? "streaming" : "n/a",
      status: eventStreamStatus === "connected" ? "Connected" : eventStreamStatus === "error" ? "Error" : "Connecting",
      tone: eventStreamStatus === "connected" ? "green" : eventStreamStatus === "error" ? "red" : "amber",
    },
    ...eventSubscribers,
  ];

  return (
    <Panel title="Subscribers" action={<a href="#" className="panelLink topLink">View topology</a>}>
      <div className="jobsTable subscribersTable">
        <div className="jobsTableHeader">
          <span>Name</span>
          <span>Status</span>
          <span>Latency</span>
          <span />
        </div>
        {subscribers.map((subscriber) => (
          <div key={subscriber.name} className="jobsRow subscribersRow">
            <div><p className="primaryCell">{subscriber.name}</p></div>
            <div><StatusPill status={subscriber.status} tone={subscriber.tone} /></div>
            <span>{subscriber.latency}</span>
            <GhostIconButton label={`${subscriber.name} options`} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SchedulesPanel() {
  const { schedules } = useDashboardData();

  return (
    <Panel title="Upcoming Schedules" action={<DropdownButton label="This week" />}>
      <div className="stackedCards">
        {schedules.map((schedule) => (
          <div key={schedule.name} className="stackedCard">
            <div className="stackedCardHeader">
              <div>
                <p className="primaryCell">{schedule.name}</p>
                <p className="secondaryCell">{schedule.cadence}</p>
              </div>
              <StatusPill status={schedule.status} tone={schedule.tone} />
            </div>
            <div className="dataKeyValue">
              <span>Next run</span>
              <span>{schedule.next}</span>
            </div>
            <div className="dataKeyValue">
              <span>Owner</span>
              <span>{schedule.owner}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ScheduleLoadPanel() {
  const { scheduleCalendar } = useDashboardData();

  return (
    <Panel title="Run Density" action={<DropdownButton label="7 day horizon" />}>
      <MiniBarList items={scheduleCalendar} keyLabel="day" />
      <div className="calendarLegend">
        <span>Peak load Sunday due to compliance jobs and billing exports.</span>
      </div>
    </Panel>
  );
}

function QueueHealthPanel() {
  const { queueRows } = useDashboardData();

  return (
    <Panel title="Queue Health" action={<DropdownButton label="Backlog descending" />}>
      <div className="stackedCards">
        {queueRows.map((queue) => (
          <div key={queue.name} className="stackedCard">
            <div className="stackedCardHeader">
              <div>
                <p className="primaryCell">{queue.name}</p>
                <p className="secondaryCell">{queue.workerPool}</p>
              </div>
              <StatusPill status={queue.sla} tone={queue.tone} />
            </div>
            <div className="resourceMetrics twoColumn">
              <div><span>Backlog</span><strong>{queue.backlog}</strong></div>
              <div><span>Oldest age</span><strong>{queue.oldest}</strong></div>
            </div>
            <Sparkline points={queue.sparkline} tone={queue.tone} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TemplatesPanel() {
  const { templates } = useDashboardData();

  return (
    <Panel title="Templates Library" action={<DropdownButton label="Most used" />}>
      <div className="resourceGrid">
        {templates.map((template) => (
          <article key={template.name} className="resourceCard">
            <div className="resourceCardHeader">
              <div>
                <p className="primaryCell">{template.name}</p>
                <p className="secondaryCell">{template.category} · {template.version}</p>
              </div>
              <span className={`templateDot tone-${template.tone}`} />
            </div>
            <div className="resourceMetrics twoColumn">
              <div><span>Tasks</span><strong>{template.tasks}</strong></div>
              <div><span>Owner</span><strong>{template.owner}</strong></div>
            </div>
            <p className="secondaryCell">{template.usage}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function AlertsPanel() {
  const { alerts } = useDashboardData();

  return (
    <Panel title="Open Alerts" action={<DropdownButton label="Severity" />}>
      <div className="activityList">
        {alerts.map((alert) => (
          <div key={alert.title} className="activityRow">
            <div className="activityMain">
              <span className={`eventStatusIcon tone-${alert.tone}`}>
                <OutlineIcon type={toneIconMap[alert.tone]} />
              </span>
              <div>
                <p className="primaryCell">{alert.title}</p>
                <p className="secondaryCell">{alert.scope} · Owner: {alert.owner}</p>
              </div>
            </div>
            <div className="activityMeta">
              <StatusPill status={alert.severity} tone={alert.tone} />
              <span>{alert.age}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SettingsPanel() {
  const { backendApiInventory, planCatalog, backendHealth, backendGreeting } = useDashboardData();

  return (
    <Panel title="Configuration" action={<DropdownButton label="Production" />}>
      <div className="settingsGrid settingsGridWide">
        <article className="settingsCard">
          <div className="settingsCardHeader">
            <h3>Backend Status</h3>
            <p>{backendGreeting ?? "No greeting available"}</p>
          </div>
          <div className="settingsList">
            <div className="dataKeyValue"><span>Status</span><span>{backendHealth?.status ?? "Unknown"}</span></div>
            <div className="dataKeyValue"><span>Database</span><span>{backendHealth?.database ?? "Unknown"}</span></div>
            <div className="dataKeyValue"><span>Time</span><span>{backendHealth?.time ? formatAbsoluteDateTime(backendHealth.time) : "Unknown"}</span></div>
          </div>
        </article>
        <article className="settingsCard">
          <div className="settingsCardHeader">
            <h3>Available APIs</h3>
            <p>Integrated backend endpoints</p>
          </div>
          <div className="settingsList">
            {backendApiInventory.map((api) => (
              <div key={`${api.method}-${api.path}`} className="dataKeyValue">
                <span>{api.method} {api.path}</span>
                <span>{api.feature}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="settingsCard">
          <div className="settingsCardHeader">
            <h3>Plan Catalog</h3>
            <p>Fetched from `GET /plans`</p>
          </div>
          <div className="settingsList">
            {planCatalog.map((plan) => (
              <div key={plan.id} className="dataKeyValue">
                <span>{plan.name}</span>
                <span>{plan.max_concurrent_jobs} workers · {plan.rate_limit_per_minute}/min</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </Panel>
  );
}

function TenantsPanel() {
  const { planCatalog } = useDashboardData();
  const [tenantName, setTenantName] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(planCatalog[0]?.id ?? "");
  const [storedTenants, setStoredTenants] = useState([]);
  const [activeApiKey, setActiveApiKey] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [tenantNotice, setTenantNotice] = useState("");

  useEffect(() => {
    setActiveApiKey(getActiveTenantApiKey());
    void loadTenants();
  }, []);

  useEffect(() => {
    if (!selectedPlanId && planCatalog[0]?.id) {
      setSelectedPlanId(planCatalog[0].id);
    }
  }, [planCatalog, selectedPlanId]);

  const selectedPlan = planCatalog.find((plan) => plan.id === selectedPlanId) ?? planCatalog[0] ?? null;

  async function loadTenants() {
    setIsLoadingTenants(true);

    try {
      const tenants = await fetchTenantsFromBackend();
      setStoredTenants(tenants);
    } catch (error) {
      setTenantNotice(error instanceof Error ? error.message : "Failed to load tenants.");
    } finally {
      setIsLoadingTenants(false);
    }
  }

  async function handleCreateTenant() {
    if (tenantName.trim().length < 3 || !selectedPlanId) {
      setTenantNotice("Tenant name must be at least 3 characters and a plan must be selected.");
      return;
    }

    setIsCreatingTenant(true);
    setTenantNotice("");

    try {
      const tenant = await createTenant(tenantName.trim(), selectedPlanId);
      await loadTenants();
      setActiveApiKey(tenant.apiKey);
      setTenantName("");
      setTenantNotice(`Tenant ${tenant.name} created and activated.`);
    } catch (error) {
      setTenantNotice(error instanceof Error ? error.message : "Failed to create tenant.");
    } finally {
      setIsCreatingTenant(false);
    }
  }

  function handleActivateTenant(apiKey) {
    activateTenantApiKey(apiKey);
    setActiveApiKey(apiKey);
    setTenantNotice("Active tenant switched. Refresh any dashboard page to load that tenant's data.");
  }

  return (
    <div className="settingsGrid settingsGridWide">
      <article className="settingsCard">
        <div className="settingsCardHeader">
          <h3>Create Tenant</h3>
          <p>Create a tenant with a plan and store it locally for quick switching.</p>
        </div>
        <div className="tenantForm">
          <label className="tenantField">
            <span>Tenant name</span>
            <input
              className="tenantInput"
              type="text"
              value={tenantName}
              onChange={(event) => setTenantName(event.target.value)}
              placeholder="Acme"
            />
          </label>
          <label className="tenantField">
            <span>Plan</span>
            <select className="tenantInput" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
              {planCatalog.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          {selectedPlan ? (
            <div className="settingsList">
              <div className="dataKeyValue"><span>Rate limit</span><span>{selectedPlan.rate_limit_per_minute}/min</span></div>
              <div className="dataKeyValue"><span>Max concurrent jobs</span><span>{selectedPlan.max_concurrent_jobs}</span></div>
            </div>
          ) : (
            <p className="mutedCopy">No plans available yet.</p>
          )}
          <ActionButton label={isCreatingTenant ? "Creating..." : "Create Tenant"} onClick={handleCreateTenant} disabled={isCreatingTenant || planCatalog.length === 0} tone="blue" />
          {tenantNotice ? <p className="mutedCopy">{tenantNotice}</p> : null}
        </div>
      </article>

      <article className="settingsCard">
        <div className="settingsCardHeader">
          <h3>Stored Tenants</h3>
          <p>This list comes directly from the backend `GET /tenants` API.</p>
        </div>
        {isLoadingTenants ? (
          <p className="mutedCopy">Loading tenants...</p>
        ) : storedTenants.length === 0 ? (
          <p className="mutedCopy">No tenants have been created from this browser yet.</p>
        ) : (
          <div className="settingsList">
            {storedTenants.map((tenant) => (
              <div key={tenant.id} className="tenantRow">
                <div>
                  <p className="primaryCell">{tenant.name}</p>
                  <p className="secondaryCell">{tenant.id} · {tenant.plan_name ?? tenant.planId}</p>
                </div>
                <div className="tenantRowMeta">
                  <span className="secondaryCell">
                    {tenant.created_at ? formatAbsoluteDateTime(tenant.created_at) : tenant.createdAt ? formatAbsoluteDateTime(tenant.createdAt) : "—"}
                  </span>
                  {tenant.api_key === activeApiKey || tenant.apiKey === activeApiKey ? (
                    <StatusPill status="Active" tone="green" />
                  ) : (
                    <ActionButton label="Use" onClick={() => handleActivateTenant(tenant.api_key ?? tenant.apiKey)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function SimulatorPanel() {
  const { refreshDashboardData } = useDashboardData();
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [jobCount, setJobCount] = useState("1000");
  const [workerCount, setWorkerCount] = useState("5");
  const [failureRatePercent, setFailureRatePercent] = useState("20");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [jobDurationMs, setJobDurationMs] = useState("0");
  const [queueNames, setQueueNames] = useState("default,billing,maintenance");
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [simulationNotice, setSimulationNotice] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);

  useEffect(() => {
    void loadTenants();
  }, []);

  async function loadTenants() {
    setIsLoadingTenants(true);

    try {
      const nextTenants = await fetchTenantsFromBackend();
      setTenants(nextTenants);
      setSelectedTenantId((current) => current || nextTenants[0]?.id || "");
    } catch (error) {
      setSimulationNotice(error instanceof Error ? error.message : "Failed to load tenants.");
    } finally {
      setIsLoadingTenants(false);
    }
  }

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;

  async function handleStartSimulation() {
    if (!selectedTenant?.api_key) {
      setSimulationNotice("Select a tenant with a valid API key before starting the simulator.");
      return;
    }

    setIsStartingSimulation(true);
    setSimulationNotice("");

    try {
      activateTenantApiKey(selectedTenant.api_key);

      const result = await startWorkerSimulation(selectedTenant.api_key, {
        jobCount: Number(jobCount),
        workerCount: Number(workerCount),
        failureRatePercent: Number(failureRatePercent),
        maxAttempts: Number(maxAttempts),
        jobDurationMs: Number(jobDurationMs),
        queueNames: queueNames
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });

      setSimulationResult(result);
      setSimulationNotice(
        `Simulation ${result.simulationId} started for ${selectedTenant.name}. Simulated worker events now advance every 2 seconds.`,
      );
      await refreshDashboardData();
    } catch (error) {
      setSimulationNotice(error instanceof Error ? error.message : "Failed to start simulation.");
    } finally {
      setIsStartingSimulation(false);
    }
  }

  return (
    <div className="settingsGrid settingsGridWide">
      <article className="settingsCard">
        <div className="settingsCardHeader">
          <h3>Simulate Worker Events</h3>
          <p>Seed jobs for one tenant and run multiple simulated workers that claim then ack or fail jobs with a 2 second delay between events.</p>
        </div>
        <div className="tenantForm">
          <label className="tenantField">
            <span>Tenant</span>
            <select className="tenantInput" value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} disabled={isLoadingTenants || tenants.length === 0}>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tenantField">
            <span>Total jobs</span>
            <input className="tenantInput" type="number" min="1" max="5000" value={jobCount} onChange={(event) => setJobCount(event.target.value)} />
          </label>
          <label className="tenantField">
            <span>Worker count</span>
            <input className="tenantInput" type="number" min="1" max="100" value={workerCount} onChange={(event) => setWorkerCount(event.target.value)} />
          </label>
          <label className="tenantField">
            <span>Failure rate %</span>
            <input className="tenantInput" type="number" min="0" max="100" value={failureRatePercent} onChange={(event) => setFailureRatePercent(event.target.value)} />
          </label>
          <label className="tenantField">
            <span>Max attempts</span>
            <input className="tenantInput" type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} />
          </label>
          <label className="tenantField">
            <span>Job duration (ms)</span>
            <input className="tenantInput" type="number" min="0" max="30000" value={jobDurationMs} onChange={(event) => setJobDurationMs(event.target.value)} />
          </label>
          <label className="tenantField">
            <span>Queues</span>
            <input className="tenantInput" type="text" value={queueNames} onChange={(event) => setQueueNames(event.target.value)} placeholder="default,billing,maintenance" />
          </label>
          {selectedTenant ? (
            <div className="settingsList">
              <div className="dataKeyValue"><span>Plan</span><span>{selectedTenant.plan_name}</span></div>
              <div className="dataKeyValue"><span>Rate limit</span><span>{selectedTenant.rate_limit_per_minute}/min</span></div>
              <div className="dataKeyValue"><span>Max concurrent jobs</span><span>{selectedTenant.max_concurrent_jobs}</span></div>
              <div className="dataKeyValue"><span>Simulation pacing</span><span>2 seconds between simulated events</span></div>
            </div>
          ) : (
            <p className="mutedCopy">Load or create a tenant first.</p>
          )}
          <ActionButton label={isStartingSimulation ? "Starting..." : "Start Simulation"} onClick={handleStartSimulation} disabled={isStartingSimulation || isLoadingTenants || !selectedTenant} tone="blue" />
          {simulationNotice ? <p className="mutedCopy">{simulationNotice}</p> : null}
        </div>
      </article>

      <article className="settingsCard">
        <div className="settingsCardHeader">
          <h3>Latest Run</h3>
          <p>Once a run starts, open your live dashboard views and watch the websocket-driven status changes arrive.</p>
        </div>
        {simulationResult ? (
          <div className="settingsList">
            <div className="dataKeyValue"><span>Simulation ID</span><span>{simulationResult.simulationId}</span></div>
            <div className="dataKeyValue"><span>Status</span><span>{simulationResult.status}</span></div>
            <div className="dataKeyValue"><span>Seeded jobs</span><span>{simulationResult.seededJobs}</span></div>
            <div className="dataKeyValue"><span>Workers</span><span>{simulationResult.workerIds?.length ?? 0}</span></div>
            <div className="dataKeyValue"><span>Delay</span><span>{simulationResult.eventDelayMs} ms</span></div>
          </div>
        ) : (
          <p className="mutedCopy">No simulation has been started yet.</p>
        )}
      </article>
    </div>
  );
}

export function DashboardPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Overview" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <OverviewMetricsGrid />
        <SplitLayout
          left={
            <>
              <OverviewEventsPanel />
              <DlqRecordsPanel />
              <JobsTablePanel />
            </>
          }
          right={
            <>
              <SubmitJobPanel />
              <QueuePanel />
              <RecentActivityPanel />
            </>
          }
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function JobsPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Jobs" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <JobMetricsGrid />
        <SplitLayout left={<JobsTablePanel compact />} right={<><SubmitJobPanel /><JobsInsightsPanel /><RecentActivityPanel /><JobDetailPanel /></>} />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function WorkersPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Workers" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <WorkerMetricsGrid />
        <SplitLayout
          left={
            <UnsupportedFeaturePanel
              title="Worker Fleet Telemetry Unavailable"
              message="Dedicated worker telemetry APIs for CPU, memory, zone, and heartbeat health are not available yet, so the static worker fleet cards have been removed from this page."
            />
          }
          right={<WorkerActivityPanel />}
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function EventsPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Events" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <EventMetricsGrid />
        <SplitLayout
          left={
            <>
              <Panel title="Event Volume" action={<DropdownButton label="Last 24 hours" />}>
                <TimelineChart />
              </Panel>
              <EventFeedPanel />
            </>
          }
          right={
            <UnsupportedFeaturePanel
              title="Subscriber Topology Unavailable"
              message="Queue topology and subscriber graph APIs are not exposed by the backend yet, so the static subscriber panel has been removed."
            />
          }
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function SchedulesPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Schedules" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <UnsupportedFeaturePanel
          title="Schedules Unavailable"
          message="Schedules management and execution APIs are not available in the backend yet, so the static schedules UI has been removed."
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function QueuesPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Queues" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <QueueMetricsGrid />
        <SplitLayout left={<QueueHealthPanel />} right={<QueuePanel />} />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function TemplatesPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Templates" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <UnsupportedFeaturePanel
          title="Templates Unavailable"
          message="Template library CRUD and usage analytics APIs are not available in the backend yet, so the static templates UI has been removed."
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function AlertsPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Alerts" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <UnsupportedFeaturePanel
          title="Alerts Unavailable"
          message="Alert rules, muting, acknowledgements, and alert history APIs are not available in the backend yet, so the static alerts UI has been removed."
        />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function SettingsPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Settings" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <SettingsPanel />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function TenantsPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Tenants" notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <TenantsPanel />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

export function SimulatorPage({ data }) {
  const content = data ?? defaultDashboardData;

  return (
    <DashboardDataProvider data={content}>
      <DashboardShell title="Simulator" toolbar={<DefaultToolbar />} notice={content.integrationNotice} health={content.backendHealth} greeting={content.backendGreeting}>
        <SimulatorPanel />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

function JobDetailPanel() {
  const { selectedJobDetail } = useDashboardData();
  const lastActivityAt =
    selectedJobDetail?.completed_at ??
    selectedJobDetail?.started_at ??
    selectedJobDetail?.created_at ??
    null;

  return (
    <Panel title="Job Detail">
      {selectedJobDetail ? (
        <div className="settingsList">
          <div className="dataKeyValue"><span>ID</span><span>{selectedJobDetail.id}</span></div>
          <div className="dataKeyValue"><span>Status</span><span>{selectedJobDetail.status}</span></div>
          <div className="dataKeyValue"><span>Attempts</span><span>{selectedJobDetail.attempt_count} / {selectedJobDetail.max_attempts}</span></div>
          <div className="dataKeyValue"><span>Lease Owner</span><span>{selectedJobDetail.lease_owner ?? "—"}</span></div>
          <div className="dataKeyValue"><span>Created At</span><span>{formatAbsoluteDateTime(selectedJobDetail.created_at)}</span></div>
          <div className="dataKeyValue"><span>Created Age</span><span>{formatRelativeTimeFromNow(selectedJobDetail.created_at)}</span></div>
          <div className="dataKeyValue"><span>Last Activity At</span><span>{formatAbsoluteDateTime(lastActivityAt)}</span></div>
          <div className="dataKeyValue"><span>Last Activity Age</span><span>{formatRelativeTimeFromNow(lastActivityAt)}</span></div>
          <div className="dataKeyValue dataKeyValueWrap"><span>Payload</span><span>{JSON.stringify(selectedJobDetail.payload)}</span></div>
        </div>
      ) : (
        <p className="mutedCopy">Inspect a job to load `GET /jobs/:id` details.</p>
      )}
    </Panel>
  );
}
