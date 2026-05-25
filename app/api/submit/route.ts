import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use the live team page after check-in and assignment." }, { status: 410 });
}
