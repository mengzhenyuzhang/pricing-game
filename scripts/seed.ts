import { PrismaClient } from "@prisma/client";
import { defaultCapacity, defaultDrawCount, generateTeamAssignments } from "../lib/team-generation";

const prisma = new PrismaClient();
const demoStudents = Number(process.env.DEMO_STUDENTS ?? 66);
const minTeamSize = Number(process.env.MIN_TEAM_SIZE ?? 4);
const maxTeamSize = Number(process.env.MAX_TEAM_SIZE ?? 5);
const targetDrawPercent = Number(process.env.TARGET_DRAW_PERCENT ?? 0.7);
const dynamicPeriods = Number(process.env.DYNAMIC_PERIODS ?? 5);

function valuation(i: number) {
  const base = Math.exp(6.95 + (Math.sin(i * 1.7) + Math.cos(i * 0.31)) * 0.55);
  return Math.max(100, Math.min(10000, Math.round(base / 50) * 50));
}

async function main() {
  await prisma.teamResult.deleteMany();
  await prisma.activeDecision.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.customerDraw.deleteMany();
  await prisma.roundPeriod.deleteMany();
  await prisma.gameRun.deleteMany();
  await prisma.valuation.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.team.deleteMany();
  await prisma.classSession.deleteMany();

  const classSession = await prisma.classSession.create({
    data: {
      name: `Demo Class (${demoStudents} students)`,
      code: "DEMO",
      status: "TEAMS_ASSIGNED",
      expectedStudentCount: demoStudents,
      minTeamSize,
      maxTeamSize,
      attendanceModeStrategy: "PREFER_SAME_ATTENDANCE",
      targetDrawPercent
    }
  });

  const participants = [];
  for (let i = 1; i <= demoStudents; i += 1) {
    participants.push(
      await prisma.participant.create({
        data: {
          classSessionId: classSession.id,
          displayName: `Student ${i}`,
          attendanceMode: i % 5 === 0 ? "ONLINE" : "IN_PERSON",
          valuationAmount: valuation(i)
        }
      })
    );
  }

  const assignment = generateTeamAssignments(participants, minTeamSize, maxTeamSize, { randomSeed: "seed" });
  if (!assignment.ok) throw new Error(assignment.warning);

  for (const team of assignment.teams) {
    const created = await prisma.team.create({
      data: {
        classSessionId: classSession.id,
        teamNumber: team.teamNumber,
        name: team.name,
        plannedSize: team.plannedSize,
        attendanceMix: team.attendanceMix ?? "MIXED",
        inPersonCount: team.inPersonCount ?? 0,
        onlineCount: team.onlineCount ?? 0,
        active: true
      }
    });
    await prisma.participant.updateMany({ where: { id: { in: team.participantIds ?? [] } }, data: { teamId: created.id } });
  }

  const participantCount = participants.length;
  const drawCount = defaultDrawCount(participantCount, targetDrawPercent);
  const runConfigs = [
    { name: "Static Round 1", type: "STATIC", capacity: defaultCapacity("STATIC", participantCount), dynamicPeriods: 5 },
    { name: "Static Round 2", type: "STATIC", capacity: defaultCapacity("STATIC", participantCount), dynamicPeriods: 5 },
    { name: "Dynamic Pricing Game", type: "DYNAMIC", capacity: defaultCapacity("DYNAMIC", participantCount), dynamicPeriods },
    { name: "Postscreening Game", type: "POSTSCREENING", capacity: defaultCapacity("POSTSCREENING", participantCount), dynamicPeriods: 5, segmentCutoff: 3500 }
  ];

  for (const config of runConfigs) {
    const run = await prisma.gameRun.create({ data: { ...config, classSessionId: classSession.id, drawPercent: targetDrawPercent, drawCount } });
    if (run.type === "DYNAMIC") {
      for (let period = 1; period <= dynamicPeriods; period += 1) {
        await prisma.roundPeriod.create({ data: { gameRunId: run.id, periodNumber: period, label: `Period ${period}`, instructions: "Submit your team price for this period." } });
      }
    }
    const selected = participants.slice(0, drawCount);
    const ordered = run.type === "POSTSCREENING" ? [...selected].sort((a, b) => (a.valuationAmount < 3500) === (b.valuationAmount < 3500) ? a.valuationAmount - b.valuationAmount : a.valuationAmount < 3500 ? -1 : 1) : selected;
    for (const [index, participant] of ordered.entries()) {
      await prisma.customerDraw.create({
        data: {
          gameRunId: run.id,
          participantId: participant.id,
          customerLabel: `P${String(index + 1).padStart(3, "0")}`,
          valuationAmountSnapshot: participant.valuationAmount,
          segment: run.type === "POSTSCREENING" ? (participant.valuationAmount < 3500 ? "LOW" : "HIGH") : "UNKNOWN",
          drawOrder: index + 1,
          periodNumber: run.type === "DYNAMIC" ? (index % dynamicPeriods) + 1 : null,
          useInRun: true
        }
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Join URL: /join/${classSession.code}`);
  console.log(`Generated ${assignment.teams.length} teams with sizes: ${assignment.teams.map((team) => team.plannedSize).join(", ")}`);
}

main().finally(async () => prisma.$disconnect());
