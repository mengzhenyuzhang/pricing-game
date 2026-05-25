"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, requireAdmin } from "@/lib/auth";
import { addDayToRun, computeSegmentCutoffForClassSession, ensureMinimumDynamicPeriods, getCurrentClassSession, openDynamicPricingDay, runSimulation } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEGMENT_CUTOFF_PERCENT } from "@/lib/segments";
import { defaultCapacity, defaultDrawCount, generateAttendanceAwareTeamAssignments } from "@/lib/team-generation";
import { classSessionSchema, loginSchema, manualValuationSchema, publishAssignmentSchema, runSchema, teamManualSchema } from "@/lib/validation";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.password !== (process.env.ADMIN_PASSWORD ?? "change-me")) redirect("/admin/login?error=1");
  await createAdminSession();
  redirect("/admin");
}

export async function createClassSession(formData: FormData) {
  await requireAdmin();
  const parsed = classSessionSchema.parse(Object.fromEntries(formData));
  await prisma.classSession.create({
    data: {
      name: parsed.name,
      code: parsed.code || shortCode(),
      expectedStudentCount: parsed.expectedStudentCount === "" ? null : parsed.expectedStudentCount,
      minTeamSize: parsed.minTeamSize,
      maxTeamSize: parsed.maxTeamSize,
      attendanceModeStrategy: parsed.attendanceModeStrategy,
      targetDrawPercent: parsed.targetDrawPercent
    }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/class-sessions");
}

export async function openCheckIn(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("classSessionId"));
  await prisma.classSession.update({ where: { id }, data: { status: "CHECKIN_OPEN" } });
  revalidatePath("/admin");
  revalidatePath(`/admin/class-sessions/${id}`);
}

export async function closeCheckIn(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("classSessionId"));
  await prisma.classSession.update({ where: { id }, data: { status: "CHECKIN_CLOSED" } });
  revalidatePath("/admin");
  revalidatePath(`/admin/class-sessions/${id}`);
}

