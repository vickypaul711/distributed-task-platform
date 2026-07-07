export function AppGridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function OutlineIcon({ type }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  const icons = {
    overview: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.6" {...common} />
        <rect x="13" y="4" width="7" height="7" rx="1.6" {...common} />
        <rect x="4" y="13" width="7" height="7" rx="1.6" {...common} />
        <rect x="13" y="13" width="7" height="7" rx="1.6" {...common} />
      </>
    ),
    jobs: (
      <>
        <path d="M9 7h6" {...common} />
        <path d="M12 7V5.5a1.5 1.5 0 0 0-3 0V7h6V5.5a1.5 1.5 0 0 0-3 0" {...common} />
        <rect x="4" y="7" width="16" height="12" rx="2.2" {...common} />
      </>
    ),
    events: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2.2" {...common} />
        <path d="M8 8h8M8 12h8M8 16h4" {...common} />
      </>
    ),
    schedules: (
      <>
        <circle cx="12" cy="12" r="8" {...common} />
        <path d="M12 8v4l3 2" {...common} />
      </>
    ),
    queues: (
      <>
        <path d="M7 7h10M7 12h10M7 17h10" {...common} />
        <circle cx="5" cy="7" r="1" fill="currentColor" />
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="5" cy="17" r="1" fill="currentColor" />
      </>
    ),
    workers: (
      <>
        <circle cx="9" cy="9" r="3" {...common} />
        <circle cx="16.5" cy="10.5" r="2.5" {...common} />
        <path d="M4.5 18a4.5 4.5 0 0 1 9 0M13.5 18a3.5 3.5 0 0 1 7 0" {...common} />
      </>
    ),
    tenants: (
      <>
        <rect x="4" y="6" width="16" height="12" rx="2.2" {...common} />
        <path d="M8 10h8M8 14h5" {...common} />
        <path d="M8 6V4M16 6V4" {...common} />
      </>
    ),
    templates: (
      <>
        <rect x="6" y="4" width="12" height="16" rx="2.2" {...common} />
        <path d="M9 8h6M9 12h6M9 16h4" {...common} />
      </>
    ),
    alerts: (
      <>
        <path d="M12 4a4 4 0 0 0-4 4v2.5L6 14v1h12v-1l-2-3.5V8a4 4 0 0 0-4-4Z" {...common} />
        <path d="M10 18a2 2 0 0 0 4 0" {...common} />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" {...common} />
        <path d="M19 12a7 7 0 0 0-.08-1l2.08-1.62-2-3.46-2.51 1a7 7 0 0 0-1.73-1L12.5 3h-4l-.26 2.92a7 7 0 0 0-1.73 1l-2.51-1-2 3.46L4.08 11a7 7 0 0 0 0 2L2 14.62l2 3.46 2.51-1a7 7 0 0 0 1.73 1L8.5 21h4l.26-2.92a7 7 0 0 0 1.73-1l2.51 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" {...common} />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="m10 8 6 4-6 4Z" {...common} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="M12 7v5l3 2" {...common} />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="M12 7v6M12 17h.01" {...common} />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="m8.5 12 2.2 2.2 4.8-5" {...common} />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="5.5" {...common} />
        <path d="m16 16 3 3" {...common} />
      </>
    ),
    chevronDown: <path d="m7 10 5 5 5-5" {...common} />,
    calendar: (
      <>
        <rect x="4" y="6" width="16" height="14" rx="2.2" {...common} />
        <path d="M8 4v4M16 4v4M4 10h16" {...common} />
      </>
    ),
    refresh: (
      <>
        <path d="M19 12a7 7 0 1 1-2-4.9" {...common} />
        <path d="M18 5v4h-4" {...common} />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="6" r="1.25" fill="currentColor" />
        <circle cx="12" cy="12" r="1.25" fill="currentColor" />
        <circle cx="12" cy="18" r="1.25" fill="currentColor" />
      </>
    ),
    chevronLeft: <path d="m14 7-5 5 5 5" {...common} />,
    chevronRight: <path d="m10 7 5 5-5 5" {...common} />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[type]}
    </svg>
  );
}
