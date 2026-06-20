"use client";

import { useState } from "react";
import { saveCheckIn } from "./actions";

export default function CheckInForm({ today, loggedToday }: { today: string; loggedToday: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card checkin-card">
      <button type="button" className="checkin-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{loggedToday ? "Update today’s check-in" : "Log today’s check-in"}</span>
        <span className="checkin-chevron">{open ? "✕" : "+"}</span>
      </button>

      {open && (
        <form action={saveCheckIn} className="checkin-form">
          <input type="hidden" name="date" value={today} />
          <div className="checkin-grid">
            <label>
              morning weight (lb)
              <input type="number" name="weightLb" step="0.1" placeholder="—" />
            </label>
            <label>
              intake felt
              <select name="intakeSignal" defaultValue="ON_TARGET">
                <option value="UNDER">under target</option>
                <option value="ON_TARGET">on target</option>
                <option value="OVER">over target</option>
              </select>
            </label>
            <label>
              energy (1–5)
              <input type="number" name="energyLevel" min="1" max="5" placeholder="—" />
            </label>
            <label>
              sleep (hrs)
              <input type="number" name="sleepHours" step="0.5" placeholder="—" />
            </label>
          </div>

          <label className="checkin-protein">
            <input type="checkbox" name="proteinHit" />
            hit protein target
          </label>

          <input type="text" name="notes" placeholder="notes (optional)" className="checkin-notes" />

          <div className="checkin-actions">
            <button type="submit" className="primary">Save check-in</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
