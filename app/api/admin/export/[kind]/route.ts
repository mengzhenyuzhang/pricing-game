import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { csv } from "@/lib/game";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: { kind: string } }) {
  await requireAdmin();
  const runId = request.nextUrl.searchParams.get("runId") ?? undefined;
  const classSessionId = request.nextUrl.searchParams.get("classSessionId") ?? undefined;
  let body = "";
  if (params.kind === "teams") {
    const rows = await prisma.team.findMany({ where: classSessionId ? { classSessionId } : {}, include: { classSession: true }, orderBy: { teamNumber: "asc" } });
    body = csv(rows.map((team) => ({ classSession: team.classSession.name, teamNumber: team.teamNumber, name: team.name, plannedSize: team.plannedSize, attendanceMix: team.attendanceMix, inPersonCount: team.inPersonCount, onlineCount: team.onlineCount, active: team.active })));
  } else if (params.kind === "participants") {
    const rows = await prisma.participant.findMany({ where: classSessionId ? { classSessionId } : {}, include: { classSession: true, team: true }, orderBy: { checkedInAt: "asc" } });
    body = csv(rows.map((p) => ({ classSession: p.classSession.name, displayName: p.displayName, email: p.email, attendanceMode: p.attendanceMode, valuationAmount: p.valuationAmount, checkedInAt: p.checkedInAt.toISOString(), team: p.team?.name })));
  } else if (params.kind === "valuations") {
    const rows = await prisma.valuation.findMany({ where: classSessionId ? { classSessionId } : {}, include: { classSession: true }, orderBy: { customerId: "asc" } });
    body = csv(rows.map((v) => ({ classSession: v.classSession.name, customerId: v.customerId, amount: v.amount, studentAlias: v.studentAlias, segment: v.segment, createdAt: v.createdAt.toISOString() })));
  } else if (params.kind === "submissions") {
    const rows = await prisma.submission.findMany({ where: runId ? { gameRunId: runId } : {}, include: { team: true, gameRun: true, period: true } });
    body = csv(rows.map((s) => ({ run: s.gameRun.name, period: s.period?.label, team: s.team.name, submittedAt: s.submittedAt.toISOString(), price: s.price, lowPrice: s.lowPrice, highPrice: s.highPrice, bookingLimit: s.bookingLimit, isValid: s.isValid })));
  } else if (params.kind === "decisions") {
    const rows = await prisma.activeDecision.findMany({ where: runId ? { gameRunId: runId } : {}, include: { team: true, gameRun: true, period: true } });
    body = csv(rows.map((d) => ({ run: d.gameRun.name, period: d.period?.label, team: d.team.name, price: d.priceUsed, lowPrice: d.lowPriceUsed, highPrice: d.highPriceUsed, bookingLimit: d.bookingLimitUsed, submittedAt: d.submittedAt.toISOString() })));
  } else if (params.kind === "results") {
    const rows = await prisma.teamResult.findMany({ where: runId ? { gameRunId: runId } : {}, include: { team: true, gameRun: true }, orderBy: { rank: "asc" } });
    body = csv(rows.map((r) => ({ run: r.gameRun.name, rank: r.rank, team: r.team.name, sales: r.sales, lowSales: r.lowSales, highSales: r.highSales, revenue: r.revenue, capacityUsed: r.capacityUsed })));
  } else if (params.kind === "events") {
    const rows = await prisma.teamResult.findMany({ where: runId ? { gameRunId: runId } : {}, include: { team: true, gameRun: true } });
    body = csv(rows.flatMap((r) => (JSON.parse(r.eventsJson) as Array<Record<string, unknown>>).map((event) => ({ run: r.gameRun.name, team: r.team.name, ...event }))));
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${params.kind}.csv"`
    }
  });
}
