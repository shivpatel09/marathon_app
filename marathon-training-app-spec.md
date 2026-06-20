# Marathon Training Performance App — Specification

**Status:** Draft v1
**Date:** 2026-06-19
**Author:** Shivam Patel
**Purpose:** A personal-use web app that unifies running, gym work, and nutrition for marathon training, built around proven training programs (Hansons, Pfitzinger 18/55) and weekly performance feedback.

---

## 1. Overview & vision

A web app that ties together the three pillars of marathon performance — **runs, strength work, and nutrition** — and gives the athlete actionable weekly feedback.

The user picks a proven training plan (Hansons or Pfitzinger 18/55), enters a **goal marathon time** and **race date**, and the app generates a fully personalized, dated schedule with target paces for every workout. Strava activities sync in automatically and are graded against the plan. The app then recommends gym sessions that complement the week's running and flags nutrition adjustments (calories / macros) to support the training load.

The core value is not the integrations — it's the **feedback engine** that turns weekly data into plain-language coaching.

---

## 2. Goals & non-goals

### Goals
- Let the user follow a structured, proven plan (Hansons, Pfitz 18/55) personalized to their goal time.
- Auto-sync runs from Strava and grade them against the planned workout.
- Compute weekly training load and surface injury-risk signals (ACWR).
- Recommend gym sessions that complement, not compete with, the run schedule.
- Provide nutrition targets (calories + macros) periodized to the training week.
- Produce a readable weekly review + week-ahead plan.

### Non-goals (for now)
- **Not a commercial product.** Personal use for the author and a small group of known users. No sale, no public distribution of plan data.
- Not a full social/feed platform.
- Not a replacement for medical or professional coaching advice.
- No native mobile app in v1 (responsive web only).

---

## 3. Users & access

- **Multi-user from day one** (the author + a few friends), but small-scale.
- Each user authenticates, connects their own Strava account, and has their own plan instance and data.
- Plan content is kept behind authentication and not exposed publicly.

---

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | One codebase for UI + API; clean OAuth handling |
| Database | Postgres (Neon or Supabase) | Relational fit for runs / meals / plans |
| ORM | Prisma | Type-safe schema + migrations |
| Auth | Auth.js (NextAuth) | Multi-user accounts; stores Strava OAuth tokens |
| Background jobs | Inngest (or Vercel Cron + queue) | Strava webhooks, nightly recompute |
| Hosting | Vercel + managed Postgres | Zero-ops, scales if opened up later |
| Feedback brain | TypeScript rules engine + Claude (Opus 4.8) | Deterministic math + natural-language coaching |

**Key design principle:** all numbers (paces, calories, macros, load) are computed **deterministically** in TypeScript. Claude is used only to translate those numbers into a readable weekly narrative — never to invent the numbers.

---

## 5. System architecture

```
SOURCES                 INGESTION              STORE            FEEDBACK ENGINE                 OUTPUT
Strava (runs)     ─┐
Food DB API       ─┼──▶  Sync layer    ──▶  Postgres   ──▶  ┌ Training load (ACWR)  ┐  ──▶  Weekly review
Profile & goals   ─┘     (OAuth,             (activities,    │ Gym periodization     │       + week-ahead plan
                          webhooks,           meals,         └ Nutrition engine      ┘       (dashboard + coaching)
                          jobs)               plans)
                                                                      ▲                              │
                                                                      └───────── next week ──────────┘
```

The loop is closed: each week's logged data feeds the engine, which updates the recommendations for the week ahead.

---

## 6. Core domain concepts

### 6.1 The plan abstraction

The central design decision: **plans are data, not code.** Hansons and Pfitzinger look different on paper but reduce to the same structure, so adding a plan is data entry, not new code.

Every plan is:
- A **template**: N weeks, days/week, peak volume, organized into **mesocycles**.
- A grid of **workouts** (week × day), each = **type + target + intensity zone**.
- Intensity stored as an **abstract pace reference** (e.g. `LT`, `MARATHON`), resolved per-user from their goal time.

### 6.2 Goal-time pace derivation (confirmed approach)

The user enters **one input: goal marathon finish time**. From it, the app derives goal marathon pace (MP) and equivalent race paces, then every workout pace hangs off those.

**Step 1 — Goal marathon pace (MP):**
```
MP (sec/mi) = goalTimeSeconds / 26.2188
```

