export const navigationItems = [
  { label: "Overview", href: "/" },
  { label: "Jobs", href: "/jobs" },
  { label: "Tenants", href: "/tenants" },
  { label: "Simulator", href: "/simulator" },
  { label: "Events", href: "/events" },
  { label: "Queues", href: "/queues" },
  { label: "Workers", href: "/workers" },
  { label: "Settings", href: "/settings" },
];

export const toneIconMap = {
  blue: "play",
  amber: "clock",
  red: "error",
  green: "check",
};

export const sidebarIconMap = {
  Overview: "overview",
  Jobs: "jobs",
  Tenants: "tenants",
  Simulator: "workers",
  Events: "events",
  Schedules: "schedules",
  Queues: "queues",
  Workers: "workers",
  Templates: "templates",
  Alerts: "alerts",
  Settings: "settings",
};

export const overviewMetricCards = [
  { label: "Running", value: "18", change: "+4 vs yesterday", tone: "blue", sparkline: [22, 24, 31, 28, 27, 40, 61, 42, 33, 48, 66, 57, 64, 78, 60, 54, 70, 83, 76] },
  { label: "Queued", value: "42", change: "+8 vs yesterday", tone: "amber", sparkline: [28, 32, 41, 35, 27, 24, 20, 23, 38, 56, 49, 61, 53, 43, 38, 50, 58, 63, 70] },
  { label: "Failed", value: "7", change: "-2 vs yesterday", tone: "red", sparkline: [20, 24, 17, 19, 13, 14, 11, 15, 12, 18, 27, 23, 17, 24, 38, 31, 47, 62, 54] },
  { label: "Completed", value: "1,243", change: "+12% vs yesterday", tone: "green", sparkline: [24, 29, 35, 27, 20, 16, 12, 18, 31, 42, 35, 49, 61, 48, 43, 37, 52, 66, 60] },
];

export const eventsLegend = [
  { label: "Running", tone: "blue" },
  { label: "Queued", tone: "amber" },
  { label: "Failed", tone: "red" },
  { label: "Completed", tone: "green" },
];

export const eventTimeline = [
  ["blue", 60], ["green", 26], ["blue", 52], ["green", 18], ["blue", 48], ["amber", 42], ["green", 20], ["amber", 34],
  ["amber", 19], ["green", 24], ["green", 21], ["green", 58], ["red", 15], ["amber", 17], ["blue", 18], ["blue", 14],
  ["green", 29], ["green", 23], ["green", 31], ["green", 48], ["green", 66], ["green", 20], ["blue", 57], ["green", 63],
  ["red", 11], ["amber", 26], ["amber", 29], ["green", 60],
];

export const overviewEventsRows = [
  { name: "Data Import", id: "data-import-17455", status: "Running", detail: "Started 2m ago\nby scheduler", queue: "default\nworker-02", tone: "blue" },
  { name: "Report Generation", id: "report-gen-17454", status: "Queued", detail: "Queued 1m ago\nin default queue", queue: "default\n—", tone: "amber" },
  { name: "User Cleanup", id: "user-cleanup-17453", status: "Completed", detail: "Completed 5m ago\nduration 18s", queue: "maintenance\nworker-01", tone: "green" },
  { name: "Email Notification", id: "email-notify-17452", status: "Failed", detail: "Failed 7m ago\nduration 12s", queue: "default\nworker-03", tone: "red" },
  { name: "Archive Logs", id: "archive-logs-17451", status: "Completed", detail: "Completed 11m ago\nduration 34s", queue: "maintenance\nworker-02", tone: "green" },
];

export const queueBreakdown = [
  { label: "Running", value: 18, percent: "42.9%", tone: "blue" },
  { label: "Queued", value: 42, percent: "42.9%", tone: "amber" },
  { label: "Failed", value: 7, percent: "9.5%", tone: "red" },
  { label: "Completed", value: 1243, percent: "4.7%", tone: "green" },
];

