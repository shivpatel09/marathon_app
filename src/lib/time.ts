// The app operates in US Eastern time — the Indianapolis (race) timezone.
// `America/New_York` is used rather than a fixed "EST" so it follows EST/EDT
// (daylight saving) automatically.
//
// Two kinds of values, handled differently on purpose:
//  • "now"-based logic and real timestamps (today, race countdown, current
//    week, Strava run dates) — rendered/rolled over in Eastern. This is what
//    was previously keyed off the server clock (UTC on Vercel).
//  • Planned workout / race dates — date-only calendar values stored at
//    midnight UTC. They denote a specific day regardless of timezone, so their
//    calendar day is read directly (timezone-independent), never shifted.

export const APP_TZ = "America/New_York";

const KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // en-CA => "YYYY-MM-DD"

/** yyyy-mm-dd calendar date of an instant, in Eastern (for now / real events). */
export function easternDateKey(d: Date): string {
  return KEY_FMT.format(d);
}

/** yyyy-mm-dd of a stored date-only value (planned workout / race date, kept at
 *  midnight UTC) — the intended calendar day, timezone-independent. */
export function plannedDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in Eastern. */
export function todayKey(now: Date = new Date()): string {
  return easternDateKey(now);
}

/** Midnight-UTC of the current Eastern calendar day. A numeric anchor that
 *  lines up with planned dates (also midnight UTC) and rolls over at Eastern
 *  midnight — use for `+date` comparisons and whole-day math. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(`${todayKey(now)}T00:00:00.000Z`);
}

/** Format a planned/date-only value (stored midnight UTC) — shows its day. */
export function formatPlannedDate(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** Format a real timestamp in Eastern (e.g. a Strava activity date). */
export function formatEastern(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("en-US", { ...opts, timeZone: APP_TZ });
}
