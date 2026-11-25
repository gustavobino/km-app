import { Skeleton } from "@/components/ui/States";

/** Shown at once when switching tabs, while the next screen arrives. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex w-full max-w-column flex-col gap-gap-card px-5 pt-6"
    >
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-44 rounded-hero" />
      <div className="grid grid-cols-2 gap-gap-card">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-32" />
    </main>
  );
}
