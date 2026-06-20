import type { DailyTargets, TrendAnalysis } from "@/lib/nutrition";

export interface WeighIn {
  date: string; // ISO
  weightKg: number;
}
export interface CheckInRow {
  date: string;
  weightKg: number | null;
  intakeSignal: string | null;
  energyLevel: number | null;
  proteinHit: boolean | null;
}

function WeightSparkline({ data }: { data: WeighIn[] }) {
  if (data.length < 2) return <span className="muted" style={{ fontSize: 13 }}>not enough weigh-ins yet</span>;
  const ws = data.map((d) => d.weightKg);
  const lo = Math.min(...ws), hi = Math.max(...ws);
  const span = hi - lo || 1;
  const y = (v: number) => 30 - ((v - lo) / span) * 24;
  const x = (i: number) => 6 + (i / (data.length - 1)) * 168;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.weightKg).toFixed(1)}`).join(" ");
  return (
    <svg width="180" height="36" viewBox="0 0 180 36" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(ws[ws.length - 1])} r="2.5" fill="var(--fg)" />
    </svg>
  );
}

const STATUS_LABEL: Record<string, string> = {
  insufficient_data: "tracking",
  on_track: "on track",
  under_fueling: "under-fueling",
  losing_too_fast: "losing too fast",
  gaining_unintended: "gaining",
};

export default function NutritionView({
  targets,
  trend,
  todayLabel,
  weighIns,
  recent,
}: {
  targets: DailyTargets;
  trend: TrendAnalysis;
  todayLabel: string;
  weighIns: WeighIn[];
  recent: CheckInRow[];
}) {
  const carbDay = targets.carbsPerKg >= 8 ? "high-carb day" : targets.carbsPerKg >= 6 ? "moderate-carb day" : "lower-carb day";
  const alert = trend.status === "under_fueling" || trend.status === "losing_too_fast" || trend.status === "gaining_unintended";

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        today: {todayLabel} · <strong style={{ color: "var(--fg)" }}>{carbDay}</strong>
      </p>

      <div className="cards">
        <div className="stat"><div className="label">calories</div><div className="value">{targets.calories.toLocaleString()}</div></div>
        <div className="stat"><div className="label">protein</div><div className="value">{targets.proteinG}<span style={{ fontSize: 13, color: "var(--muted)" }}> g</span></div></div>
        <div className="stat"><div className="label">carbs</div><div className="value">{targets.carbsG}<span style={{ fontSize: 13, color: "var(--muted)" }}> g</span></div></div>
        <div className="stat"><div className="label">fat</div><div className="value">{targets.fatG}<span style={{ fontSize: 13, color: "var(--muted)" }}> g</span></div></div>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
        TDEE ~{targets.tdee.toLocaleString()} kcal (BMR {targets.bmr.toLocaleString()} + {targets.trainingCalories.toLocaleString()} from today&apos;s run)
      </p>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="row" style={{ alignItems: "center" }}>
          <div className="card-h" style={{ marginBottom: 0 }}>weight trend</div>
          <span
            style={{
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 7,
              background: alert ? "var(--surface)" : "var(--surface)",
              color: alert ? "var(--accent)" : "var(--muted)",
            }}
          >
            {STATUS_LABEL[trend.status]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 0" }}>
          <WeightSparkline data={weighIns} />
          {trend.weeklyChangeKg != null && (
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                {trend.weeklyChangeKg > 0 ? "+" : ""}{trend.weeklyChangeKg} kg/wk
              </div>
              <div className="muted" style={{ fontSize: 12 }}>goal {trend.goalChangeKg > 0 ? "+" : ""}{trend.goalChangeKg} kg/wk</div>
            </div>
          )}
        </div>
        <div className="adjust"><strong>recommendation:</strong> {trend.recommendation}</div>
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div className="card-h">recent check-ins</div>
          <table>
            <thead>
              <tr><th>date</th><th className="num">weight</th><th>intake</th><th className="num">energy</th><th>protein</th></tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.date}>
                  <td>{new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="num">{c.weightKg != null ? `${c.weightKg} kg` : "—"}</td>
                  <td>{c.intakeSignal ? c.intakeSignal.toLowerCase().replace("_", " ") : "—"}</td>
                  <td className="num">{c.energyLevel ?? "—"}</td>
                  <td>{c.proteinHit ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
