import { describe, expect, it } from "vitest";
import { canCreateValidTeams, createBalancedTeamSizes, generateAttendanceAwareTeamAssignments, type AssignmentParticipant, type AttendanceModeStrategy, type TeamPlan } from "../lib/team-generation";

function participants(inPerson: number, online: number): AssignmentParticipant[] {
  return [
    ...Array.from({ length: inPerson }, (_, index) => ({ id: `in-${index + 1}`, displayName: `In ${index + 1}`, attendanceMode: "IN_PERSON" })),
    ...Array.from({ length: online }, (_, index) => ({ id: `on-${index + 1}`, displayName: `Online ${index + 1}`, attendanceMode: "ONLINE" }))
  ];
}

function expectValid(result: ReturnType<typeof generateAttendanceAwareTeamAssignments>, total: number) {
  expect(result.ok).toBe(true);
  expect(result.teams.every((team) => team.plannedSize >= 4 && team.plannedSize <= 5)).toBe(true);
  const ids = result.teams.flatMap((team) => team.participantIds ?? []);
  expect(ids).toHaveLength(total);
  expect(new Set(ids).size).toBe(total);
  return result.teams;
}

function run(inPerson: number, online: number, strategy: AttendanceModeStrategy) {
  return generateAttendanceAwareTeamAssignments({
    participants: participants(inPerson, online),
    minTeamSize: 4,
    maxTeamSize: 5,
    strategy,
    randomSeed: `${inPerson}-${online}-${strategy}`
  });
}

function onlineCountsInMixed(teams: TeamPlan[]) {
  return teams.filter((team) => team.attendanceMix === "MIXED").map((team) => team.onlineCount ?? 0);
}

describe("attendance-aware team assignment", () => {
  it("creates separate teams for valid in-person and online groups by default", () => {
    const result = run(40, 20, "PREFER_SAME_ATTENDANCE");
    const teams = expectValid(result, 60);
    expect(result.assignmentSummary?.mixedTeams).toBe(0);
    expect(teams.every((team) => team.attendanceMix !== "MIXED")).toBe(true);
  });

  it("strictly separates valid attendance groups", () => {
    const result = run(40, 20, "STRICT_SEPARATE_ATTENDANCE");
    expectValid(result, 60);
    expect(result.assignmentSummary?.mixedTeams).toBe(0);
  });

  it("handles only in-person students", () => {
    const teams = expectValid(run(24, 0, "PREFER_SAME_ATTENDANCE"), 24);
    expect(teams.every((team) => team.attendanceMix === "IN_PERSON_ONLY")).toBe(true);
  });

  it("handles only online students", () => {
    const teams = expectValid(run(0, 24, "PREFER_SAME_ATTENDANCE"), 24);
    expect(teams.every((team) => team.attendanceMix === "ONLINE_ONLY")).toBe(true);
  });

  it("minimizes mixed teams when online count is not independently valid", () => {
    const result = run(30, 6, "PREFER_SAME_ATTENDANCE");
    const teams = expectValid(result, 36);
    expect(result.assignmentSummary?.mixedTeams).toBe(1);
    expect(onlineCountsInMixed(teams)).toEqual([2]);
  });

  it("keeps two online students together when mixing is necessary", () => {
    const result = run(64, 2, "PREFER_SAME_ATTENDANCE");
    const teams = expectValid(result, 66);
    expect(result.assignmentSummary?.mixedTeams).toBe(1);
    expect(onlineCountsInMixed(teams)).toEqual([2]);
  });

  it("keeps three online students together when mixing is necessary", () => {
    const result = run(50, 3, "PREFER_SAME_ATTENDANCE");
    const teams = expectValid(result, 53);
    expect(result.assignmentSummary?.mixedTeams).toBe(1);
    expect(onlineCountsInMixed(teams)).toEqual([3]);
  });

  it("blocks strict separation when a group cannot form valid teams", () => {
    expect(run(30, 6, "STRICT_SEPARATE_ATTENDANCE").ok).toBe(false);
    expect(run(64, 2, "STRICT_SEPARATE_ATTENDANCE").ok).toBe(false);
  });

  it("can ignore attendance while still assigning everyone", () => {
    const result = run(40, 20, "IGNORE_ATTENDANCE");
    expectValid(result, 60);
    expect(result.assignmentSummary?.totalTeams).toBe(12);
  });

  it("uses general balanced team size helpers", () => {
    expect(canCreateValidTeams(6, 4, 5)).toBe(false);
    expect(createBalancedTeamSizes(20, 4, 5)).toEqual([5, 5, 5, 5]);
    expect(createBalancedTeamSizes(24, 4, 5)).toEqual([5, 5, 5, 5, 4]);
    expect(createBalancedTeamSizes(33, 4, 5)).toEqual([5, 5, 5, 5, 5, 4, 4]);
    expect(createBalancedTeamSizes(66, 4, 5)).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4]);
  });
});
