"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppGridIcon, OutlineIcon } from "./icons";
import { navigationItems, sidebarIconMap } from "./data";

export function DashboardShell({ title, toolbar, notice, health, greeting, children }) {
  const pathname = usePathname();
  const isHealthy = health?.status === "OK";

  return (
    <main className="dashboardShell">
      <div className="dashboardFrame">
        <aside className="sidebar">
          <div className="brandMark">
            <AppGridIcon />
          </div>
          <nav className="sidebarNav">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebarItem${pathname === item.href ? " isActive" : ""}`}
              >
                <span className="sidebarIcon">
                  <OutlineIcon type={sidebarIconMap[item.label]} />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="sidebarFooter">
            <div className="footerBlock">
              <p className="footerLabel">Environment</p>
              <div className="footerSelect">
                <span className="statusDot green" />
                <span>Production</span>
                <OutlineIcon type="chevronDown" />
              </div>
            </div>

            <div className="healthCard">
              <p className="footerLabel">System Health</p>
              <div className={`healthHeadline ${isHealthy ? "tone-green" : "tone-red"}`}>
                <span className={`healthBadge ${isHealthy ? "tone-green" : "tone-red"}`}>
                  <OutlineIcon type={isHealthy ? "check" : "error"} />
                </span>
                <span>{isHealthy ? "Healthy" : "Unavailable"}</span>
              </div>
              <p className="mutedCopy">
                {health
                  ? `${health.database} · ${greeting ?? "Backend connected"}`
                  : "Waiting for backend health"}
              </p>
            </div>

            <div className="versionCard">
              <p className="footerLabel">Version</p>
              <p className="versionValue">v1.24.0</p>
            </div>
          </div>
        </aside>

        <section className="contentArea">
          <header className="topBar">
            <h1>{title}</h1>
            <div className="toolbar">{toolbar}</div>
          </header>
          {notice ? <div className="integrationNotice">{notice}</div> : null}
          {children}
        </section>
      </div>
    </main>
  );
}
