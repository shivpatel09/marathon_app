// Turns the deterministic WeeklyReviewInput into a coach's narrative + one
// prioritized adjustment. Claude synthesizes and prioritizes but never
// originates numbers (enforced by the system prompt + JSON-schema output).
// Falls back to a deterministic summary when ANTHROPIC_API_KEY is absent.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { WeeklyReviewInput } from "./review";

const CoachOutput = z.object({
  narrative: z.string(),
  coachingAdjustment: z.string(),
});

export interface Coaching {
  narrative: string;
  coachingAdjustment: string;
  source: "ai" | "fallback";
}

const SYSTEM_PROMPT = `You are an experienced marathon coach writing a runner's Sunday-night weekly review.

You are given a fully-computed JSON summary of the week. Your job:
- Synthesize it into a warm, direct coach's voice (2-4 sentences).
- Lead with judgment, not data. Name the single highest-priority thing to fix or maintain - do not list every issue.
- Then give exactly one concrete coachingAdjustment for the week ahead.

Hard rules:
- Use ONLY the figures supplied in the JSON. Never invent paces, mileage, calories, ACWR values, or counts.
- If a metric is missing or the week is in the future, acknowledge it plainly rather than fabricating.
- No emoji. Plain, encouraging, specific.`;

// JSON schema constrains the response to exactly the two fields we need.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    narrative: { type: "string" },
    coachingAdjustment: { type: "string" },
  },
  required: ["narrative", "coachingAdjustment"],
  additionalProperties: false,
} as const;

function fallback(input: WeeklyReviewInput): Coaching {
  const { mileage, workouts, acwr } = input;
  const acwrNote =
    acwr.value > 0
      ? `Your ACWR is ${acwr.value} (${acwr.inRange ? "in the safe band" : "outside the 0.8-1.3 band - watch your ramp"}).`
      : "";
  const narrative = (
    `Week ${input.weekIndex} of ${input.planName} (${input.mesocycle}). ` +
    `Planned ${mileage.planned} mi, logged ${mileage.actual} mi so far, ` +
    `${workouts.onTarget}/${workouts.total} key sessions on target. ${acwrNote}`
  ).trim();
  const coachingAdjustment = input.weekAhead.keyWorkouts.length
    ? `Next up: ${input.weekAhead.keyWorkouts[0]}. Keep easy days genuinely easy.`
    : "Keep easy days genuinely easy and hit your quality sessions on target.";
  return { narrative, coachingAdjustment, source: "fallback" };
}

export async function generateCoaching(input: WeeklyReviewInput): Promise<Coaching> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(input);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input, null, 2) }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const result = CoachOutput.safeParse(JSON.parse(text));
    if (result.success) return { ...result.data, source: "ai" };
    return fallback(input);
  } catch {
    return fallback(input);
  }
}