**Step 2 — Equivalent race paces** via the Riegel endurance model (exponent ≈ 1.06):
```
T2 = T1 × (D2 / D1)^1.06
```
Used to derive 5K / 10K / half-marathon equivalent times (and paces) from the goal marathon time. These anchor the faster zones.

**Step 3 — Pace zones** (offsets relative to MP / equivalents):

| Zone (paceRef) | Target pace | Used by |
|---|---|---|
| `RECOVERY` | MP + 75–105 s/mi | both |
| `EASY` / `GENERAL_AEROBIC` | MP + 45–75 s/mi | both |
| `LONG` | MP + 60–90 s/mi | both |
| `MARATHON` | MP (goal pace) | Pfitz MP runs; **Hansons tempo** |
| `LT` (lactate threshold / tempo) | ≈ 15K–half pace (MP − 15–25 s/mi) | **Pfitz tempo** |
| `STRENGTH` (Hansons) | MP − ~10 s/mi | Hansons strength phase |
| `VO2MAX` / `SPEED` | ≈ 5K pace | Pfitz VO2max; Hansons speed phase |

> Note: Hansons tempo runs are run at **exact goal MP**, whereas Pfitz tempo runs are at LT pace. Same `paceRef` field, different value per plan — the abstraction holds.

A snapshot of the derived paces is stored on the user's plan instance so changing a goal mid-plan is an explicit, tracked event.

**VDOT-ready:** pace resolution sits behind the `paceRef` abstraction, so swapping the resolver from goal-time to VDOT later (for Daniels-style plans) is an isolated change — no template or schema rework.

### 6.3 Schedule flexibility & plan adjustments

The generated schedule is **mutable** — it reacts to the user, not the other way around.

**User-initiated moves (e.g. travel):**
- The user can drag a workout to a different day within the week.
- A **constraint engine** validates the move and warns (without hard-blocking) when it violates plan principles:
  - No two quality/SOS workouts on back-to-back days.
  - Preserve spacing between hard days (Hansons cumulative-fatigue spacing).
  - Keep the long run on its intended weekend slot where possible.
- `originalDate` is retained for audit; `movedByUser = true`.

**Missed workouts:**
- These plans do **not** "make up" missed runs — the app marks the workout `MISSED` and moves on rather than cramming it into later days.
- If misses cluster or weekly volume drops materially, the engine flags it in the weekly review (and ties into the ACWR / ramp-drift check).

**Goal-time change mid-plan:**
- Recompute `derivedPaces` and **regenerate all future** `ScheduledWorkout`s at the new paces.
- Past workouts keep the paces they were graded against (snapshot integrity).

---

## 7. Data model (Prisma sketch)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  // profile used for nutrition + pace math
  weightKg      Float?              // current; updated via check-ins for trend
  heightCm      Float?
  age           Int?
  sex           Sex?
  bodyCompGoal         BodyCompGoal?  // MAINTAIN | LOSE_FAT | GAIN
  weeklyWeightChangeKg Float?         // target rate, e.g. -0.25
  baselineActivity     ActivityLevel? // non-running NEAT
  dietaryPrefs         String[]       // e.g. ["vegetarian", "no_dairy"]
  stravaAccount StravaAccount?
  planInstances UserPlanInstance[]
  checkIns      DailyCheckIn[]
}

model StravaAccount {
  id           String @id @default(cuid())
  userId       String @unique
  user         User   @relation(fields: [userId], references: [id])
  athleteId    BigInt
  accessToken  String
  refreshToken String
  expiresAt    DateTime
}

// ---- Plan templates (the proven programs) ----

model TrainingPlanTemplate {
  id          String      @id @default(cuid())
  name        String      // "Pfitzinger 18/55", "Hansons Advanced"
  author      String
  weeks       Int         // 18
  daysPerWeek Int
  peakMileage Int
  longRunCap  Int?        // 16 for Hansons, null for Pfitz
  mesocycles  Mesocycle[]
}

model Mesocycle {
  id         String              @id @default(cuid())
  templateId String
  template   TrainingPlanTemplate @relation(fields: [templateId], references: [id])
  name       String              // "Endurance", "LT + endurance", "Speed phase"...
  startWeek  Int
  endWeek    Int
  workouts   WorkoutTemplate[]
}

model WorkoutTemplate {
  id          String      @id @default(cuid())
  mesocycleId String
  mesocycle   Mesocycle   @relation(fields: [mesocycleId], references: [id])
  weekIndex   Int         // 1..18
  dayOfWeek   Int         // 0..6
  type        WorkoutType
  isDouble    Boolean     @default(false)
  segments    Json        // [{ type, value, unit, paceRef }]
}

