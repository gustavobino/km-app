import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  it.each([
    ["dono@email.com", "dono@email.com", true],
    [" Dono@Email.com ", "outro@x.com, DONO@email.com", true],
    ["a@x.com", "b@x.com", false],
    ["a@x.com", "", false],
    ["a@x.com", undefined, false],
    [null, "a@x.com", false],
    ["", ",,", false],
  ])("%j in %j → %s", (email, list, expected) => {
    expect(isAdminEmail(email, list)).toBe(expected);
  });
});