export const throughputMetrics = [
  { label: "Throughput", value: "234", suffix: "/min", tone: "blue", sparkline: [14, 12, 15, 10, 18, 13, 24, 17, 28, 19, 24, 20] },
  { label: "Avg. Duration", value: "28", suffix: "s", tone: "blue", sparkline: [10, 13, 9, 16, 12, 23, 19, 25, 16, 27, 22, 30] },
  { label: "Backlog", value: "42", suffix: "", tone: "amber", sparkline: [18, 16, 13, 15, 17, 12, 18, 28, 26, 19, 22, 16] },
];

export const jobs = [
  ["Data Import", "data-import-17455", "Running", "default", "2m ago", "1m 12s", "worker-02", "blue"],
  ["Report Generation", "report-gen-17454", "Queued", "default", "1m ago", "—", "—", "amber"],
  ["User Cleanup", "user-cleanup-17453", "Completed", "maintenance", "5m ago", "18s", "worker-01", "green"],
  ["Email Notification", "email-notify-17452", "Failed", "default", "7m ago", "12s", "worker-03", "red"],
  ["Archive Logs", "archive-logs-17451", "Completed", "maintenance", "11m ago", "34s", "worker-02", "green"],
  ["Invoice Export", "invoice-export-17450", "Running", "billing", "14m ago", "4m 02s", "worker-05", "blue"],
  ["Audit Sweep", "audit-sweep-17449", "Queued", "governance", "16m ago", "—", "—", "amber"],
];

export const recentActivity = [
  ["Data Import started", "data-import-17455", "2m ago", "blue"],
  ["Report Generation queued", "report-gen-17454", "3m ago", "amber"],
  ["User Cleanup completed", "user-cleanup-17453", "5m ago", "green"],
  ["Email Notification failed", "email-notify-17452", "7m ago", "red"],
  ["Archive Logs completed", "archive-logs-17451", "11m ago", "green"],
];

export const jobMetricCards = [
  { label: "Active Jobs", value: "126", change: "+18 in the last hour", tone: "blue", sparkline: [16, 20, 18, 24, 31, 28, 35, 33, 30, 36, 42, 47] },
  { label: "Retries", value: "14", change: "-3 vs target", tone: "amber", sparkline: [22, 27, 19, 24, 16, 14, 12, 18, 15, 11, 9, 7] },
  { label: "Failures", value: "7", change: "2 need triage", tone: "red", sparkline: [4, 6, 5, 4, 7, 6, 8, 7, 9, 6, 7, 7] },
  { label: "SLA Met", value: "96.4%", change: "+1.2% this week", tone: "green", sparkline: [71, 73, 72, 74, 75, 78, 79, 82, 84, 83, 85, 86] },
];

export const jobStageDistribution = [
  { label: "Ingest", count: 32, tone: "blue" },
  { label: "Transform", count: 18, tone: "amber" },
  { label: "Deliver", count: 9, tone: "green" },
  { label: "Recovery", count: 4, tone: "red" },
];

export const jobQueues = [
  { name: "default", running: 14, queued: 9, throughput: "44/min", workers: 4, tone: "blue" },
  { name: "billing", running: 3, queued: 5, throughput: "12/min", workers: 2, tone: "amber" },
  { name: "maintenance", running: 2, queued: 1, throughput: "8/min", workers: 2, tone: "green" },
  { name: "governance", running: 1, queued: 6, throughput: "5/min", workers: 1, tone: "red" },
];

export const workerMetricCards = [
  { label: "Workers Online", value: "24", change: "1 provisioning", tone: "green", sparkline: [18, 18, 19, 20, 20, 21, 22, 22, 22, 23, 24, 24] },
  { label: "Utilization", value: "71%", change: "+6% from baseline", tone: "blue", sparkline: [38, 42, 48, 44, 51, 57, 54, 61, 66, 63, 68, 71] },
  { label: "Unhealthy", value: "2", change: "memory pressure", tone: "red", sparkline: [1, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 2] },
  { label: "Idle Capacity", value: "29%", change: "room for 54 jobs", tone: "amber", sparkline: [44, 41, 39, 38, 35, 34, 31, 31, 30, 30, 29, 29] },
];

