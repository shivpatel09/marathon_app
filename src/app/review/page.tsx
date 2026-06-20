import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { assembleWeeklyReview } from "@/lib/review";
import { generateCoaching } from "@/lib/coach";
import ReviewView from "@/components/ReviewView";

// the LLM call makes this dynamic + slow-ish; never cache the render
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const review = await assembleWeeklyReview(
    session.user.id,
    searchParams.week ? Number(searchParams.week) : undefined,
  );

  if (!review) {
    return (
      <main className="container">
        <h1>No active plan</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          Set up a plan to get your weekly coaching report.
        </p>
        <Link href="/setup">
          <button className="primary">Set up a plan</button>
        </Link>
      </main>
    );
  }

  const coaching = await generateCoaching(review);

  return (
    <main className="container">
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/"><button>← Dashboard</button></Link>
      </div>
      <ReviewView review={review} coaching={coaching} />
    </main>
  );
}
