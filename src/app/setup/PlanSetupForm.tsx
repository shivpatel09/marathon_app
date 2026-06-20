"use client";

import { useState } from "react";
import { createPlan } from "./actions";
import { derivePaces, parseGoalTime, formatPace } from "@/lib/paces";

export interface TemplateOption {
  key: string;
  name: string;
  author: string;
  weeks: number;
  daysPerWeek: number;
  peakMileage: number;
  longRunCap: number | null;
  description: string | null;
}

export default function PlanSetupForm({ templates }: { templates: TemplateOption[] }) {
  const [selected, setSelected] = useState(templates[0]?.key ?? "");
  const [goal, setGoal] = useState("3:10:00");

  const goalSec = parseGoalTime(goal);
  const paces = goalSec ? derivePaces(goalSec) : null;

  return (
    <form action={createPlan}>
      <input type="hidden" name="templateKey" value={selected} />

      <h3 className="step">1 · choose a training plan</h3>
      <div className="plan-grid">
        {templates.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={`plan-card${selected === t.key ? " sel" : ""}`}
          >
            <div className="plan-name">{t.name}</div>
            <div className="plan-author">{t.author}</div>
            <div className="plan-rows">
              <div><span>length</span><b>{t.weeks} wks</b></div>
              <div><span>days / week</span><b>{t.daysPerWeek}</b></div>
              <div><span>peak</span><b>{t.peakMileage} mi</b></div>
              <div><span>longest</span><b>{t.longRunCap ? `${t.longRunCap} mi cap` : "up to 22 mi"}</b></div>
            </div>
            {t.description && <div className="plan-desc">{t.description}</div>}
          </button>
        ))}
      </div>

      <h3 className="step">2 · your goal</h3>
      <div className="goal-row">
        <label>
          goal marathon time
          <input
            type="text"
            name="goalTime"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{ fontFamily: "var(--font-mono, monospace)", width: 130 }}
          />
        </label>
        <label>
          race date
          <input type="date" name="raceDate" defaultValue="2026-10-25" />
        </label>
      </div>

      <h3 className="step">3 · your derived paces <span className="muted">/ mi</span></h3>
      <div className="pace-grid">
        {paces ? (
          [
            ["marathon", paces.marathon],
            ["threshold", paces.lt],
            ["5K / VO₂", paces.vo2max],
            ["easy", paces.easy],
            ["long", paces.long],
            ["recovery", paces.recovery],
          ].map(([label, sec]) => (
            <div className="pace" key={label as string}>
              <div className="pacev">{formatPace(sec as number)}</div>
              <div className="pacel">{label as string}</div>
            </div>
          ))
        ) : (
          <p className="muted">Enter a valid goal time (h:mm:ss) to see paces.</p>
        )}
      </div>

      <button type="submit" className="primary" style={{ marginTop: "1.5rem" }} disabled={!paces}>
        Create my plan
      </button>
    </form>
  );
}