enum WorkoutType {
  RECOVERY
  EASY
  GENERAL_AEROBIC
  MEDIUM_LONG
  LONG
  MARATHON_PACE
  TEMPO_LT
  VO2MAX
  SPEED
  STRENGTH_INTERVALS
  STRIDES
  TUNE_UP_RACE
  REST
  CROSS_TRAIN
}

// ---- Per-user instance ----

model UserPlanInstance {
  id           String            @id @default(cuid())
  userId       String
  user         User              @relation(fields: [userId], references: [id])
  templateId   String
  raceDate     DateTime
  goalTimeSec  Int
  derivedPaces Json              // snapshot of resolved zone paces
  createdAt    DateTime          @default(now())
  scheduled    ScheduledWorkout[]
}

model ScheduledWorkout {
  id                 String   @id @default(cuid())
  planInstanceId     String
  planInstance       UserPlanInstance @relation(fields: [planInstanceId], references: [id])
  date               DateTime          // current (possibly user-moved) date
  originalDate       DateTime          // as first generated; for audit/constraints
  movedByUser        Boolean  @default(false)
  type               WorkoutType
  plannedSegments    Json     // resolved to real distances + real paces
  targetRacePace     Float?   // for TUNE_UP_RACE: expected race pace (sec/mi)
  raceDistanceM      Float?   // for TUNE_UP_RACE: e.g. 8K, 10K, 15K
  status             WorkoutStatus @default(PLANNED)
  matchedActivityId  String?  // Strava activity id
  adherenceScore     Float?   // 0..1, set after grading
}

enum WorkoutStatus { PLANNED COMPLETED MISSED PARTIAL }

// ---- Synced data ----

model Activity {
  id         String @id            // strava activity id
  userId     String
  startTime  DateTime
  distanceM  Float
  movingTime Int
  avgPace    Float
  avgHr      Int?
  splits     Json?
  raw        Json
}

// Lightweight v1: the recurring nutrition signal. Full meal logging
// (MealLogEntry) is a later, optional enhancement.
model DailyCheckIn {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  date         DateTime
  weightKg     Float?        // morning weigh-in (optional; trend is what matters)
  intakeSignal IntakeSignal? // rough self-report
  estCalories  Int?          // optional rough number
  proteinHit   Boolean?      // hit protein target?
  energyLevel  Int?          // 1..5 subjective
  soreness     Int?          // 1..5
  sleepHours   Float?
  notes        String?
}

// Optional future: full meal logging via food DB API
model MealLogEntry {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime
  name      String
  calories  Int
  proteinG  Float
  carbsG    Float
  fatG      Float
  source    String   // food DB API id / manual
}

// ---- Strength library ----

model StrengthExercise {
  id           String          @id @default(cuid())
  name         String          // "Back squat", "Single-leg RDL"
  pattern      MovementPattern
  equipment    String?
  isUnilateral Boolean         @default(false)
  cues         String?
}

model StrengthSessionTemplate {
  id    String @id @default(cuid())
  phase String // base | build | peak | taper
  name  String // "Lower strength A"
  items Json   // [{ exerciseId, sets, reps, progression, placement }]
}

