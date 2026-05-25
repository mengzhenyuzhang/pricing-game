import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runStateSignature } from "@/lib/run-state";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  return NextResponse.json({ signature: await runStateSignature(params.id) });
}
