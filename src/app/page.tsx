import Link from "next/link";
import { auth } from "@/lib/auth";
import { getActivePlanInstance } from "@/lib/plan";
import SignIn from "@/components/SignIn";
import SignOut from "@/components/SignOut";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="container">
        <h1>Marathon trainer</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          Connect your Strava account to pull in your runs and start tracking
          your training.
        </p>
        <SignIn />
      </main>
    );
  }

  const plan = await getActivePlanInstance(session.user.id);

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: "1rem" }}>
        <div>
          <h1>Marathon trainer</h1>
          <p className="muted" style={{ margin: 0 }}>
            Signed in as {session.user.name ?? "athlete"}
          </p>
        </div>
        <SignOut />
      </div>

      {plan ? (
        <>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            On <strong>{plan.template.name}</strong> · goal{" "}
            {Math.floor(plan.goalTimeSec / 3600)}:
            {String(Math.floor((plan.goalTimeSec % 3600) / 60)).padStart(2, "0")}:
            {String(plan.goalTimeSec % 60).padStart(2, "0")}
          </p>
          <p className="muted" style={{ fontSize: 14 }}>
            Use the tabs below to jump between your week, runs, strength, nutrition, and weekly review.
          </p>
          <nav className="nav">
            <Link href="/week"><button className="primary">This week</button></Link>
            <Link href="/setup"><button>Change plan</button></Link>
          </nav>
        </>
      ) : (
        <nav className="nav">
          <Link href="/setup"><button className="primary">Set up a plan</button></Link>
        </nav>
      )}
    </main>
  );
}
