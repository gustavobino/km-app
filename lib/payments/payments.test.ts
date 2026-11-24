import { describe, expect, it, vi } from "vitest";
import { PRODUCT_TITLE, priceCents } from "./config";
import { MercadoPagoProvider } from "./mercadopago";
import { processPayment, type PaymentStore } from "./process";
import {
  mercadoPagoManifest,
  parseSignatureHeader,
  signMercadoPago,
  verifyMercadoPagoSignature,
} from "./signature";
import type { PaymentProvider, ProviderPayment } from "./types";

const USER = "00000000-0000-4000-8000-00000000000a";

describe("priceCents", () => {
  it("reads PRICE_BRL_CENTS", () => {
    expect(priceCents({ PRICE_BRL_CENTS: "1790" })).toBe(1790);
    expect(PRODUCT_TITLE).toMatch(/Km\+/);
  });
  it.each([undefined, "", "17.90", "-1", "0", "abc"])("rejects %j", (v) => {
    expect(() => priceCents({ PRICE_BRL_CENTS: v })).toThrow(/PRICE_BRL_CENTS/);
  });
});

describe("webhook signature", () => {
  const secret = "test-secret";
  const ts = "1764000000";
  const manifest = mercadoPagoManifest("123456", "req-1", ts);

  it("builds the manifest like Mercado Pago's docs", () => {
    expect(manifest).toBe("id:123456;request-id:req-1;ts:1764000000;");
    expect(mercadoPagoManifest("ABC123", null, ts)).toBe(
      "id:abc123;ts:1764000000;",
    );
    expect(mercadoPagoManifest("a-b", null, ts)).toBe("id:a-b;ts:1764000000;");
    expect(mercadoPagoManifest(null, null, ts)).toBe("ts:1764000000;");
  });

  it("parses the header", () => {
    expect(parseSignatureHeader("ts=1,v1=abc")).toEqual({ ts: "1", v1: "abc" });
    expect(parseSignatureHeader(" ts=1 , v1=abc ")).toEqual({
      ts: "1",
      v1: "abc",
    });
    expect(parseSignatureHeader("v1=abc")).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });

  it("accepts a valid signature and rejects tampering", () => {
    const v1 = signMercadoPago(secret, manifest);
    const ok = {
      secret,
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId: "req-1",
      dataId: "123456",
    };
    expect(verifyMercadoPagoSignature(ok)).toBe(true);
    expect(verifyMercadoPagoSignature({ ...ok, dataId: "999" })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, requestId: "other" })).toBe(
      false,
    );
    expect(verifyMercadoPagoSignature({ ...ok, secret: "wrong" })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, secret: "" })).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        ...ok,
        signatureHeader: `ts=${ts},v1=abcd`,
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({ ...ok, signatureHeader: `ts=${ts},v1=` }),
    ).toBe(false);
    expect(verifyMercadoPagoSignature({ ...ok, signatureHeader: null })).toBe(
      false,
    );
  });

  it("rejects old requests when a max age is given (seconds or ms timestamps)", () => {
    const v1 = signMercadoPago(secret, manifest);
    const base = {
      secret,
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId: "req-1",
      dataId: "123456",
    };
    expect(
      verifyMercadoPagoSignature({
        ...base,
        now: 1764000000_000 + 60_000,
        maxAgeMs: 300_000,
      }),
    ).toBe(true);
    expect(
      verifyMercadoPagoSignature({
        ...base,
        now: 1764000000_000 + 600_000,
        maxAgeMs: 300_000,
      }),
    ).toBe(false);
    const tsMs = "1764000000000";
    const v1ms = signMercadoPago(
      secret,
      mercadoPagoManifest("123456", "req-1", tsMs),
    );
    expect(
      verifyMercadoPagoSignature({
        ...base,
        signatureHeader: `ts=${tsMs},v1=${v1ms}`,
        now: 1764000000_000,
        maxAgeMs: 1000,
      }),
    ).toBe(true);
    expect(
      verifyMercadoPagoSignature({
        ...base,
        signatureHeader: `ts=abc,v1=${v1}`,
        maxAgeMs: 1000,
      }),
    ).toBe(false);
  });
});

