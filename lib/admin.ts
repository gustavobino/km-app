/** Admins are the e-mails listed in ADMIN_EMAILS (comma-separated, case-insensitive). */
export function isAdminEmail(
  email: string | null | undefined,
  list: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  if (!email || !list) return false;
  const wanted = email.trim().toLowerCase();
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}
