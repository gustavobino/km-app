import { describe, expect, it } from "vitest";
import { emailSchema, otpCodeSchema } from "@/lib/schemas/auth";
import { authErrorMessage } from "./messages";

describe("authErrorMessage", () => {
  it.each([
    [{ code: "over_email_send_rate_limit" }, /Muitos pedidos/],
    [{ status: 429 }, /Muitos pedidos/],
    [{ code: "otp_expired" }, /expirado/],
    [{ message: "Token has expired or is invalid" }, /expirado/],
    [{ code: "email_address_invalid" }, /Confira o e-mail/],
    [{ code: "signup_disabled" }, /fechados/],
    [{ message: "Failed to fetch" }, /Sem conexão/],
    [{ code: "something_else" }, /Tente de novo/],
  ])("%j", (error, expected) => {
    expect(authErrorMessage(error)).toMatch(expected);
  });
});

describe("auth schemas", () => {
  it("normalizes e-mail", () => {
    expect(emailSchema.parse("  Motorista@Email.COM ")).toBe(
      "motorista@email.com",
    );
    expect(emailSchema.safeParse("sem-arroba").success).toBe(false);
  });
  it("accepts only 6-digit codes", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true);
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
    expect(otpCodeSchema.safeParse("12345a").success).toBe(false);
  });
});
