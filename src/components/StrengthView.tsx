import type { Phase, StrengthSession } from "@/lib/strength";

const PHASE_NOTE: Record<Phase, string> = {
  base: "Base phase — heavier compound lifts, building strength.",
  build: "Build phase — maintain load, add running-specific power.",
  peak: "Peak phase — reduced volume, maintenance + plyometrics to stay fresh.",
  taper: "Taper — minimal, light activation and mobility only.",
};

const RUN_LABEL: Record<string, string> = {
  VO2MAX: "VO₂max",
  SPEED: "speed",
  TEMPO_LT: "tempo",
  MARATHON_PACE: "marathon-pace",
  STRENGTH_INTERVALS: "strength intervals",
  EASY: "easy run",
  GENERAL_AEROBIC: "general aerobic",
  RECOVERY: "recovery",
  MEDIUM_LONG: "medium-long",
};

export default function StrengthView({
  phase,
  weekIndex,
  mesocycle,
  sessions,
}: {
  phase: Phase;
  weekIndex: number;
  mesocycle: string;
  sessions: StrengthSession[];
}) {
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        week {weekIndex} · {mesocycle} · <strong style={{ color: "var(--fg)" }}>{phase} phase</strong>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>{PHASE_NOTE[phase]}</p>

      {sessions.length === 0 ? (
        <div className="empty">No strength sessions scheduled for this week.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sessions.map((s) => (
            <div className="card" key={s.slot}>
              <div className="row" style={{ alignItems: "baseline" }}>
                <div className="card-h" style={{ marginBottom: 0 }}>
                  {s.dayName} · {s.name}
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  paired with {RUN_LABEL[s.pairedWith] ?? s.pairedWith.toLowerCase()}
                </span>
              </div>
              <table style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>exercise</th>
                    <th className="num">sets</th>
                    <th className="num">reps</th>
                    <th>notes</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        {item.name}
                        {item.cues && (
                          <div className="muted" style={{ fontSize: 12 }}>{item.cues}</div>
                        )}
                      </td>
                      <td className="num">{item.sets}</td>
                      <td className="num">{item.reps}</td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {[item.equipment, item.note].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <p className="muted" style={{ fontSize: 12.5, marginTop: "1rem" }}>
        Sessions are placed on your hard-run days so easy and recovery days stay true rest. Lift after the run, not before.
      </p>
    </div>
  );
}
