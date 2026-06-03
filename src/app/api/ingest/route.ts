/**
 * POST /api/ingest — trigger the data-ingestion job.
 *
 * This is the endpoint a scheduler hits to refresh prices (e.g. Vercel Cron in
 * production). You can also call it by hand to test ingestion.
 *
 * SECURITY: it does real, privileged work (writes to the catalog via the secret
 * key), so it is protected by a shared secret. The caller must send it either as
 *   - an "Authorization: Bearer <INGEST_SECRET>" header, or
 *   - a "?secret=<INGEST_SECRET>" query param (convenient for a quick browser test).
 * Set INGEST_SECRET in .env.local.
 *
 * Optional: pass "?source=<data_source_id>" to ingest just one source.
 *
 * This route is always dynamic (it reads the request + writes to the DB); it is
 * never cached.
 */

import { NextResponse } from "next/server";

import { runIngestion } from "@/lib/data-sources/ingest";
import { requireServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // --- Auth check ---
  const expected = requireServerEnv("INGEST_SECRET");
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";

  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Run ingestion ---
  try {
    const sourceId = url.searchParams.get("source") ?? undefined;
    const result = await runIngestion({ sourceId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
