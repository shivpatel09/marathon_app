"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPace, type DerivedPaces } from "@/lib/paces";
import { hansonsStrip, hansonsPaceForType, type HansonsPaces } from "@/lib/hansonsPaces";
import WeekDays, { type DayWorkout } from "@/components/WeekDays";

const METERS_PER_MILE = 1609.34;

interface Segment {
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  kind?: string;
}

interface Props {
  planName: string;
  totalWeeks: number;
  weekIndex: number;
  mesocycle: string;
  goalLabel: string;
  daysToRace: number;
  paces: DerivedPaces;
  hansonsPaces?: HansonsPaces | null;
  hansonsHeatPaces?: HansonsPaces | null;
  days: DayWorkout[];
  warnings: string[];
}

function workoutMiles(segs: Segment[]): number {
  let mi = 0;
  for (const s of segs) {
    if (s.kind === "intervals") {
      const each = s.repUnit === "mi" ? s.repValue ?? 0 : (s.repValue ?? 0) / METERS_PER_MILE;
      mi += (s.reps ?? 0) * each;
    } else if (s.kind === "strides") {
      mi += ((s.reps ?? 0) * (s.repValue ?? 0)) / METERS_PER_MILE;
    } else if (s.kind === "race") {
      mi += s.unit === "K" ? ((s.value ?? 0) * 1000) / METERS_PER_MILE : s.value ?? 0;
    } else if (typeof s.value === "number") {
      mi += s.value;
    }
  }
  return mi;
}

export default function WeekView(p: Props) {
  const [heat, setHeat] = useState(false);
  const weekMiles = p.days.reduce((sum, d) => sum + workoutMiles(d.plannedSegments), 0);
  const completedMiles = p.days.reduce((sum, d) => sum + (d.actualMiles ?? 0), 0);
  const runDays = p.days.filter((d) => d.type !== "REST").length;
  const prev = p.weekIndex > 1 ? p.weekIndex - 1 : null;
  const next = p.weekIndex < p.totalWeeks ? p.weekIndex + 1 : null;

  // Hansons plan: choose the normal or heat-adjusted pace table, then resolve
  // the strip and each day's pace text from it.
  const activePaces: HansonsPaces | null =
    (heat ? p.hansonsHeatPaces : p.hansonsPaces) ?? null;
  const strip = activePaces ? hansonsStrip(activePaces) : null;
  const days: DayWorkout[] = activePaces
    ? p.days.map((d) => ({ ...d, pace: hansonsPaceForType(d.type, activePaces) }))
    : p.days;

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>{p.planName}</h1>
          <p className="muted" style={{ margin: 0 }}>
            week {p.weekIndex} of {p.totalWeeks} · {p.mesocycle} · goal {p.goalLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {prev ? <Link href={`/week?week=${prev}`}><button>‹</button></Link> : <button disabled>‹</button>}
          <span className="muted" style={{ fontSize: 13, minWidth: 44, textAlign: "center" }}>wk {p.weekIndex}</span>
          {next ? <Link href={`/week?week=${next}`}><button>›</button></Link> : <button disabled>›</button>}
        </div>
      </div>

      <div className="paces-strip">
        {strip ? (
          <>
            <span className="muted">
              your Hansons paces /mi{heat ? " (heat-adj)" : ""} —
            </span>
            {strip.map((z, i) => (
              <span key={z.label}>
                {i > 0 ? "· " : ""}
                {z.label} {z.value}
              </span>
            ))}
          </>
        ) : (
          <>
            <span className="muted">your paces /mi —</span>
            <span>MP {formatPace(p.paces.marathon)}</span>
            <span>· LT {formatPace(p.paces.lt)}</span>
            <span>· 5K {formatPace(p.paces.vo2max)}</span>
            <span>· easy {formatPace(p.paces.easy)}</span>
            <span>· recovery {formatPace(p.paces.recovery)}</span>
          </>
        )}
      </div>

      {p.hansonsPaces && (
        <label className={`heat-toggle${heat ? " on" : ""}`}>
          <input type="checkbox" checked={heat} onChange={(e) => setHeat(e.target.checked)} />
          <span className="switch" aria-hidden="true">
            <span className="knob" />
          </span>
          <span className="heat-label">
            ☀︎ Heat-adjusted paces
            <span className="muted"> — hot / humid days (≈75°F, 90%)</span>
          </span>
        </label>
      )}

      <div className="cards">
        <div className="stat"><div className="label">planned</div><div className="value">{weekMiles.toFixed(1)} mi</div></div>
        <div className="stat">
          <div className="label">completed</div>
          <div className="value" style={{ color: "var(--done)" }}>
            {completedMiles.toFixed(1)} mi
            {weekMiles > 0 && (
              <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 400, marginLeft: 6 }}>
                {Math.round((completedMiles / weekMiles) * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="stat"><div className="label">run days</div><div className="value">{runDays}</div></div>
        <div className="stat"><div className="label">race day</div><div className="value">{p.daysToRace} d</div></div>
      </div>

      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
        Tap the ⠿ handle on a workout, then tap another day to swap them (or drag on desktop).
      </p>

      {p.warnings.length > 0 && (
        <div className="warn-banner">
          {p.warnings.map((w, i) => (
            <div key={i} className="li" style={{ padding: "2px 0" }}>
              <span className="warn">!</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <WeekDays days={days} />
    </div>
  );
}
