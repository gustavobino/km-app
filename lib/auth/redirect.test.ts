import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./redirect";

describe("isProtectedPath", () => {
  it.each([
    ["/registrar", true],
    ["/painel/lucro", true],
    ["/onboarding", true],
    ["/ajustes/conta", true],
    ["/entrar", false],
    ["/auth/callback", false],
    ["/painelx", false],
    ["/", false],
    ["/manifest.webmanifest", false],
  ])("%s → %s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    [null, "/registrar"],
    [undefined, "/registrar"],
    ["", "/registrar"],
    ["/painel", "/painel"],
    ["/painel/lucro?x=1", "/painel/lucro?x=1"],
    ["//evil.com", "/registrar"],
    ["/\\evil.com", "/registrar"],
    ["https://evil.com", "/registrar"],
    ["painel", "/registrar"],
    ["/entrar", "/registrar"],
    ["/auth/callback", "/registrar"],
  ])("%j → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