export const workers = [
  { name: "worker-01", queue: "maintenance", status: "Healthy", statusTone: "green", cpu: "42%", memory: "5.4 GB", jobs: 3, zone: "us-east-1a" },
  { name: "worker-02", queue: "default", status: "Healthy", statusTone: "green", cpu: "61%", memory: "6.1 GB", jobs: 7, zone: "us-east-1b" },
  { name: "worker-03", queue: "default", status: "Warning", statusTone: "amber", cpu: "84%", memory: "7.7 GB", jobs: 5, zone: "us-east-1c" },
  { name: "worker-04", queue: "billing", status: "Healthy", statusTone: "green", cpu: "38%", memory: "4.9 GB", jobs: 2, zone: "us-east-1a" },
  { name: "worker-05", queue: "billing", status: "Draining", statusTone: "blue", cpu: "24%", memory: "3.7 GB", jobs: 1, zone: "us-east-1b" },
  { name: "worker-06", queue: "governance", status: "Critical", statusTone: "red", cpu: "93%", memory: "7.9 GB", jobs: 6, zone: "us-east-1c" },
];

export const workerActivity = [
  ["worker-03 nearing memory threshold", "Scaling recommendation generated", "4m ago", "amber"],
  ["worker-06 heartbeat degraded", "Triage playbook attached", "8m ago", "red"],
  ["worker-05 drain started", "No new jobs assigned", "12m ago", "blue"],
  ["worker-02 autoscaled", "Added from launch template v18", "19m ago", "green"],
];

export const eventMetricCards = [
  { label: "Events / min", value: "284", change: "+12% from previous hour", tone: "blue", sparkline: [44, 48, 46, 51, 55, 62, 59, 66, 71, 68, 74, 80] },
  { label: "Dropped", value: "9", change: "all retried", tone: "amber", sparkline: [8, 7, 9, 6, 5, 7, 6, 4, 5, 4, 3, 2] },
  { label: "Critical", value: "3", change: "1 still open", tone: "red", sparkline: [2, 2, 1, 1, 2, 3, 2, 2, 3, 3, 3, 3] },
  { label: "Acknowledged", value: "91%", change: "within SLA", tone: "green", sparkline: [74, 76, 78, 79, 82, 83, 84, 85, 87, 89, 90, 91] },
];

export const eventFeed = [
  { title: "Queue congestion detected", stream: "queue.default", detail: "Backlog breached threshold 40 for 3m", tone: "amber", time: "2m ago" },
  { title: "Worker recovered", stream: "worker.heartbeat", detail: "worker-06 resumed healthy heartbeats", tone: "green", time: "6m ago" },
  { title: "Task failed", stream: "job.failed", detail: "email-notify-17452 exhausted retries", tone: "red", time: "7m ago" },
  { title: "Run created", stream: "schedule.triggered", detail: "nightly-ledger-sync created 18 child jobs", tone: "blue", time: "11m ago" },
  { title: "Maintenance window started", stream: "infra.maintenance", detail: "2 workers draining in billing queue", tone: "blue", time: "15m ago" },
];

export const eventSubscribers = [
  { name: "notifications-service", latency: "84ms", status: "Healthy", tone: "green" },
  { name: "incident-bridge", latency: "126ms", status: "Degraded", tone: "amber" },
  { name: "analytics-sink", latency: "66ms", status: "Healthy", tone: "green" },
  { name: "audit-archive", latency: "211ms", status: "Retrying", tone: "red" },
];

