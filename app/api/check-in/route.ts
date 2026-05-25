import { NextResponse, type NextRequest } from "next/server";
import { createParticipantSession } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkInSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`checkin:${ip}`, 10)) return NextResponse.json({ error: "Please wait before checking in again." }, { status: 429 });
  const parsed = checkInSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter your name, attendance mode, and a positive valuation." }, { status: 400 });
  const session = await prisma.classSession.findUnique({ where: { code: parsed.data.classSessionCode.toUpperCase() } });
  if (!session) return NextResponse.json({ error: "Class session was not found." }, { status: 404 });
  if (session.status !== "CHECKIN_OPEN") return NextResponse.json({ error: "Check-in is currently closed. Ask the instructor." }, { status: 400 });
  const participant = await prisma.participant.create({
    data: {
      classSessionId: session.id,
      displayName: parsed.data.displayName,
      email: parsed.data.email || null,
      attendanceMode: parsed.data.attendanceMode,
      valuationAmount: parsed.data.valuationAmount
    }
  });
  await createParticipantSession(participant.id);
  return NextResponse.json({ ok: true, redirectTo: "/lobby" });
}
