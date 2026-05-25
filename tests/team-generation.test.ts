import { describe, expect, it } from "vitest";
import { defaultDrawCount, generateTeamAssignments, planTeams } from "../lib/team-generation";

function expectValidPlan(students: number) {
  const result = planTeams({ numberOfStudents: students, minTeamSize: 4, maxTeamSize: 5 });
  expect(result.ok).toBe(true);
  expect(result.teams.reduce((sum, team) => sum + team.plannedSize, 0)).toBe(students);
  expect(result.teams.every((team) => team.plannedSize >= 4 && team.plannedSize <= 5)).toBe(true);
  return result;
}

describe("team generation", () => {
  it("plans 20 students into valid teams", () => {
    const result = expectValidPlan(20);
    expect(result.teams.map((team) => team.plannedSize)).toEqual([5, 5, 5, 5]);
  });

  it("plans 24 students without a hard-coded team count", () => {
    const result = expectValidPlan(24);
    expect(result.teams.map((team) => team.plannedSize)).toEqual([5, 5, 5, 5, 4]);
  });

  it("plans 33 students into valid teams", () => {
    const result = expectValidPlan(33);
    expect(result.teams.map((team) => team.plannedSize).sort((a, b) => b - a)).toEqual([5, 5, 5, 5, 5, 4, 4]);
  });

  it("plans 66 students into 14 balanced teams", () => {
    const result = expectValidPlan(66);
    expect(result.teams).toHaveLength(14);
    expect(result.teams.map((team) => team.plannedSize).sort((a, b) => b - a)).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4]);
  });

  it("warns for impossible small classes unless override is enabled", () => {
    expect(planTeams({ numberOfStudents: 3, minTeamSize: 4, maxTeamSize: 5 }).ok).toBe(false);
    expect(planTeams({ numberOfStudents: 6, minTeamSize: 4, maxTeamSize: 5 }).ok).toBe(false);
    expect(planTeams({ numberOfStudents: 3, minTeamSize: 4, maxTeamSize: 5, allowOverride: true }).ok).toBe(true);
  });

  it("handles exact low-edge classes", () => {
    expect(expectValidPlan(8).teams.map((team) => team.plannedSize)).toEqual([4, 4]);
    expect(expectValidPlan(9).teams.map((team) => team.plannedSize)).toEqual([5, 4]);
    expect(expectValidPlan(10).teams.map((team) => team.plannedSize)).toEqual([5, 5]);
  });

  it("assigns every checked-in participant exactly once", () => {
    const participants = Array.from({ length: 33 }, (_, index) => ({ id: `p${index + 1}` }));
    const result = generateTeamAssignments(participants, 4, 5, { randomSeed: "class-a" });
    expect(result.ok).toBe(true);
    const assignedIds = result.teams.flatMap((team) => team.participantIds ?? []);
    expect(new Set(assignedIds).size).toBe(33);
    expect(assignedIds.sort()).toEqual(participants.map((participant) => participant.id).sort());
    expect(result.teams.every((team) => team.plannedSize === team.participantIds?.length)).toBe(true);
  });

  it("bases run draw count on actual valuation count", () => {
    expect(defaultDrawCount(40, 0.7)).toBe(28);
    expect(defaultDrawCount(3, 0.7)).toBe(10);
    expect(defaultDrawCount(40, 0.7, 500)).toBe(500);
  });
});
