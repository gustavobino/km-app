import { describe, expect, it, vi } from "vitest";
import { mercadoPagoManifest, signMercadoPago } from "./signature";
import { handleMercadoPagoWebhook } from "./webhook";

const SECRET = "whsec";
function signed(dataId: string, requestId = "req-1", ts = "1764000000") {
  const v1 = signMercadoPago(
    SECRET,
    mercadoPagoManifest(dataId, requestId, ts),
  );
  return new Headers({
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": requestId,
  });
}

describe("handleMercadoPagoWebhook", () => {
  it("processes a signed payment notification", async () => {
    const process = vi.fn(async () => "granted" as const);
    const r = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago?data.id=123&type=payment",
        headers: signed("123"),
        body: { type: "payment", data: { id: "123" } },
      },
      { secret: SECRET, process },
    );
    expect(r).toEqual({ status: 200, body: { outcome: "granted" } });
    expect(process).toHaveBeenCalledWith("123");
  });

  it("reads the id and type from the body when the query lacks them", async () => {
    const process = vi.fn(async () => "recorded" as const);
    const r = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago",
        headers: signed("77"),
        body: { type: "payment", data: { id: 77 } },
      },
      { secret: SECRET, process },
    );
    expect(r.status).toBe(200);
    expect(process).toHaveBeenCalledWith("77");
  });

  it("rejects bad signatures and a missing secret", async () => {
    const process = vi.fn();
    const url = "https://app/api/webhooks/mercadopago?data.id=123&type=payment";
    expect(
      (
        await handleMercadoPagoWebhook(
          { url, headers: signed("999"), body: null },
          { secret: SECRET, process },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleMercadoPagoWebhook(
          { url, headers: new Headers(), body: null },
          { secret: SECRET, process },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleMercadoPagoWebhook(
          { url, headers: signed("123"), body: null },
          { secret: undefined, process },
        )
      ).status,
    ).toBe(500);
    expect(process).not.toHaveBeenCalled();
  });

  it("ignores other event types", async () => {
    const process = vi.fn();
    const r = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago?data.id=5&type=merchant_order",
        headers: signed("5"),
        body: null,
      },
      { secret: SECRET, process },
    );
    expect(r).toEqual({ status: 200, body: { ignored: true } });
    const topic = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago?topic=payment",
        headers: signed(""),
        body: null,
      },
      { secret: SECRET, process },
    );
    expect(topic.body).toEqual({ ignored: true });
    expect(process).not.toHaveBeenCalled();
  });

  it("answers 500 so Mercado Pago retries when processing fails", async () => {
    const r = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago?data.id=1&type=payment",
        headers: signed("1"),
        body: null,
      },
      {
        secret: SECRET,
        process: async () => Promise.reject(new Error("db down")),
      },
    );
    expect(r.status).toBe(500);
    const nonError = await handleMercadoPagoWebhook(
      {
        url: "https://app/api/webhooks/mercadopago?data.id=1&type=payment",
        headers: signed("1"),
        body: null,
      },
      { secret: SECRET, process: async () => Promise.reject("x") },
    );
    expect(nonError.status).toBe(500);
  });
});
