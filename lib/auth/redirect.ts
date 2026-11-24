/** Routes that need a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/registrar",
  "/painel",
  "/simulador",
  "/insights",
  "/onboarding",
  "/ajustes",
  "/comprar",
  "/admin",
] as const;

export const LOGIN_PATH = "/entrar";
export const HOME_PATH = "/registrar";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Only allow same-site relative paths as post-login destinations, to avoid
 * open redirects ("//evil.com", "https://…", "/\\evil.com").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return HOME_PATH;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return HOME_PATH;
  }
  if (next.startsWith(LOGIN_PATH) || next.startsWith("/auth/"))
    return HOME_PATH;
  return next;
}