enum Sex { MALE FEMALE }
enum BodyCompGoal { MAINTAIN LOSE_FAT GAIN }
enum ActivityLevel { SEDENTARY LIGHT MODERATE ACTIVE }
enum IntakeSignal { UNDER ON_TARGET OVER }
enum MovementPattern { SQUAT HINGE LUNGE PUSH PULL CORE PLYO CALF }
```

---

## 8. Integrations

### 8.1 Strava ✅
- OAuth2 connect; store access + refresh tokens per user.
- Pull last 8 weeks on connect, then keep current via **webhooks** (push) with a nightly reconciliation job as backstop.
- Fields used: distance, moving time, pace, HR, splits, elevation.
- Respect rate limits; refresh tokens proactively before expiry.

### 8.2 Food tracking ⚠️ (no MyFitnessPal)
- **MyFitnessPal shut down its public API in 2020** — no diary sync is possible.
- **v1 is lightweight (decided):** no meal logging. The app *estimates* daily calorie + protein targets and uses a quick **daily check-in** (bodyweight + rough intake signal) with **bodyweight trend as the ground-truth correction**. This closes the feedback loop without per-meal effort.
- **Later (optional):** full meal logging powered by a food database API — **Nutritionix** (large DB), **FatSecret Platform API** (free tier, diary features), or **Cronometer** partner API (most accurate macros). Modeled now via `MealLogEntry` but not built in v1.

---

## 9. The feedback engine

### 9.1 Training load & injury risk
- Weekly volume, intensity distribution (easy vs hard share).
- **ACWR (acute:chronic workload ratio)** = last-7-day load ÷ rolling-28-day average load. Sweet spot **0.8–1.3**; flag **> 1.5** as elevated injury risk.
- Detect ramp drift vs the plan's prescribed volume progression.

### 9.2 Adherence grading
When an activity syncs, match it to that day's `ScheduledWorkout` and grade:
- Distance vs prescribed.
- Pace per segment vs target zone.
- **Easy-day discipline** — flag easy runs run too fast (the #1 amateur mistake, and exactly what Hansons' cumulative-fatigue model punishes).
- Set `adherenceScore` and `status`.

### 9.3 Gym periodization & strength library
- 2 strength sessions/week that complement the run schedule.
- Heavy lower-body lifts placed on **hard-run days** (avoid stacking quality + heavy legs); easy/recovery days stay easy.
- Shift toward maintenance + plyometrics/mobility during peak and taper mesocycles.
- Anchored to the plan's existing SOS / quality-day schedule.

**Strength library (defined in-app, decided):** rather than license a third-party library, we define our own from established marathon-strength principles. Organized by **movement pattern** (`StrengthExercise.pattern`): squat, hinge, lunge, push, pull, core, plyometric, calf — with an emphasis on **single-leg / posterior-chain / core** work that supports running mechanics.

**Phase-based progression** (`StrengthSessionTemplate.phase`), mapped to the run mesocycle:
- **Base:** heavier compound lifts, linear progression (build strength).
- **Build:** maintain load, introduce running-specific power / plyometrics.
- **Peak:** reduce volume, maintenance only — protect the legs for key runs.
- **Taper:** minimal, mobility + light activation.

### 9.4 Nutrition (lightweight, estimate + correct)

**Inputs needed for valuable feedback:**

| Bucket | Inputs |
|---|---|
| One-time / occasional (profile) | weight, height, age, sex; baseline (non-running) activity level; body-comp goal + target rate; dietary preferences/restrictions |
| Automatic | run calories from Strava (≈1 kcal/kg/km) |
| Recurring check-in (the only ongoing ask) | periodic morning bodyweight; rough intake signal (under/on-target/over); protein target hit (y/n); optional energy/soreness/sleep |

**Targets:**
- TDEE = Mifflin-St Jeor BMR + NEAT (baseline activity) + Strava training calories, adjusted by body-comp goal.
- Protein **1.6–2.2 g/kg**.
- **Carb periodization** by training day: high on long-run / SOS / quality days (e.g. 6–10 g/kg), lower on rest/recovery days; fat fills the remainder.

**The correction loop (why lightweight works):**
- Compare estimated TDEE against the intake signal **and the bodyweight trend**.
- Weight trend is ground truth — it absorbs estimation error. If the user trends down faster than their goal during a peak week, recommend adding carbs around hard days.
- Flag chronic under-fueling (RED-S risk) when the trend + low energy/soreness signals indicate intake is consistently trailing expenditure.

### 9.5 Weekly coaching report
- Claude synthesizes load + adherence + nutrition into a Sunday-night review and the week-ahead plan.
- Reads like a coach: e.g. "you're on Pfitz week 6; you nailed the LT workout but 3 of 4 easy runs were 20s/mi too fast — back off or you'll arrive at the long runs cooked."
- **Leads with judgment, not data** — narrative first, metrics second; surfaces *one* priority rather than every detected issue (triage is the coaching layer's job).

**LLM interface contract:** the report is generated from a fully-computed structured input — the model synthesizes and prioritizes but never originates numbers. System prompt enforces "use only the supplied figures; do not invent paces, calories, or counts."

```ts
interface WeeklyReviewInput {
  planName: string; weekIndex: number; mesocycle: string;
  mileage: { planned: number; actual: number };
  workouts: { onTarget: number; total: number;
    graded: { day: string; type: string; verdict: string }[] };
  acwr: { value: number; inRange: boolean; trend: number[] };
  intensitySplit: { easyPct: number; hardPct: number };
  nutrition: { weightDeltaKg: number; estExpenditure: number;
    reportedIntake: number; flag?: string };
  weekAhead: { focus: string; keyWorkouts: string[] };
}
// → returns: narrative (string) + one prioritized coachingAdjustment (string)
```

---

## 10. The v1 plans

Three templates ship in v1: **Pfitzinger 18/55**, **Hansons Beginner**, and **Hansons Advanced**. All are 18 weeks and all anchor to **goal marathon pace**, so the goal-time pace anchor covers them with no VDOT needed.

### Pfitzinger 18/55 (peak 55 mpw)
Maps cleanly to mesocycles:

| Mesocycle | Weeks | Signature workouts |
|---|---|---|
| Endurance | 1–6 | general aerobic, medium-long runs, long runs, strides |
| LT + endurance | 7–11 | lactate-threshold (tempo) runs added |
| Race prep | 12–15 | VO2max intervals, marathon-pace long runs, tune-up races |
| Taper | 16–18 | volume drops, sharpening |

Notes: prescribed mostly by **distance**; needs the `MEDIUM_LONG` type and optional `isDouble` at higher mileage. Tempo `paceRef = LT`.

**Tune-up races** (race-prep mesocycle): represented as `WorkoutType.TUNE_UP_RACE` with `raceDistanceM` (e.g. 8K–15K) and a `targetRacePace` derived from current fitness (Riegel equivalent of the goal time). The week view shows the race and its expected pacing like any other prescribed workout; when it syncs from Strava it's graded against the target, and the result can later feed a fitness re-estimate.

### Hansons (Beginner & Advanced — both ship in v1)
Philosophy-driven (cumulative fatigue), 6 days/week, **three SOS workouts/week**, **16-mile long-run cap**. The two variants share structure; **Advanced** starts at higher mileage and **Beginner** ramps from a lower base — encoded as two templates with different weekly volumes, not different code.

- Mid-plan phase switch: **speed phase** (intervals at 5K–10K pace) → **strength phase** (intervals at ~MP − 10 s/mi). Modeled as a mesocycle boundary that swaps the interval `paceRef`.
- **Tempo runs at exact goal MP** → tempo `paceRef = MARATHON`.
- Easy running fills the non-SOS days.

**Model additions these plans force:** a `MEDIUM_LONG` workout type, an optional `isDouble` flag, a `longRunCap` on the template, and the `TUNE_UP_RACE` type. Everything else is data entry.

> **Licensing note:** Hansons and Pfitz are copyrighted published works. This app is private, non-commercial, for the author and a few known users, behind authentication, with plan data not publicly exposed. Source books should be owned. Not legal advice.

---

## 11. Phased build plan

| Phase | Scope | Outcome |
|---|---|---|
| **0 — Foundation** | Accounts, Strava OAuth, pull + display last 8 weeks | Hardest integration proven |
| **1 — Plans & paces** | Encode the 3 templates (Pfitz, Hansons Beginner/Advanced); goal-time pace derivation; generate dated `ScheduledWorkout`s; week view with drag-to-move + constraint checks | Personalized plan on screen |
| **2 — Adherence** | Match activities → scheduled workouts; grade; ACWR + load dashboard; tune-up race handling | Real running feedback |
| **3 — Nutrition (lightweight)** | Profile inputs + daily check-in; TDEE + macro targets; bodyweight-trend correction; under-fueling flags | Fueling guidance |
| **4 — Gym** | In-house strength library; phase-progressed sessions anchored to the run schedule | Runs ↔ gym tied together |
| **5 — Coaching report** | Claude weekly review + week-ahead synthesis | Closes the loop |

---

## 12. Key decisions (log)

- **Plan-driven, not generator** — users pick a proven plan; the app tracks adherence rather than inventing workouts.
- **Goal-time pace anchor** (confirmed) — single input (goal marathon time) derives all paces; VDOT deferred.
- **Plans as data** — one template abstraction serves all plans; new plans = data entry.
- **Deterministic math, LLM narrative** — never let the model invent paces/calories.
- **Lightweight nutrition first** — estimate targets + daily check-in, correct via bodyweight trend; full meal logging deferred.
- **Mutable schedule** — user can move workouts (validated by a constraint engine); goal-time change regenerates future workouts; missed runs are not made up.
- **Three v1 plans** — Pfitz 18/55 + Hansons Beginner + Hansons Advanced.
- **In-house strength library** — defined from marathon-strength principles, phase-progressed.
- **VDOT-ready abstraction** — paces resolved behind `paceRef`; VDOT is an isolated future swap.
- **Multi-user, non-commercial, private.**

---

## 13. Open questions / future

The original six are now resolved (see Key decisions). Remaining items to settle before/during build:

1. **Constraint engine strictness** — when a user moves a workout into a principle-violating slot, warn-only or offer an auto-rearrange suggestion?
2. **Check-in cadence** — daily prompt vs. "weigh-in when you can" passive trend; what minimum data density makes the nutrition correction reliable?
3. **Tune-up race result → fitness re-estimate** — should a strong/weak tune-up auto-suggest a goal-time adjustment, or stay advisory?
4. **Strength exercise seed list** — finalize the actual exercises, sets/reps, and progression numbers per phase.
5. **Hansons variant guidance** — how the app helps a user choose Beginner vs Advanced at signup.
6. **VDOT support** — add when/if Daniels-style plans are wanted (abstraction already in place).

---

## 14. UI mockups

Visual references for the build. Both are themed with the app's design tokens (CSS variables for light/dark; Tabler outline icon webfont) and use a categorical color scheme: easy/recovery = teal, endurance = blue, quality/race = coral, strength = purple, rest = gray.

### 14.1 System architecture diagram

High-level data flow: sources → ingestion → store → feedback engine → weekly output, with the closed "next week" loop. (Same as the ASCII sketch in §5, rendered.)

**Design decisions:** gray for infrastructure/external nodes, teal for the feedback-engine trio (the product's value), purple for the user-facing output; a dashed loop edge communicates that each week's data feeds the next week's recommendations.

```svg
<svg width="100%" viewBox="0 0 680 540" role="img" xmlns="http://www.w3.org/2000/svg">
<title>Marathon training app architecture</title>
<desc>Data flows from Strava, a food database API, and user goals into a sync layer, then a Postgres store, then a three-part feedback engine for training load, gym work, and nutrition, which produces a weekly review and plan.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
<g class="c-gray"><rect x="40" y="50" width="180" height="50" rx="8"/><text class="th" x="130" y="73" text-anchor="middle">Strava</text><text class="ts" x="130" y="90" text-anchor="middle">runs, pace, HR</text></g>
<g class="c-gray"><rect x="250" y="50" width="180" height="50" rx="8"/><text class="th" x="340" y="73" text-anchor="middle">Food database API</text><text class="ts" x="340" y="90" text-anchor="middle">Nutritionix / FatSecret</text></g>
<g class="c-gray"><rect x="460" y="50" width="180" height="50" rx="8"/><text class="th" x="550" y="73" text-anchor="middle">Profile &amp; goals</text><text class="ts" x="550" y="90" text-anchor="middle">race date, weight</text></g>
<line class="arr" x1="130" y1="100" x2="280" y2="140" stroke="#888780" marker-end="url(#arrow)"/>
<line class="arr" x1="340" y1="100" x2="340" y2="140" stroke="#888780" marker-end="url(#arrow)"/>
<line class="arr" x1="550" y1="100" x2="400" y2="140" stroke="#888780" marker-end="url(#arrow)"/>
<g class="c-gray"><rect x="160" y="142" width="360" height="50" rx="8"/><text class="th" x="340" y="165" text-anchor="middle">Sync &amp; ingestion</text><text class="ts" x="340" y="182" text-anchor="middle">OAuth, webhooks, background jobs</text></g>
<line class="arr" x1="340" y1="192" x2="340" y2="230" stroke="#888780" marker-end="url(#arrow)"/>
<g class="c-gray"><rect x="190" y="232" width="300" height="50" rx="8"/><text class="th" x="340" y="255" text-anchor="middle">Postgres data store</text><text class="ts" x="340" y="272" text-anchor="middle">activities, meals, plans</text></g>
<line class="arr" x1="340" y1="282" x2="130" y2="322" stroke="#1D9E75" marker-end="url(#arrow)"/>
<line class="arr" x1="340" y1="282" x2="340" y2="322" stroke="#1D9E75" marker-end="url(#arrow)"/>
<line class="arr" x1="340" y1="282" x2="550" y2="322" stroke="#1D9E75" marker-end="url(#arrow)"/>
<text class="ts" x="40" y="316" text-anchor="start">feedback engine</text>
<g class="c-teal"><rect x="40" y="324" width="180" height="56" rx="8"/><text class="th" x="130" y="349" text-anchor="middle">Training load</text><text class="ts" x="130" y="366" text-anchor="middle">volume, ACWR</text></g>
<g class="c-teal"><rect x="250" y="324" width="180" height="56" rx="8"/><text class="th" x="340" y="349" text-anchor="middle">Gym periodization</text><text class="ts" x="340" y="366" text-anchor="middle">lifts vs run days</text></g>
<g class="c-teal"><rect x="460" y="324" width="180" height="56" rx="8"/><text class="th" x="550" y="349" text-anchor="middle">Nutrition engine</text><text class="ts" x="550" y="366" text-anchor="middle">calories, macro timing</text></g>
<line class="arr" x1="130" y1="380" x2="290" y2="420" stroke="#534AB7" marker-end="url(#arrow)"/>
<line class="arr" x1="340" y1="380" x2="340" y2="420" stroke="#534AB7" marker-end="url(#arrow)"/>
<line class="arr" x1="550" y1="380" x2="390" y2="420" stroke="#534AB7" marker-end="url(#arrow)"/>
<g class="c-purple"><rect x="190" y="422" width="300" height="56" rx="8"/><text class="th" x="340" y="447" text-anchor="middle">Weekly review &amp; plan</text><text class="ts" x="340" y="464" text-anchor="middle">dashboard + coaching</text></g>
<path d="M490 450 C 640 450, 650 75, 640 75" fill="none" stroke="#888780" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#arrow)"/>
<text class="ts" x="612" y="270" text-anchor="middle"><tspan x="612">next</tspan><tspan x="612" dy="1.3em">week</tspan></text>
</svg>
```

### 14.2 Week view

The primary screen. Example: Pfitzinger 18/55, week 13 of 18 (race preparation), goal 3:10:00.

**What it shows:**
- Header with plan / week / mesocycle / goal, week navigation, and a live **paces strip** (all derived from the single goal-time input).
- Summary metric cards: planned mileage, done-so-far, **ACWR** (color-coded against the 0.8–1.3 safe band), race-day countdown.
- A vertical list of **day cards** with drag handles (the §6.3 reschedule feature), each showing the workout-type pill, distance, paired strength chip, and **segment-level target paces**.
- **Adherence states:** completed + on-pace (green), completed + flagged (amber, e.g. "easy run 0:25/mi too fast"), today (blue outline), planned (muted).
- A distinct **tune-up race card** (Sunday) with race distance, target pace + finish time, and warmup/cooldown structure.
- Color legend and hand-off action buttons (pace the race / reschedule for travel).

**Design decisions:**
- **Vertical day-list, not a 7-column calendar grid** — reads better on mobile and leaves room for per-segment paces. (A calendar grid is the alternative if the at-a-glance feel is preferred.)
- Strength sessions render as **chips on their paired run day**, not separate rows.
- The race card uses a tinted background to stand out; "today" uses a blue outline.

```html
<style>
.pill{font-size:11px;font-weight:500;padding:2px 8px;border-radius:var(--border-radius-md);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.day{display:flex;gap:14px;align-items:stretch;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:13px 16px}
.seg{font-size:12.5px;color:var(--color-text-secondary);font-family:var(--font-mono)}
.stat{background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px 14px}
.statlbl{font-size:12px;color:var(--color-text-secondary)}
.statval{font-size:22px;font-weight:500;margin-top:2px}
</style>
<div style="padding:0.5rem 0 0">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">
    <div>
      <div style="font-size:18px;font-weight:500">Pfitzinger 18/55</div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px">week 13 of 18 · race preparation · goal 3:10:00</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button aria-label="previous week"><i class="ti ti-chevron-left"></i></button>
      <span style="font-size:13px;color:var(--color-text-secondary)">wk 13</span>
      <button aria-label="next week"><i class="ti ti-chevron-right"></i></button>
    </div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 4px">
    <span class="seg" style="color:var(--color-text-tertiary)">your paces /mi —</span>
    <span class="seg">MP 7:15</span><span class="seg">· LT 6:55</span><span class="seg">· 5K 6:15</span><span class="seg">· easy 8:15</span><span class="seg">· recovery 8:45</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:14px 0">
    <div class="stat"><div class="statlbl">planned</div><div class="statval">47 mi</div></div>
    <div class="stat"><div class="statlbl">done so far</div><div class="statval">14 mi</div></div>
    <div class="stat"><div class="statlbl">acwr</div><div class="statval" style="color:var(--color-text-success)">1.12</div></div>
    <div class="stat"><div class="statlbl">race day</div><div class="statval">35 d</div></div>
  </div>
  <!-- day cards: Mon rest · Tue VO2max 9mi (on pace) + strength · Wed recovery 5mi (flagged 0:25 fast) ·
       Thu medium-long 11mi (today) · Fri recovery 4mi + strides + strength · Sat recovery 5mi shakeout ·
       Sun TUNE-UP RACE 10K @ ~6:50, 13mi total. Each card: grip handle, day/date, type pill,
       distance, segment paces, status badge. Full card markup follows the .day pattern above. -->
</div>
```

> The week-view day-card markup is abbreviated here for readability; the live version (rendered in design review) contains all seven fully-detailed cards plus the color legend and action buttons. Regenerate from the canonical version when implementing.

### 14.3 Plan picker (onboarding)

The setup screen. Three steps: pick a plan, enter goal time + race date, preview derived paces. **Interactive** — paces recompute live from the goal time, and the start date counts back 18 weeks from race day.

**What it shows:**
- Three selectable **plan cards** (Pfitz 18/55, Hansons Beginner, Hansons Advanced) exposing the differentiators that drive the choice: length, days/week, peak volume, longest run (the Hansons 16-mi cap vs. Pfitz's 22-milers is the clearest decision driver — relevant to open question #5).
- A **goal marathon time** input and **race date** input — the only data the user supplies.
- A **derived-paces grid** (marathon, threshold, 5K/VO₂, easy, long, recovery) that updates on every keystroke.
- A summary line resolving plan + dates ("…18 weeks · starts Jun 22 → race Oct 25").

**Design decisions:**
- This screen is the live proof of the §6.2 derivation — a single input fans out to every pace.
- The **Riegel equivalency model** is used (not a flat "MP − X" offset), so paces scale correctly for fast and slow runners alike. This is the reusable bit of logic and should move into the shared pace-resolution module.

The canonical pace-derivation logic (keep this — it's the reference implementation):

```js
const MARA_MI = 26.2188, HM_MI = 13.1094, K5_MI = 3.10686;

function fmt(s){ s = Math.round(s); const m = Math.floor(s/60), r = s%60; return m + ':' + String(r).padStart(2,'0'); }

// Riegel: time scales with distance^1.06, so pace scales with distance^0.06
function pace(mpSecPerMi, dMi){ return mpSecPerMi * Math.pow(dMi/MARA_MI, 0.06); }

function derivePaces(goalSec){
  const mp = goalSec / MARA_MI;            // marathon pace, sec/mi
  return {
    marathon:  mp,
    threshold: pace(mp, HM_MI),            // ≈ half-marathon / 15K pace
    vo2:       pace(mp, K5_MI),            // ≈ 5K race pace
    easy:      mp + 60,                    // MP + offsets (sec/mi)
    long:      mp + 75,
    recovery:  mp + 90,
  };
}
// start date = race date − 126 days (18 weeks)
```

The plan-card grid and form markup follow the card/input patterns from §14.2; abbreviated here. Regenerate the full interactive version from the canonical source when implementing.

### 14.4 Weekly review / coaching report

The Sunday summary that closes the loop. The clearest illustration of the deterministic-math + LLM-narrative split (§9.5): every number is computed by the rules engine; Claude writes only the connective prose.

**What it shows:**
- A **coaching narrative** card (LLM output) that synthesizes the week and names the single highest-priority fix.
- A **metric strip**: mileage vs. plan, on-target workout count, **ACWR with a multi-week sparkline** (shaded 0.8–1.3 safe band), easy/hard intensity split.
- **What went well / watch this week** — the adherence-grading output turned into wins and watch-outs (recurring themes carry over from the week view's per-run flags).
- A **nutrition check** — weight trend + estimated expenditure vs. reported intake → a specific carb recommendation tied to hard days.
- The **week ahead** — next week's key workouts plus one coaching adjustment.

**Design decisions:**
- Leads with judgment, not data (narrative first); surfaces one priority, not ten.
- ACWR sparkline shades the safe band so "in range" reads at a glance.
- Ends on a single actionable adjustment, not just a recap.

Built from the `WeeklyReviewInput` contract in §9.5. Markup follows the card/metric patterns from §14.2–14.3; abbreviated here — regenerate the full version when implementing.

---

*End of spec v2 — incorporates plan selection (Hansons B/A + Pfitz 18/55), goal-time pace derivation, lightweight nutrition, mutable scheduling, tune-up races, in-house strength library, the weekly-review LLM contract, and UI mockups (§14.1–14.4).*
