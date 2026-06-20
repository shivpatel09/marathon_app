import Link from "next/link";
import { formatPace, type DerivedPaces } from "@/lib/paces";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const METERS_PER_MILE = 1609.34;

interface Segment {
  paceRef?: string;
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  kind?: string;
  paceSecPerMile?: number;
}

export interface DayWorkout {
  dayOfWeek: number;
  date: string; // ISO
  type: string;
  plannedSegments: Segment[];
}

interface Props {
  planName: string;
  totalWeeks: number;
  weekIndex: number;
  mesocycle: string;
  goalLabel: string;
  daysToRace: number;
  paces: DerivedPaces;
  days: DayWorkout[];
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
    const pace = s.paceSecPerMile ? ` @ ${formatPace(s.paceSecPerMile)}` : "";
    return `${s.value}${s.unit} race${pace}`;
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

export default function WeekView(p: Props) {
  const weekMiles = p.days.reduce((sum, d) => sum + workoutMiles(d.plannedSegments), 0);
  const runDays = p.days.filter((d) => d.type !== "REST").length;
  const prev = p.weekIndex > 1 ? p.weekIndex - 1 : null;
  const next = p.weekIndex < p.totalWeeks ? p.weekIndex + 1 : null;

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
        <span className="muted">your paces /mi —</span>
        <span>MP {formatPace(p.paces.marathon)}</span>
        <span>· LT {formatPace(p.paces.lt)}</span>
        <span>· 5K {formatPace(p.paces.vo2max)}</span>
        <span>· easy {formatPace(p.paces.easy)}</span>
        <span>· recovery {formatPace(p.paces.recovery)}</span>
      </div>

      <div className="cards">
        <div className="stat"><div className="label">planned</div><div className="value">{weekMiles.toFixed(1)} mi</div></div>
        <div className="stat"><div className="label">run days</div><div className="value">{runDays}</div></div>
        <div className="stat"><div className="label">race day</div><div className="value">{p.daysToRace} d</div></div>
      </div>

      <div className="week-days">
        {p.days.map((d) => {
          const c = pillColors(d.type);
          const detail = d.plannedSegments.map(segText).filter(Boolean).join(" · ");
          const date = new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div className="day-row" key={d.dayOfWeek}>
              <div className="day-when">
                <div className="day-name">{DAYS[d.dayOfWeek]}</div>
                <div className="day-date">{date}</div>
              </div>
              <div className="day-body">
                <span className="type-pill" style={{ background: c.bg, color: c.fg }}>
                  {TYPE_LABEL[d.type] ?? d.type.toLowerCase()}
                </span>
                {detail && <div className="day-detail">{detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
