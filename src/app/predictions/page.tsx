import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchStatistics,
  fetchRaceResults,
  fmtDuration,
  humanizeKey,
  looksLikeDurationSeconds,
} from "@/lib/runalyze";
import TokenForm from "./TokenForm";
import { removeRunalyzeToken } from "./actions";

export const dynamic = "force-dynamic";

interface Entry {
  section: string;
  key: string;
  value: string;
}

/** Flatten the (unknown-shape) statistics payload into readable rows. */
function flatten(data: unknown, section = "General", out: Entry[] = [], depth = 0): Entry[] {
  if (depth > 3 || data == null) return out;
  if (Array.isArray(data)) {
    data.forEach((v, i) => flatten(v, `${section} ${i + 1}`, out, depth + 1));
    return out;
  }
  if (typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v != null && typeof v === "object") {
        flatten(v, humanizeKey(k), out, depth + 1);
      } else if (v != null) {
        const value =
          typeof v === "number"
            ? looksLikeDurationSeconds(k, v)
              ? fmtDuration(v)
              : String(Math.round(v * 100) / 100)
            : String(v);
        out.push({ section, key: humanizeKey(k), value });
      }
    }
  }
  return out;
}

function pickHighlight(entries: Entry[], pattern: RegExp): Entry | undefined {
  return entries.find((e) => pattern.test(`${e.section} ${e.key}`));
}

export default async function PredictionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { runalyzeToken: true },
  });

  if (!user?.runalyzeToken) {
    return (
      <main className="container">
        <h1>Predictions</h1>
        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          Pull your race predictions — marathon prognosis, effective VO₂max, marathon shape — straight
          from your Runalyze account.
        </p>
        <TokenForm />
      </main>
    );
  }

  const [stats, races] = await Promise.all([
    fetchStatistics(user.runalyzeToken),
    fetchRaceResults(user.runalyzeToken),
  ]);

  const entries = stats.ok ? flatten(stats.data) : [];
  const marathon = pickHighlight(entries, /marathon.*(prognosis|prediction|time)|prognosis.*marathon/i);
  const vo2max = pickHighlight(entries, /vo₂max|vo2max/i);
  const shape = pickHighlight(entries, /shape/i);
  const highlights = [marathon, vo2max, shape].filter(Boolean) as Entry[];
  const sections = [...new Set(entries.map((e) => e.section))];

  const raceRows = races.ok && Array.isArray(races.data) ? (races.data as Record<string, unknown>[]) : [];

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Predictions</h1>
        <form action={removeRunalyzeToken}>
          <button type="submit" style={{ fontSize: "0.8rem" }}>Disconnect Runalyze</button>
        </form>
      </div>
      <p className="muted" style={{ margin: "0 0 1rem" }}>Live from your Runalyze account.</p>

      {stats.ok ? (
        <>
          {highlights.length > 0 && (
            <div className="cards">
              {highlights.map((h) => (
                <div className="stat" key={`${h.section}-${h.key}`}>
                  <div className="label">{h.key}</div>
                  <div className="value">{h.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="two-col">
            {sections.map((s) => (
              <div className="card" key={s}>
                <div className="card-h">{s}</div>
                {entries
                  .filter((e) => e.section === s)
                  .map((e) => (
                    <div key={`${s}-${e.key}`} className="li" style={{ justifyContent: "space-between" }}>
                      <span className="muted">{e.key}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{e.value}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </>
      ) : stats.error === "unauthorized" ? (
        <div className="warn-banner">
          Runalyze rejected your token (it may have expired or lack read scopes). Disconnect above and
          add a fresh token from runalyze.com/settings/personal-api.
        </div>
      ) : (
        <div className="warn-banner">
          <p style={{ margin: "0 0 6px" }}>
            Connected to Runalyze, but the statistics endpoint wasn&apos;t where this app expected.
            Endpoints tried:{" "}
            {stats.probed?.map((p) => `${p.path} (${p.status})`).join(", ") || "none"}.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Open runalyze.com/doc/personal while logged in to see your endpoint list — the statistics
            path can then be added to this app in one line.
          </p>
        </div>
      )}

      {raceRows.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-h">Race results on Runalyze</div>
          <table>
            <thead>
              <tr>
                {Object.keys(raceRows[0]).slice(0, 5).map((k) => (
                  <th key={k}>{humanizeKey(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raceRows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  {Object.entries(r).slice(0, 5).map(([k, v]) => (
                    <td key={k}>
                      {typeof v === "number" && looksLikeDurationSeconds(k, v)
                        ? fmtDuration(v)
                        : typeof v === "object"
                          ? "—"
                          : String(v ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
