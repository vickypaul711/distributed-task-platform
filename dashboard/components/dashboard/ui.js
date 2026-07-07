import { OutlineIcon } from "./icons";
import { toneIconMap } from "./data";

export function Sparkline({ points, tone }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = 100 / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = 28 - ((point - min) / range) * 20;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className={`sparkline tone-${tone}`} viewBox="0 0 100 32" preserveAspectRatio="none">
      <path d={path} />
    </svg>
  );
}

export function DropdownButton({ label, icon }) {
  return (
    <button className="toolbarButton" type="button">
      {icon ? (
        <span className="toolbarLeadingIcon">
          <OutlineIcon type={icon} />
        </span>
      ) : null}
      <span>{label}</span>
      <span className="toolbarChevron">
        <OutlineIcon type="chevronDown" />
      </span>
    </button>
  );
}

export function ActionButton({ label, onClick, disabled = false, tone = "default", type = "button" }) {
  return (
    <button
      className={`actionButton${tone !== "default" ? ` tone-${tone}` : ""}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function FilterSelect({ value, options, onChange, ariaLabel }) {
  return (
    <label className="filterSelect">
      <select value={value} onChange={onChange} aria-label={ariaLabel}>
        {options.map((option, index) => (
          <option key={`${option}-${index}`} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span aria-hidden="true">{value}</span>
      <span className="toolbarChevron" aria-hidden="true">
        <OutlineIcon type="chevronDown" />
      </span>
    </label>
  );
}

export function StatusPill({ status, tone }) {
  return <span className={`statusPill tone-${tone}`}>{status}</span>;
}

export function MetricCard({ item }) {
  return (
    <article className="metricCard">
      <div className={`metricIcon tone-${item.tone}`}>
        <OutlineIcon type={toneIconMap[item.tone]} />
      </div>
      <div className="metricContent">
        <p className="metricLabel">{item.label}</p>
        <p className="metricValue">{item.value}</p>
        <p className={`metricDelta tone-${item.tone}`}>{item.change}</p>
      </div>
      <Sparkline points={item.sparkline} tone={item.tone} />
    </article>
  );
}

export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || action) && (
        <div className="panelHeader">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function GhostIconButton({ label, onClick, disabled = false }) {
  return (
    <button className="ghostIconButton" type="button" aria-label={label} onClick={onClick} disabled={disabled}>
      <OutlineIcon type="dots" />
    </button>
  );
}

export function MiniBarList({ items, keyLabel = "label" }) {
  const max = Math.max(...items.map((item) => item.count ?? item.value ?? item.backlog));

  return (
    <div className="miniBarList">
      {items.map((item, index) => {
        const value = item.count ?? item.value ?? item.backlog;
        return (
          <div key={`${item[keyLabel]}-${index}`} className="miniBarRow">
            <div className="miniBarHeader">
              <span>{item[keyLabel]}</span>
              <span>{value}</span>
            </div>
            <div className="miniBarTrack">
              <span className={`miniBarFill tone-${item.tone}`} style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
