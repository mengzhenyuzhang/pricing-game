import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { performRunControl } from "@/lib/run-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null) as { runId?: string; action?: string; periodId?: string | null } | null;
  const runId = body?.runId;
  const action = body?.action;
  if (!runId || !action) {
    return NextResponse.json({ error: "Missing run control action." }, { status: 400 });
  }

  try {
    const message = await performRunControl(runId, action, body.periodId ?? null);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected run-control error.";
}
