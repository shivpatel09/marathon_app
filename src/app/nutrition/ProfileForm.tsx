import { saveProfile } from "./actions";

export interface ProfileDefaults {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: string | null;
  baselineActivity: string | null;
  bodyCompGoal: string | null;
  weeklyWeightChangeKg: number | null;
  dietaryPrefs: string[];
}

export default function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  return (
    <form action={saveProfile}>
      <h3 className="step">your details</h3>
      <div className="goal-row">
        <label>weight (kg)<input type="number" name="weightKg" step="0.1" defaultValue={defaults.weightKg ?? ""} required /></label>
        <label>height (cm)<input type="number" name="heightCm" step="0.1" defaultValue={defaults.heightCm ?? ""} required /></label>
        <label>age<input type="number" name="age" defaultValue={defaults.age ?? ""} required /></label>
        <label>sex
          <select name="sex" defaultValue={defaults.sex ?? "MALE"}>
            <option value="MALE">male</option>
            <option value="FEMALE">female</option>
          </select>
        </label>
      </div>

      <h3 className="step">activity &amp; goal</h3>
      <div className="goal-row">
        <label>daily activity (excl. running)
          <select name="baselineActivity" defaultValue={defaults.baselineActivity ?? "LIGHT"}>
            <option value="SEDENTARY">sedentary (desk job)</option>
            <option value="LIGHT">light</option>
            <option value="MODERATE">moderate (on feet)</option>
            <option value="ACTIVE">active (manual work)</option>
          </select>
        </label>
        <label>body-comp goal
          <select name="bodyCompGoal" defaultValue={defaults.bodyCompGoal ?? "MAINTAIN"}>
            <option value="MAINTAIN">maintain</option>
            <option value="LOSE_FAT">lose fat</option>
            <option value="GAIN">gain</option>
          </select>
        </label>
        <label>target change (kg/week)
          <input type="number" name="weeklyWeightChangeKg" step="0.25" defaultValue={defaults.weeklyWeightChangeKg ?? 0} />
        </label>
      </div>

      <h3 className="step">dietary preferences <span className="muted">optional, comma-separated</span></h3>
      <input type="text" name="dietaryPrefs" placeholder="vegetarian, no dairy" defaultValue={defaults.dietaryPrefs.join(", ")} style={{ width: "100%", maxWidth: 420 }} />

      <div style={{ marginTop: "1.5rem" }}>
        <button type="submit" className="primary">Save profile</button>
      </div>
    </form>
  );
}