export async function publishTeamAssignment(formData: FormData) {
  await requireAdmin();
  const parsed = publishAssignmentSchema.parse({
    ...Object.fromEntries(formData),
    allowOverride: formData.get("allowOverride") === "on"
  });
  const participants = await prisma.participant.findMany({ where: { classSessionId: parsed.classSessionId }, orderBy: { checkedInAt: "asc" } });
  const assignment = generateAttendanceAwareTeamAssignments({
    participants,
    minTeamSize: parsed.minTeamSize,
    maxTeamSize: parsed.maxTeamSize,
    strategy: parsed.attendanceModeStrategy,
    randomSeed: parsed.randomSeed || undefined,
    allowOverride: parsed.allowOverride
  });
  if (!assignment.ok) redirect(`/admin/class-sessions/${parsed.classSessionId}/teams?warning=${encodeURIComponent(assignment.warning ?? "Unable to assign teams.")}`);

  const existingSubmissions = await prisma.submission.count({ where: { classSessionId: parsed.classSessionId } });
  if (existingSubmissions > 0 && !parsed.allowOverride) {
    redirect(`/admin/class-sessions/${parsed.classSessionId}/teams?warning=${encodeURIComponent("Teams already have submissions. Check override to reassign.")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.participant.updateMany({ where: { classSessionId: parsed.classSessionId }, data: { teamId: null } });
    await tx.team.deleteMany({ where: { classSessionId: parsed.classSessionId } });
    for (const team of assignment.teams) {
      const created = await tx.team.create({
        data: {
          classSessionId: parsed.classSessionId,
          teamNumber: team.teamNumber,
          name: team.name,
          plannedSize: team.plannedSize,
          attendanceMix: team.attendanceMix ?? "MIXED",
          inPersonCount: team.inPersonCount ?? 0,
          onlineCount: team.onlineCount ?? 0
        }
      });
      await tx.participant.updateMany({ where: { id: { in: team.participantIds ?? [] } }, data: { teamId: created.id } });
    }
    await tx.classSession.update({
      where: { id: parsed.classSessionId },
      data: { status: "TEAMS_ASSIGNED", minTeamSize: parsed.minTeamSize, maxTeamSize: parsed.maxTeamSize, attendanceModeStrategy: parsed.attendanceModeStrategy }
    });
  });
  revalidatePath(`/admin/class-sessions/${parsed.classSessionId}`);
  revalidatePath(`/admin/class-sessions/${parsed.classSessionId}/teams`);
}

export async function addManualTeam(formData: FormData) {
  await requireAdmin();
  const parsed = teamManualSchema.parse(Object.fromEntries(formData));
  await prisma.team.upsert({
    where: { classSessionId_teamNumber: { classSessionId: parsed.classSessionId, teamNumber: parsed.teamNumber } },
    update: {
      name: parsed.name,
      plannedSize: parsed.plannedSize === "" ? null : parsed.plannedSize,
      captainEmail: parsed.captainEmail || null,
      active: true
    },
    create: {
      classSessionId: parsed.classSessionId,
      teamNumber: parsed.teamNumber,
      name: parsed.name,
      plannedSize: parsed.plannedSize === "" ? null : parsed.plannedSize,
      captainEmail: parsed.captainEmail || null
    }
  });
  revalidatePath("/admin/teams");
}

export async function deactivateTeam(formData: FormData) {
  await requireAdmin();
  await prisma.team.update({ where: { id: String(formData.get("teamId")) }, data: { active: false } });
  revalidatePath("/admin/teams");
}

export async function removeParticipant(formData: FormData) {
  await requireAdmin();
  const participant = await prisma.participant.delete({ where: { id: String(formData.get("participantId")) } });
  revalidatePath(`/admin/class-sessions/${participant.classSessionId}`);
}

export async function addValuation(formData: FormData) {
  await requireAdmin();
  const parsed = manualValuationSchema.parse(Object.fromEntries(formData));
  const classSession = parsed.classSessionId
    ? await prisma.classSession.findUniqueOrThrow({ where: { id: parsed.classSessionId } })
    : await getCurrentClassSession();
  const count = await prisma.valuation.count({ where: { classSessionId: classSession.id } });
  await prisma.valuation.create({
    data: {
      classSessionId: classSession.id,
      customerId: `C${String(count + 1).padStart(3, "0")}`,
      amount: parsed.amount,
      studentAlias: parsed.studentAlias || null,
      segment: parsed.segment
    }
  });
  revalidatePath("/admin/valuations");
}

export async function createPresetRun(formData: FormData) {
  await requireAdmin();
  const classSessionId = String(formData.get("classSessionId") || (await getCurrentClassSession()).id);
  const classSession = await prisma.classSession.findUniqueOrThrow({ where: { id: classSessionId } });
  const participantCount = await prisma.participant.count({ where: { classSessionId } });
  const preset = String(formData.get("preset"));
  const type = preset === "dynamic" ? "DYNAMIC" : preset === "post" ? "POSTSCREENING" : "STATIC";
  const name = preset === "static2" ? "Static Round 2" : preset === "dynamic" ? "Dynamic Pricing Game" : preset === "post" ? "Postscreening Game" : "Static Round 1";
  const dayLimit = defaultDrawCount(participantCount, classSession.targetDrawPercent);
  const dynamicPeriods = Math.max(Number(formData.get("dynamicPeriods") || dayLimit), 1);
  const segmentCutoffPercent = type === "POSTSCREENING" ? Number(formData.get("segmentCutoffPercent") || DEFAULT_SEGMENT_CUTOFF_PERCENT) : null;
  const segmentCutoff = type === "POSTSCREENING" ? await computeSegmentCutoffForClassSession(classSessionId, segmentCutoffPercent ?? DEFAULT_SEGMENT_CUTOFF_PERCENT) : null;
  const run = await prisma.gameRun.create({
    data: {
      classSessionId,
      name,
      type,
      capacity: defaultCapacity(type, participantCount),
      drawCount: null,
      drawPercent: classSession.targetDrawPercent,
      dynamicPeriods,
      segmentCutoff,
      segmentCutoffPercent
    }
  });
  revalidatePath(`/admin/class-sessions/${classSessionId}/runs`);
  redirect(`/admin/run/${run.id}`);
}

export async function createCustomRun(formData: FormData) {
  await requireAdmin();
  const parsed = runSchema.parse(Object.fromEntries(formData));
  const segmentCutoffPercent = parsed.type === "POSTSCREENING"
    ? parsed.segmentCutoffPercent === "" ? DEFAULT_SEGMENT_CUTOFF_PERCENT : parsed.segmentCutoffPercent
    : null;
  const segmentCutoff = parsed.type === "POSTSCREENING"
    ? parsed.segmentCutoff === "" ? await computeSegmentCutoffForClassSession(parsed.classSessionId, segmentCutoffPercent ?? DEFAULT_SEGMENT_CUTOFF_PERCENT) : parsed.segmentCutoff
    : null;
  const run = await prisma.gameRun.create({
    data: {
      classSessionId: parsed.classSessionId,
      name: parsed.name,
      type: parsed.type,
      capacity: parsed.capacity,
      drawCount: parsed.drawCount === "" ? null : parsed.drawCount,
      drawPercent: parsed.drawPercent,
      dynamicPeriods: parsed.dynamicPeriods,
      segmentCutoff,
      segmentCutoffPercent
    }
  });
  redirect(`/admin/run/${run.id}`);
}

export async function controlRun(formData: FormData) {
  await requireAdmin();
  const runId = String(formData.get("runId"));
  const action = String(formData.get("action"));
  const periodId = formData.get("periodId") ? String(formData.get("periodId")) : null;
  let message = "Action complete.";
  await ensureMinimumDynamicPeriods(runId);
  if (action === "open") {
    const run = await prisma.gameRun.update({ where: { id: runId }, data: { status: "OPEN", currentDrawOrder: 0 } });
    await prisma.classSession.update({ where: { id: run.classSessionId }, data: { status: "GAME_ACTIVE" } });
    if (periodId) await prisma.roundPeriod.update({ where: { id: periodId }, data: { status: "OPEN", deadline: null } });
    if ((run.type === "DYNAMIC" || run.type === "POSTSCREENING") && !periodId) await openDynamicPricingDay(run.id, 1);
    message = (run.type === "DYNAMIC" || run.type === "POSTSCREENING") && !periodId ? "Day 1 pricing is open. Teams can submit prices." : periodId ? "Period opened. Teams can submit decisions." : "Run opened. Teams can submit decisions.";
  }
  if (action === "lock") {
    if (periodId) await prisma.roundPeriod.update({ where: { id: periodId }, data: { status: "LOCKED" } });
    else await prisma.gameRun.update({ where: { id: runId }, data: { status: "LOCKED" } });
    message = "Submissions locked.";
  }
  if (action === "simulate") {
    await runSimulation(runId);
    const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.type === "DYNAMIC" || run.type === "POSTSCREENING") await openDynamicPricingDay(runId, run.currentPeriod ?? 1);
    message = run.type === "DYNAMIC" || run.type === "POSTSCREENING" ? `Day ${run.currentPeriod ?? 1} pricing remains open. Use next-day controls after teams submit.` : "Day-by-day simulation is ready. Use the next-day controls.";
  }
  if (action === "reveal") {
    await prisma.gameRun.update({ where: { id: runId }, data: { status: "REVEALED" } });
    message = "Scoreboard revealed.";
  }
  if (action === "revealPrices") {
    await prisma.gameRun.update({ where: { id: runId }, data: { revealPrices: true } });
    message = "Team prices revealed.";
  }
  if (action === "revealHistogram") {
    await prisma.gameRun.update({ where: { id: runId }, data: { revealValuationHistogram: true } });
    message = "Valuation histogram revealed.";
  }
  if (action === "endRun") {
    await prisma.gameRun.update({
      where: { id: runId },
      data: {
        status: "REVEALED",
        revealValuationHistogram: true
      }
    });
    await prisma.roundPeriod.updateMany({ where: { gameRunId: runId, status: "OPEN" }, data: { status: "REVEALED" } });
    message = "Run ended. Scoreboard and arrival valuation histogram are now revealed.";
  }
  if (action === "nextDayNoArrival") {
    try {
      const result = await addDayToRun(runId, "NO_ARRIVAL");
      message = `Day ${result.day}: no arrival.`;
    } catch (error) {
      message = `Could not proceed to the next day: ${errorMessage(error)}`;
    }
  }
  if (action === "nextDayRandomArrival") {
    try {
      const result = await addDayToRun(runId, "RANDOM");
      message = `Day ${result.day}: random arrival drawn.`;
    } catch (error) {
      message = `Could not draw a random arrival: ${errorMessage(error)}`;
    }
  }
  if (action === "nextDayLowArrival") {
    try {
      const result = await addDayToRun(runId, "LOW");
      message = `Day ${result.day}: below-cutoff arrival drawn.`;
    } catch (error) {
      message = `Could not draw a below-cutoff arrival: ${errorMessage(error)}`;
    }
  }
  if (action === "nextDayHighArrival") {
    try {
      const result = await addDayToRun(runId, "HIGH");
      message = `Day ${result.day}: above-cutoff arrival drawn.`;
    } catch (error) {
      message = `Could not draw an above-cutoff arrival: ${errorMessage(error)}`;
    }
  }
  if (action === "reset") {
    await prisma.teamResult.deleteMany({ where: { gameRunId: runId } });
    await prisma.activeDecision.deleteMany({ where: { gameRunId: runId } });
    await prisma.submission.deleteMany({ where: { gameRunId: runId } });
    await prisma.customerDraw.deleteMany({ where: { gameRunId: runId } });
    await prisma.gameRun.update({ where: { id: runId }, data: { status: "DRAFT", revealPrices: false, revealValuationHistogram: false, currentDrawOrder: 0 } });
    await prisma.roundPeriod.updateMany({ where: { gameRunId: runId }, data: { status: "DRAFT" } });
    message = "Run reset.";
  }
  revalidatePath(`/admin/run/${runId}`);
  revalidatePath("/scoreboard");
  redirect(`/admin/run/${runId}?message=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function shortCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
