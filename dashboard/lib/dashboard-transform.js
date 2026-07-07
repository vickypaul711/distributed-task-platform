import { defaultDashboardData } from "../components/dashboard/data";

const STATUS_META = {
  PENDING: { label: "Queued", tone: "amber" },
  RUNNING: { label: "Running", tone: "blue" },
  SUCCESS: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  DLQ: { label: "Failed", tone: "red" },
};

export function cloneDefaultData() {
  return {
    ...defaultDashboardData,
    overviewMetricCards: [...defaultDashboardData.overviewMetricCards],
    eventsLegend: [...defaultDashboardData.eventsLegend],
    eventTimeline: [...defaultDashboardData.eventTimeline],
    overviewEventsRows: [...defaultDashboardData.overviewEventsRows],
    queueBreakdown: [...defaultDashboardData.queueBreakdown],
    throughputMetrics: [...defaultDashboardData.throughputMetrics],
    jobs: [...defaultDashboardData.jobs],
    recentActivity: [...defaultDashboardData.recentActivity],
    jobMetricCards: [...defaultDashboardData.jobMetricCards],
    jobStageDistribution: [...defaultDashboardData.jobStageDistribution],
    jobQueues: [...defaultDashboardData.jobQueues],
    workerMetricCards: [...defaultDashboardData.workerMetricCards],
    workers: [...defaultDashboardData.workers],
    workerActivity: [...defaultDashboardData.workerActivity],
    eventMetricCards: [...defaultDashboardData.eventMetricCards],
    eventFeed: [...defaultDashboardData.eventFeed],
    eventSubscribers: [...defaultDashboardData.eventSubscribers],
    scheduleMetricCards: [...defaultDashboardData.scheduleMetricCards],
    schedules: [...defaultDashboardData.schedules],
    scheduleCalendar: [...defaultDashboardData.scheduleCalendar],
    queueMetricCards: [...defaultDashboardData.queueMetricCards],
    queueRows: [...defaultDashboardData.queueRows],
    templateMetricCards: [...defaultDashboardData.templateMetricCards],
    templates: [...defaultDashboardData.templates],
    alertMetricCards: [...defaultDashboardData.alertMetricCards],
    alerts: [...defaultDashboardData.alerts],
    settingsGroups: [...defaultDashboardData.settingsGroups],
    dlqRecords: [],
  };
}

