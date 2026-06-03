import { publicEnv } from "@/lib/env";

/**
 * Temporary landing page for Phase 1 (scaffold).
 *
 * The real marketing/landing page and the search experience are built in later
 * phases. This placeholder just confirms the app runs and shows the planned
 * build phases.
 */
export default function Home() {
  const phases = [
    { n: 1, label: "Scaffold (Next.js + Tailwind + Supabase client + env)", done: true },
    { n: 2, label: "Database schema + migrations (Supabase)", done: false },
    { n: 3, label: "Data source adapters + ingestion job", done: false },
    { n: 4, label: "Search + results UI, grocery-list mode", done: false },
    { n: 5, label: "Auth, profiles, saved lists", done: false },
    { n: 6, label: "Stripe subscriptions + free-tier gating", done: false },
    { n: 7, label: "Admin panel", done: false },
    { n: 8, label: "Polish, error states, deploy", done: false },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Phase 1 · Scaffold complete
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          grocery-app
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Find the cheapest groceries near you — like GasBuddy, but for grocery
          items. First market: Ontario, Canada ({publicEnv.defaultCurrency}).
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Build progress
        </h2>
        <ol className="flex flex-col gap-2">
          {phases.map((phase) => (
            <li
              key={phase.n}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  phase.done
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
                aria-hidden
              >
                {phase.done ? "✓" : phase.n}
              </span>
              <span
                className={
                  phase.done
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                {phase.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-sm text-zinc-500 dark:text-zinc-500">
        See <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">README.md</code>{" "}
        for setup and the full plan.
      </footer>
    </main>
  );
}
