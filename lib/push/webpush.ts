/**
 * Web Push sender with WebCrypto only (runs in Deno, Workers and Node 22):
 * payload encryption RFC 8291 (aes128gcm, RFC 8188) and VAPID RFC 8292.
 * Used by the Supabase Edge Function supabase/functions/send-reminders
 * (deployed together with this file). No dependencies.
 */

export type PushSubscriptionKeys = {
  endpoint: string;
  /** Browser public key, base64url (uncompressed P-256, 65 bytes). */
  p256dh: string;
  /** Browser auth secret, base64url (16 bytes). */
  auth: string;
};

export type VapidKeys = {
  /** base64url uncompressed public key (65 bytes). */
  publicKey: string;
  /** base64url private scalar "d" (32 bytes). */
  privateKey: string;
  /** "mailto:..." or "https://..." */
  subject: string;
};

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

const buf = (u: Uint8Array) => u as unknown as BufferSource;

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Encrypts one record (payload ≤ ~3.9 kB). `salt` and the application-server
 * key pair can be injected for tests; normally they are random per message.
 */
export async function encryptPayload(
  payload: Uint8Array,
  sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const server =
    opts.serverKeys ??
    ((await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair);
  const asPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", server.publicKey),
  );
  const uaKey = await crypto.subtle.importKey(
    "raw",
    buf(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaKey },
      server.privateKey,
      256,
    ),
  );
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(
    salt,
    ikm,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );
  const aes = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, [
    "encrypt",
  ]);
  // Single record: payload + 0x02 delimiter, no padding.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buf(nonce) },
      aes,
      buf(concat(payload, new Uint8Array([2]))),
    ),
  );
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(
    salt,
    rs,
    new Uint8Array([asPublic.length]),
    asPublic,
    ciphertext,
  );
}

/** VAPID JWT (ES256) for the push service origin. */
export async function vapidJwt(
  audience: string,
  vapid: VapidKeys,
  nowSeconds: number,
): Promise<string> {
  const pub = b64urlDecode(vapid.publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33, 65)),
      d: vapid.privateKey,
      ext: false,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const part = (o: object) => b64urlEncode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: audience,
    exp: nowSeconds + 12 * 3600,
    sub: vapid.subject,
  })}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      buf(enc.encode(unsigned)),
    ),
  );
  return `${unsigned}.${b64urlEncode(sig)}`;
}

export type PushResult = { status: number; gone: boolean };

/** Sends one encrypted notification. `gone` = subscription expired (delete it). */
export async function sendPush(
  sub: PushSubscriptionKeys,
  message: unknown,
  vapid: VapidKeys,
  opts: { ttlSeconds?: number; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const audience = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(
    audience,
    vapid,
    Math.floor((opts.now ?? Date.now()) / 1000),
  );
  const res = await (opts.fetchImpl ?? fetch)(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(opts.ttlSeconds ?? 4 * 3600),
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body: buf(body),
  });
  await res.body?.cancel();
  return { status: res.status, gone: res.status === 404 || res.status === 410 };
}
