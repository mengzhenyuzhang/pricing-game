import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { performRunControl } from "@/lib/run-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireAdmin();
  const parsed = await parseRunControlRequest(request);
  const { runId, action, periodId, wantsHtml } = parsed;
  if (!runId || !action) {
    if (wantsHtml) return redirectToRun(request, runId ?? "", "Missing run control action.");
    return NextResponse.json({ error: "Missing run control action." }, { status: 400 });
  }

  try {
    const message = await performRunControl(runId, action, periodId ?? null);
    if (wantsHtml) return redirectToRun(request, runId, message);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const message = errorMessage(error);
    if (wantsHtml) return redirectToRun(request, runId, message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

async function parseRunControlRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { runId?: string; action?: string; periodId?: string | null } | null;
    return {
      runId: body?.runId ?? "",
      action: body?.action ?? "",
      periodId: body?.periodId ?? null,
      wantsHtml: false
    };
  }
  const formData = await request.formData();
  return {
    runId: String(formData.get("runId") ?? ""),
    action: String(formData.get("action") ?? ""),
    periodId: formData.get("periodId") ? String(formData.get("periodId")) : null,
    wantsHtml: true
  };
}

function redirectToRun(request: Request, runId: string, message: string) {
  const fallback = runId ? `/admin/run/${runId}` : "/admin";
  const url = new URL(fallback, request.url);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected run-control error.";
}
