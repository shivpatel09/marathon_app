import Link from "next/link";
import type { WeeklyReviewInput } from "@/lib/review";
import type { Coaching } from "@/lib/coach";

const TOTAL_WEEKS = 18;

function Sparkline({ trend }: { trend: number[] }) {
  // map ACWR 0.6..1.5 to y; shade the 0.8..1.3 safe band
  const lo = 0.6, hi = 1.5;
  const y = (v: number) => 32 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 28;
  const xs = trend.map((_, i) => 8 + i * 26);
  const pts = trend.map((v, i) => `${xs[i]},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width="120" height="36" viewBox="0 0 120 36" aria-hidden="true">
      <rect x="0" y={y(1.3)} width="120" height={y(0.8) - y(1.3)} fill="var(--surface)" rx="2" />
      <polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={y(trend[trend.length - 1])} r="2.5" fill="var(--fg)" />
    </svg>
  );
}

export default function ReviewView({
  review,
  coaching,
}: {
  review: WeeklyReviewInput;
  coaching: Coaching;
}) {
  const wins = review.workouts.graded.filter((g) => g.onTarget);
  const watch = review.workouts.graded.filter((g) => !g.onTarget);
  const prev = review.weekIndex > 1 ? review.weekIndex - 1 : null;
  const next = review.weekIndex < TOTAL_WEEKS ? review.weekIndex + 1 : null;

  return (
    <div>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>Week {review.weekIndex} review</h1>
          <p className="muted" style={{ margin: 0 }}>
            {review.planName} · {review.mesocycle} · goal {review.goalLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {prev ? <Link href={`/review?week=${prev}`}><button>‹</button></Link> : <button disabled>‹</button>}
          {next ? <Link href={`/review?week=${next}`}><button>›</button></Link> : <button disabled>›</button>}
        </div>
      </div>

      <div className="coach-card">
        <div className="coach-icon">★</div>
        <div>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{coaching.narrative}</p>
          {coaching.source === "fallback" && (
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Set ANTHROPIC_API_KEY in .env for the AI-written narrative.
            </p>
          )}
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="label">mileage</div>
          <div className="value">
            {review.mileage.actual}
            <span style={{ fontSize: 13, color: "var(--muted)" }}> / {review.mileage.planned} mi</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">on-target</div>
          <div className="value">
            {review.workouts.onTarget}
            <span style={{ fontSize: 13, color: "var(--muted)" }}> / {review.workouts.total}</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">acwr</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              className="value"
              style={{ margin: 0, color: review.acwr.inRange ? "var(--fg)" : "var(--accent)" }}
            >
              {review.acwr.value || "—"}
            </span>
            <Sparkline trend={review.acwr.trend} />
          </div>
        </div>
        <div className="stat">
          <div className="label">easy / hard</div>
          <div className="value">
            {review.intensitySplit.easyPct}
            <span style={{ fontSize: 13, color: "var(--muted)" }}> / {review.intensitySplit.hardPct}</span>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">what went well</div>
          {wins.length ? (
            wins.map((g, i) => (
              <div className="li" key={i}>
                <span className="ok">✓</span>
                <span>
                  {g.day} {g.type.toLowerCase().replace(/_/g, " ")} — {g.verdict}
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>No completed sessions graded yet this week.</p>
          )}
        </div>
        <div className="card">
          <div className="card-h">watch this week</div>
          {watch.length ? (
            watch.map((g, i) => (
              <div className="li" key={i}>
                <span className="warn">!</span>
                <span>
                  {g.day} {g.type.toLowerCase().replace(/_/g, " ")} — {g.verdict}
                </span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>Nothing flagged. Keep it up.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-h">the week ahead — week {Math.min(review.weekIndex + 1, TOTAL_WEEKS)}</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>focus: {review.weekAhead.focus}</p>
        {review.weekAhead.keyWorkouts.map((w, i) => (
          <div className="li" key={i}>
            <span style={{ color: "var(--muted)" }}>•</span>
            <span>{w}</span>
          </div>
        ))}
        <div className="adjust">
          <strong>coaching adjustment:</strong> {coaching.coachingAdjustment}
        </div>
      </div>
    </div>
  );
}
