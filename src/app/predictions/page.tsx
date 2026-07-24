import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePlanInstance } from "@/lib/plan";
import { buildPredictions, fmtRaceTime } from "@/lib/predictions";
import { formatPace } from "@/lib/paces";
import {
  fetchStatistics,
  fmtDuration,
  humanizeKey,
  looksLikeDurationSeconds,
} from "@/lib/runalyze";
import TokenForm from "./TokenForm";
import { removeRunalyzeToken } from "./actions";

export const dynamic = "force-dynamic";

function fmtGoal(sec: number): string {
  return fmtRaceTime(sec);
}

export default async function PredictionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [user, activities, instance] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { runalyzeToken: true, age: true, maxHr: true },
    }),
    prisma.activity.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: "desc" },
      select: { startDate: true, distanceM: true, movingTime: true, avgHr: true },
    }),
    getActivePlanInstance(session.user.id),
  ]);

  const result = buildPredictions(activities, user?.age ?? null, user?.maxHr ?? null);
  const marathon = result?.predictions.find((p) => p.key === "marathon");
  const goalSec = instance?.goalTimeSec ?? null;
  const goalDelta = marathon && goalSec ? marathon.seconds - goalSec : null;

  return (
    <main className="container">
      <h1>Predictions</h1>
      <p className="muted" style={{ margin: "0 0 1rem" }}>
        Estimated from your synced runs — pace vs. heart rate (Daniels effective VO₂max model).
      </p>

      {!result ? (
        <div className="empty">
          No synced runs to predict from yet. Sync your Strava activity on the Runs tab first.
        </div>
      ) : (
        <>
          <div className="cards">
            {marathon && (
              <div className="stat">
                <div className="label">predicted marathon</div>
                <div className="value">{fmtRaceTime(marathon.seconds)}</div>
              </div>
            )}
            {result.effectiveVo2max != null && (
              <div className="stat">
                <div className="label">effective VO₂max</div>
                <div className="value">
                  {result.effectiveVo2max}
                  {result.vo2maxTrend != null && (
                    <span style={{ fontSize: "0.85rem", marginLeft: 6, color: result.vo2maxTrend >= 0 ? "var(--done)" : "var(--accent)" }}>
                      {result.vo2maxTrend >= 0 ? "▲" : "▼"} {Math.abs(result.vo2maxTrend)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {goalDelta != null && goalSec != null && (
              <div className="stat">
                <div className="label">vs {fmtGoal(goalSec)} goal</div>
                <div className="value" style={{ color: goalDelta <= 0 ? "var(--done)" : "var(--accent)" }}>
                  {goalDelta <= 0 ? "−" : "+"}{fmtRaceTime(Math.abs(goalDelta))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-h">Race predictions</div>
            <table>
              <thead>
                <tr>
                  <th>distance</th>
                  <th className="num">predicted time</th>
                  <th className="num">pace /mi</th>
                </tr>
              </thead>
              <tbody>
                {result.predictions.map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}</td>
                    <td className="num">{fmtRaceTime(p.seconds)}</td>
                    <td className="num">{formatPace(p.paceSecPerMile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
            {result.method === "vo2max" ? (
              <>
                Based on {result.sampleCount} runs with heart-rate data (median effective VO₂max). Max HR{" "}
                {user?.maxHr
                  ? `set to ${result.hrMax} bpm`
                  : `estimated at ${result.hrMax} bpm${user?.age ? ` from age ${user.age}` : ""} — set your real max HR in the nutrition profile to refine`}
                . Predictions assume race-day effort, flat course, and taper.
              </>
            ) : (
              <>
                Based on your best recent training run scaled with the Riegel model ({result.sampleCount} runs
                considered, no heart-rate data found). This is conservative — training runs aren&apos;t
                all-out. Run with a HR monitor for better estimates.
              </>
            )}
          </p>
        </>
      )}

      <RunalyzeSection token={user?.runalyzeToken ?? null} />
    </main>
  );
}

async function RunalyzeSection({ token }: { token: string | null }) {
  if (!token) {
    return (
      <details style={{ marginTop: 20 }}>
        <summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem" }}>
          Optional: connect Runalyze to compare (requires a Runalyze Supporter/Premium account)
        </summary>
        <div style={{ marginTop: 10 }}>
          <TokenForm />
        </div>
      </details>
    );
  }

  const stats = await fetchStatistics(token);
  const entries: { key: string; value: string }[] = [];
  if (stats.ok && stats.data && typeof stats.data === "object" && !Array.isArray(stats.data)) {
    for (const [k, v] of Object.entries(stats.data as Record<string, unknown>)) {
      if (v == null || typeof v === "object") continue;
      entries.push({
        key: humanizeKey(k),
        value: typeof v === "number" && looksLikeDurationSeconds(k, v) ? fmtDuration(v) : String(v),
      });
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <div className="card-h" style={{ margin: 0 }}>Runalyze</div>
        <form action={removeRunalyzeToken}>
          <button type="submit" style={{ fontSize: "0.78rem" }}>Disconnect</button>
        </form>
      </div>
      {stats.ok ? (
        entries.length > 0 ? (
          entries.map((e) => (
            <div key={e.key} className="li" style={{ justifyContent: "space-between" }}>
              <span className="muted">{e.key}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{e.value}</span>
            </div>
          ))
        ) : (
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>Connected, but no readable stats returned.</p>
        )
      ) : (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          {stats.error === "unauthorized"
            ? "Runalyze rejected the token — reads need a Supporter/Premium account, or the token expired."
            : `Couldn't read stats (tried: ${stats.probed?.map((p) => `${p.path} → ${p.status}`).join(", ") || "n/a"}).`}
        </p>
      )}
    </div>
  );
}
