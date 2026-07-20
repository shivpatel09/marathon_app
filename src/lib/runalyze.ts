// Runalyze Personal API client (server-side only — the token is a secret).
//
// Auth: a token generated at runalyze.com/settings/personal-api, sent as a
// `token` header. Base URL confirmed from Runalyze's own examples:
//   curl https://runalyze.com/api/v1/ping --header 'token: …'
//
// Runalyze's "current statistics" endpoint returns the calculations-panel
// numbers (race prognosis, effective VO2max, marathon shape, …). Its exact
// path isn't documented publicly (runalyze.com/doc/personal requires login),
// so we probe a short list of candidates once and report what worked; adjust
// CANDIDATE_STATS_PATHS if Runalyze names it differently.

const BASE = "https://runalyze.com/api/v1";

const CANDIDATE_STATS_PATHS = [
  "statistics/current",
  "statistics",
  "athlete/statistics",
  "prognosis",
];

export interface RunalyzeResult {
  ok: boolean;
  status?: number;
  path?: string;
  data?: unknown;
  error?: string;
  probed?: { path: string; status: number }[];
}

async function rGet(token: string, path: string): Promise<Response> {
  return fetch(`${BASE}/${path}`, {
    headers: { token, Accept: "application/json" },
    cache: "no-store",
  });
}

/** GET /ping — cheap token validation. */
export async function validateRunalyzeToken(token: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await rGet(token, "ping");
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** The calculations-panel statistics (race prognosis, VO2max, shape, …). */
export async function fetchStatistics(token: string): Promise<RunalyzeResult> {
  const probed: { path: string; status: number }[] = [];
  try {
    for (const path of CANDIDATE_STATS_PATHS) {
      const res = await rGet(token, path);
      probed.push({ path, status: res.status });
      if (res.ok) {
        return { ok: true, status: res.status, path, data: await res.json(), probed };
      }
      // 401/403 = token problem — no point probing further paths
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, error: "unauthorized", probed };
      }
    }
    return { ok: false, status: 404, error: "no statistics endpoint found", probed };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", probed };
  }
}

/** Race results (endpoint added by Runalyze in 2025). */
export async function fetchRaceResults(token: string): Promise<RunalyzeResult> {
  try {
    const res = await rGet(token, "race-results");
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    return { ok: true, status: res.status, path: "race-results", data: await res.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

// ---- helpers for rendering whatever shape the statistics payload has ----

/** True when a value plausibly encodes a duration in seconds (10 min .. 10 h). */
export function looksLikeDurationSeconds(key: string, value: number): boolean {
  const k = key.toLowerCase();
  if (!(k.includes("time") || k.includes("prognosis") || k.includes("duration") || k.includes("seconds"))) return false;
  return value >= 600 && value <= 36000;
}

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** "effectiveVO2max" / "marathon_shape" -> "effective VO2max" / "marathon shape" */
export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bvo2max\b/i, "VO₂max")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
