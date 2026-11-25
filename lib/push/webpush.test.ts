import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
// Independent implementation of RFC 8188 (used by the web-push library).
import ece from "http_ece";
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  sendPush,
  vapidJwt,
  type VapidKeys,
} from "./webpush";

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh,
    auth,
    sub: {
      endpoint: "https://push.example.com/send/abc",
      p256dh: b64urlEncode(new Uint8Array(ecdh.getPublicKey())),
      auth: b64urlEncode(new Uint8Array(auth)),
    },
  };
}

async function vapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  return {
    publicKey: b64urlEncode(raw),
    privateKey: jwk.d!,
    subject: "https://kmmais.app.br",
  };
}

describe("base64url", () => {
  it("round-trips without padding", () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2]);
    const text = b64urlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(b64urlDecode(text)).toEqual(bytes);
  });
});

describe("encryptPayload (RFC 8291)", () => {
  it("is decrypted by an independent aes128gcm implementation", async () => {
    const { ecdh, auth, sub } = browserKeys();
    const message = JSON.stringify({
      title: "Fechou o dia?",
      body: "Leva 20 segundos.",
    });
    const body = await encryptPayload(new TextEncoder().encode(message), sub);
    const plain = ece.decrypt(Buffer.from(body), {
      version: "aes128gcm",
      privateKey: ecdh,
      authSecret: auth,
    });
    expect(plain.toString("utf8")).toBe(message);
  });

  it("uses the given salt and writes the RFC 8188 header", async () => {
    const { sub } = browserKeys();
    const salt = new Uint8Array(16).fill(7);
    const body = await encryptPayload(new Uint8Array([1, 2, 3]), sub, { salt });
    expect(body.slice(0, 16)).toEqual(salt);
    expect([...body.slice(16, 20)]).toEqual([0, 0, 16, 0]);
    expect(body[20]).toBe(65);
    expect(body[21]).toBe(4); // uncompressed point
    // 3 bytes + delimiter + 16-byte tag.
    expect(body.length).toBe(16 + 4 + 1 + 65 + 3 + 1 + 16);
  });
});

describe("vapidJwt (RFC 8292)", () => {
  it("signs a verifiable ES256 token for the push service origin", async () => {
    const vapid = await vapidKeys();
    const jwt = await vapidJwt("https://push.example.com", vapid, 1_000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h!)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(p!)))).toEqual({
      aud: "https://push.example.com",
      exp: 1_000 + 43_200,
      sub: "https://kmmais.app.br",
    });
    const pub = await crypto.subtle.importKey(
      "raw",
      b64urlDecode(vapid.publicKey) as unknown as BufferSource,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      b64urlDecode(s!) as unknown as BufferSource,
      new TextEncoder().encode(`${h}.${p}`) as unknown as BufferSource,
    );
    expect(ok).toBe(true);
  });
});

describe("sendPush", () => {
  it("posts the encrypted body with VAPID headers and flags expired subscriptions", async () => {
    const vapid = await vapidKeys();
    const { sub } = browserKeys();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    expect(
      await sendPush(sub, { t: 1 }, vapid, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        ttlSeconds: 60,
      }),
    ).toEqual({ status: 201, gone: false });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(sub.endpoint);
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("60");
    expect(headers.Authorization).toMatch(
      /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/,
    );

    const gone = vi.fn(async () => new Response("bye", { status: 410 }));
    expect(
      await sendPush(sub, {}, vapid, {
        fetchImpl: gone as unknown as typeof fetch,
      }),
    ).toEqual({ status: 410, gone: true });
  });
});
