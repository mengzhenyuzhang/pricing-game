import { NextResponse, type NextRequest } from "next/server";
import { getPlayableRun } from "@/lib/game";
import { getCurrentParticipant } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { teamDecisionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const participant = await getCurrentParticipant();
  if (!participant?.teamId) return NextResponse.json({ error: "You are not assigned to a team yet." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for") ?? participant.id;
  if (!checkRateLimit(`team-submit:${ip}`, 20)) return NextResponse.json({ error: "Please wait before submitting again." }, { status: 429 });
  const playable = await getPlayableRun();
  if (!playable || playable.run.classSessionId !== participant.classSessionId) return NextResponse.json({ error: "No round is open." }, { status: 400 });
  if (playable.period?.deadline && playable.period.deadline.getTime() < Date.now()) return NextResponse.json({ error: "The deadline has passed." }, { status: 400 });
  const parsed = teamDecisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check all decision fields." }, { status: 400 });
  const price = parsed.data.price === "" ? undefined : parsed.data.price;
  const lowPrice = parsed.data.lowPrice === "" ? undefined : parsed.data.lowPrice;
  const highPrice = parsed.data.highPrice === "" ? undefined : parsed.data.highPrice;
  const bookingLimit = parsed.data.bookingLimit === "" ? undefined : parsed.data.bookingLimit;
  const valid = playable.run.type === "POSTSCREENING" ? Boolean(lowPrice && highPrice && bookingLimit != null) : Boolean(price);
  if (!valid) return NextResponse.json({ error: "Required decision fields are missing." }, { status: 400 });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.submission.create({
      data: {
        classSessionId: participant.classSessionId,
        gameRunId: playable.run.id,
        periodId: playable.period?.id ?? null,
        teamId: participant.teamId!,
        submitterParticipantId: participant.id,
        submittedAt: now,
        price: price || null,
        lowPrice: lowPrice || null,
        highPrice: highPrice || null,
        bookingLimit: bookingLimit ?? null,
        isValid: true,
        validationMessage: "Accepted"
      }
    });
    const existing = await tx.activeDecision.findFirst({ where: { gameRunId: playable.run.id, periodId: playable.period?.id ?? null, teamId: participant.teamId! } });
    const data = {
      priceUsed: price || null,
      lowPriceUsed: lowPrice || null,
      highPriceUsed: highPrice || null,
      bookingLimitUsed: bookingLimit ?? null,
      submitterParticipantId: participant.id,
      submittedAt: now
    };
    if (existing) await tx.activeDecision.update({ where: { id: existing.id }, data });
    else await tx.activeDecision.create({ data: { gameRunId: playable.run.id, periodId: playable.period?.id ?? null, teamId: participant.teamId!, ...data } });
  });
  return NextResponse.json({ ok: true, submittedAt: now.toISOString(), submitter: participant.displayName });
}
