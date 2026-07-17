"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPace } from "@/lib/paces";
import { moveWorkout } from "@/app/week/actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  label?: string | null; // exact book prescription, if the plan provides one
  plannedSegments: Segment[];
  strength?: { name: string; items: StrengthItem[] }; // recommended session, if any
}

const TYPE_LABEL: Record<string, string> = {
  RECOVERY: "recovery",
  EASY: "easy",
  GENERAL_AEROBIC: "general aerobic",
  MEDIUM_LONG: "medium-long",
  LONG: "long run",
  MARATHON_PACE: "tempo (MP)",
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

export default function WeekDays({ days }: { days: DayWorkout[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openStrength, setOpenStrength] = useState<string | null>(null);

  async function handleDrop(targetId: string) {
    const sourceId = dragId;
    setOverId(null);
    setDragId(null);
    if (!sourceId || sourceId === targetId) return;
    setPending(true);
    try {
      await moveWorkout(sourceId, targetId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="week-days" style={{ opacity: pending ? 0.55 : 1, pointerEvents: pending ? "none" : "auto" }}>
      {days.map((d) => {
        const c = pillColors(d.type);
        const detail = d.label ?? d.plannedSegments.map(segText).filter(Boolean).join(" · ");
        const date = new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const isOver = overId === d.id && dragId !== d.id;
        const isDragging = dragId === d.id;
        return (
          <div
            className="day-row"
            key={d.id}
            draggable
            onDragStart={() => setDragId(d.id)}
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
              handleDrop(d.id);
            }}
            style={{
              cursor: "grab",
              borderColor: isOver ? "var(--accent)" : undefined,
              opacity: isDragging ? 0.4 : 1,
            }}
          >
            <span aria-hidden="true" style={{ color: "var(--muted)", cursor: "grab", userSelect: "none", fontSize: 16, lineHeight: 1 }}>⠿</span>
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
          </div>
        );
      })}
    </div>
  );
}
