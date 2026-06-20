import { signIn } from "@/lib/auth";

export default function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("strava", { redirectTo: "/" });
      }}
    >
      <button type="submit" className="primary">
        Connect Strava
      </button>
    </form>
  );
}
