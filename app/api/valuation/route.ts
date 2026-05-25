import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { valuationSchema } from "@/lib/validation";
import { getCurrentClassSession } from "@/lib/game";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`valuation:${ip}`, 12)) {
    return NextResponse.json({ error: "Too many submissions. Please pause briefly." }, { status: 429 });
  }
  const parsed = valuationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid valuation amount." }, { status: 400 });
  const classSession = await getCurrentClassSession();
  const count = await prisma.valuation.count({ where: { classSessionId: classSession.id } });
  await prisma.valuation.create({
    data: {
      classSessionId: classSession.id,
      customerId: `C${String(count + 1).padStart(3, "0")}`,
      amount: parsed.data.amount,
      studentAlias: parsed.data.studentAlias || null
    }
  });
  return NextResponse.json({ ok: true });
}
