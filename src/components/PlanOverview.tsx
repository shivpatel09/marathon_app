import Link from "next/link";
import type { PlanOverview } from "@/lib/overview";

const TONE_COLOR: Record<string, string> = {
  good: "#1d9e75",
  warn: "var(--accent)",
  neutral: "var(--muted)",
};

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

export default function PlanOverview({ o }: { o: PlanOverview }) {
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        goal {o.goalLabel} · race {o.raceDateLabel}
      </p>

      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
        <div className="stat">
          <div className="label">{o.started ? "days to race" : "days to start"}</div>
          <div className="value">{o.started ? o.daysToRace : o.daysToStart}</div>
        </div>
        <div className="stat">
          <div className="label">week</div>
          <div className="value">{o.currentWeek}<span style={{ fontSize: 13, color: "var(--muted)" }}> / {o.totalWeeks}</span></div>
        </div>
        <div className="stat">
          <div className="label">miles logged</div>
          <div className="value">{o.loggedMiles}<span style={{ fontSize: 13, color: "var(--muted)" }}> / {o.totalPlannedMiles}</span></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="row" style={{ alignItems: "baseline" }}>
          <div className="card-h" style={{ marginBottom: 0, color: TONE_COLOR[o.readiness.tone] }}>{o.readiness.label}</div>
          <span className="muted" style={{ fontSize: 12 }}>goal readiness</span>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: "6px 0 10px" }}>{o.readiness.detail}</p>
        {o.started && <Bar pct={o.readiness.score} color={TONE_COLOR[o.readiness.tone]} />}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="row" style={{ alignItems: "baseline", marginBottom: 8 }}>
          <div className="card-h" style={{ marginBottom: 0 }}>training journey</div>
          <span className="muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {o.loggedMiles} / {o.totalPlannedMiles} mi · {o.journeyPct}%
          </span>
        </div>
        <Bar pct={o.journeyPct} />
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>plan progress · week {o.currentWeek} of {o.totalWeeks}</span>
        </div>
        <Bar pct={o.weekProgressPct} color="var(--muted)" />
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <Link href="/week"><button className="primary">Go to this week</button></Link>
      </div>
    </div>
  );
}