export const scheduleMetricCards = [
  { label: "Scheduled Runs", value: "63", change: "12 in the next hour", tone: "blue", sparkline: [14, 16, 15, 19, 18, 21, 24, 25, 27, 29, 32, 35] },
  { label: "Missed Windows", value: "2", change: "both retried", tone: "red", sparkline: [0, 1, 0, 1, 1, 2, 2, 1, 1, 2, 2, 2] },
  { label: "On Time", value: "98.8%", change: "+0.5% week over week", tone: "green", sparkline: [89, 90, 90, 92, 93, 94, 95, 96, 96, 97, 98, 98] },
  { label: "Paused", value: "5", change: "manual review", tone: "amber", sparkline: [6, 6, 5, 5, 7, 6, 5, 5, 4, 4, 5, 5] },
];

export const schedules = [
  { name: "Nightly Ledger Sync", cadence: "Every day · 02:00 UTC", next: "in 14m", owner: "finance", status: "Active", tone: "green" },
  { name: "Usage Snapshot", cadence: "Every hour · :05", next: "in 7m", owner: "analytics", status: "Active", tone: "green" },
  { name: "GDPR Retention Sweep", cadence: "Weekly · Sun 04:00", next: "2d 6h", owner: "compliance", status: "Paused", tone: "amber" },
  { name: "Invoice Export", cadence: "Every day · 03:15 UTC", next: "tomorrow", owner: "billing", status: "Delayed", tone: "red" },
];

export const scheduleCalendar = [
  { day: "Tue", runs: 12, tone: "blue" },
  { day: "Wed", runs: 10, tone: "green" },
  { day: "Thu", runs: 14, tone: "blue" },
  { day: "Fri", runs: 8, tone: "amber" },
  { day: "Sat", runs: 5, tone: "green" },
  { day: "Sun", runs: 16, tone: "red" },
  { day: "Mon", runs: 11, tone: "blue" },
];

export const queueMetricCards = [
  { label: "Total Backlog", value: "42", change: "-6 over 30m", tone: "amber", sparkline: [41, 42, 45, 43, 40, 39, 37, 38, 35, 34, 42, 42] },
  { label: "Queue Throughput", value: "234/min", change: "steady", tone: "blue", sparkline: [19, 21, 18, 23, 26, 22, 27, 31, 28, 33, 35, 37] },
  { label: "Breached SLA", value: "3", change: "1 recovering", tone: "red", sparkline: [1, 1, 2, 2, 1, 2, 3, 2, 3, 4, 3, 3] },
  { label: "Available Slots", value: "58", change: "autoscale ready", tone: "green", sparkline: [40, 42, 45, 43, 48, 50, 51, 54, 56, 58, 58, 58] },
];

export const queueRows = [
  { name: "default", backlog: 18, oldest: "1m 22s", workerPool: "4 workers", sla: "Healthy", tone: "green", sparkline: [18, 17, 16, 15, 18, 20, 19, 18, 17] },
  { name: "billing", backlog: 11, oldest: "3m 07s", workerPool: "2 workers", sla: "Watch", tone: "amber", sparkline: [6, 7, 8, 8, 9, 10, 11, 11, 11] },
  { name: "maintenance", backlog: 4, oldest: "48s", workerPool: "2 workers", sla: "Healthy", tone: "green", sparkline: [2, 2, 3, 3, 3, 4, 4, 4, 4] },
  { name: "governance", backlog: 9, oldest: "8m 40s", workerPool: "1 worker", sla: "Breached", tone: "red", sparkline: [3, 4, 5, 6, 7, 8, 8, 9, 9] },
];

