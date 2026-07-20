"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEastern } from "@/lib/time";

export interface ActivityRow {
  id: string;
  name: string;
  type: string;
  startDate: string; // ISO
  distanceM: number;
  movingTime: number;
  avgSpeed: number | null;
  avgHr: number | null;
}

const METERS_PER_MILE = 1609.34;

function miles(m: number): number {
  return m / METERS_PER_MILE;
}

function paceFromSpeed(speed: number | null): string {
  if (!speed || speed <= 0) return "—";
  const secPerMile = METERS_PER_MILE / speed;
  const min = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  return formatEastern(new Date(iso), { month: "short", day: "numeric" });
}

export default function ActivityList({ activities }: { activities: ActivityRow[] }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const totalMiles = activities.reduce((s, a) => s + miles(a.distanceM), 0);

  return (
    <div>
      <div className="row" style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
          Recent runs
        </h2>
        <button onClick={sync} disabled={syncing} className="primary">
          {syncing ? "Syncing…" : "Sync from Strava"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--accent)", fontSize: "0.9rem" }}>{error}</p>
      )}

      <div className="cards">
        <div className="stat">
          <div className="label">runs (8 wks)</div>
          <div className="value">{activities.length}</div>
        </div>
        <div className="stat">
          <div className="label">total miles</div>
          <div className="value">{totalMiles.toFixed(1)}</div>
        </div>
        <div className="stat">
          <div className="label">avg / week</div>
          <div className="value">{(totalMiles / 8).toFixed(1)}</div>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="empty">
          No runs yet. Click <strong>Sync from Strava</strong> to pull your last
          8 weeks.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>date</th>
              <th>run</th>
              <th className="num">miles</th>
              <th className="num">pace</th>
              <th className="num">hr</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.startDate)}</td>
                <td>{a.name}</td>
                <td className="num">{miles(a.distanceM).toFixed(1)}</td>
                <td className="num">{paceFromSpeed(a.avgSpeed)}</td>
                <td className="num">{a.avgHr ? Math.round(a.avgHr) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
