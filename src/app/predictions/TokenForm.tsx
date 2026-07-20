"use client";

import { useState } from "react";
import { saveRunalyzeToken } from "./actions";

export default function TokenForm() {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setError(null);
    setSaving(true);
    try {
      await saveRunalyzeToken(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to save token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={submit} className="card" style={{ maxWidth: 560 }}>
      <div className="card-h">Connect Runalyze</div>
      <ol style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: "0 0 12px", paddingLeft: 20 }}>
        <li>
          On Runalyze, open <b>Settings → Personal API</b>{" "}
          <span className="muted">(runalyze.com/settings/personal-api)</span>
        </li>
        <li>Create a token — give it read scopes and an expiry date</li>
        <li>Paste it below (it&apos;s stored in your account and only used server-side)</li>
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="password"
          name="token"
          placeholder="Runalyze API token"
          required
          autoComplete="off"
          style={{ flex: "1 1 240px" }}
        />
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Validating…" : "Connect"}
        </button>
      </div>
      {error && <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginBottom: 0 }}>{error}</p>}
    </form>
  );
}
