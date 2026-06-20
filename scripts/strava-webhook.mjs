// Manage the Strava push-subscription (webhook) for auto-sync.
//
// Strava allows ONE subscription per application, and the callback URL must be
// publicly reachable over HTTPS (a deployed app, or a tunnel like ngrok) — it
// will GET the callback to validate before activating.
//
// Usage (reads creds from .env):
//   npm run strava:webhook list
//   npm run strava:webhook create https://your-app.com/api/strava/webhook
//   npm run strava:webhook delete <subscription_id>

const API = "https://www.strava.com/api/v3/push_subscriptions";
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

const [cmd, arg] = process.argv.slice(2);

function requireCreds() {
  if (!clientId || !clientSecret) {
    console.error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .env");
    process.exit(1);
  }
}

async function list() {
  requireCreds();
  const url = `${API}?client_id=${clientId}&client_secret=${clientSecret}`;
  const res = await fetch(url);
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

async function create(callbackUrl) {
  requireCreds();
  if (!callbackUrl) {
    console.error("Usage: strava:webhook create <public_callback_url>");
    process.exit(1);
  }
  if (!verifyToken) {
    console.error("Set STRAVA_WEBHOOK_VERIFY_TOKEN in .env first.");
    process.exit(1);
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });
  const res = await fetch(API, { method: "POST", body });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

async function del(id) {
  requireCreds();
  if (!id) {
    console.error("Usage: strava:webhook delete <subscription_id>");
    process.exit(1);
  }
  const url = `${API}/${id}?client_id=${clientId}&client_secret=${clientSecret}`;
  const res = await fetch(url, { method: "DELETE" });
  console.log(res.status, res.status === 204 ? "deleted" : await res.text());
}

const run = { list, create: () => create(arg), delete: () => del(arg) }[cmd];
if (!run) {
  console.error("Commands: list | create <url> | delete <id>");
  process.exit(1);
}
run();