export const templateMetricCards = [
  { label: "Published", value: "48", change: "3 updated today", tone: "blue", sparkline: [36, 37, 39, 39, 40, 42, 44, 44, 45, 46, 47, 48] },
  { label: "Deprecated", value: "6", change: "2 pending migration", tone: "amber", sparkline: [7, 7, 8, 8, 7, 7, 6, 6, 6, 6, 6, 6] },
  { label: "Failed Validations", value: "1", change: "schema mismatch", tone: "red", sparkline: [0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1] },
  { label: "Reusable Blocks", value: "126", change: "+9 this sprint", tone: "green", sparkline: [88, 90, 94, 96, 99, 102, 108, 111, 116, 119, 123, 126] },
];

export const templates = [
  { name: "Customer Data Import", category: "ETL", version: "v18", tasks: 14, usage: "342 runs this week", owner: "data platform", tone: "blue" },
  { name: "Invoice Export", category: "Billing", version: "v9", tasks: 6, usage: "114 runs this week", owner: "finance systems", tone: "amber" },
  { name: "User Cleanup", category: "Maintenance", version: "v12", tasks: 8, usage: "54 runs this week", owner: "platform ops", tone: "green" },
  { name: "Retention Audit", category: "Compliance", version: "v4", tasks: 11, usage: "18 runs this week", owner: "governance", tone: "red" },
];

export const alertMetricCards = [
  { label: "Open Alerts", value: "14", change: "-5 today", tone: "amber", sparkline: [23, 21, 20, 19, 18, 17, 16, 16, 15, 14, 14, 14] },
  { label: "Critical", value: "4", change: "2 paged", tone: "red", sparkline: [5, 5, 6, 6, 5, 5, 4, 4, 4, 4, 4, 4] },
  { label: "Muted Rules", value: "7", change: "maintenance windows", tone: "blue", sparkline: [3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7, 7] },
  { label: "Resolved < 30m", value: "82%", change: "+9% this week", tone: "green", sparkline: [61, 64, 66, 68, 72, 73, 75, 77, 78, 80, 81, 82] },
];

export const alerts = [
  { title: "worker-06 high memory usage", scope: "Workers", severity: "Critical", tone: "red", owner: "Platform Ops", age: "8m" },
  { title: "billing queue age threshold exceeded", scope: "Queues", severity: "High", tone: "amber", owner: "Finance Systems", age: "11m" },
  { title: "invoice export delayed", scope: "Schedules", severity: "Medium", tone: "amber", owner: "Billing Runtime", age: "23m" },
  { title: "retry budget depleted for email notifications", scope: "Jobs", severity: "Critical", tone: "red", owner: "Messaging", age: "31m" },
];

export const settingsGroups = [
  {
    title: "Runtime Controls",
    description: "Environment-wide defaults for queue dispatching and retry handling.",
    items: [
      ["Default concurrency", "24"],
      ["Retry policy", "Exponential · 5 attempts"],
      ["Dead-letter retention", "14 days"],
    ],
  },
  {
    title: "Observability",
    description: "Controls for traces, alerts, and event archival behavior.",
    items: [
      ["Trace sampling", "100% for failures"],
      ["Alert routing", "PagerDuty + Slack"],
      ["Audit archive", "Enabled"],
    ],
  },
  {
    title: "Security",
    description: "Access posture and secret rotation for workers and schedules.",
    items: [
      ["Secret rotation", "Every 30 days"],
      ["Service account scope", "Least privilege"],
      ["Approval workflow", "Required for prod templates"],
    ],
  },
];

export const defaultDashboardData = {
  overviewMetricCards,
  eventsLegend,
  eventTimeline,
  overviewEventsRows,
  queueBreakdown,
  throughputMetrics,
  jobs,
  recentActivity,
  jobMetricCards,
  jobStageDistribution,
  jobQueues,
  workerMetricCards,
  workers,
  workerActivity,
  eventMetricCards,
  eventFeed,
  eventSubscribers,
  scheduleMetricCards,
  schedules,
  scheduleCalendar,
  queueMetricCards,
  queueRows,
  templateMetricCards,
  templates,
  alertMetricCards,
  alerts,
  settingsGroups,
  integrationNotice: null,
};