describe("MercadoPagoProvider", () => {
  const request = {
    userId: USER,
    email: "m@email.com",
    amountCents: 1790,
    title: "Km+",
    successUrl: "https://app/comprar?status=sucesso",
    pendingUrl: "https://app/comprar?status=pendente",
    failureUrl: "https://app/comprar?status=falha",
    notificationUrl: "https://app/api/webhooks/mercadopago",
  };

  it("creates a preference with the user as external_reference", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "pref-1", init_point: "https://mp/checkout" }),
          { status: 201 },
        ),
    );
    const mp = new MercadoPagoProvider(
      "TOKEN",
      fetchMock as unknown as typeof fetch,
    );
    expect(await mp.createCheckout(request)).toEqual({
      url: "https://mp/checkout",
      reference: "pref-1",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer TOKEN",
    );
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      external_reference: USER,
      items: [{ unit_price: 17.9, currency_id: "BRL", quantity: 1 }],
      auto_return: "approved",
      notification_url: request.notificationUrl,
    });
    expect(body.payer).toBeUndefined();
  });

  it("falls back to the sandbox url and reports failures", async () => {
    const sandbox = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response(
          JSON.stringify({ id: "p", sandbox_init_point: "https://sb" }),
        )) as unknown as typeof fetch,
    );
    expect(
      (
        await sandbox.createCheckout({
          ...request,
          email: null,
          notificationUrl: null,
        })
      ).url,
    ).toBe("https://sb");
    const none = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response(JSON.stringify({ id: "p" }))) as unknown as typeof fetch,
    );
    await expect(none.createCheckout(request)).rejects.toThrow(/init_point/);
    const bad = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response("no", { status: 401 })) as unknown as typeof fetch,
    );
    await expect(bad.createCheckout(request)).rejects.toThrow(/HTTP 401/);
  });

  it("reads a payment", async () => {
    const mp = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response(
          JSON.stringify({
            id: 42,
            status: "approved",
            transaction_amount: 17.9,
            currency_id: "BRL",
            external_reference: USER,
            date_approved: "2026-11-24T10:00:00Z",
          }),
        )) as unknown as typeof fetch,
    );
    expect(await mp.getPayment("42")).toMatchObject({
      id: "42",
      status: "approved",
      amountCents: 1790,
      currency: "BRL",
      externalReference: USER,
    });
  });

  it("handles unknown and failing lookups", async () => {
    const notFound = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response("", { status: 404 })) as unknown as typeof fetch,
    );
    expect(await notFound.getPayment("42")).toBeNull();
    expect(await notFound.getPayment("../x")).toBeNull();
    const down = new MercadoPagoProvider(
      "T",
      (async () =>
        new Response("", { status: 500 })) as unknown as typeof fetch,
    );
    await expect(down.getPayment("42")).rejects.toThrow(/HTTP 500/);
  });
});

describe("processPayment", () => {
  function setup(payment: Partial<ProviderPayment> | null) {
    const provider: PaymentProvider = {
      name: "mercadopago",
      createCheckout: async () => ({ url: "", reference: "" }),
      getPayment: async () =>
        payment && {
          id: "42",
          status: "approved",
          amountCents: 1790,
          currency: "BRL",
          externalReference: USER,
          paidAt: null,
          raw: {},
          ...payment,
        },
    };
    const payments = new Map<
      string,
      { status: string; userId: string | null }
    >();
    const active = new Map<string, string>(); // userId → payment row
    const store: PaymentStore = {
      async upsertPayment(p) {
        payments.set(p.providerPaymentId, {
          status: p.status,
          userId: p.userId,
        });
        return `row-${p.providerPaymentId}`;
      },
      async grantPremium(userId, rowId) {
        if (active.has(userId)) return "already";
        active.set(userId, rowId);
        return "granted";
      },
      async revokeForPayment(rowId) {
        for (const [u, r] of active) if (r === rowId) return active.delete(u);
        return false;
      },
    };
    return { deps: { provider, store, priceCents: 1790 }, payments, active };
  }

  it("grants premium once for an approved payment (idempotent)", async () => {
    const { deps, active, payments } = setup({});
    expect(await processPayment("42", deps)).toBe("granted");
    expect(await processPayment("42", deps)).toBe("already_granted");
    expect(active.get(USER)).toBe("row-42");
    expect(payments.get("42")).toEqual({ status: "approved", userId: USER });
  });

  it("records pending payments without granting", async () => {
    const { deps, active } = setup({ status: "pending" });
    expect(await processPayment("42", deps)).toBe("recorded");
    expect(active.size).toBe(0);
  });

  it("revokes on refund or chargeback", async () => {
    const s = setup({});
    await processPayment("42", s.deps);
    const refunded = setup({ status: "refunded" });
    refunded.active.set(USER, "row-42");
    expect(await processPayment("42", refunded.deps)).toBe("revoked");
    expect(refunded.active.size).toBe(0);
    expect(
      await processPayment("42", setup({ status: "charged_back" }).deps),
    ).toBe("recorded");
  });

  it("refuses wrong amounts, currencies and unknown users", async () => {
    expect(await processPayment("42", setup({ amountCents: 100 }).deps)).toBe(
      "amount_mismatch",
    );
    expect(await processPayment("42", setup({ currency: "USD" }).deps)).toBe(
      "amount_mismatch",
    );
    expect(
      await processPayment(
        "42",
        setup({ externalReference: "not-a-uuid" }).deps,
      ),
    ).toBe("unknown_user");
    expect(
      await processPayment("42", setup({ externalReference: null }).deps),
    ).toBe("unknown_user");
    expect(await processPayment("42", setup(null).deps)).toBe("not_found");
  });
});
