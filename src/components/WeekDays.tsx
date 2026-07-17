"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPace } from "@/lib/paces";
import { moveWorkout } from "@/app/week/actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const METERS_PER_MILE = 1609.34;

interface Segment {
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  kind?: string;
  paceSecPerMile?: number;
}

export interface StrengthItem {
  name: string;
  sets: number;
  reps: string;
  note?: string | null;
}

export interface DayWorkout {
  id: string;
  dayOfWeek: number;
  date: string; // ISO
  type: string;
  label?: string | null;
  pace?: string | null;
  plannedSegments: Segment[];
  strength?: { name: string; items: StrengthItem[] };
}

const TYPE_LABEL: Record<string, string> = {
  RECOVERY: "recovery",
  EASY: "easy",
  GENERAL_AEROBIC: "general aerobic",
  MEDIUM_LONG: "medium-long",
  LONG: "long run",
  MARATHON_PACE: "marathon pace",
  TEMPO_LT: "tempo (LT)",
  VO2MAX: "VO₂max",
  SPEED: "speed",
  STRENGTH_INTERVALS: "strength",
  STRIDES: "strides",
  RACE: "race day — marathon",
  TUNE_UP_RACE: "tune-up race",
  REST: "rest",
  CROSS_TRAIN: "cross-train",
};

function pillColors(type: string): { bg: string; fg: string } {
  switch (type) {
    case "RECOVERY":
    case "EASY":
    case "GENERAL_AEROBIC":
      return { bg: "#E1F5EE", fg: "#085041" };
    case "LONG":
    case "MEDIUM_LONG":
      return { bg: "#E6F1FB", fg: "#0C447C" };
    case "TEMPO_LT":
    case "MARATHON_PACE":
    case "VO2MAX":
    case "SPEED":
    case "STRENGTH_INTERVALS":
    case "RACE":
    case "TUNE_UP_RACE":
      return { bg: "#FAECE7", fg: "#712B13" };
    default:
      return { bg: "#F1EFE8", fg: "#444441" };
  }
}

function segText(s: Segment): string {
  if (s.kind === "intervals") {
    const unit = s.repUnit === "mi" ? " mi" : "m";
    const pace = s.paceSecPerMile ? ` @ ${formatPace(s.paceSecPerMile)}` : "";
    return `${s.reps} × ${s.repValue}${unit}${pace}`;
  }
  if (s.kind === "strides") return `${s.reps} × ${s.repValue}m strides`;
  if (s.kind === "race") {
    const pace = s.paceSecPerMile ? ` @ ${formatPace(s.paceSecPerMile)}/mi` : "";
    return `${s.value} ${s.unit}${pace}`;
  }
  if (typeof s.value === "number") {
    return `${s.value} mi${s.paceSecPerMile ? ` @ ${formatPace(s.paceSecPerMile)}` : ""}`;
  }
  return "";
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

function fmtMiles(mi: number): string {
  return mi % 1 === 0 ? String(mi) : mi.toFixed(1);
}

export default function WeekDays({ days }: { days: DayWorkout[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [openStrength, setOpenStrength] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function swap(a: string | null, b: string | null) {
    setSelectedId(null);
    setOverId(null);
    setDragId(null);
    if (!a || !b || a === b) return;
    setPending(true);
    try {
      await moveWorkout(a, b);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const selected = days.find((d) => d.id === selectedId);

  return (
    <div>
      {selected && (
        <div className="move-banner">
          <span>
            Moving <strong>{DAYS[selected.dayOfWeek]}</strong>&apos;s workout — tap another day to swap them.
          </span>
          <button type="button" onClick={() => setSelectedId(null)}>Cancel</button>
        </div>
      )}

      <div className="week-days" style={{ opacity: pending ? 0.55 : 1, pointerEvents: pending ? "none" : "auto" }}>
        {days.map((d) => {
          const c = pillColors(d.type);
          const detail = d.label ?? d.plannedSegments.map(segText).filter(Boolean).join(" · ");
          const miles = workoutMiles(d.plannedSegments);
          const date = new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const isSelected = selectedId === d.id;
          const isTarget = selectedId != null && selectedId !== d.id;
          const isOver = overId === d.id && dragId !== d.id;
          return (
            <div
              className={`day-row${isSelected ? " day-selected" : ""}${isTarget ? " day-target" : ""}`}
              key={d.id}
              draggable
              onClick={() => {
                if (isTarget) swap(selectedId, d.id);
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", d.id);
                setDragId(d.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overId !== d.id) setOverId(d.id);
              }}
              onDragLeave={() => {
                if (overId === d.id) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                swap(dragId, d.id);
              }}
              style={{ borderColor: isSelected || isOver ? "var(--accent)" : undefined, opacity: dragId === d.id ? 0.4 : 1 }}
            >
              <button
                type="button"
                className="day-grip"
                aria-label={isSelected ? "cancel move" : "move workout"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(isSelected ? null : d.id);
                }}
              >
                {isSelected ? "✕" : "⠿"}
              </button>

              <div className="day-when">
                <div className="day-name">{DAYS[d.dayOfWeek]}</div>
                <div className="day-date">{date}</div>
              </div>

              <div className="day-body">
                <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="type-pill" style={{ background: c.bg, color: c.fg }}>
                    {TYPE_LABEL[d.type] ?? d.type.toLowerCase()}
                  </span>
                  {d.strength && (
                    <button
                      type="button"
                      className="type-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenStrength(openStrength === d.id ? null : d.id);
                      }}
                      style={{ background: "#EEEDFE", color: "#3C3489", border: "none", cursor: "pointer" }}
                    >
                      + strength: {d.strength.name} {openStrength === d.id ? "▴" : "▾"}
                    </button>
                  )}
                </span>
                {detail && <div className="day-detail">{detail}</div>}
                {d.pace && <div className="day-pace">@ {d.pace}/mi</div>}
                {d.strength && openStrength === d.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    {d.strength.items.map((it, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.8rem", padding: "2px 0" }}
                      >
                        <span>{it.name}</span>
                        <span className="muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {it.sets} × {it.reps}
                          {it.note ? ` · ${it.note}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {miles > 0 && (
                <div className="day-miles">
                  {fmtMiles(miles)}
                  <span> mi</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