function titleize(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSnapshotTime(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function formatRelativeTime(value, now) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = now - date.getTime();
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

function formatDuration(startedAt, completedAt, now) {
  if (!startedAt) {
    return "—";
  }

  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date(now);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }

  const totalSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatPercent(value, total) {
  if (!total) {
    return "0.0%";
  }

  return `${((value / total) * 100).toFixed(1)}%`;
}

function metricChange(current, comparisonLabel, comparisonValue) {
  const delta = current - comparisonValue;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta} vs ${comparisonLabel}`;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function safeQueue(job) {
  return job.payload?.queue ?? job.payload?.type ?? "default";
}

function safeName(job) {
  return job.payload?.name ?? titleize(job.payload?.type ?? `job ${String(job.id).slice(0, 8)}`);
}

function jobStatus(job) {
  return STATUS_META[job.status] ?? { label: titleize(job.status), tone: "blue" };
}

function jobActivityAt(job) {
  return job.completed_at ?? job.started_at ?? job.created_at ?? null;
}

function dlqFailedAt(record) {
  return record.failed_at ?? record.failedAt ?? record.created_at ?? record.createdAt ?? null;
}

function buildSparkline(values, minimum = 0) {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (cleaned.length === 0) {
    return [minimum, minimum, minimum, minimum];
  }

  while (cleaned.length < 12) {
    cleaned.unshift(minimum);
  }

  return cleaned.slice(-12);
}

function buildBucketSeries(
  items,
  getTimestamp,
  {
    bucketCount = 12,
    getValue = () => 1,
    mode = "count",
    minimum = 0,
    minimumWindowMs = 60 * 60 * 1000,
  } = {},
) {
  const entries = items
    .map((item) => ({
      time: new Date(getTimestamp(item)).getTime(),
      value: getValue(item),
    }))
    .filter(({ time, value }) => Number.isFinite(time) && Number.isFinite(value))
    .sort((left, right) => left.time - right.time);

  if (entries.length === 0) {
    return Array(bucketCount).fill(minimum);
  }

  const lastTime = entries[entries.length - 1].time;
  const firstTime = entries[0].time;
  const windowMs = Math.max(minimumWindowMs, lastTime - firstTime || 0);
  const startTime = lastTime - windowMs;
  const sums = Array(bucketCount).fill(0);
  const counts = Array(bucketCount).fill(0);

  entries.forEach(({ time, value }) => {
    const position = Math.max(0, Math.min(1, (time - startTime) / windowMs));
    const index = Math.min(bucketCount - 1, Math.floor(position * bucketCount));
    sums[index] += value;
    counts[index] += 1;
  });

  return sums.map((sum, index) => {
    if (mode === "average") {
      return counts[index] > 0 ? Math.round(sum / counts[index]) : minimum;
    }

    return counts[index];
  });
}

function buildTimeline(jobs) {
  const recent = [...jobs]
    .sort((left, right) => new Date(jobActivityAt(left)) - new Date(jobActivityAt(right)))
    .slice(-28);

  if (recent.length === 0) {
    return defaultDashboardData.eventTimeline;
  }

  return recent.map((job) => {
    const { tone } = jobStatus(job);
    const height =
      job.status === "RUNNING" ? 62 :
      job.status === "SUCCESS" ? 40 :
      job.status === "PENDING" ? 28 :
      74;

    return [tone, height];
  });
}

export function buildDashboardData({ metrics, jobs, dlq, autoscaling, backendBaseUrl, snapshotTime }) {
  const now = normalizeSnapshotTime(snapshotTime);
  const dlqRecords = Array.isArray(dlq) ? dlq : dlq?.records ?? [];
  const dlqTotal = Array.isArray(dlq) ? dlq.length : dlq?.total ?? dlqRecords.length;
  const fallbackMetrics = metrics?.jobs ?? {};
  const totalJobs = jobs.length || fallbackMetrics.total || 0;
  const pendingJobs = jobs.filter((job) => job.status === "PENDING").length || fallbackMetrics.pending || 0;
  const runningJobs = jobs.filter((job) => job.status === "RUNNING").length || fallbackMetrics.running || 0;
  const completedJobs = jobs.filter((job) => job.status === "SUCCESS").length || fallbackMetrics.success || 0;
  const failedJobs = jobs.filter((job) => job.status === "FAILED" || job.status === "DLQ").length || fallbackMetrics.failed || 0;
  const jobsWithAttempts = jobs.filter((job) => job.attempt_count > 0);
  const jobsByQueue = groupBy(jobs, safeQueue);
  const jobsByWorker = groupBy(
    jobs.filter((job) => job.lease_owner),
    (job) => job.lease_owner,
  );
  const sortedJobs = [...jobs].sort((left, right) => new Date(jobActivityAt(right)) - new Date(jobActivityAt(left)));
  const recentJobs = sortedJobs.slice(0, 8);
  const jobsLastHour = jobs.filter((job) => now - new Date(jobActivityAt(job)).getTime() <= 3600000);
  const completedDurations = jobs
    .filter((job) => job.started_at && job.completed_at)
    .map((job) => (new Date(job.completed_at) - new Date(job.started_at)) / 1000)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const avgDurationSeconds = completedDurations.length
    ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
    : 0;
  const successRate = totalJobs === 0 ? 100 : Math.round((completedJobs / totalJobs) * 1000) / 10;
  const workerNames = Object.keys(jobsByWorker);
  const queueNames = Object.keys(jobsByQueue);
  const backlogTotal = pendingJobs + runningJobs;
  const failedItems = recentJobs.filter((job) => job.status === "FAILED" || job.status === "DLQ");
  const payloadTypes = groupBy(jobs, (job) => job.payload?.type ?? "unknown");

  const queueRows = Object.entries(jobsByQueue)
    .map(([queueName, queueJobs]) => {
      const pending = queueJobs.filter((job) => job.status === "PENDING").length;
      const running = queueJobs.filter((job) => job.status === "RUNNING").length;
      const failed = queueJobs.filter((job) => job.status === "FAILED" || job.status === "DLQ").length;
      const oldestPending = [...queueJobs]
        .filter((job) => job.status === "PENDING" || job.status === "RUNNING")
        .sort((left, right) => new Date(jobActivityAt(left)) - new Date(jobActivityAt(right)))[0];
      const tone = failed > 0 ? "red" : pending > 0 ? "amber" : "green";

      return {
        name: queueName,
        backlog: pending + running,
        oldest: oldestPending ? formatRelativeTime(jobActivityAt(oldestPending), now) : "—",
        workerPool: `${new Set(queueJobs.map((job) => job.lease_owner).filter(Boolean)).size} workers`,
        sla: failed > 0 ? "Breached" : pending > 0 ? "Watch" : "Healthy",
        tone,
        sparkline: buildSparkline(queueJobs.slice(-9).map((job) => (
          job.status === "RUNNING" ? 3 :
          job.status === "PENDING" ? 2 :
          job.status === "SUCCESS" ? 1 :
          4
        ))).slice(-9),
      };
    })
    .sort((left, right) => right.backlog - left.backlog);

  const queueBreakdown = [
    { label: "Running", value: runningJobs, percent: formatPercent(runningJobs, totalJobs), tone: "blue" },
    { label: "Queued", value: pendingJobs, percent: formatPercent(pendingJobs, totalJobs), tone: "amber" },
    { label: "Failed", value: failedJobs, percent: formatPercent(failedJobs, totalJobs), tone: "red" },
    { label: "Completed", value: completedJobs, percent: formatPercent(completedJobs, totalJobs), tone: "green" },
  ];

  const workers = workerNames.length > 0
    ? workerNames.map((workerName) => {
        const workerJobs = jobsByWorker[workerName];
        const running = workerJobs.filter((job) => job.status === "RUNNING").length;
        const hasFailures = workerJobs.some((job) => job.status === "FAILED" || job.status === "DLQ");

        return {
          name: workerName,
          queue: titleize(new Set(workerJobs.map(safeQueue)).values().next().value ?? "default"),
          status: hasFailures ? "Warning" : running > 0 ? "Healthy" : "Idle",
          statusTone: hasFailures ? "amber" : running > 0 ? "green" : "blue",
          cpu: "n/a",
          memory: "n/a",
          jobs: workerJobs.length,
          zone: "tenant scoped",
        };
      })
    : [
        {
          name: "No active workers",
          queue: "default",
          status: "Idle",
          statusTone: "blue",
          cpu: "n/a",
          memory: "n/a",
          jobs: 0,
          zone: "tenant scoped",
        },
      ];

  return {
    ...cloneDefaultData(),
    integrationNotice: `Live data is being read directly from the backend service at ${backendBaseUrl}.`,
    overviewMetricCards: [
      { label: "Running", value: String(runningJobs), change: metricChange(runningJobs, "queued", pendingJobs), tone: "blue", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "RUNNING" ? 1 : 0)) },
      { label: "Queued", value: String(pendingJobs), change: metricChange(pendingJobs, "running", runningJobs), tone: "amber", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "PENDING" ? 1 : 0)) },
      { label: "Failed", value: String(failedJobs), change: `${dlqTotal} in DLQ`, tone: "red", sparkline: buildSparkline(jobs.slice(-12).map((job) => (job.status === "FAILED" || job.status === "DLQ") ? 1 : 0)) },
      { label: "Completed", value: completedJobs.toLocaleString(), change: `${successRate}% success rate`, tone: "green", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "SUCCESS" ? 1 : 0)) },
    ],
    eventTimeline: buildTimeline(jobs),
    overviewEventsRows: recentJobs.slice(0, 5).map((job) => {
      const status = jobStatus(job);
      return {
        name: safeName(job),
        id: String(job.id),
        status: status.label,
        detail: `${status.label} ${formatRelativeTime(jobActivityAt(job), now)}\nattempt ${job.attempt_count + 1} / ${job.max_attempts}`,
        queue: `${safeQueue(job)}\n${job.lease_owner ?? "—"}`,
        tone: status.tone,
      };
    }),
    queueBreakdown,
    throughputMetrics: [
      {
        label: "Throughput",
        value: String(jobsLastHour.length),
        suffix: "/hr",
        tone: "blue",
        sparkline: buildBucketSeries(jobs, jobActivityAt, { minimumWindowMs: 60 * 60 * 1000 }),
      },
      {
        label: "Avg. Duration",
        value: String(avgDurationSeconds),
        suffix: "s",
        tone: "blue",
        sparkline: buildBucketSeries(
          jobs.filter((job) => job.started_at && job.completed_at),
          (job) => job.completed_at,
          {
            getValue: (job) => (new Date(job.completed_at) - new Date(job.started_at)) / 1000,
            mode: "average",
            minimumWindowMs: 60 * 60 * 1000,
          },
        ),
      },
      { label: "Backlog", value: String(backlogTotal), suffix: "", tone: "amber", sparkline: buildSparkline(queueRows.map((queue) => queue.backlog)) },
    ],
    jobs: sortedJobs.map((job) => {
      const status = jobStatus(job);
      return [
        safeName(job),
        String(job.id),
        status.label,
        safeQueue(job),
        formatRelativeTime(jobActivityAt(job), now),
        formatDuration(job.started_at, job.completed_at, now),
        job.lease_owner ?? "—",
        status.tone,
      ];
    }),
    recentActivity: recentJobs.slice(0, 5).map((job) => {
      const status = jobStatus(job);
      return [`${safeName(job)} ${status.label.toLowerCase()}`, String(job.id), formatRelativeTime(jobActivityAt(job), now), status.tone];
    }),
    jobMetricCards: [
      { label: "Active Jobs", value: String(backlogTotal), change: `${runningJobs} running right now`, tone: "blue", sparkline: buildSparkline(jobs.slice(-12).map((job) => (job.status === "RUNNING" || job.status === "PENDING") ? 1 : 0)) },
      { label: "Retries", value: String(jobsWithAttempts.length), change: `${jobsWithAttempts.filter((job) => job.status === "PENDING").length} pending retry`, tone: "amber", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.attempt_count)) },
      { label: "Failures", value: String(failedJobs), change: `${dlqTotal} in DLQ`, tone: "red", sparkline: buildSparkline(jobs.slice(-12).map((job) => (job.status === "FAILED" || job.status === "DLQ") ? 1 : 0)) },
      { label: "SLA Met", value: `${successRate}%`, change: `${autoscaling.decision} autoscaling`, tone: "green", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "SUCCESS" ? 100 : 0)) },
    ],
    jobStageDistribution: Object.entries(payloadTypes)
      .map(([type, typeJobs]) => ({ label: titleize(type), count: typeJobs.length, tone: typeJobs.some((job) => job.status === "FAILED" || job.status === "DLQ") ? "red" : "blue" }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4),
    jobQueues: queueRows.slice(0, 4).map((queue) => ({
      name: queue.name,
      running: jobsByQueue[queue.name].filter((job) => job.status === "RUNNING").length,
      queued: jobsByQueue[queue.name].filter((job) => job.status === "PENDING").length,
      throughput: `${jobsByQueue[queue.name].length}/snapshot`,
      workers: `${new Set(jobsByQueue[queue.name].map((job) => job.lease_owner).filter(Boolean)).size} workers`,
      tone: queue.tone,
    })),
    workerMetricCards: [
      { label: "Workers Seen", value: String(workerNames.length), change: `${autoscaling.desiredWorkerCount} recommended`, tone: "green", sparkline: buildSparkline(workerNames.map((_, index) => index + 1)) },
      { label: "Running Jobs", value: String(runningJobs), change: `${autoscaling.stats.pendingJobs} pending`, tone: "blue", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "RUNNING" ? 1 : 0)) },
      { label: "Unhealthy", value: String(failedItems.length), change: "derived from failed jobs", tone: "red", sparkline: buildSparkline(failedItems.map((_, index) => index + 1)) },
      { label: "Idle Capacity", value: `${Math.max(0, autoscaling.desiredWorkerCount - workerNames.length)}`, change: autoscaling.decision, tone: "amber", sparkline: buildSparkline([workerNames.length, autoscaling.desiredWorkerCount]) },
    ],
    workers,
    workerActivity: recentJobs.slice(0, 4).map((job) => {
      const status = jobStatus(job);
      return [
        `${job.lease_owner ?? "unassigned"} ${status.label.toLowerCase()}`,
        `${safeName(job)} in ${safeQueue(job)}`,
        formatRelativeTime(jobActivityAt(job), now),
        status.tone,
      ];
    }),
    eventMetricCards: [
      { label: "Events / hr", value: String(jobsLastHour.length), change: "from job lifecycle stream", tone: "blue", sparkline: buildSparkline(jobsLastHour.map((_, index) => index + 1)) },
      { label: "Dropped", value: String(dlqTotal), change: "using DLQ count", tone: "amber", sparkline: buildSparkline(dlqTotal ? [0, dlqTotal] : [0]) },
      { label: "Critical", value: String(failedJobs), change: "failed or DLQ jobs", tone: "red", sparkline: buildSparkline(failedItems.map((_, index) => index + 1)) },
      { label: "Acknowledged", value: `${successRate}%`, change: "completed successfully", tone: "green", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "SUCCESS" ? 100 : 0)) },
    ],
    eventFeed: recentJobs.slice(0, 5).map((job) => {
      const status = jobStatus(job);
      return {
        key: String(job.id),
        title: `${safeName(job)} ${status.label.toLowerCase()}`,
        stream: "jobs.lifecycle",
        detail: `queue ${safeQueue(job)} · attempt ${job.attempt_count + 1}/${job.max_attempts}`,
        tone: status.tone,
        time: formatRelativeTime(jobActivityAt(job), now),
      };
    }),
    eventSubscribers: [
      { name: "sse.events.jobs", latency: "n/a", status: "Configured", tone: "blue" },
      { name: "autoscaling.recommendation", latency: "n/a", status: autoscaling.decision, tone: autoscaling.decision === "SCALE_OUT" ? "amber" : "green" },
      { name: "dead-letter-monitor", latency: "n/a", status: dlqTotal > 0 ? "Attention" : "Healthy", tone: dlqTotal > 0 ? "red" : "green" },
    ],
    queueMetricCards: [
      { label: "Total Backlog", value: String(backlogTotal), change: `${pendingJobs} queued, ${runningJobs} running`, tone: "amber", sparkline: buildSparkline(queueRows.map((queue) => queue.backlog)) },
      { label: "Queue Throughput", value: `${jobsLastHour.length}/hr`, change: `${queueNames.length} active queues`, tone: "blue", sparkline: buildSparkline(queueNames.map((queueName) => jobsByQueue[queueName].length)) },
      { label: "Breached SLA", value: String(queueRows.filter((queue) => queue.sla === "Breached").length), change: "derived from failed jobs", tone: "red", sparkline: buildSparkline(queueRows.map((queue) => queue.sla === "Breached" ? 1 : 0)) },
      { label: "Available Slots", value: String(Math.max(0, autoscaling.desiredWorkerCount - runningJobs)), change: autoscaling.decision, tone: "green", sparkline: buildSparkline([runningJobs, autoscaling.desiredWorkerCount]) },
    ],
    queueRows: queueRows.length > 0 ? queueRows : defaultDashboardData.queueRows,
    snapshotTime: new Date(now).toISOString(),
    alertMetricCards: [
      { label: "Open Alerts", value: String(failedJobs + dlqTotal), change: `${failedItems.length} recent failures`, tone: "amber", sparkline: buildSparkline([failedJobs, dlqTotal]) },
      { label: "Critical", value: String(dlqTotal), change: "jobs in DLQ", tone: "red", sparkline: buildSparkline([dlqTotal]) },
      { label: "Muted Rules", value: "0", change: "not exposed by backend", tone: "blue", sparkline: buildSparkline([0]) },
      { label: "Resolved < 30m", value: `${successRate}%`, change: "derived from job outcomes", tone: "green", sparkline: buildSparkline(jobs.slice(-12).map((job) => job.status === "SUCCESS" ? 100 : 0)) },
    ],
    alerts: [
      ...failedItems.slice(0, 4).map((job) => ({
        title: `${safeName(job)} failed`,
        scope: safeQueue(job),
        severity: job.status === "DLQ" ? "Critical" : "High",
        tone: "red",
        owner: job.lease_owner ?? "unassigned",
        age: formatRelativeTime(jobActivityAt(job), now),
      })),
      ...defaultDashboardData.alerts.slice(0, Math.max(0, 5 - failedItems.length)),
    ],
    dlqRecords: dlqRecords.map((record) => ({
      id: String(record.id),
      jobId: String(record.job_id),
      reason: record.reason ?? "Unknown failure",
      failedAt: formatRelativeTime(dlqFailedAt(record), now),
      failedAtRaw: dlqFailedAt(record),
      payload: record.payload ?? {},
    })),
  };
}
