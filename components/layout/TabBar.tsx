"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";
import {
  ChartIcon,
  PlusIcon,
  SlidersIcon,
  SparkIcon,
} from "@/components/ui/icons";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
};

export const TABS: readonly Tab[] = [
  { href: "/registrar", label: "Registrar", Icon: PlusIcon },
  { href: "/painel", label: "Painel", Icon: ChartIcon },
  { href: "/simulador", label: "Simulador", Icon: SlidersIcon },
  { href: "/insights", label: "Insights", Icon: SparkIcon },
];

/** Fixed 76 px tab bar. Active tab: 56×30 ink pill with white icon + ink label. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-column border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-tabbar grid-cols-4 px-2 pt-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  // Offline, client-side navigation cannot fetch the next page;
                  // a full load lets the service worker serve the cached tab.
                  if (!navigator.onLine) {
                    e.preventDefault();
                    window.location.assign(href);
                  }
                }}
                className={cn(
                  "flex min-h-touch flex-col items-center gap-1 rounded-xl text-xs",
                  active
                    ? "font-extrabold text-ink"
                    : "font-semibold text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7.5 w-14 items-center justify-center rounded-pill",
                    active && "bg-ink text-white",
                  )}
                >
                  <Icon size={20} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
