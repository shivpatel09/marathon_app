import { saveCheckIn } from "./actions";

export default function CheckInForm({ today }: { today: string }) {
  return (
    <form action={saveCheckIn} className="card" style={{ marginTop: "1rem" }}>
      <div className="card-h">today&apos;s check-in</div>
      <div className="goal-row">
        <label>date<input type="date" name="date" defaultValue={today} /></label>
        <label>morning weight (kg)<input type="number" name="weightKg" step="0.1" style={{ width: 110 }} /></label>
        <label>intake felt
          <select name="intakeSignal" defaultValue="ON_TARGET">
            <option value="UNDER">under</option>
            <option value="ON_TARGET">on target</option>
            <option value="OVER">over</option>
          </select>
        </label>
        <label>energy (1-5)<input type="number" name="energyLevel" min="1" max="5" style={{ width: 70 }} /></label>
        <label>sleep (h)<input type="number" name="sleepHours" step="0.5" style={{ width: 80 }} /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", margin: "10px 0", color: "var(--muted)" }}>
        <input type="checkbox" name="proteinHit" style={{ width: "auto" }} /> hit protein target
      </label>
      <input type="text" name="notes" placeholder="notes (optional)" style={{ width: "100%", maxWidth: 420 }} />
      <div style={{ marginTop: "0.9rem" }}>
        <button type="submit" className="primary">Log check-in</button>
      </div>
    </form>
  );
}
