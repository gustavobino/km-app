import { redirect } from "next/navigation";
import { can } from "@/lib/entitlements";
import { getAccessUser } from "@/lib/entitlements-server";

/** Every screen of the app proper requires the purchase (single check point: lib/entitlements). */
export default async function PaidLayout({ children }: LayoutProps<"/">) {
  const user = await getAccessUser();
  if (!can(user, "app")) redirect("/comprar");
  return children;
}
