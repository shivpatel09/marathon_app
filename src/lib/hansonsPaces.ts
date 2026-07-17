// Hansons (Indy Monumental) pace table — transcribed verbatim from the user's
// Indy_Hansons spreadsheet. Paces are goal-time indexed (columns 3:55–4:10);
// for a goal between columns we linearly interpolate, and clamp at the ends.
// By construction Tempo == goal marathon pace and Strength == MP−10s, so those
// stay exact; Easy / Speed / Long are Hansons' prescribed ranges.
//
// Applies only to the `hansons-indy` plan; every other plan keeps the Riegel
// paces from src/lib/paces.ts.

export interface HansonsPaces {
  easy: [number, number]; // sec/mi range
  speed: [number, number];
  strength: number;
  tempo: number;
  long: [number, number];
}

interface Column extends HansonsPaces {
  goal: number; // goal marathon time, seconds
}

// sec/mi values read straight off the spreadsheet's pace table.
const COLUMNS: Column[] = [
  { goal: 14100 /* 3:55 */, easy: [627, 687], speed: [473, 493], strength: 527, tempo: 537, long: [567, 657] },
  { goal: 14400 /* 4:00 */, easy: [639, 699], speed: [483, 503], strength: 539, tempo: 549, long: [579, 669] },
  { goal: 14700 /* 4:05 */, easy: [650, 710], speed: [493, 514], strength: 550, tempo: 560, long: [590, 680] },
  { goal: 15000 /* 4:10 */, easy: [662, 722], speed: [503, 524], strength: 562, tempo: 572, long: [602, 692] },
];

// Heat-adjusted column (75°F / 90% humidity) — reference only, not applied
// automatically. Indy is a November race, but summer build weeks are hot.
export const HANSONS_HEAT_ADJ: HansonsPaces = {
  easy: [668, 780],
  speed: [505, 541],
  strength: 579,
  tempo: 590,
  long: [605, 746],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hansonsPacesFor(goalSeconds: number): HansonsPaces {
  const first = COLUMNS[0];
  const last = COLUMNS[COLUMNS.length - 1];
  if (goalSeconds <= first.goal) return strip(first);
  if (goalSeconds >= last.goal) return strip(last);

  let lo = first;
  let hi = last;
  for (let i = 0; i < COLUMNS.length - 1; i++) {
    if (goalSeconds >= COLUMNS[i].goal && goalSeconds <= COLUMNS[i + 1].goal) {
      lo = COLUMNS[i];
      hi = COLUMNS[i + 1];
      break;
    }
  }
  const t = (goalSeconds - lo.goal) / (hi.goal - lo.goal);
  const r = (a: number, b: number) => Math.round(lerp(a, b, t));
  return {
    easy: [r(lo.easy[0], hi.easy[0]), r(lo.easy[1], hi.easy[1])],
    speed: [r(lo.speed[0], hi.speed[0]), r(lo.speed[1], hi.speed[1])],
    strength: r(lo.strength, hi.strength),
    tempo: r(lo.tempo, hi.tempo),
    long: [r(lo.long[0], hi.long[0]), r(lo.long[1], hi.long[1])],
  };
}

function strip(c: Column): HansonsPaces {
  return { easy: [...c.easy], speed: [...c.speed], strength: c.strength, tempo: c.tempo, long: [...c.long] };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const range = (r: [number, number]) => `${fmt(r[0])}–${fmt(r[1])}`;

/** The pace string for a workout type, or null when the day has no target pace. */
export function hansonsPaceForType(type: string, p: HansonsPaces): string | null {
  switch (type) {
    case "EASY":
      return range(p.easy);
    case "SPEED":
      return range(p.speed);
    case "STRENGTH_INTERVALS":
      return fmt(p.strength);
    case "MARATHON_PACE":
      return fmt(p.tempo);
    case "LONG":
      return range(p.long);
    case "RACE":
      return fmt(p.tempo);
    default:
      return null;
  }
}

/** The five headline paces for the week-view strip. */
export function hansonsStrip(p: HansonsPaces): { label: string; value: string }[] {
  return [
    { label: "Easy", value: range(p.easy) },
    { label: "Speed", value: range(p.speed) },
    { label: "Strength", value: fmt(p.strength) },
    { label: "Tempo", value: fmt(p.tempo) },
    { label: "Long", value: range(p.long) },
  ];
}
