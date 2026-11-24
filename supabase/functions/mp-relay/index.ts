// Mercado Pago relay (Supabase Edge Function, Deno).
//
// Mercado Pago answers requests coming out of Cloudflare Workers with an empty
// HTTP 403, so the app on Cloudflare calls Mercado Pago through here. The
// relay is deliberately narrow:
//   - only POST /checkout/preferences and GET /v1/payments/<digits>;
//   - the caller must prove it is our server by sending the project's secret
//     key in `x-relay-key` (checked against Supabase itself, never stored);
//   - the Mercado Pago token stays with the caller (forwarded per request).
// Deploy: see docs/cloudflare.md ("Pagamentos pelo Supabase").

const MP_API = "https://api.mercadopago.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

/** Keys already confirmed valid in this isolate (hash only). */
const trusted = new Set<string>();

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isProjectSecretKey(key: string): Promise<boolean> {
  if (!key.startsWith("sb_secret_") || !SUPABASE_URL) return false;
  const h = await sha256(key);
  if (trusted.has(h)) return true;
  // Only a secret (service-role) key may list users.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  await res.body?.cancel();
  if (res.ok) trusted.add(h);
  return res.ok;
}

function allowed(method: string, path: string): boolean {
  if (method === "POST" && path === "/checkout/preferences") return true;
  if (method === "GET" && /^\/v1\/payments\/\d{1,20}$/.test(path)) return true;
  return false;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path after the function name: /mp-relay/checkout/preferences → /checkout/preferences
  const path = url.pathname.replace(/^.*?\/mp-relay(?=\/|$)/, "");
  if (!allowed(req.method, path))
    return new Response("not found", { status: 404 });

  const key = req.headers.get("x-relay-key") ?? "";
  if (!(await isProjectSecretKey(key)))
    return new Response("forbidden", { status: 401 });

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer "))
    return new Response("missing token", { status: 400 });

  const headers: Record<string, string> = {
    Authorization: auth,
    Accept: "application/json",
    "User-Agent": "KmPlus/1.0 (+https://kmmais.app.br)",
  };
  const idem = req.headers.get("x-idempotency-key");
  if (idem) headers["X-Idempotency-Key"] = idem;
  let body: string | undefined;
  if (req.method === "POST") {
    headers["Content-Type"] = "application/json";
    body = await req.text();
    if (body.length > 20_000)
      return new Response("too large", { status: 413 });
  }

  const res = await fetch(`${MP_API}${path}`, {
    method: req.method,
    headers,
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
});
